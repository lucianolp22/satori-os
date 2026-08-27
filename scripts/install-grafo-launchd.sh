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
# Uso:  bash scripts/install-grafo-launchd.sh [--force] [--check] [--dry-run]
#
# ⚠ POR QUE HAY GUARD DE DOMINIO (incidente 27-ago): `launchctl bootout gui/$(id -u)` NO depende
#   de $HOME. Una corrida de prueba con un HOME de juguete igual mataba el job de PRODUCCION.
#   Ahora se aborta si $HOME no es el home real del uid actual.
# ⚠ POR QUE HAY plutil -lint (mismo incidente): un plist con XML corrupto que casualmente
#   contuviera el Label y la ruta de homebrew pasaba los greps, se copiaba encima del bueno,
#   el bootout mataba el servicio y el bootstrap fallaba. Sin rollback.
# Rollback:  launchctl bootout gui/$(id -u)/com.satori.cerebro-grafo
set -euo pipefail

LABEL="com.satori.cerebro-grafo"
SRC="${HOME}/Documents/Claude/_cerebro/_scripts/${LABEL}.plist"
DST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
REF="$(cd "$(dirname "$0")/.." && pwd)/voz/launchagents/${LABEL}.plist.ref"   # R5: copia versionada
SRV="${HOME}/Documents/Claude/_cerebro/_scripts/grafo_server.py"
SRV_REF="$(cd "$(dirname "$0")/.." && pwd)/voz/launchagents/grafo_server.py.ref"   # R4/R13: idem
GEN="${HOME}/Documents/Claude/_cerebro/_scripts/grafo.py"
GEN_REF="$(cd "$(dirname "$0")/.." && pwd)/voz/launchagents/grafo.py.ref"          # F10-a: idem
PORT=8788
DOMAIN="gui/$(id -u)"
FORCE=0; CHECK=0; DRY=0
for a in "$@"; do
  case "$a" in
    --force)   FORCE=1 ;;
    --check)   CHECK=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "argumento desconocido: $a" >&2; exit 2 ;;
  esac
done

fail() { echo "✗ $*" >&2; exit 1; }
ok()   { echo "✓ $*"; }

# Guard 0 · DOMINIO. Antes que nada: este script hace bootout sobre gui/$(id -u), que ignora
# $HOME. Si $HOME fue sobrescrito (test, sandbox, sudo), abortamos en vez de tocar producción.
REAL_HOME="$(/usr/bin/dscl . -read "/Users/$(id -un)" NFSHomeDirectory 2>/dev/null | awk '{print $2}')"
[ -n "$REAL_HOME" ] || REAL_HOME="$HOME"
[ "$HOME" = "$REAL_HOME" ] || fail "HOME ($HOME) no es el home real del uid $(id -u) ($REAL_HOME). Abortado: el bootout tocaría el launchd de producción igual."

[ -f "$SRC" ] || fail "no existe el plist canónico: $SRC"
grep -q "<string>${LABEL}</string>" "$SRC" || fail "el plist no declara Label=${LABEL}"
grep -q "/opt/homebrew" "$SRC" || fail "el plist no usa el python de Homebrew (ver comentario TCC arriba)"
# Guard 3 · el plist tiene que ser XML VALIDO. Los greps de arriba pasan con un archivo roto que
# apenas contenga las dos cadenas; launchd no. Sin esto, el bootout mata el servicio y el
# bootstrap falla (incidente 27-ago).
plutil -lint "$SRC" >/dev/null 2>&1 || fail "el plist canónico no es XML válido (plutil -lint falló): $SRC"

estado() {
  if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
    launchctl print "${DOMAIN}/${LABEL}" 2>/dev/null | awk '/^\tstate =/{print $3}'
  else
    echo "no-cargado"
  fi
}

