# HANDOFF E2+ — Construcción Etapa 2 enriquecida con capa Trillion (para Claude Code)

**Fecha:** 2026-06-12 · **Ejecuta:** Claude Code en `~/Documents/Claude/Projects/SatoriOS` · **Cuándo:** al cerrar la validación de E1 (~26-jun) salvo orden de Luciano de adelantar.
**Leer antes de tocar código:** `ARCHITECTURE.md` del repo → `ETAPA 2 - Especificación...md` → este handoff. No re-derivar decisiones.

## 1. Qué es E2+

E2 según su spec (motor de aprobaciones + wrapper de costos + seguridad/Bastión + Lote B de la Purga) **más** la capa Trillion aprobada hoy: cola de tareas durable, registry de 13 sub-agentes con runners Claude API, y el Centro de Mando B-orbe como vista adicional de la UI. Código donante ya escrito y verificado en sintaxis: `../Videos analizados/satori-os/` (Config.gs, Cola.gs, Agentes.gs, WebApp.gs, index.html). **Es donante, no se copia tal cual: se adapta a las convenciones del repo.**

## 2. Decisiones que rigen la integración (tomadas hoy, no rediscutir)

1. Roster: 13 agentes — 5 activos (Vigía, Conciliador, Cobrador, Analista, Abastecedor) + 8 laboratorio bloqueados (Flux, Relay, Scout, Prism, Atlas, Spark, Forge, Lift). Activar = flag + decisión humana.
2. Gates humanos: TODO agente que acciona hacia afuera propone vía **el motor de aprobaciones de E2** (`crearAprobacion`), NUNCA por canal propio. El sistema de aprobación del código donante (hoja `actividad` col. aprobada) SE DESCARTA.
3. Presupuesto API: tope mensual USD 25 editable (Script Properties) + cupos diarios por agente (maxDia del registry) → se fusiona con el wrapper de costos E2 y su presupuesto por cliente. Vigía nunca se pausa; pausa siempre visible en feed.
4. UI: Centro de Mando B-orbe (DESIGN.md v2.0 §8bis, overlay A+) como **vista adicional**; la vista «Hoy» Registro A queda intacta. Orbe con voz: post-piloto (sin cambio).
5. El feed `actividad` (hoja nueva en MAESTRO) alimenta el activity feed de la UI.

## 3. Plan por módulos (orden de construcción)

| # | Módulo | Acción |
|---|---|---|
| 0 | Limpieza | Eliminar `src/11_repro.js` (pendiente declarado en ARCHITECTURE) |
| 1 | Lote B Purga E1 | Aplicar #3, #5, #6, #7, #11/#12, #23, #24, #25 y UI #17-22 según `PURGA ETAPA 1...md` — ANTES de sumar features |
| 2 | E2 Módulo 1 | Motor de aprobaciones según spec (crear/resolver/ejecutar/expirar + clasificador default-deny + reglas desde excepciones) |
| 3 | E2 Módulos 2-3 | Wrapper `llamadaAPI()` completo (anonimizar → fetch → log SIEMPRE → error tipado) + seguridad Bastión |
| 4 | `src/12_cola.js` | Adaptar `Cola.gs` donante: hoja `tareas` se declara en `01_schema.js` (MAESTRO_SHEETS); usar `07_util` (ensureSheet/appendFila/leerTabla/ahoraISO) y `getMaestro()`; LockService + drain se conservan tal cual; trigger `drenarCola` cada 5 min se suma a `instalarTriggers()` de `06_avisos.js` |
| 5 | `src/13_agentes.js` | Adaptar `Agentes.gs` donante: registry 13 intacto; `llamarClaude_` SE ELIMINA → los runners llaman `llamadaAPI(idCliente,...)` (consigue anonimización + log + presupuesto gratis); gates → `crearAprobacion(...)`; cupos maxDia se chequean acá; runners leen las hojas reales del Sheet de cada cliente según `CLIENTE_SHEETS` (verificar nombres en 01_schema — NO asumir `ventas`/`banco`/`facturas`/`stock` del donante) |
| 6 | `corridaDiaria()` | Pasa a ENCOLAR agentes (vigia para cada cliente activo) en vez de llamar detectores directo donde aplique; detectores existentes se conservan |
| 7 | UI | Fusionar Centro de Mando del `index.html` donante como vista nueva en `src/index.html`: orbe canvas + órbitas activos/laboratorio + feed (textContent, XSS-safe) + barra presupuesto + modo calma + inbox de aprobaciones E2 con teclado (mejora ya aprobada) + ⌘K command palette + saludo contextual + timestamp sync legible + quitar jerga "stub" |
| 8 | Verificación | `selfTest()` existente verde + casos nuevos (abajo) + casos de aceptación E2 (los 6 de la spec) |

## 4. Casos de aceptación NUEVOS (además de los 6 de E2)

