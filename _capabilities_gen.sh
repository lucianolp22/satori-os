#!/usr/bin/env bash
# _capabilities_gen.sh — Autogenera CAPABILITIES.md por introspección del repo (B5).
# Regla: CAPABILITIES.md NO se edita a mano (muere stale). Se REGENERA con este script.
# Uso:  bash _capabilities_gen.sh   → reescribe CAPABILITIES.md
set -u
cd "$(cd "$(dirname "$0")" && pwd)" || exit 1
OUT="CAPABILITIES.md"
SRC="src"
FECHA="$(date '+%Y-%m-%d %H:%M')"

{
echo "# CAPABILITIES — Satori OS  (autogenerado)"
echo ""
echo "> **NO editar a mano.** Se regenera con \`bash _capabilities_gen.sh\` (introspección de \`src/\`)."
echo "> Generado: $FECHA · commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
echo ""

echo "## Módulos"
echo ""
echo "| Archivo | Propósito | Funciones |"
echo "|---|---|---|"
for f in $(ls "$SRC"/*.js | sort); do
  base="$(basename "$f")"
  prop="$(sed -n '2,4p' "$f" | grep -m1 -oE "$base — .*" | sed "s/$base — //" | sed 's/[.]$//' | cut -c1-90)"
  [ -z "$prop" ] && prop="$(sed -n '2,4p' "$f" | grep -m1 -oE '— .*' | sed 's/^— //' | cut -c1-90)"
  n="$(grep -cE '^function ' "$f")"
  echo "| \`$base\` | ${prop:-—} | $n |"
done
echo ""

echo "## Entry points de editor (se corren a mano desde Apps Script)"
echo ""
echo "Funciones públicas sin guión bajo final que son de arranque/verificación manual:"
echo ""
for fn in setup cargaInicialClientes selfTest smokeKill smokeBackup backupAhora backupListar drillRestore instalarTriggerBackup estadoTriggerBackup pausarSistema reanudarSistema estadoPausa probarAlertaEmail; do
  loc="$(grep -rl "^function $fn(" "$SRC"/*.js 2>/dev/null | head -1)"
  [ -n "$loc" ] && echo "- \`$fn()\` — $(basename "$loc")"
done
echo ""

echo "## Triggers (time-based)"
echo ""
echo "| Handler | Cadencia | Módulo |"
echo "|---|---|---|"
grep -rnE "newTrigger\('" "$SRC"/*.js | while IFS= read -r line; do
  file="$(basename "${line%%:*}")"
  handler="$(echo "$line" | grep -oE "newTrigger\('[^']+'\)" | sed "s/newTrigger('//; s/')//")"
  cad="$(echo "$line" | grep -oE "(everyMinutes\([0-9]+\)|everyDays\([0-9]+\)|everyHours\([0-9]+\)|onWeekDay\([^)]*\)|atHour\([0-9]+\))" | tr '\n' ' ')"
  echo "| \`$handler\` | ${cad:-—} | $file |"
done
echo ""

echo "## Scopes OAuth (appsscript.json)"
echo ""
python3 - "$SRC/appsscript.json" <<'PY' 2>/dev/null || grep -oE 'auth/[a-zA-Z._]+' "$SRC/appsscript.json" | sed 's/^/- /'
import json,sys
d=json.load(open(sys.argv[1]))
for s in d.get("oauthScopes",[]): print("- "+s.replace("https://www.googleapis.com/",""))
print("\nwebapp.access = "+d.get("webapp",{}).get("access","?")+" · executeAs = "+d.get("webapp",{}).get("executeAs","?"))
PY
echo ""

echo "## Pestañas"
echo ""
echo "**MAESTRO:** $(grep -m1 'MAESTRO_ORDEN =' "$SRC/01_schema.js" | grep -oE '\[.*\]' | tr -d "[]'" )"
echo ""
echo "**Cliente:** $(grep -m1 'CLIENTE_ORDEN =' "$SRC/01_schema.js" | grep -oE '\[.*\]' | tr -d "[]'" )"
echo ""

echo "## Agentes (registry)"
echo ""
echo "| Clave | Nombre | Rol | Activo |"
echo "|---|---|---|---|"
grep -oE "^  [a-z]+: *\{ nombre: '[^']+', +rol: '[^']+', +activo: (true|false)" "$SRC/13_agentes.js" | while IFS= read -r line; do
  k="$(echo "$line" | grep -oE '^  [a-z]+' | tr -d ' ')"
  nom="$(echo "$line" | grep -oE "nombre: '[^']+'" | sed "s/nombre: '//; s/'//")"
  rol="$(echo "$line" | grep -oE "rol: '[^']+'" | sed "s/rol: '//; s/'//")"
  act="$(echo "$line" | grep -oE 'activo: (true|false)' | sed 's/activo: //')"
  echo "| $k | $nom | $rol | $act |"
done
echo ""

echo "## Script Properties (nombres, sin valores)"
echo ""
grep -rhoE "(getProperty|setProperty|deleteProperty)\('[A-Za-z0-9_]+'" "$SRC"/*.js | grep -oE "'[A-Za-z0-9_]+'" | tr -d "'" | sort -u | sed 's/^/- /'
echo ""

echo "## Funciones por módulo (apéndice)"
echo ""
for f in $(ls "$SRC"/*.js | sort); do
  base="$(basename "$f")"
  fns="$(grep -oE '^function [a-zA-Z0-9_]+' "$f" | sed 's/^function //' | tr '\n' ' ')"
  [ -n "$fns" ] && { echo "**$base:** $fns"; echo ""; }
done
} > "$OUT"

echo "OK → $OUT ($(wc -l < "$OUT") líneas)"
