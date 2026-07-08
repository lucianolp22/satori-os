#!/usr/bin/env bash
# _delta2_code.sh — Delta 2 (08-jul-2026): 3 fixes sobre el Command Center.
#   1) index.html: .cm-toast con color crema + centrado + wrap  -> banner LEGIBLE
#      (antes heredaba texto oscuro sobre fondo oscuro = ilegible / "banner vacio").
#   2) 08_webapp.js: resolverAprobacionUI saca la aprobacion del espejo agregado al
#      resolver (quitarAgregada_) -> NO reaparece en el CM (antes esperaba a syncMaestro).
#   3) 18_direccion.js: recomendacionDelDia_ rama A3 = KPI de cliente en alerta ->
#      recomendacion ANCLADA al cliente (clienteKpiEnAlerta_) -> el boton Crear-aprobacion
#      tiene sentido en el uso real, sin depender de proyectos.
#   4) 09_selftest.js: asserts D10 (A3) + D11 (quitarAgregada_); D6 no escanea hojas cliente.
# USO: bash _delta2_code.sh  (dry-run)  |  bash _delta2_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (los cambios estan en el working tree) =="
grep -q "color:#ECEAE3" src/index.html || { echo "ABORT: falta el color del toast"; exit 1; }
grep -q "function clienteKpiEnAlerta_" src/18_direccion.js || { echo "ABORT: falta clienteKpiEnAlerta_"; exit 1; }
grep -q "kpi_cliente" src/18_direccion.js || { echo "ABORT: falta la rama A3 (kpi_cliente)"; exit 1; }
grep -q "function quitarAgregada_" src/08_webapp.js || { echo "ABORT: falta quitarAgregada_"; exit 1; }
grep -q "quitarAgregada_(id)" src/08_webapp.js || { echo "ABORT: resolverAprobacionUI no llama a quitarAgregada_"; exit 1; }
grep -q "D10 A3" src/09_selftest.js || { echo "ABORT: faltan asserts D10"; exit 1; }
grep -q "D11 quitarAgregada" src/09_selftest.js || { echo "ABORT: falta assert D11"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node --check src/18_direccion.js || { echo "ABORT: sintaxis direccion"; exit 1; }
  node --check src/08_webapp.js || { echo "ABORT: sintaxis webapp"; exit 1; }
  node --check src/09_selftest.js || { echo "ABORT: sintaxis selftest"; exit 1; }
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/cm_d2.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/cm_d2.js || { echo "ABORT: sintaxis script del index"; exit 1; }
  echo "sintaxis OK (3 js + index)"
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
ESPERADOS="08_webapp.js 09_selftest.js 18_direccion.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar"; exit 1; }
echo "difieren (esperados): $DIFIEREN"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit + clasp push + git push =="
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/index.html src/08_webapp.js src/18_direccion.js src/09_selftest.js CAPABILITIES.md HANDOFF.md _delta2_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "Delta 2 CM: toast legible (cm-toast color/centro/wrap) + reflejo inmediato al resolver aprobacion (quitarAgregada_, no reaparece) + recomendacion anclada a KPI de cliente en alerta (A3, clienteKpiEnAlerta_) + asserts D10/D11" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> selfTest() -> TODO OK incluyendo D10 (A3 KPI cliente) y D11 (quitarAgregada_)."
echo "2. CM /dev recarga dura -> dispara cualquier toast (ej. el feedback del brief, o rechazar): el texto se LEE (crema, centrado)."
echo "3. Aprobaciones: rechaza una pendiente -> desaparece y NO reaparece al recargar (reflejo inmediato)."
echo "4. Si todo aprueba -> bash _promote_exec.sh promueve /exec (junta v11+F1+F1.1+T1+T2+Delta2) y en ese cierre borra src/99_tmp_tipos.js."
echo "LISTO."
