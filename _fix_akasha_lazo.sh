#!/usr/bin/env bash
# _fix_akasha_lazo.sh — E3.2: lazo de Akasha con paridad CM + option "Todos" con value vacio.
# Origen: videos SEGUNDA/TERCERA PRUEBA AKASHA (17-jul). Hallazgos y fixes (hechos por Cowork):
#   1. option "Todos los Espacios" nacia SIN value => el TEXTO viajaba como id_cliente
#      => "Despertar a Analista para Todos los Espacios" corrio contra tenant fantasma => Errores: 1.
#      Fix: value='' explicito (el guard de despertar vuelve a cortar; el fallback al cliente del CM manda).
#   2. El lazo no traia id_cliente => el boton "+ Crear aprobacion" se ofrecia para recs GLOBALES
#      y el server las rechaza por regla firme 07-jul (sin tenant no se crea nada).
#      Fix: paridad con el CM (L2270): boton SOLO si la rec ancla a cliente y sin juicio 'se hizo';
#      si es global, linea honesta que apunta a los dos juicios del lazo.
#   3. Guard de refuerzo en aprobarRec (fail-closed tambien en UI).
#   4. "Arrancar por: Arrancar por [A]..." — prefijo duplicado eliminado (se muestra rec.texto tal cual, como el CM).
# USO: bash _fix_akasha_lazo.sh          -> DRY RUN (precondiciones + sintaxis, no toca nada)
#      bash _fix_akasha_lazo.sh --go     -> clasp push a /dev + git commit
set -u
REPO="$HOME/Documents/Claude/Projects/SatoriOS"
cd "$REPO" || { echo "ABORT: no existe $REPO"; exit 1; }

echo "== PRECONDICIONES (los 4 fixes presentes) =="
grep -qF "oTodos.value = ''" src/index.html || { echo "ABORT: falta fix 1 (value Todos)"; exit 1; }
grep -qF "cli: String(rec.id_cliente" src/index.html || { echo "ABORT: falta fix 2 (lazo.cli)"; exit 1; }
grep -qF 'DATA.lazo.cli && !DATA.lazo.hizo' src/index.html || { echo "ABORT: falta fix 3 (boton condicionado)"; exit 1; }
grep -qF 'se sigue por el lazo, no por aprobación' src/index.html || { echo "ABORT: falta fix 4 (guard aprobarRec)"; exit 1; }
if grep -qF "Arrancar por: ' + rec.texto" src/index.html; then echo "ABORT: el prefijo duplicado sigue"; exit 1; fi
echo "OK"

echo "== SINTAXIS: node --check de cada <script> inline =="
python3 - << 'PY' || { echo "ABORT: sintaxis rota"; exit 1; }
# tokenizer HTML real (NO regex: hay '<script' dentro de strings JS y el regex corta mal)
from html.parser import HTMLParser
import subprocess, tempfile, os, sys
class SP(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.blocks, self.cur, self.inscript = [], None, False
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and not dict(attrs).get('src'):
            self.inscript, self.cur = True, []
    def handle_endtag(self, tag):
        if tag == 'script' and self.inscript:
            self.blocks.append(''.join(self.cur)); self.inscript = False
    def handle_data(self, d):
        if self.inscript: self.cur.append(d)
p = SP(); p.feed(open('src/index.html', encoding='utf-8').read())
bad = 0
for i, b in enumerate(p.blocks):
    if not b.strip(): continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(b); path = f.name
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0:
        bad += 1
        print("SINTAXIS ROTA en bloque %d:" % (i+1)); print(r.stderr[:600])
print("%d bloques <script> inline revisados, %d rotos" % (len(p.blocks), bad))
sys.exit(1 if bad else 0)
PY
echo "OK"

if [ "${1:-}" != "--go" ]; then echo; echo "== DRY RUN OK — nada tocado. Correr con --go para push + commit =="; exit 0; fi

echo "== clasp push (/dev, NO toca /exec) =="
clasp push -f || { echo "ABORT: clasp push fallo — nada commiteado"; exit 2; }

echo "== git commit =="
git add src/index.html _fix_akasha_lazo.sh
git commit -m "AKASHA E3.2: lazo con paridad CM (boton crear-aprobacion solo si la rec ancla a cliente; linea honesta si es global) + option Todos con value vacio (el Despertar ya no viaja con tenant fantasma) + guard en aprobarRec + sin prefijo duplicado" || echo "(nada que commitear)"
git push origin main 2>/dev/null && echo "push GitHub OK" || echo "AVISO: git push a GitHub fallo (auth) — el push a GAS ya quedo; subilo cuando quieras"
echo ""
echo "LISTO. Verificacion en /dev (1 min):"
echo "  1. Atril: el lazo muestra el texto UNA sola vez; si la rec es global, aparece la linea honesta (sin boton)."
echo "  2. Con Akasha en 'Todos los Espacios' y el CM en un cliente: Despertar muestra el cliente REAL en el confirm."
