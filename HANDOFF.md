# HANDOFF — Satori OS — 2026-06-29

PRÓXIMO PASO: Retomar el programa de cierre del dev inicial por **onboarding repetible** — leer el alta de cliente (`crearCliente` en `03_cliente.js` + `setup()` en `02_setup.js` + `ACTIVACION.md`) con `ks_onboarding_lee.sh` (ya escrito en consultoría, **sin correr**), luego diseñar SOP + templates repetibles. *(Programa: onboarding → backup/snapshot → purga sistema completo → build-in-public/cartera → datos cliente + RGPD + puesta en marcha [FINAL, firme].)*

## Estado vigente
Satori OS = ERP multi-tenant **GAS + Sheets** en prod (`luciano@satoriconsultoria.com`). **Voz integrada al Centro de Mando: COMPLETA y verificada en vivo (29-jun PM).** Te parás en el CM, tocás "🎙 Hablar con Sato" y **el mismo orbe (Three.js, estilo Trillion) te habla**, con chatlog y entrada de texto. Corre self-hosted con **auto-arranque** (LaunchAgents); el **24/7 en la nube sigue diferido** (alta prioridad).

### Verificado [29-jun]
- **Voz-en-CM end-to-end:** botón en el CM (`target="_top"`, misma ventana, no popup) → página de voz local → LiveKit + OpenAI Realtime. Orbe 3D portado del CM + **reactivo a la voz de Sato** (AnalyserNode sobre el audio del agente). Confirmado por Luciano (orbe 3D, reactividad, mic MacBook).
- **Constraint micrófono:** el iframe sandbox de GAS bloquea `getUserMedia` (doc oficial Apps Script). Por eso la voz vive en página local (`http://127.0.0.1:8787`, secure context). Confirmado.
- **Token:** lo mintea el **server local** (`serve_voz.py`) con el secreto de `.env.local`; NUNCA va al browser. TTL 120min, sala `satori-os-desktop`, loopback.
- **Chat:** transcripción en vivo (`registerTextStreamHandler('lk.transcription')`) + escribirle por texto (`localParticipant.sendText` a `lk.chat`, que el agente ya escucha por default). **Cero cambios en la lógica del agente** para el chat. Confirmado.
- **Auto-arranque:** LaunchAgents `com.satori.voz.agent` + `com.satori.voz.server` (RunAtLoad + KeepAlive). launchctl status 0, procesos vivos. Resuelve el "connection refused" (server siempre vivo). Confirmado.
- **Latencia:** medida = **~13s/llamada CONSTANTE** (overhead de GAS: 2 requests por el 302 + leer Sheets; NO cold-start; el token ya se cachea en `gas_voz_client`). Mitigada con **thinking sounds** (`BackgroundAudioPlayer` KEYBOARD_TYPING) + **filler de prompt**. Agente reinició sano y registrado. Confirmado "funciona OK".
- **Parches Purga voz:** reduced-motion (orbe ya no invisible), doble sample-loop, botón volver con fallback, TTL 30→120.

### No verificado
- Si el thinking-sound cubre TODA la tool de 13s o solo parte (Luciano dijo "OK").
- `PYTHONUNBUFFERED` en los plist → logs del agente/server salen buffered (observabilidad limitada).

