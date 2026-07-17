# ENCARGO CODE — Métrica desde el CM + números SIEMPRE en cifras + tenant en encolarAgente — 17/07/2026 (v3, EN COLA)
**Origen:** decisiones de Luciano 17-jul: (1) "nada manual en un Sheet fuera del Satori OS — que se haga al ejecutar comandos desde el Sistema"; (2) "las cifras siempre escritas en números: $130.000, no 'ciento treinta mil pesos' — aplicar para todo el sistema". **Cuándo correrlo: DESPUÉS del cierre de E3.4** (tocan los mismos archivos; en serie, sin rebase). v2 reemplaza a la v1: se retiró el ítem heredado del flag `{completo:true}` (ya estaba en `b74d665` — verificado por `git log -S` 17-jul; el "omitido" observado fue el log de selfTestF2 en el panel, no un gap).

## PARTE A — Métrica de objetivos desde el CM (fin de la celda manual)

### El invariante que NO se negocia (Bastión)
`objetivos.metrica` llena ⇒ `correrDirector` (14_director.js:49) encola al Analista con `pregunta = o.descripcion` **cruda al prompt del LLM** (13_agentes.js:173-177). Por eso la metrica nace VACÍA en 2 capas (chequeo cruzado 16-jul). **Invariante: activar el análisis dirigido requiere acto humano explícito DENTRO del OS, y el valor de metrica JAMÁS viene de texto libre de LLM/STT.** Este encargo lo muda de "celda en Sheets" a "click en el CM" — no lo debilita.

### Construir
1. **Whitelist server-side** `metricasValidas_(idCliente)` (07_util.js o 18_direccion.js): unión de (a) set curado global `['ordenes_mes','ticket_promedio_ars','ventas_ars','margen_pct','recompra_pct']`, (b) valores ya usados en `objetivos.metrica` del cliente, (c) columna `kpi` de su hoja KPIs si tiene filas. **Match EXACTO** (patrón Direcciones: sin wildcard, trim + case-sensitive).
2. **Endpoint `asignarMetricaUI(idCliente, id_objetivo, metrica)`** (08_webapp.js, junto a resolverAprobacionUI): tenant en roster → objetivo existe → `metrica ∈ metricasValidas_` (rechazo `metrica_invalida`) → escribe la celda bajo `conLock` → `feed_('Director','metrica_asignada',...)`. Wrapper público si hace falta de editor (regla guion bajo).
3. **UI del CM (index.html):** al APROBAR una card `crear_objetivo` (y en el detalle de objetivos sin métrica), selector de chips con `metricasValidas_` + "sin métrica por ahora". El click del chip = el acto humano. Sin modal extra.
4. **Voz (fase 2, opcional si el tiempo da):** tool `accion` tipo `asignar_metrica` → SIEMPRE aprobación P1 default-deny (activar al Analista jamás es directo, NI con Dirección — no crear tipo de Dirección para esto). El payload pasa solo si `metrica` matchea whitelist EXACTA server-side.

### Asserts nuevos (D17, en `_asertsF2_`)
D17a metrica fuera de whitelist → `metrica_invalida` · D17b asignación válida escribe la celda + feed · D17c REGRESIÓN DE LA FRONTERA: `accionVoz_('crear_objetivo', {metrica:...})` sigue descartándola server-side (D16j sigue verde) · D17d objetivo inexistente → rechazo · D17e whitelist incluye lo ya usado por el cliente (`ticket_promedio_ars` en CLI-002).

## PARTE B — Números SIEMPRE en cifras (regla de sistema, decisión Luciano 17-jul)
El STT transcribe dictados en palabras ("ciento treinta mil pesos") y eso terminó ayer en una descripcion de objetivo. Regla nueva de TODO el sistema: **al escribir datos (payloads de `accion`, títulos, descripciones, notas de Bandeja) y al mostrar en cards/brief, las cifras van en números con formato es-AR/es-ES: `$130.000`, `200 órdenes`, `35%`** — nunca en palabras.
1. **agent.py (prompt de Sato):** instrucción explícita de normalizar toda cifra dictada a dígitos ANTES de armar payloads de `accion` y `capturar` (ej.: "ciento treinta mil pesos" → `$130.000`). Complementa (no reemplaza) la regla A1 de números HABLADOS agrupados — hablar natural, escribir en cifras.
2. **Server-side best-effort (07_util.js):** en `accionVoz_`, normalizador acotado para montos en palabras frecuentes es-AR (mil/millones) sobre `titulo`/`descripcion` — determinista, sin LLM; si no matchea patrón conocido, deja el texto tal cual (jamás inventa). Assert D17f: "ciento treinta mil pesos" en título → la fila queda con "$130.000".
3. NO tocar los formatters de LECTURA de la voz (A1/A3 ya resuelven el habla).

## PARTE C — Defensa de tenant en encolarAgente (hallazgo TERCERA PRUEBA AKASHA, 17-jul)
En la prueba real, "Despertar a Analista" con el selector de Akasha en "Todos los Espacios" viajó con `idCliente = "Todos los Espacios"` (el option nacía sin value; ya fixeado en UI por Cowork, E3.2) y `encolarAgente` (13_agentes.js:238) lo aceptó: valida agente y no-vacío, pero NO que el tenant EXISTA. El Analista corrió contra un tenant fantasma → Errores: 1 en telemetría. La UI ya corta el vector conocido; falta la capa server (defensa en profundidad, patrón de la casa).
1. **`encolarAgente`**: validar `idCliente` contra el roster ANTES de encolar (mismo criterio fail-closed que `aprobacionDesdeRecomendacion`: tenant real o rechazo claro). Usar el helper de roster EXISTENTE (no inventar uno); mensaje: `tenant desconocido: <id>`.
2. **Assert D17g** en `_asertsF2_`: `encolarAgente('CLI-NOEXISTE', 'analista', {})` → throw con mensaje claro · el caso feliz (CLI-000) sigue encolando.

## Gates
`node --check` por archivo tocado · selfTestF2 verde (con D17) · selfTest completo UNA vez · eyeball de Luciano en /dev · promoción SOLO Luciano · cero scopes/endpoints externos nuevos.

## Estado de datos al encolar (17-jul)
CLI-002/objetivos: OBJ-0001 `reemplazado` (era ticket 120000; lo reemplaza el nuevo) · OBJ-0002 "doscientas órdenes" → metrica `ordenes_mes` (completada por Cowork, autorización Luciano) · OBJ-0003 "Alcanzar un ticket promedio de $130.000" → metrica `ticket_promedio_ars`, valor 130000, activo (aprobado por Luciano desde el CM 17-jul; descripcion normalizada a cifras por Cowork). El espejo del MAESTRO reflejó alta y aprobación AL INSTANTE (fix D16y verificado en prod). Ambos objetivos medibles → el Director los pasa al Analista en la próxima corrida.
