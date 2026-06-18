# ARCHITECTURE — Satori OS (índice del repo)

> Mapa para no releer todo. Abrir un archivo completo solo si esto no alcanza.

## Topología
Un proyecto GAS (el **MAESTRO**) opera sobre N Sheets cliente vía SpreadsheetApp.
El MAESTRO agrega gestión (proyectos, tareas, avisos, pendientes) y, desde Etapa 2,
hospeda la **cola de tareas** (`Cola_tareas`), el **feed de agentes** (`Actividad`) y el
**consumo de agentes** (`Consumo_agentes`). Los Sheets cliente no llevan código propio
(0.4 decisión 3). Sin IMPORTRANGE: sync por GAS.
Desde **Etapa 8a**, cada Sheet cliente hospeda su **cerebro** (`nodos`/`aristas`/`cerebro_log`/`estado_actual`/`objetivos`) y el MAESTRO agrega `Cerebro_index` (conteos + resumen, **sin PII**, caso 20).

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
| `06_avisos.js` | trigger diario + detectores + expiración + (E2) encolar Vigía, (E8a) correr Director + Salud, y consolidar costos; instala trigger `drenarCola` | `corridaDiaria()`, `instalarTriggers()`, `crearAviso()`, `detectar*()`, `expirarAprobaciones()`, `clienteDeProyecto/mapaProyectoCliente` |
| `07_util.js` | helpers (sin estado) | `getMaestro()`, `abrirCliente()`, `ensureSheet()`, `leerTabla()`, `appendFila()`, `getConfig/setConfig`, `nextId()`, `protegerSheet()`, `ahoraISO/hoyISO/mesISO` |
| `08_webapp.js` | Web App: shell + datos UI (vía `google.script.run`); endpoints del Centro de Mando (estado, **telemetría, salud**) | `doGet()`, `datosHoy()`, `datosCliente(id)`, `estadoSistema()`, `estadoAgentes()` (+`telemetria`), `estadoSalud()`, `telemetriaMaestro_()`, `dispararAgenteUI()`, `resolverAprobacionUI()` |
| `index.html` | UI vanilla (**skill `satori-design`**, reemplaza DESIGN.md): vista «Hoy» + panel cliente + overlay **Centro de Mando** (orbe-vivo a4.2, tira de telemetría, tabs Actividad/Aprobaciones/Salud, directiva del Director, inbox con teclado, ⌘K; **mobile-first**: agentes como chips ≤880). Sin templating: datos async, `textContent` | — |
| `09_selftest.js` | verificación end-to-end auto-limpia (E1 + casos E2). NO usa `corridaDiaria()` (tocaría producción) | `selfTest()`, `limpiarTodoTest()` |
| `10_bootstrap.js` | arranque real en una corrida | `bootstrap()` |
| `11_aprobaciones.js` | **motor de aprobaciones** (E2): único camino a la ejecución | `crearAprobacion()`, `resolverAprobacion()`, `ejecutarAprobada()`, `clasificarAccion()`, `crearReglaDesdeExcepcion()`, `expirarPendientes()` |
| `12_cola.js` | **cola durable** (E2, hoja `Cola_tareas`): claim atómico + drain | `encolar()`, `drenarCola()`, `tomar_()`, `ejecutarTarea_()` |
| `13_agentes.js` | **registry 13 agentes** (E2): runners + cupos/presupuesto + feed `Actividad` | `AGENTES`, `correrAgente_()`, `encolarAgente()`, `guardPresupuesto_()`, `RUNNERS` |
| `14_director.js` | **Director / orquestación** (E8a): por tenant activo materializa el cerebro + encola Analista por objetivo con métrica + escribe "parte" y surface la directiva al feed; 0 API; en `corridaDiaria` | `correrDirector(tenant?)`, `chequeoLivianoDirector()`, `instalarTriggerDirector()` |
| `15_cerebro.js` | **Cerebro / grafo de memoria multi-tenant** (E8a): nodos/aristas/log/estado por tenant + índice agregado sin PII en MAESTRO | `upsertNodo()`, `upsertArista()`, `logEvento()` (append-only), `materializarEstado()`, `leerEstado()`, `repararCerebro()` |
| `16_salud.js` | **Loop de salud** (E8a): 6 chequeos (schema/sync/cola/presupuesto/aprobaciones/cerebro), clasifica, alerta-no-arregla (`AUTOHEAL_ON` off); 0 API; en `corridaDiaria` | `correrSalud(opts)` |
| `17_bandeja.js` | **Bandeja + clasificador Haiku** (Fase 1 · Jarvis): captura personal única (`Bandeja` en MAESTRO) + triaje barato con confianza + escalate→aviso. Sin cliente (no anonimiza); costo a `Consumo_agentes` como 'clasificador'; trigger opt-in 30 min | `capturar()`, `clasificarBandeja()`, `promptClasificador_()`, `parseClasificacion_()`, `instalarTriggerBandeja()` |
| `18_direccion.js` | **Capa de Dirección** (Fase D · kevinfremon, MUST #1): `estadoVigente([id])` exporta un snapshot markdown ("packet of truth") del MAESTRO (Satori) o de un cliente (incl. North Star); composición pura sobre el data-layer, 0 API, sin escrituras propias | `estadoVigente()`, `estadoVigenteSistema_()`, `estadoVigenteCliente_()` |

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
- UI = registro **operativo** (skill `satori-design`, reemplaza DESIGN.md) + overlay **Centro de Mando** (B-orbe):
  orbe-vivo a4.2 (energía/neuronas ligadas a agentes en `work`, pausa con calma/reduced-motion), **tira de telemetría**
  (integridad/llamadas/tokens/gasto-tope/errores/salud), tabs **Actividad/Aprobaciones/Salud** (los 6 chequeos vía
  `estadoSalud()` dryRun), **directiva del Director**, inbox E2 con teclado (j/k/a/e/r), modo calma, ⌘K. **Mobile-first**:
  en ≤880 el orbe es hero y los 13 agentes salen de la órbita a **chips tappables** 2-col (`cmChips`). Vanilla GAS, `textContent` (XSS-safe).
- Datos vía `google.script.run`; HTML estático → sin `<?= ?>`/`<?!= ?>` con datos.
- Deploy «solo yo» (`access: MYSELF`, `executeAs: USER_DEPLOYING`). Probar live requiere OAuth de Luciano en el navegador.

## Estado (16-jun — Workspace · E2+ cerrado · E8a cerrada · selfTest verde)
- En **`luciano@satoriconsultoria.com`** (Workspace, C1). scriptId nuevo en `.clasp.json`; MAESTRO `1DMOR…`.
- E1 en uso real. E2+ (Trillion) construida: motor de aprobaciones, wrapper de costos + Bastión, cola durable,
  registry de 13 agentes (5 activos / 8 laboratorio), Centro de Mando. Lote B de la PURGA E1 aplicado.
- **`selfTest()` verde completo** (incl. bloques E8a-1/2/3). **Gate E2+ CERRADO** (migración Workspace + E2-1 + 6 casos manuales + viejo neutralizado). **Etapa 8a CERRADA** (16-jun): cerebro (`15`) + Director (`14`) + Salud (`16`) + Command Center (a4.1 telemetría/Salud/directiva · a4.2 orbe-vivo · mobile chips) + Purga de cierre (0 críticos → **7 parches** perf/UX aplicados).
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
