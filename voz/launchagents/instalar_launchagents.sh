#!/usr/bin/env bash
# instalar_launchagents.sh — repone la voz AHORA y la blinda contra el modo de fallo del 04-jul.
# Instala los 3 LaunchAgents versionados (agente KeepAlive incondicional + server + watchdog anti-zombie),
# recarga launchd y levanta el agente muerto. Correr EN EL MAC:
#   bash ~/Documents/Claude/Projects/SatoriOS/voz/launchagents/instalar_launchagents.sh
set -u

DIR="$HOME/Documents/Claude/Projects/SatoriOS/voz/launchagents"
DEST="$HOME/Library/LaunchAgents"
UID_N="$(id -u)"

cd "$DIR" || { echo "ABORT: no existe $DIR"; exit 1; }

echo "== 1/4 validar plists =="
for p in com.satori.voz.agent.plist com.satori.voz.server.plist com.satori.voz.watchdog.plist; do
  plutil -lint "$p" || { echo "ABORT: $p invalido"; exit 1; }
done
bash -n voz_watchdog.sh || { echo "ABORT: watchdog con error de sintaxis"; exit 1; }
[ -x "$HOME/Documents/Claude/Projects/SatoriOS/voz/agent/.venv/bin/python" ] || { echo "ABORT: falta el python del venv"; exit 1; }

echo "== 2/4 descargar versiones viejas de launchd =="
launchctl bootout "gui/$UID_N/com.satori.voz.agent" 2>/dev/null && echo "agent viejo descargado" || echo "agent no estaba cargado"
launchctl bootout "gui/$UID_N/com.satori.voz.server" 2>/dev/null && echo "server viejo descargado" || echo "server no estaba cargado"
launchctl bootout "gui/$UID_N/com.satori.voz.watchdog" 2>/dev/null && echo "watchdog viejo descargado" || echo "watchdog no estaba (primera vez)"
echo "espero 3s a que launchd libere los labels (evita el Input/output error 5)..."
sleep 3

# bootstrap con reintentos: tras un bootout, launchd puede tardar en soltar el label (EIO transitorio).
bootstrap_retry(){
  local label="$1" plist="$2" i
  launchctl enable "gui/$UID_N/$label" 2>/dev/null
  for i in 1 2 3 4; do
    if launchctl bootstrap "gui/$UID_N" "$plist" 2>&1; then
      echo "$label cargado (intento $i)"
      return 0
    fi
    echo "  bootstrap de $label fallo (intento $i) — reintento en 3s..."
    sleep 3
  done
  echo "ABORT: bootstrap de $label fallo tras 4 intentos. Diagnostico:"
  launchctl print "gui/$UID_N/$label" 2>&1 | head -12
  return 1
}

echo "== 3/4 instalar y cargar =="
cp com.satori.voz.agent.plist com.satori.voz.server.plist com.satori.voz.watchdog.plist "$DEST/"
chmod +x voz_watchdog.sh
bootstrap_retry "com.satori.voz.agent" "$DEST/com.satori.voz.agent.plist" || exit 2
bootstrap_retry "com.satori.voz.server" "$DEST/com.satori.voz.server.plist" || exit 2

echo "== 4/4 verificar (espero 8s a que el agente se registre) =="
sleep 8
echo "--- procesos ---"
pgrep -fl "agent.py|serve_voz.py" || echo "SIN PROCESOS: revisar logs"
echo "--- ultimas lineas del log del agente ---"
tail -5 "$HOME/Library/Logs/satori-voz-agent.log"
echo "--- watchdog (se carga al final, con el agente ya registrado) ---"
bootstrap_retry "com.satori.voz.watchdog" "$DEST/com.satori.voz.watchdog.plist" || exit 2
echo "watchdog activo (chequea cada 5 min)"
echo ""
echo "Si arriba aparece un 'registered worker' con fecha/hora de AHORA: la voz esta viva."
echo "Proba en el navegador: recarga dura Cmd-Shift-R en la pagina de voz y toca Hablar con Sato."
echo "LISTO."
