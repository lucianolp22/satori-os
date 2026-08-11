/**
 * 22_seguridad.js — MÓDULO S (T3 · Bastión lidera). Seguridad del motor.
 *
 * Cuatro piezas, un solo archivo (blast radius chico, revisión fácil):
 *   S1  _soloOwner_()      — gate de identidad en TODO endpoint llamable desde el cliente.
 *   S2  expiry de secretos — VOZ_SECRET_EXPIRA / OFICINA_SECRET_EXPIRA (doPost fail-closed).
 *   S3  gateRiesgo_()      — matriz de riesgo en Config (`riesgo_*`), un solo choke point.
 *   S4  securityScan_()    — chequeo 7 de correrSalud (estilo selfTest, 0 API).
 *
 * Nada acá abre Sheets de clientes salvo el scan en modo full (cuota).
 */

// ═══ S1 — gate de identidad (la puerta lateral de google.script.run) ═════════
//
// PROBLEMA: doGet ya está gateado (08_webapp.js, PURGA #4), pero las funciones que el
// front invoca por google.script.run son endpoints del proyecto: no re-chequeaban NADA.
// Defensa en profundidad: el gate va SOBRE la función real, no sobre un wrapper (un
// wrapper deja la función original igual de llamable → seguridad de cartón).
//
// CONTEXTO DE SISTEMA: 9 de esos endpoints los llaman TAMBIÉN doPost (voz, autenticada
// por secreto propio) y los triggers (corren sin usuario activo). Gatearlos a secas los
// rompería. Solución: cada entrada de sistema declara su contexto con _ctxSistema_() en
// su PRIMERA línea (doPost: DESPUÉS de validar el secreto — un request sin auth jamás
// obtiene contexto de sistema). El flag es por-ejecución: GAS levanta un contexto V8
// nuevo por invocación, así que no hay fuga entre ejecuciones ni entre usuarios.

var SATORI_CTX_SISTEMA = false;

/**
 * Criterio PURO de contexto de sistema (M1a, purga #1). ¿Esta ejecución CALIFICA como de
 * sistema, dado el email del usuario activo y el owner? Solo dos identidades lo hacen:
 *   · who === ''      → trigger instalado (corre sin usuario activo) o doPost de voz (un POST
 *                        externo no trae usuario activo; llega acá DESPUÉS de validar el secreto).
 *   · who === owner   → el owner corriendo un entry point (editor, o trigger que corre como él).
 * Un usuario REAL no-owner que lograra invocar un entry point de sistema por RPC cae afuera →
 * NO obtiene el flag → los _soloOwner_ de aguas adentro lo cortan. Pura para poder aserirla sin
 * tocar Session ni Properties (ver D19b4).
 *
 * PURGA X1 (24-jul): fail-closed sin OWNER_EMAIL, MISMO criterio que _puertaOwner_. Sin la
 * property no hay contra qué comparar: `who===''` daba contexto de sistema a ciegas, y en un
 * proyecto sin configurar eso es la puerta abierta (doGet ya cierra por PURGA #4; esta vía no).
 * No rompe prod (OWNER_EMAIL está puesto); en un proyecto virgen nada corre igual — ni el owner.
 * @param {string} who   email del usuario activo ('' si GAS no lo entrega)
 * @param {string} owner valor de la Script Property OWNER_EMAIL
 */
function _ctxSistemaPermitido_(who, owner) {
  who = String(who == null ? '' : who);
  owner = String(owner == null ? '' : owner);
  if (!owner) return false;              // sin OWNER_EMAIL, nadie — ni el sistema (coherente con _puertaOwner_)
  return who === '' || who === owner;
}

/**
 * Declara que ESTA ejecución es de sistema (trigger instalado, o doPost ya autenticado):
 * _soloOwner_ deja pasar. Va en la primera línea del entry point, nunca aguas adentro.
 *
 * M1a (purga #1): ya NO concede a ciegas. Solo enciende el flag si la ejecución NO tiene un
 * usuario distinto del owner (_ctxSistemaPermitido_). No rompe: un trigger real corre sin
 * usuario activo (email '') y el owner en el editor tiene email===owner; doPost llega acá
 * DESPUÉS de validar el secreto y sin usuario activo (email '') → sigue funcionando. Verificado
 * en ESTE deployment que bajo un trigger instalado getActiveUser().getEmail() da '' o el owner,
 * nunca un tercero (eyeball de voz+triggers, 21-jul). Devuelve el veredicto por si algún llamador
 * futuro lo quiere leer (hoy los entry points lo invocan como statement).
 */
function _ctxSistema_() {
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (_e) { who = ''; }
  var owner = '';
  try { owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || ''; } catch (_p) { owner = ''; }
  if (_ctxSistemaPermitido_(who, owner)) { SATORI_CTX_SISTEMA = true; return true; }
  try { Logger.log('_ctxSistema_ NEGADO: who=' + who); } catch (_l) {}
  return false;
}

