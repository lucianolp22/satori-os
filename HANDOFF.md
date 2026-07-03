# HANDOFF — Satori OS — 2026-06-30

PRÓXIMO PASO: **(1)** `PAQUETE-CODE-B1-higiene-2026-07-03.md` — Code ejecutó pasos 1–6.2 + 8 (03-jul): 5 commits (PWA, norte visual, docs+HANDOFF, agent.py, scope) + limpieza de backups con secretos + `drive`→`drive.file` **pusheado a GAS** + agente de voz reiniciado sano. **PENDIENTE 🔐 Luciano:** PASO 6.3 (crear deploy TEST → re-autorizar OAuth verificando que pida Drive «archivos creados por esta app», NO todo el Drive → correr `selfTest()`; si verde, promover a prod y registrar en `_bastion/CHANGELOG-SEGURIDAD.md`; rollback = `mv src/appsscript.json.bak-2026-07-03 src/appsscript.json && clasp push -f`) y PASO 7 (rechazar APR-0001; rastrear `Cola_tareas` errores:1 del 22-jun). **(2)** B2 cerrar: alta ficticia end-to-end siguiendo `docs/SOP-onboarding-cliente.md` (creado 03-jul). **(3)** B4 portar CM v10img a `08_webapp` — **3 preguntas §5 RESPONDIDAS por Luciano (03-jul):** orbe = **Three.js 3D existente** re-esteticado a Alba/naranja connectome (la barrera era solo el bloom UnrealBloomPass, revertido; replicar el glow del v9 sin bloom) · Tareas = **pestaña MAESTRO** (+ migración única desde Trello) · cableado = **lo que ya existe** (Estado 16_salud + Actividad 13_agentes + Brief 18_direccion reales; Tareas/Calendario mock hasta construirse). *(Programa cierre dev, firme: onboarding → backup/snapshot → purga sistema completo → build-in-public/cartera → datos cliente + RGPD + puesta en marcha [FINAL].)* **Voz A' fases (i)+(ii): CERRADAS (30-jun).** Plan integral: `PLAN-ACCION-INTEGRAL-SatoriOS-2026-07-02.md` (consultoría).

## Estado vigente
Satori OS = ERP multi-tenant **GAS + Sheets** en prod (`luciano@satoriconsultoria.com`). **Voz integrada al Centro de Mando: COMPLETA + A' fase (i) CERRADA (30-jun) + A' fase (ii) PWA MÓVIL CERRADA (30-jun).** Te parás en el CM, tocás "🎙 Hablar con Sato" y **el mismo orbe (Three.js, estilo Trillion) te habla con la voz grave de Sato** (pipeline ElevenLabs/Deepgram), con chatlog y entrada de texto. **Ahora también desde el iPhone como PWA por Tailscale** (`https://lucianos-macbook-pro.tail4115b8.ts.net`, tailnet-only, instalable a inicio). Corre self-hosted con **auto-arranque** (LaunchAgents); el **24/7 en la nube sigue diferido** (alta prioridad). **[30-jun] HEAD de GAS resincronizado con el repo:** el botón está en `/dev` (confirmado visual) y promovido a `/exec` (deployment `AKfycbxZJL4E`); `appsscript.json` access = `DOMAIN`.

### Verificado [29-jun]
- **Voz-en-CM end-to-end:** botón en el CM (`target="_top"`, misma ventana, no popup) → página de voz local → LiveKit + OpenAI Realtime. Orbe 3D portado del CM + **reactivo a la voz de Sato** (AnalyserNode sobre el audio del agente). Confirmado por Luciano (orbe 3D, reactividad, mic MacBook).
- **Constraint micrófono:** el iframe sandbox de GAS bloquea `getUserMedia` (doc oficial Apps Script). Por eso la voz vive en página local (`http://127.0.0.1:8787`, secure context). Confirmado.
- **Token:** lo mintea el **server local** (`serve_voz.py`) con el secreto de `.env.local`; NUNCA va al browser. TTL 120min, sala `satori-os-desktop`, loopback.
- **Chat:** transcripción en vivo (`registerTextStreamHandler('lk.transcription')`) + escribirle por texto (`localParticipant.sendText` a `lk.chat`, que el agente ya escucha por default). **Cero cambios en la lógica del agente** para el chat. Confirmado.
- **Auto-arranque:** LaunchAgents `com.satori.voz.agent` + `com.satori.voz.server` (RunAtLoad + KeepAlive). launchctl status 0, procesos vivos. Resuelve el "connection refused" (server siempre vivo). Confirmado.
- **Latencia:** medida = **~13s/llamada CONSTANTE** (overhead de GAS: 2 requests por el 302 + leer Sheets; NO cold-start; el token ya se cachea en `gas_voz_client`). Mitigada con **thinking sounds** (`BackgroundAudioPlayer` KEYBOARD_TYPING) + **filler de prompt**. Agente reinició sano y registrado. Confirmado "funciona OK".
- **Parches Purga voz:** reduced-motion (orbe ya no invisible), doble sample-loop, botón volver con fallback, TTL 30→120.

