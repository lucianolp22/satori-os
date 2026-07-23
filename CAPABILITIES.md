# CAPABILITIES — Satori OS  (autogenerado)

> **NO editar a mano.** Se regenera con `bash _capabilities_gen.sh` (introspección de `src/`).
> Generado: 2026-07-23 14:55 · commit: 209bbce

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
| `07_util.js` | Helpers compartidos. Sin estado propio; todo deriva del MAESTRO | 22 |
| `08_webapp.js` | Web App interna (acceso "solo yo", ejecutar como yo) | 57 |
| `09_selftest.js` | Verificación end-to-end (handoff: "ejecutar, no asumir") | 24 |
| `10_bootstrap.js` | Arranque real de Etapa 1 en UNA corrida (autoriza una vez) | 1 |
| `11_aprobaciones.js` | Motor de aprobaciones (ETAPA 2 · Módulo 1) | 15 |
| `12_cola.js` | Cola de tareas durable (ETAPA 2 · capa Trillion, Cola.gs donante adaptado) | 17 |
| `13_agentes.js` | Registry de 13 sub-agentes + presupuesto/cupos + feed (Agentes.gs donante adaptado) | 12 |
| `14_director.js` | Director (orquestación) (ETAPA 8a · módulo a2) | 4 |
| `15_cerebro.js` | Cerebro (grafo de memoria) multi-tenant (ETAPA 8a · módulo a1) | 25 |
| `16_salud.js` | Loop de salud del sistema (ETAPA 8a · módulo a3) | 3 |
| `17_bandeja.js` | Bandeja de captura única + clasificador Haiku con confianza (Fase 1 · Jarvis) | 8 |
| `18_direccion.js` | Capa de Dirección (Fase D · kevinfremon). MUST #1: estadoVigente | 57 |
| `19_conectores.js` | Capa de conectores (integración con los sistemas de los clientes) | 19 |
| `20_killswitch.js` | Kill switch unificado (riel Bastión #7) | 5 |
| `21_backup.js` | Backup/snapshot semanal de los DATOS (B3) | 14 |
| `22_seguridad.js` | MÓDULO S (T3 · Bastión lidera). Seguridad del motor | 21 |
| `23_evals.js` | Golden-set + runner de evals (T3 · MÓDULO M · M4, 21-jul-2026) | 6 |
| `24_soul.js` | SOUL: identidad operativa de Satori OS (T3 · MÓDULO H · H1 · D11, 21-jul-2026) | 2 |
| `25_hilo.js` | HILO DE TRABAJO por cliente (TC-W1 / W2 / W4 · 21-jul-2026) | 12 |

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

**MAESTRO:** Clientes, Proyectos, Tareas, Avisos, Bitacora, Aprobaciones_agregadas, Costos_API_consolidado, Gobernanza, Cola_tareas, Cola_archivo, Actividad, Consumo_agentes, Cerebro_index, Bandeja, Feedback, Recomendaciones, Agenda, Direcciones, NS_serie, Config

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

**07_util.js:** getMaestro ahoraISO hoyISO mesISO aFechaISO fechaHoraCorta_ ensureSheet aplicarFormatoTexto leerTabla appendFila sanitizarCelda conLock abrirCliente getConfig configPrefijo_ setConfig nextId protegerSheet _sinTildes_ _fmtMiles_ _valorPalabras_ normalizarCifrasTexto_ 

**08_webapp.js:** doGet doPost vozOut_ vozAuth_ oficinaSyncAuth_ limpiarHostilTexto_ sgicConsulta_ sgicVentas_ _sgicResumenVentas_ _sgicMesDe_ _sgicFila_ _sgicCap_ asegurarTenantOficina_ oficinaSync_ accionVoz_ _hueleANorthStar_ ctEq_ vozStr_ vozLog_ vozRate_ clienteExiste_ vozRechazo_ setPrefUI prefsUI cerebroGrafo cerebroNodo estadoSistema datosHoy listaClientes datosCliente consumoApiCliente tareasActivasOrdenadas esVencida estadoAgentes telemetriaMaestro_ _bootSeccion_ bootUniverso bootResto bootUnico _bootRangoSemana_ estadoSalud estadosAgentesCola_ feedReciente_ inboxAprobaciones_ dispararAgenteUI resolverAprobacionUI metricasValidasUI asignarMetricaUI quitarAgregada_ tableroTareas sumarDiasISO_ parseRecurrencia parseQuickAdd crearTarea crearTareaQuick moverTarea aHoraLegible_ 

**09_selftest.js:** selfTest _aprobarSiOk_ _asertsF2_ _asertsD14_ _asertsD15_ _asertsD16_ _asertsD17j_ _asertsD18_ _asertsD19_ _asertsD20_ _asertsD21_ _asertsD22_ _asertsD23_ _asertsD24_ _asertsD25_ _asertsD26_ _endpointSinGateD19_ _asertsD17h_ _asertsD17i_ selfTestF2_ selfTestF2 debugE21 limpiarTodoTest borrarFilasDonde 

**10_bootstrap.js:** bootstrap 

**11_aprobaciones.js:** clasificarAccion direccionVigente_ _dirActiva_ ejecutarCrearObjetivo_ umbralPara crearAprobacion agregarAgregada_ resolverAprobacion ejecutarAprobada ejecutarEmail_ ejecutarActivarRegla_ crearReglaDesdeExcepcion expirarPendientes parsearPayload_ autorActual_ 

**12_cola.js:** workerActual_ hojaCola_ colsCola_ encolar tomar_ setFilaCola_ completar_ fallar_ reclamarColgadas_ drenarCola ejecutarTarea_ archivarColaVieja_ _colaArchivable_ verifArchivoCola_ verifArchivoCola archivarColaViejaREAL aFechaHora_ 

**13_agentes.js:** feed_ budgetMensualUSD_ _filaConsumoCore_ filaConsumoAgentes_ registrarConsumoAgente_ guardPresupuesto_ leerHojaCliente_ sinDatos_ errorRunner_ blindarDatos_ correrAgente_ encolarAgente 

**14_director.js:** correrDirector poblarCerebro_ chequeoLivianoDirector instalarTriggerDirector 

**15_cerebro.js:** cerebroSheet_ upsertPorClave_ dimensionDeTipo_ upsertNodo upsertArista logEvento cerebroCorteDias_ _planCompresion_ _tiposATexto_ _textoATipos_ _fusionarResumen_ _eventosArchivados_ comprimirMemoriaFria comprimirMemoriaFriaTodos_ comprimirMemoria materializarEstado _ultimoArchivado_ actualizarCerebroIndex_ leerEstado repararCerebro migrarCerebroSchema agregarColumnasFaltantes_ cargarObjetivo cargarObjetivosPiloto sembrarDatosEjemplo 

**16_salud.js:** saludTitulo_ saludAccion_ correrSalud 

**17_bandeja.js:** esResearch_ capturar bandejaUmbral_ clasificarBandeja promptClasificador_ parseClasificacion_ llamadaClasificador_ instalarTriggerBandeja 

**18_direccion.js:** estadoVigente estadoVigenteSistema_ estadoVigenteCliente_ objetoAConteo_ briefDiario briefCacheado_ calentarBriefCacheSistema_ verifBriefCache_ calentarBriefCache verifBriefCache contratoStatusReport_ _tendencia_ _contrapeso_ _verificacion_ _recContractual_ _cierreAccionMetrica_ briefDiarioSistema_ briefDiarioCliente_ northStarSatori_ registrarNorteDelDia_ _puntoSerieAccion_ _serieNorte_ _nsLista_ _nsPivots_ northStarTenant_ _pivotsTenant_ _hzLimpio_ metricasValidas_ sembrarNorthStarSatori_ sembrarNorthStarSatori cargarNorthStarSatori cargarNorthStarVehemence migrarObjetivosNorthStar _respaldarObjetivos_ _verificarRespaldo_ resetObjetivosYNorthStar restaurarObjetivosDesdeBackup limpiarErroresFantasma_ limpiarErroresFantasma verVehemence truncar_ _diasDesde_ recomendacionDelDia_ _pivotMuerto_ _recNorthStar_ _recCandidatas_ clienteKpiEnAlerta_ _valorOperativoDeKpi_ _nsSerieHoy_ registrarRecomendacionDelDia marcarRecomendacion aprobacionDesdeRecomendacion recomendacionesAbiertas agendaSemana agendarEvento agendaRango registrarFeedback 

**19_conectores.js:** sincronizarVehemence mapearLibroLcTravel_ mapearMovimientosMesaquince_ mapearFreshaDam_ sembrarConectoresHallados _mapaConectores_ _decidirConector_ mapearOperacionesGenerico_ sincronizarCliente_ sincronizarConectorOperaciones_ sincronizarConectores altaConector encenderConector apagarConector probarConector estadoConectores sincronizarConectorVentas_ borrarFilasBatch_ agregarVentasPorMes_ 

**20_killswitch.js:** _sistemaPausado_ pausarSistema reanudarSistema estadoPausa smokeKill 

**21_backup.js:** _stampBackup_ _nombreSeguro_ _backupRootFolder_ _retencionSemanas_ _copiarSpreadsheet_ _ejecutarBackup_ backupSemanal backupAhora instalarTriggerBackup estadoTriggerBackup smokeBackup backupListar drillRestore _drillRestore_ 

**22_seguridad.js:** _ctxSistemaPermitido_ _ctxSistema_ _puertaOwner_ _esOwner_ _soloOwner_ _tieneGate_ _vencido_ _diasPara_ _expiraProp_ _secretoVencido_ _isoMasDias_ sembrarExpirySecretos _nuevoSecreto_ rotarSecretoVoz rotarSecretoOficina _rotarSecreto_ _riesgoConfig_ _riesgoModo_ gateRiesgo_ securityScan_ securityScan 

**23_evals.js:** _correrEvalDet_ _evalEjecutar_ _evalComparar_ _evalEstructuraClasificacion_ correrEvals correrEvalsConApi 

**24_soul.js:** soulPrompt_ soulReglas_ 

**25_hilo.js:** _armarHilo_ _semaforoHilo_ hiloCliente _numeroConectorCliente_ _ultimoEspejo_ repararHilo espejarHilo espejarHiloCSV _parseCSVLinea_ _seccionHilo_ _recDesdeHilo_ _clienteConHiloCaliente_ 

