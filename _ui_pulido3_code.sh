#!/usr/bin/env bash
# _ui_pulido3_code.sh — UI 14-jul RONDA 3 (fix del HORRIBLE): revert TOTAL de la esfera (caja completa,
# camara z=3.0, fallback 2D .34 => esfera identica a la original), el halo-anillo lejano de la caja
# queda APAGADO (solo luz interna), y el aro dorado con glow ahora es .oring.a a MITAD del gap original
# (.43 del orbe) con los avatares centrados sobre el, orbita externa +90px. Pestana nueva de voz intacta.
# USO: bash _ui_pulido3_code.sh   (dry-run)   |   bash _ui_pulido3_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES =="
grep -qF 'position:relative; width:var(--orbe); height:var(--orbe);' src/index.html || { echo "ABORT: la caja del orbe no volvio al original"; exit 1; }
grep -qF 'cam.position.z=3.0' src/index.html || { echo "ABORT: camara no revertida"; exit 1; }
grep -qF 'R0=w*.34,' src/index.html || { echo "ABORT: fallback 2D no revertido"; exit 1; }
grep -qF 'box-shadow:inset 0 0 70px -16px' src/index.html || { echo "ABORT: halo de la caja no apagado"; exit 1; }
grep -qF 'calc(var(--orbe)*.86)' src/index.html || { echo "ABORT: falta aro .86"; exit 1; }
grep -qF -e '--r:calc(var(--orbe)*.43)' src/index.html || { echo "ABORT: faltan orbitas .43"; exit 1; }
grep -qF '[data-orb="listen"] .oring.a' src/index.html || { echo "ABORT: falta estado listen del aro"; exit 1; }
grep -q 'id="cmVoz" href="http://127.0.0.1:8787/" target="_blank"' src/index.html || { echo "ABORT: falta _blank"; exit 1; }
grep -q 'window.close(); },320' voz/web/voz.html || { echo "ABORT: falta window.close en volver"; exit 1; }
diff -q voz/web/voz.html "$HOME/Documents/Claude/Projects/SATORI · Asesoramiento y consultoría/voz.html" >/dev/null \
  || { echo "ABORT: copia de consultoria difiere del repo"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/_uip3_index.js', m.map(x=>x[1]).join('\n;\n'));
" || { echo "ABORT: extraccion"; exit 1; }
  node --check /tmp/_uip3_index.js || { echo "ABORT: sintaxis script index"; exit 1; }
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
git add src/index.html HANDOFF.md _ui_pulido3_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "UI 14-jul ronda 3: revert esfera exacta (caja/camara/2D) + halo-anillo lejano APAGADO + oring.a = aro dorado glow a mitad de gap (.43) con avatares centrados + orbita externa +90" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (en /dev; prod /exec sigue en @25)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (2 min) =="
echo "1. /dev recarga dura:"
echo "   - la esfera EXACTAMENTE como siempre (tamano y brillo originales)"
echo "   - UN solo aro dorado con glow, cerca de la esfera (mitad de la distancia vieja)"
echo "   - los avatares giran centrados sobre ese aro, sin superponerse"
echo "   - ya NO existe el anillo luminoso gigante lejano"
echo "2. Hablar con Sato en pestana nueva; volver cierra la pestana y el CM queda intacto"
echo "3. Si todo OK: bash _promote_exec.sh --go para prod @26"
echo "LISTO."
