#!/usr/bin/env bash
# _trillion_t12_code.sh — Trillion-delta Tanda 1 + Tanda 2 (08-jul-2026).
#   T1 (voz, solo cliente — sin reinicio de agente): C1-delta aro de estado del orbe
#      + C2 progreso REAL del turno en el chatlog (pensando/consultando + cronometro).
#   T2 (GAS): A2 juicio anclado en recomendacion/brief + B2 boton crear-aprobacion
#      desde el lazo (P1 default-deny, reusa F4/F5) + columna id_cliente + asserts D9.
# USO: bash _trillion_t12_code.sh  (dry-run)  |  bash _trillion_t12_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (los cambios estan en el working tree) =="
grep -qF "cerrada_en', 'id_cliente'" src/01_schema.js || { echo "ABORT: falta id_cliente en schema Recomendaciones"; exit 1; }
grep -q "function aprobacionDesdeRecomendacion" src/18_direccion.js || { echo "ABORT: falta aprobacionDesdeRecomendacion"; exit 1; }
grep -qi "juicio ANCLADO" src/18_direccion.js || { echo "ABORT: falta juicio anclado en recomendacionDelDia_"; exit 1; }  # -qi: el marcador en el codigo es 'JUICIO ANCLADO' (mayusc., linea 360)
grep -q "D9 B2 rec" src/09_selftest.js || { echo "ABORT: faltan asserts D9"; exit 1; }
grep -q "aprobacionDesdeRecomendacion(r.id)" src/index.html || { echo "ABORT: falta boton crear-aprobacion en el CM"; exit 1; }
grep -q 'id="orbRing"' voz/web/voz.html || { echo "ABORT: falta el aro del orbe en voz.html"; exit 1; }
grep -q "function progShow" voz/web/voz.html || { echo "ABORT: falta el progreso C2 en voz.html"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node --check src/01_schema.js || { echo "ABORT: sintaxis schema"; exit 1; }
  node --check src/18_direccion.js || { echo "ABORT: sintaxis direccion"; exit 1; }
  node --check src/09_selftest.js || { echo "ABORT: sintaxis selftest"; exit 1; }
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/cm_t12_script.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/cm_t12_script.js || { echo "ABORT: sintaxis script del index"; exit 1; }
  node -e "
const fs=require('fs');
let h=fs.readFileSync('voz/web/voz.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/voz_t12_script.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/voz_t12_script.js || { echo "ABORT: sintaxis script de voz.html"; exit 1; }
  echo "sintaxis OK (3 js + index + voz)"
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
ESPERADOS="01_schema.js 09_selftest.js 18_direccion.js index.html"
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
git add src/01_schema.js src/18_direccion.js src/09_selftest.js src/index.html voz/web/voz.html \
  CAPABILITIES.md HANDOFF.md _trillion_t12_code.sh \
  HANDOFF-Trillion-integracion-2026-07-08.md PLAN-ACCION-TRILLION-DELTA-2026-07-08.md
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "Trillion-delta T1+T2: voz con aro de estado del orbe + progreso real del turno en el chatlog (C1/C2, solo cliente); juicio anclado en recomendacion y briefs (A2) + boton crear-aprobacion desde el lazo (B2, P1 default-deny sobre F4/F5) + columna id_cliente en Recomendaciones + asserts D9 + docs Trillion" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (5 min, en orden) =="
echo "1. Editor GAS -> setup()   PRIMERO: reconcilia la columna id_cliente en Recomendaciones"
echo "2. Editor GAS -> selfTest() -> TODO OK incluyendo los 7 D9"
echo "3. VOZ (sin reiniciar nada): recarga la pagina de voz y hace una consulta real"
echo "   (ej. 'como venimos?'). Tenes que ver: el ARO del orbe cambiar de color"
echo "   (jade escucha / ambar pensando / terracota habla) y en el chat la fila"
echo "   'Pensando...' -> 'Consultando el sistema... Ns' antes de la respuesta."
echo "4. CM /dev recarga dura -> card Brief de hoy -> fila del lazo: si la recomendacion"
echo "   refiere a un cliente, aparece el boton '-> Crear aprobacion' -> tocarlo ->"
echo "   toast 'creada' y la aprobacion aparece en la card Aprobaciones (P1)."
echo "   NOTA: la rec abierta de HOY nacio con el codigo viejo, sin id_cliente -> si no"
echo "   ves el boton, corre registrarRecomendacionDelDia() en el editor y recarga el CM."
echo "   La rec vieja duplicada se cierra por el lazo con los 2 juicios, como siempre."
echo "5. Si todo aprueba -> promover /exec con bash _promote_exec.sh (junta v11+F1+F1.1+T1+T2)"
echo "   y en ese cierre borrar src/99_tmp_tipos.js (pendiente previo)."
echo "LISTO."
