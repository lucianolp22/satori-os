#!/usr/bin/env bash
# _fix_akasha_home.sh — E3.3: AKASHA-HOME — el Satori OS abre DIRECTO en la Oficina Universo.
# (pedido Luciano 17-jul). 1 fix de Cowork en index.html:
#   Al final del init() de Akasha: if (akDisp_()) entrar();
#   - Misma ruta que el click de la pill (paridad total, intro/umbral incluidos con su skip).
#   - Fail-closed: sin Three/WebGL o con reduced-motion, queda el Despacho como siempre.
#   - El boot del CM corre EN PARALELO debajo (registro DOMContentLoaded posterior + guard AK.on)
#     => al volver con «⟵ Despacho» las cards ya estan pintadas.
# USO: bash _fix_akasha_home.sh          -> DRY RUN
#      bash _fix_akasha_home.sh --go     -> clasp push /dev + commit + push GitHub
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICION (fix presente) =="
grep -qF 'AKASHA-HOME (pedido Luciano 17-jul)' src/index.html || { echo "ABORT: falta el bloque AKASHA-HOME"; exit 1; }
grep -qF 'if (akDisp_()) entrar();' src/index.html || { echo "ABORT: falta la llamada auto-entrar"; exit 1; }
echo "OK"

echo "== SINTAXIS: node --check por tokenizer HTML real =="
python3 - << 'PY' || { echo "ABORT: sintaxis rota"; exit 1; }
from html.parser import HTMLParser
import subprocess, tempfile, os, sys
class SP(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.blocks, self.cur, self.inscript = [], None, False
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and not dict(attrs).get('src'): self.inscript, self.cur = True, []
    def handle_endtag(self, tag):
        if tag == 'script' and self.inscript: self.blocks.append(''.join(self.cur)); self.inscript = False
    def handle_data(self, d):
        if self.inscript: self.cur.append(d)
p = SP(); p.feed(open('src/index.html', encoding='utf-8').read())
bad = 0
for b in p.blocks:
    if not b.strip(): continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(b); path = f.name
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0: bad += 1; print(r.stderr[:400])
print("%d bloques <script> inline revisados, %d rotos" % (len(p.blocks), bad))
sys.exit(1 if bad else 0)
PY
echo "OK"

if [ "${1:-}" != "--go" ]; then echo; echo "== DRY RUN OK — con --go: clasp push + commit =="; exit 0; fi

echo "== clasp push (/dev, NO toca /exec) =="
clasp push -f || { echo "ABORT: clasp push fallo — nada commiteado"; exit 2; }

echo "== git commit + push =="
git add src/index.html _fix_akasha_home.sh
git commit -m "AKASHA E3.3: Akasha-home — el OS abre directo en la Oficina (misma ruta que la pill, fail-closed a Despacho); el boot del CM corre en paralelo debajo" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth) — GAS ya quedo"
echo ""
echo "LISTO. Verificacion en /dev: recargar -> tiene que abrir DIRECTO el umbral de Akasha;"
echo "«⟵ Despacho» te deja en el cockpit con las cards ya pintadas."
