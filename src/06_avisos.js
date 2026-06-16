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
  return conLock(function () { // PURGA #4: dedupe + nextId + append, atómico
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
  });
}

/**
 * Corrida diaria batched. Idempotente (dedupe de avisos activos).
 * Orden: sync primero (refresca pendientes) → luego detectores.
 */
function corridaDiaria() {
  var resumen = { sync: null, avisos_nuevos: 0, expiradas: 0, vigias_encoladas: 0, director: null, salud: null, costos: null };
  invalidarMapaPC(); // PURGA #6: mapa proyecto→cliente fresco al arrancar la corrida
  // PURGA #16: expirar ANTES de sincronizar, así el espejo del MAESTRO no muestra
  // como "pendiente" una aprobación que ya quedó "expirada" en el Sheet cliente.
  resumen.expiradas = expirarAprobaciones();
  try { resumen.sync = syncMaestro(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Sync falló: ' + e.message }); }

  resumen.avisos_nuevos += detectarVencimientos();
  resumen.avisos_nuevos += detectarTareasEstancadas();
  resumen.avisos_nuevos += detectarProyectosSinMovimiento();

  // ETAPA 2: encolar Vigía para cada cliente activo (la cola es el contrato; el
  // worker drenarCola la corre). Los detectores internos se conservan tal cual.
  try { resumen.vigias_encoladas = encolarVigiaClientesActivos(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Encolar vigías falló: ' + e.message }); }

  // ETAPA 8a: el Director materializa el cerebro de cada tenant y encola la capa
  // dirigida por objetivos. 0 API (solo decide+encola; los agentes gatean/cupean).
  try { resumen.director = correrDirector(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Director falló: ' + e.message }); }

  // ETAPA 8a: loop de salud (6 chequeos, 0 API, alerta-no-arregla). Liviano en el pase
  // diario (schema solo MAESTRO); correrSalud({full:true}) abre clientes on-demand.
  try { resumen.salud = correrSalud(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Salud falló: ' + e.message }); }

  // ETAPA 2: consolidar costos del mes al MAESTRO (USD/EUR + alerta de presupuesto).
  try { resumen.costos = consolidarCostosMes(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Consolidar costos falló: ' + e.message }); }

  setConfig('ultima_corrida_avisos', ahoraISO());
  Logger.log('corridaDiaria: ' + JSON.stringify(resumen));
  return resumen;
}

/** Encola una corrida de Vigía por cada cliente activo. Devuelve cuántas encoló. */
function encolarVigiaClientesActivos() {
  var activos = ['activo', 'activo-piloto'];
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
    return activos.indexOf(String(c.estado).toLowerCase()) >= 0;
  });
  clientes.forEach(function (c) { encolarAgente(c.id_cliente, 'vigia', {}); });
  return clientes.length;
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
function expirarAprobaciones(soloCliente) {
  var dias = parseInt(getConfig('expiracion_aprobaciones_dias') || '7', 10);
  var limite = hace(dias);
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes'));
  var n = 0;
  clientes.forEach(function (cli) {
    if (!cli.url_sheet_cliente) return;
    if (soloCliente && cli.id_cliente !== soloCliente) return; // selfTest acota a su cliente
    try {
      var sh = SpreadsheetApp.openByUrl(cli.url_sheet_cliente).getSheetByName('Aprobaciones');
      if (!sh || sh.getLastRow() < 2) return;
      // PURGA #5: una sola lectura + una sola escritura por cliente (antes: 3-4
      // setValue por fila vencida, N+1). Leemos toda la pestaña, mutamos en memoria
      // las filas pendientes vencidas y volcamos el bloque de datos de una vez.
      var matriz = sh.getDataRange().getValues();
      var headers = matriz[0];
      var iEstado = headers.indexOf('estado');
      var iDecision = headers.indexOf('fecha_decision');
      var iNotas = headers.indexOf('notas');
      var iAutor = headers.indexOf('decidido_por');
      var iFc = headers.indexOf('fecha_creacion');
      var iId = headers.indexOf('id');
      var iDesc = headers.indexOf('descripcion');
      var cambiada = false;
      var avisos = [];
      for (var r = 1; r < matriz.length; r++) {
        if (String(matriz[r][iEstado]).toLowerCase() === 'pendiente' &&
            aFechaISO(matriz[r][iFc]) && aFechaISO(matriz[r][iFc]) < limite) {
          matriz[r][iEstado] = 'expirada';
          if (iDecision >= 0) matriz[r][iDecision] = hoyISO();
          if (iNotas >= 0) matriz[r][iNotas] = 'Expirada por silencio > ' + dias + 'd';
          // PURGA #13: autor no humano de la decisión, para trazabilidad.
          if (iAutor >= 0) matriz[r][iAutor] = 'sistema (expiración)';
          avisos.push({ id: matriz[r][iId], desc: matriz[r][iDesc] });
          cambiada = true;
          n++;
        }
      }
      if (cambiada) {
        sh.getRange(1, 1, matriz.length, headers.length).setValues(matriz);
        avisos.forEach(function (a) {
          crearAviso({
            id_cliente: cli.id_cliente,
            tipo: 'aprobacion_expirada',
            mensaje: 'Aprobación expirada sin decisión: ' + a.desc + ' [' + a.id + ']'
          });
        });
      }
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

/**
 * PURGA #6: mapa id_proyecto → id_cliente construido UNA vez por ejecución.
 * Antes clienteDeProyecto releía Proyectos entera por cada tarea (datosHoy hasta
 * 25×). El cache vive en el runtime de la ejecución (GAS arranca limpio en cada
 * corrida), así que no hay riesgo de staleness entre ejecuciones. invalidarMapaPC()
 * por si algún flujo escribe Proyectos y vuelve a leer en la misma corrida.
 */
var _mapaPC = null;
function mapaProyectoCliente() {
  if (_mapaPC) return _mapaPC;
  _mapaPC = {};
  leerTabla(getMaestro().getSheetByName('Proyectos')).forEach(function (p) {
    _mapaPC[p.id_proyecto] = p.id_cliente;
  });
  return _mapaPC;
}
function invalidarMapaPC() { _mapaPC = null; }

/** id_cliente al que pertenece un id_proyecto (vía mapa memoizado). */
function clienteDeProyecto(idProyecto) {
  return mapaProyectoCliente()[idProyecto] || '';
}

/**
 * Instala (idempotente) el único trigger diario. Corré a mano una vez.
 * Cuota consumer: un solo trigger batched, no uno por flujo (0.4).
 */
function instalarTriggers() {
  var deseados = [TRIGGER_AVISOS, 'drenarCola']; // Etapa 2: + worker de la cola (cada 5 min)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (deseados.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(TRIGGER_AVISOS).timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('drenarCola').timeBased().everyMinutes(5).create();
  Logger.log('Triggers instalados: "' + TRIGGER_AVISOS + '" (07:00) + "drenarCola" (cada 5 min).');
  return true;
}
