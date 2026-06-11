# ARCHITECTURE — Satori OS (índice del repo)

> Mapa para no releer todo. Abrir un archivo completo solo si esto no alcanza.

## Topología
Un proyecto GAS (el **MAESTRO**) opera sobre N Sheets cliente vía SpreadsheetApp.
El MAESTRO agrega gestión (proyectos, tareas, avisos, pendientes). Los Sheets
cliente no llevan código propio (0.4 decisión 3). Sin IMPORTRANGE: sync por GAS.

- scriptId GAS: `1MagyKYQDOhvu7Vkd__OqYGodI8e6tet3Rw1zzjAkIhPRtVL_X7bKxFhe`
- ID del Sheet MAESTRO: en Script Properties (`MAESTRO_ID`), lo crea `setup()`.

## Archivos `src/` (orden = prefijo numérico)

| Archivo | Qué define | Funciones clave |
|---|---|---|
| `00_ping.js` | verificación clasp | `ping()` |
| `01_schema.js` | **fuente de verdad del modelo** (pestañas y columnas de MAESTRO y CLIENTE, Config defaults, pestañas sensibles) | constantes `MAESTRO_SHEETS`, `CLIENTE_SHEETS`, `CONFIG_DEFAULTS`, `CLIENTE_SHEETS_SENSIBLES` |
| `02_setup.js` | crea/repara el Sheet MAESTRO | `setup()`, `urlMaestro()` |
| `03_cliente.js` | plantilla y alta de clientes | `crearCliente(datos)`, `cargaInicialClientes()` |
| `04_sync.js` | agregación MAESTRO←clientes | `syncMaestro()` |
| `05_costos.js` | wrapper de costos (stub Etapa 2) | `llamadaAPI(cli, mod, opts)`, `logCostoCliente()` |
| `06_avisos.js` | trigger diario + detectores + expiración | `corridaDiaria()`, `instalarTriggers()`, `crearAviso()`, `detectar*()`, `expirarAprobaciones()` |
| `07_util.js` | helpers (sin estado) | `getMaestro()`, `ensureSheet()`, `leerTabla()`, `appendFila()`, `getConfig/setConfig`, `nextId()`, `protegerSheet()`, `ahoraISO/hoyISO/mesISO` |
| `08_webapp.js` | Web App: sirve la shell + datos para la UI (vía `google.script.run`) | `doGet()`, `datosHoy()`, `listaClientes()`, `datosCliente(id)`, `estadoSistema()`, `consumoApiCliente()` |
| `index.html` | UI vanilla (Registro A de DESIGN.md): vista «Hoy» + panel por cliente. Sin templating: datos async, escapado por `textContent` | — |
| `09_selftest.js` | verificación end-to-end auto-limpia (pre-clean + post-clean) | `selfTest()`, `limpiarTodoTest()` |
| `10_bootstrap.js` | arranque real en una corrida | `bootstrap()` |

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

## Web App (paso 8 — hecho)
- UI = Registro A de `DESIGN.md` (dashboard/ERP operativo), tokens exclusivos del archivo, vanilla GAS.
- Datos vía `google.script.run` (DESIGN.md §6); el HTML es estático → sin `<?= ?>`/`<?!= ?>` con datos.
- Deploy «solo yo» (`access: MYSELF`, `executeAs: USER_DEPLOYING`). URL `/exec` del deployment activo.
- Probar live (cargar `/exec` en desktop y móvil) requiere la autorización OAuth de Luciano en el navegador.

## Pendiente (no construido)
- Etapa 2: activar Aprobaciones/Umbrales/Reglas y completar wrapper de costos (tokens/USD reales).
- Proyectos/Tareas/Bitácora/Gobernanza se llenan a mano por ahora (la UI los muestra; no hay alta aún).
