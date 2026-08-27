# RUNBOOK · Optimización de tokens en Claude Max — 27/08/2026

> Cinco palancas, ordenadas por relación impacto/esfuerzo. Cada número está medido, no estimado;
> el que no se pudo medir dice que no se pudo.
> Baseline: **USD 44,08/semana** (media sobre los últimos 14 días, Fuente A del Medidor).
> Total verificado a hoy: **USD 500,37** — el «650,54» que circulaba estaba stale.

---

## Palanca (a) · Prompt caching — la única que cambia el orden de magnitud

El caching de Anthropic es **match de prefijo**: cualquier byte que cambie invalida todo lo que
viene después. El orden de render es `tools → system → messages`.

**Regla operativa:** lo estable primero (identidad, reglas, roster de herramientas), lo volátil
después (fecha, contexto del cliente, la pregunta). El breakpoint va justo en la frontera.

**Mínimo cacheable por modelo — no es monótono, y ahí está la trampa:**

| Modelo | Mínimo |
|---|---:|
| Opus 5 / Fable 5 | 512 |
| **Sonnet 5** / Sonnet 4.6 / Opus 4.8 | **1.024** |
| Opus 4.7 | 2.048 |
| **Haiku 4.5** / Opus 4.6 | **4.096** |

Un prefijo por debajo del mínimo **no cachea y la API no avisa**: devuelve
`cache_creation_input_tokens: 0` en silencio. Por eso `_systemBloques_` (`05_costos.js`) hace el
gate de este lado y lo anota en `cache_intentado`.

**Estado medido hoy:**

| Superficie | Prefijo | ¿Cachea? |
|---|---:|---|
| Sato-VOZ (tools + system, medido contra la API) | **8.125 tok** | **sí** — `cache_read=8125` al 2º turno |
| Sato-in-GAS post-F3 (gate `len/4`) | 3.728 est | **sólo Sonnet 5** — no llega a los 4.096 de Haiku |
| Los 5 agentes lab + Bandeja (`GUARDIA_INYECCION`) | 143 tok | **no**, 26× por debajo |

## Palanca (b) · **La no obvia: un modelo más caro cacheado sale más barato que el barato sin cachear**

| Ruta | USD/M de input |
|---|---:|
| Haiku 4.5 **sin** caché | 1,00 |
| **Sonnet 5 con caché** (lectura 0,10×) | **0,20** |
| Sonnet 5 sin caché | 2,00 |

⚠ **Aplica sólo donde el bloque no llega al mínimo de Haiku.** Hoy eso es **Sato-in-GAS**, no la voz.
En la voz el prefijo son 8.125 tokens: Haiku cachea igual, cuesta la mitad y es más rápido.
**Por eso las dos superficies tienen modelos distintos** (`SATO_VOZ_MODELO` vs Config `sato_modelo`),
y está bien que así sea.

**Antes de aplicarla, medir el prefijo real.** Es exactamente el error que este proyecto casi comete:
la palanca era cierta y estaba en la otra superficie.

## Palanca (c) · Ruteo por modelo

`MODELOS_POR_MODULO` + Config `modelo_<modulo>` (pisa sin deploy). Haiku para triaje y alta
frecuencia; Sonnet para veredicto y razonamiento con números. **No subir de tier por las dudas.**
El override vive en Config: se prueba una semana y se revierte sin tocar código.

## Palanca (d) · `max_tokens` sobredimensionados

Un `max_tokens` alto no cuesta si no se usa, pero **truncar sí cuesta**: obliga a reintentar y se
paga el input dos veces. Valores vigentes, todos deliberados: voz 300 (hablado = corto = rápido) ·
Sato texto 700 · agentes 500-700 · clasificador 400. **No hay nada sobredimensionado hoy.**

## Palanca (f) · Web search — el único costo que NO es por token (27-ago, B3)

`web_search` se factura **por búsqueda: $10 por 1.000, o sea $0,01 cada una** (tarifa oficial de la
Claude API verificada el 27/08/2026), *aparte* de los tokens del contenido que trae. Es la primera
línea del gasto que no se controla con caching ni con `max_tokens`: se controla con un tope.

