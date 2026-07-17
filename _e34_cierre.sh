#!/usr/bin/env bash
# _e34_cierre.sh — CIERRE de AKASHA E3.4 (boot rapido). Code escribio todo (bootUnico server +
# D17h + cliente compartido) y un error 500 de API lo corto ANTES de validar/pushear.
# Cowork purgo el diff completo (existencia de las 13 funciones invocadas, firmas, CC.recs,
# CAL.cache, orden de definicion) y valido sintaxis: 08_webapp OK · 09_selftest OK · index OK.
# USO: bash _e34_cierre.sh          -> DRY RUN (precondiciones + sintaxis)
#      bash _e34_cierre.sh --go     -> clasp push /dev + commit + push GitHub
# DESPUES del --go (2 pasos tuyos):
#   1. Editor GAS -> selfTestF2 -> verde esperado con la tanda "D17h boot único" (3-4 min).
#   2. /dev con cronometro: abre DIRECTO en Akasha; en la consola del navegador: AK_T.tabla()
#      -> te muestra los ms de boot1:pedido / boot1:llegó / cm:paint. Eso es la medicion.
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES (E3.4 completo en el tree) =="
grep -qF 'function bootUnico(' src/08_webapp.js || { echo "ABORT: falta bootUnico server"; exit 1; }
grep -qF '_asertsD17h_' src/09_selftest.js || { echo "ABORT: falta D17h"; exit 1; }
grep -qF 'function bootPayload()' src/index.html || { echo "ABORT: falta bootPayload cliente"; exit 1; }
grep -qF 'function cmPrimerPaint()' src/index.html || { echo "ABORT: falta cmPrimerPaint"; exit 1; }
grep -qF "D17h boot único" src/09_selftest.js || { echo "ABORT: la tanda D17h no esta registrada en _asertsF2_"; exit 1; }
echo "OK"

echo "== SINTAXIS =="
node --check src/08_webapp.js || { echo "ABORT: 08_webapp roto"; exit 1; }
node --check src/09_selftest.js || { echo "ABORT: 09_selftest roto"; exit 1; }
python3 - << 'PY' || { echo "ABORT: index.html roto"; exit 1; }
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
print("%d bloques <script>, %d rotos" % (len(p.blocks), bad))
sys.exit(1 if bad else 0)
PY
echo "OK"

if [ "${1:-}" != "--go" ]; then echo; echo "== DRY RUN OK — con --go: clasp push + commit + push GitHub =="; exit 0; fi

echo "== clasp push (/dev, NO toca /exec) =="
clasp push -f || { echo "ABORT: clasp push fallo — nada commiteado"; exit 2; }

echo "== git commit + push =="
git add src/08_webapp.js src/09_selftest.js src/index.html ENCARGO-CODE-metrica-desde-CM-2026-07-17.md ENCARGO-CODE-AKASHA-E34-boot-rapido-2026-07-17.md _e34_cierre.sh
git commit -m "AKASHA E3.4: boot unico — bootUnico() server fail-closed por seccion + payload compartido Akasha/CM (1 ida en vez de ~10) + cronometro AK_T + assert D17h; ENCARGO v3 con Parte C (tenant encolarAgente). Code construyo, un 500 lo corto antes del cierre; Cowork purgo y cierra" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: push GitHub fallo (auth) — GAS ya quedo"
echo ""
echo "LISTO. Ahora: (1) selfTestF2 en el editor (tanda D17h) -> verde; (2) /dev + AK_T.tabla() en consola."
