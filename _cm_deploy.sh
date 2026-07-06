#!/usr/bin/env bash
# _cm_deploy.sh — Deploy de los cambios visuales del CM (src/index.html) + commit de voz.html. Corre en el Mac.
# 4 cambios: isologo horizontal embebido · botón "Hablar con Sato" → terracota · Modo calma fuera · toggle de tema (luna) fuera.
# El CM (doGet) sirve la VERSIÓN DESPLEGADA: con clasp push se ve en /dev; para /exec (prod) hay que promover versión nueva (como en B4).
set -u
REPO="$(cd "$(dirname "$0")" && pwd)"; cd "$REPO" || { echo "no pude cd"; exit 1; }
GO="${1:-}"; EXPECTED='index\.html'
echo "== CM deploy — repo: $REPO =="
[ -d .git ] || { echo "ABORT: no es repo git"; exit 1; }
command -v clasp >/dev/null 2>&1 || { echo "ABORT: clasp no instalado"; exit 1; }
[ -f .git/index.lock ] && { echo "ABORT: existe .git/index.lock (otro proceso git). Cerralo o: rm .git/index.lock"; exit 1; }

# Guardia diff GAS<->working (aborta si difiere algo que NO sea index.html)
TMP="$(mktemp -d)"; cp .clasp.json "$TMP/.clasp.json" 2>/dev/null || { echo "ABORT: sin .clasp.json"; rm -rf "$TMP"; exit 1; }
echo "guardia: bajando HEAD de GAS..."
( cd "$TMP" && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull falló (clasp login?)"; rm -rf "$TMP"; exit 1; }
[ -f "$TMP/src/07_util.js" ] || { echo "ABORT: guardia inconclusa (pull vacío)"; rm -rf "$TMP"; exit 1; }
DIFF="$(diff -rq src "$TMP/src" 2>/dev/null)"
echo "--- diff working<->GAS ---"; printf '%s\n' "${DIFF:-sin diferencias}"; echo "--------------------------"
PELIGRO="$(printf '%s\n' "$DIFF" | grep -E 'differ|^Only in ' | grep -vE '^Only in src:' | grep -vE "$EXPECTED" || true)"
rm -rf "$TMP"
[ -n "$PELIGRO" ] && { echo "GUARDIA: drift NO esperado — revisá antes de pushear:"; printf '%s\n' "$PELIGRO"; exit 2; }
echo "GUARDIA: OK (solo difiere index.html)"

echo "== git status =="; git status -s
[ "$GO" != "--go" ] && { echo ""; echo "Read-only OK. Para EJECUTAR: bash _cm_deploy.sh --go"; exit 0; }

echo "== EJECUTANDO --go =="
git add src/index.html voz/web/voz.html HANDOFF.md _cm_deploy.sh
if git diff --cached --quiet; then echo "nada nuevo para commitear — sigo al push"; else
  git commit -m "CM + Voz zen-futurista: isologo horizontal embebido + boton voz terracota + Modo calma y toggle de tema removidos; voz.html restyle" || { echo "ABORT: commit falló"; exit 4; }
  echo "commit OK"; fi
echo "clasp push..."; clasp push -f || { echo "ABORT: clasp push falló"; exit 5; }
echo "clasp push OK — index.html en GAS HEAD (visible en /dev)."
git push origin HEAD 2>/dev/null && echo "push a GitHub OK" || echo "push a GitHub pendiente (corré: git push origin HEAD)"
echo ""
echo "== SIGUIENTE (Luciano): abrí /dev, mirá los 4 cambios. Si están OK, promové una VERSIÓN NUEVA al deployment de prod (/exec) — mismo procedimiento que en B4. =="
