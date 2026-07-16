#!/usr/bin/env bash
# _voz_acciones_code.sh — La voz ACTÚA (16-jul-2026). ENCARGO-CODE-voz-acciones.
#  P1 North Star propio: sembrarNorthStarSatori_ (18_direccion.js) — FUENTE ÚNICA = Config. Decisión de
#     Luciano 16-jul: NO se duplica en CLI-000/objetivos (ya vivía en Config y el brief F2 ya lo renderiza).
#  P2 Acciones con aprobación (08_webapp.js + 11_aprobaciones.js): tool `accion` → ACCIONES_VOZ (whitelist
#     dura, v1 = solo crear_objetivo) → crea Aprobación P1 tipada (NO escribe directo) → al aprobar,
#     ejecutarCrearObjetivo_ materializa. Con Dirección vigente (F2) → auto-aprueba y ejecuta en el turno.
#     *** FRONTERA DE CONFIANZA (el chequeo cruzado de correrAgente_ DISPARÓ) ***
#     La voz escribiendo objetivos.descripcion abre: objetivos → correrDirector (14_director.js:49) →
#     analista, que mete `pregunta` CRUDA en el prompt del LLM (13_agentes.js:173-177) — y GUARDIA_INYECCION
#     encima bendice todo "pedido fuera de los marcadores". El Director solo encola si hay `metrica`, así
#     que `metrica` se fuerza VACÍA en 2 capas (whitelist de campos del doPost + el ejecutor) → un objetivo
#     dictado por voz NUNCA alcanza correrAgente_. Completar `metrica` a mano = el acto humano que restaura
#     el first-party. Para permitir `metrica` desde voz el prerequisito es sanear+de-privilegiar la pregunta
#     en GUARDIA_INYECCION (Etapa 3, anotado en el HANDOFF) — no se improvisa.
#  P3 North Star en el CM: estadoAgentes.north_star + card cmNS (oculta si no hay dato, fail-closed).
#  P4 Research diferido: prefijo [RESEARCH] → bin 'research' SIN gastar Haiku (17_bandeja.js) + el brief
#     los lista en "Espera tu decisión". La web NO se le da al agente (dictamen Bastión).
#  P5 STT: keyterm ampliado al léxico real (verificado contra livekit-plugins-deepgram 1.6.4 instalado:
#     soporta `keyterm`; ya se usaba con 8 términos) + regla N8 anti-fantasma en el prompt.
#  P6 CAPABILITIES regenerado (lo hace el --go).
# USO: bash _voz_acciones_code.sh  (dry-run)  |  bash _voz_acciones_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi

echo "== PRE-CONDICIONES (working tree) =="
# P1
grep -q "function sembrarNorthStarSatori_" src/18_direccion.js       || { echo "ABORT: falta sembrarNorthStarSatori_"; exit 1; }
# Fuente única: nadie debe sembrar el North Star en una hoja objetivos.
grep -q "cargarObjetivo('CLI-000'" src/18_direccion.js               && { echo "ABORT: el North Star se está duplicando en CLI-000/objetivos (fuente única = Config)"; exit 1; }
# P2
grep -q "accion: 1 }" src/08_webapp.js                               || { echo "ABORT: accion no está en VOZ_TOOLS"; exit 1; }
grep -q "var ACCIONES_VOZ = { crear_objetivo: 1 }" src/08_webapp.js  || { echo "ABORT: falta la whitelist ACCIONES_VOZ (o v1 dejó de ser un solo tipo)"; exit 1; }
grep -q "var CAMPOS_ACCION" src/08_webapp.js                         || { echo "ABORT: falta la whitelist de campos"; exit 1; }
grep -q "function accionVoz_" src/08_webapp.js                       || { echo "ABORT: falta accionVoz_"; exit 1; }
grep -q "tenant_desconocido" src/08_webapp.js                        || { echo "ABORT: falta la validación de tenant contra el roster"; exit 1; }
grep -q "north_star_no_por_voz" src/08_webapp.js                     || { echo "ABORT: falta la guarda del North Star (fuente única)"; exit 1; }
grep -q "function ejecutarCrearObjetivo_" src/11_aprobaciones.js     || { echo "ABORT: falta el ejecutor"; exit 1; }
grep -q "case 'crear_objetivo':" src/11_aprobaciones.js              || { echo "ABORT: ejecutarAprobada no rutea crear_objetivo"; exit 1; }
# GUARDIA DURA DE LA FRONTERA DE CONFIANZA — las 2 capas que impiden que la voz alcance correrAgente_.
grep -qE "^\s*metrica: '',\s*//" src/11_aprobaciones.js              || { echo "ABORT: el ejecutor no fuerza metrica vacía (la voz alcanzaría correrAgente_)"; exit 1; }
if grep -A2 "var CAMPOS_ACCION" src/08_webapp.js | grep -q "'metrica'"; then
  echo "ABORT: 'metrica' está en la whitelist de campos — la voz podría dispararle al Analista"; exit 1; fi
