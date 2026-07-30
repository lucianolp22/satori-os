#!/usr/bin/env bash
# _tanda_T2_2026-07-30.sh — cierre de la tanda T2 (dinámica de Sato) · 30-jul-2026
# T2.1 cierre de sesión hablado · T2.2 acción con confirmación · T2.3 arranque del día ·
# T2.4 memoria que frena. Verifica en local, chequea que el editor GAS no tenga ediciones
# desconocidas, commitea POR LISTA EXPLÍCITA (regla: jamás -A), pushea y sube a /dev.
# NO toca /exec (el promote es _promote_exec.sh, paso aparte).
#
# USO:
#   bash _tanda_T2_2026-07-30.sh          -> DRY RUN: chequea todo, no toca nada
#   bash _tanda_T2_2026-07-30.sh --go     -> commit + push + clasp push a /dev
set -u

REPO="$HOME/Documents/Claude/Projects/SatoriOS"
BASE_ESPERADO="57d6885"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
[ "$(git branch --show-current)" = "main" ] || { echo "ABORT: no estoy en main"; exit 1; }
BASE="$(git rev-parse --short HEAD)"
echo "HEAD actual: $BASE (esperado $BASE_ESPERADO)"
[ "$BASE" = "$BASE_ESPERADO" ] || { echo "ABORT: HEAD no es $BASE_ESPERADO — hay commits que esta tanda no conoce; avisar a Cowork antes de seguir"; exit 1; }

# El puente de Cowork no puede borrar: si quedo un lock huerfano, lo saco yo (que si puedo).
for L in .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock; do
  if [ -f "$L" ] && ! pgrep -x git >/dev/null 2>&1; then rm -f "$L"; echo "lock huerfano removido: $L"; fi
done

ARCHIVOS_TANDA=(
  "src/26_sato.js"
  "src/22_seguridad.js"
  "src/index.html"
  "_harness.js"
  "CAPABILITIES.md"
  "_tanda_T2_2026-07-30.sh"
)
for f in "${ARCHIVOS_TANDA[@]}"; do
  [ -f "$f" ] || { echo "ABORT: falta $f (¿Cowork no lo escribió al Mac?)"; exit 1; }
done
echo "los ${#ARCHIVOS_TANDA[@]} archivos de la tanda presentes: OK"

# Avatares nuevos sin trackear (28-jul, siguen sueltos): entran si existen.
EXTRAS=()
[ -f "Avatares Satori/Cazador Físico.png" ] && EXTRAS+=("Avatares Satori/Cazador Físico.png")
[ -f "Avatares Satori/Vigía.png" ] && EXTRAS+=("Avatares Satori/Vigía.png")
echo "avatares extra a incluir: ${#EXTRAS[@]}"

echo ""
echo "== VERIFICACION LOCAL =="
command -v node >/dev/null || { echo "ABORT: node no esta en PATH"; exit 1; }
node --check src/26_sato.js     || { echo "ABORT: sintaxis 26_sato.js"; exit 1; }
node --check src/22_seguridad.js || { echo "ABORT: sintaxis 22_seguridad.js"; exit 1; }
node _harness.js > /tmp/_h_T2.log 2>&1 || { echo "ABORT: el harness FALLA:"; tail -8 /tmp/_h_T2.log; exit 1; }
tail -1 /tmp/_h_T2.log
# El JS de index.html se chequea entero (un ; de mas deja el CM mudo y clasp no avisa).
# Sin python3 no se aborta: Cowork ya lo verifico (divs 404/404 + node --check) y frenar
# la tanda por una herramienta ausente seria peor que seguir con la verificacion de origen.
if ! command -v python3 >/dev/null; then
  echo "AVISO: sin python3 — salteo la verificacion estructural de index.html (verificada en Cowork)"
else
python3 - <<'PY' || { echo "ABORT: index.html no pasa la verificacion estructural"; exit 1; }
import re, subprocess, sys, tempfile, os
h = open('src/index.html', encoding='utf-8').read()
ab, cl = len(re.findall(r'<div\b', h)), h.count('</div>')
if ab != cl:
    print('divs desbalanceados: %d abren / %d cierran' % (ab, cl)); sys.exit(1)
