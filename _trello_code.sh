#!/usr/bin/env bash
# _trello_code.sh — sube el importador temporal de Trello (99_tmp_trello.js) a GAS HEAD.
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi
grep -q "tmp_importTrello" src/99_tmp_trello.js || { echo "ABORT: falta el importador"; exit 1; }
git add src/99_tmp_trello.js _trello_import_2026-07-07.tsv _trello_code.sh
git commit -m "TEMPORAL: importador Trello Lp2026 a Tareas (23 filas, dedupe por id; borrar tras correr)" || echo "(sin cambios que commitear, sigo)"
clasp push -f || { echo "ABORT: clasp push fallo"; exit 2; }
echo "clasp push OK"
GIT_TERMINAL_PROMPT=0 git push origin main && echo "push OK" || echo "AVISO: git push fallo (no bloquea)"
echo ""
echo "== AHORA EN EL EDITOR GAS (1 minuto) =="
echo "1. Recarga el editor -> selector de funciones -> tmp_importTrello -> Ejecutar"
echo "2. Espera en el log: tmp_importTrello: con nuevas:23 saltadas:0 total_en_hoja:23"
echo "3. Recarga dura del /dev -> widget Tareas: Pendientes 20 / En curso 1 / Hechas 2 -> Abrir tablero = kanban poblado"
echo "4. Scrollea abajo del todo: card Agenda con tu evento de prueba si lo cargaste"
echo "LISTO."
