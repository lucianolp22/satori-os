/**
 * 07_util.js — Helpers compartidos. Sin estado propio; todo deriva del MAESTRO.
 */

var TZ = 'Europe/Madrid';

/** Devuelve el Spreadsheet MAESTRO o lanza si setup() no corrió aún. */
function getMaestro() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_MAESTRO_ID);
  if (!id) throw new Error('MAESTRO no inicializado. Corré setup() una vez.');
  return SpreadsheetApp.openById(id);
}

/** Fecha-hora ISO local (Europe/Madrid), p.ej. 2026-06-10T14:37:02. */
function ahoraISO() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

/** Fecha ISO local YYYY-MM-DD. */
function hoyISO() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/** Mes ISO YYYY-MM. */
function mesISO() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
}

/**
 * Normaliza un valor de fecha leído de Sheets a 'yyyy-MM-dd' para comparar.
 * Sheets auto-convierte strings tipo fecha a objetos Date al leer con
 * getValues(); String(Date) NO es ISO y rompe la comparación lexicográfica.
 * Acepta Date o string; '' si vacío.
 */
function aFechaISO(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return String(v).substring(0, 10);
}

/**
 * Garantiza una pestaña con encabezados. Idempotente: crea si falta,
 * escribe la fila de encabezados solo si está vacía. Devuelve el Sheet.
 */
function ensureSheet(ss, nombre, headers) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0 && headers && headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f0f0f0');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
  aplicarFormatoTexto(sh); // IDs/claves como texto plano (evita coerción a fecha; ver COLUMNAS_TEXTO)
  return sh;
}

/**
 * Fija formato texto ('@') en las columnas tipo-ID de una pestaña (según su fila de
 * encabezados real y COLUMNAS_TEXTO). Idempotente. Aplica a toda la columna para que
 * los appendRow futuros hereden el formato y no coaccionen 'APR-0001' a fecha.
 */
function aplicarFormatoTexto(sh) {
  if (sh.getLastColumn() < 1 || sh.getLastRow() < 1) return;
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var max = sh.getMaxRows();
  for (var i = 0; i < hdr.length; i++) {
    if (COLUMNAS_TEXTO.indexOf(String(hdr[i])) >= 0) {
      sh.getRange(1, i + 1, max, 1).setNumberFormat('@');
    }
  }
}

/** Lee una pestaña como array de objetos {header: valor}. Excluye la fila 1. */
function leerTabla(sh) {
  var rng = sh.getDataRange().getValues();
  if (rng.length < 2) return [];
  var headers = rng[0];
  var out = [];
  for (var r = 1; r < rng.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = rng[r][c];
    obj._fila = r + 1;
    out.push(obj);
  }
  return out;
}

/** Append de una fila respetando el orden de encabezados de la pestaña. */
function appendFila(sh, objeto) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var fila = headers.map(function (h) { return sanitizarCelda(objeto.hasOwnProperty(h) ? objeto[h] : ''); });
  sh.appendRow(fila);
  // E2-1 (causa raíz real): appendRow IGNORA el formato '@' de la columna y coacciona los
  // strings tipo-fecha al colocarlos ('APR-0001' → Date abril-2001), por lo que el id releído
  // no matchea. Por eso a6e641e (que solo formateaba la columna) NO alcanzó. Re-escribir las
  // celdas COLUMNAS_TEXTO de la fila recién creada como texto explícito: setValue sobre una
  // celda '@' SÍ respeta el formato. Solo toca columnas tipo-ID; fechas/montos quedan como
  // están (E1 está verificada con su comportamiento Date/number).
  // Purga M1: appendRow+getLastRow+setValue NO es atómico → para columnas tipo-ID
  // coercibles, llamar appendFila bajo conLock (crearAprobacion/crearCliente ya lo hacen).
  var fila_n = sh.getLastRow();
  for (var i = 0; i < headers.length; i++) {
    if (COLUMNAS_TEXTO.indexOf(String(headers[i])) >= 0) {
      sh.getRange(fila_n, i + 1).setNumberFormat('@').setValue(fila[i]);
    }
  }
}

