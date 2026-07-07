#!/usr/bin/env bash
# _promote_exec.sh — B0: commit de B0.5 + promocion del rediseno CM+Voz a /exec (prod)
# Cierra 0.1 y 0.2 del PLAN-ACCION-INTEGRAL-SatoriOS-2026-07-06 (mismo deployment: GAS_VOZ_URL lo confirma).
#
# USO:
#   bash _promote_exec.sh          -> DRY RUN: chequea precondiciones, no toca nada
#   bash _promote_exec.sh --go     -> ejecuta commit + deploy + verificacion
#
# ROLLBACK (si algo se ve mal en /exec despues):
#   clasp deploy -i "$DEPLOY_ID" -V NUMERO_DE_VERSION_ANTERIOR
#   La version anterior queda impresa y guardada en _promote_rollback.txt antes de deployar.
set -u

REPO="$HOME/Documents/Claude/Projects/SatoriOS"
DEPLOY_ID="AKfycbxZJL4E_t8qpIP5tFaEBJKxjZX_z3KyelUQ_Om4EJDiSU90v3u0-UbAPnD-V7ubphLm"
EXEC_URL="https://script.google.com/a/macros/satoriconsultoria.com/s/$DEPLOY_ID/exec"

cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="

if [ -f .git/index.lock ]; then
  if pgrep -x git >/dev/null 2>&1; then
    echo "ABORT: hay un proceso git corriendo Y existe index.lock — esperar a que termine y reintentar"
    exit 1
  fi
  echo "index.lock huerfano detectado sin git corriendo -> lo remuevo"
  rm -f .git/index.lock
fi

RAMA="$(git branch --show-current)"
[ "$RAMA" = "main" ] || { echo "ABORT: rama actual es '$RAMA', esperaba main"; exit 1; }

for f in CLAUDE.md PIPELINE-SatoriOS.md docs/CRITERIO-arquitectura-agentes.md _hooks/pre-push _install_hooks.sh _capabilities_gen.sh; do
  [ -f "$f" ] || { echo "ABORT: falta $f (lo creaba Cowork; revisar)"; exit 1; }
done
echo "archivos de B0.5 presentes: OK"

command -v clasp >/dev/null || { echo "ABORT: clasp no esta en PATH"; exit 1; }

echo "listando deployments (esto tambien valida el login de clasp)..."
DEPLOYS="$(clasp deployments 2>&1)" || { echo "ABORT: clasp deployments fallo. Si dice invalid_rapt: clasp logout && clasp login"; echo "$DEPLOYS"; exit 1; }
echo "$DEPLOYS"
echo "$DEPLOYS" | grep -q "$DEPLOY_ID" || { echo "ABORT: el deployment prod $DEPLOY_ID no aparece en la lista"; exit 1; }
LINEA_PROD="$(echo "$DEPLOYS" | grep "$DEPLOY_ID" | head -1)"
echo "deployment prod actual: $LINEA_PROD"
echo "$LINEA_PROD" > _promote_rollback.txt
echo "(guardado en _promote_rollback.txt para rollback)"

VOZ_ID="$(grep -h '^GAS_VOZ_URL=' voz/agent/.env.local 2>/dev/null | grep -oE 'AKfycb[A-Za-z0-9_-]+' | head -1)"
if [ -n "${VOZ_ID:-}" ] && [ "$VOZ_ID" = "$DEPLOY_ID" ]; then
  echo "GAS_VOZ_URL apunta al MISMO deployment: la promocion tambien activa el kill-switch #7 en voz (0.2 incluido): OK"
else
  echo "AVISO: GAS_VOZ_URL apunta a OTRO deployment (${VOZ_ID:-vacio}). Promover ese aparte con: clasp deploy -i ESE_ID"
fi

