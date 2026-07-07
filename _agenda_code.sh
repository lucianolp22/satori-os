#!/usr/bin/env bash
# _agenda_code.sh — Agenda semanal opcion A (hoja + backend + widget CM). Guardia + commit + clasp push.
# USO: bash _agenda_code.sh  (dry-run)  |  bash _agenda_code.sh --go
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1
if [ -f .git/index.lock ]; then
  pgrep -x git >/dev/null 2>&1 && { echo "ABORT: git corriendo con lock"; exit 1; }
  rm -f .git/index.lock
fi
grep -q "agendaSemana" src/18_direccion.js || { echo "ABORT: falta backend agenda"; exit 1; }
grep -q "ccAgendaFeed" src/index.html || { echo "ABORT: falta widget agenda"; exit 1; }

echo "== GUARDIA: diff repo vs GAS HEAD =="
rm -rf _gascheck_tmp && mkdir -p _gascheck_tmp/pull
SCRIPT_ID="$(grep -oE '"scriptId": *"[^"]+"' .clasp.json | grep -oE '1[A-Za-z0-9_-]{20,}')"
printf '{\n  "scriptId": "%s",\n  "rootDir": "pull"\n}\n' "$SCRIPT_ID" > _gascheck_tmp/.clasp.json
( cd _gascheck_tmp && clasp pull >/dev/null 2>&1 ) || { echo "ABORT: clasp pull fallo"; rm -rf _gascheck_tmp; exit 1; }
DIFFOUT="$(diff -rq _gascheck_tmp/pull src 2>/dev/null)"
SOLO_GAS="$(echo "$DIFFOUT" | grep "Only in .*_gascheck_tmp" || true)"
DIFIEREN="$(echo "$DIFFOUT" | grep "differ$" | grep -oE '[A-Za-z0-9_.]+\.(js|html|json)' | sort -u || true)"
rm -rf _gascheck_tmp
[ -n "$SOLO_GAS" ] && { echo "ABORT: GAS tiene archivos que el repo no tiene:"; echo "$SOLO_GAS"; exit 1; }
ESPERADOS="01_schema.js 18_direccion.js index.html"
INESPERADO=0
for f in $DIFIEREN; do
  echo "$ESPERADOS" | grep -qw "$f" || { echo "ATENCION: difiere NO esperado: $f"; INESPERADO=1; }
done
[ "$INESPERADO" -eq 1 ] && { echo "ABORT: revisar"; exit 1; }
echo "difieren (esperados): $DIFIEREN"
echo "GUARDIA OK"

if [ "${1:-}" != "--go" ]; then
  echo ""
  echo "== DRY RUN OK. Con --go: CAPABILITIES + commit + clasp push + git push =="
  exit 0
fi

echo "== EJECUTANDO --go =="
bash _capabilities_gen.sh || { echo "ABORT: capabilities"; exit 2; }
git add src/01_schema.js src/18_direccion.js src/index.html CAPABILITIES.md HANDOFF.md _agenda_code.sh
if git diff --cached --quiet; then echo "nada para commitear"; else
  git commit -m "Agenda semanal (norte v9, opcion A): hoja Agenda + agendaSemana/agendarEvento + card en CM; sin scope de Calendar" || { echo "ABORT: commit"; exit 3; }
  echo "commit OK"
fi
clasp push -f || { echo "ABORT: clasp push"; exit 4; }
echo "clasp push OK"
if GIT_TERMINAL_PROMPT=0 git push origin main; then echo "push OK"; else echo "AVISO: git push fallo; codigo YA en GAS"; fi
echo ""
echo "== VERIFICACION (editor + /dev, 3 min) =="
echo "1. setup()   -> crea la hoja Agenda"
echo "2. selfTest()   -> TODO OK"
echo "3. Probar alta: en el editor, ejecutar agendarEventoDemo NO existe; usa la pestaña Agenda o desde voz/CM mas adelante."
echo "   Alta rapida manual: fila en la pestaña Agenda con fecha YYYY-MM-DD, titulo y estado activo"
echo "4. /dev recarga dura -> card Agenda: muestra los eventos de los proximos 7 dias"
echo "LISTO."
