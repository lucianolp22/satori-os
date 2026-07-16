#!/usr/bin/env bash
# _voz_pulido_code.sh — Voz pulido post-@27 (16-jul noche). ENCARGO-CODE-voz-pulido.
#  1) ESPEJO (11_aprobaciones.js): agregarAgregada_ — el inverso de quitarAgregada_. crearAprobacion
#     lo llama => la aprobación creada por voz aparece en el CM SIN esperar a syncMaestro (1×/día).
#     Criterio COPIADO de syncMaestro (leído, no asumido): el espejo lleva SOLO estado==='pendiente'
#     => una auto-aprobada por Dirección NO entra. Idempotente: syncMaestro es wipe-then-rebuild.
#     Fail-safe: si el espejo falla, se loguea y sigue (la aprobación del cliente ya está durable).
#     *** El espejo va FUERA del conLock de crearAprobacion: anidar conLock haría que el finally del
#     interno soltara el lock del EXTERNO y rompiera la atomicidad de nextId+append. ***
#  2) N9 (agent.py): tool que falla -> los 3 caminos REALES, jamás un canal inventado ("Cloud Pro").
#  3) N5: VERIFICADA contra el log — Sato llamó a capturar 16:23:43 y recién afirmó a las 16:24:05.
#     Intacta => NO se toca el prompt. (El encargo pedía verificar antes de tocar: se verificó.)
#  4) Rename archivarColaVieja() -> archivarColaViejaREAL(): por orden alfabético la destructiva
#     aparecía ANTES que el dry-run en el desplegable. Browser.msgBox descartado (script standalone).
# USO: bash _voz_pulido_code.sh  (dry-run)  |  bash _voz_pulido_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# 1 · espejo
grep -q "function agregarAgregada_" src/11_aprobaciones.js || { echo "ABORT: falta agregarAgregada_"; exit 1; }
grep -q "agregarAgregada_(cliCtx.cli, filaCreada);" src/11_aprobaciones.js || { echo "ABORT: crearAprobacion no espeja"; exit 1; }
grep -q "!== 'pendiente') return false;  // criterio de syncMaestro" src/11_aprobaciones.js || { echo "ABORT: el espejo no respeta el criterio (solo pendientes)"; exit 1; }
# GUARDIA DURA: el espejo NO puede quedar dentro del conLock de crearAprobacion (soltaría el lock externo).
L_LOCK="$(grep -n "var res = conLock(function () {" src/11_aprobaciones.js | head -1 | cut -d: -f1)"
L_CIERRE="$(grep -n "^  });$" src/11_aprobaciones.js | awk -F: -v l="$L_LOCK" '$1>l {print $1; exit}')"
L_ESP="$(grep -n "agregarAgregada_(cliCtx.cli, filaCreada);" src/11_aprobaciones.js | head -1 | cut -d: -f1)"
if [ -z "$L_LOCK" ] || [ -z "$L_CIERRE" ] || [ -z "$L_ESP" ] || [ "$L_ESP" -le "$L_CIERRE" ]; then
  echo "ABORT: el espejo está DENTRO del conLock de crearAprobacion (lock:${L_LOCK:-?} cierre:${L_CIERRE:-?} espejo:${L_ESP:-?})"; exit 1; fi
# El espejo usa appendFila (respeta COLUMNAS_TEXTO), no appendRow crudo.
sed -n '/^function agregarAgregada_/,/^}/p' src/11_aprobaciones.js | grep -q "appendFila(sh, {" || { echo "ABORT: el espejo no usa appendFila"; exit 1; }
sed -n '/^function agregarAgregada_/,/^}/p' src/11_aprobaciones.js | grep -q "appendRow" && { echo "ABORT: el espejo usa appendRow crudo (coacciona el id)"; exit 1; }
# El espejo NO puede LLAMAR a syncMaestro (colgaría el doPost de voz). Se busca la llamada
# `syncMaestro(`, no la palabra: el cuerpo la menciona en un comentario ("criterio de syncMaestro")
# y prohibir el término en prosa sería una guardia que miente sobre lo que protege.
sed -n '/^function agregarAgregada_/,/^}/p' src/11_aprobaciones.js | grep -qE "syncMaestro\(" && { echo "ABORT: el espejo llama a syncMaestro — colgaría el doPost de voz"; exit 1; }
# 2 · N9
grep -q "REGLA N9" voz/agent/agent.py || { echo "ABORT: falta la regla N9"; exit 1; }
grep -q "no existe" voz/agent/agent.py || { echo "ABORT: N9 no prohíbe inventar destinos"; exit 1; }
# 4 · rename
grep -q "^function archivarColaViejaREAL() {" src/12_cola.js || { echo "ABORT: falta el rename a archivarColaViejaREAL"; exit 1; }
grep -q "^function archivarColaVieja() {" src/12_cola.js && { echo "ABORT: el wrapper gemelo sigue existiendo"; exit 1; }
# asserts
grep -q "D16u la aprobación aparece en Aprobaciones_agregadas SIN correr syncMaestro" src/09_selftest.js || { echo "ABORT: falta el assert del espejo"; exit 1; }
grep -q "D16y una auto-aprobada por Dirección NO entra al espejo" src/09_selftest.js || { echo "ABORT: falta el assert del criterio"; exit 1; }
grep -q "D16z1 espejo sin cliente" src/09_selftest.js || { echo "ABORT: falta el assert del fail-safe"; exit 1; }
# selfTestF2 NO puede volverse lento: el paso con syncMaestro va gateado por opts.completo.
grep -q "if (opts && opts.completo) {" src/09_selftest.js || { echo "ABORT: D16x no está gateado por opts.completo"; exit 1; }
grep -q "_asertsF2_(chk, log, { completo: false });" src/09_selftest.js || { echo "ABORT: selfTestF2_ no pasa completo:false"; exit 1; }
grep -q "_asertsF2_(chk, log, { completo: true });" src/09_selftest.js || { echo "ABORT: selfTest() no pasa completo:true"; exit 1; }
# Igual que arriba: se busca la LLAMADA, no la palabra (el cuerpo las nombra en un comentario).
if sed -n '/^function selfTestF2_/,/^}/p' src/09_selftest.js | grep -qE "(syncMaestro|correrDirector|correrSalud|briefDiario)\("; then
  echo "ABORT: selfTestF2_ arrastra un paso pesado"; exit 1; fi
