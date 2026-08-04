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
| `05_costos.js` | **wrapper de costos + Bastión** (E2): anonimiza→fetch Claude→log siempre→error tipado; consolidación mensual. **TC-10 · prompt caching:** el `system` se manda en bloques y `cache_control: ephemeral` va SOLO en la parte fija — el contexto vivo del cliente va después del breakpoint y jamás se marca (cachearlo no pegaría nunca Y fijaría datos de un tenant). El mínimo cacheable es **por modelo** (Haiku 4.5 → 4096, Sonnet → 1024, Opus 5 → 512; no es monótono): por debajo no se marca y se declara el motivo, sin inflar el prompt | `llamadaAPI(cli, mod, opts)` (+`opts.systemVivo`), `_systemBloques_()` / `_cacheMinimo_()` / `_estimarTokens_()` (puros), `anonimizar/desanonimizar`, `consolidarCostosMes()`, `logCostoCliente()` |
| `06_avisos.js` | trigger diario + detectores + expiración + (E2) encolar Vigía, (E8a) correr Director + Salud, consolidar costos, y (TC-2) el **guardián foco/paz** — mira la carga de Luciano, no el trabajo: solo avisa, una cosa a soltar, máx. 1 por día; instala trigger `drenarCola` | `corridaDiaria()`, `instalarTriggers()`, `crearAviso()` (+`_crearAviso_` interno para el camino pre-auth), `detectar*()`, `guardianFocoPaz_()`, `_focoPazEvaluar_()` (puro), `expirarAprobaciones()`, `clienteDeProyecto/mapaProyectoCliente` |
| `07_util.js` | helpers (sin estado) | `getMaestro()`, `abrirCliente()`, `ensureSheet()`, `leerTabla()`, `appendFila()`, `getConfig/setConfig`, `nextId()`, `protegerSheet()`, `ahoraISO/hoyISO/mesISO` |
| `08_webapp.js` | Web App: shell + datos UI (vía `google.script.run`); endpoints del Centro de Mando (estado, **telemetría, salud**, **actividad inter-agentes**). `doPost` = tool-backend de Voz con secreto propio | `doGet()`, `datosHoy()`, `datosCliente(id)`, `estadoSistema()`, `estadoAgentes()` (+`telemetria`), `estadoSalud()`, `datosActividadAgentes(lim, agente, cliente)` (cruce agente×tenant sobre una **ventana declarada**), `telemetriaMaestro_()`, `dispararAgenteUI()`, `resolverAprobacionUI()` |
| `index.html` | UI vanilla (**skill `satori-design`**, reemplaza DESIGN.md): vista «Hoy» + panel cliente + overlay **Centro de Mando** (orbe-vivo a4.2, tira de telemetría, tabs Actividad/Aprobaciones/Salud/**Cruce**, directiva del Director, inbox con teclado, ⌘K; **mobile-first**: agentes como chips ≤880). Sin templating: datos async, `textContent`.<br>⚠ **REGLA DE OVERLAY (01-ago + TC-4):** todo panel montado a nivel `<body>` (fuera de `#centro`) necesita **z-index sobre 300 Y tokens de tema propios** — las primitivas viven en `#centro`/`#akasha`, no en `:root`, así que afuera `var(--color-text)` cae al tema claro. Le pasó al panel de Sato (01-ago) y a la paleta ⌘K (encontrado por render en TC-4: tapada por `#gl` y contraste 1.07). Se verifica con `_verificar_index.py` + render local (`playwright`), nunca leyendo el CSS | — |
| `09_selftest.js` | verificación end-to-end auto-limpia (E1 + casos E2). NO usa `corridaDiaria()` (tocaría producción) | `selfTest()`, `limpiarTodoTest()` |
| `10_bootstrap.js` | arranque real en una corrida | `bootstrap()` |
| `11_aprobaciones.js` | **motor de aprobaciones** (E2): único camino a la ejecución | `crearAprobacion()`, `resolverAprobacion()`, `ejecutarAprobada()`, `clasificarAccion()`, `crearReglaDesdeExcepcion()`, `expirarPendientes()` |
| `12_cola.js` | **cola durable** (E2, hoja `Cola_tareas`): claim atómico + drain | `encolar()`, `drenarCola()`, `tomar_()`, `ejecutarTarea_()` |
| `14_director.js` | **Director / orquestación** (E8a): por tenant activo materializa el cerebro + encola Analista por objetivo con métrica + escribe "parte" y surface la directiva al feed; 0 API; en `corridaDiaria`. **TC-3 · PM persistente (D7):** el estado de cada objetivo sobrevive entre corridas en un nodo `NOD-PM-*` del cerebro del tenant, con la **foto completa** (no el delta: encadenar diferencias es frágil). Solo re-analiza si hubo cambios o venció `pm_dias_refresco`; sin nodo previo ⇒ análisis completo | `correrDirector(tenant?)`, `chequeoLivianoDirector()`, `instalarTriggerDirector()`, puros: `_pmFoto_()`, `_pmDelta_()`, `_pmVencido_()`, `_pmPregunta_()` |
| `15_cerebro.js` | **Cerebro / grafo de memoria multi-tenant** (E8a): nodos/aristas/log/estado por tenant + índice agregado sin PII en MAESTRO | `upsertNodo()`, `upsertArista()`, `logEvento()` (append-only), `materializarEstado()`, `leerEstado()`, `repararCerebro()` |
| `16_salud.js` | **Loop de salud** (E8a): **7** chequeos (schema/sync/cola/presupuesto/aprobaciones/cerebro/**seguridad**), clasifica, alerta-no-arregla (`AUTOHEAL_ON` off); 0 API; en `corridaDiaria` | `correrSalud(opts)` |
| `17_bandeja.js` | **Bandeja + clasificador Haiku** (Fase 1 · Jarvis): captura personal única (`Bandeja` en MAESTRO) + triaje barato con confianza + escalate→aviso. Sin cliente (no anonimiza); costo a `Consumo_agentes` como 'clasificador'; trigger opt-in 30 min | `capturar()`, `clasificarBandeja()`, `promptClasificador_()`, `parseClasificacion_()`, `instalarTriggerBandeja()` |
| `22_seguridad.js` | **MÓDULO S** (T3, 21-jul · Bastión): gate de identidad de TODOS los endpoints client-callable (`_soloOwner_`, criterio puro en `_puertaOwner_`) + contexto de sistema para triggers/doPost (`_ctxSistema_`) + vencimiento de secretos + **matriz de riesgo** default-deny + **security-scan** (chequeo 7 de Salud) | `_soloOwner_()`, `_puertaOwner_()`, `_ctxSistema_()`, `gateRiesgo_()`, `securityScan_()`, `rotarSecretoVoz()`, `sembrarExpirySecretos()`, `ENDPOINTS_UI` |
| `18_direccion.js` | **Capa de Dirección** (Fase D · kevinfremon, MUST #1): `estadoVigente([id])` exporta un snapshot markdown ("packet of truth") del MAESTRO (Satori) o de un cliente (incl. North Star); composición pura sobre el data-layer, 0 API, sin escrituras propias | `estadoVigente()`, `estadoVigenteSistema_()`, `estadoVigenteCliente_()` |
| `26_sato.js` | **Sato** (T1.6/1.7/1.8 + T2): un solo Sato en dos modos (cliente / sistema), memoria por tenant en la hoja `charla`, herramientas por marcador `@@DATOS`, cierre de sesión. **TC-5 · Capa 3:** `exportarCharlas` baja lo hablado a markdown para el `.md` del Hilo — read-only, cap declarado, y cada `.md` rotulado con SU cliente | `satoChat()`, `satoVoz()`, `satoCierreSesion()`, `satoAplicarCierre()`, `exportarCharlas(id?, desde?)`, `_charlaMd_()` (puro), `_satoDatos_()`, `SATO_FUENTES`, `SATO_TIPOS_ITEM` |
| `13_agentes.js` | **registry 13 agentes** (E2): runners + cupos/presupuesto + feed `Actividad`. **TC-9:** el roster define los DEFAULTS y `agenteEfectivo_` los mezcla con el override de `Agentes_estado` — todo el que pregunte por `activo`/`gate`/`maxDia` pasa por ahí (leer `AGENTES[k]` directo se saltea el hot-reload) | `AGENTES`, `agenteEfectivo_()`, `correrAgente_()`, `encolarAgente()`, `guardPresupuesto_()`, `RUNNERS` |
| `28_forge.js` | **FORGE** (TC-9, 03-ago): promoción laboratorio→producción. Asimétrico a propósito — **promover** corre un test-gate y crea una APROBACIÓN default-deny con el veredicto adjunto y visible (nunca activa directo, y un test fallido se muestra en vez de esconderse); **demover** es inmediato y sin aprobación, porque apagar siempre se puede. El estado vive en datos, no en código | `promoverAgente()`, `demoverAgente()`, `agentesEstado()`, `_forgeTestGate_()`, `_forgeSlop_()` (puro), `_forgeAplicarPromocion_()` |
| `27_decisiones.js` | **DECISION LOG** (TC-2, 03-ago): las decisiones de dirección con su PORQUÉ, append-only (se revierten, no se borran) y con `alcance` = sistema o id_cliente, que es lo que aísla lo de un tenant de lo de otro. Fuente `decisiones` de Sato y destino del tipo de ítem `decision` del cierre de sesión | `registrarDecision()`, `decisionesVigentes(ctx)`, `revertirDecision()`, `_decisionVisible_()` (puro, aislamiento) |

> ⚠ Este índice quedó incompleto antes de TC-2: faltan las filas de `19_conectores`, `20_killswitch`, `21_backup`, `23_evals`, `24_soul` y `25_hilo` (`26_sato` se agregó en TC-5). Se anota como deuda en vez de dejarlo pasar en silencio: el índice es lo que CLAUDE.md manda leer primero, así que un índice que miente cuesta más que ninguno.

## Scripts de la raíz (Node/bash, fuera de `src/` — no se suben a GAS)

| Script | Qué hace |
|---|---|
| `_harness.js` | arnés offline: carga los módulos en un `vm` con stubs y corre los asserts que no necesitan Sheets. `node _harness.js` |
| `_verificar_index.py` | verificación estructural de `index.html`: divs balanceados + que todo `<script>` inline compile. Lo que `clasp push` nunca avisa |
| `_x4_gates.js` | pone `_soloOwner_` en las funciones declaradas (X4/X4b). Idempotente: es el criterio de gateo, ejecutable |
| `_charla_pull.sh` | **TC-5**: baja las charlas a `entregables/charlas/<CLI>-charla.md`. Secreto por env/`.env.local`, nunca hardcodeado; `--dry` para ver qué haría. La carpeta destino está gitignoreada (PII) |
| `_capabilities_gen.sh` | regenera `CAPABILITIES.md` (el hook pre-push aborta si quedó stale) |

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
