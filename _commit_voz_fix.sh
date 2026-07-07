#!/usr/bin/env bash
# _commit_voz_fix.sh — commitea los fixes de voz del 07-jul (posteriores a la promocion f8c8535).
# Solo git: NO toca GAS (nada de src/ cambio; voz.html local y launchagents no se pushean a GAS).
set -u
cd "$HOME/Documents/Claude/Projects/SatoriOS" || exit 1

if [ -f .git/index.lock ]; then
  if pgrep -x git >/dev/null 2>&1; then
    echo "ABORT: hay un git corriendo y existe index.lock — esperar y reintentar"
    exit 1
  fi
  echo "index.lock huerfano -> lo remuevo"
  rm -f .git/index.lock
fi

git add HANDOFF.md _promote_exec.sh _commit_voz_fix.sh voz/web/voz.html voz/launchagents voz/agent/agent.py
if git diff --cached --quiet; then
  echo "nada nuevo para commitear"
  exit 0
fi
git commit -m "Voz resiliencia 07-jul: watchdog anti-zombie + LaunchAgents versionados (KeepAlive incondicional) + installer con retry EIO; fix mic anti-flash iPhone en voz.html; HANDOFF: incidente agente muerto 04-jul" || { echo "ABORT: commit fallo"; exit 2; }
echo "commit OK"

echo "push (aca estrena el hook pre-push: va a verificar CAPABILITIES solo)..."
if GIT_TERMINAL_PROMPT=0 git push origin main; then
  echo "push OK"
else
  echo "AVISO: push fallo (auth). Manual con tu PAT:"
  echo "  git push https://lucianolp22:TU_TOKEN@github.com/lucianolp22/satori-os.git main"
fi
echo "LISTO"