/**
 * Mitiga formula/CSV injection (PURGA #1). Una celda string que empieza con
 * = + - @ la interpreta Sheets como fórmula al escribirla; un `=...` que cruce
 * de un Sheet cliente al MAESTRO vía sync se evaluaría. Prefijar `'` la deja
 * como texto literal. Solo afecta strings — números/fechas-Date pasan intactos.
 */
function sanitizarCelda(v) {
  if (typeof v === 'string' && v.length > 0 && '=+-@'.indexOf(v.charAt(0)) >= 0) {
    return "'" + v;
  }
  return v;
}

/**
 * Ejecuta fn() bajo ScriptLock (PURGA #4). Serializa secciones lee-max-escribe
 * (nextId + appendFila) para que trigger y corrida manual solapados no generen
 * IDs duplicados. No reentrante: lockear en los callers (crearAviso/crearCliente),
 * nunca anidado dentro de nextId.
 */
function conLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // 20 s; lanza si no lo consigue (mejor que correr sin lock)
  try { return fn(); }
  finally { lock.releaseLock(); }
}

/**
 * Abre el Sheet de un cliente por id. Devuelve { cli (fila de Clientes), ss }.
 * Punto único para no duplicar el patrón leerTabla+openByUrl en costos/aprobaciones/agentes.
 */
function abrirCliente(idCliente) {
  var cli = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (f) {
    return f.id_cliente === idCliente;
  })[0];
  if (!cli || !cli.url_sheet_cliente) throw new Error('cliente ' + idCliente + ' sin Sheet');
  return { cli: cli, ss: SpreadsheetApp.openByUrl(cli.url_sheet_cliente) };
}

/** Lee un valor de Config por clave (string). '' si no existe. */
function getConfig(clave) {
  var sh = getMaestro().getSheetByName('Config');
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) if (vals[i][0] === clave) return String(vals[i][1]);
  return '';
}

/** Escribe (upsert) un valor de Config por clave. */
function setConfig(clave, valor) {
  var sh = getMaestro().getSheetByName('Config');
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
  }
  sh.appendRow([clave, valor]);
}

/**
 * Genera el siguiente ID correlativo con prefijo, mirando una columna.
 * Ej: nextId(shClientes, 'id_cliente', 'CLI', 3) → 'CLI-001'.
 */
function nextId(sh, columna, prefijo, ancho) {
  ancho = ancho || 3;
  var filas = leerTabla(sh);
  var max = 0;
  filas.forEach(function (f) {
    var v = String(f[columna] || '');
    var m = v.match(new RegExp('^' + prefijo + '-(\\d+)'));
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  var num = String(max + 1);
  while (num.length < ancho) num = '0' + num;
  return prefijo + '-' + num;
}

/**
 * Protege una pestaña (warningOnly opcional). Idempotente.
 * PURGA #7: en protección dura (warningOnly=false) quitamos editores explícitos —
 * hidden NO es control de acceso. Cuando en Etapa 3 se comparta el Sheet con el
 * dueño del negocio, un editor podría des-ocultar y editar Aprobaciones/Costos si
 * no se le retira el permiso de la pestaña. El owner del Sheet sigue pudiendo
 * gestionarla (no se puede auto-excluir), que es justo lo que queremos.
 */
function protegerSheet(sh, warningOnly) {
  var prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  var p = prots.length ? prots[0] : sh.protect();
  p.setDescription('Satori OS — estructura gestionada por el MAESTRO');
  p.setWarningOnly(!!warningOnly);
  if (!warningOnly) {
    try {
      p.removeEditors(p.getEditors());
      if (p.canDomainEdit && p.canDomainEdit()) p.setDomainEdit(false);
    } catch (e) { /* sin editores que quitar o sin dominio: no-op */ }
  }
  return p;
}
