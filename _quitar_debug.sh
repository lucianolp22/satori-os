#!/usr/bin/env bash
# _quitar_debug.sh — E3.13: retira el panel de diagnostico AK-DEBUG (era temporal, E3.11).
# El encuadre quedo CONFIRMADO por Luciano en ambas pantallas (MacBook display 1512x949 y
# LG FHD 1920x1080, universo centrado al Nucleo). Se quitan el div, la funcion _akDbg, el
# listener de la tecla 'i' y la llamada en el loop. Se conservan TODOS los fixes buenos
# (E3.8 nitidez, E3.9 afinador akEncuadre invisible, E3.10 fov por aspecto, E3.11 meta viewport,
# E3.12 canvas CSS=viewport). Solo queda una referencia "AK-DEBUG" en un COMENTARIO (documenta el fix).
# USO: bash _quitar_debug.sh          -> DRY RUN
#      bash _quitar_debug.sh --go      -> clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES (panel removido) =="
if grep -qF 'function _akDbg' src/index.html; then echo "ABORT: _akDbg sigue presente"; exit 1; fi
if grep -qF 'fpsCheck(now); _akDbg();' src/index.html; then echo "ABORT: la llamada _akDbg sigue en el loop"; exit 1; fi
if grep -qF "createElement('div')" src/index.html && grep -qF '_dbg' src/index.html; then echo "ABORT: quedan referencias a _dbg"; exit 1; fi
grep -qF "canvas.style.width = innerWidth + 'px';" src/index.html || { echo "ABORT: se perdio el fix E3.12"; exit 1; }
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
git add src/index.html _quitar_debug.sh
git commit -m "AKASHA E3.13: retira el panel de diagnostico AK-DEBUG (temporal) — encuadre confirmado por Luciano en MacBook y LG FHD. Cierra la saga del encuadre (E3.8-E3.12)" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. Akasha queda limpia (sin panel debug), nitida y bien encuadrada en las 3 pantallas."
echo "Proximo hito tecnico: rendimiento (encargo E3.7 para Code) y/o promocion a /exec (tu decision)."
