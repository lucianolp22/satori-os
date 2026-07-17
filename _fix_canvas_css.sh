#!/usr/bin/env bash
# _fix_canvas_css.sh — E3.12: FIX RAÍZ del "de costado" en Retina (confirmado con datos del
# panel AK-DEBUG: display 3024 = 2× viewport 1512). El <canvas> #gl es un elemento REEMPLAZADO;
# con inset:0 + width:auto, CSS usa su tamaño INTRÍNSECO = el buffer. En Retina el buffer es 2× el
# viewport → el canvas se dibujaba al doble de ancho y solo se veía el cuarto superior-izquierdo
# (universo tirado al fondo-derecha). En la LG FHD (DPR 1) buffer=viewport, por eso ahí encuadraba.
# Fix: fijar canvas.style.width/height al viewport en px (igual que el #stars, que ya lo hacía bien).
# USO: bash _fix_canvas_css.sh          -> DRY RUN
#      bash _fix_canvas_css.sh --go      -> clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
grep -qF "E3.12 — FIX RAÍZ del" src/index.html || { echo "ABORT: falta E3.12"; exit 1; }
grep -qF "canvas.style.width = innerWidth + 'px';" src/index.html || { echo "ABORT: falta el fix de canvas.style"; exit 1; }
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
git add src/index.html _fix_canvas_css.sh
git commit -m "AKASHA E3.12: FIX RAIZ del 'de costado' en Retina — el canvas #gl (elemento reemplazado) usaba su tamano intrinseco (buffer 2x viewport) como tamano CSS; se fija style.width/height al viewport en px. Encuadra bien en MacBook y LG por igual" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. En la MacBook, recarga /dev y entra a Akasha:"
echo "  - El universo tiene que quedar CENTRADO al Nucleo, igual que en la LG FHD."
echo "  - En el panel AK-DEBUG, 'display' ahora debe decir 1512 x 949 (ya no 3024 x 1898)."
echo "  Confirmame que quedo y en el proximo push saco el panel de diagnostico."
