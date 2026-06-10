# Flujo: setup del MAESTRO

**Qué hace.** `setup()` (`02_setup.js`) crea el Spreadsheet MAESTRO la primera vez,
guarda su ID en Script Properties (`MAESTRO_ID`) y crea/repara las 9 pestañas de 0.3
(Clientes, Proyectos, Tareas, Avisos, Bitacora, Aprobaciones_agregadas,
Costos_API_consolidado, Gobernanza, Config). Siembra Config con defaults (TZ
Europe/Madrid, umbrales, cursores de sync). Idempotente.

**Trigger.** Manual, una vez (o vía `bootstrap()`). No tiene trigger temporal.

**Dependencias.** `07_util.js` (ensureSheet, leerTabla), `01_schema.js` (esquemas).
Permisos OAuth: Sheets + Drive (crear el archivo).

**Recuperación ante fallo.**
- Si se pierde `MAESTRO_ID` de Script Properties pero el Sheet existe: volver a setear
  la propiedad con el ID del Sheet (Project Settings → Script Properties) y re-correr `setup()`.
- Si falta una pestaña o se renombró: re-correr `setup()` la recrea sin tocar las demás
  (no pisa datos: `ensureSheet` solo escribe encabezados si la pestaña está vacía).
- `setup()` nunca borra filas de datos; solo agrega pestañas/Config faltantes.
