# Flujo: Web App (vista «Hoy» + panel por cliente)

**Qué hace.** UI interna de Satori OS (`08_webapp.js` + `index.html`). `doGet()` sirve una
shell HTML estática; toda la data entra async vía `google.script.run` (DESIGN.md §6) — no hay
templating, así que no existe `<?= ?>` ni `<?!= ?>` con datos. El front inyecta valores con
`textContent` (escapado por construcción). Estética: Registro A de `DESIGN.md` (dashboard/ERP),
usando exclusivamente los tokens del archivo; tema claro por defecto + toggle oscuro.

**Vistas.**
- **Hoy** (`datosHoy()`): KPIs, avisos activos, pendientes de aprobación agrupados por patrón
  (P1/P2/P3), próximos pasos ordenados por prioridad (A>B>C) y fecha límite, y `ultima_sync_ok`
  siempre visible en la cabecera (punto verde/ámbar/rojo según estado).
- **Panel cliente** (`datosCliente(id)`): ficha/operatividad, proyectos con % de avance (barra),
  próximos pasos, observaciones (Bitácora), widget de consumo API (stub, agrega `Costos_API` del
  Sheet cliente) y ficha de gobernanza.

**Trigger.** Ninguno: se sirve on-demand al abrir la URL `/exec` del deployment.

**Dependencias.** MAESTRO inicializado (`setup()`/`bootstrap()`); `07_util` (`leerTabla`,
`aFechaISO`, `getConfig`); para el widget de consumo abre el Sheet del cliente (`Costos_API`).
`index.html` debe estar pusheado junto al `.js`.

**Deploy (acceso «solo yo»).** `appsscript.json` fija `webapp.access: MYSELF` y
`executeAs: USER_DEPLOYING`. Crear/actualizar deployment:
- `clasp deploy --description "..."` → devuelve el deploymentId; la URL es
  `https://script.google.com/macros/s/<deploymentId>/exec`.
- La primera carga en el navegador pide consentimiento OAuth a Luciano (no se puede headless).
- Responsive: mobile-first (sidebar colapsable < 760px, scroll horizontal en tablas).

**Recuperación ante fallo.**
- Si `datosHoy/datosCliente` lanzan, el front muestra una card de error (no pantalla en blanco).
- Si falta el Sheet/pestaña `Costos_API` de un cliente, el widget muestra el error y el resto
  del panel sigue renderizando.
- Si `ultima_sync_ok` está vacío, la cabecera marca «sin sync» en ámbar.
