/**
 * 12_cola.js — Cola de tareas durable (ETAPA 2 · capa Trillion, Cola.gs donante adaptado).
 *
 * Principios: la cola es el contrato y es durable · claim atómico (LockService) ·
 * drain en cada corrida del trigger · "started no es done" (completada SOLO con
 * resultado persistido). Vive en la hoja MAESTRO 'Cola_tareas' (01_schema.js) y usa
 * los helpers del repo (07_util: getMaestro/appendFila/leerTabla/conLock/ahoraISO).
 */

var COLA_HOJA = 'Cola_tareas';
var WORKER_DEFAULT = 'gas_principal';
var COLA_MAX_MS = 4.5 * 60 * 1000;      // margen sobre el límite de 6 min de GAS
var COLA_RECLAIM_MIN = 15;              // 'tomada' más vieja que esto se re-encola (worker murió)

function workerActual_() {
  return PropertiesService.getScriptProperties().getProperty('WORKER') || WORKER_DEFAULT;
}

function hojaCola_() {
  var sh = getMaestro().getSheetByName(COLA_HOJA);
  if (!sh) throw new Error('Falta hoja ' + COLA_HOJA + '. Corré setup().');
  return sh;
}

/** Mapa header → índice 1-based de la cola. */
function colsCola_(sh) {
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var m = {}; H.forEach(function (h, i) { m[h] = i + 1; });
  return m;
}

/** Encolar: inserta pendiente (durable) y devuelve id. */
function encolar(worker, tipo, payload) {
  var sh = hojaCola_();
  var id = Utilities.getUuid();
  appendFila(sh, {
    id: id, worker: worker, tipo: tipo,
    payload: JSON.stringify(payload || {}),
    estado: 'pendiente', resultado: '', error: '',
    tomada_por: '', creada_en: ahoraISO(), tomada_en: '', completada_en: ''
  });
  return id;
}

/**
 * Claim atómico bajo lock (equivalente GAS del FOR UPDATE SKIP LOCKED): toma la
 * pendiente más vieja del worker, la marca 'tomada' y persiste ANTES de soltar el
 * lock. Devuelve {fila, id, tipo, payload} o null.
 */
function tomar_(worker, quien) {
  return conLock(function () {
    var sh = hojaCola_();
    var c = colsCola_(sh);
    var n = sh.getLastRow();
    if (n < 2) return null;
    var datos = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
    var iEstado = c.estado - 1, iWorker = c.worker - 1, iId = c.id - 1, iTipo = c.tipo - 1, iPayload = c.payload - 1;
    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][iEstado]) === 'pendiente' && String(datos[i][iWorker]) === String(worker)) {
        var fila = i + 2;
        sh.getRange(fila, c.estado).setValue('tomada');
        sh.getRange(fila, c.tomada_por).setValue(quien);
        sh.getRange(fila, c.tomada_en).setValue(ahoraISO());
        SpreadsheetApp.flush(); // persistir el claim antes de liberar el lock
        return { fila: fila, id: datos[i][iId], tipo: datos[i][iTipo], payload: parsearPayload_(datos[i][iPayload]) };
      }
    }
    return null;
  });
}

function setFilaCola_(fila, estado, resultado, error) {
  var sh = hojaCola_();
  var c = colsCola_(sh);
  sh.getRange(fila, c.estado).setValue(estado);
  sh.getRange(fila, c.resultado).setValue(sanitizarCelda(JSON.stringify(resultado || '')));
  sh.getRange(fila, c.error).setValue(sanitizarCelda(String(error || '')));
  sh.getRange(fila, c.completada_en).setValue(ahoraISO());
}

function completar_(fila, resultado) { setFilaCola_(fila, 'completada', resultado, ''); }
function fallar_(fila, error) { setFilaCola_(fila, 'fallida', '', error); }

/**
 * Re-encola tareas 'tomada' colgadas (worker murió antes de completar): vuelven a
 * 'pendiente'. Robustez "started no es done": una tarea tomada que nunca completó
 * no queda perdida. Las pendientes nunca se pierden (drain-on-startup).
 */
function reclamarColgadas_() {
  var sh = hojaCola_();
  if (sh.getLastRow() < 2) return 0;
  var c = colsCola_(sh);
  var limite = new Date(Date.now() - COLA_RECLAIM_MIN * 60 * 1000);
  var n = sh.getLastRow();
  var datos = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
  var iEstado = c.estado - 1, iTomada = c.tomada_en - 1;
  var reclamadas = 0;
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][iEstado]) === 'tomada') {
      var t = aFechaHora_(datos[i][iTomada]);
      if (!t || t < limite) {
        sh.getRange(i + 2, c.estado).setValue('pendiente');
        sh.getRange(i + 2, c.tomada_por).setValue('');
        reclamadas++;
      }
    }
  }
  return reclamadas;
}

/**
 * Worker: drena TODO lo pendiente en cada corrida (drain-on-startup). Idempotente.
 * Lo instala instalarTriggers() (cada 5 min); también corre a mano.
 */
