# CAPABILITIES — Satori OS  (autogenerado)

> **NO editar a mano.** Se regenera con `bash _capabilities_gen.sh` (introspección de `src/`).
> Generado: 2026-07-17 19:35 · commit: fb1325c

## Módulos

| Archivo | Propósito | Funciones |
|---|---|---|
| `00_ping.js` | — | 1 |
| `01_schema.js` | Definición única de pestañas y columnas (fuente de verdad del modelo) | 0 |
| `02_setup.js` | Inicialización del Sheet MAESTRO | 3 |
| `03_cliente.js` | Alta de clientes y plantilla de Sheet cliente | 2 |
| `04_sync.js` | Agregación MAESTRO ← Sheets cliente (vía GAS, NO IMPORTRANGE) | 1 |
| `05_costos.js` | Wrapper de costos de API + Bastión de seguridad (ETAPA 2 · Módulos 2-3) | 7 |
| `06_avisos.js` | Avisos internos y trigger diario batched (handoff 1.4) | 17 |
| `07_util.js` | Helpers compartidos. Sin estado propio; todo deriva del MAESTRO | 17 |
| `08_webapp.js` | Web App interna (acceso "solo yo", ejecutar como yo) | 51 |
| `09_selftest.js` | Verificación end-to-end (handoff: "ejecutar, no asumir") | 12 |
| `10_bootstrap.js` | Arranque real de Etapa 1 en UNA corrida (autoriza una vez) | 1 |
| `11_aprobaciones.js` | Motor de aprobaciones (ETAPA 2 · Módulo 1) | 15 |
| `12_cola.js` | Cola de tareas durable (ETAPA 2 · capa Trillion, Cola.gs donante adaptado) | 17 |
| `13_agentes.js` | Registry de 13 sub-agentes + presupuesto/cupos + feed (Agentes.gs donante adaptado) | 12 |
| `14_director.js` | Director (orquestación) (ETAPA 8a · módulo a2) | 4 |
| `15_cerebro.js` | Cerebro (grafo de memoria) multi-tenant (ETAPA 8a · módulo a1) | 15 |
| `16_salud.js` | Loop de salud del sistema (ETAPA 8a · módulo a3) | 1 |
| `17_bandeja.js` | Bandeja de captura única + clasificador Haiku con confianza (Fase 1 · Jarvis) | 8 |
| `18_direccion.js` | Capa de Dirección (Fase D · kevinfremon). MUST #1: estadoVigente | 36 |
| `19_conectores.js` | Capa de conectores (integración con los sistemas de los clientes) | 5 |
| `20_killswitch.js` | Kill switch unificado (riel Bastión #7) | 5 |
| `21_backup.js` | Backup/snapshot semanal de los DATOS (B3) | 14 |

## Entry points de editor (se corren a mano desde Apps Script)

Funciones públicas sin guión bajo final que son de arranque/verificación manual:

- `setup()` — 02_setup.js
- `cargaInicialClientes()` — 03_cliente.js
- `selfTest()` — 09_selftest.js
- `smokeKill()` — 20_killswitch.js
- `smokeBackup()` — 21_backup.js
- `backupAhora()` — 21_backup.js
- `backupListar()` — 21_backup.js
- `drillRestore()` — 21_backup.js
- `instalarTriggerBackup()` — 21_backup.js
- `estadoTriggerBackup()` — 21_backup.js
- `pausarSistema()` — 20_killswitch.js
- `reanudarSistema()` — 20_killswitch.js
- `estadoPausa()` — 20_killswitch.js
- `probarAlertaEmail()` — 06_avisos.js

## Triggers (time-based)

| Handler | Cadencia | Módulo |
|---|---|---|
| `drenarCola` | everyMinutes(5)  | 06_avisos.js |
| `sincronizarConectores` | everyHours(8)  | 06_avisos.js |
| `chequeoLivianoDirector` | everyMinutes(30)  | 14_director.js |
| `clasificarBandeja` | everyMinutes(30)  | 17_bandeja.js |
| `backupSemanal` | onWeekDay(ScriptApp.WeekDay.SUNDAY) atHour(4)  | 21_backup.js |

## Scopes OAuth (appsscript.json)

- auth/spreadsheets
- auth/drive.file
- auth/script.scriptapp
- auth/script.external_request
- auth/script.send_mail
- auth/userinfo.email

webapp.access = DOMAIN · executeAs = USER_DEPLOYING

## Pestañas

**MAESTRO:** Clientes, Proyectos, Tareas, Avisos, Bitacora, Aprobaciones_agregadas, Costos_API_consolidado, Gobernanza, Cola_tareas, Cola_archivo, Actividad, Consumo_agentes, Cerebro_index, Bandeja, Feedback, Recomendaciones, Agenda, Direcciones, Config

**Cliente:** Datos_operativos, KPIs, Aprobaciones, Excepciones, Umbrales, Costos_API, Reglas, nodos, aristas, cerebro_log, estado_actual, objetivos

## Agentes (registry)

| Clave | Nombre | Rol | Activo |
|---|---|---|---|
| vigia | Vigía | Monitoreo | true |
| conciliador | Conciliador | Banco↔Ventas | true |
| cobrador | Cobrador | Cobranzas | true |
| analista | Analista | Tendencias | true |
| abastecedor | Abastecedor | Stock | true |
| flux | Flux | Ingeniería | false |
| relay | Relay | Soporte | false |
| scout | Scout | Testing | false |
| prism | Prism | Diseño | false |
| atlas | Atlas | Research | false |
| spark | Spark | Social | false |
| forge | Forge | Crea agentes | false |
| lift | Lift | Retención | false |

## Script Properties (nombres, sin valores)

- alertas_email_on
- API_BUDGET_MENSUAL_USD
- AUTOHEAL_ON
- brief_push_on
- BRIEFPUSH_ultimo
- CLAUDE_API_KEY
- OFICINA_SYNC_SECRET
- OWNER_EMAIL
- voz_alerta_fecha
- VOZ_TOOL_SECRET
- WORKER

## Funciones por módulo (apéndice)

**00_ping.js:** ping 

**02_setup.js:** setup urlMaestro repararFormatosTexto 

**03_cliente.js:** crearCliente cargaInicialClientes 

**04_sync.js:** syncMaestro 

**05_costos.js:** modeloDeModulo_ llamadaAPI costearUSD_ logCostoCliente anonimizar desanonimizar consolidarCostosMes 

**06_avisos.js:** alertaEmail_ probarAlertaEmail briefPush_ probarBriefPush crearAviso corridaDiaria encolarVigiaClientesActivos detectarVencimientos detectarTareasEstancadas resolverAvisosDonde_ detectarProyectosSinMovimiento expirarAprobaciones hace mapaProyectoCliente invalidarMapaPC clienteDeProyecto instalarTriggers 

**07_util.js:** getMaestro ahoraISO hoyISO mesISO aFechaISO ensureSheet aplicarFormatoTexto leerTabla appendFila sanitizarCelda conLock abrirCliente getConfig configPrefijo_ setConfig nextId protegerSheet 

**08_webapp.js:** doGet doPost vozOut_ vozAuth_ oficinaSyncAuth_ limpiarHostilTexto_ sgicConsulta_ sgicVentas_ _sgicResumenVentas_ _sgicMesDe_ _sgicFila_ _sgicCap_ asegurarTenantOficina_ oficinaSync_ accionVoz_ _hueleANorthStar_ ctEq_ vozStr_ vozLog_ vozRate_ clienteExiste_ vozRechazo_ setPrefUI prefsUI cerebroGrafo estadoSistema datosHoy listaClientes datosCliente consumoApiCliente tareasActivasOrdenadas esVencida estadoAgentes telemetriaMaestro_ bootUnico _bootRangoSemana_ estadoSalud estadosAgentesCola_ feedReciente_ inboxAprobaciones_ dispararAgenteUI resolverAprobacionUI quitarAgregada_ tableroTareas sumarDiasISO_ parseRecurrencia parseQuickAdd crearTarea crearTareaQuick moverTarea aHoraLegible_ 

**09_selftest.js:** selfTest _aprobarSiOk_ _asertsF2_ _asertsD14_ _asertsD15_ _asertsD16_ _asertsD17h_ selfTestF2_ selfTestF2 debugE21 limpiarTodoTest borrarFilasDonde 

**10_bootstrap.js:** bootstrap 

**11_aprobaciones.js:** clasificarAccion direccionVigente_ _dirActiva_ ejecutarCrearObjetivo_ umbralPara crearAprobacion agregarAgregada_ resolverAprobacion ejecutarAprobada ejecutarEmail_ ejecutarActivarRegla_ crearReglaDesdeExcepcion expirarPendientes parsearPayload_ autorActual_ 

**12_cola.js:** workerActual_ hojaCola_ colsCola_ encolar tomar_ setFilaCola_ completar_ fallar_ reclamarColgadas_ drenarCola ejecutarTarea_ archivarColaVieja_ _colaArchivable_ verifArchivoCola_ verifArchivoCola archivarColaViejaREAL aFechaHora_ 

**13_agentes.js:** feed_ budgetMensualUSD_ _filaConsumoCore_ filaConsumoAgentes_ registrarConsumoAgente_ guardPresupuesto_ leerHojaCliente_ sinDatos_ errorRunner_ blindarDatos_ correrAgente_ encolarAgente 

**14_director.js:** correrDirector poblarCerebro_ chequeoLivianoDirector instalarTriggerDirector 

**15_cerebro.js:** cerebroSheet_ upsertPorClave_ dimensionDeTipo_ upsertNodo upsertArista logEvento materializarEstado actualizarCerebroIndex_ leerEstado repararCerebro migrarCerebroSchema agregarColumnasFaltantes_ cargarObjetivo cargarObjetivosPiloto sembrarDatosEjemplo 

**16_salud.js:** correrSalud 

**17_bandeja.js:** esResearch_ capturar bandejaUmbral_ clasificarBandeja promptClasificador_ parseClasificacion_ llamadaClasificador_ instalarTriggerBandeja 

**18_direccion.js:** estadoVigente estadoVigenteSistema_ estadoVigenteCliente_ objetoAConteo_ briefDiario briefCacheado_ calentarBriefCacheSistema_ verifBriefCache_ calentarBriefCache verifBriefCache contratoStatusReport_ _tendencia_ _contrapeso_ _recContractual_ _cierreAccionMetrica_ briefDiarioSistema_ briefDiarioCliente_ northStarSatori_ _hzLimpio_ sembrarNorthStarSatori_ sembrarNorthStarSatori cargarNorthStarSatori cargarNorthStarVehemence verVehemence truncar_ _diasDesde_ recomendacionDelDia_ clienteKpiEnAlerta_ registrarRecomendacionDelDia marcarRecomendacion aprobacionDesdeRecomendacion recomendacionesAbiertas agendaSemana agendarEvento agendaRango registrarFeedback 

**19_conectores.js:** sincronizarVehemence sincronizarConectores sincronizarConectorVentas_ borrarFilasBatch_ agregarVentasPorMes_ 

**20_killswitch.js:** _sistemaPausado_ pausarSistema reanudarSistema estadoPausa smokeKill 

**21_backup.js:** _stampBackup_ _nombreSeguro_ _backupRootFolder_ _retencionSemanas_ _copiarSpreadsheet_ _ejecutarBackup_ backupSemanal backupAhora instalarTriggerBackup estadoTriggerBackup smokeBackup backupListar drillRestore _drillRestore_ 

