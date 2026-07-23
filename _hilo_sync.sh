#!/usr/bin/env bash
# _hilo_sync.sh — ESPEJO del Hilo: `_cerebro/HILO - <Cliente>.md` → CSV listo para la hoja `hilo`.
#
# TC-W1 (21-jul-2026). El `.md` en el Mac es la FUENTE DE VERDAD (plan v3 §2.1); la hoja `hilo` del
# Sheet del cliente es un espejo. GAS no puede leer el Mac, así que este script es el puente.
#
# POR QUÉ CSV Y NO ESCRITURA DIRECTA POR API (decisión, no pereza):
#   Escribir el Sheet desde acá exigiría credenciales OAuth propias del script y scopes nuevos —
#   una superficie de acceso nueva por un paso que se corre a mano cada tanto. Con CSV el script no
#   toca nada: parsea, valida y deja el archivo. El paso de subida es una llamada a `espejarHiloCSV`
#   (editor GAS, o Cowork con su acceso a Sheets), y queda AUDITABLE a ojo antes de aplicarse.
#   La vía más simple que funciona HOY, que es lo que pedía el encargo.
#
# USO:
#   bash _hilo_sync.sh CLI-002 "/ruta/al/HILO - Vehemence.md"
#   bash _hilo_sync.sh CLI-002 "/ruta/HILO - Vehemence.md" --print   # al stdout, sin escribir archivo
#
# SALIDA: <mismo directorio del .md>/hilo-<CLI>.csv  con header
#         seccion,item,detalle,estado,evidencia,fecha,prioridad,dueno
#
# FORMATO QUE PARSEA (el que escribe la skill hilo-de-trabajo) — tablas markdown bajo encabezados
# de sección. El encabezado define la sección; la tabla, las filas:
#
#   ## Plan
#   | item | detalle | estado | evidencia | fecha | prioridad | dueno |
#   |---|---|---|---|---|---|---|
#   | Migrar el catálogo | 1.200 SKUs | en curso | ticket 88 | 2026-08-01 | A | Luciano |
#
#   ## Real
#   ...
#
# Secciones reconocidas (vocabulario CERRADO, igual que `HILO_SECCIONES` en src/25_hilo.js):
#   plan · real · desviado (o "desvíos"/"desviaciones") · pendiente (o "pendientes")
# Un encabezado que no matchea NINGUNA se ignora entero y se avisa — no se adivina a qué sección
# pertenece. Esa es la misma frontera de confianza que aplica el backend al espejar.

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

# Vocabulario CERRADO. Espejo exacto de HILO_SECCIONES (src/25_hilo.js); si cambia allá, cambia acá.
SECCIONES = {
    "plan": "plan", "planificado": "plan", "lo acordado": "plan",
    "real": "real", "lo real": "real", "ejecutado": "real",
    "desviado": "desviado", "desvio": "desviado", "desvios": "desviado",
    "desviacion": "desviado", "desviaciones": "desviado",
    "pendiente": "pendiente", "pendientes": "pendiente", "falta": "pendiente",
}

def normaliza_seccion(titulo):
    t = sin_tildes(titulo.strip().lower())
    t = re.sub(r"[^a-z ]", "", t).strip()
    return SECCIONES.get(t)

texto = open(md_path, encoding="utf-8").read()
# El frontmatter YAML (si lo hay) no aporta filas: se saltea entero.
texto = re.sub(r"\A---\n.*?\n---\n", "", texto, flags=re.S)

filas, seccion_actual, headers, ignoradas, sin_seccion = [], None, None, [], 0

for linea in texto.split("\n"):
    l = linea.strip()

    m = re.match(r"^#{1,6}\s+(.+?)\s*$", l)
    if m:
        s = normaliza_seccion(m.group(1))
        if s:
            seccion_actual, headers = s, None
        else:
            seccion_actual, headers = None, None
            ignoradas.append(m.group(1))
        continue

    if not l.startswith("|"):
        continue

    celdas = [c.strip() for c in l.strip("|").split("|")]
    if all(re.fullmatch(r":?-{2,}:?", c or "") for c in celdas if c != ""):
        continue                                    # separador |---|---|

    if seccion_actual is None:
        sin_seccion += 1                            # tabla fuera de toda sección conocida
        continue

    if headers is None:                             # primera fila de la tabla = sus headers
        headers = [sin_tildes(c.lower()).replace("ñ", "n") for c in celdas]
        continue

    fila = {"seccion": seccion_actual}
    for i, h in enumerate(headers):
        if i < len(celdas) and h in COLS and h != "seccion":
            fila[h] = celdas[i]
    # Sin `item` la fila no es nada: se descarta (el backend haría lo mismo al espejar).
    if fila.get("item", "").strip():
        filas.append(fila)

if not filas:
    print(f"ERROR: no se extrajo ninguna fila de {md_path}.", file=sys.stderr)
    print("       Revisá que las secciones sean ## Plan / ## Real / ## Desviado / ## Pendiente", file=sys.stderr)
    print("       y que cada una tenga una tabla markdown con al menos la columna `item`.", file=sys.stderr)
    if ignoradas:
        print(f"       Encabezados ignorados (no matchean el vocabulario): {', '.join(ignoradas[:8])}", file=sys.stderr)
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
    msg.append(f"AVISO: {len(ignoradas)} encabezado(s) ignorado(s) (fuera del vocabulario): {', '.join(ignoradas[:5])}")
if sin_seccion:
    msg.append(f"AVISO: {sin_seccion} fila(s) de tabla fuera de toda sección conocida — no se adivinó a cuál iban.")
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
