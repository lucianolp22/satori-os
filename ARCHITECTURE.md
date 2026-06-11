# ARCHITECTURE — Satori OS (índice del repo)

> Mapa para no releer todo. Abrir un archivo completo solo si esto no alcanza.

## Topología
Un proyecto GAS (el **MAESTRO**) opera sobre N Sheets cliente vía SpreadsheetApp.
El MAESTRO agrega gestión (proyectos, tareas, avisos, pendientes). Los Sheets
cliente no llevan código propio (0.4 decisión 3). Sin IMPORTRANGE: sync por GAS.

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

## PURGA Etapa 1 — Lote B (pendiente, se hace con Etapa 2)
Lote A aplicado (#1,#4,#8,#15,#14,#16,#13,#9,#10,#2). Fuente: `../Videos analizados/PURGA ETAPA 1 - Hallazgos y remediación.md`.
- **#3** sync wipe-then-rebuild no atómico → acumular en memoria + un `setValues` final.
- **#5** `corridaDiaria` abre cada Sheet cliente 2× + writes celda-a-celda (N+1): a ~20 clientes choca 6 min/ejecución → una pasada por cliente, batch.
- **#6** `clienteDeProyecto` relee Proyectos por cada tarea → mapa proyecto→cliente una vez por corrida.
- **#7** protección de pestañas sensibles no excluye editores futuros → `removeEditors` + hidden no es control de acceso (clave al compartir en Etapa 3).
- **#11/#12** `cursor_sync` decorativo y Config no leída (timezone/tipo_cambio).
- **#23** prioridades D/E sin soporte · **#24** logs con nombres de clientes · **#25** código muerto.
- **UI (#17-22)** vs DESIGN.md: proponer tokens de sombra dark en DESIGN.md, monto en `font-mono`, ≤2 pesos tipográficos, targets táctiles ≥40px, `th scope`, contraste AA de warning/subtle.
- **Eliminar** `src/11_repro.js` (repro temporal de #1) tras validar.
- Atención manual en validación: cargar fechas SIEMPRE como `yyyy-MM-dd` en Tareas/Proyectos (hipótesis 5).
