#!/usr/bin/env bash
# _tanda_f360_2026-07-28.sh — cierre de la tanda T1 (Ficha de Cliente 360) · 28-jul-2026
# Qué hace: verifica la tanda en local, chequea que el editor GAS no tenga ediciones
# desconocidas, commitea POR LISTA EXPLÍCITA (regla: jamás -A), pushea a GitHub y
# sube a /dev con clasp. NO toca /exec (el promote es _promote_exec.sh, paso aparte).
#
# USO:
#   bash _tanda_f360_2026-07-28.sh          -> DRY RUN: chequea todo, no toca nada
#   bash _tanda_f360_2026-07-28.sh --go     -> ejecuta commit + push + clasp push
set -u

REPO="$HOME/Documents/Claude/Projects/SatoriOS"
BASE_ESPERADO="4e14443"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
[ "$(git branch --show-current)" = "main" ] || { echo "ABORT: no estoy en main"; exit 1; }
BASE="$(git rev-parse --short HEAD)"
echo "HEAD actual: $BASE (esperado $BASE_ESPERADO)"
[ "$BASE" = "$BASE_ESPERADO" ] || { echo "ABORT: HEAD no es $BASE_ESPERADO — hay commits que esta tanda no conoce; avisar a Cowork antes de seguir"; exit 1; }

if [ -f .git/index.lock ] && ! pgrep -x git >/dev/null 2>&1; then
  rm -f .git/index.lock; echo "index.lock huerfano removido"
fi

ARCHIVOS_TANDA=(
  "src/08_webapp.js"
  "src/22_seguridad.js"
  "src/index.html"
  "_harness.js"
  "_promote_exec.sh"
  "HANDOFF.md"
  "entregables/Tablero-Reunion-LCTravel-2026-07-28.html"
  "_tanda_f360_2026-07-28.sh"
)
for f in "${ARCHIVOS_TANDA[@]}"; do
  [ -f "$f" ] || { echo "ABORT: falta $f (¿Cowork no lo escribió al Mac?)"; exit 1; }
done
echo "los ${#ARCHIVOS_TANDA[@]} archivos de la tanda presentes: OK"

# Avatares nuevos sin trackear (28-jul): entran si existen, no abortan si no.
EXTRAS=()
[ -f "Avatares Satori/Cazador Físico.png" ] && EXTRAS+=("Avatares Satori/Cazador Físico.png")
[ -f "Avatares Satori/Vigía.png" ] && EXTRAS+=("Avatares Satori/Vigía.png")
echo "avatares extra a incluir: ${#EXTRAS[@]}"

echo ""
echo "== VERIFICACION LOCAL =="
command -v node >/dev/null || { echo "ABORT: node no esta en PATH"; exit 1; }
node --check src/08_webapp.js || { echo "ABORT: sintaxis 08_webapp.js"; exit 1; }
node --check src/22_seguridad.js || { echo "ABORT: sintaxis 22_seguridad.js"; exit 1; }
node _harness.js > /tmp/_h_f360.log 2>&1 || { echo "ABORT: el harness FALLA:"; tail -8 /tmp/_h_f360.log; exit 1; }
tail -1 /tmp/_h_f360.log

echo ""
echo "== GUARDIA DE DRIFT: GAS HEAD vs commit base ($BASE_ESPERADO) =="
# GAS quedo identico al repo el 27-jul. Si el pull difiere del commit base, alguien
# edito en el editor web y un clasp push lo PISARIA -> ABORT. Sin stash: se compara
# el pull contra los blobs del commit, sin tocar el working tree.
command -v clasp >/dev/null || { echo "ABORT: clasp no esta en PATH"; exit 1; }
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
[ -n "$SCRIPT_ID" ] || { echo "ABORT: no pude leer scriptId de .clasp.json"; exit 1; }
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull de verificacion fallo. Si dice invalid_rapt: clasp logout && clasp login"; rm -rf _gascheck_tmp; exit 1; }

PROBLEMA=""
for f in _gascheck_tmp/pull/*; do
  b="$(basename "$f")"
  if git cat-file -e "$BASE_ESPERADO:src/$b" 2>/dev/null; then
    git show "$BASE_ESPERADO:src/$b" | diff -q - "$f" >/dev/null 2>&1 || PROBLEMA="$PROBLEMA $b(difiere)"
  else
    PROBLEMA="$PROBLEMA $b(nuevo-en-GAS)"
  fi
done
while IFS= read -r f; do
  b="${f#src/}"
  [ -f "_gascheck_tmp/pull/$b" ] || PROBLEMA="$PROBLEMA $b(falta-en-GAS)"
done < <(git ls-tree --name-only "$BASE_ESPERADO" -- src/)
rm -rf _gascheck_tmp
if [ -n "$PROBLEMA" ]; then
  echo "ABORT: el editor GAS tiene ediciones que el repo no conoce — NO pisar:"
  echo "  $PROBLEMA"
  exit 1
fi
echo "GAS HEAD == commit base: OK (nadie edito en el editor web)"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK — nada tocado =="
  echo "Con --go va a hacer:"
  echo "  1. git add de los ${#ARCHIVOS_TANDA[@]} archivos de la tanda + ${#EXTRAS[@]} avatares (lista explicita)"
  echo "  2. git commit (Ficha 360 + purga + harness 107/0 + fix promote + tablero LC)"
  echo "  3. git push origin main"
  echo "  4. clasp push a /dev (HEAD; /exec @32 queda intocado)"
  exit 0
fi

echo ""
echo "== EJECUTANDO --go =="
echo "-- 1/4 git add (lista explicita)"
git add "${ARCHIVOS_TANDA[@]}" || { echo "ABORT: git add fallo"; exit 2; }
[ ${#EXTRAS[@]} -gt 0 ] && { git add "${EXTRAS[@]}" || { echo "ABORT: git add avatares fallo"; exit 2; }; }

echo "-- 2/4 git commit"
if git diff --cached --quiet; then
  echo "nada nuevo para commitear — sigo"
else
  git commit -m "Ficha de Cliente 360 (T1): fichaCliente gateado + overlay F360 con 4 accesos + Hilo columna entera; purga 28-jul (columnas reales del espejo); harness 107/0; fix label promote; tablero reunion LC Travel; HANDOFF 28-jul" \
    || { echo "ABORT: git commit fallo"; exit 3; }
  echo "commit OK: $(git rev-parse --short HEAD)"
fi

echo "-- 3/4 git push"
if GIT_TERMINAL_PROMPT=0 git push origin main; then
  echo "push OK"
else
  echo "AVISO: git push fallo (auth) — el commit LOCAL quedo hecho. Push manual con tu PAT:"
  echo "  git push https://lucianolp22:TU_TOKEN@github.com/lucianolp22/satori-os.git main"
fi

echo "-- 4/4 clasp push a /dev"
git checkout -- src/appsscript.json 2>/dev/null || true
if clasp push -f; then
  echo "clasp push OK — /dev ya sirve la Ficha 360. /exec @32 INTOCADO."
else
  echo "ABORT: clasp push fallo. Si dice invalid_rapt: clasp logout && clasp login y reintentar SOLO este paso: clasp push -f"
  exit 4
fi

echo ""
echo "== LISTO =="
echo "Siguiente (HANDOFF paso 2-4): selfTest en el editor -> eyeball de la Ficha en /dev -> bash _promote_exec.sh --go"