- **Tope:** `tope_usd_mes` en `docs/WHITELIST-SATO-WEB.md`, default **10 USD/mes** = 1.000
  búsquedas. Editable en caliente, sin reload del agente.
- **Aviso al 80%**, corte al 100%: la tool devuelve `presupuesto_agotado` y Sato lo dice tal cual
  (N9). El contador se resetea solo el día 1 — el archivo guarda el mes del gasto, así que no hay
  cron que se pueda olvidar de correr.
- **El conteo no es una estimación:** sale de `usage.server_tool_use.web_search_requests`, el
  número que devuelve la propia API. Un error de búsqueda no se factura.
- **`web_fetch` no tiene costo adicional** — sólo los tokens del contenido traído. Por eso no
  consume presupuesto, y por eso `max_content_tokens` (hoy 20.000) es el control que importa ahí:
  una página de 100 kB son ~25.000 tokens de input.
- Dónde mirar el gasto: `out/web-search.jsonl` (una línea por búsqueda, con `usd` y `usd_mes`) y
  `out/web-presupuesto.json` (el acumulado del mes).

⚠ **El filo de esta palanca vive en otra parte.** El prefijo cacheable de la voz son las
definiciones de las **tools** más la identidad (~5.034 tok estimados hoy): la identidad sola son
~2.926, **por debajo** del mínimo de 4.096 que pide Haiku 4.5. O sea: son las tools las que hacen
que Haiku cachee. Recortarlas —una limpieza que parece sana— tira el prefijo del otro lado del
umbral y **Haiku deja de cachear en silencio**. El assert **R15** de `_harness.js` lo caza; el
número lo mide `voz/agent/prefijo_voz.py` importando `agent.py` de verdad.

## Palanca (e) · Anti-`Read` redundante y TTL de caché

- **En Claude Code**, el gasto no está en el modelo sino en **releer lo ya leído**. La regla de
  `CLAUDE.md` («no releas lo ya leído en esta conversación») es la palanca más grande del día a día:
  agosto movió 593M de tokens de `cache_read`, y cada re-lectura innecesaria los infla.
- **TTL de 1 hora**: cuesta 2× la escritura contra 1,25× del de 5 minutos. Sólo conviene si los
  pedidos que comparten prefijo están separados por **5-60 minutos**. Con tráfico en ráfagas
  —21 sesiones de voz en 4 días— **no conviene**: dentro de una sesión los turnos van a segundos y
  el TTL de 5 minutos se refresca solo.

---

## Cómo se verifica que esto funciona

**`cache_read_input_tokens` > 0 desde el segundo turno.** No hay otra prueba.

- Sato-VOZ → `out/voz-tokens.jsonl` (una fila por turno, desde F6).
- Sato-in-GAS → columnas `cache_write` / `cache_read` de `Costos_API`.

Si el segundo turno no trae `cache_read > 0`, **el prefijo no está cacheando**. No es que «todavía
no calentó»: es un invalidator silencioso. Los sospechosos, en orden: una fecha o un id metido en el
bloque estable, un JSON sin ordenar, o el set de herramientas cambiando entre llamadas.

⚠ **Una trampa concreta y medida:** en la voz, las 19 herramientas aportan **~4.600** de los 8.125
tokens del prefijo. Si alguna vez se recortan las tools o se mueve el breakpoint, **Haiku deja de
cachear en silencio** y el coste se multiplica. El `.jsonl` es lo único que lo cantaría.

---

## Semáforo de Claude Max

| Estado | Criterio |
|---|---|
| 🟢 | Δ semanal ≤ +5% sobre 44,08 |
| 🟡 | +5% a +15% — mirar qué proyecto lo movió |
| 🔴 | > +15% — es el tope duro: parar y revisar antes de seguir |

Proyección de Sato-VOZ migrado a Haiku 4.5 con hit 80%: **USD 0,97/semana = 2,1% del baseline.**
Con el uso duplicado, 4,1%. Entra holgado en verde.
