# PAQUETE B1 — Higiene + seguridad · para Claude Code · 03-jul-2026

> **Cómo usar:** abrir Terminal → `cd "$HOME/Documents/Claude/Projects/SatoriOS"` → lanzar `claude` → pegarle: «Ejecutá PAQUETE-CODE-B1-higiene-2026-07-03.md paso a paso, verificando cada uno antes de seguir».
> **Reglas para Code:** un paso por vez; si un check no da lo esperado → FRENAR y reportar, no improvisar. Ningún `clasp push` sin la guardia del PASO 6.1. No tocar `.claude/settings.local.json` ni el VAD del agente.
> **Pre-validado por Cowork (03-jul):** `_test_inyeccion.js` ya no existe (nada que borrar) · los 2 únicos usos de `DriveApp` (`09_selftest.js:329,353`) operan sobre sheets creados por `SpreadsheetApp.create` → la condición del ENCARGO drive.file SE CUMPLE · `*.bak`, `.env.local` y `_*.txt` están gitignoreados (verificado con `git check-ignore`) · `VOZ_TOOL_SECRET` ya rotado (confirmado por Luciano 03-jul).

## PASO 0 — Pre-check (solo mirar)

```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
git status --short
```

**Qué esperar:** exactamente `M .claude/settings.local.json`, `M voz/web/serve_voz.py`, `M voz/web/voz.html`, y como untracked: ENCARGO, HANDOFF-CommandCenter, SPACE UNIVERSE 2.jpeg, 11 html CommandCenter, MAPA-UPGRADES, carina png+mp4, 5 archivos en voz/web (manifest, sw, 3 iconos), más `docs/SOP-onboarding-cliente.md`, `docs/CLAUDE-cliente-TEMPLATE.md` y este paquete (creados por Cowork 03-jul). Si aparece OTRA cosa modificada → frenar y reportar.

Si existe `.git/index.lock` con git sin correr: `rm -f .git/index.lock` (verificar antes con `ps aux | grep git` que no haya un git activo).

## PASO 1 — Commit de la PWA de voz (ya validada en vivo el 30-jun)

```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
git add voz/web/voz.html voz/web/serve_voz.py voz/web/manifest.webmanifest voz/web/sw.js voz/web/icon-180.png voz/web/icon-192.png voz/web/icon-512.png
git commit -m "Voz A' fase ii: PWA movil por Tailscale - iOS, sala e identidad unicas por sesion, tecleo por estado del agente"
```

**Qué esperar:** commit con 7 archivos. `git status --short` ya no muestra nada en `voz/web/`.

## PASO 2 — Archivar iteraciones de diseño + commit del norte visual

```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
mkdir -p _design-archivo
mv SatoriOS-CommandCenter-v2-zen-futurista.html SatoriOS-CommandCenter-v3-zen-futurista.html SatoriOS-CommandCenter-v4-zen-futurista.html SatoriOS-CommandCenter-v5-zen-futurista.html SatoriOS-CommandCenter-v6-zen-futurista.html SatoriOS-CommandCenter-v7-zen-futurista.html SatoriOS-CommandCenter-v8-zen-futurista.html SatoriOS-CommandCenter-v10-zen-futurista.html carina_3d_cinematic.png carina_3d_parallax.mp4 _design-archivo/
printf "_design-archivo/\n" >> .gitignore
git add .gitignore "SPACE UNIVERSE 2.jpeg" SatoriOS-CommandCenter-v9-zen-futurista.html SatoriOS-CommandCenter-v10img-zen-futurista.html SatoriOS-CommandCenter-NORTE-zen-futurista.html HANDOFF-SatoriOS-CommandCenter-v9-2026-06-30.md SatoriOS-MAPA-UPGRADES-abrir-la-cabeza-2026-06-30.md
git commit -m "Command Center: norte visual v9 y v10img zen-futurista + handoff + mapa de upgrades; iteraciones v2-v8 y media pesada archivadas fuera de git"
```

