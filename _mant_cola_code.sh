#!/usr/bin/env bash
# _mant_cola_code.sh — Mantenimiento 16-jul-2026. ENCARGO-CODE-mantenimiento-cola.
#  1) DIETA Cola_tareas (opción A: archivar). 12_cola.js: archivarColaVieja_ mueve filas TERMINALES
#     (completada/fallida — NO 'hecha'/'error'/'cancelada': esos son de Tareas, el encargo los nombraba
#     mal) con >30d a Cola_archivo, bajo conLock, escribiendo ANTES de borrar, bottom-up y en batch.
#     Decisión de archivo extraída a _colaArchivable_ (PURA) para poder probar cada guarda.
#     2 protecciones OBLIGATORIAS: nunca la última fila de un agente (último-estado) · nunca una fila
#     del MES EN CURSO (protege el conteo de errores). Hook al final de corridaDiaria (tras el warm).
#  2) 08_webapp.js: telemetriaMaestro_ cuenta errores del MES (era all-time pese a su docstring: bug
#     latente + archivar se los habría comido). Decisión de Luciano 16-jul.
#  3) 06_avisos.js: >3 estancadas → 1 aviso resumen (cita las 3 más viejas) en vez de N; ≤3 siguen
#     individuales. Los individuales viejos se resuelven por baseline (resolverAvisosDonde_).
#  4) 08_webapp.js: fila OV 'Negocio paralelo pausado' → 'Oficina Virtual — kill-switch (np_pausado)'.
#     Sin migración: el reemplazo idempotente del sync borra por FUENTE, no por concepto (verificado).
# NO toca: la voz, ni la UI.
# USO: bash _mant_cola_code.sh  (dry-run)  |  bash _mant_cola_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# 1 · dieta de la cola
grep -q "Cola_archivo: \['id', 'worker'" src/01_schema.js            || { echo "ABORT: falta la hoja Cola_archivo en el schema"; exit 1; }
grep -q "function archivarColaVieja_" src/12_cola.js                 || { echo "ABORT: falta archivarColaVieja_"; exit 1; }
grep -q "function _colaArchivable_" src/12_cola.js                   || { echo "ABORT: falta el predicado puro _colaArchivable_"; exit 1; }
grep -q "var COLA_TERMINALES = \['completada', 'fallida'\]" src/12_cola.js || { echo "ABORT: los terminales de la cola NO son completada/fallida"; exit 1; }
grep -q "fc >= inicioMes" src/12_cola.js                             || { echo "ABORT: falta la protección del mes en curso (conteo de errores)"; exit 1; }
grep -q "esUltimaDelAgente" src/12_cola.js                           || { echo "ABORT: falta la protección del último-estado-por-agente"; exit 1; }
grep -q "SpreadsheetApp.flush();" src/12_cola.js                     || { echo "ABORT: falta el flush antes de borrar (destructivo-móvil)"; exit 1; }
grep -q "borrarFilasBatch_(sh, mover" src/12_cola.js                 || { echo "ABORT: el borrado no es batch/bottom-up"; exit 1; }
grep -q "archivarColaVieja_()" src/06_avisos.js                      || { echo "ABORT: falta el hook en corridaDiaria"; exit 1; }
# Guardia dura: el archivo NO puede ser leído por el poll del CM (ese es el punto del encargo).
grep -q "Cola_archivo" src/08_webapp.js                              && { echo "ABORT: 08_webapp lee Cola_archivo — el poll debe seguir leyendo SOLO Cola_tareas"; exit 1; }
# 2 · telemetría del mes
grep -q "String(aFechaISO(f.creada_en) || '').indexOf(mes) === 0" src/08_webapp.js || { echo "ABORT: el conteo de errores no está acotado al mes"; exit 1; }
# 3 · avisos agrupados
grep -q "var ESTANCADAS_MAX" src/06_avisos.js                        || { echo "ABORT: falta el umbral de agrupación"; exit 1; }
grep -q "tareas estancadas > " src/06_avisos.js                      || { echo "ABORT: falta el aviso resumen"; exit 1; }
grep -q "function resolverAvisosDonde_" src/06_avisos.js             || { echo "ABORT: falta la resolución por baseline de los individuales viejos"; exit 1; }
# 4 · rename OV
grep -q "Oficina Virtual — kill-switch (np_pausado)" src/08_webapp.js || { echo "ABORT: la fila OV no se renombró"; exit 1; }
grep -q "concepto: 'Negocio paralelo pausado'" src/08_webapp.js       && { echo "ABORT: el escritor sigue usando el concepto viejo"; exit 1; }
# asserts
grep -q "D15a setup() reconcilió la hoja Cola_archivo" src/09_selftest.js || { echo "ABORT: faltan los asserts D15"; exit 1; }
grep -q "D15f3 fila del MES EN CURSO" src/09_selftest.js             || { echo "ABORT: falta el assert de la protección del mes en curso"; exit 1; }
grep -q "D15j con 5 estancadas" src/09_selftest.js                   || { echo "ABORT: falta el assert de avisos agrupados"; exit 1; }
grep -q "D12b el concepto viejo no sobrevive" src/09_selftest.js     || { echo "ABORT: D12 no verifica el rename"; exit 1; }

