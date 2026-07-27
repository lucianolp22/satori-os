#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# _cierre_integral_2026-07-27.sh — Cierre integral Satori OS (27-jul-2026)
#
# QUÉ HACE (5 pasos, aborta ante cualquier fallo):
#   1. Verifica la sintaxis de TODOS los módulos (node --check).
#   2. Corre el harness offline (_harness.js) — tiene que dar FALLA 0.
#   3. GUARDIA DE DRIFT repo↔GAS: baja el HEAD de GAS a un tmp y compara archivo
#      por archivo. Si difiere algo FUERA de lo tocado hoy → ABORTA (significaría
#      que alguien editó en el editor GAS y un push lo pisaría).
#   4. Git: saca el lock huérfano, commitea el cierre y pushea a GitHub.
#   5. clasp push a /dev (los triggers corren HEAD; /exec NO se toca).
#
# CÓMO CORRERLO (desde la Terminal del Mac):
#   cd "/Users/lucianopablolp/Documents/Claude/Projects/SatoriOS"
#   bash _cierre_integral_2026-07-27.sh
#
# DESPUÉS DE ESTO viene el editor GAS (selfTest + espejarHilosDelDia) — el guion
# está en HANDOFF.md, sección "PRÓXIMO PASO".
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

echo "══ 1/5 · Sintaxis de todos los módulos ══"
for f in src/*.js; do node --check "$f"; done
echo "OK: todos los .js compilan"

echo "══ 2/5 · Harness offline ══"
node _harness.js | tail -1

echo "══ 3/5 · Guardia de drift repo↔GAS ══"
TMP="$(mktemp -d)"
cp .clasp.json "$TMP/"
mkdir -p "$TMP/src"
( cd "$TMP" && clasp pull ) >/dev/null 2>&1 || { echo "ABORT: clasp pull falló (¿re-login? clasp logout && clasp login)"; rm -rf "$TMP"; exit 1; }
ESPERADOS=" 06_avisos.js 08_webapp.js 09_selftest.js 16_salud.js 17_bandeja.js 18_direccion.js 19_conectores.js 22_seguridad.js index.html 99_tmp_hilos.js "
DRIFT=0
for f in src/*; do
  b="$(basename "$f")"
  g="$TMP/src/$b"
  if [ ! -f "$g" ]; then
    case "$ESPERADOS" in *" $b "*) : ;; *) echo "ABORT: $b está en el repo y no en GAS, y no es del cierre de hoy"; DRIFT=1 ;; esac
    continue
  fi
  if ! cmp -s "$f" "$g"; then
    case "$ESPERADOS" in *" $b "*) : ;; *) echo "ABORT: $b difiere de GAS y NO estaba en el plan de hoy (¿edición en el editor?)"; DRIFT=1 ;; esac
  fi
done
for g in "$TMP/src"/*; do
  b="$(basename "$g")"
  if [ ! -f "src/$b" ]; then echo "ABORT: $b existe en GAS y no en el repo (edición de editor sin bajar)"; DRIFT=1; fi
done
rm -rf "$TMP"
if [ "$DRIFT" -ne 0 ]; then
  echo "── Push CANCELADO. Avisale a Cowork qué archivo saltó la guardia. ──"
  exit 1
fi
echo "OK: solo difiere lo tocado hoy"

echo "══ 4/5 · Git (lock + commit + push a GitHub) ══"
rm -f .git/index.lock
git add src _hilo_sync.sh _harness.js .claspignore CLAUDE.md HANDOFF.md voz/agent/agent.py
git commit -m "cierre 27-jul: P0 full-refresh + conector_error visible + estado cacheado voz + parser Hilos v2 + preparar_reunion + calendario funcional + salud visible + harness versionado + tanda D28"
git push origin main
git --no-optional-locks status -sb | head -1

echo "══ 5/5 · clasp push a /dev ══"
clasp push
echo ""
echo "════════════════════════════════════════════════════════════"
echo " LISTO EL PUSH. Ahora abrí el editor de Apps Script y corré:"
echo "   1) selfTest()            (certificación completa, con la tanda D28 nueva)"
echo "   2) espejarHilosDelDia()  (sube los 3 Hilos al sistema)"
echo "   3) correrSalud()         (resuelve el aviso fantasma AVI-0031 en el acto)"
echo " El resto del guion está en HANDOFF.md → PRÓXIMO PASO."
echo "════════════════════════════════════════════════════════════"
