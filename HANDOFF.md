# HANDOFF — Satori OS — 2026-07-07

PRÓXIMO PASO: **correr `bash _cierre_code.sh` en Terminal (dry-run → `--go`)** = git rm del importador temporal + CAPABILITIES regen + commit + clasp push + git push. Después, en el editor GAS: `selfTest()` → esperar **TODO OK** con los asserts nuevos D5/D6/D7. Con eso el cierre-dev queda 100% y el programa pasa a NEGOCIO (B7) + gates del 08-jul.

## Contexto del día (07-jul, consolidado)

**Mañana/mediodía:** promoción `/exec` @17 (kill-switch #7 voz) · voz revivida (watchdog+KeepAlive, STT es-419) · P2 F1-F3 verificadas en /dev (video 13:27) · P2 F4+F5 → **@18** (`selfTest` TODO OK) · B7 marco de cartera entregado y corregido (`consultoría/B7-marco-cartera-2026-07-07.md`). **Tarde:** norte v9 cerrado contra CM vivo (estados de voz `setSato` commit `c7c7077` + Agenda opción A commit `f12abb0`) · importador Trello (23 tareas) corrido → **DEPLOY @19 EN PROD ✅ confirmado por Luciano** (Agenda + Tareas + lazo F1-F5 + contrato brief + estados voz). **Sesión de cierre (esta, tarde-noche):** ver Verificado.

## Estado vigente
Satori OS = ERP multi-tenant **GAS + Sheets** en prod (`luciano@satoriconsultoria.com`) + Voz (CM desktop + PWA iPhone por Tailscale). **SISTEMA OS TERMINADO: P2 completo (lazo F1-F5) + Agenda + 23 tareas Trello en prod `@19`, confirmado por Luciano.** B1-B5 ✅ · P2 F1-F5 ✅ · norte v9 ✅. Resta SOLO el paso Code de esta sesión de cierre (ver PRÓXIMO PASO). Después el programa es **NEGOCIO — B7** (SIP al regreso de Nicolás · Vehemence monto ARS · build-in-public decisión) + **research Tareas-v2** (`docs/TRELLO-a-Satori-mapeo.md`: alta rápida desde board, recurrencia real, etiqueta contexto) + **B8 FINAL** (datos reales + Bucket B + RGPD + `puesta-en-marcha`) con gatillo de cliente real. Motor/método (fase→skill, F2/F3, brief-push) = diferidos con gatillo. Fuente de plan: `consultoría/PLAN-ACCION-INTEGRAL-SatoriOS-2026-07-06.md`.

### Verificado
- [07-jul] **@19 EN PROD** — evidencia: eyeball de Luciano en `/exec` 16:30 (Agenda + Tareas con las 23 de Trello + lazo F1-F5 + contrato brief + estados de voz). Hoja `Tareas` re-verificada por gviz en la sesión de cierre: 23 filas, headers correctos.
- [07-jul cierre] **Hoja `Feedback` depurada** — evidencia: gviz post-borrado = solo `FBK-0006` (0001-0005 eran clics del loop pre-fix; borradas por Cowork vía Chrome).
- [07-jul cierre] **Hoja `Agenda` descontaminada** — evidencia: gviz post = solo headers, 0 filas (tenía las 23 TAR-* volcadas posicionalmente — ver Imprevistos; 0 eventos reales perdidos).
- [07-jul cierre] **Asserts D5/D6/D7 escritos** en `09_selftest.js` (Feedback/Recomendaciones/Agenda + limpieza extendida en `limpiarTodoTest`) + higiene `index.html` (placeholder honesto del feed + comentario kanban corregido) — evidencia: `node --check` OK ambos archivos. **Correr en GAS = pendiente** (ver No verificado).
- [06-jul] **B3 backup live** — evidencia: `smokeBackup` PASS 6/6 (incl. moveTo drive.file), `backupAhora` 7 copias ok, `drillRestore` eyeball-verificado, trigger `backupSemanal` domingo 04:00. Código en **GitHub privado** `lucianolp22/satori-os` (push OK, off-Mac). `_b5_code.sh --go` → `clasp push OK`.
- [06-jul] **B5 6 fixes live en GAS HEAD** — evidencia: `selfTest()` = **TODO OK** post-push (incl. `E8a-2 SISTEMA (7)` valida el fix #1 O(n²) del cerebro; `F1 BAN-0009` valida #4 nextId; capa Voz verde). Commits `7c1aef4`/`13fab76`.
- [06-jul] **CAPABILITIES.md autogenerado** — evidencia: `bash _capabilities_gen.sh` → 150 líneas, re-generable.
- [06-jul] **Rediseño CM+Voz LIVE en `/dev` + eyeball Luciano OK** — evidencia: commit `20531db` en GAS HEAD (Calidad fuera, `#cmFx` presente, orbe regular, isologo alineado, transiciones ~320ms); Luciano confirmó los 8 cambios en `/dev`. Solo falta promover a `/exec`.

### No verificado
- `selfTest()` con los asserts nuevos D5/D6/D7: **NO corrido aún** — se corre tras `_cierre_code.sh --go` (clasp push). Hasta entonces, los asserts son código que parsea, no evidencia.
- El delta del cierre (asserts + placeholder feed + rm del temporal) está en HEAD/working tree, **NO en prod @19**: entra recién en la próxima promoción `/exec`.
- Transcripción `es-419`+keyterms: aplicada y agente reiniciado (07-jul 11:05); **calidad a validar por Luciano en la próxima conversación de voz**.

## Pendiente
*(re-inventariado en la sesión de cierre 07-jul con `_inventario_cierre.sh` — gate de declaración del CLAUDE.md)*

**Must (único residual del cierre-dev):**
- Correr `bash _cierre_code.sh` (dry-run → `--go`) en Terminal + `selfTest()` en el editor → **TODO OK** con D5/D6/D7.

**Should (cabos verificados, con dueño/gatillo):**
- **Archivar 7 deployments GAS viejos** (@4-@14 sin uso; UI de Apps Script → Implementaciones. CUIDADO: no tocar el deployment de `/exec` @19 ni el de `/dev` — verificar IDs contra los Artefactos antes de borrar cada uno).
- **Widget Calendario del CM**: decisión pendiente — la card Agenda (opción A) ya cubre la vista semanal; decidir si un calendario visual se construye o se descarta explícitamente.
- Deuda ARCHITECTURE.md §Pendiente: tokens de sombra dark sin documentar en DESIGN.md · doble escritura de costos (unificar en E3) · agentes lab → flag `activo` (gatillo Forge).
- Sugerencias con gatillo "próximo toque de UI": aro de estado sobre orbe 3D · progreso chatlog 13s · barras tarea/entrenamiento (dato real o E8b) · onboarding wizard · pase WCAG 2.2 AA · PM dogfooding · higiene tareas programadas · `.venv` fuera del indexador Cerebro · página continuidad de cuenta. (⌘K y barra de coste YA existen — verificado norte v9.)
- **Tareas-v2 (research Trello listo en `docs/TRELLO-a-Satori-mapeo.md`):** 3 must del doc — alta rápida de tarea desde el board · recurrencia real · etiqueta/contexto. Con gatillo: cuando Tareas vuelva a tocarse.
- **B7 negocio:** SIP al regreso de Nicolás (averiguar fecha + disparador) · Vehemence monto ARS con Micaela (verificar arista fiscal ES/AR con contador) · build-in-public (decisión, gate honesto 4 semanas).
- Bucket B de la purga (PII #6, conector #8-#10) → **B8** con riesgo documentado.

**Nice:**
- Activar `brief_push_on` cuando quieras el brief por email (hoy OFF por diseño) · E8b cuando dispare el gatillo (spec en `docs/INTEGRACION-ENTRENAMIENTO-AGENTES.md`) · Bucket C purga.

**Gates 08-jul:** corrida IG monitor (debe ACUMULAR, no re-baselinear) · subvención Barcelona Activa (decisión).

## Artefactos
| Tipo | Nombre | Ruta / ID / URL |
|---|---|---|
| Proyecto GAS | MAESTRO | scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` |
| Sheet MAESTRO | Satori OS — MAESTRO | `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` |
| Deployment prod | /exec | `AKfycbxZJL4E…` (**@19**, 07-jul: P2 F1-F5 + Agenda + Tareas + estados voz) |
| /dev CM | Centro de Mando | `script.google.com/a/macros/satoriconsultoria.com/s/AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I/dev` |
| Remoto git | GitHub privado | `github.com/lucianolp22/satori-os` (off-Mac backup del código) |
| Backup datos | módulo + carpeta | `src/21_backup.js` → Drive «Satori OS — Backups» (Script Property `BACKUP_FOLDER_ID`) |
| Deploy scripts | CM / B5 / capabilities | `_cm_deploy.sh` · `_b5_code.sh` · `_capabilities_gen.sh` (guardia allowlist + clasp push) |
| Docs B5 | paquete / purga / caps | `PAQUETE-CODE-B5-2026-07-06.md` · `PURGA-SISTEMA-B5-2026-07-06.md` · `CAPABILITIES.md` |
| Runbook | recuperación total | `RUNBOOK-recuperacion-total.md` (el Mac murió + restore + Script Properties) |
| Kit de marca | isologo + variantes | `Projects/KAIROS…/Satori - Identidad Visual/` (lockup horizontal = PNG-embebido+ámbar; usar PNG para recolorear) |
| UI (vanilla GAS) | CM / Voz | `src/index.html` · `voz/web/voz.html` (render-check = eyeball) |

## Desvíos del plan original
- **B4 (rediseño CM) se adelantó a B3** (backup). Ambos cerrados.
- **B6 (motor) mayormente ya existía** (telemetría, estadoVigente, North Star, brief, pipeline Bandeja): re-verificado verde en selfTest → no se reconstruyó; el resto (fase→skill, F2/F3, brief-push) = diferido con gatillo por ser proceso especulativo para un operador solo.
- **Rediseño visual (opción b)** ejecutado ahora (CM header + página de voz completa) en vez de al final.
- Datos+RGPD+go-live AL FINAL (firme).

---

## Apéndice histórico
{Se lee solo si un problema reaparece o se cuestiona una decisión.}

### Decisiones y descartes
- **[06-jul] #7 kill switch = congelar TODO en pausa** (doPost rechaza también lecturas cliente/cerebro, no solo capturar). Decisión Luciano.
- **[06-jul] Bucket B de la purga (PII a LLM + integridad conector) → diferido a B8** con riesgo documentado (corre con datos sembrados/demo hoy). Decisión Luciano.
- **[06-jul] Motor/método B6 (fase→skill, /promote, F2 clasificador general, F3 PM persistente, brief-push) = diferido con gatillo** (equipo/más clientes): proceso especulativo para un operador solo; el 80/20 de B6 (datos/telemetría/estado) ya estaba hecho.
- **[06-jul] O(n²) del cerebro** resuelto con snapshot pre-cargado OPCIONAL (`snap`) en `upsertPorClave_/upsertNodo/upsertArista` — callers viejos sin `snap` = comportamiento idéntico; snap consistente intra-lote (clave repetida actualiza, no duplica).
- **[06-jul] isologo del CM** = PNG del lockup recoloreado negro→crema `#ECEAE3` + ámbar (no hay lockup-reverse; los SVG del lockup son PNG-embebido, no recolorables por fill).
- **[30-jun] `appsscript.json` webapp.access = DOMAIN (Bastión):** NO volver a MYSELF (rompe el CM + URLs de dominio).
- **[30-jun] A' voz = pipeline Deepgram+OpenAI+ElevenLabs+Silero.** VAD Silero = NO se toca (deprecación = warning cosmético). Thinking-sound descartado (tapaba TTS). Mic SIEMPRE Mac (`audioCaptureDefaults`). ElevenLabs Starter pago.
- **[29-jun] Voz A' = LiveKit** (NO stack WS-custom de Kevin, NO OpenAI Realtime). Mic en iframe GAS DESCARTADO (getUserMedia bloqueado) → voz en página local. Token = mint local. Latencia 13s = overhead GAS (no cold-start).
- Decidido (27-jun): kill switch = pausa operativa; alertas email opt-in default OFF. Caller = luciano@ (os@ baja). Descartado: `drive.file` para el token del agente (gate 404 → readonly); SA externa (Workspace la rechaza).

### Imprevistos y resolución
- [07-jul cierre] **Hoja `Agenda` contaminada: las 23 tareas de Trello volcadas POSICIONALMENTE** (descripcion en `hora`, prioridad en `titulo`, estado en `id_cliente`). Invisible en el CM: `agendaSemana()` filtra por fecha y esas filas tenían `fecha=''` → la card se veía vacía y el eyeball de @19 no lo detectó. El importador NO fue (usa `appendFila` por header y apunta a `Tareas` — verificado en código); consistente con un pegado manual en la pestaña equivocada. Fix: Cowork borró las filas 2:24 vía Chrome (headers preservados, 0 filas no-TAR perdidas, `Tareas` intacta con 23; verificación gviz antes y después). Lección: **el eyeball del CM NO verifica las hojas — tras cada corrida que toca datos, gviz de TODAS las hojas tocadas.**
- [07-jul] **Voz MUDA (sin saludo/respuesta): el agente estaba MUERTO desde el 04-jul 09:48** — corte de red/DNS → el worker agotó 16 reintentos contra LiveKit (`failed to connect after 16 attempts`) y KeepAlive NO lo repuso (log sin actividad posterior). El deploy del 06-jul NO tuvo nada que ver. Fix estructural (Cowork, 07-jul): **LaunchAgents versionados** en `voz/launchagents/` (KeepAlive incondicional + ThrottleInterval 15) + **watchdog anti-zombie** (`voz_watchdog.sh`, cada 5 min: si el log muestra muerte terminal posterior al último `registered worker` → `kickstart -k`) + installer `instalar_launchagents.sh` (valida, recarga, verifica; watchdog se carga al FINAL para no matar al agente recién nacido). Lección: **KeepAlive solo no alcanza para workers zombie; los cortes de red largos requieren watchdog por evidencia de log.**
- [07-jul] **Mic inicial = iPhone (flash de Continuity) pese a pickMacMicId** — el `getUserMedia` temporal de permisos era genérico → macOS activaba el default del sistema (iPhone). Fix en `voz.html`: elegir el mic del Mac ANTES de la primera activación (labels ya disponibles si el permiso está persistido) + `deviceId:{exact}` en ese primer getUserMedia + fallback genérico si el id quedó stale. Móvil (IS_TOUCH) intacto. Raíz opcional del lado macOS: desactivar el iPhone como mic de Continuity.
- [06-jul] **`.git/index.lock` huérfano (2 días) tumbaba el commit** → el sandbox de Cowork NO puede tocar `.git/` (`Operation not permitted`) → lo remueve Luciano en el Mac (`rm -f .git/index.lock`); scripts ahora chequean el lock al inicio.
- [06-jul] **guardia `_b3_code.sh` false-positivo sobre `index.html.bak`** (local-only, clasp no lo pushea) → guardia corregida: solo marca `differ` y `Only in <GAS>/src` (ignora `Only in src:`); usa allowlist de los archivos que intencionalmente cambian.
- [06-jul] **GitHub device-flow (`gh auth login`) no llegaba el código** → push vía PAT clásico embebido en la URL (`git push https://user:TOKEN@github.com/...`), saltea keychain/gh. GitHub ya no acepta password para git.
- [06-jul] **imagen pegada en el chat NO se guarda a disco** (solo en contexto) → pedir archivo adjunto o montar la carpeta; el isologo estaba en `Projects/KAIROS…/Satori - Identidad Visual/Exportaciones/PNG/`.
- [06-jul] **CM sirve la versión DESPLEGADA, no HEAD** → cambios de `index.html` se ven en /dev con `clasp push`, pero /exec necesita promover versión (como B4); triggers sí corren HEAD.
- [30-jun] /dev perdió el botón tras /exec = HEAD de GAS desincronizado del repo → regla: SIEMPRE diff repo↔GAS antes de `clasp push` (guardia que aborta).
- [27-jun] El CM NO es auto-screenshoteable (iframe cross-origin GAS) → render-check = eyeball de Luciano.
- [29-jun] `#` inline / paréntesis en comandos pegados rompen el zsh de Luciano → comandos limpios; multi-paso = script desde archivo (`bash x.sh`).

### Changelog del handoff
- **[07-jul] Día completo + sesión de cierre (Cowork):** mañana: promoción `/exec` @17 (kill-switch #7 voz) · voz revivida (watchdog anti-zombie + LaunchAgents versionados) · STT `es-419`+keyterms. Mediodía: P2 F1-F3 verificadas en /dev (video) · P2 F4+F5 → **@18** (`selfTest` TODO OK) · B7 marco de cartera (consultoría, con decisiones de Luciano). Tarde: norte v9 contra CM vivo (estados de voz `setSato` + Agenda opción A) · importador Trello 23 tareas → **@19 EN PROD confirmado** · research Trello→Tareas (`docs/TRELLO-a-Satori-mapeo.md`). **Cierre:** asserts D5/D6/D7 + limpieza test extendida · higiene index.html (placeholder feed honesto + comentario kanban) · `Feedback` depurada (solo FBK-0006) · **`Agenda` descontaminada** (imprevisto: 23 TAR-* posicionales — ver Imprevistos) · `_cierre_code.sh` dejado listo (16 guardias; correr = PRÓXIMO PASO). HANDOFF consolidado (párrafos del día → este changelog).
- **[06-jul PM] Sesión Cowork — B0/B0.5 (plan 06-jul):** **CLAUDE.md raíz plantado** (esqueleto 22-jun actualizado contra repo real + 2 reglas nuevas: confirmation-pattern verbal para futuras tools de escritura por voz + auto-plan del agente/AREL formalizada) · **PIPELINE-SatoriOS.md copiado al repo** · **`docs/CRITERIO-arquitectura-agentes.md`** (criterio consolidado de 8+ casos, regla del INDEX cumplida) · **drift-checker CAPABILITIES** (`_hooks/pre-push` + `_install_hooks.sh`; dry-run detectó drift real: `_filaConsumoCore_` de B5 faltaba en CAPABILITIES → se regenera en la promoción) · **HANDOFF consultoría → puntero** al del repo + 69 dumps/one-shot archivados en `_archivo/` (quedan los 5 ks_ operativos de voz + 3 de diagnóstico) · **`_promote_exec.sh`** (dry-run + --go: commit B0.5 + guardia GAS↔repo + promoción `/exec` + verificación + rollback documentado; GAS_VOZ_URL confirma que voz usa el MISMO deployment → 0.1+0.2 en un solo paso). Purga de cierre: 0 críticos / 1 alto (este HANDOFF, resuelto acá) / 5 menores.
- **[06-jul] Sesión Cowork — B3 + B5 cerradas + rediseño CM/Voz:** **B3 backup** (módulo `21_backup.js` = copias semanales a Drive + restore drill probado; código off-Mac en GitHub privado; runbook recuperación). **B5 purga total** (2 auditores adversariales, 0 críticos-hoy) + **CAPABILITIES.md** autogenerado + **6 fixes live** (O(n²) cerebro, guard anti-inyección Bandeja, sanitizar `\t\r\n`, nextId defensivo, lock consumo agentes, kill switch total en pausa) — `selfTest` TODO OK. **Rediseño zen-futurista** coherente CM↔Voz: isologo horizontal embebido, botón voz terracota, Modo calma/luna/«Calidad» removidos, transición dissolve, orbe wireframe regular, header sin solape. DESPLEGADO a `/dev` + eyeball Luciano OK (commit `20531db`, 06-jul); afinado post-eyeball (isologo alineado a «Command Center» + transiciones a ~320ms). PENDIENTE solo promover a `/exec`.
- **[03-jul] Cowork — verificación total + B1/B2:** SOP+template onboarding, paquete B1 higiene, agent.py corregido, VOZ_TOOL_SECRET rotado, marca definida (enso+Alba/Fraunces/Hanken/terracota-jade).
- **[30-jun] A' fase (ii) PWA móvil CERRADA** (Tailscale Serve, sala/identidad únicas anti-zombie) · **[30-jun] A' fase (i) voz grave CERRADA** (pipeline LiveKit) · **[29-jun] Voz integrada al CM CERRADA.**
- [26-jun] Fase Voz local + Purga + Bastión · [25-jun] Integración v14 + PIPELINE.
