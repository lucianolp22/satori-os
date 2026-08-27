# CAPABILITIES — Satori OS  (autogenerado)

> **NO editar a mano.** Se regenera con `bash _capabilities_gen.sh` (introspección de `src/`).
> Generado: 2026-08-27 16:01 · commit: e07ea3b

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
| `26_sato.js` | SATO EN LA FICHA (T1.4 · 28-jul-2026) | 18 |
| `27_decisiones.js` | DECISION LOG (TC-2 · F4b). Las decisiones de dirección, con su porqué | 6 |
| `28_forge.js` | FORGE (TC-9 · adenda 03-ago). Promoción laboratorio → producción de agentes | 8 |
| `29_vigilancia.js` | TC-11 · A5 · VIGILANCIA MULTI-SUPERFICIE (04-ago-2026) | 11 |
| `30_correo.js` | T7 · CORREO → TRIAJE A BANDEJA (04-ago-2026) | 13 |
| `31_admin.js` | TC-7 · F4a · MOTOR DE ADMINISTRACIÓN PROPIA (04-ago-2026) | 14 |
| `32_flota.js` | EDIFICIO SATORI · lectores de la FLOTA PROPIA (10-ago-2026) | 11 |
| `33_cartera.js` | PIPELINE COMERCIAL (E1, 11-ago-2026) | 23 |
| `34_push.js` | Canal de push al teléfono de Luciano (proactividad, decisión 26-ago) | 2 |
| `35_identidad.js` | GENERADO. No editar a mano | 0 |
| `36_sato_ubicuo.js` | F7 · Sato Ubicuo: el dock persistente del header | 7 |

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

## Identidad de Sato (slim)

Fuente única: `docs/SATO-IDENTIDAD.md` → `src/35_identidad.js` (generado con `bash scripts/_identidad_gen.sh`).
Override en caliente: pestaña `_sato_identidad` del MAESTRO. Loader: `_cargarIdentidadSato_()` · `cargar_identidad()` en `agent.py` (TTL 60 s por mtime).

| § | Sección | chars |
|---|---|---:|
| §1 | · Propósito primario | 1238 |
| §2 | · Personalidad y voz | 1082 |
| §3 | · Invariantes SOUL (S1-S8) — copia textual, no parafrasear | 1085 |
| §4 | · Reglas numeradas N4-N9 | 1322 |
| §5 | · ESCRITURA vs HABLA (A1 · A3 · A4 · T1-B) | 2150 |
| §6 | · Aislamiento de cliente (T1.8) — es ley, no preferencia | 1290 |
| §7 | · Anti-injection | 829 |
| §8 | · Anti-drift (checkpoint F13) | 1125 |

Total:    11580 chars (~2895 tok estimados por el gate de `_systemBloques_`).

## Invariantes SOUL (S1-S8)

- **S1** — Mock jamás: si no hay dato real, se dice que no hay dato. Nunca se inventa, ni de ejemplo, ni "para ilustrar".
- **S2** — Las cifras van exactas y en números. Agrupar para hablar no es redondear; estimar no es medir.
- **S3** — Honestidad de fuentes: un dato con UNA fuente se llama "1 fuente", nunca "verificado". Dos fuentes que se contradicen se muestran en conflicto, no se promedian.
- **S4** — Default-deny: lo que no está explícitamente permitido, se bloquea o se escala. Ante la duda, no se avanza.
- **S5** — Toda escritura o acción disparada por voz se repite en voz alta y espera confirmación verbal explícita antes de ejecutarse.
- **S6** — Frontera de confianza: el modelo propone TEXTO; ningún valor entra al sistema desde texto libre sin parseo y validación contra un vocabulario cerrado.
- **S7** — Escalá en vez de adivinar: si no se entiende o falta info, se marca con confianza baja y se deriva al humano.
- **S8** — Sin relleno ni adulación: afirmativo, breve, al grano. No se narra una acción que no está ocurriendo.

## Tools de voz (@function_tool de agent.py)

