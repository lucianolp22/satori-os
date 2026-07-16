#!/usr/bin/env bash
# _d15_fix_code.sh — FIX D15k mal calibrado + BUG de resúmenes apilados (16-jul-2026).
#   Reportado por Luciano: selfTest falló en D15k. El CÓDIGO estaba bien (prod tiene 18 estancadas
#   reales + 5 de test = 23, y el resumen dijo 23). El ASSERT hardcodeaba "5" → asumía entorno limpio.
#   selfTest corre sobre DATOS VIVOS: todo esperado se computa de los mismos datos, con el mismo
#   criterio que la función. D15j/k/l/m pasan a esperado-computado.
#   *** Y un BUG REAL encontrado al revisar con esa lente ***
#   detectarTareasEstancadas resolvía solo los individuales viejos, NUNCA los resúmenes anteriores.
#   crearAviso dedupea por mensaje EXACTO y el mensaje lleva el conteo => cada día que cambiara el
#   número nacía un resumen nuevo y el viejo quedaba activo (1 aviso/día apilado = el ruido que el
#   cambio venía a matar). Misma trampa que la purga del 08-jul con las recomendaciones.
#   Fix: resolver TODO tarea_estancada activo con mensaje !== msg ANTES de crear => 1 solo activo,
#   sin churn (si el conteo no cambió, crearAviso reusa).
# USO: bash _d15_fix_code.sh  (dry-run)  |  bash _d15_fix_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# El fix del bug: resolver ANTES de crear, y por !== msg (no solo el prefijo del formato viejo).
grep -q "String(f.mensaje) !== msg" src/06_avisos.js || { echo "ABORT: no se resuelven los resúmenes anteriores (se apilarían 1/día)"; exit 1; }
# Orden msg -> resolver -> crear. Si se resolviera DESPUÉS de crear, el resumen nuevo se
# auto-resolvería y no quedaría ninguno activo. Ojo: matchear la LLAMADA (indentada), no la
# definición `function resolverAvisosDonde_`, que vive más abajo y da un orden falso.
L_MSG="$(grep -n "var msg = estancadas.length" src/06_avisos.js | head -1 | cut -d: -f1)"
L_RES="$(grep -n "^  resolverAvisosDonde_(function" src/06_avisos.js | head -1 | cut -d: -f1)"
L_CRE="$(grep -n "crearAviso({ id_cliente: '', tipo: 'tarea_estancada', mensaje: msg })" src/06_avisos.js | head -1 | cut -d: -f1)"
if [ -z "$L_MSG" ] || [ -z "$L_RES" ] || [ -z "$L_CRE" ] || [ "$L_MSG" -ge "$L_RES" ] || [ "$L_RES" -ge "$L_CRE" ]; then
  echo "ABORT: el orden msg->resolver->crear no se cumple (msg:${L_MSG:-?} resolver:${L_RES:-?} crear:${L_CRE:-?})"; exit 1; fi
# Asserts: cero conteos hardcodeados contra prod.
grep -q "indexOf('5 tareas estancadas')" src/09_selftest.js && { echo "ABORT: D15k sigue hardcodeando un conteo contra datos de prod"; exit 1; }
grep -q "_espN" src/09_selftest.js                     || { echo "ABORT: D15k no computa el esperado de los datos vivos"; exit 1; }
grep -q "match(/^(\\\\d+) tareas estancadas/)" src/09_selftest.js || { echo "ABORT: D15k no captura el conteo del mensaje"; exit 1; }
grep -q "_esp3" src/09_selftest.js                     || { echo "ABORT: D15l no computa las 3 más viejas de los datos vivos"; exit 1; }
grep -q "D15m al cambiar el conteo" src/09_selftest.js || { echo "ABORT: falta el assert anti-apilado (D15m)"; exit 1; }
# El predicado del test debe ser el mismo que el de la función (activa + no terminal + fc < limite).
grep -q "var _esEstancada = function (t)" src/09_selftest.js || { echo "ABORT: el test no replica el criterio de la función"; exit 1; }

if command -v node >/dev/null 2>&1; then
  for f in src/06_avisos.js src/09_selftest.js; do node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }; done
  echo "sintaxis OK (2 js)"
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
ESPERADOS="06_avisos.js 09_selftest.js"
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
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/06_avisos.js src/09_selftest.js CAPABILITIES.md HANDOFF.md _d15_fix_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "fix: D15 esperado-computado (selfTest corre sobre prod) + bug de resumenes apilados

D15k fallaba exigiendo '5 tareas estancadas': prod tiene 18 reales, la funcion conto 23 y dijo 23.
El codigo estaba BIEN; el assert asumia entorno limpio. D15j/k/l/m pasan a esperado-computado:
el conteo y las 3 mas viejas se calculan de los datos VIVOS con el MISMO predicado que la funcion.
D15j pasa a verificar el invariante real: exactamente 1 aviso tarea_estancada ACTIVO (no '1 nuevo':
si el conteo no cambio, crearAviso reusa el existente).

BUG REAL (encontrado al revisar con esa lente): detectarTareasEstancadas resolvia solo los
individuales del formato viejo, nunca los RESUMENES anteriores. crearAviso dedupea por mensaje
exacto y el mensaje lleva el conteo => cada dia que cambiara el numero nacia un resumen nuevo y el
viejo quedaba activo: 1 aviso/dia apilado, el ruido que el cambio venia a matar. Misma trampa que
la purga del 08-jul (dedupear por texto exacto un texto que muta).
Fix: resolver todo tarea_estancada activo con mensaje !== msg ANTES de crear => 1 solo activo, sin
churn. Assert D15m cubre el caso.

Harness offline 18/18, y corrido contra el codigo PRE-FIX: 4 tests fallan (caza el bug de verdad).

LECCION (HANDOFF): selfTest corre sobre DATOS VIVOS. Todo esperado se computa de los mismos datos
con el mismo criterio; jamas se hardcodea un conteo. Una constante contra prod no prueba el codigo:
prueba el estado de la hoja el dia que la escribiste.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION =="
echo "1. Editor GAS -> selfTest() -> re-correr. D15 (a..m) debe pasar contra los datos vivos."
echo "2. OJO CM: ahora mismo NO hay avisos tarea_estancada activos. NO es perdida de datos:"
echo "   la corrida que fallo ya resolvio por baseline los 18 individuales (quedaron 'resuelto',"
echo "   no borrados) y la limpieza borro el resumen de test. Es el comportamiento disenado."
echo "   Para verlo ya: correr detectarTareasEstancadas() en el editor -> 1 aviso '18 tareas"
echo "   estancadas > 7d (las 3 mas viejas: ...)'. Si no, lo recrea la corridaDiaria de las 07:00."
echo "3. Seguir: sembrarNorthStarSatori_() -> eyeball /dev -> _promote_exec.sh --go."
echo "LISTO."
