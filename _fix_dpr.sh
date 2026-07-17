#!/usr/bin/env bash
# _fix_dpr.sh — E3.6: fix del DESENFOQUE multi-monitor (pedido Luciano 17-jul, videos).
# El motor Akasha fijaba renderer.setPixelRatio SOLO en el init. Al mover la ventana entre
# la MacBook Retina (DPR 2) y el monitor externo (DPR 1), el buffer quedaba a la densidad
# vieja → toda la escena borrosa, el Núcleo "no enfocaba". Fix (hecho por Cowork):
#   - resize() re-aplica setPixelRatio con el devicePixelRatio ACTUAL (capado igual que el init).
#   - listener matchMedia('(resolution:Ndppx)') one-shot que se re-arma solo: cubre el caso en
#     que cambiar de pantalla cambia el DPR SIN cambiar innerWidth (donde 'resize' no dispara).
# USO: bash _fix_dpr.sh          -> DRY RUN (precondicion + sintaxis)
#      bash _fix_dpr.sh --go     -> clasp push /dev + commit + push GitHub
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICION (fix presente) =="
grep -qF 'E3.6 — re-aplica el DPR en CADA resize' src/index.html || { echo "ABORT: falta el fix DPR"; exit 1; }
grep -qF "matchMedia('(resolution:'+devicePixelRatio+'dppx)')" src/index.html || { echo "ABORT: falta el listener de resolucion"; exit 1; }
echo "OK"

echo "== SINTAXIS (tokenizer HTML real + node --check) =="
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
print("%d bloques <script>, %d rotos"%(len(p.blocks),bad)); sys.exit(1 if bad else 0)
PY
echo "OK"

if [ "${1:-}" != "--go" ]; then echo; echo "== DRY RUN OK — con --go: clasp push + commit + push =="; exit 0; fi

echo "== clasp push (/dev, NO toca /exec) =="
clasp push -f || { echo "ABORT: clasp push fallo"; exit 2; }
echo "== git commit + push =="
git add src/index.html _fix_dpr.sh ENCARGO-CODE-AKASHA-E37-boot-2tiempos-2026-07-17.md
git commit -m "AKASHA E3.6: fix desenfoque multi-monitor — resize() re-aplica setPixelRatio + listener matchMedia de resolucion (mover Retina<->externo ya no deja el buffer borroso); + encargo E3.7 (boot en 2 tiempos)" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth) — GAS ya quedo. Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. Verificacion: abri /dev en la MacBook, entra a Akasha, arrastra la ventana al monitor externo y de vuelta — la escena tiene que quedar NITIDA en ambas."
