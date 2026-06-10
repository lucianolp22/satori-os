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
    .filter(function (f) { return f.mensaje.indexOf('TAR-TEST-1') >= 0; });
  chk(avisos.length >= 1, 'corridaDiaria generó aviso de tarea vencida');

  // limpieza: papelera del Sheet de prueba + quitar filas de prueba del maestro
  limpiarPrueba(nombrePrueba, r.id_cliente);

  log.push('— TODO OK —');
  var salida = log.join('\n');
  Logger.log(salida);
  return salida;
}

/** Borra (papelera, reversible) artefactos de selfTest. */
function limpiarPrueba(nombrePrueba, idCliente) {
  try { DriveApp.getFileById(SpreadsheetApp.openByUrl(
    leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (f) { return f.id_cliente === idCliente; })[0].url_sheet_cliente
  ).getId()).setTrashed(true); } catch (e) {}

  borrarFilasDonde(getMaestro().getSheetByName('Clientes'), 'id_cliente', idCliente);
  borrarFilasDonde(getMaestro().getSheetByName('Aprobaciones_agregadas'), 'id', 'APR-TEST-1');
  borrarFilasDonde(getMaestro().getSheetByName('Tareas'), 'id_tarea', 'TAR-TEST-1');
  borrarFilasDonde(getMaestro().getSheetByName('Avisos'), 'mensaje', null, function (f) {
    return f.mensaje.indexOf('TEST') >= 0;
  });
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