- `estado`
- `brief`
- `vehemence`
- `cliente`
- `cerebro`
- `sgic_consulta`
- `accion`
- `capturar`
- `preparar_reunion`
- `aprobaciones`
- `decidir_aprobacion`
- `disparar_agente`
- `crear_tarea`
- `encargar`
- `encargos_listos`
- `oficina_estado`
- `oficina_brief`
- `oficina_aprobaciones`
- `oficina_decidir`

## Fuentes de Sato in-GAS (SATO_FUENTES)

- `ventas` — ventas del conector vivo (mes×canal, órdenes, AOV)
- `operativos` — movimientos operativos cargados (concepto, valor, fuente)
- `kpis` — KPIs del cliente con objetivo y alerta
- `objetivos` — objetivos/North Star del cliente
- `aprobaciones` — aprobaciones del cliente
- `reglas` — reglas automáticas del cliente
- `umbrales` — umbrales de autonomía
- `costos` — consumo de API del cliente
- `hilo` — Hilo de trabajo: plan vs real vs desviado vs pendiente
- `cerebro` — memoria/grafo del cliente (estado materializado)
- `sistema` — estado vigente de TODO Satori OS (cartera, salud, North Star)
- `cartera` — lista de TODOS los clientes con rubro, estado y responsable
- `historial` — lo YA hablado con Luciano sobre este cliente (más atrás de los últimos turnos) — usalo para no repetir
- `descartado` — caminos YA descartados y decisiones cerradas (pivots del North Star + checklist ya hecho) — NUNCA re-proponer esto
- `decisiones` — decisiones de dirección VIGENTES con su porqué y su fecha — el marco dentro del cual se piensa, no re-abrirlo sin motivo nuevo

## Endpoints vivos (gateados con _soloOwner_)

Total declarados en `ENDPOINTS_UI`: 217

Partición completa (gateadas / declaradas / exentas con motivo): `bash scripts/_scan_endpoints.sh` y el bloque D31 del arnés.

## Actividad de los últimos 14 días

