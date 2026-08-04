/**
 * 02_setup.js — Inicialización del Sheet MAESTRO.
 *
 * setup(): idempotente. Crea el Spreadsheet MAESTRO la primera vez y guarda su
 * ID en Script Properties; en corridas siguientes lo reutiliza y repara pestañas
 * faltantes. Corre a mano una sola vez desde el editor (o vía clasp run).
 */
function setup() {
  _soloOwner_('setup');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
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

  // TC-9 · Forge: `Agentes_estado` decide qué agentes pueden correr y gastar API. Se protege y se
  // oculta por la misma razón que las hojas sensibles del cliente: no es una hoja para editar a
  // mano de pasada. Los caminos legítimos son `promoverAgente` (con aprobación) y `demoverAgente`.
  // Idempotente y no fatal: si la protección falla, el sistema funciona igual — pero se registra.
  try {
    var shAg = ss.getSheetByName('Agentes_estado');
    if (shAg) { protegerSheet(shAg, false); if (!shAg.isSheetHidden()) shAg.hideSheet(); }
  } catch (eAg) { try { Logger.log('Agentes_estado sin proteger/ocultar: ' + eAg.message); } catch (_e) {} }

  // Quitar la pestaña por defecto "Sheet1"/"Hoja 1" si quedó vacía.
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1') || ss.getSheetByName('Hoja1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }

  // 04-ago: repara los `id_decision` que quedaron como fecha antes de que `id_decision` entrara a
  // COLUMNAS_TEXTO. Idempotente y no fatal — `setup()` es el camino que corre TODO tramo del
  // selfTest antes de aserir, así que el arreglo llega solo sin pedirle a nadie que lo invoque.
  var idsDec = _repararIdsDecisiones_();
  if (idsDec.reparadas) Logger.log('setup: ids de Decisiones reparados → ' + JSON.stringify(idsDec.detalle));

  var url = ss.getUrl();
  Logger.log('MAESTRO listo: ' + url);
  return { id: ss.getId(), url: url, ids_decision_reparados: idsDec.reparadas,
           pestanas: ss.getSheets().map(function (s) { return s.getName(); }) };
}

/** Devuelve la URL del MAESTRO (útil para abrirlo desde logs). */
function urlMaestro() {
  _soloOwner_('urlMaestro');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var u = getMaestro().getUrl();
  Logger.log(u);
  return u;
}

/**
 * Repara el formato texto de columnas tipo-ID en pestañas YA existentes: MAESTRO + cada
 * Sheet cliente. Lo llama bootstrap() (las pestañas nuevas ya nacen bien vía ensureSheet).
 * No reescribe valores: solo aplica formato '@' a las columnas de COLUMNAS_TEXTO.
 */
function repararFormatosTexto() {
  _soloOwner_('repararFormatosTexto');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var ss = getMaestro();
  MAESTRO_ORDEN.forEach(function (n) { var sh = ss.getSheetByName(n); if (sh) aplicarFormatoTexto(sh); });
  var idsRep = _repararIdsDecisiones_();   // el formato solo, sin esto, deja el dato ya corrompido adentro
  var n = 0;
  leerTabla(ss.getSheetByName('Clientes')).forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    try {
      var cs = SpreadsheetApp.openByUrl(c.url_sheet_cliente);
      CLIENTE_ORDEN.forEach(function (p) { var sh = cs.getSheetByName(p); if (sh) aplicarFormatoTexto(sh); });
      n++;
    } catch (e) { Logger.log('repararFormatosTexto ' + c.id_cliente + ': ' + e.message); }
  });
  Logger.log('repararFormatosTexto: MAESTRO + ' + n + ' cliente(s) · ids reparados: ' + idsRep.reparadas);
  return { clientes: n, ids_reparados: idsRep.reparadas, detalle_ids: idsRep.detalle };
}

/**
 * Repara los `id_decision` que Sheets ya coercionó a fecha (incidente 04-ago: `DEC-0001` leído
 * como «1 de diciembre de 2001», porque `id_decision` no estaba en COLUMNAS_TEXTO).
 *
 * Poner la columna en formato '@' arregla lo que se escriba de ahora en más, pero NO desarma lo
 * que ya está adentro: la fila real del 03-ago quedó con una fecha donde va un id, y por eso
 * D32e/f/f3/f4 no podían matchear. Esto lo reescribe.
 *
 * IDEMPOTENTE: una fila con un id válido (`DEC-\d+`) no se toca. El id nuevo se genera del máximo
 * VÁLIDO existente + 1, así no pisa a otra fila ni reusa un número vivo.
 * Es un repair de DATO, no de esquema: por eso vive acá y no en `ensureSheet`.
 */
function _repararIdsDecisiones_() {
  var out = { reparadas: 0, detalle: [] };
  try {
    var sh = getMaestro().getSheetByName('Decisiones');
    if (!sh) return out;
    aplicarFormatoTexto(sh);   // PRIMERO el formato: si no, el valor que reescribimos se vuelve a tipar
    var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    var iId = headers.indexOf('id_decision');
    if (iId < 0) return out;
    var filas = leerTabla(sh);
    var valido = /^DEC-\d+$/;
    var max = 0;
    filas.forEach(function (f) {
      var v = String(f.id_decision == null ? '' : f.id_decision);
      if (valido.test(v)) max = Math.max(max, parseInt(v.slice(4), 10) || 0);
    });
    filas.forEach(function (f) {
      var v = String(f.id_decision == null ? '' : f.id_decision);
      if (valido.test(v)) return;
      max++;
      var nuevo = 'DEC-' + ('0000' + max).slice(-4);
      sh.getRange(f._fila, iId + 1).setValue(nuevo);
      out.detalle.push({ fila: f._fila, antes: v.slice(0, 40), ahora: nuevo });
      out.reparadas++;
    });
  } catch (e) { try { Logger.log('_repararIdsDecisiones_: ' + e.message); } catch (_l) {} }
  return out;
}
