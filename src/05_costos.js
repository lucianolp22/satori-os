/**
 * 05_costos.js — Wrapper de costos de API (STUB, se completa en Etapa 2).
 *
 * Regla (handoff 1.6): TODA UrlFetch del sistema pasa por llamadaAPI(), que
 * loguea timestamp, módulo, endpoint, tokens in/out y USD en la pestaña
 * Costos_API del Sheet del cliente — incluidas las llamadas fallidas.
 *
 * En Etapa 1 es un esqueleto funcional: hace el fetch real, loguea lo que puede
 * medir (no estima tokens todavía) y nunca pierde el registro de una falla.
 */

/**
 * @param {string} idCliente  p.ej. 'CLI-002'
 * @param {string} modulo     nombre lógico del flujo que llama
 * @param {Object} opciones   { url, params (UrlFetchApp), endpoint, tokens_in, tokens_out, usd }
 * @return {Object} { ok, status, body, error }
 */
function llamadaAPI(idCliente, modulo, opciones) {
  opciones = opciones || {};
  var ts = ahoraISO();
  var endpoint = opciones.endpoint || opciones.url || '';
  var resultado = { ok: false, status: null, body: null, error: null };

  try {
    var params = opciones.params || {};
    params.muteHttpExceptions = true;
    var resp = UrlFetchApp.fetch(opciones.url, params);
    resultado.status = resp.getResponseCode();
    resultado.body = resp.getContentText();
    resultado.ok = resultado.status >= 200 && resultado.status < 300;
  } catch (e) {
    resultado.error = e.message;
  }

  // Loguear SIEMPRE (también fallidas) en el Sheet del cliente.
  try {
    logCostoCliente(idCliente, {
      timestamp: ts,
      modulo: modulo,
      endpoint: endpoint + (resultado.ok ? '' : ' [' + (resultado.status || 'ERR') + ']'),
      tokens_in: opciones.tokens_in || '',
      tokens_out: opciones.tokens_out || '',
      USD: opciones.usd || ''
    });
  } catch (e) {
    Logger.log('No se pudo loguear costo de ' + idCliente + ': ' + e.message);
  }

  return resultado;
}

/** Escribe una fila en Costos_API del Sheet del cliente indicado. */
function logCostoCliente(idCliente, fila) {
  var cli = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (f) {
    return f.id_cliente === idCliente;
  })[0];
  if (!cli || !cli.url_sheet_cliente) throw new Error('cliente ' + idCliente + ' sin Sheet');
  var sh = SpreadsheetApp.openByUrl(cli.url_sheet_cliente).getSheetByName('Costos_API');
  appendFila(sh, fila);
}
