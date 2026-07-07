#!/usr/bin/env bash
# _inventario_cierre.sh — GATE DE DECLARACION DE CIERRE (07-jul-2026).
# Regla dura: NADIE (Cowork/Code/Luciano) declara "terminado/completo/cerrado" sin correr esto
# y adjuntar el output a la declaracion. Barrido mecanico de cabos sueltos, no de memoria.
# Uso:  bash _inventario_cierre.sh [carpeta_extra ...]
set -u
cd "$(cd "$(dirname "$0")" && pwd)" || exit 1

MARCAS='falta solo|falta |pendiente|PENDIENTE|TODO|FIXME|residual|Residual|queda abierto|sin hacer|no verificado|No verificado|por construir|nunca se|mock|a futuro|diferido'

echo "===================== INVENTARIO DE CIERRE — $(date '+%Y-%m-%d %H:%M') ====================="
echo ""
echo "== 1. Marcadores en codigo (src/) =="
grep -rniE "$MARCAS" src/ --include='*.js' --include='*.html' 2>/dev/null | grep -viE 'sin datos|no inventa|pendiente de clasificar|estado.*pendiente|filter|indexOf|===' | head -30 || echo "(sin marcadores)"
echo ""
echo "== 2. Marcadores en docs del repo =="
grep -rniE "$MARCAS" docs/ *.md 2>/dev/null | grep -vE '^Binary|CHANGELOG' | head -40 || echo "(sin marcadores)"
echo ""
echo "== 3. Secciones Pendiente / No verificado del HANDOFF vigente =="
awk '/## (Pendiente|### No verificado)/,/^## [A-Z]/' HANDOFF.md 2>/dev/null | head -30
echo ""
echo "== 4. Specs en docs/ sin implementacion en src/ (heuristica: funciones spec no presentes) =="
for spec in docs/INTEGRACION-ENTRENAMIENTO-AGENTES.md; do
  [ -f "$spec" ] || continue
  echo "-- $spec:"
  grep -oE '`[a-zA-Z_][a-zA-Z0-9_]*\(\)`' "$spec" | tr -d '`()' | sort -u | while read -r fn; do
    grep -rq "function $fn" src/ 2>/dev/null || echo "   NO IMPLEMENTADA: $fn()"
  done
done
echo ""
echo "== 5. Carpetas extra pasadas por argumento =="
for d in "$@"; do
  [ -d "$d" ] || continue
  echo "-- $d:"
  grep -rniE "falta solo|falta:|Pendiente:|Residual|queda abierto" "$d" --include='*.md' 2>/dev/null | head -20
done
echo ""
echo "================================================================================"
echo "REGLA: la declaracion de cierre DEBE decir (a) que incluye, (b) que queda abierto"
echo "(esta lista, depurada a mano), (c) donde vive cada cabo. Sin esto NO se declara."
