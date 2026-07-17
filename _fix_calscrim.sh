#!/usr/bin/env bash
# _fix_calscrim.sh — E3.14: el Calendario/Tablero se veian mezclados con el cosmos 3D en Akasha.
# CAUSA (diagnostico Cowork, solo lectura): el scrim de fondo .kscrim es rgba(8,6,10,.38) — 38% opaco.
# Sobre el fondo calmo del Despacho va bien; sobre el cosmos brillante y animado de Akasha, el 38% deja
# pasar el universo a traves del calendario. El z-index ya sube a 210 con Akasha abierto; el problema es
# la transparencia. FIX: 1 linea CSS — que el scrim sea casi opaco SOLO en Akasha (#centro.ak-on), sin
# tocar el look del Despacho.
#
# IMPORTANTE: correr DESPUES de que Code termine el encargo E3.7 y haga su clasp push (los dos tocan
# index.html; en serie no se pisan). El patch es exact-match sobre una linea CSS que E3.7 no toca.
# USO: bash _fix_calscrim.sh          -> DRY RUN
#      bash _fix_calscrim.sh --go      -> aplica + clasp push /dev + commit + push
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

OLD='#centro.ak-on .kscrim{z-index:210}'
NEW='#centro.ak-on .kscrim{z-index:210; background:rgba(8,6,10,.93); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px)}'

echo "== estado =="
if grep -qF "$NEW" src/index.html; then echo "El fix E3.14 ya esta aplicado. Nada que hacer."; exit 0; fi
c=$(grep -cF "$OLD" src/index.html)
if [ "$c" != "1" ]; then echo "ABORT: la linea a parchear aparece $c veces (esperaba 1). Reviso antes de tocar."; exit 1; fi
echo "linea objetivo encontrada (1). OK"

if [ "${1:-}" != "--go" ]; then echo; echo "== DRY RUN OK — con --go aplica el patch + clasp push + commit =="; exit 0; fi

echo "== aplicando patch =="
python3 - "$OLD" "$NEW" << 'PY'
import io, sys
old, new = sys.argv[1], sys.argv[2]
p='src/index.html'; s=io.open(p,encoding='utf-8').read()
if s.count(old)!=1: print("ABORT: match != 1 en python"); sys.exit(1)
io.open(p,'w',encoding='utf-8').write(s.replace(old,new)); print("patch aplicado")
PY
[ $? -eq 0 ] || { echo "ABORT: fallo el patch"; exit 1; }

echo "== node --check (tokenizer) =="
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

echo "== clasp push + commit + push =="
clasp push -f || { echo "ABORT: clasp push fallo"; exit 2; }
git add src/index.html _fix_calscrim.sh
git commit -m "AKASHA E3.14: el scrim del Calendario/Tablero se vuelve casi opaco en Akasha (era 38%, dejaba pasar el cosmos); Despacho sin cambios" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth). Si el hook frena por CAPABILITIES: git add CAPABILITIES.md && git commit -m 'CAPABILITIES regen' && git push"
echo ""
echo "LISTO. Abri el Calendario dentro de Akasha: el mes tiene que verse sobre un fondo oscuro limpio,"
echo "sin el universo colandose por atras. En el Despacho el calendario queda igual que siempre."