### Verificado [30-jun] — A' fase (i): voz grave
- **Swap de voz HECHO y en vivo:** `agent.py` pasó de OpenAI Realtime a **pipeline LiveKit**: `deepgram.STT(nova-3, multi)` + `openai.LLM(gpt-4o-mini)` + `elevenlabs.TTS(eleven_turbo_v2_5, es, voice_id de .env.local)` + `silero.VAD.load()`. Voz grave de Sato confirmada por Luciano con respuesta de datos reales.
- **Filler hablado preservado**; **thinking-sound (`BackgroundAudioPlayer`) QUITADO** — publicaba un track de audio separado que `voz.html` atachaba al mismo `<audio>` que el TTS → el ruido de teclado tapaba la voz. Hoy: solo el filler de prompt.
- **ElevenLabs:** el free tier NO incluye API (HTTP 402) → Luciano contrató **Starter (~5 USD/mes)**. Test post-pago OK (14/15 frames con audio).
- **Mic SIEMPRE Mac, NUNCA iPhone (30-jun):** fix determinístico en `voz.html` — `pickMacMicId()` elige el device del Mac (matcher reforzado: built-in/macbook/integrado/…; excluye iphone/continuity) y se fija como `audioCaptureDefaults` **antes** de conectar (captura directa, sin ventana inicial) + re-forzado en `devicechange`. Validado `node --check` + `bash -n`; deploy `ks_mic_mac.sh` (reinicia solo el server, no el agente).
- **`PYTHONUNBUFFERED=1`** ya en ambos plist (logs sin buffer).

### Verificado [30-jun] — A' fase (ii): PWA móvil por Tailscale
- **PWA en el iPhone (15 Pro Max), validada en vivo ~4 min estable:** servida por **Tailscale Serve** (`https://lucianos-macbook-pro.tail4115b8.ts.net`, **tailnet-only**, sin exposición a internet; el server sigue en `127.0.0.1`, Tailscale hace el TLS). El CLI vive en `/Applications/Tailscale.app/Contents/MacOS/Tailscale` (variante App Store). Comando: `tailscale serve --bg 8787`; apagar `tailscale serve off`. Instalable a inicio (manifest + sw pass-through + apple-meta + iconos del orbe).
- **Camino A (no el stack WS de Kevin):** PWA sobre la voz LiveKit existente. Trucos iOS aplicados al cliente: `viewport-fit=cover`+`100dvh`+safe-area, desbloqueo de audio en el gesto (`primeAudio` + WAV silencioso + `AudioContext.resume`), mic condicional (móvil usa SU mic vía `IS_TOUCH`, no fuerza el Mac), `Cache-Control: no-store` en el shell (override en `serve_voz.py`). Audio audible por `<audio>` (ignora silent switch).
- **Voz nueva:** `ELEVENLABS_VOICE_ID=xcAUMhbpNX2WRGsuhjFy` en `.env.local` (cambio por `ks_voz_cambiar.sh`, backup `.bak`). Confirmada.
- **STT + AirPods:** el mic Bluetooth (HFP ~16kHz) degrada la transcripción → con el **mic del iPhone transcribe bien**. NO es bug, es limitación de iOS/BT. Se forzó `echoCancellation/noiseSuppression/autoGainControl` en la captura.
- **Tecleo de espera (thinking-sound) reintroducido EN EL CLIENTE** (WebAudio sintético, NO track del agente → no tapa la voz, a diferencia del descarte del 30-jun). Disparado por el **estado real del agente** (`RoomEvent.ParticipantAttributesChanged` → `lk.agent.state==='thinking'`), así cubre la espera **post-filler**. Confirmado.
- **Conexión a prueba de cortes (fix del incidente):** `serve_voz.py` mintea **sala e identidad ÚNICAS por sesión** (`satori-os-desktop-<hex>` / `luciano-<hex>`). Resuelve el **job huérfano** que bloqueaba la reconexión tras una desconexión abrupta (cerrar la app / bloquear el iPhone mientras Sato consulta). Confirmado: sale/entra varias veces sin bloqueo.
- **Orbe móvil aligerado:** 900 puntos + `pixelRatio 1` si `IS_TOUCH` (vs 1500/1.5 en desktop). Fluido en el 15 Pro Max.
- **Deploy:** `ks_pwa_deploy.sh` (copia 7 archivos al repo, reinicia SOLO el server, diff+backup+verificación curl). Runbook: `RUNBOOK-voz-PWA-movil.md`.