function drenarCola() {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  if (_sistemaPausado_()) { Logger.log('PAUSA: drenarCola omitida'); return { pausado: true }; }
  reclamarColgadas_();
  var worker = workerActual_();
  var t0 = Date.now();
  var tarea, procesadas = 0;
  while ((tarea = tomar_(worker, 'trigger')) !== null) {
    ejecutarTarea_(tarea);
    procesadas++;
    if (Date.now() - t0 > COLA_MAX_MS) break; // lo no drenado queda pendiente para la próxima
  }
  return procesadas;
}

/** Router de tipos. "Completada" SOLO con resultado real persistido. */
function ejecutarTarea_(tarea) {
  try {
    if (tarea.tipo === 'noop') {
      completar_(tarea.fila, { ok: true });
    } else if (tarea.tipo === 'agente') {
      var p = tarea.payload || {};
      // T3-S3: segundo paso por el choke point. Una tarea puede haberse encolado ANTES de que
      // Luciano cerrara la matriz; el ejecutor decide con la matriz VIGENTE, no con la de ayer.
      var g = gateRiesgo_('ejecutar_agente', { id_cliente: p.id_cliente, detalle: p.agente });
      if (!g.ok) { fallar_(tarea.fila, 'riesgo: ' + g.error + ' (ejecutar_agente=' + g.modo + ')'); return; }
      var resumen = correrAgente_(p.agente, p.args || {}, tarea.id, p.id_cliente);
      if (resumen && (resumen.status === 'error' || resumen.status === 'fallida')) {
        fallar_(tarea.fila, resumen.detalle || 'el agente reportó fallo'); // fallo honesto, no éxito silencioso
      } else {
        completar_(tarea.fila, resumen); // incluye status 'esperando_aprobacion' (gate humano)
      }
    } else {
      fallar_(tarea.fila, 'tipo de tarea desconocido: ' + tarea.tipo);
    }
  } catch (e) {
    fallar_(tarea.fila, e && e.message ? e.message : 'error no identificado');
  }
}

// ── Dieta de la cola (16-jul · SPEC-GAS "PROPUESTA APARTE", opción A: archivar) ──
//
// Problema medido el 14-jul: estadoAgentes hace leerTabla(Cola_tareas) SIN poda (~857 filas y
// creciendo) en CADA poll del CM (15s) y en el doPost de voz → costo fijo que crece sin techo.
// Solución: las filas TERMINALES y viejas se mudan a 'Cola_archivo' (mismo schema). Nadie lee el
// archivo en el poll: es historia consultable desde el editor.
//
// OJO — los estados terminales de la COLA son 'completada'/'fallida' (12_cola.js), NO
// 'hecha'/'cancelada': esos son de la hoja Tareas (el kanban). El encargo los nombraba mal;
// con los nombres del encargo esta función no archivaría NADA. (Lección del 08-jul: todo
// marcador literal se valida contra el archivo real.)
var COLA_ARCHIVO_HOJA = 'Cola_archivo';
var COLA_ARCHIVO_DIAS = 30;
var COLA_TERMINALES = ['completada', 'fallida'];

/**
 * Mueve filas terminales y viejas de Cola_tareas → Cola_archivo. Bajo conLock, bottom-up y
 * en batch. Idempotente (una segunda corrida no tiene nada que mover).
 *
 * DOS PROTECCIONES OBLIGATORIAS (los riesgos que detectó el diseño). Ninguna es opcional:
 *  1. ÚLTIMO-ESTADO-POR-AGENTE: estadosAgentesCola_ deriva el estado de cada agente de su
 *     ÚLTIMA fila en la cola. Archivar la última fila de un agente quieto lo dejaría "idle"
 *     sin serlo → la fila más reciente de cada agente NUNCA se archiva, aunque sea vieja y terminal.
 *  2. CONTEO DE ERRORES: telemetriaMaestro_ cuenta los errores del MES en curso desde esta hoja
 *     → jamás se archiva una fila del mes en curso, aunque supere los 30 días (puede pasar el
 *     día 31). Así el horizonte de archivo es SIEMPRE ≥ la ventana de conteo y el número no baja.
 *
 * @param {Object} [opts] {dias, dryRun} — dryRun cuenta sin mover (verificación de editor).
 * @return {{archivadas:number, protegidas_por_agente:number, dry_run:boolean}}
 */
