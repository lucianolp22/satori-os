#!/usr/bin/env bash
# _hilo_sync.sh — ESPEJO del Hilo: `_cerebro/HILO - <Cliente>.md` → CSV listo para la hoja `hilo`.
#
# TC-W1 (21-jul-2026) · PARSER v2 (27-jul-2026, Fix B). El `.md` en el Mac es la FUENTE DE VERDAD
# (plan v3 §2.1); la hoja `hilo` del Sheet del cliente es un espejo. GAS no puede leer el Mac, así
# que este script es el puente.
#
# POR QUÉ CSV Y NO ESCRITURA DIRECTA POR API (decisión, no pereza):
#   Escribir el Sheet desde acá exigiría credenciales OAuth propias del script y scopes nuevos —
#   una superficie de acceso nueva por un paso que se corre a mano cada tanto. Con CSV el script no
#   toca nada: parsea, valida y deja el archivo. El paso de subida es una llamada a `espejarHiloCSV`
#   (editor GAS, o Cowork con su acceso a Sheets), y queda AUDITABLE a ojo antes de aplicarse.
#
# USO:
#   bash _hilo_sync.sh CLI-002 "/ruta/al/HILO - Vehemence.md"
#   bash _hilo_sync.sh CLI-002 "/ruta/HILO - Vehemence.md" --print   # al stdout, sin escribir archivo
#
# SALIDA: <mismo directorio del .md>/hilo-<CLI>.csv  con header
#         seccion,item,detalle,estado,evidencia,fecha,prioridad,dueno
#
# ═══ PARSER v2 — FIX B (27-jul) ═══════════════════════════════════════════════════════════════
# La v1 exigía un vocabulario CERRADO de encabezados (## Plan / ## Real / …) con tablas cuyas
# columnas fueran EXACTAMENTE las del contrato. La skill `hilo-de-trabajo` escribe otra cosa:
# secciones narrativas numeradas (`## 1. Planificado — baseline…`) con tableros y bullets propios.
# Resultado: CSV vacío → "Hilo no cargado" en TODOS los clientes (lección LISTA-CONTRATO: dos
# mitades que no hablan el mismo idioma pasan todos los tests porque cada una funciona sola).
#
# v2 matchea por RAÍZ/PREFIJO (nunca string exacto — §3/§4 cambian de título entre archivos):
#   ## 1. Planificado…                  → filas `plan`      (bullets y/o tabla)
#   ## 2. Plan vs Real…                 → filas `real`      (tablero: Comprometido/Estado/Real/Desvío/Próx.)
#   ## 3. Desvíos…                      → filas `desviado`  (bullets o tabla Fecha/Qué/Por qué/Quién)
#   ## 4. Pendientes…                   → filas `pendiente` (numerados/bullets bajo **Must/Should/Nice**,
#                                                            o tablas Ítem/Detalle/Dueño/Gate)
#   ## Plan / Real / Desviado / Pendiente (v1) → compat: tabla con columnas del contrato, como antes.
# Todo lo demás (BLUF, Decisiones, Riesgos, Próximo paso, Enlaces) se IGNORA y se AVISA — la misma
# frontera de confianza del backend: sección no reconocida no se adivina.
# El esquema de 8 columnas y `HILO_SECCIONES` (src/25_hilo.js) NO cambian: el contrato roto estaba
# de este lado.

set -euo pipefail

CLI="${1:-}"
MD="${2:-}"
MODO="${3:-}"

if [ -z "$CLI" ] || [ -z "$MD" ]; then
  echo "uso: bash _hilo_sync.sh <CLI-00X> <ruta-al-HILO.md> [--print]" >&2
  exit 2
fi
if [ ! -f "$MD" ]; then
  echo "ERROR: no existe el archivo: $MD" >&2
  exit 1
fi

OUT="$(dirname "$MD")/hilo-${CLI}.csv"

python3 - "$CLI" "$MD" "$OUT" "$MODO" <<'PY'
import csv, io, re, sys, unicodedata

cli, md_path, out_path, modo = sys.argv[1], sys.argv[2], sys.argv[3], (sys.argv[4] if len(sys.argv) > 4 else "")

COLS = ["seccion", "item", "detalle", "estado", "evidencia", "fecha", "prioridad", "dueno"]