# P3
grep -q "north_star: northStarSatori_()" src/08_webapp.js            || { echo "ABORT: estadoAgentes no expone north_star"; exit 1; }
grep -q "function cmNorthStar" src/index.html                        || { echo "ABORT: falta la card del CM"; exit 1; }
grep -q "cmNorthStar(est.north_star)" src/index.html                 || { echo "ABORT: la card no se cablea al estado"; exit 1; }
# P4
grep -q "var RESEARCH_PREFIJO" src/17_bandeja.js                     || { echo "ABORT: falta el prefijo [RESEARCH]"; exit 1; }
grep -q "'research', 'escalate'" src/17_bandeja.js                   || { echo "ABORT: research no es un bin válido"; exit 1; }
grep -q "RESEARCH" voz/agent/agent.py                                || { echo "ABORT: el agente no conoce el prefijo [RESEARCH]"; exit 1; }
# P5
grep -q "REGLA N8" voz/agent/agent.py                                || { echo "ABORT: falta la regla anti-fantasma N8"; exit 1; }
grep -q "REGLA N6" voz/agent/agent.py                                || { echo "ABORT: falta la desambiguación norte-vs-objetivos (N6)"; exit 1; }
grep -q "REGLA N7" voz/agent/agent.py                                || { echo "ABORT: falta la regla de research (N7)"; exit 1; }
grep -q "async def accion" voz/agent/agent.py                        || { echo "ABORT: agent.py no tiene la tool accion"; exit 1; }
# asserts
grep -q "D16i metrica nace VACÍA" src/09_selftest.js                 || { echo "ABORT: falta el assert de la frontera de confianza"; exit 1; }
grep -q "D16j payload con metrica incluida" src/09_selftest.js       || { echo "ABORT: falta el assert del enforcement server-side"; exit 1; }
grep -q "D16k descripcion hostil" src/09_selftest.js                 || { echo "ABORT: falta el assert de saneo hostil"; exit 1; }

if command -v node >/dev/null 2>&1; then
  for f in src/08_webapp.js src/09_selftest.js src/11_aprobaciones.js src/17_bandeja.js src/18_direccion.js; do
    node --check "$f" || { echo "ABORT: sintaxis $f"; exit 1; }
  done
  node -e "
    const fs=require('fs');
    let h=fs.readFileSync('src/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
    const m=h.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g)||[];
    m.forEach(s=>{const c=s.replace(/<script\b[^>]*>/,'').replace(/<\/script>/,''); if(c.trim())new Function(c);});
  " || { echo "ABORT: sintaxis del script de index.html"; exit 1; }
  echo "sintaxis GAS OK (5 js + index.html)"
fi
if [ -x voz/agent/.venv/bin/python ]; then
  voz/agent/.venv/bin/python -m py_compile voz/agent/agent.py || { echo "ABORT: py_compile agent.py"; exit 1; }
  # No asumir la firma del plugin: si keyterm dejara de existir, el agente arrancaría y moriría en runtime.
  voz/agent/.venv/bin/python -c "
import inspect
from livekit.plugins import deepgram
assert 'keyterm' in inspect.signature(deepgram.STT.__init__).parameters, 'el plugin no soporta keyterm'
print('deepgram STT.keyterm verificado contra el venv')
" || { echo "ABORT: el plugin deepgram instalado no soporta keyterm"; exit 1; }
  echo "py_compile agent.py OK"
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
ESPERADOS="08_webapp.js 09_selftest.js 11_aprobaciones.js 17_bandeja.js 18_direccion.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar (diffs no esperados vs GAS HEAD)"; exit 1; }
echo "difieren (esperados): ${DIFIEREN:-<ninguno>}"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit + clasp push + git push (a /dev/HEAD) =="
  echo "   agent.py es LOCAL (no clasp). La voz toma el cambio tras el promote + kickstart -k."
  echo "   La auto-aprobacion de crear_objetivo requiere sembrar una Direccion a mano (decision tuya)."
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/08_webapp.js src/09_selftest.js src/11_aprobaciones.js src/17_bandeja.js src/18_direccion.js \
        src/index.html voz/agent/agent.py CAPABILITIES.md HANDOFF.md \
        ENCARGO-CODE-voz-acciones-2026-07-16.md _voz_acciones_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "voz-acciones: la voz registra estructuras con gate + North Star propio + research diferido

