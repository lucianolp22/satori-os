# Flujo: sync MAESTRO←clientes

**Qué hace.** `syncMaestro()` (`04_sync.js`) recorre Clientes, abre cada Sheet cliente
por URL (GAS, NO IMPORTRANGE), lee su pestaña Aprobaciones y refleja las filas en estado
`pendiente` en Aprobaciones_agregadas del MAESTRO (vista de solo lectura — la decisión se
escribe siempre en el Sheet del cliente). Reescribe el espejo completo en cada corrida.
Actualiza en Config: `ultima_sync_intento`, `ultima_sync_ok`, `ultima_sync_estado`,
`cursor_sync`.

**Trigger.** Se invoca dentro de `corridaDiaria()` (trigger diario 07:00). También manual.

**Dependencias.** MAESTRO + Sheets cliente con pestaña Aprobaciones. `06_avisos.crearAviso`
(para reportar errores). Permisos: Sheets.

**Recuperación ante fallo (Auditor 0.3 #2 / 0.4).**
- **Nunca falla en silencio.** Si un cliente falla (Sheet borrado, pestaña renombrada,
  permiso revocado) se captura el error, se sigue con los demás, `ultima_sync_estado`
  queda `parcial` y se crea un Aviso `sync_error` con el detalle.
- `ultima_sync_ok` solo se actualiza si TODOS los clientes ok → si en la vista «Hoy» se ve
  una fecha vieja, hubo problema aunque no haya excepción.
- El espejo agregado se puede regenerar siempre: re-correr `syncMaestro()`. No hay dato
  único que se pierda (el append-only vive en el Sheet del cliente).
- Protección de pestañas cliente reduce el renombrado accidental que rompería la sync.
