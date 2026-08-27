/* Satori OS · shim de google.script.run → fetch al API JSON de GAS.
 * Objetivo: que el index.html actual (cientos de llamadas
 *   google.script.run.withSuccessHandler(cb).withFailureHandler(eb).fn(args))
 * funcione SIN reescribirlo, apuntando a un API JSON de GAS (doPost) desde
 * el front servido en Netlify (mismo origen que el shim).
 *
 * Contrato del API (doPost): recibe JSON {fn, args, token} y responde
 *   {ok:true, data:<retorno>} | {ok:false, error:"..."}.
 * Se envía como text/plain para EVITAR el preflight CORS (GAS no maneja OPTIONS).
 */
(function (global) {
  var CFG = global.SATORI = global.SATORI || {};
  // CFG.API_URL  = "<web app /exec del API JSON>"   (se setea antes de cargar el shim)
  // CFG.getToken = function(){ return "<token>"; }  (o CFG.TOKEN string)

  function token() {
    if (typeof CFG.getToken === 'function') return CFG.getToken();
    return CFG.TOKEN || '';
  }

  function call(fn, args, succ, fail, uobj) {
    var url = CFG.API_URL;
    if (!url) { if (fail) fail(new Error('SATORI.API_URL sin configurar'), uobj); return; }
    global.fetch(url, {
      method: 'POST',
      // text/plain = request "simple" → sin preflight OPTIONS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args, token: token() })
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) { if (succ) succ(res.data, uobj); }
        else { if (fail) fail(new Error((res && res.error) || 'API error'), uobj); }
      })
      .catch(function (e) { if (fail) fail(e, uobj); });
  }

  // Cada acceso a google.script.run devuelve un runner NUEVO (estado aislado por cadena).
  function makeRunner() {
    var succ = null, fail = null, uobj;
    var handler = {
      get: function (t, prop) {
        if (prop === 'withSuccessHandler') return function (f) { succ = f; return runner; };
        if (prop === 'withFailureHandler') return function (f) { fail = f; return runner; };
        if (prop === 'withUserObject')     return function (o) { uobj = o; return runner; };
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
        // cualquier otra prop = nombre de función server-side
        return function () { call(prop, [].slice.call(arguments), succ, fail, uobj); return runner; };
      }
    };
    var runner = new Proxy(function () {}, handler);
    return runner;
  }

  global.google = global.google || {};
  global.google.script = global.google.script || {};
  Object.defineProperty(global.google.script, 'run', { configurable: true, get: makeRunner });
  // host: no-ops (en Netlify no hay host GAS)
  global.google.script.host = global.google.script.host || {
    close: function () {}, setHeight: function () {}, editor: { focus: function () {} },
    origin: '', setWidth: function () {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
