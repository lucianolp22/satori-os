#!/usr/bin/env bash
# _scan_endpoints.sh — partición de la superficie RPC, corrible sola (sin el arnés completo).
#
# QUÉ HACE: enumera toda `function` top-level SIN `_` final de `src/*.js` —o sea, todo lo que
# `google.script.run` puede invocar— y le resta (a) lo que lleva `_soloOwner_`, (b) lo declarado en
# `ENDPOINTS_UI` (22_seguridad.js) y (c) lo declarado EXENTO con motivo en `_harness.js` (D31).
# Si queda algo, es una función pública que nadie gateó ni declaró: sale 1.
#
# ⚠ ESTO NO ES NUEVO: `_harness.js` D31 ya hace exactamente esta partición desde antes, y es la
#   autoridad. Este script existe sólo para correr el chequeo aislado y rápido. Si los dos
#   discrepan, manda el arnés.
# ⚠ Y NO: las primitivas que reciben o devuelven un Sheet/Spreadsheet (`appendFila`, `leerTabla`,
#   `ensureSheet`, `conLock`, `getMaestro`, `abrirCliente`) NO son un hueco. `google.script.run` no
#   puede serializar esos tipos ni como argumento ni como retorno. Están exentas con ese motivo.
#   (27-ago: se reportaron como P0 y era falso. No volver a marcarlas.)
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - "$@" <<'PY'
import re, glob, sys
src = {f: open(f, errors='replace').read() for f in sorted(glob.glob('src/*.js'))}

ui = set()
for s in src.values():
    m = re.search(r'ENDPOINTS_UI\s*=\s*\[(.*?)\n\];', s, re.S)
    if m:
        ui |= set(re.findall(r"'([A-Za-z0-9_]+)'", m.group(1)))

h = open('_harness.js', errors='replace').read()
i = h.index('const EXENTAS = {'); d = 0
for k in range(i, len(h)):
    if h[k] == '{': d += 1
    elif h[k] == '}':
        d -= 1
        if d == 0:
            fin = k; break
exentas = set(re.findall(r'(\w+):\s*[\'"]', h[i:fin]))

tops = {}
for f, s in src.items():
    for m in re.finditer(r'^function ([A-Za-z][A-Za-z0-9_]*)\s*\(', s, re.M):
        if not m.group(1).endswith('_'):
            tops[m.group(1)] = (f, m.start())

sin_gate = {n for n, (f, p) in tops.items() if '_soloOwner_' not in src[f][p:p + 1400]}
huerfanas = sorted(sin_gate - ui - exentas)

print(f"top-level invocables : {len(tops)}")
print(f"ENDPOINTS_UI         : {len(ui)}")
print(f"EXENTAS declaradas   : {len(exentas)}")
print(f"sin gate             : {len(sin_gate)}")
if huerfanas:
    print(f"\n✗ {len(huerfanas)} función(es) pública(s) sin gate, sin alta y sin exención:")
    for n in huerfanas:
        print(f"   {n:34s} {tops[n][0]}")
    print("\nArreglo: `_soloOwner_` + alta en ENDPOINTS_UI, o exención con MOTIVO en _harness.js D31.")
    sys.exit(1)
print("\n✓ limpio: toda función pública está gateada, declarada o exenta con motivo")
PY
