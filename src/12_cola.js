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

// ── helpers locales ─────────────────────────────────────────────────────────

/** Date desde una celda 'yyyy-MM-ddTHH:mm:ss' (ahoraISO) o un Date de Sheets. */
function aFechaHora_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
