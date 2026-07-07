#!/usr/bin/env bash
# _voz_estados.sh — estados visibles del agente en voz.html (texto+color por lk.agent.state).
# Solo git: voz.html NO va a GAS (lo sirve serve_voz.py del disco) -> con recargar la pagina alcanza.
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi
grep -q "setSato" voz/web/voz.html || { echo "ABORT: fix ausente"; exit 1; }
git add voz/web/voz.html _voz_estados.sh _inventario_cierre.sh CLAUDE.md HANDOFF.md
git commit -m "Voz: estados visibles del agente (escucha/pensando/hablando, texto+color) + gate de declaracion de cierre (CLAUDE.md + _inventario_cierre.sh) + HANDOFF re-inventariado" || { echo "ABORT: commit fallo"; exit 2; }
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push OK"; else echo "AVISO: push fallo (auth); el cambio ya rige local"; fi
echo "LISTO. Recarga dura de la pagina de voz (Cmd-Shift-R) y hablale: vas a ver Sato escucha/pensando/hablando en color."
