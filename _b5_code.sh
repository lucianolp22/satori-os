#!/usr/bin/env bash
# _b5_code.sh — Push de la remediación B5 (git + clasp). Corre en el Mac.
# 6 fixes en 7 archivos src/ (ver PAQUETE-CODE-B5). Guardia con allowlist = SOLO esos 7 deben diferir.
#
# Uso:
#   bash _b5_code.sh        -> guardia + preview (read-only)
#   bash _b5_code.sh --go   -> commit + clasp push (+ intenta push a GitHub)
set -u
REPO="$(cd "$(dirname "$0")" && pwd)"; cd "$REPO" || { echo "no pude cd al repo"; exit 1; }
GO="${1:-}"
# Los 7 archivos que INTENCIONALMENTE cambian en B5 (el resto que difiera = drift → abortar):
EXPECTED='07_util\.js|13_agentes\.js|15_cerebro\.js|14_director\.js|08_webapp\.js|17_bandeja\.js|20_killswitch\.js'

echo "== B5 Code — repo: $REPO =="
[ -d .git ] || { echo "ABORT: no es repo git"; exit 1; }
command -v clasp >/dev/null 2>&1 || { echo "ABORT: clasp no instalado"; exit 1; }
if [ -f .git/index.lock ]; then echo "ABORT: existe .git/index.lock (otro proceso git). Cerralo o: rm .git/index.lock"; exit 1; fi

echo "node --check de los 7 archivos..."
for f in 07_util 13_agentes 15_cerebro 14_director 08_webapp 17_bandeja 20_killswitch; do
  node --check "src/$f.js" || { echo "ABORT: src/$f.js no compila"; exit 1; }
done
echo "sintaxis OK"

# Guardia diff GAS<->working (aborta si difiere algo NO esperado)
TMP="$(mktemp -d)"
cp .clasp.json "$TMP/.clasp.json" 2>/dev/null || { echo "ABORT: sin .clasp.json"; rm -rf "$TMP"; exit 1; }
echo "guardia: bajando HEAD de GAS..."
( cd "$TMP" && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull falló (clasp login?)"; rm -rf "$TMP"; exit 1; }
[ -f "$TMP/src/07_util.js" ] || { echo "ABORT: guardia inconclusa (pull vacío)"; rm -rf "$TMP"; exit 1; }
DIFF="$(diff -rq src "$TMP/src" 2>/dev/null)"
echo "--- diff working<->GAS ---"; printf '%s\n' "${DIFF:-sin diferencias}"; echo "--------------------------"
PELIGRO="$(printf '%s\n' "$DIFF" | grep -E 'differ|^Only in ' | grep -vE '^Only in src:' | grep -vE "$EXPECTED" || true)"
rm -rf "$TMP"
if [ -n "$PELIGRO" ]; then
  echo "GUARDIA: hay cambios NO esperados (drift del editor GAS). Revisá antes de pushear:"; printf '%s\n' "$PELIGRO"; exit 2
fi
echo "GUARDIA: OK (solo difieren los 7 archivos de B5 y/o local-only inofensivo)"

if git ls-files -z | xargs -0 grep -InE "sk-[A-Za-z0-9]{16,}|BEGIN (RSA|OPENSSH|PRIVATE)|xox[baprs]-" 2>/dev/null | grep -v '\.example'; then
  echo "ABORT: posible secreto en trackeado"; exit 3; fi
echo "secret-scan: limpio"

echo "== git status =="; git status -s
if [ "$GO" != "--go" ]; then echo ""; echo "Read-only OK. Para EJECUTAR: bash _b5_code.sh --go"; exit 0; fi

echo "== EJECUTANDO --go =="
git add src/07_util.js src/13_agentes.js src/15_cerebro.js src/14_director.js src/08_webapp.js src/17_bandeja.js src/20_killswitch.js \
        CAPABILITIES.md _capabilities_gen.sh PURGA-SISTEMA-B5-2026-07-06.md PAQUETE-CODE-B5-2026-07-06.md _b5_code.sh HANDOFF.md .claude/settings.local.json 2>/dev/null
if git diff --cached --quiet; then echo "nada nuevo para commitear — sigo al clasp push"; else
  git commit -m "B5 remediacion: O(n2) cerebro (snap batch) + guard anti-inyeccion Bandeja + sanitizar \\t\\r\\n + nextId defensivo + lock consumo agentes + kill switch total en pausa; CAPABILITIES.md autogenerado + purga sistema" || { echo "ABORT: commit fallo"; exit 4; }
  echo "commit OK"; fi

echo "clasp push..."; clasp push -f || { echo "ABORT: clasp push fallo"; exit 5; }
echo "clasp push OK — HEAD de GAS con los 6 fixes."

echo "push a GitHub (off-Mac)..."; git push origin HEAD 2>/dev/null && echo "push a GitHub OK" || echo "push a GitHub pendiente (auth). El commit local ya esta a salvo; corré: git push origin HEAD"

echo "== B5 Code LISTO. AHORA (Luciano, editor): selfTest() debe dar TODO OK (gate). Para el #7: promover version nueva al deployment de VOZ. =="
