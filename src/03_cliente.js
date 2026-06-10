/**
 * 03_cliente.js — Alta de clientes y plantilla de Sheet cliente.
 *
 * crearCliente(): genera el Sheet del cliente con TODAS las pestañas estándar de
 * 0.3 de una (nunca a mano), lo registra en Clientes del MAESTRO y devuelve la
 * URL. Idempotente por nombre: si el cliente ya existe en Clientes, no duplica.
 */

/**
 * @param {Object} datos { nombre, rubro, estado, responsable_lado_cliente }
 * @return {Object} { id_cliente, url, ya_existia }
 */
function crearCliente(datos) {
  if (!datos || !datos.nombre) throw new Error('crearCliente: falta nombre.');
  var ss = getMaestro();
  var shClientes = ss.getSheetByName('Clientes');

  // ¿Ya registrado? (idempotencia por nombre, case-insensitive)
  var existentes = leerTabla(shClientes);
  var match = existentes.filter(function (f) {
    return String(f.nombre).toLowerCase() === String(datos.nombre).toLowerCase();
  })[0];
  if (match) {
    return { id_cliente: match.id_cliente, url: match.url_sheet_cliente, ya_existia: true };
  }

  var idCliente = nextId(shClientes, 'id_cliente', 'CLI', 3);

  // Crear el Spreadsheet del cliente con la plantilla completa.
  var clienteSS = SpreadsheetApp.create('Satori OS — ' + datos.nombre + ' [' + idCliente + ']');
  clienteSS.setSpreadsheetTimeZone(TZ);

  CLIENTE_ORDEN.forEach(function (nombre) {
    var sh = ensureSheet(clienteSS, nombre, CLIENTE_SHEETS[nombre]);
    // Ocultar + proteger pestañas sensibles (Auditor 0.3 #1).
    if (CLIENTE_SHEETS_SENSIBLES.indexOf(nombre) >= 0) {
      protegerSheet(sh, false);
      sh.hideSheet();
    } else {
      // Pestañas operativas/KPIs: protección con aviso (el cliente podría verlas
      // en Etapa 3; warningOnly evita lockouts mientras no esté compartido).
      protegerSheet(sh, true);
    }
  });

  // Quitar la pestaña por defecto vacía.
  var def = clienteSS.getSheetByName('Sheet1') || clienteSS.getSheetByName('Hoja 1') || clienteSS.getSheetByName('Hoja1');
  if (def && clienteSS.getSheets().length > 1) { try { clienteSS.deleteSheet(def); } catch (e) {} }

  // Registrar en el MAESTRO.
  appendFila(shClientes, {
    id_cliente: idCliente,
    nombre: datos.nombre,
    rubro: datos.rubro || '',
    estado: datos.estado || 'potencial',
    url_sheet_cliente: clienteSS.getUrl(),
    responsable_lado_cliente: datos.responsable_lado_cliente || '',
    fecha_alta: hoyISO()
  });

  Logger.log('Cliente ' + idCliente + ' (' + datos.nombre + '): ' + clienteSS.getUrl());
  return { id_cliente: idCliente, url: clienteSS.getUrl(), ya_existia: false };
}

/**
 * Carga inicial de los clientes reales (handoff paso 4). Idempotente.
 * @return {Array} resultados de cada crearCliente()
 */
function cargaInicialClientes() {
  var lista = [
    { nombre: 'FRANFLACA / Mesaquince', rubro: 'Gastronomía', estado: 'activo' },
    { nombre: 'Vehemence', rubro: 'E-commerce indumentaria', estado: 'activo-piloto' },
    { nombre: 'LC Travel', rubro: 'Turismo', estado: 'activo' },
    { nombre: 'Barbería Alex / DAM', rubro: 'Servicios', estado: 'activo' },
    { nombre: 'SIP Coffee Roasters', rubro: 'Café de especialidad', estado: 'potencial' }
  ];
  var res = lista.map(function (c) {
    var r = crearCliente(c);
    return { nombre: c.nombre, id_cliente: r.id_cliente, ya_existia: r.ya_existia, url: r.url };
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}
