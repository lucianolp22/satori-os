# ENCARGO CODE — North Star enriquecido + Reset desde cero + limpiar error fantasma

**Fecha:** 20-jul-2026 · **Owner:** Code · **Planifica/verifica:** Cowork · **Aprueba/corre gates:** Luciano.
**Decisiones de Luciano (20-jul):** (a) North Star enriquecido **extendiendo Config/objetivo, NO migrar a .md**; (b) **resetear Objetivos y North Stars desde cero — TODO SALVO Vehemence (CLI-002), que conserva sus dos objetivos actuales** (alcance corregido por Luciano el 20-jul); (c) limpiar el error fantasma "Errores: 1"; (d) `OFICINA_SYNC_SECRET` ya estaba configurado — ítem cerrado, no tocar.

> **Gobierno:** Bastión de fondo (Parte C es DESTRUCTIVA → respaldo obligatorio). Arquitecto + Senior mapean consumidores del lector North Star antes de tocar. AREL: Parte C **falla "Reversible"** (borra datos reales) → **alto impacto → respaldo antes + Luciano confirma y corre**. Purga al cierre.

## Contexto verificado (18-jul, leído en fuente)
- North Star de SISTEMA (Satori): claves Config `ns_satori_desc/metrica/valor/horizonte`; lector `northStarSatori_` (18_direccion.js:586).
- North Star de TENANT: una fila de objetivo (Vehemence: `cargarNorthStarVehemence` L649 → OBJ-0001).
- Objetivos: hoja `objetivos` por tenant (cols id_objetivo/horizonte/descripcion/metrica/valor_objetivo/estado/prioridad/fecha_objetivo).
- Vehemence (CLI-002) hoy tiene OBJ-0001/0002/0003 activos (ticket, órdenes) que alimentan al Analista (14_director.js:48) → **el reset los borra**.
- Error "Errores: N" = filas de `Cola_tareas` con `estado='fallida'` del mes en curso (`telemetriaMaestro_` 08_webapp.js:757).

---

## Parte A — Enriquecer el North Star (extender, no migrar)
Según `docs/north-star-TEMPLATE.md` v2. **Sistema:** agregar claves Config `ns_satori_metricas` (hasta 2 más, sep. `·`), `ns_satori_valores` (guardrails, sep. `·`), `ns_satori_pivots` (`fecha·qué·porqué`, una por línea). Extender `northStarSatori_` para devolver estos campos (backward-compat: ausentes → vacío). **Tenant:** agregar columnas `metricas_extra`, `valores`, `pivots_descartados` a la hoja `objetivos` y que el lector del North Star de tenant las lea. Actualizar los seeders (`cargarNorthStarSatori`, `cargarNorthStarVehemence`) para aceptar los campos nuevos.
**Assert:** North Star con 3 métricas + pivots se lee completo; sin los campos nuevos, el lector viejo no rompe.

## Parte B — Consumir `pivots_descartados`
`recomendacionDelDia_` (18_direccion.js:692) consulta la lista de pivots descartados (sistema y del cliente anclado) y **NO propone** una recomendación que caiga en un pivot descartado.
**Assert:** con un pivot descartado sembrado, la recomendación del día no lo sugiere.

## Parte C — Reset desde cero (DESTRUCTIVO — respaldo obligatorio)
Función wrapper **visible en el dropdown** (sin guión bajo, para que Luciano la vea): `resetObjetivosYNorthStar()`. Hace, en orden:
1. **RESPALDO PRIMERO (innegociable):** volcar TODAS las hojas `objetivos` de todos los tenants + las claves Config `ns_*` a un backup fechado (reusar el patrón de `21_backup.js`; dejar el `id`/ruta del backup en el log). Si el respaldo falla → ABORTAR sin borrar nada.
2. **Limpiar (alcance CONFIRMADO por Luciano 20-jul):** borrar las filas de datos de cada hoja `objetivos` (conservar encabezados) en todos los tenants **EXCEPTO CLI-002 (Vehemence), cuya hoja `objetivos` NO SE TOCA** — conserva sus dos objetivos actuales (OBJ-0002 `ordenes_mes` y OBJ-0003 `ticket_promedio_ars` $130.000) y su historial (OBJ-0001 `reemplazado`). Además, limpiar las claves Config `ns_satori_*` (el North Star de Satori se redefine desde cero). Exclusión **hard-coded** en el código: `var RESET_EXCLUIR = ['CLI-002'];` + log explícito "CLI-002 excluido por decisión de Luciano 20-jul".
3. **Log auditable:** cuántas filas borró por tenant + "CLI-002: excluido, 0 filas tocadas" + cómo restaurar desde el backup.
**Bastión duro:** no auto-corre (Luciano la dispara del editor); idempotente; los North Stars se re-siembran DESPUÉS a mano con el formato enriquecido (Parte A). **El respaldo del paso 1 igual INCLUYE a CLI-002** (respaldar de más es gratis; borrar de más no). Nota para Parte A: AGREGAR columnas nuevas a la hoja `objetivos` de CLI-002 SÍ está permitido (no destructivo); lo excluido es el borrado de filas.
**Assert:** en un tenant de prueba, resetObjetivos deja la hoja con solo encabezados y el backup restaura las filas idénticas (drill de restore) + **la hoja `objetivos` de CLI-002 queda IDÉNTICA (mismo conteo de filas y contenido antes/después)**.

## Parte D — Limpiar el error fantasma (NO destructivo)
Función `limpiarErroresFantasma_()`: buscar en `Cola_tareas` las filas `estado='fallida'` del mes en curso que sean la corrida fantasma (tenant/cliente "Todos los Espacios" o sin tenant real) y **recategorizarlas** `estado='archivada'` (NO borrar: conserva historia; solo salen del conteo de `telemetriaMaestro_`). Resultado: "Errores" vuelve a 0.
**Nota:** la métrica v3 Parte C (T1, defensa de tenant en `encolarAgente`, D17g) **previene que reaparezca**. Esto limpia el que ya está; Parte C evita el próximo. (Alternativa sin código: el contador es del mes → se auto-limpia el 1/8; esto lo adelanta.)
**Assert:** tras correr, `telemetriaMaestro_().errores` = 0 y la fila sigue en la hoja como 'archivada'.

## Reglas duras
Edit no Write · solo `18_direccion.js` (+ `01_schema.js` si hay que declarar columnas nuevas de `objetivos`) para A/B/C, y donde viva `Cola_tareas` para D · no pisar lo que Code edita en T1 · `selfTestF2` antes de hecho · **Parte C: respaldo verificado restaurable ANTES de habilitar el borrado** · promover a `/exec` solo con eyeball de Luciano · el North Star se siembra por acto humano.

## Orden de ejecución (para Luciano, después de que Code construya)
1. Code construye A+B+C+D y corre `selfTestF2`.
2. Luciano corre `limpiarErroresFantasma_` (D) → Errores a 0. (Bajo impacto.)
3. Luciano corre `resetObjetivosYNorthStar` (C) — alcance ya definido: todo salvo Vehemence. (Alto impacto: respaldo hecho y verificado antes.)
4. Luciano re-siembra el North Star de Satori + los objetivos nuevos de los demás tenants con el formato enriquecido (Parte A) desde el editor. **Vehemence queda como está** (enriquecerlo con las columnas nuevas queda opcional para después).

## Gate de salida + Purga
`selfTestF2` verde con los asserts nuevos + drill de restore del backup OK + eyeball de Luciano (Errores=0, objetivos vacíos, re-siembra andando). Purga-de-errores al cierre.
