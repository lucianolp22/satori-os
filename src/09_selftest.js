/**
 * 09_selftest.js — Verificación end-to-end (handoff: "ejecutar, no asumir").
 *
 * selfTest() cubre los casos de aceptación mínimos:
 *  (a) crearCliente() genera el Sheet cliente completo de una;
 *  (b) una aprobación pendiente creada en el cliente aparece agregada en el
 *      maestro tras syncMaestro();
 *  (c) corridaDiaria() corre y escribe Avisos;
 *  (d) el esquema soporta default-deny (monto sin fila en Umbrales).
 * Limpia su cliente de prueba al final (lo manda a la papelera — reversible).
 */
function selfTest() {
  var log = [];
  function chk(cond, msg) { log.push((cond ? '✅ ' : '❌ ') + msg); if (!cond) throw new Error('FALLO: ' + msg); }

  try {
    // 0) setup idempotente
    var s = setup();
    chk(s.pestanas.length >= 9, 'MAESTRO con 9 pestañas (' + s.pestanas.length + ')');
    MAESTRO_ORDEN.forEach(function (n) { chk(s.pestanas.indexOf(n) >= 0, 'pestaña maestro: ' + n); });

    // a) crearCliente con nombre único de prueba
    var nombrePrueba = '__TEST__ ' + ahoraISO();
    var r = crearCliente({ nombre: nombrePrueba, rubro: 'test', estado: 'potencial' });
    chk(!!r.id_cliente && !r.ya_existia, 'crearCliente devolvió id nuevo: ' + r.id_cliente);
    var cliSS = SpreadsheetApp.openByUrl(r.url);
    CLIENTE_ORDEN.forEach(function (n) {
      chk(!!cliSS.getSheetByName(n), 'pestaña cliente: ' + n);
    });
    // sensibles ocultas
    CLIENTE_SHEETS_SENSIBLES.forEach(function (n) {
      chk(cliSS.getSheetByName(n).isSheetHidden(), 'pestaña sensible oculta: ' + n);
    });

    // b) crear una aprobación PENDIENTE en el cliente (d: monto sin fila en Umbrales)
    var shAp = cliSS.getSheetByName('Aprobaciones');
    appendFila(shAp, {
      id: 'APR-TEST-1', fecha_creacion: hoyISO(), cliente: nombrePrueba, modulo: 'test',
      patron: 'P2', tipo_accion: 'pago', descripcion: 'pago test default-deny',
      payload: '{}', monto: 999, 'confianza_%': 50, estado: 'pendiente'
    });
    chk(leerTabla(cliSS.getSheetByName('Umbrales')).length === 0, 'Umbrales vacío → default deny aplica');

    var sync = syncMaestro();
    var agg = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas'))
      .filter(function (f) { return f.id === 'APR-TEST-1'; });
    chk(agg.length === 1, 'aprobación pendiente del cliente aparece agregada en el maestro');
    chk(String(getConfig('ultima_sync_ok')) !== '', 'ultima_sync_ok seteado');

    // c) corrida diaria escribe avisos (creamos una tarea vencida)
    var shT = getMaestro().getSheetByName('Tareas');
    appendFila(shT, {
      id_tarea: 'TAR-TEST-1', id_proyecto: 'PRY-TEST', descripcion: 'tarea vencida test',
      prioridad: 'A', estado: 'en_curso', fecha_limite: '2020-01-01', fecha_creacion: '2020-01-01'
    });
    var corrida = corridaDiaria();
    var avisos = leerTabla(getMaestro().getSheetByName('Avisos'))
      .filter(function (f) { return String(f.mensaje).indexOf('TAR-TEST-1') >= 0; });
    chk(avisos.length >= 1, 'corridaDiaria generó aviso de tarea vencida');

    log.push('— TODO OK —');
  } finally {
    // La limpieza corre SIEMPRE (pase o falle), y barre cualquier resto de
    // corridas anteriores (clientes __TEST__ huérfanos, filas TEST).
    var limpiados = limpiarTodoTest();
    log.push('🧹 limpieza: ' + limpiados.clientes + ' cliente(s) __TEST__ a papelera, filas TEST removidas');
  }

  var salida = log.join('\n');
  Logger.log(salida);
  return salida;
}

/**
 * Barre TODOS los artefactos de prueba (idempotente, reversible):
 * - clientes cuyo nombre empieza con '__TEST__' → Sheet a papelera + fila fuera de Clientes;
 * - filas TAR-TEST* / APR-TEST* y avisos con 'TEST' en el mensaje.
 * Sirve también para limpiar restos de una corrida que falló antes del cleanup.
 */
function limpiarTodoTest() {
  var ss = getMaestro();
  var shClientes = ss.getSheetByName('Clientes');
  var testClientes = leerTabla(shClientes).filter(function (f) {
    return String(f.nombre).indexOf('__TEST__') === 0;
  });
  testClientes.forEach(function (c) {
    try {
      if (c.url_sheet_cliente) {
        DriveApp.getFileById(SpreadsheetApp.openByUrl(c.url_sheet_cliente).getId()).setTrashed(true);
      }
    } catch (e) { Logger.log('No pude mandar a papelera ' + c.id_cliente + ': ' + e.message); }
  });

  borrarFilasDonde(shClientes, 'nombre', null, function (f) { return String(f.nombre).indexOf('__TEST__') === 0; });
  borrarFilasDonde(ss.getSheetByName('Aprobaciones_agregadas'), 'id', null, function (f) { return String(f.id).indexOf('APR-TEST') === 0; });
  borrarFilasDonde(ss.getSheetByName('Tareas'), 'id_tarea', null, function (f) { return String(f.id_tarea).indexOf('TAR-TEST') === 0; });
  borrarFilasDonde(ss.getSheetByName('Avisos'), 'mensaje', null, function (f) { return String(f.mensaje).indexOf('TEST') >= 0; });
  return { clientes: testClientes.length };
}

/** Borra filas de una pestaña por igualdad de columna o por predicado. */
function borrarFilasDonde(sh, columna, valor, pred) {
  var filas = leerTabla(sh);
  // de abajo hacia arriba para no desfasar índices
  for (var i = filas.length - 1; i >= 0; i--) {
    var hit = pred ? pred(filas[i]) : (filas[i][columna] === valor);
    if (hit) sh.deleteRow(filas[i]._fila);
  }
}