7. Encolar noop + matar/reiniciar contexto → al correr `drenarCola()` la tarea completa (drain-on-startup).
8. Dos ejecuciones concurrentes de `drenarCola()` → ninguna tarea tomada 2 veces (LockService).
9. Disparar Cobrador → corre hasta el final, genera PENDIENTE en Aprobaciones del cliente (default-deny), su tarea queda `completada` con status `esperando_aprobacion`; NADA se envía sin `resolverAprobacion`.
10. Agente del laboratorio disparado → error honesto "en el laboratorio", nunca corre.
11. Cupo diario agotado → pausa visible en feed + tarea fallida, no éxito silencioso.
12. Runner contra cliente sin datos → "sin datos aún" honesto, jamás inventa.
13. UI: vista Hoy intacta; Centro de Mando renderiza 13 agentes con estados reales de la cola; aprobar desde el inbox resuelve vía `resolverAprobacion`.

## 5. Reglas duras

- Convenciones del repo mandan (IDs con prefijo, fechas ISO, TZ Europe/Madrid, append-only, `01_schema.js` como única fuente del modelo).
- `selfTest()` después de cada módulo; nada se declara hecho sin verificación (los 7 observadores del panel vigilan).
- Purga completa al cerrar E2+ antes de declarar la etapa.
- Los archivos donantes en `Videos analizados/satori-os/` NO se editan más: son referencia congelada de hoy.
- Obsoletos a borrar por Luciano en Drive (no por agentes): Sheet "Satori OS — Piloto" + "Proyecto sin título" (creados hoy por error de contexto, reemplazados por MAESTRO).

## 6. Estado al escribir esto

E1 cerrada y en validación de uso hasta ~26-jun (no tocar producción). DESIGN.md ya está en v2.0 con el overlay B-orbe (§8bis). Plan del día y catálogo de recursos Trillion: `PLAN-SATORI-OS.md` (superseded por este handoff en lo que choque) y `satori-os-recursos-trillion.md`. Prompt original de arquitectura: `uploads/cloud-to-local.md` (queda copiado en `referencias/` si se quiere versionar).

---

## 7. ADENDA 21-jun — Presupuesto de performance del orbe (refina el Módulo 7 UI)

**Origen:** informe del reel de Kevin Fremon (`2026-06-21 - Informe - UI orbe Trillion (Three.js)...md`). Trillion corre el orbe en 4K y le saturaba GPU/CPU/RAM en background; metió un toggle a 1080. Validado técnicamente (foros Three.js, confianza 9/10). El dato es directamente aplicable al Centro de Mando B-orbe.

**Decisión que rige (no rediscutir):** el orbe es vista adicional; la vista «Hoy» Registro A **nunca** paga el costo del 3D. El orbe NO entra a piloto sin cumplir el presupuesto de recursos de abajo. Bajar resolución es la última palanca, no la primera.

**Requisitos al Módulo 7 UI — el 20% que da el 80% (must, en este orden):**
1. **Render solo cuando el orbe es visible.** No instanciar/animar el canvas WebGL mientras la vista activa es «Hoy». Arrancar el loop al entrar al Centro de Mando, destruirlo (`renderer.dispose()`) o pausarlo al salir.
2. **Page Visibility API.** `cancelAnimationFrame` cuando `document.hidden`; reanudar en `visibilitychange`. Sin esto el orbe quema GPU con la pestaña de fondo (el error exacto de Kevin).
3. **Cap de `devicePixelRatio`.** `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))`. Nunca pixel ratio nativo en Retina.
4. **Toggle de calidad alto/bajo** (lo de Kevin, pero por encima de 1-3, no en vez de). Bajo = pixel ratio reducido + FPS cap (~30). Persistir preferencia. ⚠️ **No asumir `localStorage`:** la UI corre en el iframe sandbox de HtmlService — verificar si persiste; si no, guardar la preferencia en el backend (Properties/MAESTRO) vía `google.script.run`.

**Presupuesto de recursos (criterio de aceptación, no estético):** FPS objetivo ≥30 en hardware modesto; con pestaña en background, 0 frames y CPU/GPU ~idle. Medir consumo antes/después en el mockup `satori-os-demo-b-orbe.html` ANTES de portar al repo.

**Casos de aceptación NUEVOS (continúa la numeración; van además de 7-13):**
- **14.** Pestaña en background (`document.hidden`) → orbe pausa render (0 frames), CPU/GPU vuelve a idle; al volver, reanuda sin glitch.
- **15.** Vista «Hoy» activa (no Centro de Mando) → no hay canvas WebGL animando; consumo del 3D = 0.
- **16.** Toggle calidad en «bajo» → pixel ratio y FPS bajan, orbe sigue legible, consumo medible menor; preferencia sobrevive a recargar la Web App.
- **17.** Pantalla Retina (dPR 2-3) → `setPixelRatio` clampa a ≤1.5; no renderiza a resolución nativa.

**Regla dura:** si el presupuesto de recursos no se cumple, el orbe queda detrás de flag y no entra a piloto. Vista «Hoy» intacta es innegociable.

**Nice (no en este módulo):** evaluar WebGPU con fallback a WebGL2 como ruta de optimización futura si el orbe se vuelve permanente. Subir el presupuesto de recursos a `DESIGN.md §8bis` como criterio de aceptación de la vista (proponer en DESIGN.md primero, regla del repo).
