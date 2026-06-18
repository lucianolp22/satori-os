# HANDOFF — Satori OS — 2026-06-18 (v6)

PRÓXIMO PASO: **cargar la operación real de Vehemence (CLI-002)** — `Datos_operativos` + KPIs + proyectos/tareas — para que brief/snapshot dejen de estar vacíos (el 80/20). La **Capa de Dirección está 3/3 y en producción**: `estadoVigente` + `briefDiario` + North Star de Satori (progreso 4/6 real) + feed truncado. Pendiente menor antes de cerrar el commit: pushear el **fix del horizonte** (Config coacciona '2026-12-31'→Date; ya parcheado con `_hzLimpio_`) + setear North Star de Vehemence (`cargarObjetivo('CLI-002', {descripcion:'Subir el ticket promedio', metrica:'ticket_promedio_eur', valor_objetivo:22, horizonte:'12m', prioridad:'A'})`) + commit.

## Estado vigente
Satori OS = ERP multi-tenant sobre **GAS + Google Sheets** (1 proyecto MAESTRO opera N Sheets cliente), **en producción** bajo `luciano@satoriconsultoria.com`. **E1 + E2+** (capa Trillion: aprobaciones, costos+Bastión, cola durable, 13 agentes —5 con runner / 8 lab—, Command Center) y **E8a** (cerebro / Director / Salud + Command Center a4.1 telemetría/Salud/directiva + a4.2 orbe-vivo + mobile-first) **CERRADAS**. El sistema **ya produce análisis real**. Dos casos de IG analizados e integrados/planeados: **@_no_hype_ai** (Fase 0+1: Bandeja+clasificador) y **@kevinfremon** (aprobada la "Capa de Dirección" + extras). Modo de trabajo: Círculo/Equipo/Bastión de fondo + AREL + satori-design + purga al cierre (en `userPreferences`/skills, no repetir acá).

### Verificado
- [18-jun] **Capa de Dirección 3/3 — must #3 North Star CERRADO / en producción**: `cargarNorthStarSatori()` fija el North Star de Satori en Config; `estadoVigente()`/`briefDiario()` lo muestran con **progreso auto 4/6 clientes** (proxy activo/piloto); selfTest **D3** verde; feed truncado (`truncar_`). Fix horizonte (`_hzLimpio_`, Config coacciona la fecha) aplicado — **pend. push + commit**. North Star por-cliente = `cargarObjetivo(id, …)` (reusa 15_cerebro).
- [18-jun] **Capa de Dirección · must #1 `estadoVigente()` + must #2 `briefDiario()` CERRADOS / en producción** (commit `fe6655d`): `selfTest()` verde con **D1+D2**, salida real verificada — snapshot de sistema (5 clientes, $0.0177/$25, Salud OK 100%) + brief con BLUF que rutea por urgencia y "Movimiento reciente" enganchando Bandeja/Analista reales. Composición pura sobre el data-layer, **0 API**, AREL-safe. **Hallazgo auto-purga:** textos largos del feed ensucian "Movimiento reciente" → truncar (pend., junto al #3).
- [18-jun] **Fase 0/1 Jarvis (Bandeja) CERRADA / en producción**: push 20 files OK; `setup()` creó la pestaña `Bandeja` (14 pestañas); `selfTest()` cerró "— TODO OK —" con los 5 checks **F1**; `instalarTriggerBandeja()` instalado (30 min); prueba real `clasificarBandeja()` = `{procesados:4, escalados:1}` con ruteo correcto (idea / tarea+CLI-002 / referencia / escalate conf1) y costo **$0.02 / $25**. **Purga F1–F6 aplicada pre-push** (conLock en `capturar`, claim atómico anti-doble-gasto en `clasificarBandeja`, cap 25/corrida, guard Clientes, doc, conteo). Commit `89ec85e`.
- [16-jun] **Sistema corriendo con datos reales**: `sembrarDatosEjemplo('CLI-001')` → `corridaDiaria()` → Analista sacó margen op **58,5%** y alertó margen neto **−3,8%**; Vigía detectó factura por vencer + cobro pendiente. Evidencia: screenshots del feed Actividad + log de `corridaDiaria` (`correrDirector` encoló 1 por objetivo; `correrSalud` 6/6 ok).
- [16-jun] **Command Center** (a4.1 + a4.2 orbe-vivo + mobile + labels derechos) verificado por Luciano en **desktop e iPhone**.
- [16-jun] `selfTest()` cerró "— TODO OK —" (bloques E8a-1/2/3) corrido en el editor por Luciano.
- [16-jun] **E2+ y E8a cerradas**; Purga E8a (0 críticos → 7 parches) pusheada; proyecto viejo neutralizado.
- [16-jun] API real **status 200** (Haiku), tope USD 25/mes, key rotada en Script Properties.