echo ""
echo "== GUARDIA: GAS HEAD debe ser identico a src/ (regla 30-jun) =="
rm -rf _gascheck_tmp
mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull de verificacion fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
PROBLEMA="$(echo "$DIFFOUT" | grep -E 'differ$|Only in .*_gascheck_tmp' || true)"
if [ -n "$PROBLEMA" ]; then
  echo "ABORT: GAS HEAD difiere del repo. NO se crea version hasta resolver:"
  echo "$PROBLEMA"
  rm -rf _gascheck_tmp
  exit 1
fi
echo "GAS HEAD == src/ (los Only-in-src son local-only tipo .bak, ignorados): OK"
rm -rf _gascheck_tmp

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK — nada tocado =="
  echo "Con --go va a hacer:"
  echo "  1. instalar hook pre-push (drift-checker CAPABILITIES)"
  echo "  2. regenerar CAPABILITIES.md (hoy esta stale: falta _filaConsumoCore_ de B5)"
  echo "  3. commit: B0.5 completo + HANDOFF post-eyeball + fix guardia b3"
  echo "  4. clasp deploy -i (promueve version nueva a /exec: CM + voz/kill-switch #7)"
  echo "  5. git push a GitHub (si falla auth, no bloquea; queda instruido)"
  exit 0
fi

echo ""
echo "== EJECUTANDO --go =="

echo "-- 1/5 hook pre-push"
bash _install_hooks.sh || { echo "ABORT: no se pudo instalar el hook"; exit 2; }

echo "-- 2/5 regenerar CAPABILITIES.md"
bash _capabilities_gen.sh || { echo "ABORT: fallo la regeneracion de CAPABILITIES"; exit 3; }

echo "-- 3/5 commit"
git add CLAUDE.md PIPELINE-SatoriOS.md docs/CRITERIO-arquitectura-agentes.md _hooks/pre-push _install_hooks.sh _promote_exec.sh CAPABILITIES.md HANDOFF.md _b3_code.sh
if git diff --cached --quiet; then
  echo "nada nuevo para commitear — sigo"
else
  git commit -m "B0.5: CLAUDE.md raiz plantado + PIPELINE al repo + criterio arquitectura agentes + drift-checker pre-push; CAPABILITIES regen (_filaConsumoCore_); HANDOFF post-eyeball; fix guardia b3" || { echo "ABORT: git commit fallo"; exit 4; }
  echo "commit OK"
fi

echo "-- 4/5 promocion a /exec"
if ! clasp deploy -i "$DEPLOY_ID" -d "Rediseno CM+Voz zen-futurista + B5 fixes + kill-switch total (06-jul)"; then
  echo "ABORT: clasp deploy fallo — prod sigue en la version anterior (sin cambios)."
  echo "Alternativa manual por editor: script.google.com -> abrir MAESTRO -> Implementar -> Administrar implementaciones -> lapiz sobre el deployment prod -> Version: Nueva version -> Implementar"
  exit 5
fi
echo "deploy OK — deployments ahora:"
clasp deployments | grep "$DEPLOY_ID"

echo "-- 5/5 git push"
if GIT_TERMINAL_PROMPT=0 git push origin main; then
  echo "push OK"
else
  echo "AVISO: git push fallo (auth). El deploy a prod YA quedo hecho. Push manual con tu PAT:"
  echo "  git push https://lucianolp22:TU_TOKEN@github.com/lucianolp22/satori-os.git main"
fi

echo ""
echo "== VERIFICACION FINAL (manual, 2 minutos) =="
echo "1. Abri en el navegador (como luciano@):"
echo "   $EXEC_URL"
echo "   Chequea el rediseno: isologo horizontal, boton voz terracota, sin Modo calma ni luna ni Calidad."
echo "2. Proba la voz 30 segundos (di: hola Sato, dame el brief). Si NO responde:"
echo "   rollback -> clasp deploy -i $DEPLOY_ID -V VERSION_ANTERIOR"
echo "   La version anterior esta en _promote_rollback.txt"
echo "LISTO."