if command -v node >/dev/null 2>&1; then
  for f in src/01_schema.js src/06_avisos.js src/08_webapp.js src/09_selftest.js src/12_cola.js; do
    node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }
  done
  echo "sintaxis GAS OK (5 js)"
fi
echo "PRE-CONDICIONES OK"

echo "== GUARDIA: diff repo vs GAS HEAD (solo cambia lo esperado) =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo (auth? invalid_rapt -> clasp logout && clasp login)"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="06_avisos.js 08_webapp.js 09_selftest.js 12_cola.js"
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
  echo "   El archivo de cola NO corre solo al pushear: corre en la proxima corridaDiaria (07:00)"
  echo "   o a mano. ANTES de la primera vez: verifArchivoCola_() en el editor (dry-run, no mueve nada)."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/01_schema.js src/06_avisos.js src/08_webapp.js src/09_selftest.js src/12_cola.js \
        CAPABILITIES.md HANDOFF.md ENCARGO-CODE-mantenimiento-cola-2026-07-16.md _mant_cola_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "mantenimiento: dieta de Cola_tareas (archivar) + avisos estancadas agrupados + rename fila OV

archivarColaVieja_: mueve terminales >30d a Cola_archivo bajo conLock; escribe y flushea ANTES
  de borrar (destructivo-movil), borrado batch bottom-up, idempotente. Decision extraida a
  _colaArchivable_ (PURA) para probar cada guarda sin depender del dia en que corra el test.
  OJO: los terminales de la COLA son completada/fallida; 'hecha'/'error'/'cancelada' son de
  Tareas (el encargo los nombraba mal: con esos nombres no archivaria nada).
  Protecciones: nunca la ultima fila de un agente (ultimo-estado) · nunca el mes en curso.
telemetriaMaestro_: errores acotados al MES. Era all-time pese a que su docstring ya decia 'del mes'
  (bug latente) y archivar se habria comido los viejos. Decision de Luciano 16-jul.
detectarTareasEstancadas: >3 -> 1 aviso resumen con las 3 mas viejas; los individuales viejos se
  resuelven por baseline. Con <=3 siguen individuales.
Fila OV renombrada a 'Oficina Virtual - kill-switch (np_pausado)' (la vieja + valor 'no' se leia
  como si la Oficina estuviera pausada). Sin migracion: el sync reemplaza por FUENTE, no por concepto.
selfTest D15 + D12b. Harness offline 20/20.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> setup()    -> reconcilia la hoja Cola_archivo."
echo "2. Editor GAS -> selfTest() -> TODO OK incluyendo D15 (a..l) y D12/D12b."
echo "3. Editor GAS -> verifArchivoCola_() -> DRY-RUN: dice cuantas archivaria HOY sin mover nada."
echo "   Mirar el numero antes de dejar que corra la diaria (la cola tiene ~857 filas)."
echo "4. Editor GAS -> archivarColaVieja_() a mano la primera vez, y despues comparar:"
echo "   Cola_tareas mas chica + Cola_archivo con las filas + la tira de errores del CM IGUAL."
echo "5. Eyeball /dev (el CM debe poll-ear mas liviano; la tira 'errores' ahora es del MES)."
echo "6. Promote: bash _promote_exec.sh --go (para que /exec tome el cambio)."
echo "LISTO."
