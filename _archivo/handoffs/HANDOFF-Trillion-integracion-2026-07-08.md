# HANDOFF — Integración Trillion → Satori OS (delta pendiente) — 08/07/2026

PRÓXIMO PASO: **elegir la Tanda 1** (decisión de Luciano, pregunta cerrada). Los ítems reales son ~13, todos should/nice; se agrupan en 3 paquetes coherentes — elegí uno para arrancar:
- **(A) Voz-fluidez** → C2 (progreso en el chatlog durante los ~13s) + C1 (estados de voz-turno en el orbe). *Recomendado: es el único cuello real que el dossier marcó (fluidez > inteligencia) y es el más barato.*
- **(B) Brief-que-decide** → A2 (tono anclado del brief) + B2 (botones de acción que crean aprobación desde el brief).
- **(C) Producto/vigilancia** → A1 (panel de vigilancia multi-superficie por cliente). El más vendible, el más caro.

Quick-win aparte (no requiere tanda, es tuyo, 1 Script Property): **encender `brief_push_on=true`** → el brief-push YA está construido y cableado, solo está en OFF.

## Estado vigente
Alcance: backlog de lo que falta agregarle a Satori OS **de Trillion (Kevin Fremon)**, verificado contra `SatoriOS/src` el **08/07/2026** (no contra el plan 06-jul, que quedó atrás). Satori OS ya adoptó ~60% de Trillion; esto es solo el delta.

**Corrección verificada hoy (importante):** dos ítems que figuraban como gap en el plan 06-jul **ya están construidos** — brief-push por email (`06_avisos.js:briefPush_`, opt-in, cableado a `corridaDiaria`) y el drift-checker de CAPABILITIES (hook **instalado** en `.git/hooks/pre-push`). No re-hacerlos (ver apéndice "Ya hecho").

El delta real = ~13 ítems, **ninguno en ruta crítica**, todos should/nice. Más valor/menos costo: fluidez de voz percibida (C2) + tono anclado (A2). Más vendible/más caro: panel de vigilancia (A1), porque hoy el conector solo lee **ventas de Vehemence** (`19_conectores.js`). **Filtro de marca innegociable en TODOS:** reencuadrar "te lo muestro para que VOS decidas", nunca "lo manejo por vos" (dependencia = anti-tesis Satori).

### Verificado
- [08-jul, grep `src/`] **brief-push construido**: `06_avisos.js:43 briefPush_()` (opt-in `brief_push_on`, default OFF, solo OWNER_EMAIL, dedupe diario), cableado en `corridaDiaria()` (`06_avisos.js:137`). → gap = solo encenderlo.
- [08-jul, `ls .git/hooks`] **drift-checker CAPABILITIES instalado y activo**: `.git/hooks/pre-push` (regenera por introspección de `src/` y aborta si quedó stale). Gap self-knowledge = CERRADO.
- [08-jul, grep] **Registry 13 agentes**: 5 activos (vigía/conciliador/cobrador/analista/abastecedor) + **8 lab `activo:false`** (flux/relay/scout/prism/atlas/spark/forge/lift) en `13_agentes.js:14`.
- [08-jul, grep] **Conector = 1 sola superficie**: `19_conectores.js:30 sincronizarVehemence` lee solo `DB_VENTAS`. No hay más superficies ni "semáforo por cliente".
- [08-jul, grep] **Sin prompt-caching**: no hay `cache_control` en `05_costos.js` (`llamadaAPI`).
- [08-jul, grep] **Brief informa pero no acciona**: `briefDiario` (18_direccion.js) LISTA "aprobación(es) esperando tu decisión" (:165) pero **no** genera 1-3 acciones con botón.

### No verificado (tratar como inexistente hasta chequear en el repo)
- **C1 estados de voz-turno**: el orbe/CM tiene estados de **agente** (`index.html` `data-orb`, `EST_TXT`), NO de turno de voz (escucha/pensando/habla) → confirmar en `voz.html` / `voz/agent/` antes de construir.
- **B4 ⌘K**: `src/index.html` tiene algún `keydown` (grep dio match) → confirmar si es paleta de comandos o algo incidental antes de decidir esfuerzo.
- **C3/C4 (voz)**: no se revisó `voz/agent/` → verificar si el pipeline LiveKit ya hace re-inyección de persona por turno y streaming TTS por oración antes de listarlos como trabajo.

## Pendiente
> Cada ítem: qué es (Trillion) · qué se agrega (GAS-concreto) · dónde entra (anchor real) · esfuerzo·confianza · marca · criterio de hecho.

**Must:** ninguno. (Honesto: nada de Trillion está en ruta crítica; el sistema ya sirve clientes sin esto.)

**Should:**

1. **C2 — Progreso en el chatlog durante la latencia de voz (~13s).**
   - Trillion: 5.º contacto — *"la fluidez percibida sube más por feedback que por optimización real"*.
   - Agregar: mientras el `doPost` de voz procesa, mostrar en el chatlog estados tipo "consultando Sheets… armando brief…" (texto por etapa, no barra falsa).
   - Dónde: `08_webapp.js` (doPost voz) + `voz.html` / cliente de voz. 0 API.
   - S · 8/10. Marca: neutral. Hecho: en una consulta real de voz se ven 2-3 estados antes de la respuesta.

