#!/usr/bin/env bash
# _identidad_gen.sh — genera src/35_identidad.js desde docs/SATO-IDENTIDAD.md.
#
# POR QUÉ: `clasp push` sube sólo `src/`, así que GAS nunca ve el `.md`. La identidad tiene que
# viajar como código. La FUENTE ÚNICA sigue siendo el `.md` (versionado, editable, revisable en
# diff); esto es un derivado — NO editar `35_identidad.js` a mano, se pisa.
#
# El bloque `> …` de cabecera del `.md` es meta para humanos y NO se manda al modelo: se recorta.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
md = open('docs/SATO-IDENTIDAD.md', encoding='utf8').read()
# recortar la cabecera meta (todo lo anterior al primer "---" de separación)
i = md.index('\n---\n')
cuerpo = md[i + 5:].strip()
# y la firma final
j = cuerpo.rfind('\n---\n')
if j > 0:
    cuerpo = cuerpo[:j].strip()
js = cuerpo.replace('\\', '\\\\').replace("'", "\\'").replace('\n', "\\n' +\n  '")
out = f"""/**
 * 35_identidad.js — GENERADO. No editar a mano.
 *
 * Fuente única: `docs/SATO-IDENTIDAD.md`. Regenerar con `bash scripts/_identidad_gen.sh`.
 * Existe porque `clasp push` sube sólo `src/`: GAS nunca ve el `.md`, así que la identidad
 * tiene que viajar como código. En runtime, `_cargarIdentidadSato_()` prefiere la pestaña
 * `_sato_identidad` del MAESTRO (editable en caliente) y cae acá si está vacía.
 *
 * El assert D-ID del arnés compara este archivo contra el `.md` y corta si divergen.
 */
var SATO_IDENTIDAD_MD =
  '{js}';
"""
open('src/35_identidad.js', 'w', encoding='utf8').write(out)
print(f"src/35_identidad.js generado — {len(cuerpo)} chars de identidad")
PY
node --check src/35_identidad.js && echo "node --check OK"