def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def limpiar(s, maxlen):
    """Texto de celda: sin wikilinks, sin negritas, sin pipes internos, colapsado y truncado."""
    s = str(s or "")
    # [[ruta|alias]] → alias · [[ruta]] → última parte de la ruta
    s = re.sub(r"\[\[([^\]|]*\|)?([^\]]+)\]\]", lambda m: m.group(2).split("/")[-1], s)
    s = s.replace("**", "").replace("`", "")
    s = re.sub(r"\s+", " ", s).strip(" -—·")
    s = s.strip()
    return (s[: maxlen - 1] + "…") if len(s) > maxlen else s

# ── Detección de sección por RAÍZ (v2) ────────────────────────────────────────
def clasificar_seccion(titulo):
    """Devuelve (modo, seccion_base) o (None, None) si el encabezado no se reconoce."""
    t = sin_tildes(titulo.strip().lower())
    t = re.sub(r"^[#\s]*", "", t)
    t = re.sub(r"^\d+[\.\)]\s*", "", t)          # "1. Planificado" → "planificado"
    if t.startswith("plan vs real"):
        return ("tablero", "real")
    if t.startswith("planificado") or t == "plan" or t.startswith("plan ") or t.startswith("lo acordado"):
        return ("libre", "plan")
    if t.startswith("desvio") or t.startswith("desviado") or t.startswith("desviacion"):
        return ("libre", "desviado")
    if t.startswith("pendiente") or t.startswith("falta"):
        return ("pendientes", "pendiente")
    if t == "real" or t.startswith("real ") or t.startswith("ejecutado") or t.startswith("lo real"):
        return ("libre", "real")
    return (None, None)

# ── Estado del tablero: emoji → palabra (leyenda de la skill) ────────────────
EMOJI_ESTADO = [("\u2705", "hecho"), ("\U0001F527", "en curso"), ("\u23F8", "pausado"),
                ("\u26A0", "desviado"), ("\u274C", "caído"), ("\U0001F51C", "pendiente")]
def normalizar_estado(crudo):
    crudo = str(crudo or "").strip()
    hallados = [pal for emo, pal in EMOJI_ESTADO if emo in crudo]
    if hallados:
        return "/".join(hallados)
    return limpiar(crudo, 40)

def celdas_de(linea):
    # Los wikilinks [[ruta|alias]] llevan un `|` INTERNO que rompería el split de la tabla →
    # se resuelven a su alias ANTES de partir (bug cazado en la validación del 27-jul con
    # la fila 1 del tablero de Vehemence).
    linea = re.sub(r"\[\[([^\]|]*\|)?([^\]]+)\]\]", lambda m: m.group(2).split("/")[-1], linea)
    return [c.strip() for c in linea.strip().strip("|").split("|")]

def es_separador(celdas):
    return all(re.fullmatch(r":?-{2,}:?", c or "") for c in celdas if c != "") and any(celdas)

def norm_header(c):
    return sin_tildes(str(c).lower()).replace("ñ", "n").strip()

# item = la parte "título" de un bullet: la negrita inicial, o hasta el primer separador fuerte.
def partir_item(texto):
    t = str(texto or "").strip()
    m = re.match(r"^\*\*(.+?)\*\*\s*[:—-]?\s*(.*)$", t, flags=re.S)
    if m:
        return limpiar(m.group(1), 140).rstrip(":"), limpiar(m.group(2), 300)
    for sep in [" — ", ": ", " · "]:
        i = t.find(sep)
        if 0 < i <= 110:
            return limpiar(t[:i], 140), limpiar(t[i + len(sep):], 300)
    if len(t) <= 140:
        return limpiar(t, 140), ""
    return limpiar(t[:110], 140), limpiar(t[110:], 300)

def extraer_dueno(texto):
    """Best-effort: '— dueño: X' / 'dueño: X' al final del texto. Devuelve (texto_sin, dueno)."""
    m = re.search(r"[—\-·]\s*due[nñ]o:\s*([^·—]+?)\s*$", texto, flags=re.I)
    if m:
        return texto[: m.start()].strip(), limpiar(m.group(1), 40)
    return texto, ""