### No verificado
- Todo lo de la sección Pendiente (Capa de Dirección, voz, neural-map, Forge, etc.): no construido.

## Pendiente
**Must (ruta crítica de la próxima sesión):**
1. **Capa de Dirección** (los 3 *must* de kevinfremon, juntos = producto S2 "co-piloto operativo"; detalle en `PLAN-INTEGRACION-kevinfremon.md`):
   - ✅ **`estadoVigente()`** (`18_direccion.js`) — snapshot markdown del MAESTRO (Satori) o cliente. **CERRADO/producción** 18-jun. Dogfood resuelto = **Satori a nivel sistema** (el MAESTRO = la consultora; el CLI-Satori literal se crea al definir el North Star).
   - ✅ **`briefDiario()`** (`18_direccion.js`) — BLUF + "3 cosas hoy" + números + movimiento, rule-based **0 API**. **CERRADO/producción** 18-jun (D2 verde, salida real OK). Pend.: truncar textos largos del feed; la lógica del BLUF la afina Luciano; entrega email/Doc = opt-in aparte (AREL).
   - ✅ **North Star** — de Satori a nivel sistema (Config + **progreso auto 4/6 clientes**) en `estadoVigente`/`briefDiario`; por cliente vía `cargarObjetivo(id, …)` (reusa 15_cerebro). **CERRADO/producción** 18-jun (D3 verde). Pend.: push del fix horizonte + North Star de Vehemence (objetivo: subir ticket promedio).
2. **Ruteo de modelo por costo** (quick win): fijar `modelo` por RUNNER (Haiku triaje, Sonnet/Opus veredicto) — la infra ya acepta `opts.modelo`.

**Should (aprobado por Luciano 16-jun; secuenciar tras los must — con FIT-CHECK GAS):**
- **Voz** ⚠️ fit-check: GAS Web App **no hace voz real-time** (sin proceso persistente/WebSocket/STT-TTS nativo). Fork a decidir: (a) **voz liviana** client-side con Web Speech API + `speechSynthesis` dentro del Command Center (gratis, GAS-compatible, limitada); (b) **full Trillion** (Deepgram+ElevenLabs+wake word) = **stack aparte** always-on (Node/Python), su propio proyecto + costo (~$99+/mo ElevenLabs). No construir sin elegir fork.
- **Neural-map del cerebro** ⚠️ fit-check: 3D (Three.js) en el iframe cross-origin de GAS pesa; el **orbe-vivo (a4.2) ya da el "cerebro vivo"**. Alternativa liviana: force-graph 2D de `nodos`/`aristas`. Decidir 2D-liviano vs 3D.
- **Forge / agentes que crean agentes** ⚠️ reframe: en GAS el código es estático (clasp), **no hay code-gen runtime**. Traducción real: **agentes DEFINIDOS por datos** (registry con prompt/fuente/modelo configurable) → activar los 8 lab por etapas, cada uno con su fuente de datos. Es el camino para "activar todos los agentes" bien.
- **Prompt caching** — honesto: la arquitectura de Satori arma cada prompt con los datos (no reusa un system-prompt grande), así que el ahorro es **marginal**; se hace si Luciano insiste, bajo esa expectativa.
- **Jarvis Fase 2**: separar ideas/ejecución + **índice raíz jerárquico** (= el `_index.md` de Kevin; **no duplicar** — es lo mismo, construir una vez; matiz: jerarquía por importancia, token-optimizado).
- **Jarvis Fase 3**: PM persistente que mantiene (sobre Director/Equipo/Salud).