**Por qué:** v10img = NORTE ELEGIDO (se porta a `08_webapp`); v9 = spec de widgets; v2–v8 + video parallax + media pesada (12 MB) = historial, no van a git (quedan en `_design-archivo/`, gitignoreada).
**Qué esperar:** commit con 7 archivos; los html v2–v8 ya no aparecen en `git status`.
**Nota:** el HANDOFF-CommandCenter referencia `SatoriOS-CommandCenter-v10-...html` — ahora vive en `_design-archivo/` (variante archivada, sigue sin ser el norte).

## PASO 3 — Docs de onboarding (B2, creados por Cowork) + HANDOFF + ENCARGO al repo

```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
cp "$HOME/Documents/Claude/Projects/SATORI · Asesoramiento y consultoría/HANDOFF.md" HANDOFF.md
git add HANDOFF.md ENCARGO-Code-scope-drive-2026-06-29.md docs/SOP-onboarding-cliente.md docs/CLAUDE-cliente-TEMPLATE.md PAQUETE-CODE-B1-higiene-2026-07-03.md
git commit -m "HANDOFF 03-jul + ENCARGO scope drive + SOP onboarding cliente + template CLAUDE por cliente"
```

**Qué esperar:** el `HANDOFF.md` del repo pasa de la versión 29-jun a la vigente (Cowork la actualiza el 03-jul antes de que corras esto); commit con 5 archivos.

## PASO 4 — Borrar backups con secretos y temporales (git no los ve, es limpieza de disco)

```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
rm -f voz/agent/.env.local.20260630-101326.bak
rm -f voz/web/voz.html.20260630-083016.bak voz/web/voz.html.20260630-091123.bak voz/web/voz.html.20260630-102919.bak voz/web/voz.html.20260630-105605.bak voz/web/voz.html.20260630-111558.bak
rm -f voz/web/serve_voz.py.20260630-083016.bak voz/web/serve_voz.py.20260630-105605.bak
```

**Por qué el primero es el importante:** `.env.local.*.bak` contiene una copia de secretos (LiveKit/OpenAI/ElevenLabs). Menos copias = menos superficie. **Conservar** `voz/agent/agent.py.prePulido.bak`, `.preA.bak` y `.preNoBg.bak` (backups funcionales listados en el HANDOFF).
**Qué esperar:** `find . -name "*.bak" -not -path "./.git/*"` lista solo los 3 de `agent.py` + `.clasp.json.personal.bak` + `index.html.bak` si existe.

## PASO 5 — Deuda menor de agent.py (YA RESUELTA por Cowork 03-jul; verificar + commitear + reiniciar)

Cowork ya hizo y verificó: docstring actualizado al pipeline real (Deepgram+ElevenLabs+Silero, regla «VAD no se toca» inline) + import huérfano eliminado (`BackgroundAudioPlayer, AudioConfig, BuiltinAudioClip` — confirmado 0 usos, resto del thinking-sound quitado el 30-jun) + `py_compile` verde.

1. Verificación independiente (tuya):
```
cd "$HOME/Documents/Claude/Projects/SatoriOS/voz/agent"
python3 -m py_compile agent.py && echo COMPILA
grep -c "BackgroundAudioPlayer" agent.py
```
**Qué esperar:** `COMPILA` y `0`. **NO tocar nada del VAD (`silero`) aunque esté deprecation-warned — regla dura del HANDOFF.**
2. Commit: `git add voz/agent/agent.py && git commit -m "agent.py: docstring al pipeline real + limpia import huerfano - deuda purga 30-jun"`.
3. Reiniciar el agente SOLO si Luciano no está usando la voz en ese momento:
```
launchctl kickstart -k gui/$(id -u)/com.satori.voz.agent
sleep 5
tail -5 "$HOME/Library/Logs/satori-voz-agent.log"
```
**Qué esperar:** el log muestra arranque limpio y «registered worker» (o equivalente) sin traceback. Si hay traceback → `git checkout voz/agent/agent.py` + kickstart de nuevo + reportar.

