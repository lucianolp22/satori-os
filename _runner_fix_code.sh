#!/usr/bin/env bash
# _runner_fix_code.sh — FIX crash D16k + chk ACUMULATIVO + wrappers públicos (16-jul-2026).
#
#   CRASH: D16k mandaba ~5000 chars, accionVoz_ capea a 4KB -> {ok:false,error:'payload_grande'}
#   (la defensa FUNCIONÓ), el test no lo contemplaba y llamó resolverAprobacion(cli, undefined).
#   LECCIÓN (4ª del día): un test que ejercita una superficie CON DEFENSAS debe esperar que las
#   defensas SALTEN. El retorno de rechazo es un resultado esperado, no un camino imposible.
#
#   chk ACUMULATIVO en selfTestF2_: registra y sigue; al final UN error con la lista completa.
#   Una corrida = TODOS los rojos. Tandas AISLADAS (_asertsD14_/_asertsD15_/_asertsD16_ cada una en
#   su try/catch) para que un undefined encadenado no se lleve las otras dos. selfTest() completo
#   mantiene chk FATAL a propósito: sus fases legacy no están aisladas y acumular ahí daría un
#   TypeError crudo en vez de un rojo limpio. Es certificación.
#
#   WRAPPERS PÚBLICOS: el desplegable del editor no lista las funciones con guión bajo final.
#   selfTestF2() + sembrarNorthStarSatori() + verifArchivoCola() (las 3 que Luciano tiene que correr).
# USO: bash _runner_fix_code.sh  (dry-run)  |  bash _runner_fix_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# (4) el retorno de rechazo es un resultado esperado: cero resolverAprobacion a ciegas.
grep -q "function _aprobarSiOk_" src/09_selftest.js || { echo "ABORT: falta el helper _aprobarSiOk_"; exit 1; }
if grep -nE "^\s*resolverAprobacion\((.*)d16[a-z0-9]*\.id_aprobacion" src/09_selftest.js; then
  echo "ABORT: hay un resolverAprobacion a ciegas sobre un retorno de accionVoz_ (usar _aprobarSiOk_)"; exit 1; fi
grep -q "D16k2 payload > 4KB" src/09_selftest.js || { echo "ABORT: falta el assert del cap (la defensa debe saltar)"; exit 1; }
grep -q "D16k3 el payload rechazado NO escribió nada" src/09_selftest.js || { echo "ABORT: falta el assert de que el rechazo no escribe"; exit 1; }
# D16k debe estar POR DEBAJO del cap o no ejercita el saneo.
grep -q "new Array(1500).join('z')" src/09_selftest.js || { echo "ABORT: D16k no usa un título por debajo del cap"; exit 1; }
if sed -n '/D16k descripcion hostil/,+0p' src/09_selftest.js | grep -q "5000"; then
  echo "ABORT: D16k sigue mandando un título que dispara el cap"; exit 1; fi
# chk acumulativo + tandas aisladas.
grep -q "if (!cond) fallos.push(msg);" src/09_selftest.js || { echo "ABORT: el chk de selfTestF2_ no acumula"; exit 1; }
grep -q "FALLOS (' + fallos.length" src/09_selftest.js || { echo "ABORT: selfTestF2_ no tira la lista completa al final"; exit 1; }
for f in _asertsD14_ _asertsD15_ _asertsD16_; do
  grep -q "function $f(chk, log)" src/09_selftest.js || { echo "ABORT: falta la tanda aislada $f"; exit 1; }
done
grep -q "ABORTÓ: " src/09_selftest.js || { echo "ABORT: las tandas no están aisladas en try/catch"; exit 1; }
# selfTest() completo DEBE seguir siendo fatal (es certificación; decisión explícita).
sed -n '/^function selfTest() {/,/^  try {/p' src/09_selftest.js | grep -q "throw new Error('FALLO: ' + msg)" || {
  echo "ABORT: selfTest() dejó de ser fatal — sus fases legacy no están aisladas"; exit 1; }
