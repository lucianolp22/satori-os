/** Satori OS · API JSON para la PWA. DRAFT — Fase 1 de PLAN-C.
 *  ⚠️ BASTIÓN debe revisar ANTES de desplegar. Este archivo va en un
 *  deployment SEPARADO del editor (el editor sigue DOMAIN); este API se
 *  despliega access=ANYONE y se cierra con TOKEN (patrón portal-token-gas).
 *
 *  Contrato: POST text/plain con JSON {fn, args, token}
 *    → {ok:true, data:<retorno>} | {ok:false, error:"..."}
 */

// SOLO estas funciones quedan expuestas. NADA de dispatch arbitrario.
// (poblar con las que el index.html realmente llama: lecturas + escrituras aprobadas)
var API_WHITELIST = {
  // lecturas
  datosCliente: 1, fichaCliente: 1, hiloCliente: 1, agendaRango: 1, checklistCliente: 1,
  briefCliente: 1, cerebroGrafo: 1, vigilanciaCliente: 1, listaClientes: 1, estadoAgentes: 1,
  // escrituras (requieren token con scope de escritura — ver _tokenScope_)
  guardarTarea: 'w', moverTarea: 'w', crearProyecto: 'w', capturarBandeja: 'w'
};

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var scope = _tokenScope_(body.token);            // '', 'r', 'w'
    if (!scope) return _json_({ ok: false, error: 'unauthorized' });
    var fn = String(body.fn || '');
    var need = API_WHITELIST[fn];
    if (!need) return _json_({ ok: false, error: 'fn no permitida' });
    if (need === 'w' && scope !== 'w') return _json_({ ok: false, error: 'token sin escritura' });
    var args = Array.isArray(body.args) ? body.args : [];
    var fnRef = _resolveFn_(fn);
    if (typeof fnRef !== 'function') return _json_({ ok: false, error: 'fn inexistente' });
    var data = fnRef.apply(null, args);
    return _json_({ ok: true, data: data });
  } catch (err) {
    return _json_({ ok: false, error: String((err && err.message) || err) });
  }
}

// GET sanity (no expone datos). Útil para el healthcheck del SW / smoke.
function doGet() { return _json_({ ok: true, data: { service: 'satori-api', v: 1 } }); }

function _json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Token → scope. Comparación en tiempo ~constante contra Script Properties.
 *  Propiedades: SATORI_API_TOKEN_R (lectura), SATORI_API_TOKEN_W (lectura+escritura).
 *  Bastión: rotación, jamás en git/claro, rate-limit por CacheService, HTTPS only. */
function _tokenScope_(tok) {
  tok = String(tok || '');
  if (!tok) return '';
  var P = PropertiesService.getScriptProperties();
  if (_eq_(tok, P.getProperty('SATORI_API_TOKEN_W'))) return 'w';
  if (_eq_(tok, P.getProperty('SATORI_API_TOKEN_R'))) return 'r';
  return '';
}
function _eq_(a, b) {                       // comparación tiempo-constante
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var r = 0; for (var i = 0; i < a.length; i++) r |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return r === 0;
}
function _resolveFn_(name) {                 // GAS: las funciones globales cuelgan del scope
  try { return eval(name); } catch (e) { return null; }   // Bastión: name ya validado contra whitelist
}
