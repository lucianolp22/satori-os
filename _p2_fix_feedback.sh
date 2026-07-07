#!/usr/bin/env bash
# _p2_fix_feedback.sh — fix del loop visual del feedback (memoria del voto en localStorage).
# Solo cambia src/index.html. Guardia + commit + clasp push + git push, todo en un paso.
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi
grep -q "fbk_brief_" src/index.html || { echo "ABORT: el fix no esta en index.html"; exit 1; }

echo "== GUARDIA: diff repo vs GAS HEAD =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" && { echo "ABORT: GAS tiene archivos que el repo no tiene"; rm -rf _gascheck_tmp; exit 1; }
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ "$DIFIEREN" = "index.html" ] || { echo "ABORT: esperaba que difiera SOLO index.html, difieren: $DIFIEREN"; exit 1; }
echo "GUARDIA OK (solo index.html difiere)"

git add src/index.html _p2_fix_feedback.sh
git commit -m "P2 F1 fix: el feedback del brief recuerda el voto del dia (localStorage) — el re-render del CM lo reseteaba a la pregunta" || { echo "ABORT: commit fallo"; exit 2; }
clasp push -f || { echo "ABORT: clasp push fallo"; exit 3; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push OK"; else echo "AVISO: git push fallo — el fix YA esta en GAS"; fi
echo ""
echo "VERIFICAR: recarga dura del /dev (Cmd-Shift-R) -> tocar Si -> Gracias registrado -> esperar unos segundos: debe QUEDAR fijo en Feedback de hoy registrado."
echo "LISTO."
