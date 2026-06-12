/**
 * 04_sync.js — Agregación MAESTRO ← Sheets cliente (vía GAS, NO IMPORTRANGE).
 *
 * Lee la pestaña Aprobaciones de cada Sheet cliente y refleja las PENDIENTES en
 * Aprobaciones_agregadas del MAESTRO (solo lectura agregada — 0.3). El maestro
 * nunca escribe datos operativos en el cliente.
 *
 * Robustez (Auditor 0.3 #2 / 0.4): cursor en Config, ultima_sync_ok visible, y
 * si un cliente falla NO se aborta el lote ni se cae en silencio — se genera un
 * Aviso y se deja ultima_sync_estado = "parcial".
 */
function syncMaestro() {
  var ss = getMaestro();
  var shClientes = ss.getSheetByName('Clientes');
  var shAgg = ss.getSheetByName('Aprobaciones_agregadas');
  var clientes = leerTabla(shClientes);

  setConfig('ultima_sync_intento', ahoraISO());

  // PURGA #3: wipe-then-rebuild NO atómico. Acumulamos todas las filas en memoria
  // y recién al final limpiamos + escribimos de una. Si la lectura de un cliente
  // muere a mitad, el espejo viejo queda intacto (no aparece "0 pendientes" falso).
  var headers = shAgg.getRange(1, 1, 1, shAgg.getLastColumn()).getValues()[0];
  var filasAgg = [];

  var errores = [];
  var totalPend = 0;
  var ahora = ahoraISO();

  clientes.forEach(function (cli) {
    if (!cli.url_sheet_cliente) return;
    try {
      var cliSS = SpreadsheetApp.openByUrl(cli.url_sheet_cliente);
      var shAp = cliSS.getSheetByName('Aprobaciones');
      if (!shAp) throw new Error('falta pestaña Aprobaciones');
      var pendientes = leerTabla(shAp).filter(function (f) {
        return String(f.estado).toLowerCase() === 'pendiente';
      });
      pendientes.forEach(function (p) {
        var obj = {
          id: p.id,
          fecha_creacion: p.fecha_creacion,
          id_cliente: cli.id_cliente,
          cliente: cli.nombre,
          modulo: p.modulo,
          patron: p.patron,
          tipo_accion: p.tipo_accion,
          descripcion: p.descripcion,
          payload: p.payload,
          monto: p.monto,
          'confianza_%': p['confianza_%'],
          estado: p.estado,
          url_sheet_cliente: cli.url_sheet_cliente,
          sincronizado_en: ahora
        };
        filasAgg.push(headers.map(function (h) { return sanitizarCelda(obj.hasOwnProperty(h) ? obj[h] : ''); }));
        totalPend++;
      });
    } catch (e) {
      errores.push(cli.id_cliente + ': ' + e.message); // PURGA #24: sin nombre en log/aviso
    }
  });

  // Punto único de escritura: limpiar el espejo y volcar todo de una.
  if (shAgg.getLastRow() > 1) {
    shAgg.getRange(2, 1, shAgg.getLastRow() - 1, shAgg.getLastColumn()).clearContent();
  }
  if (filasAgg.length) {
    shAgg.getRange(2, 1, filasAgg.length, headers.length).setValues(filasAgg);
  }

  if (errores.length === 0) {
    setConfig('ultima_sync_ok', ahora);
    setConfig('ultima_sync_estado', 'ok (' + totalPend + ' pendientes)');
  } else {
    setConfig('ultima_sync_estado', 'parcial — ' + errores.length + ' cliente(s) con error');
    // Nunca fallo silencioso: avisar.
    crearAviso({
      origen: 'trigger',
      id_cliente: '',
      tipo: 'sync_error',
      mensaje: 'Sync parcial. Clientes con error: ' + errores.join(' | ')
    });
  }

  Logger.log('syncMaestro: ' + totalPend + ' pendientes, ' + errores.length + ' errores.');
  return { pendientes: totalPend, errores: errores };
}
