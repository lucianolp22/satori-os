#!/usr/bin/env bash
# _fix_encuadre.sh — E3.9: encuadre del overview (Akasha se veia "de costado", pedido Luciano).
# El overview miraba el universo desde altura 28 (muy picado) apuntando a y=4, con el Nucleo a y=10
# → universo tirado abajo, oblicuo. Fix (Cowork): alt 28→18 (mas de frente) + punto de mira 4→7
# (centra el universo). Ademas un AFINADOR EN VIVO: window.akEncuadre(alt, radio, lookY) para que
# Luciano ajuste en tiempo real y pase los numeros exactos, sin ciclos de adivinar-pushear-mirar.
# USO: bash _fix_encuadre.sh          -> DRY RUN
#      bash _fix_encuadre.sh --go     -> clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
grep -qF 'E3.9 — encuadre del overview' src/index.html || { echo "ABORT: falta E3.9"; exit 1; }
grep -qF 'window.akEncuadre = function' src/index.html || { echo "ABORT: falta el afinador akEncuadre"; exit 1; }
grep -qF 'D(nav.look.y,_ovLookY,3,dt)' src/index.html || { echo "ABORT: falta el look.y tunable"; exit 1; }
grep -qF 'radioV:58, alt:18,' src/index.html || { echo "ABORT: alt no quedo en 18"; exit 1; }
echo "OK"

echo "== SINTAXIS =="
python3 - << 'PY' || { echo "ABORT: sintaxis rota"; exit 1; }
from html.parser import HTMLParser
import subprocess, tempfile, os, sys
class SP(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False); self.blocks,self.cur,self.ins=[],None,False
    def handle_starttag(self,t,a):
        if t=='script' and not dict(a).get('src'): self.ins,self.cur=True,[]
    def handle_endtag(self,t):
        if t=='script' and self.ins: self.blocks.append(''.join(self.cur)); self.ins=False
    def handle_data(self,d):
        if self.ins: self.cur.append(d)
p=SP(); p.feed(open('src/index.html',encoding='utf-8').read())
bad=0
for b in p.blocks:
    if not b.strip(): continue
    f=tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8'); f.write(b); f.close()
    r=subprocess.run(['node','--check',f.name],capture_output=True,text=True); os.unlink(f.name)
    if r.returncode: bad+=1; print(r.stderr[:400])
print("%d bloques, %d rotos"%(len(p.blocks),bad)); sys.exit(1 if bad else 0)
PY
echo "OK"

if [ "${1:-}" != "--go" ]; then echo; echo "== DRY RUN OK — con --go: clasp push + commit + push =="; exit 0; fi

echo "== clasp push (/dev, NO toca /exec) =="
clasp push -f || { echo "ABORT: clasp push fallo"; exit 2; }
echo "== git commit + push =="
git add src/index.html _fix_encuadre.sh
git commit -m "AKASHA E3.9: encuadre del overview mas de frente (alt 28->18, mira 4->7, ya no 'de costado') + afinador en vivo window.akEncuadre(alt,radio,lookY)" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. En /dev (Akasha): tiene que arrancar mas de frente, el universo centrado (no tirado abajo)."
echo "Si queres afinarlo VOS: abri la consola del navegador y proba, por ej:"
echo "   akEncuadre(16, 52, 8)     (mas de frente y mas cerca)"
echo "   akEncuadre(22, 60, 6)     (un poco mas alto)"
echo "Mové los 3 numeros hasta que te guste; te imprime 'alt=.. radio=.. lookY=..' -> pasamelos y los dejo fijos."
echo "TIP: tambien podes arrastrar vertical con el mouse para inclinar la camara en vivo."
