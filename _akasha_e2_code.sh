#!/usr/bin/env bash
# _akasha_e2_code.sh — AKASHA E2: spike de convivencia Three (Opción A) + P0.5 → /dev
#
#   bash _akasha_e2_code.sh        -> DRY RUN (asserts + guardia diff repo<->GAS; NO toca nada)
#   bash _akasha_e2_code.sh --go   -> git commit + clasp push (/dev = HEAD; /exec NO se toca)
#
# DECISIÓN E2 = OPCIÓN A: Akasha reusa el window.THREE r128 (UMD, CDN+SRI) que ya carga el CM.
# Verificado offline 17-jul: las 30 APIs del prototipo E113 existen en r128 · motor 100% unlit
# (no aplica la divergencia de iluminación r128↔r184) · cero APIs de color-space · 5 toggles ×
# 60 frames contra el r128 REAL sin excepción (harness vm, renderer stubbeado).
# Incluye del HANDOFF: (b) borrar src/99_tmp_tipos.js (P0.5) · (c) commitear HANDOFF.
# NO incluye (a) {completo:true}: YA estaba hecho desde b74d665 — el HANDOFF quedó stale ahí.
set -uo pipefail
GO="${1:-}"
cd "$HOME/Documents/Claude/Projects/SatoriOS" || { echo "ABORT: no existe el repo"; exit 1; }
command -v clasp >/dev/null 2>&1 || { echo "ABORT: clasp no está en PATH"; exit 1; }
[ -f .git/index.lock ] && { echo "ABORT: existe .git/index.lock (otro proceso git). Lo remueve Luciano en el Mac."; exit 1; }

echo "== 1/4 asserts del spike =="
grep -q 'id="akasha"' src/index.html                        || { echo "ABORT: falta el overlay #akasha"; exit 1; }
grep -q 'id="cmAkasha"' src/index.html                      || { echo "ABORT: falta la puerta (pill ⟶ Akasha)"; exit 1; }
grep -q 'function akBuild_' src/index.html                  || { echo "ABORT: falta el motor akBuild_"; exit 1; }
grep -q '!(AK&&AK\.on)' src/index.html                      || { echo "ABORT: cmLoop SIN guarda de AK (dos loops a la vez)"; exit 1; }
grep -q 'forceContextLoss' src/index.html                   || { echo "ABORT: falta forceContextLoss en destroy"; exit 1; }
grep -q 'cv.replaceWith' src/index.html                     || { echo "ABORT: falta canvas.replaceWith (iOS)"; exit 1; }
grep -q "typeof THREE!=='undefined'" src/index.html         || { echo "ABORT: la puerta perdió el fail-closed sin Three"; exit 1; }
grep -q 'await import' src/index.html                       && { echo "ABORT: quedó un import() ESM — Opción A usa el THREE global"; exit 1; }
[ -f src/99_tmp_tipos.js ]                                  && { echo "ABORT: 99_tmp_tipos.js sigue en src/ (P0.5)"; exit 1; }
grep -q '99_tmp_tipos' CAPABILITIES.md                      && { echo "ABORT: CAPABILITIES stale (regenerá: bash _capabilities_gen.sh)"; exit 1; }
echo "   asserts OK"