# Los comentarios HTML se sacan ANTES de buscar <script>: index.html tiene un comentario que
# menciona "<script>" y buscarlo por offset engancha ESE (el falso ABORT del 30-jul).
sin = re.sub(r'<!--.*?-->', '', h, flags=re.S)
bloques = re.findall(r'<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>', sin, flags=re.S)
if not bloques:
    print('no encontre ningun bloque <script> inline'); sys.exit(1)
p = os.path.join(tempfile.gettempdir(), '_idx_T2.js')
for i, js in enumerate(bloques):
    open(p, 'w', encoding='utf-8').write(js)
    if subprocess.run(['node', '--check', p]).returncode:
        print('el bloque <script> #%d de index.html no compila' % (i + 1)); sys.exit(1)
print('index.html OK: divs %d/%d + %d bloque(s) JS compilan (%d chars)'
      % (ab, cl, len(bloques), sum(len(b) for b in bloques)))
PY
fi

echo ""
echo "== GUARDIA DE DRIFT: GAS HEAD vs lo ULTIMO que subimos =="
# Ojo con el criterio: el ultimo `clasp push` subio el WORKING TREE (T1.7 quedo en /dev sin
# commitear), asi que comparar contra el commit base daria falso positivo en index.html.
# Se compara GAS contra el working tree, SALTEANDO los archivos de esta tanda (esos los
# vamos a reemplazar a proposito). Si algo mas difiere: alguien edito en el editor web.
command -v clasp >/dev/null || { echo "ABORT: clasp no esta en PATH"; exit 1; }
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
[ -n "$SCRIPT_ID" ] || { echo "ABORT: no pude leer scriptId de .clasp.json"; exit 1; }
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull de verificacion fallo. Si dice invalid_rapt: clasp logout && clasp login"; rm -rf _gascheck_tmp; exit 1; }

PROBLEMA=""
for f in _gascheck_tmp/pull/*; do
  b="$(basename "$f")"
  [ "$b" = "appsscript.json" ] && continue                      # clasp lo reescribe solo
  EN_TANDA=0
  for t in "${ARCHIVOS_TANDA[@]}"; do [ "src/$b" = "$t" ] && EN_TANDA=1; done
  [ $EN_TANDA -eq 1 ] && continue
  if [ -f "src/$b" ]; then
    diff -q "src/$b" "$f" >/dev/null 2>&1 || PROBLEMA="$PROBLEMA $b(difiere)"
  else
    PROBLEMA="$PROBLEMA $b(nuevo-en-GAS)"
  fi
done
while IFS= read -r f; do
  b="${f#src/}"
  [ -f "_gascheck_tmp/pull/$b" ] || PROBLEMA="$PROBLEMA $b(falta-en-GAS)"
done < <(git ls-files src/ | grep -v appsscript.json)
rm -rf _gascheck_tmp
if [ -n "$PROBLEMA" ]; then
  echo "ABORT: el editor GAS tiene ediciones que el repo no conoce — NO pisar:"
  echo "  $PROBLEMA"
  exit 1
fi
echo "GAS == working tree (fuera de la tanda): OK (nadie edito en el editor web)"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK — nada tocado =="
  echo "Con --go va a hacer:"
  echo "  1. git add de los ${#ARCHIVOS_TANDA[@]} archivos de la tanda + ${#EXTRAS[@]} avatares (lista explicita)"
  echo "  2. git commit (T2: cierre de sesion + accion con confirmacion + arranque + memoria que frena)"
  echo "  3. git push origin main"
  echo "  4. clasp push a /dev (HEAD; /exec @33 queda intocado hasta el promote)"
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
  git commit -m "T2 dinamica de Sato: cierre de sesion hablado (propone, tildas, registra) + accion con confirmacion + arranque del dia con el brief real + memoria que frena (historial/descartado); harness 213/0 con 5 asserts de aislamiento nuevos" \
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
  echo "clasp push OK — /dev ya sirve T2. /exec @33 INTOCADO."
else
  echo "ABORT: clasp push fallo. Si dice invalid_rapt: clasp logout && clasp login y reintentar SOLO este paso: clasp push -f"
  exit 4
fi

echo ""
echo "== LISTO =="
echo "Siguiente: 1) selfTest() en el editor GAS (tiene que dar 585/0)"
echo "           2) eyeball en /dev: abrir una Ficha, hablarle a Sato, probar '☀ mi dia' y '✓ cerrar sesion'"
echo "           3) bash _promote_exec.sh --go   (promote a @34 — prod esta en @33, atrasada)"
