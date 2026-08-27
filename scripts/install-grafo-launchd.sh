#!/usr/bin/env bash
# install-grafo-launchd.sh — instala/reinstala el LaunchAgent del servidor del grafo del Cerebro.
#
# IDEMPOTENTE: correrlo N veces deja el mismo estado. Si el job ya está cargado y el plist no
# cambió, no hace nada (salvo --force).
#
# QUÉ NO HACE (a propósito):
#   · No crea un plist nuevo. El canónico vive en `_cerebro/_scripts/com.satori.cerebro-grafo.plist`
#     junto al script que levanta — una sola fuente de verdad. Este script lo COPIA e instala.
#   · No toca ningún otro job de launchd. Sólo el Label declarado abajo.
#
# ⚠ NO cambiar el intérprete a /usr/bin/python3 (CommandLineTools): bajo launchd no tiene el
#   permiso TCC de ~/Documents y muere con "Operation not permitted" antes de abrir el script.
#   El python de Homebrew SÍ lo tiene. Está documentado dentro del propio plist.
#
# Uso:  bash scripts/install-grafo-launchd.sh [--force] [--check]
# Rollback:  launchctl bootout gui/$(id -u)/com.satori.cerebro-grafo
set -euo pipefail

LABEL="com.satori.cerebro-grafo"
SRC="${HOME}/Documents/Claude/_cerebro/_scripts/${LABEL}.plist"
DST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
PORT=8788
DOMAIN="gui/$(id -u)"
FORCE=0; CHECK=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    --check) CHECK=1 ;;
    *) echo "argumento desconocido: $a" >&2; exit 2 ;;
  esac
done

fail() { echo "✗ $*" >&2; exit 1; }
ok()   { echo "✓ $*"; }

[ -f "$SRC" ] || fail "no existe el plist canónico: $SRC"
grep -q "<string>${LABEL}</string>" "$SRC" || fail "el plist no declara Label=${LABEL}"
grep -q "/opt/homebrew" "$SRC" || fail "el plist no usa el python de Homebrew (ver comentario TCC arriba)"

estado() {
  if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
    launchctl print "${DOMAIN}/${LABEL}" 2>/dev/null | awk '/^\tstate =/{print $3}'
  else
    echo "no-cargado"
  fi
}

if [ "$CHECK" = 1 ]; then
  echo "label   : ${LABEL}"
  echo "plist   : $( [ -f "$DST" ] && echo "instalado en $DST" || echo 'NO instalado' )"
  echo "sincro  : $( [ -f "$DST" ] && cmp -s "$SRC" "$DST" && echo 'igual al canónico' || echo 'DIFIERE del canónico' )"
  echo "launchd : $(estado)"
  echo "http    : $(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 'sin respuesta')"
  exit 0
fi

mkdir -p "${HOME}/Library/LaunchAgents" "${HOME}/Library/Logs"

if [ -f "$DST" ] && cmp -s "$SRC" "$DST" && [ "$(estado)" = "running" ] && [ "$FORCE" = 0 ]; then
  ok "ya instalado, sincronizado y corriendo — nada que hacer (usá --force para reinstalar)"
  exit 0
fi

cp "$SRC" "$DST"
ok "plist copiado a $DST"

# bootout tolerante (puede no estar cargado) + bootstrap.
launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$DST" || fail "bootstrap falló"
ok "job (re)cargado en ${DOMAIN}"

# Verificación: el server tiene que contestar 200 en loopback.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null || true)"
  [ "$code" = "200" ] && { ok "http://127.0.0.1:${PORT}/ responde 200"; exit 0; }
  perl -e 'select(undef,undef,undef,1)'
done
fail "el job quedó cargado pero 127.0.0.1:${PORT} no contesta 200 (revisá ~/Library/Logs/satori-grafo-server.err.log)"
