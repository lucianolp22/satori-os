#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera src/edificio.html — el modulo LAZY del Edificio Satori — a partir de
AKASHA-EDIFICIO-v4.html (la maqueta certificada por render de Cowork).

QUE HACE, EN CRIOLLO: v4 es una pagina ENTERA (su propio renderer, su propia
escena, su propio loop, su propio universo de demo). El modulo NO puede ser eso:
tiene que engancharse a la escena YA VIVA de Akasha por el seam __AK_EXT. Este
script extrae de v4 lo que es reusable tal cual (datos, texturas, constructores
de geometria, paneles HTML) y descarta lo que Akasha ya pone (renderer, escena,
camara, luces, domo, universo, loop, listeners de input).

Las tres transformaciones que no son un simple corte:
  1. CSS: las vars :root de v4 chocarian con las de index.html, y 24 de sus
     clases ya existen ahi (.panel .card .scrim .toast .dir .logo .st ...).
     Todo el CSS se scopea bajo #ediRoot y toda clase se prefija `e-`. Como
     los overlays viven a nivel <body> (regla dura de stacking, 04-ago), meter
     las vars en #ediRoot resuelve ADEMAS el corolario del tema: un panel fuera
     de #centro pierde los tokens y queda ilegible.
  2. IDs: los del modulo pasan a `edi*` (menos #gl, que es el canvas compartido
     y NO lo crea el modulo).
  3. Escala: v4 trabaja ~5.7x mas grande que Akasha (torre W=240 / clientes
     R=225, contra R=22 de estaciones y RC=40 de clientes en Akasha). El grupo
     torre se escala por EDI_K; las luces NO van dentro del grupo (el frustum de
     sombra y el `distance` de un PointLight no escalan con el padre).