/**
 * Criterio de puerta PURO (sin Session ni Properties) — así se puede aserir sin tocar
 * la property real: un test que escriba OWNER_EMAIL y falle a mitad dejaría a Luciano
 * afuera de su propio CM. Fail-closed: sin owner configurado no entra NADIE.
 * @param {string} who   email del usuario activo ('' si GAS no lo entrega)
 * @param {string} owner valor de la Script Property OWNER_EMAIL
 */
function _puertaOwner_(who, owner) {
  who = String(who == null ? '' : who);
  owner = String(owner == null ? '' : owner);
  if (!owner) return false;          // PURGA #4: sin OWNER_EMAIL, nadie entra
  return who === owner;
}

/**
 * Cache POR EJECUCIÓN del veredicto de identidad. GAS levanta un contexto V8 nuevo por
 * invocación, así que no hay fuga entre ejecuciones ni entre usuarios (mismo argumento que
 * SATORI_CTX_SISTEMA), y dentro de UNA ejecución la identidad del usuario activo no cambia.
 *
 * POR QUÉ (X4, 03-ago): al gatear 68 funciones más, un flujo del CM o del selfTest pasa por
 * `_soloOwner_` decenas o cientos de veces. Sin cache, cada paso son DOS llamadas a servicio
 * (Session + Properties): latencia y cuota que no compran nada, porque la respuesta es siempre
 * la misma. El camino de sistema ya salía gratis (SATORI_CTX_SISTEMA corta antes); esto empareja
 * el camino del owner. `null` = todavía no se preguntó.
 */
var _OWNER_OK_ = null;

/** ¿El usuario activo es el owner? Mismo criterio que doGet (una sola fuente). */
function _esOwner_() {
  if (_OWNER_OK_ !== null) return _OWNER_OK_;
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (_e) { who = ''; }
  var owner = '';
  try { owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || ''; } catch (_p) { owner = ''; }
  _OWNER_OK_ = _puertaOwner_(who, owner);
  return _OWNER_OK_;
}

/**
 * Gate de los endpoints client-callable. TIRA si no pasa (google.script.run lo entrega
 * al withFailureHandler del front, que muestra el toast; no hay retorno-silencioso que
 * el llamador pueda confundir con un dato vacío).
 * @param {string} nombre  nombre del endpoint (para el log de diagnóstico)
 */
function _soloOwner_(nombre) {
  if (SATORI_CTX_SISTEMA) return true;
  if (_esOwner_()) return true;
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (_e) {}
  try { Logger.log('no_autorizado: ' + (nombre || '?') + ' who=' + (who || '(vacío)')); } catch (_lg) {}
  throw new Error('no_autorizado');
}

/**
 * Inventario de funciones que DEBEN llevar `_soloOwner_`. Lo consume securityScan_ y el assert
 * de cobertura de D19: si alguien agrega una y no la gatea, el scan lo canta.
 * MANTENERLA A MANO al agregar una función nueva — el assert audita contra el código, pero no
 * puede adivinar lo que nadie declaró.
 *
 * ⚠ INVARIANTE AMPLIADO (purga X2, 24-jul). Hasta hoy la lista significaba "lo que el front
 * invoca por google.script.run / el puente de Akasha". Ahora significa "lo que tiene que estar
 * gateado", que es un superconjunto: en GAS **toda** función top-level es invocable por
 * `google.script.run` desde cualquiera que alcance la webapp (y `appsscript.json` tiene
 * access:DOMAIN), así que "el front no la llama" NUNCA fue una defensa. El bloque X2 de abajo
 * son funciones que el front NO llama y que igual deben estar cerradas.
 * Los dos consumidores (D19c y securityScan_) solo verifican presencia del gate → la ampliación
 * es aditiva para ellos. Si alguien agrega un consumidor que asuma "esto lo llama el front",
 * ese consumidor está mal: filtrar acá por sección, no asumir.
 */
