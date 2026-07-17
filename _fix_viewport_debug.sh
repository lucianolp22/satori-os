#!/usr/bin/env bash
# _fix_viewport_debug.sh — E3.11: (1) FIX estructural: faltaba <meta name="viewport"> en todo el
# documento. Sin el, en una pantalla Retina/escalada (MacBook Pro) el navegador compone la pagina
# para un ancho que NO es el real → "presentado para otra pantalla". En la LG FHD (DPR 1, sin
# escalar) coincidia por casualidad. Se agrega width=device-width + viewport-fit=cover (notch).
# (2) PANEL DE DIAGNOSTICO temporal (tecla 'i' lo oculta): muestra los numeros REALES de la
# pantalla (ventana, dpr, canvas buffer vs display, aspect, fov) para diagnosticar con datos, no
# adivinar. Se retira cuando el encuadre quede cerrado.
# USO: bash _fix_viewport_debug.sh          -> DRY RUN
#      bash _fix_viewport_debug.sh --go      -> clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES =="
grep -qF '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' src/index.html || { echo "ABORT: falta el meta viewport"; exit 1; }
grep -qF 'AK-DEBUG  ·  tecla i para ocultar' src/index.html || { echo "ABORT: falta el panel debug"; exit 1; }
grep -qF 'fpsCheck(now); _akDbg();' src/index.html || { echo "ABORT: falta la llamada _akDbg en el loop"; exit 1; }
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
git add src/index.html _fix_viewport_debug.sh
git commit -m "AKASHA E3.11: agrega <meta viewport> que FALTABA (causa de 'presentado para otra pantalla' en Retina) + panel de diagnostico temporal (tecla i) para medir la pantalla real" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. En la MacBook, abri /dev y entra a Akasha:"
echo "  1. Fijate si YA encuadra bien (el meta viewport puede haberlo resuelto de raiz)."
echo "  2. Arriba al centro vas a ver un panel AK-DEBUG con los numeros de tu pantalla."
echo "     Sacale UNA captura y pasamela — con esos datos cierro el encuadre con certeza."
echo "     (La tecla 'i' lo oculta cuando quieras.)"