texto = open(md_path, encoding="utf-8").read()
texto = re.sub(r"\A---\n.*?\n---\n", "", texto, flags=re.S)   # frontmatter YAML fuera

filas, ignoradas, avisos = [], [], []
modo_sec, sec_base = None, None       # modo de la sección actual
headers = None                        # headers de la tabla en curso
prioridad = ""                        # prioridad activa en modo pendientes ('' = sin sub-header aún)
en_resueltos = False                  # bloque "Resueltos…" del §4 → se ignora (ya no son pendientes)

PRIORIDADES = {"must": "A", "should": "B", "nice": "C"}

for linea in texto.split("\n"):
    l = linea.rstrip()
    ls = l.strip()

    # ── Encabezados de sección ──
    m = re.match(r"^#{1,6}\s+(.+?)\s*$", ls)
    if m:
        titulo = m.group(1)
        if re.match(r"^#\s", l):                 # H1 = título del documento, no una sección
            continue
        modo_sec, sec_base = clasificar_seccion(titulo)
        headers, prioridad, en_resueltos = None, "", False
        if modo_sec is None:
            ignoradas.append(limpiar(titulo, 60))
        continue

    if modo_sec is None:
        continue

    # ── Sub-headers de prioridad (modo pendientes): **Must** / **Should** / **Nice** ──
    if modo_sec == "pendientes":
        msub = re.match(r"^\*\*([A-Za-zÁ-úü ]+)\*\*\s*$", ls)
        if msub:
            clave = sin_tildes(msub.group(1).strip().lower())
            if clave in PRIORIDADES:
                prioridad, en_resueltos, headers = PRIORIDADES[clave], False, None
            else:
                prioridad, en_resueltos, headers = "", True, None   # sub-bloque desconocido → no adivinar
            continue
        if re.match(r"^\*\*Resueltos", ls):
            en_resueltos = True
            continue
        if en_resueltos:
            continue

    # ── Tablas (cualquier modo) ──
    if ls.startswith("|"):
        celdas = celdas_de(ls)
        if es_separador(celdas):
            continue
        if headers is None:
            headers = [norm_header(c) for c in celdas]
            continue
        fila_map = {}
        for i, h in enumerate(headers):
            if i < len(celdas):
                fila_map[h] = celdas[i]

        # (a) TABLERO §2: Comprometido / Estado / Real / Desvío / Próx.
        h_item = next((h for h in headers if h.startswith("comprometido")), None)
        h_real = next((h for h in headers if h.startswith("real")), None)
        if modo_sec == "tablero" and h_item:
            item = limpiar(fila_map.get(h_item, ""), 140)
            if not item:
                continue
            det = limpiar(fila_map.get(h_real, ""), 220) if h_real else ""
            h_desv = next((h for h in headers if h.startswith("desvio")), None)
            h_prox = next((h for h in headers if h.startswith("prox")), None)
            desv = limpiar(fila_map.get(h_desv, ""), 120) if h_desv else ""
            prox = limpiar(fila_map.get(h_prox, ""), 100) if h_prox else ""
            if desv and desv not in ("—", "-"):
                det = (det + " · desvío: " + desv).strip(" ·")
            if prox and prox not in ("—", "-"):
                det = (det + " · próx: " + prox).strip(" ·")
            filas.append({"seccion": "real", "item": item, "detalle": det[:300],
                          "estado": normalizar_estado(fila_map.get("estado", ""))})
            continue

        # (b) tabla de DESVÍOS (Vehemence §3): Fecha / Qué / Por qué / Quién decidió
        if modo_sec == "libre" and sec_base == "desviado" and ("que" in headers or "qué" in headers):
            item = limpiar(fila_map.get("que", fila_map.get("qué", "")), 140)
            if not item:
                continue
            det = limpiar(fila_map.get("por que", fila_map.get("por qué", "")), 240)
            quien = limpiar(next((v for h, v in fila_map.items() if h.startswith("quien")), ""), 60)
            if quien and quien not in ("—", "-"):
                det = (det + " · decidió: " + quien).strip(" ·")
            filas.append({"seccion": "desviado", "item": item, "detalle": det[:300],
                          "fecha": limpiar(fila_map.get("fecha", ""), 20)})
            continue

        # (c) tabla de PENDIENTES (Vehemence §4): Ítem / Detalle / Dueño / Gate
        if modo_sec == "pendientes" and ("item" in headers):
            item = limpiar(fila_map.get("item", ""), 140)
            if not item:
                continue
            det = limpiar(fila_map.get("detalle", ""), 240)
            gate = limpiar(fila_map.get("gate", ""), 80)
            if gate and gate not in ("—", "-"):
                det = (det + " · gate: " + gate).strip(" ·")
            filas.append({"seccion": "pendiente", "item": item, "detalle": det[:300],
                          "prioridad": prioridad, "dueno": limpiar(fila_map.get("dueno", ""), 40)})
            continue

        # (d) COMPAT v1: tabla con las columnas del contrato bajo una sección reconocida
        if set(h for h in headers if h) & set(COLS) and "item" in headers:
            fila = {"seccion": sec_base}
            for h, v in fila_map.items():
                if h in COLS and h != "seccion":
                    fila[h] = limpiar(v, 300)
            if fila.get("item", "").strip():
                if modo_sec == "pendientes" and prioridad and not fila.get("prioridad"):
                    fila["prioridad"] = prioridad
                filas.append(fila)
            continue

        avisos.append(f"tabla con headers no reconocidos en '{sec_base}': {', '.join(headers[:5])}")
        headers = None
        continue

    # ── Bullets y numerados (modo libre y pendientes) ──
    mb = re.match(r"^(?:[-*]|\d+[\.\)])\s+(.+)$", ls)
    if mb and modo_sec in ("libre", "pendientes"):
        cuerpo = mb.group(1).strip()
        cuerpo, dueno = extraer_dueno(cuerpo)
        item, det = partir_item(cuerpo)
        if not item:
            continue
        fila = {"seccion": sec_base, "item": item, "detalle": det}
        if dueno:
            fila["dueno"] = dueno
        if modo_sec == "pendientes":
            fila["prioridad"] = prioridad
        filas.append(fila)
        continue

    # prosa suelta (párrafos, blockquotes, "Fuente:") → no es una fila; se ignora en silencio
    continue

