#!/usr/bin/env python3
"""E3 · injerta AKASHA en src/index.html reemplazando el spike E2 (andamio).

Idempotente y verificado: cada corte se hace por match exacto de anclas, nunca
por número de línea (el archivo se mueve). Si un ancla no matchea, aborta.
"""
import re, sys, shutil, os

REPO = '/Users/lucianopablolp/Documents/Claude/Projects/SatoriOS/'
SP = '/private/tmp/claude-501/-Users-lucianopablolp-Documents-Claude-Projects-SatoriOS/355a0905-58c3-41a5-8296-1a7dbb874420/scratchpad/akasha/'
IDX = REPO + 'src/index.html'

html = open(IDX).read()
orig_len = len(html)


def cut(start_anchor, end_anchor, new, why, keep_end=False):
    """Corta desde start_anchor hasta end_anchor y mete `new`."""
    global html
    i = html.find(start_anchor)
    if i < 0:
        sys.exit(f'✗ ancla inicial no encontrada ({why}): {start_anchor[:70]}')
    j = html.find(end_anchor, i)
    if j < 0:
        sys.exit(f'✗ ancla final no encontrada ({why}): {end_anchor[:70]}')
    if not keep_end:
        j += len(end_anchor)
    html = html[:i] + new + html[j:]
    print(f'✓ {why}')


# ── 1. CSS del spike -> CSS de Akasha ────────────────────────────────────────
# OJO: .cm-btn.akasha (la pill de la topbar) NO es del spike, es la puerta que
# se conserva; el CSS scopeado no la trae. Se re-emite acá tal cual estaba.
akasha_css = open(SP + 'akasha.css').read()
pill_css = (
    '/* AKASHA — puerta (pill) en la topbar. Acento lider (#F2C893), distinto de voz/oficina. */\n'
    '.cm-btn.akasha{display:inline-flex;align-items:center;gap:6px;border-color:rgba(242,200,147,.5);color:#f2c893}\n'
    '.cm-btn.akasha:hover{background:rgba(242,200,147,.10)}\n'
)
cut('/* E2 · AKASHA — puerta (pill) + overlay del spike.',
    '#akSalir:hover{color:#f2c893;border-color:rgba(242,200,147,.55)}',
    pill_css + akasha_css.rstrip() + '\n',
    'CSS: spike -> Akasha E3 (pill preservada)')

# ── 2. DOM del spike (548–553) -> cosmos + vista plana ───────────────────────
akasha_dom = open(SP + 'akasha.dom.html').read()
cut('  <!-- E2 · AKASHA spike: overlay propio',
    '  </div>\n\n  <header class="topbar">',
    akasha_dom.rstrip() + '\n\n  <header class="topbar">',
    'DOM: spike -> cosmos + vista plana')

# ── 3. La pill deja de anunciar un spike ────────────────────────────────────
old_pill = '<button class="cm-btn akasha" id="cmAkasha" title="Entrar a la Oficina Universo (spike E2)">⟶ Akasha</button>'
if old_pill not in html:
    sys.exit('✗ no encontré la pill del spike')
html = html.replace(old_pill,
    '<button class="cm-btn akasha" id="cmAkasha" title="Entrar a la Oficina Universo">⟶ Akasha</button>')
print('✓ pill: título sin "spike E2"')

# ── 4. JS del spike (2121–2249) -> motor E113 + boot/adaptador ───────────────
engine = open(SP + 'akasha.engine.js').read()
boot = open(SP + 'akasha.boot.js').read()
js = engine.rstrip() + '\n\n' + boot.rstrip() + '\n'

cut('/* ══ AKASHA · SPIKE E2 — convivencia Three ═',
    "document.addEventListener('keydown',function(e){if(e.key==='Escape'&&AK.on){e.stopPropagation();akSalir();}},true);\n})();",
    js,
    'JS: spike -> motor E113 + adaptador')

# ── 5. Verificaciones ───────────────────────────────────────────────────────
# Identificadores del andamio: si sobrevive alguno, el reemplazo quedó a medias.
# (Ojo: NO chequear prose tipo "spike E2" — los comentarios del port lo nombran
#  legítimamente. akDisp_ SÍ sobrevive: es la guardia fail-closed que se conserva.)
must_die = ['akBuild_', 'akGl', 'akHud', 'akFps', 'akTog', 'akRev',
            'akSalir', 'akEntrar(', 'id="akHud"']
for t in must_die:
    if t in html:
        sys.exit(f'✗ quedó rastro del spike: {t!r} ({html.count(t)}×)')

must_live = ['!(AK&&AK.on)',              # invariante 2 del gate E2
             '__buildAkashaEngine',
             'window.AK = AK',
             'id="akasha"', 'id="gl"', 'id="cosmos"', 'id="flat"',
             'id="cmAkasha"',
             'three.min.js']              # el r128 del CM, intacto
for t in must_live:
    if t not in html:
        sys.exit(f'✗ falta algo que debía quedar: {t!r}')

shutil.copy(IDX, SP + 'index.html.pre-e3')
open(IDX, 'w').write(html)
print(f'\n✓ index.html  {orig_len} -> {len(html)} bytes  ({len(html)-orig_len:+d})')
