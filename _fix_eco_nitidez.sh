#!/usr/bin/env bash
# _fix_eco_nitidez.sh — E3.8: causa REAL del desenfoque en la MacBook (E3.6/DPR no era).
# CAUSA: setEco(on) hacia renderer.setPixelRatio(on?1:...) → al activarse eco, pixelRatio=1;
# en una Retina (DPR 2) eso es render a MITAD de resolucion = borroso. Y un auto-eco lo
# disparaba solo cuando los FPS caian bajo 24 tras el umbral (GPU integrada de la Mac + escena
# pesada) → "al principio enfocado, luego desenfocado". Fix (Cowork):
#   1. setEco YA NO baja el pixelRatio: nitidez SIEMPRE (el ahorro viene de ocultar streams/halos/torres).
#   2. auto-eco: umbral 24→18 fps, para que en una MacBook normal ni se dispare (queda FULL y nitida).
# USO: bash _fix_eco_nitidez.sh          -> DRY RUN
#      bash _fix_eco_nitidez.sh --go     -> clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
grep -qF 'E3.8 — eco YA NO baja el pixelRatio' src/index.html || { echo "ABORT: falta fix setEco"; exit 1; }
grep -qF 'fps<18 && nav.modo' src/index.html || { echo "ABORT: falta umbral auto-eco 18"; exit 1; }
if grep -qF 'renderer.setPixelRatio(on?1:' src/index.html; then echo "ABORT: la linea vieja (on?1) sigue presente"; exit 1; fi
echo "OK"

echo "== SINTAXIS (tokenizer + node --check) =="
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
git add src/index.html _fix_eco_nitidez.sh
git commit -m "AKASHA E3.8: fix REAL del desenfoque en Retina — eco/auto-eco ya no baja el pixelRatio a 1 (render a media resolucion = borroso); nitidez siempre, umbral auto-eco 24->18" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. Verificacion en la MacBook (/dev): entra a Akasha, deja la escena asentada unos segundos"
echo "y mira si SIGUE nitida (antes se ponia borrosa ~2s despues del umbral). El boton debe decir '◈ Full'."
echo "Si AUN se ve suave con '◈ Full': es el escalado del monitor de macOS (Ajustes > Pantallas > 'Predeterminado'"
echo "en vez de una resolucion escalada 'Mas espacio') — eso ningun codigo lo arregla."