var ENDPOINTS_UI = [
  // 08_webapp.js
  'setPrefUI', 'prefsUI', 'cerebroGrafo', 'cerebroNodo', 'estadoSistema', 'datosHoy', 'listaClientes',
  'datosCliente', 'fichaCliente', 'checklistCliente', 'checklistMarcar', 'checklistAgregar', 'briefCliente',
  'satoChat', 'satoCharla', 'satoVoz', 'satoCierreSesion', 'satoAplicarCierre',
  'estadoAgentes', 'bootUniverso', 'bootResto', 'bootUnico', 'estadoSalud',
  'dispararAgenteUI', 'resolverAprobacionUI', 'metricasValidasUI', 'asignarMetricaUI',
  'tableroTareas', 'crearTarea', 'crearTareaQuick', 'moverTarea',
  // 08_webapp.js — BLOQUE 4 F3 (05-ago): panel de detalle/edición de tarea + notas de proyecto
  'detalleTarea', 'guardarTarea', 'guardarNotaProyecto', 'listaProyectos',
  // 08_webapp.js — A.1 (07-ago): alta de Proyecto desde el CM (espina Cliente→Proyecto→Tarea)
  'crearProyecto',
  // 08_webapp.js — A.2 (07-ago): archivar tareas (columna booleana, ortogonal a estado)
  'archivarTarea', 'desarchivarTarea', 'tareasArchivadas',
  // 18_direccion.js
  'agendaRango', 'recomendacionesAbiertas', 'marcarRecomendacion', 'registrarFeedback',
  'aprobacionDesdeRecomendacion',
  // 18_direccion.js — Fix D 27-jul (calendario funcional): alta/edición/cancelación + la vista
  // semanal que ya era top-level (invariante X2: top-level ⇒ RPC-invocable ⇒ gateada).
  'agendarEvento', 'actualizarEvento', 'cancelarEvento', 'agendaSemana',
  // 25_hilo.js (TC-W1)
  'hiloCliente',
  // 29_vigilancia.js (TC-11 · A5) — semáforo multi-superficie de la Ficha 360
  'vigilanciaCliente',
  // 17_bandeja.js
  'capturar',
  // ── purga X2 (24-jul): NO las llama el front, pero son top-level ⇒ invocables por RPC.
  // 11_aprobaciones.js — el motor de decisión humana entero
  'crearAprobacion', 'resolverAprobacion', 'ejecutarAprobada', 'crearReglaDesdeExcepcion',
  // 18_direccion.js — migración/reset/restore de objetivos (destructivas, multi-tenant)
  'migrarObjetivosNorthStar', 'resetObjetivosYNorthStar', 'restaurarObjetivosDesdeBackup',
  // 07_util.js — Config gobierna el motor (flags de conectores, umbrales)
  'setConfig',
  // 05_costos.js — revierte la anonimización (PII en claro)
  'desanonimizar',
  // 20_killswitch.js — congelar/levantar el sistema entero
  'pausarSistema', 'reanudarSistema',
  // 19_conectores.js — gateadas en la purga del 23-jul; faltaba el alta en el registro.
  // `altaConector` era la excepción: se le puso el gate en X2 (sus tres hermanas ya lo tenían).
  'altaConector', 'encenderConector', 'apagarConector', 'sembrarConectoresHallados',
  'probarConector', 'estadoConectores',
  // 32_flota.js (10-ago) — EDIFICIO. Los tres son LECTORES puros de la flota propia de Satori
  // (ni una hoja de tenant); `moduloEdificio` sirve el módulo 3D lazy. Alta en el MISMO commit
  // que su definición, por la regla anti-drift.
  'flotaEstado', 'agenteDetalle', 'moduloEdificio',

  // ── X4 (03-ago, TC-1): las 68 top-level que MUTAN estado o CONSUMEN servicios y seguían
  // sin puerta. Criterio aplicado (re-derivado contra el repo real, script `_x4_gates.js`):
  // escribe Sheets/Properties/Drive/Cache · instala triggers · manda mail · gasta API paga ·
  // muta estado global en memoria. Los 7 entry points de sistema llevan el gate DESPUÉS de
  // `_ctxSistema_()` (antes rompería los triggers).
  //
  // FUERA de X4 a propósito (46) — si alguien las gatea después, que sea con decisión, no por inercia:
  //   · no explotables por RPC (reciben un Sheet/Spreadsheet/función, o devuelven un Spreadsheet:
  //     `google.script.run` no puede construir ni serializar esos argumentos):
  //     ensureSheet · appendFila · leerTabla · protegerSheet · aplicarFormatoTexto · conLock ·
  //     nextId · getMaestro · abrirCliente
  //   · puras sin I/O: ping · anonimizar · hace · ahoraISO · hoyISO · mesISO · aFechaISO ·
  //     sanitizarCelda · esVencida · parseRecurrencia · parseQuickAdd
  //   · puerta propia: doGet (owner) · doPost (secreto fail-closed)
  //   · wrappers no-arg que delegan en funciones YA gateadas (decisión 27-jul, comentada en
  //     19_conectores.js): probarDAM/encenderDAM/apagarDAM · …LC · …MQ
  // (X4b ya NO está acá: las 16 lecturas se gatearon en TC-1b — ver el bloque de abajo.)
  'setup', 'repararFormatosTexto',                                              // 02_setup.js
  'crearCliente', 'cargaInicialClientes',                                       // 03_cliente.js
  'syncMaestro',                                                                // 04_sync.js
  'llamadaAPI', 'logCostoCliente', 'consolidarCostosMes',                       // 05_costos.js
  'probarAlertaEmail', 'probarBriefPush', 'crearAviso', 'corridaDiaria',        // 06_avisos.js
  'encolarVigiaClientesActivos', 'detectarVencimientos', 'detectarTareasEstancadas',
  'detectarProyectosSinMovimiento', 'expirarAprobaciones', 'invalidarMapaPC', 'instalarTriggers',
  'selfTest', 'selfTestF2', 'debugE21', 'limpiarTodoTest', 'borrarFilasDonde',  // 09_selftest.js
  'purgaAuditoria',                                                             // auditoría read-only de la purga (11-ago)
  'selfTestTramo', 'selfTestVeredicto',                                         // tramos (04-ago)
  'selfTestTramo2', 'selfTestTramo3', 'selfTestTramo4', 'selfTestTramo5',       // wrappers sin args (desplegable del editor)
  'bootstrap',                                                                  // 10_bootstrap.js
  'expirarPendientes',                                                          // 11_aprobaciones.js
  'encolar', 'drenarCola', 'verifArchivoCola', 'archivarColaViejaREAL',         // 12_cola.js
  'encolarAgente',                                                              // 13_agentes.js
  'correrDirector', 'chequeoLivianoDirector', 'instalarTriggerDirector',        // 14_director.js
  'upsertNodo', 'upsertArista', 'logEvento', 'comprimirMemoriaFria',            // 15_cerebro.js
  'comprimirMemoria', 'materializarEstado', 'repararCerebro', 'migrarCerebroSchema',
  'cargarObjetivo', 'cargarObjetivosPiloto', 'sembrarDatosEjemplo',
  'correrSalud',                                                                // 16_salud.js
  'clasificarBandeja', 'instalarTriggerBandeja',                                // 17_bandeja.js
  'correoTriaje',                                                               // 30_correo.js (T7)
  'calentarBriefCache', 'calentarEstadoCache', 'sembrarNorthStarSatori',        // 18_direccion.js
  'cargarNorthStarSatori', 'cargarNorthStarVehemence', 'limpiarErroresFantasma',
  'registrarRecomendacionDelDia',
  'sincronizarVehemence', 'sincronizarConectores',                              // 19_conectores.js
  'smokeKill',                                                                  // 20_killswitch.js
  'backupSemanal', 'backupAhora', 'instalarTriggerBackup', 'smokeBackup',       // 21_backup.js
  'backupListar', 'drillRestore',
  'securityScan',                                                               // 22_seguridad.js
  'correrEvals', 'correrEvalsConApi',                                           // 23_evals.js
  'diagVoz',                                                                    // 26_sato.js
  'adminSetup', 'altaFactura', 'altaGasto', 'altaCobro', 'adminResumenMes',     // 31_admin.js (TC-7 · F4a)

  // ── X4b (03-ago, TC-1b): las 16 de LECTURA. Devuelven datos del negocio con argumentos
  // serializables ⇒ explotables por RPC, a diferencia de `leerTabla`/`getMaestro` (que reciben o
  // devuelven objetos de Spreadsheet y por eso siguen exentas). Verificado antes de gatear, por
  // alcanzabilidad: ninguna corre en un camino sin contexto de sistema — los únicos caminos sin
  // contexto son `doPost` antes de cada `_ctxSistema_()` y `doGet` antes de `_puertaOwner_`, y su
  // cierre transitivo (23 funciones) no toca ninguna de éstas. Misma precaución que salvó a
  // `vozRechazo_` en TC-1.
  'urlMaestro',                                                                 // 02_setup.js
  'mapaProyectoCliente', 'clienteDeProyecto',                                   // 06_avisos.js
  'getConfig',                                                                  // 07_util.js
  'consumoApiCliente', 'tareasActivasOrdenadas',                                // 08_webapp.js
  'clasificarAccion', 'umbralPara',                                             // 11_aprobaciones.js
  'leerEstado',                                                                 // 15_cerebro.js
  'estadoVigente', 'briefDiario', 'verifBriefCache', 'verifEstadoCache',        // 18_direccion.js
  'verVehemence',
  'estadoPausa',                                                                // 20_killswitch.js
  'estadoTriggerBackup',                                                        // 21_backup.js

  // ── TC-2 (03-ago) · decision log. `registrarDecision`/`revertirDecision`/`sembrarDecisionInicial`
  // escriben el marco de dirección; `decisionesVigentes` lo lee (y su filtro de alcance ES el
  // aislamiento entre tenants, así que abrirlo sería peor que una lectura cualquiera).
  'registrarDecision', 'decisionesVigentes', 'revertirDecision', 'sembrarDecisionInicial',  // 27_decisiones.js

  // ── TC-5 (03-ago) · export de charlas al Hilo. Read-only, pero devuelve TODO lo hablado:
  // es el endpoint más sensible del sistema en términos de contenido.
  'exportarCharlas', 'rotarSecretoCharlaExport',                                // 26_sato.js / 22_seguridad.js

  // ── TC-9 (03-ago) · Forge. `promoverAgente` NO enciende nada (crea la aprobación), pero
  // `demoverAgente` SÍ muta el estado al instante: apagar es libre, no anónimo.
  'promoverAgente', 'demoverAgente', 'agentesEstado',                           // 28_forge.js

  // ── TC-3 (03-ago) · actividad inter-agentes: read-only, pero cruza TODOS los tenants (es la
  // vista de sistema del CM), así que la puerta importa más, no menos.
  'datosActividadAgentes'                                                       // 08_webapp.js
];