## PASO 6 — ENCARGO: scope `drive` → `drive.file` (el único paso que toca GAS)

### 6.1 Guardia anti-pisado (obligatoria, regla del 30-jun)
```
rm -rf /tmp/gas-head && mkdir -p /tmp/gas-head
cp "$HOME/Documents/Claude/Projects/SatoriOS/.clasp.json" /tmp/gas-head/
cd /tmp/gas-head && clasp pull
diff -rq "$HOME/Documents/Claude/Projects/SatoriOS/src" /tmp/gas-head/src
```
**Qué esperar:** sin diferencias (o solo las esperadas de este paquete). Si GAS tiene algo que el repo no → FRENAR y reconciliar antes de pushear.

### 6.2 Aplicar el diff del ENCARGO
```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
cp src/appsscript.json src/appsscript.json.bak-2026-07-03
```
Editar `src/appsscript.json`: cambiar `"https://www.googleapis.com/auth/drive"` por `"https://www.googleapis.com/auth/drive.file"`. **NO tocar `webapp.access: DOMAIN`** (regla 30-jun: el MYSELF viejo rompe el CM).

```
cd "$HOME/Documents/Claude/Projects/SatoriOS" && clasp push
git add src/appsscript.json && git commit -m "Bastion: scope drive a drive.file - menor privilegio, ENCARGO 29-jun"
```

### 6.3 — 🔐 LUCIANO (no delegable: OAuth + criterio)
1. **Qué:** crear una implementación de TEST y re-autorizar. **Por qué:** bajar el scope fuerza re-consentimiento y hay que probar que el selfTest sigue pudiendo borrar sheets de prueba ANTES de tocar prod. **Dónde:** editor GAS del MAESTRO → Implementar → Nueva implementación → App web → copiar la URL `/exec` de TEST.
2. Abrir esa URL → Google te pide consentir de nuevo → **verificá que pida Drive «archivos creados por esta app», NO «todo tu Drive»**. Si pide todo el Drive → frenar y avisar.
3. Editor GAS → correr `selfTest()`. **Qué esperar:** verde completo, sin `PERMISSION_DENIED` (los casos que crean y borran cliente de prueba son los que validan el scope nuevo).
4. Si verde → avisale a Code para promover la versión al deployment de prod y registrar en `_bastion/CHANGELOG-SEGURIDAD.md`. Si falla → rollback: `mv src/appsscript.json.bak-2026-07-03 src/appsscript.json && clasp push`.

## PASO 7 — 🔐 LUCIANO — 2 minutos de UI (o me los delegás por Chrome)

1. **Rechazar APR-0001.** Qué: la aprobación de prueba que dejó el test de inyección del 26-jun. Por qué: higiene — que la cola de aprobaciones refleje solo lo real. Dónde: Command Center → Aprobaciones → APR-0001 → Rechazar (motivo: «test purga 26-jun»).
2. **Rastrear la tarea fallida.** Qué: `Cola_tareas` tiene `errores:1` desde el 22-jun. Por qué: puede ser ruido viejo o un fallo que se repite — hay que saber cuál. Dónde: Sheet MAESTRO → pestaña `Cola_tareas` → filtrar `status = fallida` → leer columna de error → si es vieja/one-off: marcarla `descartada`; si es reciente/repetida: pasarle el texto del error a Code.

## PASO 8 — Verificación de cierre (Code)

```
cd "$HOME/Documents/Claude/Projects/SatoriOS"
git log --oneline -6
git status --short
launchctl list | grep com.satori.voz
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/
```

**Qué esperar:** 5–6 commits nuevos arriba · status limpio (salvo `.claude/settings.local.json`, que queda como está) · 2 servicios `com.satori.voz.*` con status 0 · HTTP `200`. Reportar el resultado en una línea por check + actualizar HANDOFF.md (sección Estado vigente) con «B1 higiene CERRADA».