P1 North Star propio: sembrarNorthStarSatori_ idempotente. FUENTE UNICA = Config (ya vivia ahi y el
  brief F2 lo renderiza) -> NO se duplica en CLI-000/objetivos. Decision de Luciano 16-jul.
P2 tool accion (v1: solo crear_objetivo). NO escribe directo: crea Aprobacion P1 tipada -> el clic la
  materializa. Con Direccion vigente (F2) auto-aprueba y ejecuta en el turno, citando el id creado.
  CHEQUEO CRUZADO correrAgente_: DISPARO. objetivos.descripcion -> Director -> analista mete la
  pregunta CRUDA en el prompt (y GUARDIA_INYECCION bendice lo que va fuera de los marcadores).
  El Director solo encola con metrica no vacia => metrica se fuerza VACIA en 2 capas (whitelist de
  campos del doPost + el ejecutor) => un objetivo de voz NUNCA alcanza correrAgente_. Completar
  metrica a mano = el acto humano que restaura el first-party. Blindar la pregunta sigue diferido,
  ahora con la frontera explicita (ver HANDOFF).
  Bastion: whitelist dura de acciones y de campos, tenant solo del roster, limpiarHostilTexto_, cap,
  conLock, y el North Star de sistema no se crea por voz (fuente unica).
P3 estadoAgentes.north_star + card cmNS (oculta sin dato, fail-closed).
P4 [RESEARCH] -> bin research sin gastar Haiku; el brief los lista. La web NO se le da al agente.
P5 keyterm ampliado (verificado contra el plugin 1.6.4 instalado) + N8 anti-fantasma.
Prompt: N6 (norte de Satori vs objetivos de tenant, el gap del log), N7 (research), N8.
selfTest D16 (a..t). Harness offline 25/25.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK (GAS HEAD = /dev)"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push GitHub OK"; else echo "AVISO: git push fallo; codigo YA en GAS y commiteado local"; fi
echo ""
echo "== VERIFICACION (en orden) =="
echo "1. Editor GAS -> setup() -> selfTest() -> TODO OK incluyendo D16 (a..t)."
echo "2. Editor GAS -> sembrarNorthStarSatori_() -> siembra el North Star en Config (idempotente)."
echo "   Deadline 31/12/2026 = lo que dictaste por voz. El PAQUETE 10-jul sugeria 31/10 (mas agresivo):"
echo "   cambiarlo es UNA celda de Config -> ns_satori_horizonte."
echo "3. Eyeball /dev: la card 'North Star - Satori' aparece con el avance (clientes pagos / 6)."
echo "   Si no aparece: es fail-closed -> falta el paso 2."
echo "4. Promote: bash _promote_exec.sh --go   (el agente pega a /exec: sin esto la voz NO ve accion)."
echo "5. POST-PROMOTE: launchctl kickstart -k gui/\$UID/com.satori.voz.agent   y prueba de voz:"
echo "   (1) 'cual es mi north star?'      -> el TUYO (Config, con avance). NO el de Vehemence."
echo "   (2) 'registra el objetivo X para Vehemence' -> repregunta de confirmacion -> aprobacion en el CM."
echo "   (3) 'investigame X'               -> encargo [RESEARCH] visible en la Bandeja (bin research)."
echo "   (4) menciona 'Vehemence' y un nombre inventado -> el 1o exacto, el 2o dispara la repregunta."
echo "OPCIONAL (decision tuya): sembrar en Direcciones una fila crear_objetivo + alcance=CLI-000 +"
echo "   vigencia futura + activa=si  => 'registra X' queda registrado en el mismo turno, sin clic."
echo "   Recomendado NO sembrarla para tenants de clientes."
echo "LISTO."
