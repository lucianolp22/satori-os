/**
 * 08_webapp.js — Punto de entrada Web App (acceso "solo yo", ejecutar como yo).
 *
 * ⚠️ PRECONDICIÓN (handoff paso 8): la vista "Hoy" y el panel por cliente NO se
 * construyen hasta leer /DESIGN.md (registro B: herramienta operativa interna,
 * vanilla GAS-compatible). Por ahora doGet devuelve solo un resumen de estado en
 * texto para confirmar el deploy — sin UI definitiva. El backend no depende de esto.
 */
function doGet() {
  var data = estadoSistema();
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Satori OS</title></head><body style="font-family:monospace;padding:24px">' +
    '<h2>Satori OS — MAESTRO</h2>' +
    '<p>Backend operativo. La vista «Hoy» se construye tras leer DESIGN.md.</p>' +
    '<pre>' + JSON.stringify(data, null, 2) + '</pre>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Satori OS');
}

/** Resumen de estado para la futura vista "Hoy" (incluye ultima_sync_ok). */
function estadoSistema() {
  var ss = getMaestro();
  var avisosActivos = leerTabla(ss.getSheetByName('Avisos')).filter(function (f) { return f.estado === 'activo'; });
  var pendientes = leerTabla(ss.getSheetByName('Aprobaciones_agregadas')).length;
  return {
    clientes: leerTabla(ss.getSheetByName('Clientes')).length,
    proyectos: leerTabla(ss.getSheetByName('Proyectos')).length,
    tareas: leerTabla(ss.getSheetByName('Tareas')).length,
    avisos_activos: avisosActivos.length,
    aprobaciones_pendientes: pendientes,
    ultima_sync_ok: getConfig('ultima_sync_ok'),
    ultima_sync_estado: getConfig('ultima_sync_estado'),
    ultima_corrida_avisos: getConfig('ultima_corrida_avisos')
  };
}
