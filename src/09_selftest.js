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

    // Pre-clean: barre restos de corridas anteriores para que las aserciones no se
    // contaminen con un cliente/fila __TEST__ huérfano (Verificador). Va DESPUÉS de
    // setup() — limpiarTodoTest usa getMaestro() y reventaría en proyecto virgen (PURGA #15).
    limpiarTodoTest();
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
      .filter(function (f) { return f.id === 'APR-TEST-1' && f.cliente === nombrePrueba; });
    chk(agg.length === 1, 'aprobación pendiente del cliente aparece agregada en el maestro');
    chk(String(getConfig('ultima_sync_ok')) !== '', 'ultima_sync_ok seteado');

    // c) detector de vencidas escribe avisos (creamos una tarea vencida).
    // NB: se llama el detector directo, NO corridaDiaria() — en Etapa 2 esa encola
    // Vigía para clientes reales y consolida costos; correrla en el test tocaría producción.
    var shT = getMaestro().getSheetByName('Tareas');
    appendFila(shT, {
      id_tarea: 'TAR-TEST-1', id_proyecto: 'PRY-TEST', descripcion: 'tarea vencida test',
      prioridad: 'A', estado: 'en_curso', fecha_limite: '2020-01-01', fecha_creacion: '2020-01-01'
    });
    invalidarMapaPC();
    detectarVencimientos();
    var avisos = leerTabla(getMaestro().getSheetByName('Avisos'))
      .filter(function (f) { return String(f.mensaje).indexOf('TAR-TEST-1') >= 0; });
    chk(avisos.length >= 1, 'detectarVencimientos generó aviso de tarea vencida');

    // ── ETAPA 2 ───────────────────────────────────────────────────────────────
    // Releemos el Sheet del cliente con openByUrl FRESCO en cada aserción: las funciones
    // E2 escriben por su propia instancia (abrirCliente). La instancia cliSS abierta en (a)
    // no ve esas escrituras (cache de GAS de una instancia abierta ANTES del write);
    // open-after-write sí las ve. También se appendea/relee por instancia fresca.
    function aprCli() { return leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones')); }
    function regCli() { return leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Reglas')); }

    // E2-1) default-deny: crearAprobacion con monto y sin fila en Umbrales → PENDIENTE + P1.
    var apr1 = crearAprobacion(r.id_cliente, 'test', 'pago', { x: 1 }, { monto: 500, descripcion: 'pago test' });
    var aprRow = aprCli().filter(function (f) { return f.id === apr1.id; })[0];
    chk(!!aprRow && String(aprRow.estado).toLowerCase() === 'pendiente', 'E2-1 aprobación nace PENDIENTE');
    chk(apr1.patron === 'P1', 'E2-1 default-deny: monto sin umbral → P1 (' + apr1.patron + ')');

    // E2-4) regla desde excepción: nace 'propuesta' + P1; solo se activa al aprobar esa P1.
    var reg = crearReglaDesdeExcepcion(r.id_cliente, 'si X', 'hacer Y', 'test');
    var regRow = regCli().filter(function (f) { return f.id_regla === reg.id_regla; })[0];
    chk(!!regRow && String(regRow.estado) === 'propuesta', 'E2-4 regla nace "propuesta"');
    resolverAprobacion(r.id_cliente, reg.aprobacion.id, 'aprobada');
    var regRow2 = regCli().filter(function (f) { return f.id_regla === reg.id_regla; })[0];
    chk(regRow2 && String(regRow2.estado) === 'activa', 'E2-4 regla se activa SOLO tras aprobar la P1');

    // E2-2) expiración: pendiente con fecha de hace 8 días → "expirada", nada se ejecuta.
    appendFila(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones'), {
      id: 'APR-TEST-EXP', fecha_creacion: hace(8), cliente: nombrePrueba, modulo: 'test',
      patron: 'P1', tipo_accion: 'email', descripcion: 'expira test', payload: '{}', estado: 'pendiente'
    });
    SpreadsheetApp.flush();
    expirarAprobaciones(r.id_cliente); // acotado al cliente de prueba: no toca pendientes reales
    var expRow = aprCli().filter(function (f) { return f.id === 'APR-TEST-EXP'; })[0];
    chk(expRow && String(expRow.estado) === 'expirada', 'E2-2 pendiente >7d → expirada (el silencio no aprueba)');

    // E2-6) anonimización: email/teléfono salen tokenizados; el mapa revierte.
    var an = anonimizar('Escribir a ana@correo.com o al +34 600 123 456');
    chk(an.texto.indexOf('@correo.com') < 0 && /CLIENTA_EMAIL/.test(an.texto), 'E2-6 email anonimizado antes de salir');
    chk(desanonimizar(an.texto, an.mapa).indexOf('ana@correo.com') >= 0, 'E2-6 desanonimizar revierte');

    // Caso 7) cola durable: encolar + claim + ejecutar → completada (worker de prueba, no toca la cola real).
    var qid = encolar('__TESTWORKER__', 'noop', {});
    var tk = tomar_('__TESTWORKER__', 'test');
    chk(!!tk && tk.id === qid, 'caso7 claim atómico toma la tarea encolada');
    ejecutarTarea_(tk);
    var qrow = leerTabla(getMaestro().getSheetByName('Cola_tareas')).filter(function (f) { return f.id === qid; })[0];
    chk(qrow && String(qrow.estado) === 'completada', 'caso7 noop queda completada (drain-on-startup)');

    // Caso 10) laboratorio: agente no activo → error honesto, nunca corre.
    var lab = correrAgente_('flux', {}, 'TST', r.id_cliente);
    chk(lab.status === 'error' && /laboratorio/i.test(lab.detalle), 'caso10 agente de laboratorio no corre');

    // Caso 12) runner contra cliente sin datos → "sin datos aún", jamás inventa (sin llamar API).
    var sd = correrAgente_('vigia', {}, 'TST', r.id_cliente);
    chk(sd.status === 'completado' && sd.detalle === 'sin datos aún', 'caso12 sin datos = honesto');

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
  var idsTest = {}; testClientes.forEach(function (c) { idsTest[String(c.id_cliente)] = true; });
  testClientes.forEach(function (c) {
    try {
      if (c.url_sheet_cliente) {
        DriveApp.getFileById(SpreadsheetApp.openByUrl(c.url_sheet_cliente).getId()).setTrashed(true);
      }
    } catch (e) { Logger.log('No pude mandar a papelera ' + c.id_cliente + ': ' + e.message); }
  });

  borrarFilasDonde(shClientes, function (f) { return String(f.nombre).indexOf('__TEST__') === 0; });
  borrarFilasDonde(ss.getSheetByName('Aprobaciones_agregadas'), function (f) { return String(f.id).indexOf('APR-TEST') === 0; });
  borrarFilasDonde(ss.getSheetByName('Tareas'), function (f) { return String(f.id_tarea).indexOf('TAR-TEST') === 0; });
  // PURGA #14: acotar a marcadores de prueba (TAR-TEST/APR-TEST), nunca a un
  // 'TEST' suelto en el mensaje — borraría avisos reales que mencionen "test".
  borrarFilasDonde(ss.getSheetByName('Avisos'), function (f) {
    var m = String(f.mensaje);
    return m.indexOf('TAR-TEST') >= 0 || m.indexOf('APR-TEST') >= 0;
  });
  // ETAPA 2: cola de prueba (noop / worker de test) y feed del cliente de prueba.
  borrarFilasDonde(ss.getSheetByName('Cola_tareas'), function (f) {
    return String(f.tipo) === 'noop' || String(f.worker) === '__TESTWORKER__';
  });
  borrarFilasDonde(ss.getSheetByName('Actividad'), function (f) { return idsTest[String(f.id_cliente)] === true; });
  return { clientes: testClientes.length };
}

/** Borra filas de una pestaña según un predicado. PURGA #25: era (sh,columna,valor,pred)
 * con la rama por igualdad muerta — todos los llamadores usaban solo pred. */
function borrarFilasDonde(sh, pred) {
  var filas = leerTabla(sh);
  // de abajo hacia arriba para no desfasar índices
  for (var i = filas.length - 1; i >= 0; i--) {
    if (pred(filas[i])) sh.deleteRow(filas[i]._fila);
  }
}