/**
 * Entry points de SISTEMA: los únicos que declaran `_ctxSistema_()`. Lista-contrato (X4, 03-ago).
 *
 * ⚠ INVARIANTE: en todos ellos el `_soloOwner_` va **DESPUÉS** de `_ctxSistema_()`. Al revés
 * rompe los triggers: una ejecución sin usuario activo no tiene el flag todavía, así que el gate
 * tiraría `no_autorizado` y `corridaDiaria`/`drenarCola`/`backupSemanal` morirían de noche, sin
 * nadie mirando. El orden lo asera D31b (selfTest) y el harness offline.
 * ⚠ INVARIANTE 2: todo handler de `ScriptApp.newTrigger('X')` tiene que estar en esta lista —
 * un trigger apuntando a una función que no declara contexto es la misma rotura. Lo asera el harness.
 * Agregar un entry point de sistema = agregarlo acá en el MISMO commit.
 */
var ENTRY_POINTS_SISTEMA = [
  'corridaDiaria', 'drenarCola', 'sincronizarConectores', 'clasificarBandeja',
  'backupSemanal', 'chequeoLivianoDirector', 'correrDirector',
  'correoTriaje'   // T7 (04-ago): declara `_ctxSistema_()` ⇒ va acá por la primera invariante,
                   // aunque hoy no tenga trigger propio (lo llama `corridaDiaria`).
];

