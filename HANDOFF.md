# HANDOFF — Satori OS — 2026-06-21 (v10)

PRÓXIMO PASO (v10 · 21-jun): **(1) Un solo push de Code cierra varias cosas:** `git add -A && git commit && clasp push -f` sube `src/` con el **ruteo de modelo** (audit-verde) + el **retrofit CEREBRO** (`01_schema`/`15_cerebro`/`09_selftest`, node-check OK). En el editor: `selfTest()` → confirmar **C** (ruteo, 4 asserts), **D4** y **E8a-1** (retrofit) verdes + correr **`migrarCerebroSchema()` UNA vez** (agrega columnas canónicas a los clientes existentes). **(2) Orbe 3D** (Three.js) — Luciano lo pidió 3D; portar de `Videos analizados/satori-os-demo-b-orbe.html` COMO VISTA ADICIONAL (la vista «Hoy» nunca paga el 3D) con el presupuesto de performance (`HANDOFF E2+ §7`): render solo con CM abierto+visible, Page Visibility API, dPR≤1.5, persistir calidad **por backend** (localStorage no sobrevive el iframe). **(3) Voz** — tool-backend GAS (`doPost`); arquitectura ya en **`voz/BLUEPRINT.md`** (plataforma gestionada LiveKit Cloud free-tier + GAS tool-backend HTTPS + subdominio `voz.satoriconsultoria.com`, sin host propio, sin fijo, alcance personal); falta el **fork de marca**: pipeline Deepgram+ElevenLabs (voz de marca) vs voz-a-voz OpenAI Realtime/Gemini Live (simple/barato). **Orden de trabajo (21-jun, Luciano): retrofit CEREBRO → orbe 3D → Voz → Vehemence (encargo de tratamiento RGPD, ÚLTIMO).**

## Estado vigente
Satori OS = ERP multi-tenant sobre **GAS + Google Sheets** (1 proyecto MAESTRO opera N Sheets cliente), **en producción** bajo `luciano@satoriconsultoria.com`. Núcleo cerrado y produciendo análisis real: **E1, E2+, E8a, Bandeja (Jarvis F0/1), Capa de Dirección 3/3, Capa de Conectores**. **Los dos Must del backlog quedaron cerrados** (Capa de Dirección + ruteo de modelo por costo) → no hay nada en ruta crítica; lo que sigue son mejoras Should (con fit-check GAS), el track de negocio (build-in-public/cartera) y E8b (bloqueada). Primer cliente con datos reales = **Vehemence (CLI-002)** vía conector a su SGIC. Modo de trabajo: Círculo/Equipo/Bastión de fondo + AREL + satori-design + purga al cierre (en `userPreferences`/skills, no repetir acá).

### Verificado
- [19-jun] **Capa de Conectores purgada (6 parches) + canal local en prod** — `sincronizarVehemence`/`corridaDiaria` loguean `Canales: local,online` (16 filas); `verVehemence` muestra `2026-05-01 Ventas local $4.908.141` + online $15.674.182 = **mayo $20.582.323**. Commits `9342569` (purga: guard anti-wipe, cobertura, adaptador parametrizado, batch-delete) + `f49b69e` (acepta `channel='local'`); **selfTest D4 7/7** verde (corrido por Chrome). Solo MAYO del local cargado.
- [18-jun] **Capa de Dirección 3/3** (`estadoVigente`/`briefDiario`/North Star) CERRADA/prod — selfTest D1+D2+D3; commits `fe6655d`/`7df3acd`.
- [18-jun] **Bandeja (Jarvis F0/1)** CERRADA/prod — selfTest F1; `clasificarBandeja` `{procesados:4,escalados:1}`; commit `89ec85e`.
- [16-jun] **E2+ y E8a** cerradas; Command Center verificado en desktop+iPhone; API real status 200 (Haiku), tope $25/mes, key rotada.
- [21-jun] **CEREBRO reconciliado:** el doc canónico `CEREBRO - Arquitectura única de memoria…md` (Videos analizados, 14-jun) **EXISTE** → la premisa v9 «E8b bloqueada por falta de doc CEREBRO» era **ERRÓNEA** (queda solo el bloqueo #2: snapshot del Equipo `agentes-satori-os.md`, no encontrado). E8a **divergía** del canónico → **retrofit aplicado** (`01_schema`/`15_cerebro`/`09_selftest`): nodos +`dimension`(líder/negocio/sistema)/`relevancia`/`cobertura`, aristas +`relacion`, `materializarEstado` agrega `nodos_por_dimension`+`cobertura`/`puntos_ciegos`, +`migrarCerebroSchema()`. node-check OK + purga-lite; **pend. push + correr `migrarCerebroSchema()`**. Deuda: el upsert reescribe fila completa → cuando el Director popule nodos, pasar `dimension` explícito.

### No verificado
- **Ruteo de modelo por costo** y **UX Centro de Mando**: construidos + node-check + harness offline OK, **NO corridos en prod** (pend. push + selfTest C en el editor). UX no es auto-verificable (iframe GAS) → la prueba Luciano post-push.
- Todo el Pendiente Should/Nice (Voz, neural-map, Forge, Jarvis F2/F3, caching, build-in-public, E8b): **no construido**.

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
- [19-jun] **v9:** Cerrados **2 cambios Satori OS** (UX entrar al Centro de Mando + ruteo de modelo por costo, ambos verificados offline, pend. push) + **canal local de Vehemence verificado en prod** (mayo completo $20,58M) + **Purga del conector** corrida y desplegada (`9342569`/`f49b69e`, D4 7/7). Fijado el orden del backlog Should. HANDOFF reescrito limpio.
- [18-jun] **v7/v8:** Capa de Conectores (`sincronizarVehemence`, validado vs ERP) + Purga del conector (6 parches). Arco end-to-end Vehemence cerrado.
- [18-jun] **v6:** Capa de Dirección CERRADA 3/3 (`fe6655d` + North Star + fixes). selfTest D1+D2+D3.
- [18-jun] **v5:** Bandeja (Jarvis F0/1) CERRADA y en producción (`89ec85e`); Purga F1–F6.
- [16-jun] **v4:** E2+ y E8a CERRADAS + sistema con datos reales + orbe-vivo + mobile. Aprobada Capa de Dirección + extras + build-in-public.
- [15-jun] v1-v3: bloqueo APP → migración a Workspace + E2-1 resuelto + selfTest verde + Purga; build de E8a.