function archivarColaVieja_(opts) {
  opts = opts || {};
  var dias = opts.dias || COLA_ARCHIVO_DIAS;
  return conLock(function () {
    var sh = hojaCola_();
    var shArch = getMaestro().getSheetByName(COLA_ARCHIVO_HOJA);
    if (!shArch) { Logger.log('archivarColaVieja_: falta ' + COLA_ARCHIVO_HOJA + ' — correr setup()'); return { archivadas: 0, protegidas_por_agente: 0, dry_run: !!opts.dryRun }; }
    var filas = leerTabla(sh);
    if (!filas.length) return { archivadas: 0, protegidas_por_agente: 0, dry_run: !!opts.dryRun };

    var limite = Utilities.formatDate(new Date(Date.now() - dias * 86400000), TZ, 'yyyy-MM-dd');
    var inicioMes = mesISO() + '-01';

    // Protección 1: la fila más reciente de cada agente (mismo criterio que estadosAgentesCola_:
    // recorre en orden de hoja y la última gana).
    var ultimaDe = {};
    filas.forEach(function (f) {
      if (String(f.tipo) !== 'agente') return;
      var p = parsearPayload_(f.payload);
      if (p && p.agente) ultimaDe[p.agente] = f._fila;
    });
    var protegida = {}, nProt = 0;
    Object.keys(ultimaDe).forEach(function (k) { protegida[ultimaDe[k]] = true; nProt++; });

    var mover = filas.filter(function (f) { return _colaArchivable_(f, limite, inicioMes, protegida[f._fila]); });
    if (!mover.length || opts.dryRun) return { archivadas: mover.length, protegidas_por_agente: nProt, dry_run: !!opts.dryRun };

    // ORDEN CRÍTICO (es una operación destructiva-móvil): escribir en el archivo, FLUSH, y recién
    // ahí borrar del origen. Al revés, un corte entre borrar y escribir perdería las filas.
    var H = shArch.getRange(1, 1, 1, shArch.getLastColumn()).getValues()[0];
    var matriz = mover.map(function (f) { return H.map(function (h) { return (f[h] === undefined || f[h] === null) ? '' : f[h]; }); });
    shArch.getRange(shArch.getLastRow() + 1, 1, matriz.length, H.length).setValues(matriz);
    SpreadsheetApp.flush();
    borrarFilasBatch_(sh, mover.map(function (f) { return f._fila; }));  // ya ordena desc internamente
    Logger.log('archivarColaVieja_: ' + mover.length + ' fila(s) → ' + COLA_ARCHIVO_HOJA + ' (protegidas por agente: ' + nProt + ')');
    return { archivadas: mover.length, protegidas_por_agente: nProt, dry_run: false };
  });
}

/**
 * ¿Esta fila se archiva? PURA (sin I/O) a propósito: es la decisión de una operación destructiva-móvil
 * y así se puede probar cada guarda de verdad, sin depender de la fecha en que corra el test.
 * @param {Object} f          fila de la cola (leerTabla)
 * @param {string} limite     'YYYY-MM-DD' = hoy − horizonte. Más nueva que esto → se queda.
 * @param {string} inicioMes  'YYYY-MM-01' del mes en curso. Igual o posterior → se queda (protección 2).
 * @param {boolean} esUltimaDelAgente  → se queda (protección 1).
 */
function _colaArchivable_(f, limite, inicioMes, esUltimaDelAgente) {
  if (COLA_TERMINALES.indexOf(String(f.estado)) < 0) return false;  // pendiente/tomada NUNCA
  if (esUltimaDelAgente) return false;                              // protección 1: último-estado-por-agente
  var fc = aFechaISO(f.creada_en);
  if (!fc) return false;                    // sin fecha no sabemos la edad → no se toca
  if (fc > limite) return false;            // más nueva que el horizonte
  if (fc >= inicioMes) return false;        // protección 2: el mes en curso lo cuenta la telemetría
  return true;
}

/** Verificación de editor: cuenta qué se archivaría HOY sin mover nada. */
function verifArchivoCola_() {
  var r = archivarColaVieja_({ dryRun: true });
  Logger.log('dry-run archivo de cola: ' + JSON.stringify(r));
  return r;
}

/**
 * Wrapper PÚBLICO de verifArchivoCola_ — el desplegable del editor NO lista las funciones que
 * terminan en guión bajo, y ESTA es la que hay que poder correr ANTES de dejar que el archivo
 * corra solo (dice cuántas filas movería, sin mover nada). (Lección del 14-jul con sgicConsulta_.)
 */
function verifArchivoCola() { return verifArchivoCola_(); }

/**
 * Wrapper PÚBLICO — corre el archivo de cola REAL a mano (la diaria lo hace sola después).
 * El sufijo REAL no es decorativo: en el desplegable del editor esta función y `verifArchivoCola`
 * (el dry-run) quedaban con nombres casi gemelos y, por orden alfabético, la DESTRUCTIVA aparecía
 * PRIMERO — un clic de más y se movían filas de verdad. Con REAL en el nombre no hay ambigüedad.
 * (Se descartó pedir confirmación con Browser.msgBox: este proyecto es standalone, no bound a la
 * hoja, y msgBox tira desde el editor en ese contexto.)
 * Antes de correr esta: `verifArchivoCola()` dice cuántas filas movería SIN mover nada.
 */
function archivarColaViejaREAL() { return archivarColaVieja_(); }

// ── helpers locales ─────────────────────────────────────────────────────────

/** Date desde una celda 'yyyy-MM-ddTHH:mm:ss' (ahoraISO) o un Date de Sheets. */
function aFechaHora_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
