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

print('%s OK: divs %d/%d + %d bloque(s) JS compilan (%d chars)'
      % (ruta, ab, cl, len(bloques), sum(len(b) for b in bloques)))
