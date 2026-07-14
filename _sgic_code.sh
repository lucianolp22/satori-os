#!/usr/bin/env bash
# _sgic_code.sh — Sato accede a TODO el SGIC de un cliente (14-jul-2026). ENCARGO-CODE-sgic-voz.
#   Capa 1 (18_direccion.js): estadoVigenteCliente_ incluye la columna `notas` de Datos_operativos
#     en "Operación reciente" (ahí viven las órdenes/AOV mensuales del conector) — saneada+truncada.
#   Capa 2 (08_webapp.js): tool `sgic` read-only. Whitelist DURA de hojas + caso 'ventas' (fuente viva
#     del conector, mapa HARDCODEADO CLI-002→VEHEMENCE_DB_ID) → ordenes/total/AOV/por_canal EXACTOS.
#     Bastión: cero escrituras, solo el sheet del roster, todo string por limpiarHostilTexto_, cap ~8KB.
#   19_conectores.js: agregarVentasPorMes_ expone canal/ordenes/aov numéricos (aditivo, no cambia schema).
#   agent.py (LOCAL, no GAS): function_tool sgic_consulta + regla de prompt (usar antes de decir "no tengo").
#   09_selftest.js: asserts D13 (whitelist/lee/mes/limite/ventas-exactas/saneo) + bonus (resuelve el aviso
#     voz de prueba por baseline; limpiarTodoTest ya barre tarea_vencida/aprobacion_expirada por marcador).
# USO: bash _sgic_code.sh  (dry-run)  |  bash _sgic_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
grep -q "sgic: 1" src/08_webapp.js                       || { echo "ABORT: sgic no está en VOZ_TOOLS"; exit 1; }
grep -q "function sgicConsulta_" src/08_webapp.js        || { echo "ABORT: falta sgicConsulta_"; exit 1; }
grep -q "var SGIC_HOJAS" src/08_webapp.js                || { echo "ABORT: falta la whitelist SGIC_HOJAS"; exit 1; }
grep -q "function sgicVentas_" src/08_webapp.js          || { echo "ABORT: falta sgicVentas_ (conector hardcodeado)"; exit 1; }
grep -q "hoja_no_permitida" src/08_webapp.js             || { echo "ABORT: falta el rechazo hoja_no_permitida"; exit 1; }
grep -q "limpiarHostilTexto_(o.notas" src/18_direccion.js || { echo "ABORT: Capa 1 (notas en Operación reciente) no aplicada"; exit 1; }
grep -q "ordenes: a.n" src/19_conectores.js              || { echo "ABORT: agregarVentasPorMes_ no expone ordenes numérico"; exit 1; }
grep -q "D13a hoja fuera de whitelist" src/09_selftest.js || { echo "ABORT: faltan asserts D13"; exit 1; }
grep -q "D13e ventas" src/09_selftest.js                 || { echo "ABORT: falta el assert D13e (ventas exactas)"; exit 1; }
grep -q "_vozAviPre" src/09_selftest.js                  || { echo "ABORT: falta el bonus (baseline avisos voz)"; exit 1; }
grep -q "async def sgic_consulta" voz/agent/agent.py     || { echo "ABORT: agent.py no tiene sgic_consulta"; exit 1; }
if command -v node >/dev/null 2>&1; then
  for f in src/08_webapp.js src/09_selftest.js src/18_direccion.js src/19_conectores.js; do
    node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }
  done
  echo "sintaxis GAS OK (4 js)"
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
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo (auth? invalid_rapt -> clasp logout && clasp login)"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="08_webapp.js 09_selftest.js 18_direccion.js 19_conectores.js"
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
  echo "   agent.py es LOCAL (no clasp). sgic funciona end-to-end recién tras el promote a /exec."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/08_webapp.js src/09_selftest.js src/18_direccion.js src/19_conectores.js voz/agent/agent.py \
        CAPABILITIES.md HANDOFF.md ENCARGO-CODE-sgic-voz-2026-07-14.md _sgic_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "sgic: Sato accede a todo el SGIC del cliente (tool sgic read-only + notas en snapshot)

Capa 1: estadoVigenteCliente_ incluye notas de Datos_operativos (órdenes/AOV del conector).
Capa 2: tool sgic (whitelist dura de hojas + caso 'ventas' de la fuente viva, mapa hardcodeado)
  -> ordenes/total/AOV/por_canal EXACTOS. Bastión: read-only, roster-only, saneado, cap 8KB.
agregarVentasPorMes_ expone canal/ordenes/aov numéricos (aditivo). agent.py: sgic_consulta + prompt.
selfTest D13 (whitelist/lee/mes/limite/ventas/saneo) + bonus (resuelve el aviso voz de prueba).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> selfTest() -> TODO OK incluyendo D13 (a..f)."
echo "2. Editor GAS -> sgicConsulta_('CLI-002','ventas','2026-07',20) -> ordenes/total/aov reales de la DB viva."
echo "3. Eyeball /dev del CM (nada rompe; el snapshot de cliente ahora muestra las notas del conector)."
echo "4. Promote: bash _promote_exec.sh --go  (recien ahi /exec = voz tiene la tool sgic)."
echo "5. POST-PROMOTE: reiniciar el agente -> launchctl kickstart -k gui/UID/com.satori.voz.agent"
echo "   (o: bash voz/launchagents/... ) y prueba de voz REAL: 'cuantas ordenes tuvo Vehemence en julio'."
echo "LISTO."