N="$(grep -c '^\s*chk(' src/09_selftest.js)"
[ "$N" -ge 190 ] || { echo "ABORT: faltan asserts ($N < 190)"; exit 1; }
echo "asserts (llamadas a chk): $N"

if command -v node >/dev/null 2>&1; then
  for f in src/09_selftest.js src/11_aprobaciones.js src/12_cola.js; do node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }; done
  echo "sintaxis GAS OK (3 js)"
fi
if [ -x voz/agent/.venv/bin/python ]; then
  voz/agent/.venv/bin/python -m py_compile voz/agent/agent.py || { echo "ABORT: py_compile agent.py"; exit 1; }
  echo "py_compile agent.py OK"
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
ESPERADOS="09_selftest.js 11_aprobaciones.js 12_cola.js"
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
  echo "   El ESPEJO toca GAS => la voz lo ve recien POST-PROMOTE (@28). N9 es local (kickstart -k)."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/09_selftest.js src/11_aprobaciones.js src/12_cola.js voz/agent/agent.py \
        CAPABILITIES.md HANDOFF.md ENCARGO-CODE-voz-pulido-2026-07-16.md _voz_pulido_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "voz pulido: espejo incremental de aprobaciones + N9 + rename del wrapper destructivo

1) BUG: la aprobacion creada por voz no aparecia en el CM. crearAprobacion escribe en el Sheet del
   CLIENTE; el CM lee Aprobaciones_agregadas del MAESTRO, que solo reconstruia syncMaestro (1x/dia).
   Fix: agregarAgregada_ (inverso de quitarAgregada_) llamado desde crearAprobacion => cubre a TODOS
   los callers. No se llama syncMaestro: 15-30s, colgaria el doPost de voz (SPEC-GAS 14-jul).
   Criterio COPIADO del builder real: el espejo lleva SOLO pendientes => una auto-aprobada por
   Direccion NO entra. Idempotente: syncMaestro es wipe-then-rebuild, no duplica la fila incremental.
   Fail-safe: si el espejo falla, loguea y sigue (la aprobacion del cliente ya esta durable).
   RIESGO no previsto por el encargo: crearAprobacion ya corre en conLock; anidar otro haria que el
   finally del interno soltara el lock del EXTERNO y rompiera la atomicidad de nextId+append =>
   el espejo va FUERA del lock, tras el flush. Usa appendFila (respeta COLUMNAS_TEXTO), no appendRow.

2) N9 (agent.py): tool que falla -> decirlo + los 3 caminos REALES (reintentar / CM / capturar).
   Jamas un canal inventado: en el log de 16:23 recomendo 'Cloud Pro', que no existe.

3) N5: VERIFICADA contra el log y INTACTA -> no se toco el prompt. Sato llamo a capturar 16:23:43
   (sin no-ok) y recien afirmo 'deje registrado el motivo' a las 16:24:05: accion ANTES de afirmar.

4) archivarColaVieja() -> archivarColaViejaREAL(): por orden alfabetico la destructiva aparecia
   ANTES que verifArchivoCola() (el dry-run) en el desplegable. msgBox descartado: script standalone.

Asserts D16u-D16z3. D16x (idempotencia vs syncMaestro) gateado por opts.completo: solo en selfTest()
completo, porque abre todos los Sheets cliente y selfTestF2 tiene que costar segundos.
Harness h_espejo 18/18 con el stub tipado. 8 harness verdes: 167 checks.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> selfTestF2()  (segundos): D14+D15+D16 incluidos D16u-D16z3 del espejo."
echo "2. Si TODO OK -> UNA corrida de selfTest() completo (ahi corre D16x: idempotencia vs syncMaestro)."
echo "3. PROMOTE: bash _promote_exec.sh --go  -> @28. El espejo toca GAS: la voz lo ve recien ahi."
echo "4. POST-PROMOTE: launchctl kickstart -k gui/\$(id -u)/com.satori.voz.agent   (N9 es local)."
echo "   y calentarBriefCache() si consultaste el brief por voz en los ultimos 10 min."
echo "5. PRUEBA DE CIERRE: 'registra X para Vehemence' -> confirmar -> LA APROBACION APARECE EN EL CM"
echo "   sin tocar nada -> clic -> objetivo en CLI-002 con metrica vacia."
echo "LISTO."
