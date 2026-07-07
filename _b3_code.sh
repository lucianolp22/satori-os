#!/usr/bin/env bash
# _b3_code.sh — Cierre B3 lado Code (git + clasp + remoto privado). Corre en el Mac.
# Reescrito tras el primer --go: el `clasp push` entró (el módulo ya está en GAS) pero
# el `git commit` NO (probable .git/index.lock de otro proceso git; el 2>/dev/null lo tapó).
# Este script: chequea el lock, guardia informativa, commit VISIBLE, clasp push (idempotente),
# y push al remoto privado de GitHub.
#
# Uso:
#   bash _b3_code.sh        -> guardia + preview (read-only, no toca nada)
#   bash _b3_code.sh --go   -> commit + clasp push + push a GitHub
set -u

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO" || { echo "no pude cd al repo"; exit 1; }
GO="${1:-}"
REMOTE_URL="https://github.com/lucianolp22/satori-os.git"
EXPECTED='21_backup\.js|99_tmp_b2\.js'   # únicos archivos que DEBEN diferir/aparecer

echo "== B3 Code — repo: $REPO =="

# 1. Precondiciones
[ -d .git ] || { echo "ABORT: no es un repo git"; exit 1; }
[ -f src/21_backup.js ] || { echo "ABORT: falta src/21_backup.js"; exit 1; }
command -v clasp >/dev/null 2>&1 || { echo "ABORT: clasp no instalado"; exit 1; }
node --check src/21_backup.js || { echo "ABORT: src/21_backup.js no compila"; exit 1; }

# 2. Lock de git (causa probable del commit fallido en el primer --go)
if [ -f .git/index.lock ]; then
  echo "ABORT: existe .git/index.lock — hay otro proceso git activo (¿Claude Code abierto sobre el repo?)."
  echo "  Cerrá ese proceso; si estás seguro de que no hay ninguno, borrá el lock con: rm .git/index.lock  y reintentá."
  exit 1
fi

# 3. Guardia diff GAS<->working tree (informativa; aborta si difiere algo NO esperado)
TMP="$(mktemp -d)"
cp .clasp.json "$TMP/.clasp.json" 2>/dev/null || { echo "ABORT: sin .clasp.json"; rm -rf "$TMP"; exit 1; }
echo "guardia: bajando HEAD de GAS para diff..."
( cd "$TMP" && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull falló (revisá clasp login)"; rm -rf "$TMP"; exit 1; }
[ -f "$TMP/src/07_util.js" ] || { echo "ABORT: guardia inconclusa — clasp pull no trajo el HEAD"; rm -rf "$TMP"; exit 1; }

DIFF="$(diff -rq src "$TMP/src" 2>/dev/null)"
echo "--- diff working<->GAS ---"; printf '%s\n' "${DIFF:-sin diferencias}"; echo "--------------------------"
# Peligro REAL = solo lo destructivo/ajeno: (a) 'differ' de un archivo que no íbamos a tocar;
#   (b) 'Only in <GAS>/src' = archivo que está en GAS y NO en local → el push lo BORRARÍA.
# NO es peligro 'Only in src:' = archivo local que no está en GAS (el push a lo sumo lo agrega;
#   y los no-pusheables como *.bak/index.html.bak clasp los ignora). Se excluyen + los EXPECTED.
PELIGRO="$(printf '%s\n' "$DIFF" | grep -E 'differ|^Only in ' | grep -vE '^Only in src:' | grep -vE "$EXPECTED" || true)"
rm -rf "$TMP"
if [ -n "$PELIGRO" ]; then
  echo "GUARDIA: hay cambios NO esperados (posible drift del editor GAS). Revisá antes de pushear:"
  printf '%s\n' "$PELIGRO"
  exit 2
fi
echo "GUARDIA: OK (lo único que difiere es local-only inofensivo o nuestro cambio esperado)"

# 4. Secret-scan de trackeados (antes del push al remoto)
if git ls-files -z | xargs -0 grep -InE "sk-[A-Za-z0-9]{16,}|BEGIN (RSA|OPENSSH|PRIVATE)|xox[baprs]-" 2>/dev/null | grep -v '\.example'; then
  echo "ABORT: posible secreto en un archivo trackeado — revisar antes de pushear"; exit 3
fi
echo "secret-scan: limpio"

echo "== git status =="; git status -s
if [ "$GO" != "--go" ]; then
  echo ""; echo "Read-only OK. Para EJECUTAR: bash _b3_code.sh --go"; exit 0
fi

# 5. Ejecutar (--go): commit VISIBLE primero
echo "== EJECUTANDO --go =="
[ -f src/99_tmp_b2.js ] && { rm -f src/99_tmp_b2.js; echo "temporal B2 borrado"; }

git add src/21_backup.js docs/EJEMPLO-CLAUDE-cliente-DEMO.md HANDOFF.md RUNBOOK-recuperacion-total.md PAQUETE-CODE-B3-backup-2026-07-03.md _b3_code.sh .claude/settings.local.json
if git diff --cached --quiet; then
  echo "nada nuevo para commitear (ya estaba commiteado) — sigo al clasp push + remoto"
else
  git commit -m "B3 backup: 21_backup.js (backup semanal Drive + restore drill + smoke + logs editor) + runbook recuperacion total; limpia temporal B2; docs DEMO/HANDOFF" || { echo "ABORT: git commit falló — mirá el error de arriba (lock / identidad / hook)."; exit 4; }
  echo "commit OK"
fi

echo "clasp push..."; clasp push -f || { echo "ABORT: clasp push falló"; exit 5; }
echo "clasp push OK (GAS HEAD queda con 21_backup.js v2 y sin el temporal)"

# 6. Remoto privado (código off-Mac)
if git remote | grep -q '^origin$'; then
  echo "origin ya existe: $(git remote get-url origin)"
else
  git remote add origin "$REMOTE_URL"; echo "origin agregado: $REMOTE_URL"
fi
echo "push al remoto privado..."
git push -u origin HEAD && echo "push a GitHub OK — código respaldado off-Mac" || echo "push a GitHub falló (probable AUTH: corré 'gh auth login' o usá un PAT). El commit LOCAL ya está a salvo; reintentá el push."

echo "== B3 Code LISTO. Prod webapp @15 NO cambia (backup = editor+trigger sobre HEAD). =="
