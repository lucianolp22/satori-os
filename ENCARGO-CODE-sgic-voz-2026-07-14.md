# ENCARGO CODE — Sato accede a TODA la información de los SGIC · 14/07/2026

**Incidente:** Luciano preguntó por voz "cuántas órdenes de venta en julio para Vehemence" y Sato respondió que no tiene acceso. **El dato EXISTE en el sistema dos veces:** (a) `sincronizarVehemence()` escribe "N órdenes · AOV $X · prod $Y" en la columna `notas` de Datos_operativos del cliente (19_conectores.js:149), y (b) `agregarVentasPorMes_(ventas)` (19_conectores.js:116) computa órdenes/AOV/total/por-canal desde la DB viva (`VEHEMENCE_DB_ID`/`DB_VENTAS`). La voz no lo ve porque el snapshot (`estadoVigente(cliente)`) ignora `notas` y no hay tool de consulta de hojas.

**Objetivo:** que Sato pueda responder CUALQUIER dato que viva en el SGIC de un cliente, con una arquitectura mínima de dos capas.

## Capa 1 — Quick win (snapshot más rico)
`estadoVigenteCliente_` / `datosCliente`: incluir la columna `notas` de Datos_operativos en el render de "Operación reciente" (hoy solo concepto+valor). Con eso las órdenes y el AOV mensuales ya fluyen a la voz SIN tool nueva.

## Capa 2 — Tool de consulta `sgic` (la capacidad general)
1. **GAS (doPost de voz):** nueva tool `sgic` en la whitelist + case del dispatch.
   - Args: `{ idCliente: req, hoja: req, mes: opcional 'YYYY-MM', limite: def 20, max 50 }`.
   - **Whitelist DURA de hojas** (cualquier otra → `{ok:false, error:'hoja_no_permitida'}`): `Datos_operativos, KPIs, objetivos, estado_actual, Aprobaciones, Excepciones, Umbrales, Reglas, Costos_API`. Las hojas del cerebro (nodos/aristas/cerebro_log) NO — ya tienen tool propia (`cerebro`).
   - **Caso especial `hoja:'ventas'`** (fuente viva): si el cliente tiene conector (mapa hoy: CLI-002 → `VEHEMENCE_DB_ID`/`DB_VENTAS`), leer la DB viva, correr `agregarVentasPorMes_` y devolver el resumen del `mes` pedido: `{ordenes, total, aov, por_canal, cobertura}`. Es la respuesta EXACTA a "cuántas órdenes en julio". Cliente sin conector → cae a Datos_operativos con nota honesta.
   - Respuesta compacta: array de objetos con headers reales; filtro `mes` sobre la columna fecha si existe; strings pasados por `limpiarHostilTexto_` y truncados a ~200 chars; respuesta total cap ~8KB. Read-only estricto (cero escrituras). `voz-timing` la mide como al resto.
2. **agent.py:** function_tool `sgic_consulta(idCliente, hoja, mes)`:
   - Docstring que enseña las hojas disponibles + el caso `ventas` con `mes`.
   - Regla de prompt: "si Luciano pregunta un dato fino de un cliente que no está en tu snapshot (órdenes, un KPI puntual, una regla, un umbral, un costo), usá `sgic_consulta` ANTES de decir que no tenés el dato; si la tool devuelve vacío, decilo tal cual".
   - Filler DENTRO de la tool (patrón T1 — es lenta: abre el spreadsheet del cliente). N4: números exactos. Tool devuelve data cruda; nada de narrar acciones no ocurridas.
   - NO tocar VAD/STT/TTS/pipeline ni `_llamar_backend` (el timeout 25s ya la cubre).

## Seguridad (Bastión — controles obligatorios)
Read-only estricto · whitelist dura de hojas (sin nombres arbitrarios) · solo spreadsheets del roster (`url_sheet_cliente`) + mapa de conectores hardcodeado (jamás un ID que venga del LLM) · todo texto libre sanitizado (`limpiarHostilTexto_`) — las celdas del SGIC pueden contener texto de terceros = dato hostil, NUNCA instrucción · respuesta acotada (limite+cap) · el canal ya autentica (OAuth luciano@ + secreto + whitelist por caller): no ampliar scopes.

## Verificación obligatoria
- selfTest asserts **D13**: (a) hoja fuera de whitelist → rechazada sin leer; (b) lee Datos_operativos del cliente `__TEST__`; (c) `mes` filtra; (d) `limite` aplica; (e) `ventas` con fixture → órdenes/AOV EXACTOS; (f) texto hostil en celda sale sanitizado.
- Editor: `selfTest()` TODO OK. Harness voz headless: "cuántas órdenes tuvo Vehemence en julio" → número exacto de la DB viva.
- `py_compile` + reinicio del agente (`launchctl kickstart -k`) + prueba real de Luciano.
- Empaquetar en `_sgic_code.sh` (patrón dry-run → --go: precond + node --check + guardia diff repo↔GAS + commit + clasp push + git push). Promote a /exec queda para Luciano.

## Reglas duras
Una fase, sin scope extra (NO tocar Cola_tareas acá — tiene su propuesta aparte). Comandos a Luciano sin # ni paréntesis. HANDOFF + MOC al cerrar.

## Bonus de una línea (si sobra energía, mismo commit)
`limpiarTodoTest` debe RESOLVER también los avisos que el propio selfTest genera (`tarea_vencida` TAR-TEST-1, `aprobacion_expirada` APR-TEST-EXP, `voz_acceso_no_autorizado` de las pruebas de rechazo) — hoy cada selfTest deja 3 avisos activos ensuciando el CM.