### No verificado
- Si el thinking-sound cubre TODA la tool de 13s o solo parte (Luciano dijo "OK").
- `PYTHONUNBUFFERED` en los plist → logs del agente/server salen buffered (observabilidad limitada).

## Pendiente
**Must (programa cierre dev), en orden:** onboarding repetible → backup/snapshot → purga sistema completo → build-in-public/cartera (11 candidatos) → datos+RGPD+puesta en marcha (FINAL).
**Must seguridad:** ENCARGO `appsscript.json` `drive`→`drive.file` (procedimiento en `ENCARGO-Code-scope-drive-2026-06-29.md`).
**VOZ — A' fase (i) desktop-CM: CERRADA (30-jun).** Voz grave en vivo (pipeline ElevenLabs/Deepgram; ver "Verificado [30-jun]").
**VOZ — A' fase (ii) PWA móvil: CERRADA (30-jun).** iPhone por Tailscale Serve (HTTPS tailnet-only), trucos iOS, voz nueva, tecleo por estado del agente, sala/identidad única (anti-zombie). Ver "Verificado [30-jun] — A' fase (ii)". Deuda menor de la purga (no bloqueante): docstring viejo + import huérfano en `agent.py`; limpiar `.bak`; vigilar sesiones LiveKit concurrentes. Queda:
**A' fase (iii) — VPS 24/7 (opción D, DigitalOcean): DIFERIDO** (alta prioridad; confirmar con Luciano token readonly en la nube).
**⚠ Regla dura A' (no repetir el error 30-jun):** **el VAD NO se toca.** Quitar `vad=silero.VAD.load()` rompió la voz (sin VAD se cae el turn-detection, peor cuando el "adaptive interruption" cloud de LiveKit se desconecta — status 1006). El plugin `livekit-plugins-silero` está deprecado → es solo **warning cosmético = DEUDA ACEPTADA**, NO removerlo.

