#!/usr/bin/env bash
# _tareas_f1_code.sh — Tareas-v2 FASE 1 (research Trello): alta rapida + recurrencia + tipo/contexto.
# Guardia + CAPABILITIES + commit + clasp push + git push.
# USO: bash _tareas_f1_code.sh  (dry-run)  |  bash _tareas_f1_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES =="
grep -q "'tipo', 'etiquetas', 'recurrencia', 'orden'" src/01_schema.js || { echo "ABORT: schema Tareas sin columnas F1"; exit 1; }
grep -q "reconciliación ADITIVA" src/07_util.js || { echo "ABORT: ensureSheet sin reconciliacion"; exit 1; }
grep -q "function parseQuickAdd" src/08_webapp.js || { echo "ABORT: falta parseQuickAdd"; exit 1; }
grep -q "function crearTareaQuick" src/08_webapp.js || { echo "ABORT: falta crearTareaQuick"; exit 1; }
grep -q "renace" src/08_webapp.js || { echo "ABORT: falta hook recurrencia en moverTarea"; exit 1; }
grep -q "D8 parseQuickAdd" src/09_selftest.js || { echo "ABORT: faltan asserts D8"; exit 1; }
grep -q 'id="kadd"' src/index.html || { echo "ABORT: falta quick-add en el board"; exit 1; }
grep -q 'id="kfilters"' src/index.html || { echo "ABORT: faltan filtros por tipo"; exit 1; }
grep -q "function tmp_poblarTipos" src/99_tmp_tipos.js || { echo "ABORT: falta one-shot de tipos"; exit 1; }
if command -v node >/dev/null 2>&1; then
  for f in 01_schema 07_util 08_webapp 09_selftest 99_tmp_tipos; do
    node --check "src/$f.js" || { echo "ABORT: sintaxis $f"; exit 1; }
  done
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/cm_f1_script.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/cm_f1_script.js || { echo "ABORT: sintaxis script del index"; exit 1; }
  echo "sintaxis OK (5 js + script del index)"
fi
echo "PRE-CONDICIONES OK"

echo "== GUARDIA: diff repo vs GAS HEAD =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="01_schema.js 07_util.js 08_webapp.js 09_selftest.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar"; exit 1; }
echo "difieren (esperados): $DIFIEREN"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit + clasp push + git push =="
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/01_schema.js src/07_util.js src/08_webapp.js src/09_selftest.js src/index.html src/99_tmp_tipos.js CAPABILITIES.md HANDOFF.md _tareas_f1_code.sh
[ -f docs/NOTION-a-Satori-mapeo.md ] && git add docs/NOTION-a-Satori-mapeo.md
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "Tareas-v2 F1 (research Trello): alta rapida con sigilos (parseQuickAdd) + recurrencia real (parseRecurrencia + clon-al-completar con dedupe) + tipo/contexto con filtros en el board + ensureSheet reconcilia headers aditivo + asserts D8 + one-shot tipos TEMPORAL (borrar tras correr) + doc Notion" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (editor GAS + /dev, 6 min) =="
echo "1. setup()            -> agrega las 4 columnas nuevas a la pestaña Tareas (aditivo, no toca datos)"
echo "2. tmp_poblarTipos()  -> esperar {tocadas: 23} la primera vez, {tocadas: 0} si se re-corre"
echo "3. selfTest()         -> TODO OK incluyendo los D8 nuevos"
echo "4. /dev recarga dura -> abrir el Tablero:"
echo "   - input Nueva tarea arriba: probar   Llamar a @vehemence !a #finanzas 15/08 cada semana"
echo "   - chips de filtro: Clientes / Periodicas / Personal / Admin filtran las tarjetas"
echo "   - tarjetas periodicas muestran chip de recurrencia"
echo "   - arrastrar una periodica a Hecha -> renace pendiente con la proxima fecha"
echo "5. Si todo aprueba, promover /exec cuando quieras (junta v11 + F1 en @20)"
echo "RECORDATORIO: borrar src/99_tmp_tipos.js en el proximo cierre (patron 99_tmp)."
echo "LISTO."