"""
import re, sys, pathlib

ROOT = pathlib.Path('/Users/lucianopablolp/Documents/Claude/Projects/SatoriOS')
SRC  = ROOT / 'AKASHA-EDIFICIO-v4.html'
OUT  = ROOT / 'src' / 'edificio.html'

lines = SRC.read_text(encoding='utf-8').split('\n')
def blk(a, b, ancla=None):
    """Corta [a,b] 1-indexado inclusivo. Si se da `ancla`, verifica que la primera linea del
    bloque EMPIECE con ese texto y aborta si no.

    Por que: los cortes son por numero de linea, y la maqueta se sigue editando (v4 ya se
    actualizo una vez para suavizar el nucleo). Una linea de mas arriba corre TODOS los rangos y
    el generador escribe 320KB de basura sin quejarse — el modulo compila y monta mal. Con el
    ancla, un v5 desalineado ABORTA en vez de mentir. Misma regla que `patch_engine.py` en el
    port de E3: si un ancla no matchea, se corta; nunca se falla en silencio."""
    if ancla is not None and not lines[a-1].startswith(ancla):
        sys.exit('✗ rango desalineado: esperaba que L%d empezara con %r y dice %r.\n'
                 '  La maqueta cambio de forma: reajusta los rangos en extraer.py.'
                 % (a, ancla[:50], lines[a-1][:50]))
    return '\n'.join(lines[a-1:b])

# ─────────────────────────────────────────────────────────────────────────────
# 1. CSS — scopear + prefijar
# ─────────────────────────────────────────────────────────────────────────────
css = blk(8, 161, ':root{')                      # sin <style>/</style>
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)   # los comentarios estorban al scopear selectores

# Reglas globales que el modulo NO debe imponerle al CM: se descartan enteras.
for pat in [r'\*\{box-sizing:border-box\}\s*',
            r'html,body\{[^}]*\}\s*',
            r'body\{[^}]*\}\s*',
            r'#gl\{[^}]*\}\s*', r'#gl\.drag\{[^}]*\}\s*', r'#gl\.pick\{[^}]*\}\s*',
            r'\.vignette\{[^}]*\}\s*']:
    css = re.sub(pat, '', css)

# :root → #ediRoot (tokens propios del modulo, no globales)
css = css.replace(':root{', '#ediRoot{', 1)

# Set de clases reales del CSS (un punto seguido de letra, en zona de selector).
def selector_zones(text):
    """Devuelve los tramos que son selector (fuera de {...} y fuera de @keyframes body)."""
    out, depth, buf, start = [], 0, [], 0
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                out.append((start, i))
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                start = i + 1
    return out

clases = set()
for a, b in selector_zones(css):
    for m in re.finditer(r'\.([a-zA-Z][-a-zA-Z0-9_]*)', css[a:b]):
        clases.add(m.group(1))

# Prefijar clases SOLO en zona de selector (no toca decimales ni contenidos).
# Recursivo a proposito: las reglas DENTRO de un @media tambien tienen que quedar
# scopeadas y prefijadas. Si no, `.dir`, `.hint`, `.prov` y `.d-grid` se escapan del
# scope y pisan a index.html justo en movil — que es donde menos se mira.
# @keyframes es la excepcion: su cuerpo son stops (0% / from / to), no selectores.
def _scope_sel(sel):
    sel = re.sub(r'\.([a-zA-Z][-a-zA-Z0-9_]*)',
                 lambda m: '.e-' + m.group(1) if m.group(1) in clases else m.group(0), sel)
    partes = []
    for s in sel.split(','):
        s2 = s.strip()
        if not s2 or s2.startswith('#ediRoot'):
            partes.append(s)
        else:
            partes.append(('\n' if '\n' in s else '') + '#ediRoot ' + s2)
    return ','.join(partes)

def prefijar_css(text):
    out, i, n = [], 0, len(text)
    while i < n:
        j = text.find('{', i)
        if j < 0:
            out.append(text[i:]); break
        sel = text[i:j]
        # cuerpo balanceado
        depth, k = 1, j + 1
        while k < n and depth:
            if text[k] == '{': depth += 1
            elif text[k] == '}': depth -= 1
            k += 1
        cuerpo = text[j+1:k-1]
        s = sel.strip()
        if s.startswith('@keyframes'):
            out.append(sel + '{' + cuerpo + '}')
        elif s.startswith('@'):                     # @media / @supports → recursion
            out.append(sel + '{' + prefijar_css(cuerpo) + '}')
        else:
            out.append(_scope_sel(sel) + '{' + cuerpo + '}')
        i = k
    return ''.join(out)

css = prefijar_css(css)

# ─────────────────────────────────────────────────────────────────────────────
# 2. JS — bloques que se portan
# ─────────────────────────────────────────────────────────────────────────────
datos      = blk(205, 298, 'const CSSC=')     # CSSC HEXC PISOS FEED_DEMO ST_* AV AV_MAP avTex
post       = blk(311, 392, '/* ── Pipeline de post-proceso')     # pipeline de post-proceso hand-written
texturas   = blk(446, 524, '/* texturas por canvas */')     # tex carpetTex screenTexFactory glow M SCREEN_*
base       = blk(525, 540, '/* base */')     # ground/ring/dimensiones/tower/arrays
construct  = blk(542, 703, 'function labelSprite(')     # labelSprite ... buildDespacho
pisos      = blk(702, 803, 'PISOS.forEach(')     # bucle PISOS + nucleo dorado
# DOM completo de v4: setGlow (el realce del agente al hover) + directorio, selectUniverse,
# selectFloor, renderPanel, los mini-graficos SVG y el dashboard. Se porta entero para no
# reescribir lo que la maqueta ya resolvio y Cowork ya verifico por render.
domjs      = blk(981, 986, 'function setGlow(') + '\n' + blk(996, 1130, '/* ══════════ DOM')

# El bucle de PISOS y la base comparten linea: recortar el solapamiento.
base      = blk(525, 540, '/* base */')
construct = blk(542, 701, 'function labelSprite(')
pisos     = blk(702, 803, 'PISOS.forEach(')

# --- prefijar clases/IDs en el JS portado ---
IDS = {'tip':'ediTip','dir':'ediDir','panel':'ediPanel','scrim':'ediScrim',
       'dash':'ediDash','toast':'ediToast','crumbHere':'ediCrumb',
       'btnExplode':'ediExplode','btnReset':'ediReset'}

def prefijar_js(text):
    # Clases que entran por INTERPOLACION, no como literal: `class="dl ${k[3]}"` con k[3] = 'up'.
    # El prefijador de abajo no las ve (el token es `${k[3]}`, no `up`), asi que el CSS quedaba
    # apuntando a `.e-dl.e-up` y el HTML escribiendo `up` a secas: la clase NUNCA aplicaba y los
    # semaforos del panel y los deltas del dashboard salian sin color. Se prefija la expresion.
    # (`c[3]` NO va acá: es de la CARTERA demo de v4, que se descarta entera unas líneas más abajo.
    #  Prefijarlo rompería el ancla de ese descarte — y ese replace tiene que matchear sí o sí.)
    for expr in ['k[3]', 'a.st']:
        text = text.replace('${' + expr + '}', "${'e-'+" + expr + '}')
    # class="a b c"  y  class='a b c'
    def _cls(m):
        q = m.group(1); toks = m.group(2).split()
        return 'class=' + q + ' '.join(('e-' + t if t in clases else t) for t in toks) + q
    text = re.sub(r'class=(["\'])([^"\']*)\1', _cls, text)
    # classList.add('x') / remove / toggle / contains
    def _cl(m):
        return m.group(1) + m.group(2) + ('e-' + m.group(3) if m.group(3) in clases else m.group(3)) + m.group(2)
    text = re.sub(r'(classList\.(?:add|remove|toggle|contains)\()(["\'])([-a-zA-Z0-9_]+)\2', _cl, text)
    # querySelector('.x') / querySelectorAll
    text = re.sub(r'(querySelector(?:All)?\()(["\'])\.([-a-zA-Z0-9_]+)\2',
                  lambda m: m.group(1) + m.group(2) + '.' + ('e-' + m.group(3) if m.group(3) in clases else m.group(3)) + m.group(2), text)
    # getElementById('x')
    text = re.sub(r'(getElementById\()(["\'])([-a-zA-Z0-9_]+)\2',
                  lambda m: m.group(1) + m.group(2) + IDS.get(m.group(3), m.group(3)) + m.group(2), text)
    return text

for name in ['datos', 'texturas', 'base', 'construct', 'pisos', 'domjs', 'post']:
    globals()[name] = prefijar_js(globals()[name])

# --- adaptaciones puntuales de los bloques portados ---
# base: v4 mete ground/ring en `scene`; acá van DENTRO del grupo torre (escalan con él).
base = base.replace('scene.add(ground)', 'tower.add(ground)') \
           .replace('scene.add(ring)',   'tower.add(ring)') \
           .replace('ringGlow.position.set(0,-2,0);scene.add(ringGlow)',
                    'ringGlow.position.set(0,-2,0);tower.add(ringGlow)') \
           .replace('const tower=new THREE.Group();scene.add(tower);', '')
# `tower` tiene que declararse ANTES que la base: en v4 el suelo iba a `scene` y el grupo se creaba
# despues, pero acá la base cuelga del grupo (para que escale con él) y un `const` no se hoistea —
# el suelo lo tocaba en zona muerta. Se declara arriba de todo el bloque.
base = ('const tower=new THREE.Group();   /* lo cuelga EXT.addGroup al final, no `scene.add` */\n'
        + base)

# --- DOM: lo que cambia al vivir DENTRO de Akasha y no en una pagina propia ---
# `resetView`/`bump` eran del sistema de camara e input de v4, que no se porta: la camara es la de
# Akasha. `setCrumb` escribe en el HUD de Akasha por el seam.
# Todo replace de acá abajo es un ANCLA: si no matchea, el módulo sale roto de una forma que solo
# se ve en runtime (`CARTERA is not defined` al abrir el panel del Universo — pasó de verdad al
# reordenar dos transformaciones). Mismo criterio que `patch_engine.py` en el port de E3: un ancla
# que no engancha ABORTA, nunca falla en silencio.
def sust(texto, viejo, nuevo, etiqueta):
    if viejo not in texto:
        sys.exit('✗ ancla perdida (' + etiqueta + '): no encontré en v4 →\n    ' + viejo[:120])
    return texto.replace(viejo, nuevo)

domjs = sust(domjs, 'resetView()', 'focusUniverse()', 'camara: resetView') \
             .replace('bump();', '') \
             .replace('setCrumb(', 'crumb(')
# El panel del Universo listaba la CARTERA demo de v4. Acá la cartera REAL la dibuja Akasha con
# `listaClientes`: el panel la pide por el seam en vez de traer una lista inventada al lado.
domjs = sust(domjs,
    "<div class=\"e-agents\" style=\"grid-template-columns:1fr\">${CARTERA.map(c=>`<div class=\"e-agent\" style=\"cursor:default\"><span class=\"e-nm\"><span class=\"e-st ${c[3]}\"></span>${esc(c[1])}</span><span class=\"e-rl\">${esc(c[2])} · Espacio de Cliente</span></div>`).join('')}</div>",
    "<div class=\"e-agents\" style=\"grid-template-columns:1fr\">${carteraReal()}</div>", 'cartera demo → listaClientes real')
domjs = domjs.replace(
    'En prod esta lista ES <b>listaClientes</b> (la cartera del semáforo). El Edificio vive debajo: mismo canvas, mismo loop.',
    'La cartera sale de <b>listaClientes</b> — la misma que dibuja los Espacios de Cliente ahí arriba. El Edificio vive debajo: mismo canvas, mismo loop.')
# ESC: sin esto, cerrar el dashboard con Escape ADEMAS te saca de Akasha (el engine escucha la
# misma tecla). Se corta la propagacion solo cuando el dashboard esta realmente abierto.
domjs = sust(domjs,
    "document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDash();}});",
    "document.addEventListener('keydown',function(e){\n"
    "  if(e.key!=='Escape') return;\n"
    "  if(!dash.classList.contains('e-open')) return;   /* si no hay dash, el ESC es de Akasha */\n"
    "  e.stopPropagation(); closeDash();\n"
    "}, true);", 'ESC del dashboard')

# POST: en v4 lee `renderer` de su clausura; acá `renderer` viene de __AK_EXT (mismo objeto).
# El unico ajuste real es el alpha: Akasha crea el renderer con alpha:true porque la Ficha 360 y
# Sato se superponen como capas HTML sobre la escena. Si el RT del POST comiera el alpha, esas
# capas perderian el fondo. Se conserva RGBAFormat (ya lo es) y el shader final emite alpha 1
# solo dentro del frame de la torre.
post = post.replace('const isGL2=renderer.capabilities.isWebGL2;',
                    'const isGL2=renderer.capabilities.isWebGL2;')

OUT.parent.mkdir(parents=True, exist_ok=True)
print('clases prefijadas:', len(clases))
print('CSS:', len(css), 'bytes  ·  datos:', len(datos), '·  post:', len(post),
      '·  texturas:', len(texturas), '·  construct:', len(construct),
      '·  pisos:', len(pisos), '·  dom:', len(domjs))

# El ensamblado final lo escribe gen_edificio_tpl.py (la plantilla es larga y va aparte).
(pathlib.Path(__file__).parent / '_partes.py').write_text(
    'CSS=' + repr(css) + '\nDATOS=' + repr(datos) + '\nPOST=' + repr(post) +
    '\nTEXTURAS=' + repr(texturas) + '\nBASE=' + repr(base) + '\nCONSTRUCT=' + repr(construct) +
    '\nPISOS=' + repr(pisos) + '\nDOMJS=' + repr(domjs) + '\nCLASES=' + repr(sorted(clases)) + '\n',
    encoding='utf-8')
print('OK → partes.py')