## Pendiente
**Must (programa cierre dev), en orden:** onboarding repetible → backup/snapshot → purga sistema completo → build-in-public/cartera (11 candidatos) → datos+RGPD+puesta en marcha (FINAL).
**Must seguridad:** ENCARGO `appsscript.json` `drive`→`drive.file` (procedimiento en `ENCARGO-Code-scope-drive-2026-06-29.md`).
**Próxima etapa de VOZ — A' (planificada 29-jun PM; brief de Luciano + research; NO arrancada):**
Quedarse con **LiveKit** (WebRTC/PWA/eco/turnos + TODO lo ya armado: orbe, chat, autostart, BackgroundAudioPlayer/thinking-sounds, filler) PERO cambiar la voz de OpenAI Realtime → **pipeline Deepgram STT + LLM + ElevenLabs TTS** (timbre grave de "Sato"). Faseo: (i) desktop-CM **[CERRADO]** → (ii) PWA móvil HTTPS + 9 trucos iOS → (iii) VPS 24/7 (opción D, DigitalOcean) **DIFERIDO** (confirmar con Luciano: token readonly en la nube). A' aplica a (i) y (ii).
  1. **Swap de voz en `agent.py`:** reemplazar `openai.realtime.RealtimeModel(...)` por pipeline LiveKit (STT=Deepgram, LLM, TTS=ElevenLabs voz grave). **PRESERVAR `BackgroundAudioPlayer`/thinking-sounds + el filler** (funcionan igual con el pipeline; no perderlos en el swap). Backup `agent.py.bak` + auto-revert. Deps: `livekit-plugins-deepgram` + `livekit-plugins-elevenlabs`. Env nuevas en `.env.local` (Bastión: gitignored, nunca al browser/repo): `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, voice ID. Probar por "Test in Console" de LiveKit. **Trade-off (Luciano):** timbre grave vs +1-2s de latencia de voz (el cuello real siguen siendo los ~13s de GAS, que A' NO cambia; los thinking-sounds enmascaran). Fallback si se siente lento: prompt "natural-convo" (hellotrillion.ai/p/natural-convo).
  2. **9 trucos iOS en `voz.html`** (recién importan al servir a un teléfono por HTTPS; hoy es desktop/127.0.0.1): MP3-no-PCM · audio doble-vía (`<audio>` audible + AudioBuffer para el orbe reactivo, bug iOS MediaElementSource→Analyser) · silent-switch (audible por `<audio>`) · `play()` primeado en el gesto · TTS endpoint non-evicting (iOS hace 2 GET) · tokens por query-param · `Cache-Control: no-store` · `100dvh`+`viewport-fit=cover` · `AudioContext.resume()` por gesto. Fuente: `PROMPT-Kevin-voice-PWA.md`.

**Should (diferido, aparte de A'):**
- **Latencia de raíz = opción C** (tool-backend fuera de GAS: serverless + Sheets API con service account scopeada) → baja el piso de 13s a <1s. Proyecto.
- **Cache en GAS (45s)** para re-consultas de estado/brief — más liviano que C; toca el deployment del doPost (verificar si sirve HEAD o versión fija).
**Nice:** `PYTHONUNBUFFERED=1` en los plist · **commit a git de la voz** · borrar `.bak`/`_*dump.txt` temporales · thinking-sound (volumen/clip) ajustable · orbe de voz con grafo real del cerebro (hoy decorativo).

## Artefactos
| Tipo | Nombre | Ruta / ID |
|---|---|---|
| Página de voz | voz.html | repo `voz/web/voz.html` (orbe 3D + chat + selector de mic) |
| Server voz | serve_voz.py | repo `voz/web/serve_voz.py` (127.0.0.1:8787, mint JWT) |
| SDK vendored | livekit-client 2.19.2 | `voz/web/vendor/livekit-client.umd.min.js` (`sha384-127djkfLRSzKREYQxQkpbPAmr5O+XoKg7sLxaUwFTOjXeCSnZGscfVUF2sMhJCh7`) |
| Agente (parcheado) | agent.py | `voz/agent/agent.py` (thinking sounds + filler); backup `agent.py.bak` |
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
- **[29-jun PM] Voz integrada al Centro de Mando CERRADA:** orbe Trillion (Three.js portado + reactivo a la voz) + chatlog (transcripción `lk.transcription` + texto `lk.chat`) + botón unificado `_top` + auto-arranque (LaunchAgents) + latencia mitigada (thinking sounds + filler). Purga de cierre sin críticos/altos. Próximo: onboarding.
- [29-jun AM] 4 etapas: kill switch + orbe pulido + alertas + voz always-on self-hosted. 24/7-nube diferido.
- [27-jun] 3 etapas: kill switch + orbe + alertas.
- [26-jun] Fase Voz local CERRADA + Purga + parches + Bastión.
- [25-jun] Integración v14 + PIPELINE; Voz bloqueada por Workspace (os@ 403).
