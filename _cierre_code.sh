#!/usr/bin/env bash
# _cierre_code.sh — CIERRE-DEV 07-jul: rm 99_tmp_trello + asserts D5/D6/D7 + higiene UI + docs.
# Guardia + git rm + CAPABILITIES regen + commit + clasp push + git push.
# USO: bash _cierre_code.sh  (dry-run)  |  bash _cierre_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (lo que Cowork dejo en el working tree) =="
grep -q "D5 registrarFeedback devuelve id" src/09_selftest.js || { echo "ABORT: faltan asserts D5 en selfTest"; exit 1; }
grep -q "D7 agendaSemana incluye el evento de hoy" src/09_selftest.js || { echo "ABORT: faltan asserts D7 en selfTest"; exit 1; }
grep -q "Cargando actividad" src/index.html || { echo "ABORT: falta placeholder honesto del feed"; exit 1; }
grep -q "mock estático, se cablea" src/index.html && { echo "ABORT: comentario stale sigue en index.html"; exit 1; }
grep -q "origen_id) === '__TEST__'" src/09_selftest.js || { echo "ABORT: falta limpieza Feedback en limpiarTodoTest"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node --check src/09_selftest.js || { echo "ABORT: sintaxis selftest"; exit 1; }
  node --check src/18_direccion.js || { echo "ABORT: sintaxis direccion"; exit 1; }
  echo "sintaxis OK"
fi
echo "PRE-CONDICIONES OK"

echo "== GUARDIA: diff repo vs GAS HEAD =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" | grep -v "99_tmp_trello" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="09_selftest.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar"; exit 1; }
echo "difieren (esperados): $DIFIEREN"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: git rm 99_tmp + CAPABILITIES + commit + clasp push + git push =="
  exit 0
fi

echo "== EJECUTANDO --go =="
if [ -f src/99_tmp_trello.js ]; then
  git rm -q src/99_tmp_trello.js || { echo "ABORT: git rm fallo"; exit 2; }
  echo "git rm 99_tmp_trello.js OK"
else
  echo "(99_tmp_trello.js ya no esta en el repo)"
fi
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
grep -q "99_tmp_trello" CAPABILITIES.md && { echo "ABORT: CAPABILITIES sigue listando el temporal"; exit 2; }
git add src/09_selftest.js src/index.html CAPABILITIES.md HANDOFF.md _cierre_code.sh
[ -f docs/TRELLO-a-Satori-mapeo.md ] && git add docs/TRELLO-a-Satori-mapeo.md
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "Cierre-dev 07-jul: rm importador temporal Trello + asserts selfTest D5-D7 (Feedback/Recomendaciones/Agenda) + feed placeholder honesto + comentario kanban corregido + doc research Trello + HANDOFF" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD sin 99_tmp + asserts nuevos)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (editor GAS, 2 min) =="
echo "1. Abrir el editor de Apps Script del MAESTRO"
echo "2. Ejecutar selfTest()   -> esperar TODO OK con los asserts nuevos D5, D6 y D7"
echo "3. Si algo falla, pegar el log en el chat de Cowork"
echo "NOTA: los cambios quedan en HEAD y /dev. Prod /exec sigue en @19; la proxima promocion los lleva."
echo "LISTO."
