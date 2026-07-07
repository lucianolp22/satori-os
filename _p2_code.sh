#!/usr/bin/env bash
# _p2_code.sh — P2 F1-F3 (lazo de resultados): guardia + commit + clasp push a GAS HEAD.
# El codigo YA lo escribio Cowork (07-jul, validado offline). Este script lo sube.
# NO promueve /exec: el brief nuevo se ve en /dev; promocion recien tras eyeball de Luciano.
#
# USO:
#   bash _p2_code.sh          -> DRY RUN (guardia + que difiere; no toca nada)
#   bash _p2_code.sh --go     -> commit + clasp push + git push
set -u

REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
if [ -f .git/index.lock ]; then
  if pgrep -x git >/dev/null 2>&1; then echo "ABORT: git corriendo con lock presente"; exit 1; fi
  echo "index.lock huerfano -> lo remuevo"
  rm -f .git/index.lock
fi
for f in src/01_schema.js src/06_avisos.js src/18_direccion.js src/index.html PAQUETE-CODE-P2-lazo-resultados-2026-07-07.md; do
  [ -f "$f" ] || { echo "ABORT: falta $f"; exit 1; }
done
grep -q "registrarFeedback" src/18_direccion.js || { echo "ABORT: 18_direccion sin registrarFeedback (codigo de Cowork ausente)"; exit 1; }
grep -q "briefPush_" src/06_avisos.js || { echo "ABORT: 06_avisos sin briefPush_"; exit 1; }
grep -q "ccFeedbackRow" src/index.html || { echo "ABORT: index.html sin ccFeedbackRow"; exit 1; }
echo "codigo P2 presente: OK"

echo ""
echo "== GUARDIA: diff repo vs GAS HEAD (regla 30-jun) =="
rm -rf _gascheck_tmp
mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo (login? clasp logout && clasp login)"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
if [ -n "$SOLO_GAS" ]; then
  echo "ABORT: GAS tiene archivos que el repo no tiene (push los BORRARIA):"
  echo "$SOLO_GAS"
  rm -rf _gascheck_tmp; exit 1
fi
ESPERADOS="01_schema.js 06_avisos.js 18_direccion.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere un archivo NO esperado: $f"; INESPERADO=1; }
done
rm -rf _gascheck_tmp
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar el diff inesperado antes de pushear (riesgo de pisar GAS)"; exit 1; }
echo "difieren (esperados, es el codigo P2 local): $DIFIEREN"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK — nada tocado. Con --go: =="
  echo "  1. regenerar CAPABILITIES.md (hay funciones nuevas; el hook pre-push lo exige)"
  echo "  2. commit P2 F1-F3 + docs"
  echo "  3. clasp push -f (GAS HEAD -> /dev refleja el brief nuevo; /exec NO cambia)"
  echo "  4. git push"
  echo "  Despues, EN EL EDITOR GAS (Luciano): setup() -> selfTest() -> eyeball /dev"
  exit 0
fi

echo ""
echo "== EJECUTANDO --go =="
echo "-- 1/4 CAPABILITIES"
bash _capabilities_gen.sh || { echo "ABORT: fallo la regeneracion"; exit 2; }

echo "-- 2/4 commit"
git add src/01_schema.js src/06_avisos.js src/18_direccion.js src/index.html CAPABILITIES.md HANDOFF.md PAQUETE-CODE-P2-lazo-resultados-2026-07-07.md docs/CRITERIO-arquitectura-agentes.md _p2_code.sh
if git diff --cached --quiet; then
  echo "nada nuevo para commitear — sigo"
else
  git commit -m "P2 F1-F3: hoja Feedback + registrarFeedback + feedback 1-clic en CM; contrato status report en briefDiario; brief-push opt-in (brief_push_on OFF) en corridaDiaria" || { echo "ABORT: commit fallo"; exit 3; }
  echo "commit OK"
fi

echo "-- 3/4 clasp push"
clasp push -f || { echo "ABORT: clasp push fallo — GAS HEAD sin cambios"; exit 4; }
echo "clasp push OK (/dev ya sirve el codigo nuevo; /exec intacto en @17)"

echo "-- 4/4 git push"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push OK"; else echo "AVISO: git push fallo (auth) — el codigo YA esta en GAS; push manual despues"; fi

echo ""
echo "== VERIFICACION (Luciano, editor GAS + /dev, ~4 min) =="
echo "1. Editor GAS -> ejecutar setup()   (crea la hoja Feedback en el MAESTRO; idempotente)"
echo "2. Editor GAS -> ejecutar selfTest()   (esperar TODO OK)"
echo "3. Editor GAS -> ejecutar briefDiario()   (ver en el log el contrato nuevo: Espera tu decision / Que primero)"
echo "4. Abrir el /dev del CM -> card Brief de hoy -> tocar Si en la fila del feedback -> toast Feedback registrado -> fila nueva en la hoja Feedback"
echo "5. OPCIONAL brief-push: en Config del MAESTRO agregar clave brief_push_on valor true -> editor: probarBriefPush() -> llega email a OWNER_EMAIL"
echo "6. Si todo OK y el eyeball del /dev te cierra: promover /exec cuando decidas (mismo procedimiento @17->@18)"
echo "LISTO."
