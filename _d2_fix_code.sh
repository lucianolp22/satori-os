#!/usr/bin/env bash
# _d2_fix_code.sh — FIX assert STALE D2 (16-jul-2026). Reportado por Luciano tras correr selfTest.
#   El brief NO estaba roto: renderizó bien el contrato v1. El ASSERT verificaba el formato viejo
#   ("Las 3 cosas de hoy") que F2 reemplazó. Causa: al reescribir la salida no se grepeó quién la
#   verificaba. D2 ahora verifica EL CONTRATO por LÍNEA EXACTA (BLUF en negrita + ## Hoy + firma
#   · contrato v1 + las 10 secciones EN ORDEN) y cubre los DOS briefs (sistema Y cliente).
#   Barrido de una pasada: D2 era el único stale (los ## Números/## North Star de D1/D3 son de
#   estadoVigente(), otra función que F2 no tocó).
# USO: bash _d2_fix_code.sh  (dry-run)  |  bash _d2_fix_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# Barrido: ningún encabezado del formato VIEJO puede quedar VERIFICÁNDOSE. Se mira solo lo que
# ejecuta (líneas con chk( o con un regex /##...), no los comentarios — el comentario de D2 explica
# a propósito cuál era el formato viejo, y prohibir la palabra en prosa sería una guardia que miente.
for pat in "Las 3 cosas" "Qué primero" "Se auto-resolvió (agentes" "Señal de KPIs" "## Números"; do
  if grep -n "$pat" src/09_selftest.js | grep -qE "chk\(|/##"; then
    echo "ABORT: assert stale del formato viejo del brief: $pat"; exit 1; fi
done
# D2 verifica el CONTRATO, por línea exacta.
grep -q "D2c el contrato emite la apertura humana" src/09_selftest.js || { echo "ABORT: D2 no verifica ## Hoy"; exit 1; }
grep -q "D2d el brief de sistema declara el contrato v1" src/09_selftest.js || { echo "ABORT: D2 no verifica la firma del contrato"; exit 1; }
grep -q "D2e el brief de SISTEMA trae las 10 secciones" src/09_selftest.js || { echo "ABORT: D2 no verifica las 10 secciones"; exit 1; }
grep -q "D2j el brief de CLIENTE también trae las 10 secciones" src/09_selftest.js || { echo "ABORT: D2 no cubre el brief de CLIENTE"; exit 1; }
# Línea exacta, no substring (la lección del '## Cierre').
grep -q "md.indexOf('\\\\n## ' + CONTRATO_TITULOS\[k\] + '\\\\n')" src/09_selftest.js || { echo "ABORT: D2 no compara por línea exacta"; exit 1; }
if grep -q "brSys.indexOf('## Hoy')" src/09_selftest.js; then
  echo "ABORT: D2 compara por substring (debe ser '\\n## Hoy\\n')"; exit 1; fi

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
  echo "   Solo toca asserts. El brief NO se toca (ya estaba bien)."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/09_selftest.js CAPABILITIES.md HANDOFF.md _d2_fix_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "fix: assert D2 stale (verificaba el formato de brief que F2 reemplazo)

selfTest fallaba en D2 pero el brief estaba BIEN: renderizo el contrato v1 entero. El assert
verificaba el formato viejo ('Las 3 cosas de hoy'). Causa: al reescribir briefDiario en F2 no se
grepeo quien verificaba esa salida.

D2 ahora verifica EL CONTRATO: BLUF en negrita + '## Hoy' + firma '· contrato v1' + las 10
secciones EN ORDEN, por LINEA EXACTA (substring no: '## Cierre' matchea antes la seccion 7).
Cubre los DOS briefs: el de cliente tambien cambio.
Barrido de una pasada del repo: D2 era el UNICO stale (los ## Numeros/## North Star de D1/D3
apuntan a estadoVigente(), que F2 no toco).
Harness offline 16/16, con control negativo (brief incompleto -> D2e falla).

LECCION (HANDOFF): al reescribir el FORMATO de una salida, grep de TODOS los asserts que la
verifican, no solo los que tocaste. Un assert stale se ve igual que un bug de producto.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION =="
echo "1. Editor GAS -> selfTest() -> re-correr. D2 (a..k) debe pasar contra el contrato."
echo "   Si vuelve a fallar D2: mirá el brief en el log ANTES de tocar el brief — puede ser el assert."
echo "2. Seguir con lo pendiente: sembrarNorthStarSatori_() -> eyeball /dev -> _promote_exec.sh --go."
echo "LISTO."
