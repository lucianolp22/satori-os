#!/usr/bin/env bash
# _fix_encuadre_aspecto.sh — E3.10: encuadre CONSISTENTE en cualquier pantalla (el "de costado"
# DEFINITIVO). Dato de Luciano: encuadra bien en la LG FHD (1920x1080, 16:9) pero NO en la
# MacBook Pro integrada (Retina, aspecto ~1.56, mas angosta). Causa: el fov de Three es VERTICAL
# y fijo (55) → en 16:9 el universo entra completo, pero en la pantalla mas angosta el fov
# horizontal se achica y el anillo del universo queda recortado/de canto = "de costado".
# Fix (Cowork): derivar el fov vertical del fov HORIZONTAL de referencia (16:9, la LG donde
# funciona), por aspecto, en resize(). Asi las 3 pantallas muestran el MISMO encuadre horizontal.
# (Sigue disponible el afinador akEncuadre(alt,radio,lookY) de E3.9 para gusto fino.)
# USO: bash _fix_encuadre_aspecto.sh          -> DRY RUN
#      bash _fix_encuadre_aspecto.sh --go     -> clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
grep -qF 'E3.10 — ancla de encuadre' src/index.html || { echo "ABORT: falta el ancla _HFOV_REF"; exit 1; }
grep -qF 'camera.fov = Math.max(40, Math.min(68' src/index.html || { echo "ABORT: falta el fov por aspecto en resize"; exit 1; }
grep -qF 'const _HFOV_REF = 2*Math.atan' src/index.html || { echo "ABORT: falta _HFOV_REF"; exit 1; }
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
git add src/index.html _fix_encuadre_aspecto.sh
git commit -m "AKASHA E3.10: encuadre consistente por aspecto (fov vertical derivado del fov horizontal 16:9 de la LG FHD) — la MacBook mas angosta deja de verse 'de costado'; LG FHD sin cambios" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. Abri /dev en la MacBook (Pantalla integrada): el universo tiene que entrar igual que en"
echo "la LG FHD, centrado al Nucleo, no 'de costado'. Deberia verse consistente en las 3 pantallas."
echo "Si queres afinar el gusto: akEncuadre(alt, radio, lookY) en la consola (E3.9)."
