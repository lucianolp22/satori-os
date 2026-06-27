# HANDOFF — Satori OS — 2026-06-22 (v13)

PRÓXIMO PASO (v13 · 22-jun): retomar en **MODO EJECUTOR**. **Reordenamiento de Luciano (22-jun): los DATOS de clientes (Vehemence + otros) y el RGPD van AL FINAL; primero terminar de armar el sistema + los NICE.** El keystone (cerebro poblado) ya está cerrado/verde, así que el orbe-cerebro está vivo. Programa en orden:

1. **Voz** — **doPost + agente DESPLEGADOS y verificados en prod** (8 parches Purga #1-#8; selfTest live verde con asserts Voz; lockout PASA; deployment dedicado **«Cualquiera»** con versión nueva = tiene el doPost). Fork (b) OpenAI Realtime; agente en `voz/agent/`. **PRÓXIMO PASO CONCRETO (cierra la etapa Voz):**
   a. **Confirmar la Clave:** `curl -sSL -X POST '<URL /exec del deployment nuevo>' -H 'Content-Type: application/json' -d '{"secret":"<VOZ_TOOL_SECRET real>","tool":"brief"}'` → esperar `{"ok":true,...}`. Si `unauthorized` con el secreto correcto = espacio/newline al pegarlo en Script Properties.
   b. **Completar `voz/agent/.env.local`:** `GAS_VOZ_URL`=esa /exec · `VOZ_TOOL_SECRET`=idéntico al de Script Properties · `LIVEKIT_URL/API_KEY/API_SECRET` · `OPENAI_API_KEY` (cuentas YA creadas con luciano@satoriconsultoria.com).
   c. `cd voz/agent && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python agent.py console` → hablarle ("¿cómo venimos?") → si trae datos reales, **etapa Voz cerrada** (correr Purga + actualizar handoff).
2. **Pulido del orbe** — avatares de agentes en la esfera + **labels por dimensión** (estilo «DATA LAYER» del video Trillion) + **overlay del cerebro real prominente** (mostrar los pocos nodos reales destacados sobre la nebulosa, sin esperar a 250) + **estados idle/escucha/habla** (con Voz). Frontend, sin riesgo de prod.
3. **Alertas de Salud + tope de costo te llegan** (feed del Command Center + email vía aprobación, no solo log).
4. **Onboarding de cliente repetible** (SOP + helpers: Sheet, schema, conector, objetivos/umbrales).
5. **Backup/snapshot** del MAESTRO + Sheets cliente.
6. **Purga adversarial del sistema completo** + deuda técnica (atomicidad M1, perf batch del poblado del cerebro O(n²), hipótesis del conector refund/total_ars).
7. **Deploy de producción estable** + decidir cuenta **`os@`** dedicada (hoy corre sobre la identidad admin; UI se ve por la URL `/dev`).
8. **build-in-public / cartera** (Bloque 6 KAIROS: 11 candidatos + acercamiento).
9. *(ÚLTIMO, diferido por Luciano)* **datos Vehemence/otros clientes + encargo RGPD + puesta en marcha (certificación go-live).**

## Estado vigente
Satori OS = ERP multi-tenant sobre **GAS + Google Sheets** (1 proyecto MAESTRO opera N Sheets cliente), **en producción** bajo `luciano@satoriconsultoria.com`. Núcleo cerrado y produciendo análisis real: **E1, E2+, E8a, Bandeja (Jarvis F0/1), Capa de Dirección 3/3, Capa de Conectores**. **Los dos Must del backlog quedaron cerrados** (Capa de Dirección + ruteo de modelo por costo) → no hay nada en ruta crítica; lo que sigue son mejoras Should (con fit-check GAS), el track de negocio (build-in-public/cartera) y E8b (bloqueada). Primer cliente con datos reales = **Vehemence (CLI-002)** vía conector a su SGIC. Modo de trabajo: Círculo/Equipo/Bastión de fondo + AREL + satori-design + purga al cierre (en `userPreferences`/skills, no repetir acá).

### Verificado
- [19-jun] **Capa de Conectores purgada (6 parches) + canal local en prod** — `sincronizarVehemence`/`corridaDiaria` loguean `Canales: local,online` (16 filas); `verVehemence` muestra `2026-05-01 Ventas local $4.908.141` + online $15.674.182 = **mayo $20.582.323**. Commits `9342569` (purga: guard anti-wipe, cobertura, adaptador parametrizado, batch-delete) + `f49b69e` (acepta `channel='local'`); **selfTest D4 7/7** verde (corrido por Chrome). Solo MAYO del local cargado.
- [18-jun] **Capa de Dirección 3/3** (`estadoVigente`/`briefDiario`/North Star) CERRADA/prod — selfTest D1+D2+D3; commits `fe6655d`/`7df3acd`.
- [18-jun] **Bandeja (Jarvis F0/1)** CERRADA/prod — selfTest F1; `clasificarBandeja` `{procesados:4,escalados:1}`; commit `89ec85e`.
- [16-jun] **E2+ y E8a** cerradas; Command Center verificado en desktop+iPhone; API real status 200 (Haiku), tope $25/mes, key rotada.
- [22-jun] **Ruteo de modelo + Retrofit CEREBRO CERRADOS en prod** (commit `596b473`, push OK): doc canónico `CEREBRO…md` EXISTE (v9 erraba; queda bloqueo #2 de E8b = snapshot `agentes-satori-os.md`, no encontrado). Retrofit (`01_schema`/`15_cerebro`/`09_selftest`): nodos +`dimension`(líder/negocio/sistema)/`relevancia`/`cobertura`, aristas +`relacion`, `materializarEstado` por eje + cobertura/puntos_ciegos. **selfTest C(ruteo 4/4)/D4/E8a-1 verde** (por Chrome) + **`migrarCerebroSchema()` corrido: +20 col `nodos`, +5 `aristas`** en 5 clientes. Ruteo: analista/conciliador→Sonnet, resto→Haiku.
- [22-jun] **Orbe 3D CERRADO** (Luciano: «se ve hermoso»): Three.js r128 (CDN+SRI sha512, **fallback automático a 2D**), nebulosa glow (puntos con **textura radial suave** + núcleo lleno + halos aditivos) + **wireframe orgánico** (icosaedro deformado por ruido) + red de nodos **teal/púrpura/naranja/rojo** + líneas de conexión + presupuesto perf (render solo CM abierto+visible, dPR≤1.5, FPS cap en bajo, **toggle Calidad persistido por backend** `setPrefUI`/`prefsUI` con whitelist). Canvas `cmOrb3D` SEPARADO del 2D (un canvas no admite 2D+WebGL). **Bloom real (UnrealBloomPass) se probó y se REVIRTIÓ** — daba recuadro opaco (no preserva transparencia en el iframe GAS); glow bajado −50%.
- [22-jun] **CEREBRO poblado — KEYSTONE (MUST #2) CERRADO/verde:** `poblarCerebro_` en `14_director` (corre dentro de `correrDirector`) escribe el grafo real — **SISTEMA** (Director + 5 agentes) + **NEGOCIO** (objetivos + métricas) con aristas (orquesta/responsable_de/debe) y **cobertura** (objetivo sin métrica = 20 → punto ciego ROJO). Idempotente (id estable) + `dimension` explícito (evita la deuda del upsert). **selfTest E8a-2 verde** («Director pobla SISTEMA (7)» + «pobla objetivos NEGOCIO»). **El cerebro dejó de estar hueco.** **Orbe=cerebro aplicado:** backend `cerebroGrafo(idCliente)` (sin PII: dimensión+alerta+aristas por índice) + frontend `cmBuildOrb`/`cmCargarCerebro`; el orbe muestra el grafo real **solo si ≥250 nodos** (si no, nebulosa decorativa, para no verse ralo). Población diaria en `corridaDiaria` 07:00; correr `correrDirector()` a mano para poblar ya.

- [22-jun PM] **Voz: doPost + agente + recuperación del glow.** `doPost` tool-backend (secreto-en-body fail-closed + `ctEq_` constante + whitelist 6 tools + least-privilege solo lectura+capturar + `doGet` endurecido) en `08_webapp.js` + bloque selfTest Voz en `09_selftest.js`; **verificado offline** (node --check + harness vm **14/14**) + **commit `6cb9112`** (sin desplegar). Agente LiveKit (OpenAI Realtime, 6 function_tools→doPost vía aiohttp/ToolError, secretos por env) en `voz/agent/` (py_compile OK). **Incidente glow `/dev`:** causa real = **GAS HEAD desincronizado del repo** (NO render WebGL); repo intacto (`87cf0d5`, index.html 13 markers); fix = `clasp push -f` del HEAD (doPost stasheado). Reauth clasp = `clasp logout && clasp login` (invalid_rapt). `/exec` sigue viejo (versión congelada = normal). **Lección:** tras commitear UI hay que `clasp push` o GAS HEAD queda atrás; `/dev`=HEAD, `/exec`=versión congelada.

- [22-jun PM-2] **Voz DESPLEGADO en prod.** Code pusheó los 8 parches (`clasp push -f`) → **selfTest live VERDE** con los 5 asserts «Voz …» + `voz RECHAZO unauthorized/bad_json/unknown_tool` en el log (sin aviso-flood). **Script Properties** `OWNER_EMAIL=luciano@satoriconsultoria.com` + `VOZ_TOOL_SECRET` seteadas. **Test de lockout PASA** (Cowork por Chrome: `/dev` carga el Command Center, NO «No autorizado» → `doGet` fail-closed + `OWNER_EMAIL` OK). **Deployment dedicado creado con acceso «Cualquiera» (anyone) + versión nueva** (tiene el doPost). Commit de los 8 parches: lo corrió Code (hash no capturado → verificar `git log`).

### No verificado / pendiente
- **La Clave (VOZ_TOOL_SECRET):** mecanismo confirmado vivo (selfTest), pero el **valor** Script Properties ↔ agente NO se probó con el secreto real (curl `{ok:true}` pendiente; Cowork no tiene el secreto, a propósito).
- **Loop end-to-end de Voz:** agente en `console` trayendo datos reales — NO corrido (faltaba `.env.local` + cuentas). El curl del `/exec` (ok/unauthorized/anón) tampoco.
- **Watch-items (vistos hoy, no bloquean; Salud OK):** `errores:1` en telemetría = 1 tarea `fallida` en `Cola_tareas` (rastrear). Orbe se vio ralo/oscuro en `/dev` (index.html sin cambios → render/WebGL intermitente; hard reload).
- **Render del orbe-cerebro con datos reales:** el orbe muestra el grafo real solo con ≥250 nodos; hoy los clientes reales tienen ~8 nodos de cerebro → se ve la nebulosa decorativa (hermosa). El overlay prominente de pocos nodos reales = ítem de pulido (#2 del programa).
- **Voz:** doPost + agente **DESPLEGADOS** (ver Verificado [22-jun PM-2]); falta solo confirmar la Clave + correr el loop (PRÓXIMO PASO). **Pulido del orbe, alertas, onboarding, backup, purga del sistema, deploy estable, build-in-public:** no construidos (programa del PRÓXIMO PASO).
- **Datos reales de clientes (Vehemence + otros) + RGPD + puesta en marcha:** diferidos por Luciano al final.

## Pendiente
**Must:** ninguno — los dos cerrados (Capa de Dirección + ruteo de modelo).

**Should (orden de trabajo acordado 19-jun; cada uno con FIT-CHECK GAS):**
1. **Voz** ⚠️ fork sin decidir: (a) liviana Web Speech API client-side vs (b) full Trillion (stack aparte ~$99+/mo). No construir sin elegir.
2. **Neural-map del cerebro** ⚠️: 2D force-graph liviano (`nodos`/`aristas`) vs 3D Three.js. El orbe-vivo (a4.2) ya da "cerebro vivo" → puede ser innecesario.
3. **Forge / agentes data-defined**: registry con prompt/fuente/modelo configurable → activar los 8 lab por etapas. Palanca real dentro del OS (hoy 5/13 con runner). El ruteo de modelo (`modeloDeModulo_`) ya deja media-pista hecha.
4. **Jarvis F2**: separar ideas/ejecución + índice raíz jerárquico (= `_index.md` de Kevin; construir una vez).
5. **Jarvis F3**: PM persistente sobre Director/Equipo/Salud.
6. **Prompt caching** — ahorro **marginal** (cada prompt arma datos frescos); solo si Luciano insiste.

**Nice / negocio / bloqueado:**
- **build-in-public (KAIROS)** — track de negocio, NO código del OS; ataca la **cartera** (cuello). Empalma con Bloque 6 KAIROS (11 candidatos).
- **E8b (entrenar agentes)** — BLOQUEADO: falta doc canónico **CEREBRO** + snapshot del Equipo (`agentes-satori-os.md`).
- Residuales: trashear proyecto + 6 Sheets viejos; deuda Purga M1 (atomicidad)/M3 (perf batch)/B3 (cross-ref); hipótesis abiertas del conector (estados refund no filtrados, parsing `total_ars`); reetiquetar AOV-local (agregado diario ≠ por orden); subir a `os@` dedicado antes de escalar; ¿migrar otros 4 GAS de clientes?

## Artefactos
| Tipo | Nombre | Ruta / ID / URL |
|---|---|---|
| Repo | SatoriOS | `~/Documents/Claude/Projects/SatoriOS` (HEAD `6018ea8` = UX ya commiteada; **sin commitear: `05_costos.js`, `09_selftest.js`** = ruteo de modelo, + `HANDOFF.md`). Push a GAS de `6018ea8` sin confirmar. |
| Índice repo | ARCHITECTURE.md | repo root |
| Proyecto GAS (vivo) | "Satori OS — MAESTRO" | `luciano@satoriconsultoria.com`; scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` (en `.clasp.json`, gitignored) |
| Editor GAS (correr funciones) | script.google.com | `…/u/1/home/projects/{scriptId}/edit` (cuenta L = Luciano) |
| MAESTRO (Sheet) | Satori OS — MAESTRO | `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` |
| Web App (dev, solo dueño) | Command Center | deployment `AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I` (`…/dev` dio 404 por Chrome — confirmar URL viva) |
| Ruteo de modelo | `05_costos.js` | `modeloDeModulo_`, `MODELOS_POR_MODULO`, `TARIFAS`, `MODELO_SONNET/OPUS` |
| Conector | `19_conectores.js` | `sincronizarVehemence`, `sincronizarConectorVentas_(id,src,sheet,fuente)`, `verVehemence` (18_direccion) |
| Helpers alta | `15_cerebro.js` | `cargarObjetivo`, `cargarObjetivosPiloto`, `sembrarDatosEjemplo` |
| Fuente Vehemence | SGIC `DB_VENTAS` | `openById('1ac1ccVMdFgO_VyOzsGwvdtEhCil41A6GnrJIAoNAwNk')`; repo `~/Documents/Claude/Projects/Vehemence/` |
| Planes | `PLAN-INTEGRACION-kevinfremon.md` · `PLAN-INTEGRACION-jarvis-os.md` | repo root |
| Secretos | `MAESTRO_ID`, `CLAUDE_API_KEY` | Script Properties (key rotada) |

## Desvíos del plan original
- El plan paró tras E8a para **integrar 2 casos externos** (@_no_hype_ai, @kevinfremon): sumaron Bandeja (hecha) + Capa de Dirección (hecha) + extras (voz/neural-map/Forge/caching) + track build-in-public. Backlog ampliado (16-jun).
- El roster lab (Flux/Prism/Scout/Relay/Atlas/Forge/Lift/Spark) = el de Trillion: "activar" = darles runner data-defined, no flipear flag (ver Should/Forge).
- "Activar los 8 agentes" se mantiene en lab (16-jun) hasta el reframe Forge.
- [19-jun] **Orden de trabajo del backlog Should fijado por Luciano** = orden de la tabla "Lo que queda" (Voz primero).

---

## Apéndice histórico
{Se lee solo si un problema reaparece o se cuestiona una decisión. No releer por defecto.}

### Decisiones y descartes
- **Decidido (19-jun):** orden del backlog Should = Voz → Neural-map → Forge → Jarvis F2 → Jarvis F3 → caching → build-in-public → E8b → residuales (orden de la tabla "Lo que queda").
- **Decidido (19-jun):** ruteo de modelo centralizado en `llamadaAPI(modulo)` (no por runner) → cero cambios en runners; override por Config `modelo_<modulo>`; analista/conciliador→Sonnet, resto→Haiku; Opus disponible sin rutear.
- **Decidido (19-jun):** canal local de Vehemence = tarea del SGIC (Satori lee / SGIC nutre); Satori solo robusteció el conector para aceptar `channel='local'`.
- **Decidido:** Workspace **C1** reusando `luciano@satoriconsultoria.com` (admin) como identidad de servicio del piloto (deploy MYSELF; mover a `os@` antes de escalar). API key rotada.
- **Decidido (16-jun):** los 8 agentes lab quedan en lab hasta Forge data-defined; Bandeja = fork A (capa personal, sin anonimizar).
- **Descartado:** daemon always-on (Hermes/OpenClaw) — riesgo de seguridad; email propio al agente — el modelo de aprobación es más seguro.
- **NO reimportar (ya en Satori ≥ o mejor):** orquestación, handoff, cost-tracking, seguridad (Bastión/Purga), infra 24/7, requirements-doc, feedback brutal.

### Imprevistos y resolución
- [19-jun] Correr funciones GAS por Chrome: el clic por **ref** en el selector de función NO commitea; hay que **clic por coordenada** en el dropdown + confirmar toolbar+dropdown cerrado antes de Ejecutar. `get_page_text` devuelve el código, no el log → leer el Registro por screenshot. Lección: editar+leer offline; correr por Chrome solo cuando hace falta prod.
- [19-jun] `/dev` del web app dio 404 por Chrome (deployment viejo / cuenta) → confirmar la URL viva del Command Center antes de auto-verificar UI.
- [15-jun] `a6e641e` no resolvió E2-1 → lección: instrumentar (`debugE21`) antes de teorizar. `appendRow` coacciona pese al `'@'` → fix per-celda en `appendFila` (NO remover).
- [16-jun] Mobile del Command Center colapsaba → `grid-rows:none` + `cm-stage{min-height:360px}` + agentes a chips 2-col. El iframe GAS no es auto-verificable; lo prueba Luciano en device.
- [16-jun] `clasp push` repetido tiró `invalid_rapt` (token vencido) → `clasp login` y reintentar.

### Changelog del handoff
- [22-jun] **v13:** Voz DESPLEGADO en prod (8 parches, selfTest live verde, lockout PASA, deployment «Cualquiera» + versión nueva). Pend: confirmar Clave (curl secreto real→ok) + correr agente `console`.
- [22-jun] **v12:** doPost + agente Voz construidos/commiteados (`6cb9112`) + 8 parches Purga (incl. #8 detección de rechazos); recuperación del glow (`/dev` = GAS HEAD desync, no render WebGL).
- [19-jun] **v9:** Cerrados **2 cambios Satori OS** (UX entrar al Centro de Mando + ruteo de modelo por costo, ambos verificados offline, pend. push) + **canal local de Vehemence verificado en prod** (mayo completo $20,58M) + **Purga del conector** corrida y desplegada (`9342569`/`f49b69e`, D4 7/7). Fijado el orden del backlog Should. HANDOFF reescrito limpio.
- [18-jun] **v7/v8:** Capa de Conectores (`sincronizarVehemence`, validado vs ERP) + Purga del conector (6 parches). Arco end-to-end Vehemence cerrado.
- [18-jun] **v6:** Capa de Dirección CERRADA 3/3 (`fe6655d` + North Star + fixes). selfTest D1+D2+D3.
- [18-jun] **v5:** Bandeja (Jarvis F0/1) CERRADA y en producción (`89ec85e`); Purga F1–F6.
- [16-jun] **v4:** E2+ y E8a CERRADAS + sistema con datos reales + orbe-vivo + mobile. Aprobada Capa de Dirección + extras + build-in-public.
- [15-jun] v1-v3: bloqueo APP → migración a Workspace + E2-1 resuelto + selfTest verde + Purga; build de E8a.
