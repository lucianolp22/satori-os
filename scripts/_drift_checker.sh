#!/usr/bin/env bash
# _drift_checker.sh — caza referencias MUERTAS en la documentación narrativa.
#
# EL PROBLEMA QUE RESUELVE: `CAPABILITIES.md` se regenera, pero `docs/SATO-IDENTIDAD.md` y las
# secciones narrativas se escriben a mano y envejecen. Una doc que nombra `sanitizarCelda()` después
# de que se renombró no avisa: simplemente miente, y alguien planifica sobre eso.
#
# QUÉ HACE: extrae de los .md las referencias en backticks que PARECEN código o rutas
# (`algo()` · `src/xx.js` · `scripts/x.sh`) y verifica que existan de verdad en el repo.
#
# SOFT por default (exit 0 con warnings) para no bloquear a nadie; `--strict` para CI y el hook.
# Allowlist: docs/.drift-allowlist.txt
#
# Uso: bash scripts/_drift_checker.sh [--strict] [archivo.md ...]
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
STRICT=0; ARCHIVOS=()
for a in "$@"; do
  if [ "$a" = "--strict" ]; then STRICT=1; else ARCHIVOS+=("$a"); fi
done
# Default = la doc que se escribe A MANO, que es la única que puede driftear.
# CAPABILITIES.md se REGENERA, así que sus referencias no envejecen: incluirla sólo sirve para
# cazar un bug del generador. (El test del encargo —renombrar `sanitizarCelda` y esperar que
# --strict falle— no aplica por eso: ahí la función vive en un apéndice generado.)
[ ${#ARCHIVOS[@]} -eq 0 ] && ARCHIVOS=(CLAUDE.md docs/SATO-IDENTIDAD.md CAPABILITIES.md)

python3 - "$STRICT" "${ARCHIVOS[@]}" <<'PY'
import os, re, subprocess, sys

strict = sys.argv[1] == '1'
archivos = [a for a in sys.argv[2:] if os.path.exists(a)]

allow = set()
if os.path.exists('docs/.drift-allowlist.txt'):
    for l in open('docs/.drift-allowlist.txt', encoding='utf8'):
        l = l.split('#')[0].strip()
        if l:
            allow.add(l)

tracked = set(subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout.split())
basenames = {os.path.basename(p) for p in tracked}

# Índice de símbolos definidos: funciones y vars top-level de src/*.js + defs de Python de voz/.
simbolos = set()
for f in list(tracked):
    if f.startswith('src/') and f.endswith('.js'):
        s = open(f, errors='replace').read()
        simbolos |= set(re.findall(r'^function ([A-Za-z_][\w$]*)', s, re.M))
        simbolos |= set(re.findall(r'^var ([A-Za-z_][\w$]*)', s, re.M))
    elif f.endswith('.py'):
        s = open(f, errors='replace').read()
        simbolos |= set(re.findall(r'^\s*(?:async )?def (\w+)', s, re.M))
        simbolos |= set(re.findall(r'^([A-Z_][A-Z0-9_]*) *=', s, re.M))

muertas = []
for a in archivos:
    for n, linea in enumerate(open(a, encoding='utf8'), 1):
        for ref in re.findall(r'`([^`\n]{2,80})`', linea):
            ref = ref.strip()
            if ref in allow:
                continue
            m = re.fullmatch(r'([A-Za-z_][\w$]*)\(\)?', ref)          # función()
            if m:
                if m.group(1) not in simbolos and m.group(1) not in allow:
                    muertas.append((a, n, ref, 'función no encontrada en el código'))
                continue
            if re.fullmatch(r'[\w./-]+\.(js|py|sh|md|html|json|txt|csv)', ref):   # ruta
                if ref not in tracked and os.path.basename(ref) not in basenames \
                        and not os.path.exists(ref) and os.path.basename(ref) not in allow:
                    muertas.append((a, n, ref, 'archivo no existe ni está trackeado'))

for a, n, ref, por in muertas:
    print(f"  ⚠ {a}:{n}  `{ref}` — {por}")
print(f"\n{'✗' if (muertas and strict) else '✓'} drift-checker: "
      f"{len(muertas)} referencia(s) muerta(s) en {len(archivos)} archivo(s)"
      f"{' — modo soft, no bloquea' if muertas and not strict else ''}")
sys.exit(1 if (muertas and strict) else 0)
PY