**Nice / negocio / bloqueado:**
- **Motor build-in-public (KAIROS, track de negocio — NO código del OS):** contenido diario + lead magnet + waitlist + responder DMs → ataca la **cartera** (cuello declarado). Empalmar con **Bloque 6 KAIROS** (análisis/priorización de los 11 candidatos). Aprobado 16-jun; abrir como iniciativa aparte.
- **E8b (entrenamiento de agentes)** — BLOQUEADO: falta el doc canónico **CEREBRO** + montar el **snapshot del Equipo** (`agentes-satori-os.md`).
- Residuales: trashear proyecto + 6 Sheets viejos (cuando Luciano confirme); deuda Purga M1 (atomicidad)/M3 (perf batch)/B3 (cross-ref); ¿migrar los otros 4 proyectos GAS de clientes?; subir a `os@` dedicado antes de escalar.
- Otros diferidos kevinfremon: routine-manager UI, pantalla de notificaciones móvil, `CAPABILITIES.md` auto, loop de feedback de cliente (roadmap+upvoting) como feature de servicio.

## Artefactos
| Tipo | Nombre | Ruta / ID / URL |
|---|---|---|
| Repo | SatoriOS | `~/Documents/Claude/Projects/SatoriOS` |
| Índice repo | ARCHITECTURE.md | repo root (al día con Fase 1) |
| Proyecto GAS (vivo) | "Satori OS — MAESTRO" | `luciano@satoriconsultoria.com`; scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` (en `.clasp.json`, gitignored) |
| MAESTRO (Sheet) | Satori OS — MAESTRO | `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` |
| Web App (dev, solo dueño) | Command Center | deployment `AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I` (`…/dev`) |
| Bandeja (Fase 1) | `17_bandeja.js` | `capturar`, `clasificarBandeja`, `instalarTriggerBandeja` |
| Helpers alta | `15_cerebro.js` | `cargarObjetivo`, `cargarObjetivosPiloto`, `sembrarDatosEjemplo` |
| Planes integración | `PLAN-INTEGRACION-jarvis-os.md` · `PLAN-INTEGRACION-kevinfremon.md` | repo root |
| Prácticas + activación | `PRACTICAS-jarvis.md` · `ACTIVACION.md` · `ejemplo_Datos_operativos.csv` | repo root |
| Informes IG (fuente) | informe/transcripciones `_no_hype_ai` y `kevinfremon` | adjuntos de la sesión (no en repo) |
| Secretos | `MAESTRO_ID`, `CLAUDE_API_KEY` | Script Properties (key rotada) |

## Desvíos del plan original
- El plan paró tras E8a para **integrar 2 casos externos** (@_no_hype_ai, @kevinfremon): sumaron la Bandeja (hecha) + la Capa de Dirección + extras (voz/neural-map/Forge/caching) + el track de negocio build-in-public. Backlog ampliado a pedido de Luciano (16-jun).
- El roster lab (Flux/Prism/Scout/Relay/Atlas/Forge/Lift/Spark) = el de Trillion (@kevinfremon): nomenclatura ya absorbida; "activar" = darles runner data-defined, no flipear flag (ver Should/Forge).
- "Activar los 8 agentes" se decidió **mantener en lab** (16-jun): sin runner ni fuente de datos; se reabre vía el reframe Forge (agentes data-defined).

---

## Apéndice histórico
{Se lee solo si un problema reaparece o se cuestiona una decisión.}

### Decisiones y descartes
- **Decidido:** Workspace **C1** reusando `luciano@satoriconsultoria.com` (admin) como identidad de servicio del piloto (mitigación: deploy MYSELF, trust solo ese client ID, mover a `os@` antes de escalar). **Rotar** la API key.
- **Decidido (16-jun):** los 8 agentes lab **quedan en lab** (no tienen runner ni fuente de datos; activarlos a lo bruto = romperlos). Reabrir bien vía Forge data-defined.
- **Decidido (16-jun):** Bandeja = **fork A** (capa personal de Luciano); sin anonimizar (texto propio, necesita ver nombres); costo a `Consumo_agentes` como 'clasificador'.
- **Descartado:** daemon always-on (Hermes/OpenClaw del caso Jarvis) — riesgo de seguridad ("get hacked"); en stand-by.
- **Descartado:** darle email propio al agente (kevinfremon) — el modelo de **aprobación** es más seguro.
- **NO reimportar (ya en Satori ≥ o mejor):** orquestación (Director+cola), handoff (skill), cost-tracking (telemetría+Consumo), seguridad (Bastión/Purga), infra 24/7 (triggers GAS), requirements-doc, feedback brutal (Purga/Consejo).

### Imprevistos y resolución
- [15-jun] `a6e641e` no resolvió E2-1 → **lección: instrumentar (`debugE21`) antes de teorizar.** `appendRow` coacciona pese al `'@'` → fix per-celda en `appendFila` (NO remover).
- [16-jun] Mobile del Command Center colapsaba (orbe en stage `1fr` aplastado) → `grid-rows:none` + `cm-stage{min-height:360px}` + agentes a chips 2-col. Lección: el iframe GAS no es auto-verificable; lo prueba Luciano en device.
- [16-jun] Labels de agentes giraban (animación CSS desincronizada al reconstruir nodos c/5s) → órbita manejada por JS (`cmGirar`/`cmOrbitar`), contra-rotación sincronizada.
- [16-jun] `clasp push` repetido tiró `invalid_rapt` (token de sesión Google vencido) → `clasp login` y reintentar. No es bloqueo.
- [16-jun] CSV no entró por pegado → `sembrarDatosEjemplo()` (alta por función) evita la fricción.

### Changelog del handoff
- [18-jun] **v6:** **Capa de Dirección CERRADA (3/3) y en producción** — `estadoVigente()` + `briefDiario()` (commit `fe6655d`) + North Star de Satori (Config, progreso auto 4/6) + fix feed + fix horizonte (`_hzLimpio_`, pend. push). selfTest D1+D2+D3 verde. Próximo: cargar operación real de Vehemence (el 80/20).
- [18-jun] **v5:** Fase 0/1 Jarvis (Bandeja) **CERRADA y en producción** — pusheada (20 files), `setup()`/`selfTest()` F1 verde, trigger instalado, prueba real `{procesados:4, escalados:1}` con ruteo correcto + costo $0.02. **Purga F1–F6 aplicada pre-push** (atomicidad `capturar`, claim anti-doble-gasto, cap/corrida, guards). Imprevisto del push (`invalid_rapt`) resuelto con `clasp logout && clasp login`. Próximo must: Capa de Dirección.
- [16-jun] **v4:** E2+ y E8a CERRADAS + sistema corriendo con datos reales + a4.2 orbe-vivo + mobile + Fase 0/1 Jarvis (Bandeja) construida (pend. push/test). Aprobada la Capa de Dirección (kevinfremon) + extras + build-in-public. Backlog reorganizado.
- [15-jun] v2/v3: migración a Workspace + E2-1 resuelto + selfTest verde + Purga; build de E8a.
- [15-jun] v1: descubierto bloqueo APP, decidida migración; E2-1 sin diagnosticar.
