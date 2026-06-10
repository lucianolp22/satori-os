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
  return sh;
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
  var fila = headers.map(function (h) { return objeto.hasOwnProperty(h) ? objeto[h] : ''; });
  sh.appendRow(fila);
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

/** Protege una pestaña (warningOnly opcional). Idempotente. */
function protegerSheet(sh, warningOnly) {
  var prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  var p = prots.length ? prots[0] : sh.protect();
  p.setDescription('Satori OS — estructura gestionada por el MAESTRO');
  p.setWarningOnly(!!warningOnly);
  return p;
}
