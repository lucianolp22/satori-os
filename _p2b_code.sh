#!/usr/bin/env bash
# _p2b_code.sh — P2 F4+F5 (lazo completo + cola en lote): guardia + commit + clasp push.
# Codigo escrito y validado offline por Cowork (07-jul PM). NO promueve /exec.
#
# USO:
#   bash _p2b_code.sh          -> DRY RUN
#   bash _p2b_code.sh --go     -> commit + clasp push + git push
set -u

REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock presente"; exit 1; }
  echo "index.lock huerfano -> lo remuevo"
  rm -f .git/index.lock
fi
grep -q "Recomendaciones" src/01_schema.js || { echo "ABORT: schema sin Recomendaciones"; exit 1; }
grep -q "registrarRecomendacionDelDia" src/18_direccion.js || { echo "ABORT: falta F4 backend"; exit 1; }
grep -q "Aprobar lote" src/index.html || { echo "ABORT: falta F5 en el CM"; exit 1; }
echo "codigo F4+F5 presente: OK"

echo ""
echo "== GUARDIA: diff repo vs GAS HEAD (regla 30-jun) =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo (login?)"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
if [ -n "$SOLO_GAS" ]; then echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; fi
ESPERADOS="01_schema.js 06_avisos.js 18_direccion.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere un archivo NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar antes de pushear"; exit 1; }
echo "difieren (esperados): $DIFIEREN"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit F4-F5 + clasp push + git push =="
  echo "Despues (Luciano, editor GAS): setup() -> selfTest() -> eyeball /dev -> promocion @18 con _promote_exec.sh"
  exit 0
fi

echo ""
echo "== EJECUTANDO --go =="
echo "-- 1/4 CAPABILITIES"
bash _capabilities_gen.sh || { echo "ABORT: fallo la regeneracion"; exit 2; }

echo "-- 2/4 commit"
git add src/01_schema.js src/06_avisos.js src/18_direccion.js src/index.html CAPABILITIES.md HANDOFF.md PAQUETE-CODE-P2-lazo-resultados-2026-07-07.md _p2b_code.sh
if git diff --cached --quiet; then
  echo "nada nuevo para commitear — sigo"
else
  git commit -m "P2 F4+F5: hoja Recomendaciones + lazo completo (recomendo->se hizo->KPI se movio, registro 1/dia en corridaDiaria + juicio humano en CM) + cola de aprobaciones con despacho en lote" || { echo "ABORT: commit fallo"; exit 3; }
  echo "commit OK"
fi

echo "-- 3/4 clasp push"
clasp push -f || { echo "ABORT: clasp push fallo"; exit 4; }
echo "clasp push OK (/dev al dia; /exec sigue en @17)"

echo "-- 4/4 git push"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push OK"; else echo "AVISO: git push fallo (auth) — el codigo YA esta en GAS"; fi

echo ""
echo "== VERIFICACION (editor GAS + /dev, ~5 min) =="
echo "1. setup()   -> crea la hoja Recomendaciones"
echo "2. selfTest()   -> TODO OK (la pestaña nueva entra al check por nombre)"
echo "3. registrarRecomendacionDelDia()   -> ver en log {ok:true, id:REC-0001}"
echo "4. /dev recarga dura -> card Brief: aparece la fila del lazo con ¿Se hizo? / ¿Movio el KPI?"
echo "   Marca ambos -> toast Lazo cerrado -> la fila desaparece y la hoja Recomendaciones queda cerrada"
echo "5. Lote: se ve solo con 2+ aprobaciones pendientes (checkbox + Aprobar/Rechazar lote)"
echo "6. Si el eyeball cierra: promocion @18 -> cd ~/Documents/Claude/Projects/SatoriOS && bash _promote_exec.sh --go"
echo "LISTO."
