#!/usr/bin/env bash
# _f11_fix_code.sh — F1.1: scroll del Command Center (Actividad/Calendario eran inalcanzables
# por overflow:hidden) + card Tareas con contextos reales (Hoy/Clientes/Periodicas/En curso).
# USO: bash _f11_fix_code.sh  (dry-run)  |  bash _f11_fix_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES =="
grep -q "overflow-y:auto;overflow-x:hidden" src/index.html || { echo "ABORT: falta el fix de scroll"; exit 1; }
grep -q "tareas_ctx" src/08_webapp.js || { echo "ABORT: falta tareas_ctx en datosHoy"; exit 1; }
grep -q "D8b datosHoy expone tareas_ctx" src/09_selftest.js || { echo "ABORT: falta assert D8b"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node --check src/08_webapp.js || { echo "ABORT: sintaxis webapp"; exit 1; }
  node --check src/09_selftest.js || { echo "ABORT: sintaxis selftest"; exit 1; }
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/cm_f11_script.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/cm_f11_script.js || { echo "ABORT: sintaxis script del index"; exit 1; }
  echo "sintaxis OK"
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
ESPERADOS="08_webapp.js 09_selftest.js index.html"
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
git add src/08_webapp.js src/09_selftest.js src/index.html CAPABILITIES.md HANDOFF.md _f11_fix_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "F1.1: scroll del Command Center (overflow-y auto; Actividad/Calendario eran inalcanzables bajo el viewport) + card Tareas con contextos reales (Hoy=vence-hoy, Clientes, Periodicas, En curso) via tareas_ctx en datosHoy + assert D8b" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (2 min) =="
echo "1. Editor GAS -> selfTest()  -> TODO OK con D8b"
echo "2. /dev recarga dura -> ESCROLEAR HACIA ABAJO con la rueda del mouse:"
echo "   - debajo del orbe aparece ACTIVIDAD DE AGENTES (roster real + feed con filtros)"
echo "   - mas abajo el CALENDARIO semanal -> boton Ver mes -> navegar meses con las flechas"
echo "   - card Tareas ahora muestra: Hoy / Clientes / Periodicas / En curso"
echo "3. Si aprueba -> promover /exec @20 con bash _promote_exec.sh (junta v11 + F1 + F1.1)"
echo "LISTO."
