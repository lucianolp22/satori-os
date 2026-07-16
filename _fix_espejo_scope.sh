#!/usr/bin/env bash
# _fix_espejo_scope.sh — FIX D16y (16-jul noche, hallado por el gate pre-@28 corrido por Cowork):
# los APR-#### son secuencia POR CLIENTE ⇒ en el espejo multi-tenant `Aprobaciones_agregadas`
# el id pelado COLISIONA entre tenants:
#   - espejoDe (assert D16u-y) filtraba solo por id → falso rojo D16y con datos vivos.
#   - quitarAgregada_(id) PROD borraba por id pelado → resolver la de un cliente podía
#     llevarse la card de OTRO del CM hasta el próximo syncMaestro.
# Cambios (ya aplicados en working tree por Cowork, verificados node --check):
#   - src/08_webapp.js: quitarAgregada_(id, idCliente) + caller resolverAprobacionUI
#   - src/09_selftest.js: espejoDe por id+tenant + asserts nuevos D16y2/D16y3
# USO:  bash _fix_espejo_scope.sh        -> DRY RUN (verifica, no toca nada)
#       bash _fix_espejo_scope.sh --go   -> clasp push (/dev) + git commit
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || { echo "ABORT: no existe el repo"; exit 1; }

echo "== PRECONDICIONES =="
command -v node >/dev/null && { node --check src/08_webapp.js || exit 1; node --check src/09_selftest.js || exit 1; echo "node --check 2/2 OK"; } || echo "AVISO: sin node local, sintaxis ya verificada por Cowork"
grep -q "function quitarAgregada_(id, idCliente)" src/08_webapp.js || { echo "ABORT: falta la firma nueva de quitarAgregada_"; exit 1; }
grep -q "quitarAgregada_(id, idCliente); } catch" src/08_webapp.js || { echo "ABORT: el caller resolverAprobacionUI no pasa idCliente"; exit 1; }
grep -q "D16y2 quitarAgregada_ scoped" src/09_selftest.js || { echo "ABORT: faltan los asserts D16y2/y3"; exit 1; }
grep -q "String(f.id_cliente) === String(d16cli.id_cliente); }); };" src/09_selftest.js || { echo "ABORT: espejoDe sigue sin scope de tenant"; exit 1; }
command -v clasp >/dev/null || { echo "ABORT: clasp no esta en PATH"; exit 1; }
echo "precondiciones OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK — nada tocado. Con --go: clasp push (/dev) + git commit =="
  exit 0
fi

echo ""
echo "== 1/2 clasp push (/dev = HEAD; /exec NO se toca) =="
clasp push || { echo "ABORT: clasp push falló (si dice invalid_rapt: clasp logout && clasp login)"; exit 2; }

echo "== 2/2 git commit =="
git add src/08_webapp.js src/09_selftest.js HANDOFF.md _fix_espejo_scope.sh
if git diff --cached --quiet; then echo "(nada nuevo para commitear)"; else
  git commit -m "fix D16y: quitarAgregada_/espejoDe por (id, id_cliente) — APR-#### es secuencia por cliente; el espejo multi-tenant colisionaba entre tenants" || exit 3
fi
echo ""
echo "LISTO. Siguiente: selfTestF2() en el editor (Cowork lo corre por Chrome) -> selfTest() completo -> _promote_exec.sh --go -> @28"
