#!/usr/bin/env bash
# _ui_pulido_code.sh — UI 14-jul (video 08:21): boot limpio del CM (velo + snapshot de sesion => sin
# "versiones viejas" ni flash blanco), avatares de la orbita x2, aro dorado a media distancia de la
# esfera, voz.html con el fondo del CM y cortina "Volviendo..." al salir.
# Solo cliente: index.html (GAS) + voz/web/voz.html (PWA local). CERO cambios en .js de servidor.
# USO: bash _ui_pulido_code.sh   (dry-run)   |   bash _ui_pulido_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (lo que Cowork dejo en el working tree) =="
grep -q "function cmAplicarEstado" src/index.html || { echo "ABORT: falta cmAplicarEstado"; exit 1; }
grep -q 'id="cmVeil"' src/index.html || { echo "ABORT: falta velo de carga"; exit 1; }
grep -q "cmRestaurarSnapshot" src/index.html || { echo "ABORT: falta snapshot de sesion"; exit 1; }
grep -q "width:76px" src/index.html || { echo "ABORT: faltan avatares x2"; exit 1; }
grep -q 'cm-boot-dark' src/index.html || { echo "ABORT: falta anti-flash"; exit 1; }
grep -qF 'calc(var(--orbe)*.84)' src/index.html || { echo "ABORT: falta aro nuevo"; exit 1; }
grep -q 'class="photobg"' voz/web/voz.html || { echo "ABORT: falta fondo CM en voz"; exit 1; }
grep -q "Volviendo al Centro de Mando" voz/web/voz.html || { echo "ABORT: falta cortina con aviso"; exit 1; }
diff -q voz/web/voz.html "$HOME/Documents/Claude/Projects/SATORI · Asesoramiento y consultoría/voz.html" >/dev/null \
  || { echo "ABORT: la copia de consultoria difiere del repo (foot-gun ks_pwa_deploy)"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node -e "
const fs=require('fs');
for(const f of ['src/index.html','voz/web/voz.html']){
  let h=fs.readFileSync(f,'utf8').replace(/<!--[\s\S]*?-->/g,'');
  const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  fs.writeFileSync('/tmp/_uip_'+f.split('/').pop()+'.js', m.map(x=>x[1]).join('\n;\n'));
}
" || { echo "ABORT: extraccion de scripts"; exit 1; }
  node --check /tmp/_uip_index.html.js || { echo "ABORT: sintaxis script index"; exit 1; }
  node --check /tmp/_uip_voz.html.js || { echo "ABORT: sintaxis script voz"; exit 1; }
  echo "sintaxis OK (script del index + script de voz)"
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
git add src/index.html voz/web/voz.html HANDOFF.md _ui_pulido_code.sh ENCARGO-CODE-voz-colgada-2026-07-14.md
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "UI 14-jul: boot limpio CM (velo + snapshot de sesion, sin versiones viejas ni flash blanco) + avatares orbita x2 + aro a media distancia + voz.html con fondo del CM y cortina con aviso" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (index.html en /dev; prod /exec sigue en @25)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (5 min) =="
echo "1. Abrir /dev con recarga dura y chequear a ojo:"
echo "   - Al cargar: velo oscuro Cargando el Centro de Mando, y aparece DIRECTO la version final"
echo "   - Nada de flash blanco ni datos viejos en ningun momento"
echo "   - Avatares de la orbita al doble, se ven las caras; aro dorado mas cerca de la esfera"
echo "   - Etiquetas Vigia/Analista/etc legibles debajo de cada avatar"
echo "2. Hablar con Sato desde el CM: la pantalla de voz tiene el MISMO fondo cosmico"
echo "3. Volver al panel: cortina con texto Volviendo al Centro de Mando, sin pantalla blanca,"
echo "   y el CM reaparece al instante con datos reales mas pill Actualizando datos unos segundos"
echo "4. Si todo OK: bash _promote_exec.sh --go para llevarlo a prod como @26"
echo "NOTA: la voz en iPhone toma el voz.html nuevo al reabrir la PWA (shell no-store, sin cache)."
echo "LISTO."
