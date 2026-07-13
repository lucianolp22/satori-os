# CLAUDE.md — Satori OS (índice raíz · lo lee PRIMERO todo agente)

> Plantado 06-jul-2026 desde el esqueleto v0 (22-jun) + verificación contra repo real. ≤120 líneas; lo voluminoso va linkeado.

## Regla de oro
- Antes de ejecutar NADA: leer `HANDOFF.md` (solo «Estado vigente», hasta el primer `---`). Es la fuente de verdad viva.
- Tratar todo lo de «No verificado» como inexistente hasta chequearlo (hojas, columnas, funciones, deployments). No planificar sobre eso.
- Antes de proponer algo nuevo: chequear «Decisiones y descartes» del apéndice del HANDOFF. No re-proponer lo descartado.

## Qué es
- ERP multi-tenant sobre **Google Apps Script + Google Sheets**: 1 proyecto MAESTRO opera N Sheets cliente.
- En **producción** bajo `luciano@satoriconsultoria.com` (Workspace C1). Voz integrada: CM desktop + PWA iPhone (Tailscale).
- Dos capas: **Producto** (este ERP) y **Método/Motor** (pipeline idea→ejecución de 10 fases → `PIPELINE-SatoriOS.md`).

## Loop de trabajo (roles)
- **Luciano** dirige, decide, revisa con observaciones. No ejecuta: corrige.
- **Cowork** planifica, deja el plano, arma entregables, verifica y purga antes de cerrar.
- **Claude Code** ejecuta lo pesado / GAS (clasp, push, correr funciones en el editor).
- De fondo SIEMPRE: Círculo + Equipo Agentes Pro + Bastión. Por paso: ejecución-supervisada (AREL) + satori-design (UI). Al cierre de cada etapa: purga-de-errores.
- **Auto-plan del agente (doctrina AREL formalizada):** antes de ejecutar una tarea no trivial, el agente arma su propio plan (pasos + qué puede romper aguas abajo), lo muestra, y corre los primeros pasos supervisado antes de soltar el resto. Nunca arrancar una ejecución larga sin plan visible.
- **Gates antes de cerrar** (v14): (1) no planear sin ≥96% de confianza, preguntar edge-cases; (2) listar lo que mete product-risk + cómo de-riskear; (3) code-review senior (lógica/ineficiencias/bugs + plan de fix).
- **Gate de DECLARACIÓN DE CIERRE (regla dura, 07-jul):** PROHIBIDO declarar "terminado / completo / cerrado" (en chat, HANDOFF o memoria) sin correr `bash _inventario_cierre.sh` y adjuntar a la declaración: (a) qué incluye exactamente el cierre, (b) qué queda abierto (la lista del barrido, depurada a mano — specs sin implementar, sugerencias sin ejecutar, mocks, comentarios stale, residuales de otros HANDOFFs), (c) dónde vive cada cabo. La Purga de cierre audita TAMBIÉN la declaración contra ese inventario. Aplica a Cowork, Code y Luciano. Origen: incidente 07-jul ("Sistema terminado" con E8b/deuda/HANDOFF-stale sin inventariar).
- **Deep-review en PARALELO** ante plan multi-fase: Task tool, 1 subagente por fase, Haiku en los chequeos mecánicos, un master sintetiza. Correr ANTES de cerrar.
- **Anti-context-rot:** compressed handoff + sesión fresca al ~80% de contexto (no esperar al auto-compact).
- **Escalera de maduración (doctrina 14-jul, checkpoint D1):** nada se automatiza sin pressure-test manual — nivel 0 manual → 1 skill/SOP → 2 cadena con gates → 3 automatización; gates, desescalada y tabla de niveles vigentes en `PIPELINE-SatoriOS.md`. **Proceso sin nivel declarado = nivel 0.**

## Arquitectura (punteros, no copiar contenido)
- Índice de código: `ARCHITECTURE.md`. Estado + próximo paso: `HANDOFF.md`. Capacidades autogeneradas: `CAPABILITIES.md`.
- Criterio de adopción de patrones de agentes: `docs/CRITERIO-arquitectura-agentes.md` (qué se adopta, qué es humo).
- Planes: `PLAN-INTEGRACION-kevinfremon.md`, `PLAN-INTEGRACION-jarvis-os.md`. Voz: `voz/BLUEPRINT.md`, `voz/DEPLOY-doPost.md`, `voz/agent/README.md`.
- Specs históricas del diseño (ETAPA 0.2–0.4, aprobadas): `../Videos analizados/` (consultar solo si se cuestiona una decisión de modelo de datos).
- Módulos clave (verificados 06-jul): `05_costos.js` (ruteo de modelo + tarifas) · `08_webapp.js` (doGet CM + doPost Voz) · `13_agentes.js` · `14_director.js` (`correrDirector`/`poblarCerebro_`) · `15_cerebro.js` (grafo multi-tenant) · `16_salud.js` (`correrSalud`) · `17_bandeja.js` (captura + triage) · `18_direccion.js` (`estadoVigente`/brief) · `19_conectores.js` (Vehemence) · `20_killswitch.js` · `21_backup.js` (backup semanal + restore drill) · `09_selftest.js` (`selfTest`).

