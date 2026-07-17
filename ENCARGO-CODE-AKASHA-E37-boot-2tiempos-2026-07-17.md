# ENCARGO CODE — AKASHA E3.7: boot en 2 tiempos visuales (fondo+preview YA, datos en paralelo) — 17/07/2026
**Origen:** pedido de Luciano 17-jul (videos Cuarta-Octava): "que cargue directamente con el fondo, muestre una vista difuminada mientras carga, y no pase de 3s para todo definitivo". Complementa E3.4 (bootUnico ya existe) y E3.6 (fix DPR, hecho por Cowork).

## Diagnóstico medido (frames con timestamp, /dev cold + incógnito)
- TTFP ~6s (GAS sirve + parsea 718KB) · velo "Cargando el CM…" 6-16s sobre cards VACÍAS · fondo (nebulosa) a los 18s · **universo + cards recién a los 18-30s**. Una vez cargado, todo anda perfecto (verificado por frames: cartera, Vehemence, Núcleo con constelación, paneles de agentes).
- **Causa raíz:** `entrar()`→`cargar()` construye el engine 3D DENTRO del callback de `bootUnico()`. Nada 3D aparece hasta que la llamada vuelve. Y `bootUnico` corre sus 6 secciones EN SERIE (incluida `estadoSalud`, la más cara: 6 chequeos).
- **CONFOUND CRÍTICO:** los videos son **/dev**, que RECOMPILA todo el proyecto en cada carga → cada llamada al server es mucho más lenta que en /exec. **Medir SIEMPRE en /exec.** El "3s" del pedido solo es juzgable en /exec.

## Objetivo (spec de Luciano)
Fondo inmediato · vista difuminada/preview del universo mientras carga · todo definitivo ≤3s (warm, en /exec). El piso duro es el TTFP de GAS (~2-3s en /exec) que NO controlamos.

## Construir

### A — Escena ESQUELETO antes de los datos (el cambio que cumple el pedido). PRIORIDAD 1.
Hoy: `entrar()` hace `mostrar('cosmos'); starsOn();` y recién en el callback de `cargar()` llama a `window.__buildAkashaEngine(THREE, DATA, ...)`. El umbral, los anillos y el universo NO existen hasta que `bootUnico` vuelve.
Cambio: que el engine se construya con un **DATA esqueleto** (agentes/clientes/aprobaciones = []) INMEDIATAMENTE tras `starsOn()` — el usuario ve el **fondo + el umbral (flythrough) + los anillos + el Núcleo vacío** desde el TTFP (esa es la "vista difuminada/preview" que pide Luciano). El engine expone `poblar(DATA)`: cuando `bootUniverso` vuelve, agrega estaciones, Espacios, Muelle y la constelación **sin rebuild** (nada de destruir y re-crear: agregar los meshes que dependen de datos sobre el esqueleto ya montado). El umbral corre DURANTE la carga (tiempo productivo), no después. Fallback Vista Plana intacto si no hay WebGL.
- `poblar(DATA)` idempotente: llamarlo 2× (p.ej. snapshot y luego fresh) no duplica meshes — reconciliar por id.

### B — bootUnico en 2 llamadas PARALELAS (cortar el wall-clock). PRIORIDAD 1.
Hoy `bootUnico` corre 6 secciones en serie en UNA ejecución. Partir en 2 `google.script.run` que corren como ejecuciones GAS CONCURRENTES:
- **`bootUniverso()`** = lo que la escena necesita para poblar: `estadoAgentes()` (ya trae agentes+feed+aprobaciones+clientes-activos). Puede ser esto solo.
- **`bootResto()`** = `datosHoy()` + `recomendacionesAbiertas()` + `agendaRango()` + `estadoSalud()` (docks + clima).
La escena puebla apenas vuelve `bootUniverso`; los docks cuando vuelve `bootResto`. **`estadoSalud` (lo más caro) queda FUERA del camino de poblar el universo** — el clima ámbar se aplica cuando salud llega (tarde está bien). Mantener el patrón shared-promise por cada una. `bootUnico` puede quedar como suma de ambas para compat/selftest, o retirarse si nadie más lo usa (avisar).

### C — Snapshot INSTANTÁNEO para cargas warm (la única vía real al "3s"). PRIORIDAD 2 (si A+B no alcanzan en /exec).
Hoy el snapshot usa `sessionStorage` (no sobrevive pestaña nueva/incógnito). Subir a `localStorage` con TTL corto (~10 min): una 2da visita en la misma máquina pinta universo+docks desde el último-bueno AL INSTANTE (marcador sutil "actualizando…"), y refresca cuando llegan bootUniverso/bootResto.
- **Bastión:** es dato REAL viejo del PROPIO usuario autenticado, marcado "actualizando", TTL corto, el fresh siempre gana — nunca maniquí, nunca de otro tenant. Misma superficie de confianza que el CM ya muestra.
- **DECISIÓN de Luciano (marcar antes de implementar C):** ¿persistir el payload COMPLETO en localStorage (instantáneo pleno) o solo el ESQUELETO — nombres de Espacios/agentes sin cifras — para dibujar la forma al instante y traer los números del fresh (más conservador en una máquina compartida)? Default sugerido: completo con TTL 10min, porque es su máquina personal.

### D — Velo/UX honesto. PRIORIDAD 1 (va con A).
Con A, el velo dark "Cargando el CM…" ya no debe tapar 15s: mostrar el fondo inmediato, el esqueleto encima, y desvanecerse apenas hay esqueleto (no esperar datos). Bajar el failsafe de 12s (index.html ~L1480) a ~4s. Mantener `ccLimpiarManiquies` (cards nacen vacías, jamás operativas-falsas).

### E — Medición honesta EN /exec.
`AK_T.tabla()` en la consola de /exec: (a) load→umbral visible, (b) load→universo poblado, (c) load→docks. Criterio: (a) <1.5s tras TTFP · (b) <3s warm (snapshot) / <6s cold · (c) idem, en /exec. Reportar el desglose real; si el piso de GAS impide el 3s cold, decirlo con el número.

## Asserts
D17i `bootUniverso`/`bootResto` devuelven sus claves con fail-closed por sección (paridad D17h) · D17j `engine.poblar(DATA)` idempotente (2× no duplica meshes).

## Gates
`node --check` por archivo · selfTestF2 verde (con D17i/j) · selfTest completo UNA vez · eyeball de Luciano en **/exec** con cronómetro · promoción SOLO Luciano · cero scopes/endpoints externos nuevos.
