# CAPABILITIES — Satori OS  (autogenerado)

> **NO editar a mano.** Se regenera con `bash _capabilities_gen.sh` (introspección de `src/`).
> Generado: 2026-08-27 14:02 · commit: b162ef4

## Módulos

| Archivo | Propósito | Funciones |
|---|---|---|
| `00_ping.js` | — | 1 |
| `01_schema.js` | Definición única de pestañas y columnas (fuente de verdad del modelo) | 0 |
| `02_setup.js` | Inicialización del Sheet MAESTRO | 4 |
| `03_cliente.js` | Alta de clientes y plantilla de Sheet cliente | 2 |
| `04_sync.js` | Agregación MAESTRO ← Sheets cliente (vía GAS, NO IMPORTRANGE) | 1 |
| `05_costos.js` | Wrapper de costos de API + Bastión de seguridad (ETAPA 2 · Módulos 2-3) | 10 |
| `06_avisos.js` | Avisos internos y trigger diario batched (handoff 1.4) | 23 |
| `07_util.js` | Helpers compartidos. Sin estado propio; todo deriva del MAESTRO | 32 |
| `08_webapp.js` | Web App interna (acceso "solo yo", ejecutar como yo) | 102 |
| `09_selftest.js` | Verificación end-to-end (handoff: "ejecutar, no asumir") | 55 |
| `10_bootstrap.js` | Arranque real de Etapa 1 en UNA corrida (autoriza una vez) | 1 |
| `11_aprobaciones.js` | Motor de aprobaciones (ETAPA 2 · Módulo 1) | 15 |
| `12_cola.js` | Cola de tareas durable (ETAPA 2 · capa Trillion, Cola.gs donante adaptado) | 17 |
| `13_agentes.js` | Registry de 13 sub-agentes + presupuesto/cupos + feed (Agentes.gs donante adaptado) | 14 |
| `14_director.js` | Director (orquestación) (ETAPA 8a · módulo a2) | 10 |
| `15_cerebro.js` | Cerebro (grafo de memoria) multi-tenant (ETAPA 8a · módulo a1) | 25 |
| `16_salud.js` | Loop de salud del sistema (ETAPA 8a · módulo a3) | 3 |
| `17_bandeja.js` | Bandeja de captura única + clasificador Haiku con confianza (Fase 1 · Jarvis) | 10 |
| `18_direccion.js` | Capa de Dirección (Fase D · kevinfremon). MUST #1: estadoVigente | 67 |
| `19_conectores.js` | Capa de conectores (integración con los sistemas de los clientes) | 35 |
| `20_killswitch.js` | Kill switch unificado (riel Bastión #7) | 5 |
| `21_backup.js` | Backup/snapshot semanal de los DATOS (B3) | 14 |
| `22_seguridad.js` | MÓDULO S (T3 · Bastión lidera). Seguridad del motor | 24 |
| `23_evals.js` | Golden-set + runner de evals (T3 · MÓDULO M · M4, 21-jul-2026) | 6 |
| `24_soul.js` | SOUL: identidad operativa de Satori OS (T3 · MÓDULO H · H1 · D11, 21-jul-2026) | 2 |
| `25_hilo.js` | HILO DE TRABAJO por cliente (TC-W1 / W2 / W4 · 21-jul-2026) | 12 |
| `26_sato.js` | SATO EN LA FICHA (T1.4 · 28-jul-2026) | 15 |
| `27_decisiones.js` | DECISION LOG (TC-2 · F4b). Las decisiones de dirección, con su porqué | 6 |
| `28_forge.js` | FORGE (TC-9 · adenda 03-ago). Promoción laboratorio → producción de agentes | 8 |
| `29_vigilancia.js` | TC-11 · A5 · VIGILANCIA MULTI-SUPERFICIE (04-ago-2026) | 11 |
| `30_correo.js` | T7 · CORREO → TRIAJE A BANDEJA (04-ago-2026) | 13 |
| `31_admin.js` | TC-7 · F4a · MOTOR DE ADMINISTRACIÓN PROPIA (04-ago-2026) | 14 |
| `32_flota.js` | EDIFICIO SATORI · lectores de la FLOTA PROPIA (10-ago-2026) | 11 |
| `33_cartera.js` | PIPELINE COMERCIAL (E1, 11-ago-2026) | 23 |
| `34_push.js` | Canal de push al teléfono de Luciano (proactividad, decisión 26-ago) | 2 |

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
| `calentarCachesVoz` | everyHours(1)  | 18_direccion.js |
| `backupSemanal` | onWeekDay(ScriptApp.WeekDay.SUNDAY) atHour(4)  | 21_backup.js |
| `X` | — | 22_seguridad.js |

## Scopes OAuth (appsscript.json)

- auth/spreadsheets
- auth/drive.file
- auth/script.scriptapp
- auth/script.external_request
- auth/script.send_mail
- auth/gmail.readonly
- auth/userinfo.email

webapp.access = DOMAIN · executeAs = USER_DEPLOYING

## Pestañas

**MAESTRO:** Clientes, Proyectos, Tareas, Avisos, Bitacora, Aprobaciones_agregadas, Costos_API_consolidado, Gobernanza, Cola_tareas, Cola_archivo, Actividad, Consumo_agentes, Cerebro_index, Bandeja, Correo_visto, Feedback, Recomendaciones, Agenda, Direcciones, NS_serie, Decisiones, Agentes_estado, Config

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

- API_BUDGET_MENSUAL_USD
- AUTOHEAL_ON
- BRIEFPUSH_ultimo
- CHARLA_EXPORT_SECRET
- CLAUDE_API_KEY
- ELEVENLABS_API_KEY
- ENCARGOS_SECRET
- NTFY_TOKEN
- NTFY_TOPIC
- NTFY_URL
- OFICINA_SYNC_SECRET
- OWNER_EMAIL
- PUSHOVER_TOKEN
- PUSHOVER_USER
- PUSH_PROVIDER
- SISTEMA_PAUSADO
- VEHEMENCE_SGIC_TOKEN
- VEHEMENCE_SGIC_URL
- VOZ_TOOL_SECRET
- WORKER
- alertas_email_on
- brief_push_on
- push_proactivo_on
- voz_alerta_fecha

## Funciones por módulo (apéndice)

**00_ping.js:** ping 

**02_setup.js:** setup urlMaestro repararFormatosTexto _repararIdsDecisiones_ 

**03_cliente.js:** crearCliente cargaInicialClientes 

**04_sync.js:** syncMaestro 

**05_costos.js:** modeloDeModulo_ _cacheMinimo_ _estimarTokens_ _systemBloques_ llamadaAPI costearUSD_ logCostoCliente anonimizar desanonimizar consolidarCostosMes 

**06_avisos.js:** alertaEmail_ probarAlertaEmail briefPush_ probarBriefPush pushProactivoDiario_ crearAviso _crearAviso_ _focoPazEvaluar_ _focoPazUmbrales_ _focoPazMetricas_ guardianFocoPaz_ corridaDiaria encolarVigiaClientesActivos detectarVencimientos detectarTareasEstancadas resolverAvisosDonde_ detectarProyectosSinMovimiento expirarAprobaciones hace mapaProyectoCliente invalidarMapaPC clienteDeProyecto instalarTriggers 

**07_util.js:** getMaestro ahoraISO hoyISO mesISO aFechaISO esVerdadero_ fechaHoraCorta_ ensureSheet aplicarFormatoTexto leerTabla appendFila sanitizarCelda conLock abrirCliente _trashArchivo_ _driveUrlCarpeta_ _driveUrlSheet_ _driveCopiar_ _driveGet_ _driveCrearCarpeta_ _driveMover_ _driveListarHijos_ _driveBuscarPorNombre_ getConfig configPrefijo_ setConfig nextId protegerSheet _sinTildes_ _fmtMiles_ _valorPalabras_ normalizarCifrasTexto_ 

**08_webapp.js:** doGet doPost vozAprobacionesPendientes_ vozDecidirAprobacion_ vozDispararAgente_ vozCrearTarea_ _encHoja_ _encSet_ vozEncargar_ _encargoAprobar_ encargosPoll_ encargosReportar_ _encargosSinAvisarContar_ encargosListos vozOut_ vozAuth_ charlaExportAuth_ encargosAuth_ oficinaSyncAuth_ limpiarHostilTexto_ sgicConsulta_ _sgicMesValido_ sgicVentas_ sgicKpisOficial_ diagSatoVentasVivo _sgicResumenVentas_ _sgicPanelSnapshot_ _arVoz_ _mesVoz_ _sgicVozResumen_ _sgicMesDe_ _sgicFila_ _sgicCap_ asegurarTenantOficina_ oficinaSync_ accionVoz_ _hueleANorthStar_ ctEq_ vozStr_ vozLog_ vozRate_ clienteExiste_ vozRechazo_ setPrefUI prefsUI cerebroGrafo cerebroNodo estadoSistema datosHoy listaClientes listaProyectos crearProyecto datosCliente consumoApiCliente fichaCliente _checklistSheet_ checklistCliente checklistMarcar checklistAgregar briefCliente tareasActivasOrdenadas esVencida estadoAgentes telemetriaMaestro_ _bootSeccion_ bootUniverso bootResto bootUnico _bootRangoSemana_ estadoSalud estadosAgentesCola_ datosActividadAgentes feedReciente_ inboxAprobaciones_ dispararAgenteUI resolverAprobacionUI metricasValidasUI asignarMetricaUI quitarAgregada_ tableroTareas sumarDiasISO_ parseRecurrencia parseQuickAdd crearTarea crearTareaQuick moverTarea guardarTarea detalleTarea _setArchivada_ archivarTarea desarchivarTarea tareasArchivadas guardarNotaProyecto aHoraLegible_ _hqHoja_ _hqCheckVigente_ hqHoy hqChecklist hqChecklistToggle hqObjetivos hqNumeros sembrarHQ 

**09_selftest.js:** selfTest _resumenSelfTest_ _aprobarSiOk_ _asertsF2_ _asertsD14_ _asertsD15_ _asertsD16_ _asertsD17j_ _asertsD18_ _asertsD19_ _asertsD20_ _asertsD21_ _asertsD22_ _asertsD23_ _asertsD24_ _asertsD25_ _asertsD26_ _endpointSinGateD19_ _asertsD17h_ _asertsD17i_ _asertsD27_ _asertsD28_ _asertsD30_ _asertsD31_ _asertsD32_ _asertsD33_ _asertsD34_ _asertsD37_ _asertsD38_ selfTestF2_ selfTestF2 debugE21 limpiarTodoTest borrarFilasDonde _asertsD39_ _asertsD40_ _asertsP2_ _asertsD44_ _asertsD46_ _asertsD47_ _asertsD48_ _asertsD49_ _asertsD45_ _d45Unicos_ _selfTestRegistrar_ selfTestTramo selfTestVeredicto _asertsD41_ selfTestTramo2 selfTestTramo3 selfTestTramo4 selfTestTramo5 selfTestTramo6 _asertsD43_ purgaAuditoria 

**10_bootstrap.js:** bootstrap 

**11_aprobaciones.js:** clasificarAccion direccionVigente_ _dirActiva_ ejecutarCrearObjetivo_ umbralPara crearAprobacion agregarAgregada_ resolverAprobacion ejecutarAprobada ejecutarEmail_ ejecutarActivarRegla_ crearReglaDesdeExcepcion expirarPendientes parsearPayload_ autorActual_ 

**12_cola.js:** workerActual_ hojaCola_ colsCola_ encolar tomar_ setFilaCola_ completar_ fallar_ reclamarColgadas_ drenarCola ejecutarTarea_ archivarColaVieja_ _colaArchivable_ verifArchivoCola_ verifArchivoCola archivarColaViejaREAL aFechaHora_ 

**13_agentes.js:** feed_ budgetMensualUSD_ _filaConsumoCore_ filaConsumoAgentes_ registrarConsumoAgente_ _agentesOverride_ agenteEfectivo_ guardPresupuesto_ leerHojaCliente_ sinDatos_ errorRunner_ blindarDatos_ correrAgente_ encolarAgente 

**14_director.js:** correrDirector _pmNodoId_ _pmFoto_ _pmValorMetrica_ _pmDelta_ _pmVencido_ _pmPregunta_ poblarCerebro_ chequeoLivianoDirector instalarTriggerDirector 

**15_cerebro.js:** cerebroSheet_ upsertPorClave_ dimensionDeTipo_ upsertNodo upsertArista logEvento cerebroCorteDias_ _planCompresion_ _tiposATexto_ _textoATipos_ _fusionarResumen_ _eventosArchivados_ comprimirMemoriaFria comprimirMemoriaFriaTodos_ comprimirMemoria materializarEstado _ultimoArchivado_ actualizarCerebroIndex_ leerEstado repararCerebro migrarCerebroSchema agregarColumnasFaltantes_ cargarObjetivo cargarObjetivosPiloto sembrarDatosEjemplo 

**16_salud.js:** saludTitulo_ saludAccion_ correrSalud 

**17_bandeja.js:** esResearch_ esPreparaReunion_ _resolverClientePrep_ capturar bandejaUmbral_ clasificarBandeja promptClasificador_ parseClasificacion_ llamadaClasificador_ instalarTriggerBandeja 

**18_direccion.js:** estadoVigente estadoVigenteSistema_ estadoVigenteCliente_ objetoAConteo_ briefDiario briefCacheado_ calentarBriefCacheSistema_ verifBriefCache_ calentarBriefCache verifBriefCache estadoCacheado_ calentarEstadoCacheSistema_ calentarEstadoCache verifEstadoCache contratoStatusReport_ _tendencia_ _contrapeso_ _verificacion_ _recContractual_ _cierreAccionMetrica_ briefDiarioSistema_ _briefHoyLineas_ _briefInsertarHoy_ briefDiarioCliente_ calentarCachesVoz instalarWarmVoz northStarSatori_ registrarNorteDelDia_ _puntoSerieAccion_ _serieNorte_ _nsLista_ _nsPivots_ northStarTenant_ _pivotsTenant_ _hzLimpio_ metricasValidas_ sembrarNorthStarSatori_ sembrarNorthStarSatori cargarNorthStarSatori cargarNorthStarVehemence migrarObjetivosNorthStar _respaldarObjetivos_ _verificarRespaldo_ resetObjetivosYNorthStar restaurarObjetivosDesdeBackup limpiarErroresFantasma_ limpiarErroresFantasma verVehemence truncar_ _diasDesde_ recomendacionDelDia_ _pivotMuerto_ _recNorthStar_ _recCandidatas_ clienteKpiEnAlerta_ _valorOperativoDeKpi_ _nsSerieHoy_ registrarRecomendacionDelDia marcarRecomendacion aprobacionDesdeRecomendacion recomendacionesAbiertas agendaSemana agendarEvento actualizarEvento cancelarEvento agendaRango registrarFeedback 

**19_conectores.js:** sincronizarVehemence mapearLibroLcTravel_ _importeMQ_ mapearMovimientosMesaquince_ mapearFreshaDam_ sembrarConectoresHallados _mapaConectores_ _vehemencePorCodigo_ _conectoresQueCorren_ _conectorUltSyncClave_ _staleEstado_ _decidirConector_ mapearOperacionesGenerico_ _monedaConector_ sincronizarCliente_ sincronizarConectorOperaciones_ _sellarUltSync_ sincronizarConectores altaConector encenderConector apagarConector probarConector estadoConectores sincronizarConectorVentas_ borrarFilasBatch_ agregarVentasPorMes_ probarDAM encenderDAM apagarDAM probarLC encenderLC apagarLC probarMQ encenderMQ apagarMQ 

**20_killswitch.js:** _sistemaPausado_ pausarSistema reanudarSistema estadoPausa smokeKill 

**21_backup.js:** _stampBackup_ _nombreSeguro_ _backupRootFolder_ _retencionSemanas_ _copiarSpreadsheet_ _ejecutarBackup_ backupSemanal backupAhora instalarTriggerBackup estadoTriggerBackup smokeBackup backupListar drillRestore _drillRestore_ 

**22_seguridad.js:** _ctxSistemaPermitido_ _ctxSistema_ _puertaOwner_ _esOwner_ _soloOwner_ _tieneGate_ _sinComentarios_ _srcDe_ _vencido_ _diasPara_ _expiraProp_ _secretoVencido_ _isoMasDias_ sembrarExpirySecretos _nuevoSecreto_ rotarSecretoVoz rotarSecretoOficina rotarSecretoCharlaExport _rotarSecreto_ _riesgoConfig_ _riesgoModo_ gateRiesgo_ securityScan_ securityScan 

**23_evals.js:** _correrEvalDet_ _evalEjecutar_ _evalComparar_ _evalEstructuraClasificacion_ correrEvals correrEvalsConApi 

**24_soul.js:** soulPrompt_ soulReglas_ 

**25_hilo.js:** _armarHilo_ _semaforoHilo_ hiloCliente _numeroConectorCliente_ _ultimoEspejo_ repararHilo espejarHilo espejarHiloCSV _parseCSVLinea_ _seccionHilo_ _recDesdeHilo_ _clienteConHiloCaliente_ 

**26_sato.js:** _charlaSheet_ _charlaQuien_ _charlaMd_ exportarCharlas satoCharla _satoClienteValido_ _satoDatos_ _satoPedido_ _satoContexto_ satoChat satoVoz diagVoz _satoTurnosHoy_ satoCierreSesion satoAplicarCierre 

**27_decisiones.js:** _decisionVisible_ _decisionNormalizar_ registrarDecision decisionesVigentes revertirDecision sembrarDecisionInicial 

**28_forge.js:** _forgeSlop_ _forgeTestGateDet_ _forgeTestGate_ promoverAgente demoverAgente _forgeEstadoUpsert_ _forgeAplicarPromocion_ agentesEstado 

**29_vigilancia.js:** _vigDias_ _vigUmbrales_ _vigJuzgar_ _vigObservar_ vigilarCliente_ vigilanciaCliente vigilanciaCorrida_ _vigResumenCacheado_ _vigLineasBrief_ _senalRetencionCtx_ _senalRetencion_ 

**30_correo.js:** _correoDebeCorrer_ _extractoCorreo_ _correoIgnorado_ _correoDecidirMensaje_ correoTriaje _correoEmail_ _correoIndiceRoster_ _correoClienteDeRemitente_ _correoClienteHoja_ correoCandidatosStaging correoConfirmarThread correoDescartarThread correoHilosDeCliente_ 

**31_admin.js:** _calendarioFiscalPlaceholders_ _adminNum_ _adminClave_ _adminResumir_ _adminLineasBrief_ _adminAbrir_ _adminHoja_ adminSetup altaFactura altaGasto altaCobro adminResumenMes adminRefrescarResumen_ _adminResumenCacheado_ 

**32_flota.js:** _flotaConsumoRO_ _flotaTelemetria_ _flotaSemaforo_ flotaEstado agenteDetalle moduloEdificio _avataresLabClaves_ _avatarUrlDrive_ seedAvataresLab seedAvataresLabPisar _seedAvataresLab_ 

**33_cartera.js:** _setColumnaCliente_ _setColumnasCliente_ _etapaValida_ _seedCartera_ seedCartera2026_08_11 seedCartera2026_08_11Aplicar carteraPipeline _diasEntreISO_ _carteraLineasBrief_ _carteraLineasFrio_ moverEtapaComercial _carteraFoco_ carteraProxAccion propuestaRegistrar propuestaFirmar _sellarContacto_ carteraRegistrarContacto carteraRecontacto _sumarDiasISO_ _carteraSnapshotTexto_ _carteraFolder_ carteraSnapshotMd carteraEncajeKairos 

**34_push.js:** _pushTelefono_ probarPushTelefono 

