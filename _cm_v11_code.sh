#!/usr/bin/env bash
# _cm_v11_code.sh — CM v11: calendario semanal+mensual + roster agentes real + fix fecha GMT + tablero integrado.
# Guardia + CAPABILITIES + commit + clasp push + git push.
# USO: bash _cm_v11_code.sh  (dry-run)  |  bash _cm_v11_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (lo que Cowork dejo en el working tree) =="
grep -q "function agendaRango" src/18_direccion.js || { echo "ABORT: falta agendaRango"; exit 1; }
grep -q "hoyAg" src/08_webapp.js || { echo "ABORT: falta actividad-hoy en estadoAgentes"; exit 1; }
grep -q "D7b agendaRango" src/09_selftest.js || { echo "ABORT: faltan asserts D7b"; exit 1; }
grep -q "ccCalSemana" src/index.html || { echo "ABORT: falta calendario en el CM"; exit 1; }
grep -q 'id="calboard"' src/index.html || { echo "ABORT: falta modal mensual"; exit 1; }
grep -q "AG_COLOR" src/index.html || { echo "ABORT: falta roster v11"; exit 1; }
grep -q "ccAgendaFeed" src/index.html && { echo "ABORT: quedo residuo de la card Agenda vieja"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node --check src/18_direccion.js || { echo "ABORT: sintaxis direccion"; exit 1; }
  node --check src/08_webapp.js || { echo "ABORT: sintaxis webapp"; exit 1; }
  node --check src/09_selftest.js || { echo "ABORT: sintaxis selftest"; exit 1; }
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/cm_v11_script.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/cm_v11_script.js || { echo "ABORT: sintaxis script del index"; exit 1; }
  echo "sintaxis OK (3 js + script del index)"
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
ESPERADOS="08_webapp.js 09_selftest.js 18_direccion.js index.html"
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
git add src/18_direccion.js src/08_webapp.js src/09_selftest.js src/index.html CAPABILITIES.md HANDOFF.md _cm_v11_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "CM v11: calendario semanal real + modal mensual con navegacion (agendaRango) + roster agentes con actividad-hoy real (sin datos inventados; entren. espera E8b) + fix fecha GMT en Estado del sistema + tablero con vidrio de card" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (5 min) =="
echo "1. Editor GAS -> selfTest()   -> esperar TODO OK incluyendo D7b agendaRango"
echo "2. Abrir /dev con recarga dura y chequear a ojo:"
echo "   - Estado del sistema: ultima corrida corta dd/mm hh:mm, sin GMT largo"
echo "   - Calendario: grilla lunes a domingo con tus eventos, hoy resaltado"
echo "   - Boton Ver mes: abre el mes, flechas navegan, Hoy vuelve, Esc cierra"
echo "   - Actividad de agentes: roster con estado real y barra Hoy si hubo corridas"
echo "   - Tablero de tareas: se ve el fondo cosmico a traves del vidrio"
echo "3. Si algo se ve mal, pegar screenshot en el chat de Cowork"
echo "NOTA: prod /exec sigue en @19; promover recien cuando el eyeball de /dev apruebe."
echo "LISTO."
