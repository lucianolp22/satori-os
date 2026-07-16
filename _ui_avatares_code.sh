#!/usr/bin/env bash
# _ui_avatares_code.sh — 16-jul tarde: (1) GLOW ECLIPSE del aro restaurado — .oring.a recupera el stack
# de resplandor del /exec (dorado 30px → terracota 70/130px → jade 200px + inset cálido) SOBRE el trazo
# fino de 1px a .86 (la distancia nueva se conserva; solo vuelve el "resplandece eclipsado").
# (2) AVATARES PROPIOS Bandeja y Cerebro — nodos nav con data-ag, cmAvataresOrbita(agentes,cfg) mapea
# Config avatar_bandeja/avatar_cerebro (fail-closed al glifo), estadoAgentes expone las 2 keys.
# Los archivos YA llegaron editados por el canal oficial (commit_files): este script SOLO valida y despliega.
# USO: bash _ui_avatares_code.sh   (dry-run)   |   bash _ui_avatares_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES =="
# (1) glow eclipse presente sobre el trazo fino, a la distancia nueva
grep -qF -e '0 0 30px -4px rgba(242,200,147,.72)' src/index.html || { echo "ABORT: falta el stack de glow eclipse"; exit 1; }
grep -qF -e 'glow eclipse del /exec restaurado' src/index.html || { echo "ABORT: falta marcador glow 16-jul"; exit 1; }
grep -qF -e 'calc(var(--orbe)*.86)' src/index.html || { echo "ABORT: se perdió el aro .86"; exit 1; }
grep -qF -e '--r:calc(var(--orbe)*.43)' src/index.html || { echo "ABORT: se perdieron las órbitas .43"; exit 1; }
grep -qF -e 'inset de la caja APAGADO' src/index.html || { echo "ABORT: se perdió la franja apagada"; exit 1; }
grep -cF -e 'border:1px solid rgba(242,200,147,.5)' src/index.html >/dev/null || { echo "ABORT: se perdió el trazo 1px"; exit 1; }
# (2) avatares Bandeja/Cerebro
grep -qF -e 'data-ag="cerebro"' src/index.html || { echo "ABORT: falta data-ag cerebro"; exit 1; }
grep -qF -e 'data-ag="bandeja"' src/index.html || { echo "ABORT: falta data-ag bandeja"; exit 1; }
grep -qF -e 'cmAvataresOrbita(est.agentes,est.cfg)' src/index.html || { echo "ABORT: call site sin cfg"; exit 1; }
grep -qF -e 'cfg.avatar_cerebro' src/index.html || { echo "ABORT: falta merge cfg en cmAvataresOrbita"; exit 1; }
grep -qF -e "avatar_bandeja: getConfig('avatar_bandeja')" src/08_webapp.js || { echo "ABORT: 08_webapp sin keys de avatar"; exit 1; }
grep -qF -e "avatar_cerebro: getConfig('avatar_cerebro')" src/08_webapp.js || { echo "ABORT: 08_webapp sin avatar_cerebro"; exit 1; }
# invariantes previas que no deben romperse
grep -q 'id="cmVoz" href="http://127.0.0.1:8787/" target="_blank"' src/index.html || { echo "ABORT: se perdió _blank de voz"; exit 1; }
grep -q 'window.close(); },320' voz/web/voz.html || { echo "ABORT: se perdió window.close en volver"; exit 1; }
diff -q voz/web/voz.html "$HOME/Documents/Claude/Projects/SATORI · Asesoramiento y consultoría/voz.html" >/dev/null \
  || { echo "ABORT: copia de consultoria difiere del repo"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/_uiav_index.js', m.map(x=>x[1]).join('\n;\n'));
" || { echo "ABORT: extraccion"; exit 1; }
  node --check /tmp/_uiav_index.js || { echo "ABORT: sintaxis script index"; exit 1; }
  node --check src/08_webapp.js || { echo "ABORT: sintaxis 08_webapp"; exit 1; }
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
ESPERADOS="index.html 08_webapp.js"
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
git add src/index.html src/08_webapp.js HANDOFF.md _ui_avatares_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "UI 16-jul tarde: glow eclipse del /exec restaurado en el aro fino a .86 + avatares propios Bandeja/Cerebro via Config (data-ag + cfg en estadoAgentes, fail-closed al glifo)" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (en /dev; prod /exec sigue en @25)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (2 min) =="
echo "1. /dev recarga dura:"
echo "   - el aro fino de 1px sigue a la distancia nueva, pero ahora RESPLANDECE eclipsado (glow calido"
echo "     dorado→terracota→jade que se desvanece hacia afuera, como en /exec)"
echo "   - Bandeja y Cerebro siguen con su glifo (las Config keys aun no estan sembradas — es lo esperado)"
echo "2. Sembrar Config avatar_bandeja / avatar_cerebro (ver instrucciones del chat) y recargar:"
echo "   - Bandeja y Cerebro muestran sus avatares circulares; si una URL falla, vuelve el glifo solo"
echo "3. Si todo OK: bash _promote_exec.sh --go para prod @26"
echo "LISTO."
