# Flujo: avisos (trigger diario batched)

**Qué hace.** `corridaDiaria()` (`06_avisos.js`) es la ÚNICA corrida programada. En orden:
1. `syncMaestro()` (refresca pendientes);
2. `expirarAprobaciones()` — pendientes > N días pasan a `expirada` EN el Sheet del cliente
   (append-only: edita estado/fecha/nota, no borra) + aviso. El silencio nunca aprueba (0.2);
3. `detectarVencimientos()` — tareas con fecha_límite pasada y estado no terminal;
4. `detectarTareasEstancadas()` — tareas creadas hace > N días sin cerrar;
5. `detectarProyectosSinMovimiento()` — proyectos con `fecha_ultimo_movimiento` > N días.
Cada hallazgo escribe en Avisos del MAESTRO (`AVI-000N`), con dedupe de avisos activos.
Umbrales en Config: `expiracion_aprobaciones_dias`, `dias_estancamiento_tarea/proyecto`.

**Trigger.** UN trigger time-based diario a las 07:00 Europe/Madrid, instalado por
`instalarTriggers()` (idempotente: borra el anterior antes de crear). Batched a propósito:
cuota consumer 90 min/día → no un trigger por flujo (0.4).

**Dependencias.** MAESTRO + Sheets cliente. `04_sync`, `07_util`. Permisos: Sheets + ScriptApp.

**Recuperación ante fallo.**
- Si la corrida muere a mitad, es idempotente: re-correr `corridaDiaria()` no duplica avisos
  (dedupe por tipo+cliente+mensaje sobre avisos `activo`).
- Si el trigger desaparece (p.ej. tras migración de identidad — 0.4 decisión 1): re-correr
  `instalarTriggers()`.
- Avisos atendidos: marcar estado `atendido` a mano en la pestaña Avisos (no se borran).
- Verificar salud: Config `ultima_corrida_avisos` debe ser de hoy.
