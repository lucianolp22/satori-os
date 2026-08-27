# ENCARGO CODE — E3 · SATORI HQ build real (port de la maqueta v3) · 18/08/2026

> **Aprobado por Luciano (17-ago):** maqueta `MAQUETA-SATORI-HQ-v3-apple.html` (en el repo, junto a v1/v2). Registro híbrido, **acabado Apple/Glass**. Reemplaza la HQ v0 congelada (`src/hq.html`) por la ficha real con data viva en las 5 solapas.
>
> **Antes de tocar nada:** `limpiarTodoTest` ya corrido (18-ago 01:22) — MAESTRO limpio de CLI-022..028. Confirmar con `estadoVigente` que Clientes esté en ~20-21 antes de portar.
>
> **Regla Satori:** cambios ADITIVOS + lista-contrato (grepear consumidores en el MISMO commit) · endpoints nuevos con `_soloOwner_` + alta en `ENDPOINTS_UI` (22_seguridad.js) en el MISMO commit · `_verificar_index.py` + selfTest verde + eyeball antes de promote.

## Cómo se sirve hoy la HQ (verificado por Code 18-ago)

`grep -i hq` en `08_webapp.js` da **0**: la ruta NO está en el webapp con ese nombre. La HQ v0 se sirve por **`doGet` con `?v=hq`** (parámetro), que devuelve `src/hq.html` (commit `eaee70e`/`d2227c3`). **Confirmar el punto de servido en `doGet` (08_webapp.js) antes de portar** — el reemplazo es del contenido de `src/hq.html`, no de la ruta.

## Alcance

`src/hq.html` pasa de maqueta congelada (Hoy/Checklist/Objetivos/Números estáticos) a **data real por `google.script.run`**, con el acabado Apple/Glass de la v3. Cartera ya es real (`carteraPipeline`) — se conserva. La v0 sigue de fallback estático si el backend no responde (patrón actual: nada falla mudo).

### Decisión CERRADA — REEMPLAZO TOTAL de `src/hq.html` (no incremental)

La v3 **reemplaza el archivo entero**; NO es un port incremental sobre la estructura del 13/08. Motivo: **la v3 es superset de la v0**. Al construir la maqueta se copiaron del v0, idénticos, todos los puntos vivos: el bloque `carteraPipeline` (con `withSuccessHandler`/`withFailureHandler` + fallback estático + toast), la lectura diferida de `SATORI_WRAPPER_URL`, el botón «← OS», la fecha del navegador y el canvas `cosmos`. **No se pierde nada del v0.** Las 4 solapas restantes (Hoy/Checklist/Objetivos/Números) están congeladas **en ambos** (v0 y v3): el port no les quita cableado — se lo **agrega** (`hqHoy`/`hqChecklist`/`hqObjetivos`/`hqNumeros`) sobre su fallback estático, con el mismo patrón que `carteraPipeline`. Resultado: un solo HQ vivo, sin doble versión. Descartadas las opciones "incremental" y "convive".

## Schema nuevo (01_schema.js — hojas del MAESTRO, tenant CLI-000)

**IMPORTANTE (Bastión):** el checklist y los objetivos son **PII personal de Luciano** → viven en el MAESTRO (CLI-000), NUNCA en Sheets de cliente, y no entran en capturas de demo.

1. **`checklist_propia`**: `['id_item','capa','texto','recurrencia','estado','orden','fecha_check']`
   - `capa` = `diaria_manana | diaria_cierre | semanal` · `recurrencia` = `1d|1s|2s|1m` · `estado` = `pendiente|hecho`.
2. **`objetivos_propios`**: `['id_obj','eje','horizonte','nombre','flow_pct','metrica','actual','meta','sgic_sugiere','estado']`
   - `eje` = `profesional | calidad_vida | finanzas | oportunidades` · `horizonte` = `corto|mediano|largo`.

Ambas: lazy (fuera de `CLIENTE_ORDEN`), en `MAESTRO_SHEETS`, reconciliadas por `ensureSheet` aditivo. Sembrar con los valores de la maqueta como semilla (idempotente, patrón `sembrarNorthStarSatori_`). Mantener verde el assert D32a1 (schema↔columnas) en el mismo commit.

