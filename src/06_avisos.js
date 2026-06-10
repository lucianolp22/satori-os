/**
 * 06_avisos.js — Avisos internos y trigger diario batched (handoff 1.4).
 *
 * UN solo trigger diario (cuota consumer 90 min/día) que procesa todo en una
 * corrida: corre la sync, detecta vencimientos / tareas estancadas / proyectos
 * sin movimiento > N días, y escribe en la pestaña Avisos del MAESTRO.
 * Los avisos son internos a Luciano → corren solos (AREL: nada externo).
 */

var TRIGGER_AVISOS = 'corridaDiaria';

/** Crea un Aviso en el MAESTRO si no existe ya uno activo igual (dedupe). */
function crearAviso(a) {
  var sh = getMaestro().getSheetByName('Avisos');
  var activos = leerTabla(sh).filter(function (f) { return String(f.estado) === 'activo'; });
  var dup = activos.filter(function (f) {
    return f.tipo === a.tipo && f.id_cliente === (a.id_cliente || '') && f.mensaje === a.mensaje;
  })[0];
  if (dup) return dup.id_aviso;

  var id = nextId(sh, 'id_aviso', 'AVI', 4);
  appendFila(sh, {
    id_aviso: id,
    origen: a.origen || 'trigger',
    id_cliente: a.id_cliente || '',
    tipo: a.tipo,
    mensaje: a.mensaje,
    estado: 'activo',
    fecha: ahoraISO()
  });
  return id;
}

/**
 * Corrida diaria batched. Idempotente (dedupe de avisos activos).
 * Orden: sync primero (refresca pendientes) → luego detectores.
 */
function corridaDiaria() {
  var resumen = { sync: null, avisos_nuevos: 0, expiradas: 0 };
  try { resumen.sync = syncMaestro(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Sync falló: ' + e.message }); }

  resumen.expiradas = expirarAprobaciones();
  resumen.avisos_nuevos += detectarVencimientos();
  resumen.avisos_nuevos += detectarTareasEstancadas();
  resumen.avisos_nuevos += detectarProyectosSinMovimiento();

  setConfig('ultima_corrida_avisos', ahoraISO());
  Logger.log('corridaDiaria: ' + JSON.stringify(resumen));
  return resumen;
}

/** Tareas con fecha_límite pasada y estado no terminal → aviso. */
function detectarVencimientos() {
  var sh = getMaestro().getSheetByName('Tareas');
  var hoy = hoyISO();
  var n = 0;
  leerTabla(sh).forEach(function (t) {
    var term = ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) >= 0;
    var fl = aFechaISO(t.fecha_limite);
    if (!term && fl && fl < hoy) {
      crearAviso({
        id_cliente: clienteDeProyecto(t.id_proyecto),
        tipo: 'tarea_vencida',
        mensaje: 'Tarea vencida (' + fl + '): ' + t.descripcion + ' [' + t.id_tarea + ']'
      });
      n++;
    }
  });
  return n;
}

/** Tareas creadas hace > N días sin pasar a estado terminal. */
function detectarTareasEstancadas() {
  var dias = parseInt(getConfig('dias_estancamiento_tarea') || '7', 10);
  var sh = getMaestro().getSheetByName('Tareas');
  var limite = hace(dias);
  var n = 0;
  leerTabla(sh).forEach(function (t) {
    var term = ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) >= 0;
    var activa = ['en_curso', 'pendiente', 'en curso', ''].indexOf(String(t.estado).toLowerCase()) >= 0;
    var fc = aFechaISO(t.fecha_creacion);
    if (!term && activa && fc && fc < limite) {
      crearAviso({
        id_cliente: clienteDeProyecto(t.id_proyecto),
        tipo: 'tarea_estancada',
        mensaje: 'Tarea estancada > ' + dias + 'd: ' + t.descripcion + ' [' + t.id_tarea + ']'
      });
      n++;
    }
  });
  return n;
}

/** Proyectos sin movimiento > N días (fecha_ultimo_movimiento). */
function detectarProyectosSinMovimiento() {
  var dias = parseInt(getConfig('dias_estancamiento_proyecto') || '7', 10);
  var sh = getMaestro().getSheetByName('Proyectos');
  var limite = hace(dias);
  var n = 0;
  leerTabla(sh).forEach(function (p) {
    var term = ['cerrado', 'entregado', 'cancelado'].indexOf(String(p.estado).toLowerCase()) >= 0;
    var mov = aFechaISO(p.fecha_ultimo_movimiento);
    if (!term && mov && mov < limite) {
      crearAviso({
        id_cliente: p.id_cliente,
        tipo: 'proyecto_sin_movimiento',
        mensaje: 'Proyecto sin movimiento > ' + dias + 'd: ' + p.nombre + ' [' + p.id_proyecto + ']'
      });
      n++;
    }
  });
  return n;
}

/**
 * Aprobaciones pendientes > N días → marcar "expirada" en el Sheet del cliente
 * (el silencio NUNCA aprueba — 0.2) y avisar. Append-only: se EDITA el estado de
 * la fila pendiente, no se borra.
 */
function expirarAprobaciones() {
  var dias = parseInt(getConfig('expiracion_aprobaciones_dias') || '7', 10);
  var limite = hace(dias);
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes'));
  var n = 0;
  clientes.forEach(function (cli) {
    if (!cli.url_sheet_cliente) return;
    try {
      var sh = SpreadsheetApp.openByUrl(cli.url_sheet_cliente).getSheetByName('Aprobaciones');
      if (!sh) return;
      leerTabla(sh).forEach(function (a) {
        if (String(a.estado).toLowerCase() === 'pendiente' &&
            aFechaISO(a.fecha_creacion) && aFechaISO(a.fecha_creacion) < limite) {
          var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
          sh.getRange(a._fila, headers.indexOf('estado') + 1).setValue('expirada');
          sh.getRange(a._fila, headers.indexOf('fecha_decision') + 1).setValue(hoyISO());
          sh.getRange(a._fila, headers.indexOf('notas') + 1).setValue('Expirada por silencio > ' + dias + 'd');
          crearAviso({
            id_cliente: cli.id_cliente,
            tipo: 'aprobacion_expirada',
            mensaje: 'Aprobación expirada sin decisión: ' + a.descripcion + ' [' + a.id + ']'
          });
          n++;
        }
      });
    } catch (e) {
      crearAviso({ tipo: 'sync_error', mensaje: 'Expirar aprobaciones falló en ' + cli.id_cliente + ': ' + e.message });
    }
  });
  return n;
}

// ── helpers locales ─────────────────────────────────────────────────────────

/** Fecha ISO de hace N días (YYYY-MM-DD). */
function hace(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/** id_cliente al que pertenece un id_proyecto (vía pestaña Proyectos). */
function clienteDeProyecto(idProyecto) {
  var p = leerTabla(getMaestro().getSheetByName('Proyectos')).filter(function (f) {
    return f.id_proyecto === idProyecto;
  })[0];
  return p ? p.id_cliente : '';
}

/**
 * Instala (idempotente) el único trigger diario. Corré a mano una vez.
 * Cuota consumer: un solo trigger batched, no uno por flujo (0.4).
 */
function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_AVISOS) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(TRIGGER_AVISOS).timeBased().everyDays(1).atHour(7).create();
  Logger.log('Trigger diario "' + TRIGGER_AVISOS + '" instalado (07:00 Europe/Madrid).');
  return true;
}
