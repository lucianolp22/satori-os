#!/usr/bin/env bash
# _install_hooks.sh — instala los hooks versionados de _hooks/ en .git/hooks/
# Correr EN EL MAC (el sandbox de Cowork no puede escribir en .git/).
set -u
cd "$(cd "$(dirname "$0")" && pwd)" || exit 1
[ -d .git ] || { echo "ABORT: aca no hay .git (correr desde la raiz del repo)"; exit 1; }
[ -f _hooks/pre-push ] || { echo "ABORT: falta _hooks/pre-push"; exit 1; }
bash -n _hooks/pre-push || { echo "ABORT: _hooks/pre-push tiene error de sintaxis"; exit 1; }
cp _hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
echo "hook pre-push instalado en .git/hooks/ (drift-checker CAPABILITIES activo)"