## Endpoints nuevos (08_webapp.js + alta en ENDPOINTS_UI)

Todos `_soloOwner_`, devuelven objeto (fail-closed si falta hoja):

- **`hqHoy()`** → reusa lo que ya existe: `bootUnico()`/`datosHoy` (próximas 3 del Director, chips aprobaciones/escalados/avisos), guardián foco/paz, NS_serie (sparkline) + North Star actual/meta (el anillo). NO duplicar lógica: componer desde las fuentes vivas.
- **`hqChecklist()`** → lee `checklist_propia` agrupado por `capa`. Marcar/desmarcar = **`hqChecklistToggle(id_item)`** (escribe `estado`+`fecha_check`; recurrencia resetea en su ciclo). La captura rápida reusa el chokepoint de **Bandeja** (`17_bandeja.js`) — NO un write path nuevo.
- **`hqObjetivos()`** → lee `objetivos_propios` (4 ejes × 3 horizontes) con `flow_pct`, `metrica` (v3), `sgic_sugiere` (del Director, `18_direccion.js`).
- **`hqNumeros()`** → ingresos recurrentes por moneda (sin total global) + `31_admin.js` (gasto API/tokens/errores/integridad/backup/deploy). Respetar `fmtMoneda` (miles es-ES + `$`/`€` solo si el dato nombra divisa).

## UI (src/hq.html ← MAQUETA-SATORI-HQ-v3-apple.html)

Portar el HTML/CSS/JS de la maqueta v3 tal cual, cambiando los fallbacks estáticos por `google.script.run` (patrón idéntico al de `carteraPipeline` ya presente):
- **Tokens glass + sólido** (material-apple): vidrio SOLO en topbar/tabs/hero-NorthStar/toast; sólido en Números/Objetivos/Checklist/Cartera. `prefers-reduced-transparency` → glass cae a sólido (ya en la maqueta).
- **Anillo North Star** animado desde el valor en pantalla (ya en la maqueta; el "5/6" ya está centrado).
- **Fuentes:** Fraunces (acento marca) + SF Pro/system (UI). `JetBrains Mono` para montos con `tabular-nums`.
- **Volver** (`SATORI_WRAPPER_URL`) y **fecha** ya cableados.

### Refinamientos pre-port (purga de la maqueta)
- **Grilla 8pt:** normalizar paddings 14/18/20px → 16/20/24 (var `--sp-*`).
- **Targets:** botones `→ 360` de Cartera 28px → **≥44px en mobile** (media query).
- **6 estados** por control interactivo (hover/focus/active/disabled/loading/empty) — cablear loading/empty contra `google.script.run` (spinner + vacío honesto).

## Verificación

1. `estadoVigente` confirma MAESTRO limpio (Clientes ~20-21, sin CLI-02x).
2. `python3 _verificar_index.py`.
3. `setup()` (siembra schemas nuevos) → `selfTest()` verde (agregar asserts: schemas `checklist_propia`/`objetivos_propios` existen + endpoints en ENDPOINTS_UI + aislamiento CLI-000 de la PII + D32a1).
4. Eyeball `/dev` `?v=hq`: las 5 solapas con data real; anillo centrado; glass solo donde flota; reduced-transparency probado.
5. Promote `_promote_exec.sh --go`.

## Bastión

- Checklist/objetivos = PII de Luciano → MAESTRO (CLI-000), nunca Sheets cliente, fuera de capturas de demo.
- Endpoints nuevos: `_soloOwner_` + ENDPOINTS_UI en el mismo commit (regla anti-drift, precedente D31/D24c).
- Captura rápida → reusar `appendFila`→`sanitizarCelda` de Bandeja; ningún write path nuevo.

*Encargo Cowork · 18/08/2026. Base: maqueta v3 aprobada + fuentes vivas ya existentes (datosHoy, Director, 31_admin, carteraPipeline). Esfuerzo: L (2-3 tandas: schema+endpoints / UI-port / asserts+eyeball).*
