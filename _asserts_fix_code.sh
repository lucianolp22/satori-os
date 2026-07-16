#!/usr/bin/env bash
# _asserts_fix_code.sh — FIX D16h (tipado de Sheets) + auditoría de TODA la batería + selfTestF2_.
#   (16-jul-2026, tercera corrección de asserts del día → se ataca la CLASE, no el síntoma.)
#
#   LA TRILOGÍA: todo assert se verifica contra las TRES realidades:
#     (1) el archivo real   — 08-jul: marcadores literales (grep -qi)
#     (2) los datos vivos   — D15k: selfTest corre sobre PRODUCCIÓN, cero conteos hardcodeados
#     (3) los tipos de Sheets — D16h: round-trip. fecha_objetivo no está en COLUMNAS_TEXTO => Sheets
#         la devuelve como Date, no como el string escrito. Normalizar: aFechaISO / Number / _dirActiva_.
#   Un harness con stubs planos NO prueba la (3): por eso D16h se escapó al editor. sheets_stub.js
#   (scratchpad) replica la coerción y reproduce el bug OFFLINE.
#
#   Auditoría completa (180 asserts): 6 comparaciones normalizadas (1 rota + 5 que pasaban por suerte).
#   selfTestF2_(): runner acotado D14+D15+D16 (segundos) sobre _asertsF2_(), cuerpo COMPARTIDO con
#   selfTest() para que no diverjan. selfTest() completo = certificación final, una vez.
# USO: bash _asserts_fix_code.sh  (dry-run)  |  bash _asserts_fix_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# (3) tipado: ninguna comparación String(...) contra una fecha o un número puede sobrevivir.
grep -q "String(creado.fecha_objetivo)" src/09_selftest.js && { echo "ABORT: D16h sigue comparando una FECHA como string (round-trip de Sheets)"; exit 1; }
grep -q "String(creado.valor_objetivo)" src/09_selftest.js && { echo "ABORT: D16h sigue comparando un NÚMERO como string"; exit 1; }
grep -q "String(ceIdx.nodos)" src/09_selftest.js           && { echo "ABORT: E8a-1 sigue comparando un número como string"; exit 1; }
grep -q "String(recRow.cerrada_en)" src/09_selftest.js     && { echo "ABORT: D6 sigue comparando una fecha como string"; exit 1; }
grep -q "aFechaISO(creado.fecha_objetivo) === '2026-12-31'" src/09_selftest.js || { echo "ABORT: D16h no normaliza la fecha con aFechaISO"; exit 1; }
grep -q "Number(creado.valor_objetivo) === 30" src/09_selftest.js || { echo "ABORT: D16h no normaliza el número con Number"; exit 1; }
# (2) datos vivos: sin conteos hardcodeados (regresión del fix anterior).
grep -q "indexOf('5 tareas estancadas')" src/09_selftest.js && { echo "ABORT: volvió un conteo hardcodeado contra prod"; exit 1; }
# (1) formato: sin asserts del brief viejo (regresión del fix anterior).
if grep -n "Las 3 cosas" src/09_selftest.js | grep -qE "chk\(|/##"; then echo "ABORT: volvió un assert del formato viejo del brief"; exit 1; fi
# Runner acotado + cuerpo compartido (si se duplican, divergen).
grep -q "function selfTestF2_" src/09_selftest.js  || { echo "ABORT: falta el runner acotado selfTestF2_"; exit 1; }
grep -q "function _asertsF2_" src/09_selftest.js    || { echo "ABORT: falta el cuerpo compartido _asertsF2_"; exit 1; }
LLAMADAS="$(grep -c "_asertsF2_(chk, log);" src/09_selftest.js)"
[ "$LLAMADAS" -eq 2 ] || { echo "ABORT: _asertsF2_ debe llamarse desde los DOS runners (encontradas: $LLAMADAS)"; exit 1; }
# El runner acotado NO puede arrastrar el pipeline pesado (ese es su punto).
if sed -n '/^function selfTestF2_/,/^}/p' src/09_selftest.js | grep -qE "correrDirector|correrSalud|briefDiario|syncMaestro"; then
  echo "ABORT: selfTestF2_ arrastra el pipeline pesado — dejaría de costar segundos"; exit 1; fi
# Guardia anti-pérdida: los asserts no pueden haberse evaporado en la extracción.
N="$(grep -c '^\s*chk(' src/09_selftest.js)"
[ "$N" -ge 180 ] || { echo "ABORT: hay menos asserts que antes de la extracción ($N < 180)"; exit 1; }
echo "asserts (llamadas a chk): $N"

if command -v node >/dev/null 2>&1; then
  node --check src/09_selftest.js || { echo "ABORT: sintaxis 09_selftest.js"; exit 1; }
  echo "sintaxis OK"
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
ESPERADOS="09_selftest.js"
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
  echo "   Solo toca asserts + el runner acotado. Codigo de producto: sin cambios."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/09_selftest.js CAPABILITIES.md HANDOFF.md _asserts_fix_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "fix: D16h (tipado de Sheets) + auditoria de los 180 asserts + selfTestF2_ acotado

D16h fallaba: String(creado.fecha_objetivo) === '2026-12-31'. fecha_objetivo NO esta en
COLUMNAS_TEXTO => Sheets la tipa como Date y el round-trip no devuelve el string escrito.

TRILOGIA (tercera correccion de asserts del dia => se ataca la CLASE): todo assert se verifica
contra las TRES realidades: (1) el archivo real (08-jul) · (2) los datos vivos (D15k) · (3) los
tipos que devuelve Sheets (D16h). Un harness con stubs planos no prueba la (3).

Auditoria completa de la bateria (180 asserts, no solo D14-D16). 6 comparaciones normalizadas:
  D16h fecha_objetivo -> aFechaISO()        (ROTA: el bug reportado)
  D16h valor_objetivo -> Number()           (pasaba por suerte: String(30)==='30')
  E8a-1 ceEst.resumen.nodos -> Number()     (por suerte)
  E8a-1 nodos_por_dimension -> Number()     (por suerte)
  E8a-1 ceIdx.nodos -> Number()             (por suerte)
  D6 cerrada_en -> aFechaISO()              (por accidente: String(Date)!=='')
Ya correctos, sin tocar: D12 (Number), D8/D15 (aFechaISO), _dirActiva_ (boolean), ids/textos.

selfTestF2_(): runner acotado D14+D15+D16 con su limpieza, SIN el pipeline pesado (director/salud/
briefs/sync ~7min) => iterar un assert cuesta segundos. Los asserts viven en _asertsF2_(chk,log),
cuerpo COMPARTIDO por los dos runners: duplicarlos garantizaria que diverjan. selfTest() completo
queda como certificacion final, una sola vez. Extraccion verificada: 180 chk antes y despues.

Harness con tipado real (sheets_stub): replica la coercion de Sheets y reproduce D16h OFFLINE (el
assert viejo falla, el nuevo pasa). limpiarHostilTexto_ se extrae del archivo real, no se copia.
6 harness verdes: 131 checks.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION =="
echo "1. Editor GAS -> selfTestF2_()  <-- CORRER ESTE (segundos): D14+D15+D16."
echo "2. Si da TODO OK -> UNA corrida de selfTest() completo (certificacion final, ~7 min)."
echo "3. Despues: sembrarNorthStarSatori_() -> eyeball /dev -> _promote_exec.sh --go -> kickstart -k."
echo "LISTO."