**Should (diferido, aparte de A'):**
- **Latencia de raíz = opción C** (tool-backend fuera de GAS: serverless + Sheets API con service account scopeada) → baja el piso de 13s a <1s. Proyecto.
- **Cache en GAS (45s)** para re-consultas de estado/brief — más liviano que C; toca el deployment del doPost (verificar si sirve HEAD o versión fija).
**Nice:** ~~`PYTHONUNBUFFERED=1` en los plist~~ HECHO · ~~commit a git de la voz~~ HECHO (30-jun) · borrar `.bak`/`_*dump.txt` temporales · orbe de voz con grafo real del cerebro (hoy decorativo). *(thinking-sound: descartado, tapaba la voz.)*

## Artefactos
| Tipo | Nombre | Ruta / ID |
|---|---|---|
| Página de voz | voz.html | repo `voz/web/voz.html` (orbe 3D + chat + selector de mic) |
| Server voz | serve_voz.py | repo `voz/web/serve_voz.py` (127.0.0.1:8787, mint JWT) |
| SDK vendored | livekit-client 2.19.2 | `voz/web/vendor/livekit-client.umd.min.js` (`sha384-127djkfLRSzKREYQxQkpbPAmr5O+XoKg7sLxaUwFTOjXeCSnZGscfVUF2sMhJCh7`) |
| Agente (pipeline A') | agent.py | `voz/agent/agent.py` (Deepgram+OpenAI+ElevenLabs+Silero VAD + filler; **sin** thinking-sound). Backup funcional: `agent.py.prePulido.bak` (+ `.preA.bak`=Realtime, `.preNoBg.bak`=con thinking-sound) |
| Botón CM | cmVoz (`target="_top"`) | `src/index.html` (`.cm-btn.voz`, antes de `cmCapturar`); backup `index.html.bak` |
| LaunchAgents | voz.agent + voz.server | `~/Library/LaunchAgents/com.satori.voz.{agent,server}.plist`; logs `~/Library/Logs/satori-voz-*.log` |
| Apagar la voz | — | `launchctl bootout gui/$(id -u)/com.satori.voz.{agent,server}` |
| Scripts de trabajo | ks_voz_*.sh / ks_lat_*.* / ks_onboarding_lee.sh | carpeta consultoría |
| Proyecto LiveKit | satori-os | `wss://satori-os-wyp47981.livekit.cloud`; creds en `.env.local` |
| Proyecto GAS | MAESTRO | scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` |
| /dev CM | Centro de Mando | `https://script.google.com/a/macros/satoriconsultoria.com/s/AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I/dev` |

## Desvíos del plan original
- **Voz-en-CM (29-jun PM):** desvío priorizado por Luciano por encima del onboarding. **COMPLETA.** El "orbe que habla" = pedido explícito ("copia Trillion"); resuelto con réplica local del orbe + navegación `_top`.
- **Voz 24/7-nube** sigue diferido (alta prioridad). Anda self-hosted con auto-arranque mientras tanto.
- Datos+RGPD+puesta en marcha AL FINAL (firme).

---
## Apéndice histórico
{Se lee solo si un problema reaparece o se cuestiona una decisión.}

### Decisiones y descartes
- **[30-jun] `appsscript.json` webapp.access = DOMAIN (Bastión):** el HEAD de GAS sirve con `DOMAIN` (URLs `/a/macros/satoriconsultoria.com/`); el repo tenía `MYSELF` viejo (15-jun). Se preservó DOMAIN y se alineó el repo. NO volver a MYSELF sin querer (rompe el acceso del CM y las URLs de dominio).
- **[30-jun] A' fase (i) ejecutada:** pipeline Deepgram+OpenAI+ElevenLabs+Silero. Thinking-sound DESCARTADO (track separado tapaba el TTS). VAD Silero = NO se toca (quitarlo rompe el turn-detection; deprecación = warning cosmético). Mic = SIEMPRE Mac vía `audioCaptureDefaults` (el default del sistema agarraba el iPhone por Continuity). ElevenLabs Starter pago (free no da API).
- **[29-jun research] Voz A' = LiveKit + ElevenLabs/Deepgram** (NO adoptar el stack WS-custom de Kevin ni perder LiveKit; NO seguir con OpenAI Realtime). Motivo: reusar todo lo que ya anda + ganar el timbre grave de Sato. El brain (GAS, ~13s) NO cambia con A'. Los 9 trucos iOS de Kevin aplican a cualquier cliente browser (incluido LiveKit) = el oro a minar. Detalle en `PROMPT-Kevin-voice-PWA.md`. Pendiente de arranque (keys + go de Luciano).
- **[29-jun PM] Micrófono embebido en el iframe de GAS: DESCARTADO** (getUserMedia bloqueado por permissions policy; doc oficial Apps Script). La voz vive en página local.
- **[29-jun PM] Acceso a la voz = botón `target="_top"`** (misma ventana, no popup). Requiere server vivo → lo garantiza el auto-arranque.
- **[29-jun PM] Token = mint LOCAL (server)** sobre GAS-mint: el secreto ya está en `.env.local`; GAS-mint lo duplicaría sin reducir exposición.
- **[29-jun PM] Filler garantizado vía `session.say`: DESCARTADO** (requiere TTS; el Realtime no lo tiene). Se usó `BackgroundAudioPlayer` (thinking sounds) + prompt.
- **[29-jun PM] Latencia de raíz** = 13s = overhead de GAS (no cold-start). Bajarlo = opción C (sacar de GAS).
- Decidido (29-jun AM): Voz always-on self-hosted (agent.py dev + LiveKit Cloud); 24/7-nube diferido; acceso = web/PWA, no telefonía.
- Descartado (29-jun): `drive.file` para el token del agente — el gate del web app lo rechaza (404). `readonly` obligatorio. NO re-intentar.
- Decidido (27-jun): kill switch = pausa operativa (no corte total); alertas email = opt-in default OFF (Bastión).
- Decidido: Opción A (caller = luciano@, dueño); os@ dada de baja; voz `ash`.
- Descartado: ElevenLabs (por ahora) · luciano@ admin en server always-on en la nube (Bastión veta) · runtime propio del pipeline · SA externa para el gate (Workspace la rechaza).

### Imprevistos y resolución
- [30-jun] **/dev perdió el botón tras desplegar a /exec.** Diagnóstico read-only (pull del HEAD a tmp + diff): el HEAD de GAS no tenía el botón ni las alertas (27-jun) — el repo nunca se pusheó del todo. Además `appsscript.json` divergía: GAS=`DOMAIN` (vivo/correcto), repo=`MYSELF` (15-jun, viejo). **Reglas aprendidas: (1) SIEMPRE diff repo↔GAS antes de `clasp push` — guardia que aborta si un `.js`/`.json` se pisaría; (2) el acceso vivo es DOMAIN, no pushear el MYSELF viejo; (3) `clasp push` sube TODO el rootDir, no un archivo suelto.** Los `.js` del CM aparecían "sin historial" en git → el commit de cierre los versionó.
- [29-jun PM] "connection refused" al tocar el botón = server local no corriendo → auto-arranque (LaunchAgent RunAtLoad+KeepAlive) lo resuelve de raíz.
- [29-jun PM] Logs del LaunchAgent vacíos = buffering de Python (stdout a archivo) → `PYTHONUNBUFFERED` pendiente.
- [29-jun PM] El entorno de Cowork no instala faster-whisper (proxy 403) → no se pudo transcribir el video de Trillion automáticamente.
- [29-jun] El `#` inline en comandos pegados rompe el zsh de Luciano → comandos limpios; multi-paso = script desde archivo.
- [29-jun] `python agent.py dev` ocupa la terminal; ahora corre de fondo por LaunchAgent.
- [29-jun] Agente con `agent_name` fijo = dispatch explícito → sin `agent_name` = auto-dispatch (se une a cualquier sala del proyecto privado).
- [27-jun] `clasp push` → `invalid_rapt` → `clasp login`.
- [27-jun] El Centro de Mando NO es auto-screenshoteable (iframe cross-origin GAS) → render-check = eyeball de Luciano.
- [25-jun] 403 de os@ = política de Workspace; URL siempre formato-dominio `/a/macros/satoriconsultoria.com/s/.../`; `--location-trusted` por el 302.

### Changelog del handoff
- **[03-jul] Sesión Cowork — verificación total + B1/B2 arrancadas:** Repo + Cerebro montados y auditados. Hallazgos: (1) rediseño CM YA tiene norte aprobado (`v10img` zen-futurista, 30-jun; pendiente real = portar a `08_webapp` + cablear widgets, 3 preguntas abiertas §5 del HANDOFF-CM); (2) PWA voz sin commitear en el repo (working tree sucio); (3) `CLAUDE.md` del repo = versión vieja pre-v14; (4) `_test_inyeccion.js` ya borrado (0.3 hecha); (5) condición del ENCARGO drive.file PRE-VALIDADA (DriveApp solo sobre sheets propios); (6) `.env.local.*.bak` con secretos detectado (gitignoreado, pero se borra); (7) `estadoVigente()` YA existe (`18_direccion.js`, selfTest D1/D3) → gap "estado-vigente" de los casos paralelos es menor; (8) 4º caso ya analizado (Hermes/Nous deep-research 29-jun, gaps #1-#5 → Etapa 8). HECHO por Cowork: `docs/SOP-onboarding-cliente.md` + `docs/CLAUDE-cliente-TEMPLATE.md` (B2 núcleo) + `PAQUETE-CODE-B1-higiene-2026-07-03.md` (bash triple-revisado) + agent.py docstring/import huérfano corregidos (py_compile verde; falta commit+kickstart vía paquete). `VOZ_TOOL_SECRET` rotado (confirmó Luciano). Logo/marca DEFINIDOS (enso+Alba, Fraunces/Hanken, terracota+jade; fuente `_satori-design/DESIGN-v2-zen-futurista.md`).
- **[30-jun PM] A' fase (ii) PWA móvil CERRADA:** PWA en el iPhone por **Tailscale Serve** (tailnet-only, HTTPS válido; server sigue en loopback). Camino A (LiveKit + trucos iOS, no el stack WS de Kevin). Voz nueva (`xcAUMhbpNX2WRGsuhjFy`). Tecleo de espera **en el cliente** por `lk.agent.state` (cubre post-filler). **Incidente "no levanta" RESUELTO:** era un **job huérfano** por sala/identidad fijas tras desconexión abrupta → ahora **sala+identidad ÚNICAS por sesión** en `serve_voz.py`. Orbe móvil 900pts/pixelRatio 1. Mic: AirPods (BT) degrada el STT; mic del iPhone OK. Purga de cierre: **0 críticos / 0 altos**, 7 menores (deuda). **Pedido Luciano:** rediseño visual del orbe + fondo + interfaz del CM (futuro, `satori-design`). Scripts nuevos: `ks_pwa_deploy.sh`, `ks_voz_cambiar.sh`, `ks_voz_reinicio_agente.sh`, `ks_voz_diag2.sh`. Runbook: `RUNBOOK-voz-PWA-movil.md`.
- **[30-jun madrugada] Incidente /dev sin botón RESUELTO:** al desplegar a /exec, el /dev dejó de mostrar el botón. Causa: el HEAD de GAS estaba desincronizado del repo (faltaba pushear el botón + el commit de alertas del 27-jun) y el repo tenía un `appsscript.json` viejo (`MYSELF`) vs GAS (`DOMAIN`). Fix con guardia anti-pisado: alineé `appsscript.json`→DOMAIN, pusheé (botón + alertas + DOMAIN), verifiqué. /dev OK (confirmado visual). /exec promovido a versión nueva sobre `AKfycbxZJL4E`. Commit del repo alineado. Scripts: `ks_dev_diag.sh` / `ks_dev_diff_detalle.sh` / `ks_dev_fix2.sh` / `ks_cierre_dev.sh`.
- **[30-jun] A' fase (i) — voz grave CERRADA:** swap `agent.py` a pipeline LiveKit (Deepgram nova-3 + OpenAI gpt-4o-mini + ElevenLabs eleven_turbo_v2_5 voz grave + Silero VAD). Thinking-sound quitado (tapaba la voz); filler hablado preservado. ElevenLabs Starter contratado. Mic forzado SIEMPRE al Mac (`pickMacMicId` + `audioCaptureDefaults`). Regla dura: NO tocar el VAD (warning Silero = deuda aceptada). `PYTHONUNBUFFERED=1` aplicado. Commit dejado. Pendiente A': fase (ii) PWA móvil + 9 trucos iOS; fase (iii) VPS 24/7 diferido.
- **[29-jun PM] Voz integrada al Centro de Mando CERRADA:** orbe Trillion (Three.js portado + reactivo a la voz) + chatlog (transcripción `lk.transcription` + texto `lk.chat`) + botón unificado `_top` + auto-arranque (LaunchAgents) + latencia mitigada (thinking sounds + filler). Purga de cierre sin críticos/altos. Próximo: onboarding.
- [29-jun AM] 4 etapas: kill switch + orbe pulido + alertas + voz always-on self-hosted. 24/7-nube diferido.
- [27-jun] 3 etapas: kill switch + orbe + alertas.
- [26-jun] Fase Voz local CERRADA + Purga + parches + Bastión.
- [25-jun] Integración v14 + PIPELINE; Voz bloqueada por Workspace (os@ 403).
