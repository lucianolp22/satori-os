/**
 * 02_setup.js — Inicialización del Sheet MAESTRO.
 *
 * setup(): idempotente. Crea el Spreadsheet MAESTRO la primera vez y guarda su
 * ID en Script Properties; en corridas siguientes lo reutiliza y repara pestañas
 * faltantes. Corre a mano una sola vez desde el editor (o vía clasp run).
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_MAESTRO_ID);
  var ss;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); }
    catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(MAESTRO_NOMBRE);
    props.setProperty(PROP_MAESTRO_ID, ss.getId());
    ss.setSpreadsheetTimeZone(TZ);
  }

  // Crear/reparar pestañas en orden.
  MAESTRO_ORDEN.forEach(function (nombre) {
    ensureSheet(ss, nombre, MAESTRO_SHEETS[nombre]);
  });

  // Sembrar Config con defaults que falten (no pisa valores existentes).
  var shConfig = ss.getSheetByName('Config');
  var existentes = {};
  leerTabla(shConfig).forEach(function (f) { existentes[f.clave] = true; });
  CONFIG_DEFAULTS.forEach(function (par) {
    if (!existentes[par[0]]) shConfig.appendRow([par[0], par[1]]);
  });

  // Quitar la pestaña por defecto "Sheet1"/"Hoja 1" si quedó vacía.
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1') || ss.getSheetByName('Hoja1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }

  var url = ss.getUrl();
  Logger.log('MAESTRO listo: ' + url);
  return { id: ss.getId(), url: url, pestanas: ss.getSheets().map(function (s) { return s.getName(); }) };
}

/** Devuelve la URL del MAESTRO (útil para abrirlo desde logs). */
function urlMaestro() {
  var u = getMaestro().getUrl();
  Logger.log(u);
  return u;
}