if [ "$CHECK" = 1 ]; then
  [ "$FORCE" = 1 ] && echo "nota    : --force se IGNORA junto a --check (esto no instala nada)"
  echo "label   : ${LABEL}"
  echo "plist   : $( [ -f "$DST" ] && echo "instalado en $DST" || echo 'NO instalado' )"
  echo "sincro  : $( [ -f "$DST" ] && cmp -s "$SRC" "$DST" && echo 'igual al canónico' || echo 'DIFIERE del canónico' )"
  echo "launchd : $(estado)"
  echo "http    : $(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 'sin respuesta')"
  # R5: el canónico vive fuera de git (~/Documents/Claude no es repo). La copia de referencia
  # versionada tiene que seguirlo; si divergen, la lección del TCC queda sólo en un disco.
  if [ -f "$REF" ]; then
    # Se compara la SUSTANCIA, no los bytes: la referencia lleva un comentario XML propio que
    # explica que no es instalable. Se quitan los comentarios de ambos lados antes de comparar.
    sincom() { perl -0777 -pe 's/<!--.*?-->//gs; s/^\s+//mg; s/\n+/\n/g' "$1"; }
    if [ "$(sincom "$SRC")" = "$(sincom "$REF")" ]; then echo "ref     : en sincro con $REF"
    else echo "ref     : ⚠ DIVERGE de $REF — actualizá la copia versionada"; fi
  else
    echo "ref     : ⚠ falta la copia versionada $REF"
  fi
  if [ -f "$SRV_REF" ] && [ -f "$SRV" ]; then
    if cmp -s "$SRV" "$SRV_REF"; then echo "server  : grafo_server.py en sincro con su referencia"
    else echo "server  : ⚠ grafo_server.py DIVERGE de $SRV_REF"; fi
  fi
  if [ -f "$GEN_REF" ] && [ -f "$GEN" ]; then
    if cmp -s "$GEN" "$GEN_REF"; then echo "gen     : grafo.py en sincro con su referencia"
    else echo "gen     : ⚠ grafo.py DIVERGE de $GEN_REF"; fi
  fi
  exit 0
fi

mkdir -p "${HOME}/Library/LaunchAgents" "${HOME}/Library/Logs"

if [ -f "$DST" ] && cmp -s "$SRC" "$DST" && [ "$(estado)" = "running" ] && [ "$FORCE" = 0 ]; then
  ok "ya instalado, sincronizado y corriendo — nada que hacer (usá --force para reinstalar)"
  exit 0
fi

if [ "$DRY" = 1 ]; then
  echo "— dry-run — no se toca nada. Haría:"
  echo "   cp $SRC -> $DST"
  [ -f "$DST" ] && echo "   backup   $DST -> $DST.prev"
  echo "   launchctl bootout   ${DOMAIN}/${LABEL}"
  echo "   launchctl bootstrap ${DOMAIN} $DST"
  echo "   curl http://127.0.0.1:${PORT}/ hasta 200 (10 intentos)"
  exit 0
fi

espera200() {
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ "$(curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null || true)" = "200" ] && return 0
    perl -e 'select(undef,undef,undef,1)'
  done
  return 1
}

# Backup ANTES de pisar: es lo único que permite volver si el bootstrap falla.
HAY_PREV=0
if [ -f "$DST" ]; then cp "$DST" "$DST.prev"; HAY_PREV=1; ok "backup del plist vigente en $DST.prev"; fi

# Rollback: restaura el plist anterior y vuelve a levantar el servicio. Se invoca en CUALQUIER
# salida por error a partir de acá — incluida una interrupción (incidente 27-ago: el script dejaba
# el Cerebro caído y el plist bueno pisado).
rollback() {
  echo "↩ revirtiendo…" >&2
  [ "$HAY_PREV" = 1 ] && cp "$DST.prev" "$DST"
  launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
  if [ "$HAY_PREV" = 1 ] && launchctl bootstrap "$DOMAIN" "$DST" 2>/dev/null && espera200; then
    echo "↩ servicio restaurado con el plist anterior (200 OK)" >&2
  else
    echo "↩ NO se pudo restaurar solo. Manual: launchctl bootstrap $DOMAIN $DST" >&2
  fi
}
trap 'rollback' INT TERM

cp "$SRC" "$DST"
ok "plist copiado a $DST"

launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
if ! launchctl bootstrap "$DOMAIN" "$DST"; then trap - INT TERM; rollback; fail "bootstrap falló"; fi
ok "job (re)cargado en ${DOMAIN}"

if espera200; then
  trap - INT TERM
  ok "http://127.0.0.1:${PORT}/ responde 200"
  exit 0
fi
trap - INT TERM; rollback
fail "el job cargó pero 127.0.0.1:${PORT} no contestó 200 (revisá ~/Library/Logs/satori-grafo-server.err.log)"