## GAS / clasp — convenciones duras (no repetir errores)
- Tras commitear UI: `clasp push` o el HEAD de GAS queda atrás. `/dev` = HEAD; `/exec` = versión congelada (promover versión para actualizar prod). Triggers corren HEAD.
- **SIEMPRE diff repo↔GAS antes de `clasp push`** (guardia que aborta si pisaría algo). `clasp push` sube TODO `src/`, no archivos sueltos.
- `clasp create` PISA `appsscript.json` con el default (pierde scopes/webapp/tz) → `git checkout -- src/appsscript.json` ANTES de `push`.
- `appsscript.json` webapp.access = **DOMAIN** (30-jun, Bastión). NO volver a MYSELF: rompe el CM y las URLs de dominio.
- Reauth clasp: `clasp logout && clasp login` (ante `invalid_rapt`). `.git/index.lock` huérfano: lo remueve Luciano en el Mac.
- Correr funciones por Chrome: clic por COORDENADA en el dropdown + leer el Registro por screenshot. Preferir verificar offline (`node --check` + harness vm); Chrome solo cuando hace falta prod. El CM NO es auto-screenshoteable (iframe cross-origin) → render-check = eyeball de Luciano.
- **CAPABILITIES.md no se edita a mano** (muere stale): se regenera con `bash _capabilities_gen.sh`; el hook pre-push (`_hooks/pre-push`, instalar con `bash _install_hooks.sh`) aborta el push si quedó desactualizado.

## Seguridad (Bastión)
- Secretos SOLO en Script Properties: `MAESTRO_ID`, `CLAUDE_API_KEY`, `OWNER_EMAIL`, `VOZ_TOOL_SECRET`, `BACKUP_FOLDER_ID`. Nunca en el repo. `.clasp.json`, `.env.local`, `client_secret*.json` = gitignoreados.
- doPost Voz: secreto-en-body fail-closed + whitelist de tools + least-privilege (solo lectura + capturar). doGet gateado por `getActiveUser().getEmail()` vs `OWNER_EMAIL`. Kill switch total = congelar TODO en pausa (`20_killswitch.js`).
- **Confirmation-pattern verbal (regla dura para Voz):** toda FUTURA tool de voz que ESCRIBA o mute datos (hoy la voz es solo-lectura + capturar) debe repetir en voz alta qué va a hacer y esperar confirmación verbal explícita antes de ejecutar. Ningún dev futuro la saltea.
- Fuera del core: daemon always-on (descartado) · Hermes en el core (descartado; solo si VPS multicanal 24/7) · OpenClaw (descartado — rojo). PM persistente = cron NATIVO (Scheduled Tasks).
- No meter PII pesada de clientes en capturas personales de Bandeja (capa sin anonimizar hasta B8).

## Decisiones firmes (no rediscutir — ver apéndice HANDOFF para el porqué)
- Workspace C1 reusando `luciano@satoriconsultoria.com`; os@ dada de baja (Opción B/os@ solo si voz multi-cliente).
- Ruteo de modelo centralizado en `llamadaAPI(modulo)`: analista/conciliador→Sonnet, resto→Haiku; Opus disponible sin rutear.
- Los 8 agentes lab quedan en laboratorio hasta Forge data-defined.
- **Voz = pipeline LiveKit** (Deepgram nova-3 STT + OpenAI LLM + ElevenLabs TTS + Silero VAD). **El VAD NO se toca** (deprecación = warning cosmético; quitarlo rompe turn-detection). Mic SIEMPRE Mac en desktop. NO stack WS-custom, NO OpenAI Realtime.
- Latencia voz 13s = overhead GAS (no cold-start); bajarla de raíz = opción C (diferida con gatillo de uso real).
- **Datos reales de clientes + RGPD + puesta en marcha = AL FINAL (B8, firme).** Primero terminar el sistema.

## Effort/modelo (ahorro de tokens diario — 14-jul)
| Tarea | Modelo/Effort |
|---|---|
| Lecturas, greps, verificaciones, higiene | Haiku / effort bajo |
| Dev normal GAS/HTML, informes, planes | Sonnet / effort medio (default) |
| Arquitectura, purgas profundas, decisiones de diseño | Opus o effort alto — SOLO estos |
| Regla | correr `/doctor` ante consumo anómalo; override puntual con `/model` y `/effort`, no permanente |

## IDs vivos
- No inline. Ver tabla «Artefactos» de `HANDOFF.md` (scriptId MAESTRO, Sheet MAESTRO, deployment prod `/exec`, `/dev`, GitHub privado, carpeta backups).

## Correr / verificar
- `selfTest()` (`src/09_selftest.js`): correr tras cada cambio antes de declarar hecho (editor GAS o vía Chrome).
- Triggers en prod: `corridaDiaria` 07:00 + `drenarCola` 5min (instalados por `bootstrap`) + `backupSemanal` domingo 04:00.
- Backup/restore: `RUNBOOK-recuperacion-total.md`. Voz PWA: `RUNBOOK-voz-PWA-movil.md` (consultoría).