2. **A2 — Contrato de tono para el brief (anclado + 1 acción).**
   - Trillion: personalidad *"brief, witty, brutally honest"* con juicios **anclados en los números del propio negocio** ("3 de tus últimos 5 churns citaron precio; subir ahora es romántico, no estratégico").
   - Agregar: media página de spec de tono aplicada al texto de `briefDiario*` — cada juicio referencia el dato del cliente + cierra en 1 acción. Es TU marca (honestidad brutal) hecha regla.
   - Dónde: `18_direccion.js:148 briefDiario` / `:219 briefDiarioCliente_` (armado del texto).
   - S · 7/10. **Marca (⚠):** espejo honesto que te hace decidir, NO oráculo que te cachetea. Hecho: un brief real emite un juicio anclado en un KPI + su acción.

3. **B2 — Botones de acción que CREAN aprobación desde el brief.**
   - Trillion: *"briefs que deciden, no que informan"* (1-3 acciones con botón).
   - Agregar: en el brief/CM, 1-3 acciones sugeridas que llamen `crearAprobacion(...)` (el motor default-deny ya existe). Hoy el brief solo cuenta las pendientes.
   - Dónde: `18_direccion.js` (brief) + `11_aprobaciones.js:52 crearAprobacion` + `08_webapp.js` (handler UI).
   - M · 8/10. Marca: OK (vos aprobás). Hecho: un brief real termina en una aprobación creada con 1 clic.

4. **A1 — Panel de vigilancia multi-superficie por cliente.**
   - Trillion (sitio): *"watching 6 systems 24/7: Revenue, Code, Customers, Data, Comms, Intel"*.
   - Agregar: ampliar el conector a N superficies por cliente (ventas · caja/finanzas · vencimientos fiscales 303/111/130 · operación · reseñas · competencia) + "semáforo por cliente" en el CM. Doble valor: feature Y artefacto de venta S1/S2 ("esto es lo que te vigilo 24/7").
   - Dónde: `19_conectores.js` (hoy solo `sincronizarVehemence`→`DB_VENTAS`) + CM (`08_webapp.js`/`index.html`).
   - M · 7/10. Marca: OK si se enmarca como "te aviso antes de que sea problema". Hecho: ≥2 superficies leídas para ≥1 cliente + semáforo visible. **Depende de B8 (datos reales) — no adelantar antes del go-live.**

5. **C1 — Estados de voz-turno en el orbe** (idle/escucha/pensando/habla). *[verificar primero — ver No verificado]*
   - Trillion: reels UI (orbe reactivo por estado de la conversación).
   - Agregar: si `voz.html`/agente no los tiene, mapear el estado del turno al orbe (el CM ya tiene la maquinaria de estados de agente, reusar).
   - Dónde: `voz.html` + `08_webapp.js`. S · 7/10. Hecho: el orbe cambia visiblemente entre escuchar/pensar/hablar.

**Nice:**