if not filas:
    print(f"ERROR: no se extrajo ninguna fila de {md_path}.", file=sys.stderr)
    print("       El parser v2 espera las secciones de la skill hilo-de-trabajo:", file=sys.stderr)
    print("       ## 1. Planificado… / ## 2. Plan vs Real… / ## 3. Desvíos… / ## 4. Pendientes…", file=sys.stderr)
    if ignoradas:
        print(f"       Encabezados ignorados: {', '.join(ignoradas[:8])}", file=sys.stderr)
    sys.exit(1)

buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=COLS, extrasaction="ignore", lineterminator="\n")
w.writeheader()
for f in filas:
    w.writerow({c: f.get(c, "") for c in COLS})
csv_txt = buf.getvalue()

if modo == "--print":
    sys.stdout.write(csv_txt)
else:
    open(out_path, "w", encoding="utf-8").write(csv_txt)

conteo = {}
for f in filas:
    conteo[f["seccion"]] = conteo.get(f["seccion"], 0) + 1

msg = [f"OK — {len(filas)} fila(s): " + " · ".join(f"{k} {v}" for k, v in sorted(conteo.items()))]
if ignoradas:
    msg.append(f"AVISO: {len(ignoradas)} encabezado(s) ignorado(s) (fuera del mapeo, no se adivina): {', '.join(ignoradas[:6])}")
for a in avisos[:5]:
    msg.append("AVISO: " + a)
if modo != "--print":
    msg.append(f"CSV → {out_path}")
    msg.append("")
    msg.append("SUBIRLO (una de las dos vías, ninguna necesita credenciales nuevas):")
    msg.append(f"  a) editor GAS:  espejarHiloCSV('{cli}', `<pegá el contenido del CSV>`)")
    msg.append("  b) Cowork, con su acceso a Sheets, pega el CSV en la hoja `hilo` del Sheet del cliente.")
    msg.append("")
    msg.append("El espejo REEMPLAZA todo el Hilo del cliente (el .md es la fuente). Si el CSV viniera")
    msg.append("vacío o roto, `espejarHilo` TIRA y deja intacto lo que ya estaba cargado.")
print("\n".join(msg), file=sys.stderr)
PY
