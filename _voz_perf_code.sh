#!/usr/bin/env bash
# _voz_perf_code.sh — SPEC-GAS brief lento + dieta del feed + polling (14-jul-2026).
#   1) 08_webapp.js: instrumenta el doPost de voz (console.log voz-timing tool/ms) para medir
#      el tiempo server REAL por tool (separa overhead doPost del render).
#   2) 18_direccion.js: briefCacheado_ = cache corto (CacheService, TTL 600s) del brief para la VOZ
#      -> el render caro (estadoSalud 6 chequeos + Tareas) deja de colgar el doPost 24-31s. Read-only,
#      solo TTL, sin invalidacion. La ruta de voz (case 'brief') pasa por el cache; el resto llama directo.
#      + calentarBriefCacheSistema_ al CIERRE de corridaDiaria (06_avisos.js, TTL 6h) -> el brief de la
#      manana es HIT instantaneo. + verifBriefCache_ (editor): 2 llamadas, mide render(miss) vs cache(hit).
#   3) 08_webapp.js: feedReciente_ trunca el texto del feed a 240 chars (celdas de Actividad gigantes
#      = salidas de agentes). Ya leia solo las ultimas N filas (no la hoja entera).
#   4) index.html: polling del CM (refrescarCentro/estadoAgentes) 5s -> 15s -> baja la tormenta de
#      polling que contendia con el doPost de voz (estadoAgentes tardaba 5-7s @ ~100% duty).
# NO incluido (requiere OK aparte, cambia numeros visibles): podar/archivar Cola_tareas o acotar su
#   lectura completa en estadoAgentes = el read pesado real de "857 filas" (toca telemetria/estado agente).
# USO: bash _voz_perf_code.sh  (dry-run)  |  bash _voz_perf_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (cambios en el working tree) =="
grep -q "function briefCacheado_" src/18_direccion.js || { echo "ABORT: falta briefCacheado_"; exit 1; }
grep -q "brief_v1_" src/18_direccion.js               || { echo "ABORT: falta la clave de cache brief_v1_"; exit 1; }
grep -q "CacheService.getScriptCache" src/18_direccion.js || { echo "ABORT: briefCacheado_ no usa CacheService"; exit 1; }
grep -q "try { hit = cache.get(key)" src/18_direccion.js || { echo "ABORT: el get del cache no esta endurecido (try/catch)"; exit 1; }
grep -q "_BRIEF_CACHE_TTL = 600" src/18_direccion.js  || { echo "ABORT: TTL de voz no quedo en 600"; exit 1; }
grep -q "function calentarBriefCacheSistema_" src/18_direccion.js || { echo "ABORT: falta el warm calentarBriefCacheSistema_"; exit 1; }
grep -q "_BRIEF_CACHE_TTL_WARM = 21600" src/18_direccion.js || { echo "ABORT: TTL warm no quedo en 21600"; exit 1; }
grep -q "function verifBriefCache_" src/18_direccion.js || { echo "ABORT: falta verifBriefCache_"; exit 1; }
grep -q "calentarBriefCacheSistema_()" src/06_avisos.js || { echo "ABORT: corridaDiaria no calienta el cache"; exit 1; }
grep -q "briefCacheado_(id || undefined)" src/08_webapp.js || { echo "ABORT: el dispatch de voz no usa briefCacheado_"; exit 1; }
grep -q "voz-timing tool=" src/08_webapp.js           || { echo "ABORT: falta la instrumentacion voz-timing"; exit 1; }
grep -q "_FEED_TEXTO_LIM" src/08_webapp.js            || { echo "ABORT: falta el truncado del feed"; exit 1; }
grep -q "refrescarCentro();},15000)" src/index.html   || { echo "ABORT: el polling del CM no quedo en 15s"; exit 1; }
if command -v node >/dev/null 2>&1; then
  node --check src/08_webapp.js   || { echo "ABORT: sintaxis webapp"; exit 1; }
  node --check src/18_direccion.js || { echo "ABORT: sintaxis direccion"; exit 1; }
  node --check src/06_avisos.js    || { echo "ABORT: sintaxis avisos"; exit 1; }
  node -e "
const fs=require('fs');
let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
fs.writeFileSync('/tmp/cm_vozperf.js',m.map(x=>x[1]).join('\n;\n'));
" && node --check /tmp/cm_vozperf.js || { echo "ABORT: sintaxis script del index"; exit 1; }
  echo "sintaxis OK (3 js + index)"
fi
echo "PRE-CONDICIONES OK"

echo "== GUARDIA: diff repo vs GAS HEAD (solo cambia lo esperado) =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo (auth? invalid_rapt -> clasp logout && clasp login)"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="06_avisos.js 08_webapp.js 18_direccion.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar (hay diffs no esperados vs GAS HEAD)"; exit 1; }
echo "difieren (esperados): ${DIFIEREN:-<ninguno: repo ya == GAS?>}"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit + clasp push + git push (a /dev/HEAD) =="
  echo "   Prod (/exec: voz doPost + CM) recien toma el cambio al promover: bash _promote_exec.sh --go"
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/06_avisos.js src/08_webapp.js src/18_direccion.js src/index.html CAPABILITIES.md HANDOFF.md \
        SPEC-GAS-brief-lento-doPost-2026-07-14.md _voz_perf_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "voz/CM perf: cache del brief (CacheService 600s + warm 6h en corridaDiaria) + instrumentacion doPost + dieta del feed (truncado 240) + polling CM 5s->15s

SPEC-GAS brief-lento (incidente 08:22, doPost brief 24-31s bajo contencion del polling del CM).
briefCacheado_ evita el render pesado (estadoSalud+Tareas) por consulta de voz; read-only, solo TTL.
corridaDiaria calienta el cache de SISTEMA (TTL 6h) -> el brief de la manana es HIT instantaneo.
feedReciente_ ya leia solo N filas; ahora trunca el texto. Polling CM a 15s baja la tormenta.
No toca la lectura completa de Cola_tareas (857 filas) = read pesado real, propuesto aparte (spec).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> selfTest() -> TODO OK (sin asserts nuevos; cambios de perf)."
echo "2. Editor GAS -> verifBriefCache_() -> loguea render(miss)=Ns  cache(hit)=<1s (antes/despues medido)."
echo "3. CM /dev recarga dura -> el feed carga; el polling ahora es cada 15s (Network cada 15s, no 5s)."
echo "4. Voz (post-promote): 'el brief del dia' -> responde rapido; en Executions, log 'voz-timing tool=brief ms=...' cae bajo tras el 1er cache."
echo "5. Si aprueba -> bash _promote_exec.sh --go promueve /exec (voz doPost + CM toman el cambio en prod)."
echo "LISTO."
