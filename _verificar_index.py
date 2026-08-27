#!/usr/bin/env python3
"""
_verificar_index.py — verificación estructural de src/index.html (no hay linter de HTML acá).

Chequea dos cosas que `clasp push` NUNCA avisa y que dejan el Centro de Mando roto o mudo:
  1. divs balanceados (un `</div>` de menos desarma el layout entero);
  2. que TODO bloque <script> inline compile (un `;` de más y el CM queda mudo, sin error visible).

⚠ Los comentarios HTML se sacan ANTES de buscar <script>: index.html tiene un comentario que
menciona la palabra "<script>" y buscarlo por offset engancha ESE (el falso ABORT del 30-jul).

Vivía copiado dentro de cada `_tanda_*.sh`. Se extrajo en TC-3 porque toda tanda de UI lo necesita
y una copia por tanda es una copia que se desactualiza.

Uso: python3 _verificar_index.py [ruta]   (default: src/index.html)
"""
import os
import re
import subprocess
import sys
import tempfile

ruta = sys.argv[1] if len(sys.argv) > 1 else 'src/index.html'
h = open(ruta, encoding='utf-8').read()

ab, cl = len(re.findall(r'<div\b', h)), h.count('</div>')
if ab != cl:
    print('ABORT: divs desbalanceados: %d abren / %d cierran' % (ab, cl))
    sys.exit(1)

sin = re.sub(r'<!--.*?-->', '', h, flags=re.S)
bloques = re.findall(r'<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>', sin, flags=re.S)
if not bloques:
    print('ABORT: no encontré ningún bloque <script> inline')
    sys.exit(1)

tmp = os.path.join(tempfile.gettempdir(), '_verif_index.js')
for i, js in enumerate(bloques):
    open(tmp, 'w', encoding='utf-8').write(js)
    if subprocess.run(['node', '--check', tmp]).returncode:
        print('ABORT: el bloque <script> #%d no compila' % (i + 1))
        sys.exit(1)

# ── R12 · inventario congelado de breakpoints ────────────────────────────────
# POR QUÉ: el encargo de CRM Pro Mobile pide meter TODO lo móvil en "un único
# @media (max-width:640px)". Al medirlo (27-ago) resultó que index.html ya tiene
# **15 breakpoints distintos y 5 bloques a 640px**: la regla nace incumplida, así
# que aserirla como está sería un ❌ permanente e inútil.
#
# Lo que sí protege al escritorio —que es el riesgo real (PM-7)— es congelar el
# INVENTARIO: cualquier bloque @media que aparezca, desaparezca o cambie de
# cardinalidad corta acá, con el diff exacto. Agregar CSS móvil sigue siendo
# posible; lo que deja de ser posible es agregarlo **sin que se note**.
#
# Cómo se actualiza: si el cambio es intencional, se edita ESTE diccionario en el
# MISMO commit. Ese es el punto: obliga a declararlo.
BREAKPOINTS = {
    '(prefers-reduced-motion:reduce)': 6,
    '(max-width:640px)': 5,
    '(max-width:760px)': 5,
    '(max-width:560px)': 3,
    '(max-width:900px)': 3,
    '(max-width:1080px)': 2,
    '(max-width:1200px)': 2,
    '(prefers-reduced-motion: reduce)': 2,
    '(max-width:1100px)': 1,
    '(max-width:1700px)': 1,
    '(max-width:600px), (max-height:520px) and (max-width:960px)': 1,
    '(max-width:860px)': 1,
    '(max-width:880px)': 1,
    '(max-width:980px)': 1,
    '(prefers-reduced-motion:no-preference)': 1,
}
# Mismo cuidado que arriba con <script>: los comentarios se sacan ANTES de escanear.
# index.html tiene bloques /* … */ que MENCIONAN @media, y buscarlos en crudo engancha
# el comentario entero como si fuera la condición.
_css = re.sub(r'/\*.*?\*/', '', re.sub(r'<!--.*?-->', '', h, flags=re.S), flags=re.S)
hallados = {}
for cond in re.findall(r'@media([^{]*)\{', _css):
    k = re.sub(r'\s+', ' ', cond).strip()
    hallados[k] = hallados.get(k, 0) + 1
if hallados != BREAKPOINTS:
    print('ABORT: el inventario de @media cambió. Si es intencional, actualizá '
          'BREAKPOINTS en _verificar_index.py EN EL MISMO COMMIT.')
    for k in sorted(set(hallados) | set(BREAKPOINTS)):
        a, b = BREAKPOINTS.get(k, 0), hallados.get(k, 0)
        if a != b:
            print('   %-58s declarado=%d  real=%d' % (k, a, b))
    sys.exit(1)

print('%s OK: divs %d/%d + %d bloque(s) JS compilan (%d chars) + %d breakpoints @media congelados'
      % (ruta, ab, cl, len(bloques), sum(len(b) for b in bloques), sum(BREAKPOINTS.values())))