- e07ea3b [B1] promote /exec: dock Sato Ubicuo visible (CAPABILITIES regen)
- 0f1752c merge B1: Sato Ubicuo visible en /exec
- 154bd1b [B1] Sato Ubicuo visible: z-index 30 -> 230 (estaba debajo de #centro) + rotulo que sigue al tenant
- 9fe2140 fix: --check con timeout de 15s (el regen frio del layout tarda ~8s y daba falso 'sin respuesta')
- 36b4670 [F14] Cierre: RUNBOOK de optimizacion de tokens + handoff + cross-reference
- 5ce3665 [F7b] Widget Sato Ubicuo: dock persistente del header
- c0b5ae8 [F7a+F7c+F13+F10-a] Backend Sato Ubicuo, polling, checkpoint anti-drift y Cerebro vivo
- e878e52 [F11+F12+F-Diseno-Patrones] Los tres documentos del encargo
- c991cc3 [F5+F6] Consejo GO + motor Claude cableado (flag apagado por default)
- 62929d5 [F4] CAPABILITIES con 6 bloques AUTO + drift-checker
- b314ef0 [F3] Identidad de Sato editable en caliente, misma fuente para voz y GAS
- 665cbbe PC-A/PC-D del encargo POST-OLAS: scan de endpoints corrible solo + nombre que espera PC-D
- b162ef4 HANDOFF maestro: cross-reference al cierre de las Olas 0-3
- 10e67f6 [OLAS 2-3] R6 baseline de latencia + R8/R9/R10/R11/R12. R14 no se ejecuta, con motivo.
- 10529d3 [OLA 1] R4 el grafo canta cuando falla + R13 threading + R7 higiene de continuidad
- c38cca0 [OLA 0] R1 instalador blindado + R3 asserts + R5 plist versionado. RETRACTO P0-2.
- 28ed7ba PLAN-REMEDIACION: stress test + pre-mortem + purga del Bloque A
- d2d3dc7 merge feat/sato-viviente: Bloque A del encargo SATO VIVIENTE (F0,F1,F2a-c)
- a7de35a HANDOFF SATO VIVIENTE: cierre parcial del Bloque A (PC-2 rojo por el 2do reload)
- 5f93d5d [SATO-VIVIENTE] pendientes-post-E2: por que PC-2 dio rojo y que queda esperando
- 9d8268c [SATO-VIVIENTE F2] Cerebro viviente: launchd corregido + salud del grafo + inventario livingmind
- b0017bf [SATO-VIVIENTE F0+F1] Auditoria consumo Claude Max + auditoria estatica del caching TC-10
- 9c17f68 HANDOFF: /exec @57 — E1 + E2 en prod sin el gate del editor
- 39acc42 promote /exec: CAPABILITIES regen + HANDOFF al 27-08-2026
- 77ca402 HANDOFF: excepción declarada ANTES del promote de E2 (gate del editor salteado)
- 608a0ff HANDOFF: E2 a /dev (endoso de Cowork), promote bloqueado hasta selfTestTramo6
- b852d0d [CAPACIDADES-SATO E2] Proactividad: conectores stale + push 07:00 + anti-brief-estático + saludo
- 8ed2150 HANDOFF: /exec @56 — E1 en prod con los dos gates salteados (verde con asterisco + qué falta)
- 2199c6d promote /exec: CAPABILITIES regen + HANDOFF al 27-08-2026
- 88142b7 [CAPACIDADES-SATO E1] Lazo cerrado del encargo + E1-bis fix 429 de ntfy

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

**26_sato.js:** _identidadSheet_ _cargarIdentidadSato_ sembrarIdentidadSato _charlaSheet_ _charlaQuien_ _charlaMd_ exportarCharlas satoCharla _satoClienteValido_ _satoDatos_ _satoPedido_ _satoContexto_ satoChat satoVoz diagVoz _satoTurnosHoy_ satoCierreSesion satoAplicarCierre 

**27_decisiones.js:** _decisionVisible_ _decisionNormalizar_ registrarDecision decisionesVigentes revertirDecision sembrarDecisionInicial 

**28_forge.js:** _forgeSlop_ _forgeTestGateDet_ _forgeTestGate_ promoverAgente demoverAgente _forgeEstadoUpsert_ _forgeAplicarPromocion_ agentesEstado 

**29_vigilancia.js:** _vigDias_ _vigUmbrales_ _vigJuzgar_ _vigObservar_ vigilarCliente_ vigilanciaCliente vigilanciaCorrida_ _vigResumenCacheado_ _vigLineasBrief_ _senalRetencionCtx_ _senalRetencion_ 

**30_correo.js:** _correoDebeCorrer_ _extractoCorreo_ _correoIgnorado_ _correoDecidirMensaje_ correoTriaje _correoEmail_ _correoIndiceRoster_ _correoClienteDeRemitente_ _correoClienteHoja_ correoCandidatosStaging correoConfirmarThread correoDescartarThread correoHilosDeCliente_ 

**31_admin.js:** _calendarioFiscalPlaceholders_ _adminNum_ _adminClave_ _adminResumir_ _adminLineasBrief_ _adminAbrir_ _adminHoja_ adminSetup altaFactura altaGasto altaCobro adminResumenMes adminRefrescarResumen_ _adminResumenCacheado_ 

**32_flota.js:** _flotaConsumoRO_ _flotaTelemetria_ _flotaSemaforo_ flotaEstado agenteDetalle moduloEdificio _avataresLabClaves_ _avatarUrlDrive_ seedAvataresLab seedAvataresLabPisar _seedAvataresLab_ 

**33_cartera.js:** _setColumnaCliente_ _setColumnasCliente_ _etapaValida_ _seedCartera_ seedCartera2026_08_11 seedCartera2026_08_11Aplicar carteraPipeline _diasEntreISO_ _carteraLineasBrief_ _carteraLineasFrio_ moverEtapaComercial _carteraFoco_ carteraProxAccion propuestaRegistrar propuestaFirmar _sellarContacto_ carteraRegistrarContacto carteraRecontacto _sumarDiasISO_ _carteraSnapshotTexto_ _carteraFolder_ carteraSnapshotMd carteraEncajeKairos 

**34_push.js:** _pushTelefono_ probarPushTelefono 

**36_sato_ubicuo.js:** _ubicuoOn_ _ubicuoTenant_ _ubicuoCharla_ charlaCola charlaEnviarTexto charlaPendientes guardarTurnoCharla 

