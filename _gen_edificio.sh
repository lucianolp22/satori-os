#!/usr/bin/env bash
# Regenera src/edificio.html desde AKASHA-EDIFICIO-v4.html.
#
# POR QUÉ EXISTE: el módulo son ~320KB generados, no escritos. Editarlo a mano lo vuelve
# inauditable y hace que el próximo cambio de la maqueta haya que rehacerlo a ojo. Mismo criterio
# que `_akasha_e3/` con el port de E3: el injerto se hace con script, y por eso se puede repetir.
#
# QUÉ HACE, EN DOS PASOS:
#   1. extraer.py   — corta de v4 lo reusable (datos, POST, texturas, constructores, DOM), scopea
#                     su CSS bajo #ediRoot y prefija sus 72 clases con `e-` (24 ya existían en
#                     index.html: .panel .card .scrim .toast .dir .logo .st …).
#   2. ensamblar.py — pega esas partes dentro del envoltorio que se engancha a __AK_EXT.
#
# DESPUÉS DE CORRER: siempre `node _akasha_e3/harness.js` — corre el módulo contra THREE real y el
# motor real, y es lo único que distingue "se generó" de "funciona".
set -euo pipefail
cd "$(dirname "$0")"

[ -f AKASHA-EDIFICIO-v4.html ] || { echo "✗ falta AKASHA-EDIFICIO-v4.html (la maqueta fuente)"; exit 1; }

python3 _edificio/extraer.py
python3 _edificio/ensamblar.py
python3 _verificar_index.py

echo "→ verificando el módulo contra el motor real…"
node _akasha_e3/harness.js | tail -4
