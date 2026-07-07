#!/usr/bin/env bash
# voz_watchdog.sh — anti-zombie del agente de voz (07-jul-2026).
# Modo de fallo real (04-jul): corte de red -> el worker agota 16 reintentos ->
# "failed to connect to livekit after 16 attempts" -> el proceso queda muerto/zombie
# y KeepAlive no siempre lo repone. Este watchdog corre cada 5 min por launchd:
# si en el log la ultima muerte terminal es POSTERIOR al ultimo "registered worker",
# hace kickstart -k (mata lo que haya y relanza). Si el agente esta sano, no hace nada.
set -u
LOG="$HOME/Library/Logs/satori-voz-agent.log"
WLOG="$HOME/Library/Logs/satori-voz-watchdog.log"
[ -f "$LOG" ] || exit 0

ULT_OK="$(grep -n 'registered worker' "$LOG" | tail -1 | cut -d: -f1)"
ULT_FATAL="$(grep -nE 'failed to connect to livekit after|Error in _connection_task' "$LOG" | tail -1 | cut -d: -f1)"

[ -z "$ULT_FATAL" ] && exit 0
if [ -z "$ULT_OK" ] || [ "$ULT_FATAL" -gt "$ULT_OK" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') worker caido (fatal linea $ULT_FATAL vs ok linea ${ULT_OK:-0}) -> kickstart -k" >> "$WLOG"
  /bin/launchctl kickstart -k "gui/$(id -u)/com.satori.voz.agent"
fi
exit 0
