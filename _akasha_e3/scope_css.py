#!/usr/bin/env python3
"""Scopea el CSS del prototipo E113 bajo #akasha para injertarlo en el CM.

- :root{}            -> #akasha{}   (tokens self-contained, no leak al CM)
- @keyframes pulse   -> akPulse     (CM ya define 'pulse' -> los keyframes son globales)
- selectores sueltos -> '#akasha ' + sel
- se DESCARTAN: .galaxy/.photobg/#veil (se reusa el fondo del CM) y todo el
  #despacho mock (el Despacho real es el CM).
"""
import re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
css = open(SRC).read()

# Los comentarios se van ANTES de parsear: si no, se pegan al prelude de la
# regla siguiente y rompen tanto el scopeo como el split por comas.
# (El alfabeto base64 no contiene '*', así que ningún data-uri matchea '/*'.)
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)

# --- 1. tokenizar reglas de primer nivel -------------------------------------
def split_rules(s):
    """Devuelve [(prelude, body, es_bloque_anidado)] respetando llaves y strings."""
    out, i, n, depth, start = [], 0, len(s), 0, 0
    prelude_end = None
    while i < n:
        c = s[i]
        if c in '"\'':                      # saltar strings (base64 del photobg)
            q = c; i += 1
            while i < n and s[i] != q:
                i += 2 if s[i] == '\\' else 1
        elif c == '{':
            if depth == 0:
                prelude_end = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                out.append((s[start:prelude_end], s[prelude_end + 1:i]))
                start = i + 1
        i += 1
    return out

DROP_SEL = re.compile(
    r'^\s*(\.galaxy|\.photobg|#veil|#despacho|\.despacho-cuerpo|\.cm-card|'
    r'\.puerta|\.mock-note|html\s*,\s*body|body|html)\b')

def scope_sel(sel):
    sel = sel.strip()
    if not sel:
        return None
    if sel == ':root':
        return '#akasha'
    if DROP_SEL.match(sel):
        return None
    # ya scopeado
    if sel.startswith('#akasha'):
        return sel
    # pseudo-elementos/clases sobre el propio overlay
    if sel.startswith(':'):
        return '#akasha' + sel
    return '#akasha ' + sel

def scope_prelude(prelude):
    """prefija cada selector de una lista separada por comas."""
    kept = []
    for sel in prelude.split(','):
        s = scope_sel(sel)
        if s:
            kept.append(s)
    return ',\n'.join(kept) if kept else None

def emit(prelude, body, depth=0):
    p = prelude.strip()
    ind = '  ' * depth
    # --- at-rules ---
    if p.startswith('@keyframes'):
        name = p.split()[1].strip()
        return f'{ind}@keyframes ak{name[0].upper()}{name[1:]}{{{body}}}\n'
    if p.startswith('@media') or p.startswith('@supports'):
        inner = ''.join(emit(pp, bb, depth + 1) for pp, bb in split_rules(body))
        return f'{ind}{p}{{\n{inner}{ind}}}\n' if inner.strip() else ''
    if p.startswith('@'):                     # @font-face, @import: pasan tal cual
        return f'{ind}{p}{{{body}}}\n'
    # --- regla normal ---
    s = scope_prelude(p)
    if not s:
        return ''
    return f'{ind}{s}{{{body.strip()}}}\n'

rules = split_rules(css)
out = ''.join(emit(p, b) for p, b in rules)

# --- 2. renombrar los usos de la animación 'pulse' ---------------------------
out = re.sub(r'animation:\s*pulse\b', 'animation:akPulse', out)

open(OUT, 'w').write(out)
print(f'reglas de entrada : {len(rules)}')
print(f'bytes  {len(css)} -> {len(out)}')
