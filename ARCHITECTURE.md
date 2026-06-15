# ARCHITECTURE — Satori OS (índice del repo)

> Mapa para no releer todo. Abrir un archivo completo solo si esto no alcanza.

## Topología
Un proyecto GAS (el **MAESTRO**) opera sobre N Sheets cliente vía SpreadsheetApp.
El MAESTRO agrega gestión (proyectos, tareas, avisos, pendientes) y, desde Etapa 2,
hospeda la **cola de tareas** (`Cola_tareas`), el **feed de agentes** (`Actividad`) y el
**consumo de agentes** (`Consumo_agentes`). Los Sheets cliente no llevan código propio
(0.4 decisión 3). Sin IMPORTRANGE: sync por GAS.

Triggers: `corridaDiaria` (07:00) + `drenarCola` (cada 5 min). Secretos en Script
Properties: `CLAUDE_API_KEY`, `API_BUDGET_MENSUAL_USD` (opcional), `WORKER` (opcional).

- scriptId GAS: en `.clasp.json` local (gitignored — PURGA #8). No se versiona ni se publica.
- ID del Sheet MAESTRO: en Script Properties (`MAESTRO_ID`), lo crea `setup()`.

## Archivos `src/` (orden = prefijo numérico)

| Archivo | Qué define | Funciones clave |
|---|---|---|
| `00_ping.js` | verificación clasp | `ping()` |
| `01_schema.js` | **fuente de verdad del modelo** (pestañas y columnas de MAESTRO y CLIENTE, Config defaults, pestañas sensibles) | constantes `MAESTRO_SHEETS`, `CLIENTE_SHEETS`, `CONFIG_DEFAULTS`, `CLIENTE_SHEETS_SENSIBLES` |
| `02_setup.js` | crea/repara el Sheet MAESTRO | `setup()`, `urlMaestro()` |
| `03_cliente.js` | plantilla y alta de clientes | `crearCliente(datos)`, `cargaInicialClientes()` |
| `04_sync.js` | agregación MAESTRO←clientes | `syncMaestro()` |
| `05_costos.js` | **wrapper de costos + Bastión** (E2): anonimiza→fetch Claude→log siempre→error tipado; consolidación mensual | `llamadaAPI(cli, mod, opts)`, `anonimizar/desanonimizar`, `consolidarCostosMes()`, `logCostoCliente()` |
| `06_avisos.js` | trigger diario + detectores + expiración + (E2) encolar Vigía y consolidar costos; instala trigger `drenarCola` | `corridaDiaria()`, `instalarTriggers()`, `crearAviso()`, `detectar*()`, `expirarAprobaciones()`, `clienteDeProyecto/mapaProyectoCliente` |
| `07_util.js` | helpers (sin estado) | `getMaestro()`, `abrirCliente()`, `ensureSheet()`, `leerTabla()`, `appendFila()`, `getConfig/setConfig`, `nextId()`, `protegerSheet()`, `ahoraISO/hoyISO/mesISO` |
| `08_webapp.js` | Web App: shell + datos UI (vía `google.script.run`); incluye endpoints del Centro de Mando | `doGet()`, `datosHoy()`, `datosCliente(id)`, `estadoSistema()`, `estadoAgentes()`, `dispararAgenteUI()`, `resolverAprobacionUI()` |
| `index.html` | UI vanilla (DESIGN.md): vista «Hoy» + panel cliente + overlay **Centro de Mando** (orbe, feed, inbox aprobaciones con teclado, ⌘K). Sin templating: datos async, `textContent` | — |
| `09_selftest.js` | verificación end-to-end auto-limpia (E1 + casos E2). NO usa `corridaDiaria()` (tocaría producción) | `selfTest()`, `limpiarTodoTest()` |
| `10_bootstrap.js` | arranque real en una corrida | `bootstrap()` |
| `11_aprobaciones.js` | **motor de aprobaciones** (E2): único camino a la ejecución | `crearAprobacion()`, `resolverAprobacion()`, `ejecutarAprobada()`, `clasificarAccion()`, `crearReglaDesdeExcepcion()`, `expirarPendientes()` |
| `12_cola.js` | **cola durable** (E2, hoja `Cola_tareas`): claim atómico + drain | `encolar()`, `drenarCola()`, `tomar_()`, `ejecutarTarea_()` |
| `13_agentes.js` | **registry 13 agentes** (E2): runners + cupos/presupuesto + feed `Actividad` | `AGENTES`, `correrAgente_()`, `encolarAgente()`, `guardPresupuesto_()`, `RUNNERS` |

## Convenciones (de 0.2/0.3)
- IDs: `CLI-001`, `PRY-001-02`, `TAR-…`, `AVI-0001` (prefijo + correlativo, `nextId()`).
- Fechas ISO `YYYY-MM-DD`, hora `…THH:mm:ss`, TZ **Europe/Madrid** (`07_util.TZ`).
- Append-only en registros decididos/históricos. El silencio NUNCA aprueba.
- Default deny: monto sin fila en Umbrales → requiere aprobación.

## Arranque (una vez, en el editor — autoriza OAuth)
1. Abrir editor: `clasp open-script` (o la URL del scriptId).
2. Ejecutar **`bootstrap()`** → setup + clientes reales + trigger + 1ª sync. Autorizar permisos.
3. Ejecutar **`selfTest()`** → verificación end-to-end (se autolimpia). Debe terminar en «— TODO OK —».
Detalle por flujo: `docs/`.

## Web App
- UI = Registro A de `DESIGN.md` (dashboard/ERP) + overlay **Centro de Mando** (B-orbe, §8bis): orbe canvas,
  órbitas activos/laboratorio, feed `Actividad`, inbox de aprobaciones E2 con teclado (j/k/a/e/r), barra de
  presupuesto, modo calma, ⌘K command palette, saludo contextual. Vanilla GAS, `textContent` (XSS-safe).
- Datos vía `google.script.run`; HTML estático → sin `<?= ?>`/`<?!= ?>` con datos.
- Deploy «solo yo» (`access: MYSELF`, `executeAs: USER_DEPLOYING`). Probar live requiere OAuth de Luciano en el navegador.

## Estado (15-jun — migrado a Workspace · E2-1 resuelto · selfTest verde)
- En **`luciano@satoriconsultoria.com`** (Workspace, C1). scriptId nuevo en `.clasp.json`; MAESTRO `1DMOR…`.
- E1 en uso real. E2+ (Trillion) construida: motor de aprobaciones, wrapper de costos + Bastión, cola durable,
  registry de 13 agentes (5 activos / 8 laboratorio), Centro de Mando. Lote B de la PURGA E1 aplicado.
- **`selfTest()` verde completo.** Gate E2+ pendiente solo de: neutralizar el proyecto viejo (Purga M2) + casos manuales (abajo).
- **E2-1 (coerción de Sheets):** `appendRow` ignora el formato `'@'` de columna → coacciona ids tipo-fecha (`APR-0001`→Date abril-2001), el id releído no matchea. Fix en `appendFila` (07_util.js): re-escribe las celdas `COLUMNAS_TEXTO` como texto explícito (`setValue` sobre `'@'`). `aplicarFormatoTexto` (nivel columna) NO alcanza para `appendRow` → **no remover el fix per-celda**.
- Manifest scopes: spreadsheets, drive, scriptapp, external_request, send_mail, userinfo.email (deploy MYSELF).
- Proyectos/Tareas/Bitácora/Gobernanza/Umbrales se llenan a mano (la UI los muestra; no hay alta aún).

### Casos de aceptación a correr en el editor (no headless)
- `selfTest()` cubre auto: E2-1 default-deny, E2-2 expiración, E2-4 regla-desde-excepción, E2-6 anonimización,
  caso 7 cola (claim+drain), caso 10 laboratorio, caso 12 sin-datos.
- **Manuales** (requieren `CLAUDE_API_KEY` / envío real / UI / concurrencia, fuera de selfTest):
  E2-3 email draft→editar→aprobar→envío (usar el PROPIO email como destinatario — AREL),
  E2-5 llamada API fallida igual logueada, caso 8 dos `drenarCola()` concurrentes (sin doble toma),
  caso 9 Cobrador → PENDIENTE + tarea `completada/esperando_aprobacion`, caso 11 cupo agotado → pausa visible + fallida,
  caso 13 UI Centro de Mando (13 agentes con estado real; aprobar desde el inbox).
- Atención manual: cargar fechas SIEMPRE como `yyyy-MM-dd` en Tareas/Proyectos (hipótesis 5).

## Pendiente / deuda
- **DESIGN.md** (#17): documentar los tokens de sombra dark (ya existen en `index.html`, faltan en la spec).
- Doble escritura de costos: el wrapper loguea en `Costos_API` del cliente (USD reales) y, en paralelo,
  `Consumo_agentes` lleva el gasto mensual para cupos. Unificar si conviene en E3.
- Activar agentes del laboratorio = flag `activo:true` en `13_agentes.js` + decisión humana.