6. **B4 — Command palette ⌘K** (ninja-keys, GAS-ok). *[verificar el keydown existente primero]* Dónde: `src/index.html`. S · 7/10.
7. **A4 — Roster como identidad visible/marketing.** El CM ya muestra los agentes con estado (`index.html:1135`) → PARCIAL. Lo que falta es el ángulo público (avatares/nombres + "próximo agente en el lab") → **vive en B7 build-in-public**, no es dev del OS. `13_agentes.js`. nice.
8. **A5 — Roadmap público + upvoting** (reel #004): el cliente ve qué viene y vota. Como feature del OS o instalable a un cliente. M · 7/10.
9. **A6 — Lift/retención sobre tu propia cartera** (reel #036): rutina que marca qué cliente de consultoría se enfría (menos interacción, reuniones salteadas). `16_salud.js`/nueva rutina. M · 7/10.
10. **B7 — Promover 8 agentes lab→prod + hot-reload** (Forge, reel #033): activar por `flag + decisión humana` (ya así en `13_agentes.js:21`) y re-leer registry en caliente. **Diferido con gatillo** (Forge data-defined). 
11. **B8 — Prompt-caching de sub-agentes** en `llamadaAPI` (reel #040): `cache_control` sobre el system prompt. **Diferido con gatillo**: recién cuando la telemetría (`api_usage`) muestre prefijo repetido; Haiku/Opus exigen ~4096 tokens mínimos para cachear. `05_costos.js:47`. Marginal hoy.
12. **C3 — Re-inyección de persona por turno** (anti context-rot, reel DX7YMRavDfr). *[verificar en `voz/agent/`]* nice.
13. **C4 — Streaming TTS por oración** (5s→1s, reel DX93O7TRKha). *[verificar si LiveKit ya lo hace nativo]* nice.

**No es dev del OS (no meter acá):** **A3 — biblioteca de prompts/playbooks como lead magnet** (hellotrillion.ai/prompts) → es captación, vive en **B7 build-in-public**, no en el repo.

## Artefactos
| Tipo | Nombre | Ruta / ID / anchor |
|---|---|---|
| Análisis fuente | Comparativa Trillion vs Satori OS | `SATORI · Asesoramiento y consultoría/Trillion-vs-SatoriOS-comparativa-y-gaps-2026-07-07.md` |
| Dossier | Trillion consolidado | `uploads/TRILLION-Kevin-Fremon-Dossier-Consolidado-2026-07-07.md` |
| Brief + push | `briefDiario` / `briefPush_` | `src/18_direccion.js:148` · `src/06_avisos.js:43` (opt-in `brief_push_on`) |
| Aprobaciones | `crearAprobacion` | `src/11_aprobaciones.js:52` (default-deny) |
| Costo/ruteo | `llamadaAPI` / `costearUSD_` | `src/05_costos.js:47` / `:117` (sin `cache_control`) |
| Agentes | `AGENTES` registry | `src/13_agentes.js:14` (5 activos + 8 lab) |
| Conector | `sincronizarVehemence` | `src/19_conectores.js:30` (solo `DB_VENTAS`) |
| CM / orbe | doGet + estados | `src/08_webapp.js:396` · `src/index.html` (`data-orb`, `EST_TXT`) |
| Voz | doPost + agente | `src/08_webapp.js` (doPost) · `voz/agent/` · `voz.html` |
| Kill switch | `SISTEMA_PAUSADO` | `src/20_killswitch.js` |
| Trillion (fuentes) | sitio + prompts + reels | hellotrillion.ai · /prompts · /p/self-knowledge · /p/cosmic-orb-ui · reels #034 (brief) #036 (Lift) #033 (Forge) #040 (caching) #004 (roadmap) DX93O7TRKha (latencia) DX7YMRavDfr (persona) |

## Desvíos del plan original
- El plan `PLAN-ACCION-INTEGRAL-SatoriOS-2026-07-06` listaba brief-push (P2) y drift-checker (P0.6) como pendientes; **ambos se construyeron el 07-jul** → salen del backlog Trillion. El repo va por delante del plan.
- Varios "gaps" del plan 06-jul NO son de Trillion (lazo de resultados = MAPA propio; status-report = Luke; clasificador confianza+escalate = @_no_hype_ai) → **excluidos** de este handoff por scope ("de Trillion"). Viven en su propio plan.

---

## Apéndice histórico
{Se lee solo si reaparece un problema o se cuestiona una decisión.}

### Ya hecho de Trillion — NO re-agregar (verificado 08-jul contra `src/`)
Brief diario + packets of truth (`estadoVigente`, `18_direccion.js:16`) · **brief-push email** (`briefPush_`, solo falta `brief_push_on=true`) · North Star por tenant + sistema (`northStarSatori_:270`) · CAPABILITIES.md autogenerado + **drift-checker pre-push instalado** · ruteo de modelo por costo + telemetría `api_usage` (`llamadaAPI`/`costearUSD_`) · registry 13 agentes con estados en el CM · orbe 3D + CEREBRO + KEYSTONE · voz pipeline + PWA · Bastión (default-deny `crearAprobacion` + kill switch `SISTEMA_PAUSADO`) · patrón `handoff.md`.

### Decisiones y descartes (de Trillion — NO re-proponer)
- Descartado: stack Python/Postgres/FastAPI/DigitalOcean — GAS ya es el cloud always-on (triggers nativos).
- Descartado: voz WS-custom sin LiveKit — se eligió LiveKit como gestor.
- Descartado: Bitcoin/Spotify — irrelevante al dominio.
- Descartado: waitlist gamificada a 10k OSS — Satori vende servicios, no libera repo.
- Descartado: "inyectar reseñas" — ilegal en UE (Directiva Omnibus).
- Descartado: self-approval del agente — gana el default-deny del MAESTRO.
- Descartado: bloom del orbe (UnrealBloomPass) — probado y revertido (recuadro opaco en iframe GAS, `596b473`).
- Descartado: daemon always-on / OpenClaw — Bastión rojo.

### Imprevistos y resolución
- [08-jul] El plan 06-jul marcaba brief-push y drift-checker como gaps → al verificar `src/` ambos estaban construidos (07-jul). Lección: **verificar contra el repo, no contra el plan** (el repo va por delante); tratar el plan como "No verificado".

### Changelog del handoff
- [08/07/2026] v1 — creado. Delta Trillion→OS verificado contra `src/` (no contra el plan). ~13 ítems should/nice; 0 must. Correcciones: brief-push + drift-checker ya construidos. Persistencia en Cerebro **HECHA**: puntero en `MOC - Satori OS` §"Integración Trillion — delta pendiente (08-jul)" + línea 08-jul en `BITACORA-ACTUALIZACIONES`; sin cambio de estado en CEREBRO (es backlog, no cambia el estado del proyecto).
