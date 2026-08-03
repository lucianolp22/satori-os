#!/usr/bin/env bash
# _charla_pull.sh — TC-5 · Capa 3 «Hilos siempre vivos».
# Baja lo hablado con Sato (hoja `charla` de cada tenant) a `entregables/charlas/<CLI-00X>-charla.md`
# para que Cowork lo vuelque al Hilo.
#
# EL `.md` DEL HILO SIGUE SIENDO LA FUENTE DE VERDAD (plan v3 §2.1). Esto es una LECTURA: el
# backend no escribe una sola celda por este camino, y este script no sube nada.
#
# ── SECRETO: NUNCA en este archivo ───────────────────────────────────────────────────────────
# Mismo patrón que el resto del repo (agente de voz, sync de la Oficina): variables de entorno,
# opcionalmente cargadas de `.env.local`, que está gitignoreado. Si falta, el script FRENA con un
# mensaje claro — no intenta nada a medias.
#   CHARLA_EXPORT_URL     URL del deployment (/dev mientras se prueba, /exec en prod)
#   CHARLA_EXPORT_SECRET  el secreto propio de esta acción
# Se siembra/rota desde el editor de GAS con `rotarSecretoCharlaExport()`, que lo MUESTRA una sola
# vez; se pega acá:
#   ~/Documents/Claude/Projects/SatoriOS/.env.local
#     CHARLA_EXPORT_URL=https://script.google.com/…/dev
#     CHARLA_EXPORT_SECRET=<el valor>
#
# Es un secreto PROPIO, no el de voz: `VOZ_TOOL_SECRET` vive en el .env de un VPS con LiveKit y no
# tiene por qué habilitar la descarga de todas las conversaciones (least privilege).
#
# USO:
#   bash _charla_pull.sh                 # todos los clientes
#   bash _charla_pull.sh CLI-002         # uno solo
#   bash _charla_pull.sh CLI-002 2026-07-01   # uno, desde una fecha
#   bash _charla_pull.sh --dry           # muestra qué haría, sin escribir ni llamar
set -euo pipefail
cd "$(dirname "$0")"

CLI="${1:-}"
DESDE="${2:-}"
DRY=""
[ "${CLI}" = "--dry" ] && { DRY="1"; CLI=""; }

DEST="entregables/charlas"

# ── .env.local (opcional): no se versiona, y las variables de entorno ya puestas MANDAN ────────
if [ -f .env.local ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.local; set +a
fi

falta() { echo "ABORT: falta $1."; echo "  Sembralo con rotarSecretoCharlaExport() en el editor de GAS y pegalo en .env.local (ver cabecera)."; exit 1; }
[ -n "${CHARLA_EXPORT_URL:-}" ]    || falta "CHARLA_EXPORT_URL"
[ -n "${CHARLA_EXPORT_SECRET:-}" ] || falta "CHARLA_EXPORT_SECRET"
command -v python3 >/dev/null || { echo "ABORT: hace falta python3 para partir la respuesta por cliente."; exit 1; }

if [ -n "$DRY" ]; then
  echo "DRY RUN"
  echo "  URL     : ${CHARLA_EXPORT_URL%%\?*}"
  echo "  secreto : (presente, ${#CHARLA_EXPORT_SECRET} chars — no se imprime)"
  echo "  destino : $DEST/<CLI-00X>-charla.md"
  echo "  alcance : ${CLI:-todos los clientes}${DESDE:+ · desde $DESDE}"
  exit 0
fi

mkdir -p "$DEST"
TMP="$(mktemp -t charla_pull)"
trap 'rm -f "$TMP"' EXIT

# El secreto viaja en el BODY (nunca en la URL: las query strings quedan en logs e historiales).
# --fail-with-body para poder mostrar el error del backend en vez de un silencio.
# El secreto se pasa por ENTORNO a python, nunca como argumento: los argv se ven en `ps`.
BODY=$(SEC="$CHARLA_EXPORT_SECRET" CLI="$CLI" DESDE="$DESDE" python3 - <<'PY'
import json, os
print(json.dumps({"action": "charla_export", "secret": os.environ["SEC"],
                  "cliente": os.environ.get("CLI", ""), "desde": os.environ.get("DESDE", "")}))
PY
)

echo "→ pidiendo charlas${CLI:+ de $CLI}${DESDE:+ desde $DESDE}…"
HTTP=$(curl -sS -L -o "$TMP" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data-binary "$BODY" \
  "$CHARLA_EXPORT_URL") || { echo "ABORT: la llamada falló (¿URL correcta? ¿deployment vivo?)"; exit 1; }

if [ "$HTTP" != "200" ]; then
  echo "ABORT: HTTP $HTTP"; head -c 400 "$TMP"; echo; exit 1
fi

DEST="$DEST" python3 - "$TMP" <<'PY'
import json, os, sys, re
dest = os.environ['DEST']
raw = open(sys.argv[1], encoding='utf-8').read()
try:
    d = json.loads(raw)
except Exception:
    print('ABORT: la respuesta no es JSON. Primeros 300 chars:'); print(raw[:300]); sys.exit(1)
if not d.get('ok'):
    # `unauthorized` acá casi siempre es el secreto vencido o sin sembrar, no un ataque.
    print('ABORT: el backend rechazó el pedido → %s' % d.get('error', '(sin error)')); sys.exit(1)

escritos, vacios, fallidos, truncados = [], [], [], []
for c in d.get('clientes', []):
    cid = str(c.get('id_cliente', '')).strip() or 'SIN-ID'
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,24}', cid):   # el id va al nombre del archivo: se valida
        fallidos.append('%s (id raro)' % cid); continue
    if c.get('error'):
        fallidos.append('%s (%s)' % (cid, c['error'])); continue
    if c.get('sin_charla') or not c.get('md'):
        vacios.append(cid); continue
    p = os.path.join(dest, '%s-charla.md' % cid)
    open(p, 'w', encoding='utf-8').write(c['md'])
    escritos.append('%s → %s (%d turnos%s)' % (cid, p, c.get('turnos_incluidos', 0),
                                               ', TRUNCADO' if c.get('truncado') else ''))
    if c.get('truncado'):
        truncados.append('%s: se omitieron %d turnos viejos' % (cid, c.get('omitidos', 0)))

for e in escritos: print('  ✓ %s' % e)
if vacios:   print('  · sin charla todavía: %s' % ', '.join(vacios))
# Lo truncado y lo fallido se GRITA al final: un export incompleto que parece completo es peor
# que uno que falló, porque Cowork lo volcaría al Hilo creyendo que es toda la conversación.
if truncados:
    print('\n  ⚠ TRUNCADOS (el .md NO tiene la conversación entera):')
    for t in truncados: print('    - %s' % t)
if fallidos:
    print('\n  ⚠ NO se pudieron exportar: %s' % ', '.join(fallidos))
print('\n%d archivo(s) en %s · generado %s' % (len(escritos), dest, d.get('generado_en', '')))
if fallidos: sys.exit(2)
PY
