# ADENDA T1 (métrica CM v3) — cierre de cabos 18-jul

> Para Code al retomar. Cierra los 2 cabos que quedaron de la sesión bloqueada por permiso macOS. Verificado por Cowork leyendo el código real vía el puente del Mac (que sigue con acceso; la revocación fue solo de la terminal de Code). **El build de T1 NO está bloqueado por nada técnico — solo por el re-grant de permiso.**

## Cabo 1 — RESUELTO: `id_objetivo` SÍ propaga a la UI (confianza 9/10)

La cadena `resolverAprobacionUI → resolverAprobacion → ejecutarAprobada → ejecutarCrearObjetivo_` propaga `id_objetivo`. Trazado en código:

- `ejecutarCrearObjetivo_` (11_aprobaciones.js:106) devuelve `{ ok:true, id_objetivo: id, detalle }`.
- `ejecutarAprobada` (11_aprobaciones.js:306→320) hace `res = ejecutarCrearObjetivo_(...)` y `return res` → propaga `{ id_objetivo }`.
- `resolverAprobacion` (11_aprobaciones.js:274-275) devuelve `{ ok, estado, ejecucion: res }` → `id_objetivo` queda **anidado en `.ejecucion`**.
- `resolverAprobacionUI` (08_webapp.js:958) hace `return res` → la respuesta al CM es `{ ok, estado, ejecucion: { ok, id_objetivo, detalle } }`.

**Para el chip (Parte C) según el camino:**
- **CM inbox (aprobar la card `crear_objetivo`)** → leer **`res.ejecucion.id_objetivo`** (anidado, NO top-level). Ese es el camino principal del chip.
- **Voz con Dirección que auto-aprueba** (`accionVoz_`, 08_webapp.js:369) → `id_objetivo` viene **top-level** en la respuesta.
- **Voz sin Dirección** → devuelve `pendiente_aprobacion` SIN `id_objetivo` (el objetivo aún no existe; se crea al aprobar por el CM → cae en el caso 1).

**Coherencia de diseño (no tocar):** `ejecutarCrearObjetivo_` escribe el objetivo con **`metrica: ''` VACÍA a propósito** (frontera de confianza, 11_aprobaciones.js:98). Por eso existe el chip/`asignarMetricaUI`: completar la métrica es el acto humano que la restaura. El flujo cierra perfecto: aprobar `crear_objetivo` → objetivo con métrica vacía + `id_objetivo` devuelto → chip → `asignarMetricaUI(id_objetivo, metrica)`.

## Cabo 2 — CONFIRMADO: renumerar los asserts (lo cazó Code)

`D17` en `_asertsF2_` **ya llega a D17h/D17i** (los metió AKASHA E3.7 — boot 2 tiempos, fail-closed de las 2 olas). El ENCARGO de métrica (17-jul, previo a E3.7) pide **D17a-g**, que **chocarían** con los de boot.

**Acción:** los asserts de métrica van como **D17j en adelante** (o bloque nuevo etiquetado `_asertsMetrica_` llamado desde `_asertsF2_`), **sin pisar** los D17a-i de boot. Mapear: A(whitelist+asignarMetricaUI+chips) · B(cifras `$130.000`) · C(tenant en encolarAgente). Confirmar el último índice usado antes de numerar.

## Bastión (Guardia D5 + Custodio) — invariante a respetar en Parte A

`asignarMetricaUI` **escribe la celda `metrica`**, y eso **activa el análisis dirigido**: `14_director.js:48` encola al Analista SOLO para objetivos CON `metrica`, pasándole `descripcion` como `pregunta` cruda al LLM. Por lo tanto:
- El enforcement es **`metricasValidas_` con match EXACTO server-side** (whitelist), NO confiar en lo que mande la UI. Una `metrica` fuera de la whitelist = rechazo (`metrica_invalida`), nunca escritura.
- `metrica` **jamás** desde texto libre de LLM/STT — solo desde el chip (acto humano dentro del OS). Esto ya está en el ENCARGO; se recalca porque es la frontera de confianza del sistema entero.

## Estado
- T1 **verificado 100% contra el repo** (Code + esta adenda). Cero cabos técnicos abiertos.
- Patrones a reusar (mapeados por Code, confirmados): roster inline `accionVoz_` (08_webapp.js:337) · match-exacto `direccionVigente_` (11_aprobaciones.js:47) · `conLock`+`_fila` para escribir celda · endpoint junto a `resolverAprobacionUI` (08_webapp.js:953) · inbox `cmInbox()` (index.html:1842) · `encolarAgente` (13_agentes.js:237).
- **Único bloqueo: el permiso macOS de la terminal de Code.** Resuelto eso, Code construye A→B→C directo, `selfTestF2` antes de declarar hecho, sin promover a `/exec` sin eyeball de Luciano.
