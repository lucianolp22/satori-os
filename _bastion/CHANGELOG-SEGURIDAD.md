# CHANGELOG DE SEGURIDAD — Satori OS

> Registro de cambios de seguridad del proyecto GAS MAESTRO y componentes asociados.
> Lo mantienen Bastión (diseño/registro) + Code (ejecución técnica). Formato: más nuevo arriba.

## 2026-07-03 — Scope OAuth `drive` → `drive.file` (menor privilegio)

- **Qué:** `src/appsscript.json` — scope `https://www.googleapis.com/auth/drive` reemplazado por `https://www.googleapis.com/auth/drive.file`. ENCARGO del 29-jun (`ENCARGO-Code-scope-drive-2026-06-29.md`).
- **Por qué:** menor privilegio. Los únicos usos de `DriveApp` (`09_selftest.js:329,353`) operan sobre sheets creados por `SpreadsheetApp.create` → `drive.file` (solo archivos creados por la app) cubre el 100% del uso real. Pre-validado por Cowork 03-jul.
- **Ejecución:** Code, commit `2e014f0` + `clasp push` (03-jul). Backup rollback: `src/appsscript.json.bak-2026-07-03`.
- **Validación:** selfTest completo **TODO OK** bajo `drive.file` (03-jul 14:33), incluida la limpieza «cliente __TEST__ a papelera» (`setTrashed` funciona con el scope menor). Google no re-pidió consent: el grant viejo `drive` cubre el subconjunto; en runtime manda el manifest → downgrade efectivo.
- **Promoción a deployments prod:** PENDIENTE → se hace **al cierre de B4** (03-jul: el HEAD de GAS ya incluye el CM v2 parcial — Commit A `9ceffbd` — así que promover antes serviría un cockpit a medio cablear en `/exec`; el scope menor YA rige en runtime vía manifest, la promoción es alineación de código servido). Al promover: marcar acá con fecha + borrar `src/appsscript.json.bak-2026-07-03`.
- **Recomendación Bastión (opcional, la hace Luciano):** revocar el grant viejo en https://myaccount.google.com/permissions → el próximo consent pedirá solo «archivos creados por esta app». Severidad: baja (defensa en profundidad; el runtime ya opera con el scope menor).

## 2026-07-03 — Rotación `VOZ_TOOL_SECRET`

- **Qué:** secreto del tool-backend de voz rotado (Script Properties). Motivo: exposición en chat durante el debugging de la Opción B (22-jun).
- **Estado:** HECHO, confirmado por Luciano 03-jul. Los curls 403 del 23-jun (AVI-0002) quedaron confirmados como falsos positivos del propio debugging.

## Historial previo relevante (referencia)

- **2026-06-30:** `appsscript.json` `webapp.access` preservado en `DOMAIN` (regla: no volver a `MYSELF`; rompe el acceso del CM). Guardia anti-pisado diff repo↔GAS establecida como obligatoria antes de todo `clasp push`.
- **2026-06-26:** Blindaje prompt-injection (Vigía + Cobrador) testeado VERDE + 8 parches Purga voz. Kill switch = pausa operativa. Alertas email opt-in default OFF.
- **2026-06-22/23:** Acceso al web app: `ANYONE_ANONYMOUS` bloqueado por política del Workspace; identidades externas rechazadas (SA descartada). Deployment con gate `OWNER_EMAIL` fail-closed en `doGet` + token Bearer en `doPost` (voz).