# Wrappers públicos: TODA función que Luciano corre a mano tiene que ser visible en el desplegable.
grep -q "^function selfTestF2() {" src/09_selftest.js            || { echo "ABORT: falta el wrapper público selfTestF2"; exit 1; }
grep -q "^function sembrarNorthStarSatori() {" src/18_direccion.js || { echo "ABORT: falta el wrapper público sembrarNorthStarSatori"; exit 1; }
grep -q "^function verifArchivoCola() {" src/12_cola.js            || { echo "ABORT: falta el wrapper público verifArchivoCola"; exit 1; }
# Guardia anti-pérdida en la partición de tandas.
N="$(grep -c '^\s*chk(' src/09_selftest.js)"
[ "$N" -ge 183 ] || { echo "ABORT: se perdieron asserts al partir las tandas ($N < 183)"; exit 1; }
echo "asserts (llamadas a chk): $N"

if command -v node >/dev/null 2>&1; then
  for f in src/09_selftest.js src/12_cola.js src/18_direccion.js; do node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }; done
  echo "sintaxis OK (3 js)"
fi
echo "PRE-CONDICIONES OK"

echo "== GUARDIA: diff repo vs GAS HEAD (solo cambia lo esperado) =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="09_selftest.js 12_cola.js 18_direccion.js"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar (diffs no esperados vs GAS HEAD)"; exit 1; }
echo "difieren (esperados): ${DIFIEREN:-<ninguno>}"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit + clasp push + git push (a /dev/HEAD) =="
  echo "   Codigo de producto: SIN cambios (solo asserts, runner y 3 wrappers publicos)."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/09_selftest.js src/12_cola.js src/18_direccion.js CAPABILITIES.md HANDOFF.md _runner_fix_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "fix: crash D16k (la defensa salto y el test no la contemplaba) + chk acumulativo + wrappers

CRASH: D16k mandaba ~5000 chars; accionVoz_ capea a 4KB -> {ok:false,error:'payload_grande'} (la
defensa FUNCIONO) y el test siguio con id_aprobacion undefined -> resolverAprobacion(cli, undefined).
LECCION (4a del dia): un test que ejercita una superficie CON DEFENSAS debe esperar que las defensas
SALTEN. El retorno de rechazo es un resultado esperado, no un camino imposible.
  D16k: titulo por debajo del cap (~1500) para ejercitar el saneo; el cap se prueba en D16k2/k3
  (>4KB -> payload_grande, sin crash, y sin escribir nada).
  _aprobarSiOk_: nunca resolverAprobacion sin verificar res.ok. Barrida: 3 llamadas ciegas
  (D16g/D16j/D16k) — con chk fatal solo explotaba la ultima; con chk acumulativo, las 3.

chk ACUMULATIVO en selfTestF2_: registra y sigue; al final UN error con la lista completa. Una
corrida = TODOS los rojos, no uno por vuelta de 7 min. Tandas AISLADAS (_asertsD14_/D15_/D16_ cada
una en su try/catch): una que reviente no se lleva las otras dos. Limpieza siempre en el finally.
selfTest() completo mantiene chk FATAL a proposito: sus fases legacy no estan aisladas y acumular
ahi daria un TypeError crudo en vez de un rojo limpio. Es certificacion.

WRAPPERS PUBLICOS: el desplegable del editor no lista las funciones con guion bajo final (leccion
14-jul, sgicConsulta_). Luciano lo detecto en selfTestF2_, pero afectaba a las OTRAS DOS que le pedi
correr hoy: selfTestF2() + sembrarNorthStarSatori() + verifArchivoCola(). Las 3 eran invisibles.

Harness nuevo h_runner 14/14: prueba lo ESTRUCTURAL (aislamiento, acumulacion, chk fatal re-lanza,
_aprobarSiOk_ con rechazo/undefined/ok). h_voz 29/29. 7 harness verdes: 149 checks. 183 chk intactos.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION =="
echo "1. Editor GAS -> selfTestF2()   <-- SIN guion bajo (ahora aparece en el desplegable)."
echo "   Segundos. Si hay rojos, salen TODOS juntos en el error final."
echo "2. Si da TODO OK -> UNA corrida de selfTest() completo (certificacion, ~7 min)."
echo "3. Editor GAS -> sembrarNorthStarSatori()  <-- tambien sin guion bajo."
echo "4. Eyeball /dev -> _promote_exec.sh --go -> kickstart -k -> prueba de voz."
echo "   (verifArchivoCola() tambien quedo publica, por si querés el dry-run del archivo de cola.)"
echo "LISTO."
