#!/usr/bin/env bash
# _ui_pulido2_code.sh — UI 14-jul RONDA 2 (feedback eyeball): el "aro dorado con glow" real era el
# box-shadow de la CAJA del orbe (no el anillo fino) => caja .78 con zoom de camara compensado
# (la ESFERA conserva su tamano absoluto exacto), avatares centrados SOBRE el aro, orbita externa
# a +90px (fin de la colision entre nodos de 76px), y "Hablar con Sato" abre PESTANA NUEVA con
# volver=window.close => el CM nunca se recarga (fin del flash blanco del wrapper de Google).
# USO: bash _ui_pulido2_code.sh   (dry-run)   |   bash _ui_pulido2_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES =="
grep -qF 'width:calc(var(--orbe)*.78)' src/index.html || { echo "ABORT: falta caja .78"; exit 1; }
grep -qF 'cam.position.z=2.34' src/index.html || { echo "ABORT: falta zoom compensado"; exit 1; }
grep -qF 'R0=w*.436' src/index.html || { echo "ABORT: falta fallback 2D compensado"; exit 1; }
grep -qF 'calc(var(--orbe)*.80)' src/index.html || { echo "ABORT: falta aro .80"; exit 1; }
grep -qF -e '--r:calc(var(--orbe)*.40)' src/index.html || { echo "ABORT: faltan orbitas .40"; exit 1; }
grep -q 'id="cmVoz" href="http://127.0.0.1:8787/" target="_blank"' src/index.html || { echo "ABORT: falta _blank en boton voz"; exit 1; }
grep -q 'window.close(); },320' voz/web/voz.html || { echo "ABORT: falta window.close en volver"; exit 1; }
diff -q voz/web/voz.html "$HOME/Documents/Claude/Projects/SATORI · Asesoramiento y consultoría/voz.html" >/dev/null \
  || { echo "ABORT: la copia de consultoria difiere del repo (foot-gun ks_pwa_deploy)"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node -e "
const fs=require('fs');
for(const f of ['src/index.html','voz/web/voz.html']){
  let h=fs.readFileSync(f,'utf8').replace(/<!--[\s\S]*?-->/g,'');
  const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  fs.writeFileSync('/tmp/_uip2_'+f.split('/').pop()+'.js', m.map(x=>x[1]).join('\n;\n'));
}
" || { echo "ABORT: extraccion de scripts"; exit 1; }
  node --check /tmp/_uip2_index.html.js || { echo "ABORT: sintaxis script index"; exit 1; }
  node --check /tmp/_uip2_voz.html.js || { echo "ABORT: sintaxis script voz"; exit 1; }
  echo "sintaxis OK"
fi
echo "PRE-CONDICIONES OK"

echo "== GUARDIA: diff repo vs GAS HEAD (regla 30-jun) =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar antes de pushear"; exit 1; }
echo "difieren (esperados): ${DIFIEREN:-nada}"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: commit + clasp push a /dev + git push =="
  exit 0
fi

echo "== EJECUTANDO --go =="
git add src/index.html voz/web/voz.html HANDOFF.md _ui_pulido2_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "UI 14-jul ronda 2: el aro con glow real era el box-shadow de la caja del orbe -> caja .78 + zoom compensado (esfera mismo tamano), avatares centrados en el aro, orbita externa +90 sin colision, voz en pestana nueva con volver=window.close (fin del flash blanco del wrapper)" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (en /dev; prod /exec sigue en @25)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (3 min) =="
echo "1. /dev recarga dura: el aro con glow ABRAZA la esfera (la esfera NO cambia de tamano),"
echo "   los avatares giran CENTRADOS sobre el aro, sin superponerse entre ellos"
echo "2. Hablar con Sato: se abre en PESTANA NUEVA con el fondo cosmico"
echo "3. Volver al panel: la pestana se CIERRA sola y el CM aparece al instante, intacto,"
echo "   sin negro, sin blanco, sin recarga"
echo "4. Si todo OK: bash _promote_exec.sh --go para llevarlo a prod como @26"
echo "LISTO."
