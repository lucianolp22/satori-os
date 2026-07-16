#!/usr/bin/env bash
# _f2_contrato_code.sh — Contrato de Status Report v1 (F2, 16-jul-2026). ENCARGO-CODE-F2-contrato-status-report.
#   01_schema.js      : hojas nuevas Direcciones (auto-aprobación) + Cola_archivo (la usa _mant_cola_code.sh).
#   18_direccion.js   : contratoStatusReport_ (10 secciones, ORDEN fijo) + _tendencia_ (real, nunca estimada)
#                       + _contrapeso_/_recContractual_ (dato + contrapeso de riesgo + acción)
#                       + _cierreAccionMetrica_ (lazo F1-F5) → briefDiario sistema Y cliente re-escritos.
#   11_aprobaciones.js: direccionVigente_ (match EXACTO tipo_accion+tenant, vigencia obligatoria, sin
#                       wildcard, activa=false no matchea, fail-closed) + crearAprobacion la consulta.
#                       AUTO-APROBAR NO AUTO-EJECUTA: la ejecución sigue por ejecutarAprobada().
#   09_selftest.js    : asserts D14 (a..q) + limpieza extendida (DIR-TEST-*, Feedback __TEST__*, Cola_archivo).
# NO toca: la voz, el CM (index.html), ni el widget ¿sirvió? (registrarFeedback ya existía → se reusa).
# USO: bash _f2_contrato_code.sh  (dry-run)  |  bash _f2_contrato_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# Schema
grep -q "Direcciones: \['id', 'tipo_accion'" src/01_schema.js       || { echo "ABORT: falta la hoja Direcciones en el schema"; exit 1; }
grep -q "'Direcciones', 'Config'" src/01_schema.js                  || { echo "ABORT: Direcciones no está en MAESTRO_ORDEN"; exit 1; }
grep -q "Cola_archivo: \['id', 'worker'" src/01_schema.js           || { echo "ABORT: falta la hoja Cola_archivo en el schema"; exit 1; }
# Contrato
grep -q "var CONTRATO_ORDEN" src/18_direccion.js                    || { echo "ABORT: falta CONTRATO_ORDEN"; exit 1; }
grep -q "function contratoStatusReport_" src/18_direccion.js        || { echo "ABORT: falta el renderer contratoStatusReport_"; exit 1; }
grep -q "function _tendencia_" src/18_direccion.js                  || { echo "ABORT: falta _tendencia_"; exit 1; }
grep -q "function _recContractual_" src/18_direccion.js             || { echo "ABORT: falta _recContractual_"; exit 1; }
grep -q "function _cierreAccionMetrica_" src/18_direccion.js        || { echo "ABORT: falta _cierreAccionMetrica_ (lazo F1-F5)"; exit 1; }
grep -q "contrato v1" src/18_direccion.js                           || { echo "ABORT: los briefs no declaran contrato v1"; exit 1; }
# Guardia dura: el ORDEN es el contrato. Si alguien reordena o saca una sección, este script aborta.
grep -q "'bluf', 'apertura', 'metricas', 'autoresuelto', 'espera'," src/18_direccion.js || { echo "ABORT: el ORDEN contractual cambió"; exit 1; }
grep -q "'recomendaciones', 'cierre_accion', 'insumos', 'instrumentacion', 'cierre'" src/18_direccion.js || { echo "ABORT: el ORDEN contractual cambió (cola)"; exit 1; }
# Direcciones (Bastión)
grep -q "function direccionVigente_" src/11_aprobaciones.js         || { echo "ABORT: falta direccionVigente_"; exit 1; }
grep -q "alcance === '\*'" src/11_aprobaciones.js                   || { echo "ABORT: falta el rechazo de wildcard de tenant"; exit 1; }
grep -q "vigencia obligatoria" src/11_aprobaciones.js               || { echo "ABORT: falta la guarda de vigencia obligatoria"; exit 1; }
grep -q "direccionVigente_(idCliente, tipoAccion)" src/11_aprobaciones.js || { echo "ABORT: crearAprobacion no consulta las direcciones"; exit 1; }
grep -q "auto_aprobacion" src/11_aprobaciones.js                    || { echo "ABORT: la auto-aprobación no deja rastro en el feed"; exit 1; }
# Asserts
grep -q "D14a contrato renderiza" src/09_selftest.js                || { echo "ABORT: faltan los asserts D14"; exit 1; }
grep -q "D14i sin dirección vigente" src/09_selftest.js             || { echo "ABORT: falta el assert de default-deny (D14i)"; exit 1; }
grep -q "D14o alcance wildcard" src/09_selftest.js                  || { echo "ABORT: falta el assert de wildcard (D14o)"; exit 1; }
grep -q "DIR-TEST" src/09_selftest.js                               || { echo "ABORT: la limpieza no barre las direcciones de prueba"; exit 1; }

if command -v node >/dev/null 2>&1; then
  for f in src/01_schema.js src/09_selftest.js src/11_aprobaciones.js src/18_direccion.js; do
    node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }
  done
  echo "sintaxis GAS OK (4 js)"
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
ESPERADOS="01_schema.js 09_selftest.js 11_aprobaciones.js 18_direccion.js"
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
  echo "   Direcciones nace VACIA => auto-aprobación INACTIVA hasta que Luciano siembre una fila."
  echo "   El contrato entra a /exec recien con el promote (paso de Luciano)."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/01_schema.js src/09_selftest.js src/11_aprobaciones.js src/18_direccion.js \
        CAPABILITIES.md HANDOFF.md ENCARGO-CODE-F2-contrato-status-report-2026-07-16.md _f2_contrato_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "F2: contrato de status report v1 (10 secciones fijas) + direcciones pre-aprobadas

contratoStatusReport_: orden contractual inmutable; una seccion sin dato emite fallback
  honesto en vez de omitirse. Hablable (markdown liviano) => la voz lo lee por la tool brief.
_tendencia_: tendencia REAL entre 2 puntos de la serie; sin serie lo dice, no estima.
_recContractual_: cada rec = dato ancla + contrapeso de riesgo + accion concreta (extiende T2).
briefDiario sistema+cliente re-escritos sobre el contrato, solo con lecturas baratas del MAESTRO
  (el render frio de este brief es el que colgaba el doPost de voz - SPEC-GAS 14-jul).
Direcciones (P2.8): auto-aprobacion con match EXACTO tipo_accion+tenant, vigencia obligatoria,
  sin wildcard, revocable por activa=false, fail-closed. Default-deny intacto para el resto.
  Auto-aprobar NO auto-ejecuta. Cada auto-aprobacion se loguea y deja rastro en Actividad.
selfTest D14 (a..q) + limpieza extendida. Harness offline 36/36.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> setup()    -> reconcilia las hojas Direcciones y Cola_archivo."
echo "2. Editor GAS -> selfTest() -> TODO OK incluyendo D14 (a..q)."
echo "3. Editor GAS -> briefDiario() -> leer el log: 10 secciones en orden, sin numeros inventados."
echo "   y briefDiario('CLI-002') -> la seccion de metricas trae tendencia REAL de los KPIs."
echo "4. Eyeball /dev del CM (no se toco la UI; el brief cambia de formato)."
echo "5. Promote: bash _promote_exec.sh --go  (recien ahi /exec = la voz lee el contrato)."
echo "OJO: Direcciones nace VACIA. Para activar una auto-aprobacion hay que sembrar una fila"
echo "     (tipo_accion + alcance=CLI-xxx + vigencia futura + activa=si). Sin filas: nada auto-aprueba."
echo "LISTO."