/**
 * ¿La función `nombre` tiene el gate puesto? Introspección por Function.toString() (V8).
 * Devuelve 'ok' | 'sin_gate' | 'no_existe' | 'no_verificable' (si el runtime no deja leer
 * el source: se reporta como tal, JAMÁS como ok — un scan que miente es peor que ninguno).
 */
function _tieneGate_(nombre) {
  var src = _srcDe_(nombre);
  if (src === null) return 'no_existe';
  if (src === '') return 'no_verificable';
  // La LLAMADA, no la palabra: `Function.toString()` conserva los comentarios, así que un
  // `// … atraviesa los _soloOwner_ de los endpoints …` daba 'ok' sin puerta ninguna (verde
  // falso hallado el 03-ago con `doPost`). Se miden llamadas sobre el source sin comentarios.
  return /_soloOwner_\s*\(/.test(_sinComentarios_(src)) ? 'ok' : 'sin_gate';
}

/**
 * Quita comentarios de un fragmento de código. Los strings se neutralizan PRIMERO para que un
 * `'https://…'` no se coma media línea. Fail-closed a propósito: si esta limpieza se pasa de
 * agresiva, el gate se reporta ausente (rojo revisable), nunca presente de más.
 */
function _sinComentarios_(src) {
  return String(src == null ? '' : src)
    .replace(/'(\\.|[^'\\])*'/g, "''")
    .replace(/"(\\.|[^"\\])*"/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Source de una función top-level por nombre. `null` = no existe · `''` = existe pero el runtime
 * no deja leerla (nativa o toString bloqueado). Una sola implementación de esta resolución frágil:
 * la usan `_tieneGate_` (scan + D19c) y D31b (orden ctx→gate). Duplicarla sería el próximo drift.
 */
function _srcDe_(nombre) {
  if (!/^[A-Za-z_$][\w$]*$/.test(String(nombre || ''))) return '';  // el eval de abajo solo ve identificadores
  var f;
  // Tres vías: el global de V8, el `this` del scope global, y eval como último recurso.
  // GAS resuelve las declaraciones top-level de formas distintas según runtime/contexto;
  // si NINGUNA funciona se reporta como tal — jamás se asume que está bien.
  try { if (typeof globalThis !== 'undefined' && globalThis) f = globalThis[nombre]; } catch (_g) {}
  if (typeof f !== 'function') { try { f = this[nombre]; } catch (_t) {} }
  if (typeof f !== 'function') { try { f = eval(nombre); } catch (_ev) { return null; } }
  if (typeof f !== 'function') return null;
  var src = '';
  try { src = String(f); } catch (_s) { return ''; }
  if (!src || src.indexOf('[native code]') >= 0) return '';
  return src;
}

// ═══ S2 — credencial con vencimiento ════════════════════════════════════════
//
// DECISIÓN EXPLÍCITA (encargo T3-S2): **property ausente o vacía = NO expira**.
// Compat con lo vigente: el día del deploy la voz sigue andando aunque nadie haya
// sembrado la fecha. El scan de S4 lo marca `warn` (no `crit`) para que no se olvide.
// Vencida = fail-closed, mismo camino que `unauthorized`.

var PROP_VOZ_EXPIRA = 'VOZ_SECRET_EXPIRA';
var PROP_OFICINA_EXPIRA = 'OFICINA_SECRET_EXPIRA';
// TC-5: el export de charlas tiene credencial propia (least privilege). NO se suma a las
// properties CRÍTICAS del scan a propósito: es opt-in — si no está sembrada, la exportación por
// HTTP simplemente no existe (fail-closed) y eso NO es una falla del sistema que deba cantar crit.
var PROP_CHARLA_EXPIRA = 'CHARLA_EXPORT_EXPIRA';
var SECRETO_VIDA_DIAS = 90;