echo "== 2/4 sintaxis del <script> del CM (node --check) =="
TMPJS="$(mktemp -d)"
python3 - "$TMPJS/cm.js" <<'PY' || { echo "ABORT: no pude extraer el <script>"; rm -rf "$TMPJS"; exit 1; }
import re,sys
src=open('src/index.html',encoding='utf-8').read()
src=re.sub(r'<!--.*?-->','',src,flags=re.S)   # los comentarios HTML traen "<script>" en prosa
b=[x for x in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',src,re.S) if 'function cmLoop' in x]
assert len(b)==1, f"esperaba 1 bloque con cmLoop, hay {len(b)}"
open(sys.argv[1],'w',encoding='utf-8').write(b[0])
PY
node --check "$TMPJS/cm.js" || { echo "ABORT: sintaxis del script del CM"; rm -rf "$TMPJS"; exit 1; }
rm -rf "$TMPJS"; echo "   node --check OK"

echo "== 3/4 guardia diff repo<->GAS (aborta si pisaría algo) =="
EXPECTED='index\.html|99_tmp_tipos\.js'   # lo único que este cambio toca en src/
TMP="$(mktemp -d)"; cp .clasp.json "$TMP/.clasp.json" 2>/dev/null || { echo "ABORT: sin .clasp.json"; rm -rf "$TMP"; exit 1; }
echo "   bajando HEAD de GAS..."
( cd "$TMP" && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull falló (si dice invalid_rapt: clasp logout && clasp login)"; rm -rf "$TMP"; exit 1; }
[ -f "$TMP/src/07_util.js" ] || { echo "ABORT: guardia inconclusa (pull vacío)"; rm -rf "$TMP"; exit 1; }
DIFF="$(diff -rq src "$TMP/src" 2>/dev/null)"
echo "--- diff working<->GAS ---"; printf '%s\n' "${DIFF:-sin diferencias}"; echo "--------------------------"
PELIGRO="$(printf '%s\n' "$DIFF" | grep -E 'differ|^Only in ' | grep -vE "$EXPECTED" || true)"
rm -rf "$TMP"
[ -n "$PELIGRO" ] && { echo "GUARDIA: drift NO esperado — revisá ANTES de pushear:"; printf '%s\n' "$PELIGRO"; exit 2; }
echo "GUARDIA: OK (solo difieren index.html y el 99_tmp_tipos.js que se borra)"

echo "== git status =="; git status -s
[ "$GO" != "--go" ] && { echo ""; echo "DRY RUN OK — nada tocado. Para EJECUTAR: bash _akasha_e2_code.sh --go"; exit 0; }

echo "== 4/4 EJECUTANDO --go =="
git add src/index.html CAPABILITIES.md HANDOFF.md _akasha_e2_code.sh
git rm -q --cached --ignore-unmatch src/99_tmp_tipos.js >/dev/null 2>&1
git add -u src/ 2>/dev/null
if git diff --cached --quiet; then echo "(nada nuevo para commitear)"; else
  git commit -q -m "AKASHA E2: spike de convivencia Three — Opción A (Akasha reusa el window.THREE r128 del CM)

Decisión E2 = A, verificada offline contra el build r128 real del CDN (SRI idéntico al del CM):
· las 30 APIs THREE.* del prototipo E113 existen en r128 (MathUtils.damp incluido)
· el motor es 100% unlit (MeshBasic/Points/Sprite/Line) -> no aplica la divergencia de
  iluminación r128<->r184, que era el riesgo grande
· el prototipo no toca NINGUNA API de color-space (la otra ruptura entre esas versiones)
-> no hace falta la Opción B (subir el CM a r184 ESM). Un solo Three por página.

Spike (núcleo + 1 estación, ~130 líneas; E3 lo reemplaza por el motor del prototipo):
· puerta: pill '⟶ Akasha' en la topbar + overlay #akasha con canvas propio (#akGl)
· renderer PROPIO por escena: 0 referencias a cm3D.renderer (verificado sin comentarios)
· un solo loop de render a la vez: cmLoop saltea su cuerpo mientras AK.on (se saltea el
  CUERPO, no se corta la cadena de rAF -> imposible una cadena doble al entrar/salir N veces)
· salida limpia: dispose + forceContextLoss + canvas.replaceWith (patrón E113, iOS)
· fail-closed: sin THREE (CDN caído/SRI roto) o reduced-motion la puerta no abre
· HUD con fps + contador de toggles + THREE.REVISION, para que el gate se MIDA
Verificación offline: node --check OK · 5 toggles × 60 frames contra el r128 real sin
excepción, con dispose/forceContextLoss/replaceWith 5/5 (harness vm, renderer stubbeado).

También (pendientes del HANDOFF): borrado src/99_tmp_tipos.js (P0.5, one-shot ya corrido
el 07-jul) + CAPABILITIES regenerado + HANDOFF commiteado.
NO incluye el (a) {completo:true}: ya estaba hecho desde b74d665 — el HANDOFF estaba stale.

GATE E2 (pendiente, lo mide Luciano en /dev): 60fps desktop / >=30fps iPhone PWA /
5 toggles Despacho<->Akasha sin context-loss ni pantalla negra.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" && echo "   commit OK"
fi
echo "== clasp push (/dev = HEAD; /exec NO se toca) =="
clasp push || { echo "ABORT: clasp push falló (si dice invalid_rapt: clasp logout && clasp login)"; exit 2; }
echo ""
echo "== LISTO — el spike está en /dev =="
echo "GATE E2 (lo medís vos en /dev, el CM no es auto-screenshoteable):"
echo "  1. abrir /dev -> 🛰 Centro de Mando -> pill '⟶ Akasha'"
echo "  2. leer el HUD: fps (>=60 desktop / >=30 iPhone PWA) + r128 en el label"
echo "  3. entrar/salir 5 veces (⟵ Despacho o Esc): sin pantalla negra, sin context-loss,"
echo "     y el orbe del CM debe RETOMAR el giro al volver (el contador de toggles llega a 5)"