/** Puro: ¿la fecha ISO ya pasó respecto de `ahoraMs`? '' / basura → false (no expira). */
function _vencido_(iso, ahoraMs) {
  var s = String(iso == null ? '' : iso).trim();
  if (!s) return false;
  var t = Date.parse(s);
  if (!isFinite(t)) return false;      // fecha ilegible: NO bloquea (el scan la marca)
  return t < (ahoraMs == null ? Date.now() : ahoraMs);
}

/** Puro: días que faltan para `iso` (negativo si venció). null si no hay fecha usable. */
function _diasPara_(iso, ahoraMs) {
  var s = String(iso == null ? '' : iso).trim();
  if (!s) return null;
  var t = Date.parse(s);
  if (!isFinite(t)) return null;
  return Math.floor((t - (ahoraMs == null ? Date.now() : ahoraMs)) / 864e5);
}

/** Lee una property de vencimiento ('' si falta). */
function _expiraProp_(prop) {
  try { return PropertiesService.getScriptProperties().getProperty(prop) || ''; }
  catch (_e) { return ''; }
}

/** ¿El secreto identificado por `prop` está vencido? (sin fecha = no). */
function _secretoVencido_(prop) { return _vencido_(_expiraProp_(prop)); }

/** ISO (fecha, sin hora) a N días de hoy. */
function _isoMasDias_(dias, base) {
  var d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + (dias || 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Siembra las dos fechas de vencimiento a +90 días SI faltan (idempotente, no pisa).
 * Correr una vez desde el editor. No toca los secretos: solo su fecha.
 */
function sembrarExpirySecretos() {
  _soloOwner_('sembrarExpirySecretos');   // purga integral 23-jul: muta Script Properties de secretos
  var props = PropertiesService.getScriptProperties();
  var out = {};
  [PROP_VOZ_EXPIRA, PROP_OFICINA_EXPIRA].forEach(function (p) {
    var actual = props.getProperty(p) || '';
    if (actual) { out[p] = actual + ' (ya estaba)'; return; }
    var iso = _isoMasDias_(SECRETO_VIDA_DIAS);
    props.setProperty(p, iso);
    out[p] = iso;
  });
  Logger.log('sembrarExpirySecretos: ' + JSON.stringify(out));
  return out;
}

/**
 * Secreto nuevo, 48 chars hex (~192 bits). M1b (purga #2): fuente FUERTE — `Utilities.getUuid()`
 * es un UUID v4 (aleatoriedad criptográfica del runtime), no `Math.random()` (PRNG predecible,
 * inaceptable para un módulo de seguridad). Dos UUIDs sin guiones = 64 hex → recortado a 48.
 * Sin dependencias externas.
 */
function _nuevoSecreto_() {
  var hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  return hex.slice(0, 48);
}

/**
 * rotarSecretoVoz() — genera un secreto nuevo, lo guarda en VOZ_TOOL_SECRET y setea
 * VOZ_SECRET_EXPIRA a +90 días. **Lo MUESTRA UNA sola vez** en el Registro: copialo
 * ahora o volvé a rotar. El reparto NO se automatiza (decisión Bastión): el .env del
 * agente de voz lo actualiza Luciano a mano y reinicia el agente.
 */
function rotarSecretoVoz() {
  _soloOwner_('rotarSecretoVoz');   // purga integral 23-jul: genera y muestra un secreto nuevo
  return _rotarSecreto_('VOZ_TOOL_SECRET', PROP_VOZ_EXPIRA, 'agente de voz (.env del LiveKit worker)');
}

/** Igual que rotarSecretoVoz pero para el sync de la Oficina Virtual. */
function rotarSecretoOficina() {
  _soloOwner_('rotarSecretoOficina');   // purga integral 23-jul
  return _rotarSecreto_('OFICINA_SYNC_SECRET', PROP_OFICINA_EXPIRA, 'Oficina Virtual (.env del sync)');
}

/** Igual, para el export de charlas al Hilo (`_charla_pull.sh` lo lee de .env.local). */
function rotarSecretoCharlaExport() {
  _soloOwner_('rotarSecretoCharlaExport');   // TC-5
  return _rotarSecreto_('CHARLA_EXPORT_SECRET', PROP_CHARLA_EXPIRA, '_charla_pull.sh (.env.local del Mac)');
}

function _rotarSecreto_(propSecreto, propExpira, destino) {
  var props = PropertiesService.getScriptProperties();
  var nuevo = _nuevoSecreto_();
  var iso = _isoMasDias_(SECRETO_VIDA_DIAS);
  props.setProperty(propSecreto, nuevo);
  props.setProperty(propExpira, iso);
  var msg = '\n══════════════════════════════════════════════════════════\n' +
            'SECRETO NUEVO (' + propSecreto + ') — se muestra UNA sola vez:\n\n  ' + nuevo + '\n\n' +
            'Vence: ' + iso + ' (+' + SECRETO_VIDA_DIAS + 'd)\n' +
            'PEGALO A MANO en: ' + destino + ' y reiniciá ese proceso.\n' +
            'Hasta que lo pegues, ese canal responde "unauthorized".\n' +
            '══════════════════════════════════════════════════════════';
  Logger.log(msg);
  return { ok: true, property: propSecreto, expira: iso, instruccion: 'Pegar el secreto del Registro en ' + destino + ' y reiniciar.' };
}

// ═══ S3 — matriz de riesgo (un solo choke point) ════════════════════════════
//
// Filas = TIPO DE ACCIÓN del sistema. Valor = permitir | aprobar | bloquear.
// Viven en Config (`riesgo_<tipo>`) para que Luciano las cambie sin tocar código.
//
// DEFAULT-DENY, con el alcance declarado explícito (decisión de este módulo):
//   · tipo que NO está en RIESGO_TIPOS  → BLOQUEAR siempre (aunque alguien invente
//     una fila en Config: la matriz la define el código, no la hoja).
//   · tipo conocido cuya fila NO está en Config todavía → cae al default CONSERVADOR
//     de RIESGO_SIEMBRA. Por qué y no bloquear: entre el `clasp push` y el `setup()`
//     que materializa las filas habría una ventana con los agentes muertos en prod.
//     El default de código ES la matriz; Config solo la sobre-escribe.
//   · valor no reconocido en Config (typo) → BLOQUEAR (fail-closed, no "permitir por
//     las dudas"): un typo en la hoja no debe abrir una puerta.
//
// Esto NO reemplaza el default-deny de Umbrales (montos, 11_aprobaciones): lo complementa.
// Aquél decide "cuánto"; éste decide "qué clase de cosa".

var RIESGO_TIPOS = ['leer_tenant', 'escribir_tenant', 'ejecutar_agente', 'accion_externa', 'tocar_config', 'tocar_secretos', 'promover_agente'];
var RIESGO_MODOS = ['permitir', 'aprobar', 'bloquear'];
var RIESGO_SIEMBRA = {
  leer_tenant:     'permitir',   // lectura del propio roster, ya gateada por _soloOwner_/doPost
  escribir_tenant: 'aprobar',    // toda escritura pasa por Aprobaciones (motor E2)
  ejecutar_agente: 'permitir',   // los agentes con gate ya proponen vía crearAprobacion; bloquear acá mataría el CM
  accion_externa:  'bloquear',   // nada sale del sistema sin decisión explícita de Luciano
  tocar_config:    'bloquear',   // Config se edita desde el editor/hoja, jamás por un camino automático
  tocar_secretos:  'bloquear',   // Script Properties: solo rotarSecreto*() a mano
  // TC-9 (Forge): promover un agente de laboratorio a producción. `aprobar`, nunca `permitir`:
  // le da permiso de gastar API y de proponer sobre datos de clientes. Si alguien lo pone en
  // `bloquear`, Forge deja de poder promover y lo DICE — que es el comportamiento correcto.
  promover_agente: 'aprobar'
};

/** Cache por-ejecución de la matriz (evita releer Config en cada acción de la cola). */
var _RIESGO_CACHE_ = null;

/** Lee las filas `riesgo_*` de Config. Aislada para poder stubbearla en el harness offline. */
function _riesgoConfig_() {
  if (_RIESGO_CACHE_) return _RIESGO_CACHE_;
  var m = {};
  try { m = configPrefijo_('riesgo_') || {}; } catch (_e) { m = {}; }
  _RIESGO_CACHE_ = m;
  return m;
}

/** Modo vigente para `tipo`. Ver el bloque de arriba para la política de defaults. */
function _riesgoModo_(tipo) {
  tipo = String(tipo || '');
  if (RIESGO_TIPOS.indexOf(tipo) < 0) return 'bloquear';            // no listada = deny
  var v = String((_riesgoConfig_()[tipo] || '')).trim().toLowerCase();
  if (!v) return RIESGO_SIEMBRA[tipo];                              // fila aún no materializada
  if (RIESGO_MODOS.indexOf(v) < 0) return 'bloquear';               // typo en la hoja = deny
  return v;
}

/**
 * Choke point único. NO tira: devuelve el veredicto para que cada llamador lo traduzca
 * a su idioma (throw en encolarAgente, fallar_ en la cola, {ok:false} en la voz).
 * @param {string} tipo  uno de RIESGO_TIPOS
 * @param {Object} [ctx] { con_aprobacion?:boolean, id_cliente?:string, detalle?:string }
 * @return {{ok:boolean, modo:string, error:string, tipo:string}}
 */
function gateRiesgo_(tipo, ctx) {
  ctx = ctx || {};
  var modo = _riesgoModo_(tipo);
  if (modo === 'bloquear') {
    try { Logger.log('gateRiesgo_ BLOQUEA ' + tipo + ' ' + JSON.stringify(ctx)); } catch (_l) {}
    return { ok: false, modo: modo, tipo: String(tipo || ''), error: 'riesgo_bloqueado' };
  }
  if (modo === 'aprobar' && !ctx.con_aprobacion) {
    return { ok: false, modo: modo, tipo: String(tipo || ''), error: 'requiere_aprobacion' };
  }
  return { ok: true, modo: modo, tipo: String(tipo || ''), error: '' };
}

// ═══ S4 — security scan (chequeo 7 de correrSalud) ══════════════════════════

/**
 * securityScan_() — estilo selfTest: corre reglas, no llama a ninguna API.
 * (a) endpoints client-callable sin _soloOwner_  → crit
 * (b) secretos vencidos (crit) / sin fecha (warn)
 * (c) hojas sensibles VISIBLES en los Sheets cliente → crit (solo en opts.full: abre Sheets)
 * (d) Script Properties críticas vacías → crit
 * (e) kill switch legible → crit si la lectura revienta
 * @param {Object} [opts] { full?:boolean, endpoints?:Array (override para el assert D19) }
 * @return {{estado:string, detalle:string, hallazgos:Array}}
 */
function securityScan_(opts) {
  opts = opts || {};
  var h = [];
  function add(estado, que) { h.push({ estado: estado, que: que }); }

  // (a) cobertura del gate.
  (function () {
    var lista = opts.endpoints || ENDPOINTS_UI;
    var sin = [], raros = [];
    lista.forEach(function (n) {
      var r = _tieneGate_(n);
      if (r === 'sin_gate') sin.push(n);
      else if (r !== 'ok') raros.push(n + ':' + r);
    });
    if (sin.length) add('crit', 'endpoints sin _soloOwner_: ' + sin.join(', '));
    if (raros.length) add('warn', 'endpoints no verificables: ' + raros.join(', '));
    if (!sin.length && !raros.length) add('ok', lista.length + ' endpoints gateados');
  })();

  // (b) vencimiento de secretos.
  [[PROP_VOZ_EXPIRA, 'voz'], [PROP_OFICINA_EXPIRA, 'oficina']].forEach(function (par) {
    var iso = _expiraProp_(par[0]);
    if (!iso) { add('warn', par[1] + ': secreto SIN fecha de vencimiento (no expira)'); return; }
    var d = _diasPara_(iso);
    if (d === null) { add('warn', par[1] + ': fecha de vencimiento ilegible (' + iso + ')'); return; }
    if (d < 0) add('crit', par[1] + ': secreto VENCIDO el ' + iso);
    else if (d <= 7) add('warn', 'credencial_por_vencer — ' + par[1] + ' vence en ' + d + 'd (' + iso + ')');
    else add('ok', par[1] + ' vence en ' + d + 'd');
  });

  // (c) hojas sensibles visibles (solo full: abre cada Sheet cliente).
  if (opts.full) {
    try {
      var expuestas = [];
      leerTabla(getMaestro().getSheetByName('Clientes')).forEach(function (c) {
        if (!c.url_sheet_cliente) return;
        try {
          var cs = SpreadsheetApp.openByUrl(c.url_sheet_cliente);
          CLIENTE_SHEETS_SENSIBLES.forEach(function (n) {
            var sh = cs.getSheetByName(n);
            if (sh && !sh.isSheetHidden()) expuestas.push(c.id_cliente + '/' + n);
          });
        } catch (_c) { expuestas.push(c.id_cliente + ' (no abre)'); }
      });
      add(expuestas.length ? 'crit' : 'ok', expuestas.length ? ('hojas sensibles VISIBLES: ' + expuestas.slice(0, 10).join(', ')) : 'hojas sensibles ocultas en todos los tenants');
    } catch (e) { add('warn', 'no se pudo auditar hojas sensibles: ' + ((e && e.message) || e)); }
  }

  // (d) properties críticas.
  (function () {
    var faltan = [];
    ['MAESTRO_ID', 'OWNER_EMAIL', 'CLAUDE_API_KEY', 'VOZ_TOOL_SECRET', 'OFICINA_SYNC_SECRET'].forEach(function (p) {
      var v = '';
      try { v = PropertiesService.getScriptProperties().getProperty(p) || ''; } catch (_e) {}
      if (!v) faltan.push(p);
    });
    add(faltan.length ? 'crit' : 'ok', faltan.length ? ('properties críticas VACÍAS: ' + faltan.join(', ')) : 'properties críticas presentes');
  })();

  // (e) kill switch legible (si esto no se puede leer, el freno de mano no existe).
  (function () {
    try { var p = _sistemaPausado_(); add('ok', 'kill switch legible (pausado=' + p + ')'); }
    catch (e) { add('crit', 'kill switch ILEGIBLE: ' + ((e && e.message) || e)); }
  })();

  var crit = h.filter(function (x) { return x.estado === 'crit'; });
  var warn = h.filter(function (x) { return x.estado === 'warn'; });
  var estado = crit.length ? 'crit' : (warn.length ? 'warn' : 'ok');
  var relevantes = crit.concat(warn);
  return {
    estado: estado,
    detalle: (relevantes.length ? relevantes : h).map(function (x) { return x.que; }).join(' · '),
    hallazgos: h
  };
}

/** Wrapper PÚBLICO (el desplegable del editor no lista funciones con guión bajo final). */
function securityScan(opts) {
  _soloOwner_('securityScan');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var r = securityScan_(opts || { full: false }); Logger.log(JSON.stringify(r, null, 2)); return r;
}
