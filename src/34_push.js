/**
 * 34_push.js — Canal de push al teléfono de Luciano (proactividad, decisión 26-ago).
 *
 * Helper PRIVADO (guión bajo → no aparece en el dropdown del editor, no es client-callable →
 * NO va a ENDPOINTS_UI ni lleva _soloOwner_). Lo llaman server-side corridaDiaria / encargos.
 *
 * Bastión:
 *  - Credenciales SOLO en Script Properties (nunca en repo): PUSH_PROVIDER ('pushover'|'ntfy'),
 *    PUSHOVER_TOKEN, PUSHOVER_USER, NTFY_TOPIC (o NTFY_URL para server propio), NTFY_TOKEN
 *    (opcional, E1-bis 27-ago: autentica la request y la saca de la cuota por IP → sin 429).
 *  - PII-FREE: el `cuerpo` es un nudge, jamás cifras/datos crudos de cliente (el detalle vive en CM/voz).
 *  - Fail-open silencioso: si falta credencial o el POST falla, NO tumba la corrida (try/catch + no-op).
 *
 * Cowork 26-ago: ladrillo base del ENCARGO-CODE-CAPACIDADES-SATO-2026-08-26. Pendiente de cablear
 * (1.1 encargo listo, 1.2 push proactivo 07:00) y de que Luciano cargue el token. Deploy = Code.
 *
 * @param {string} titulo  Título corto del push.
 * @param {string} cuerpo  Nudge PII-free (1-2 frases).
 * @return {{enviado:boolean, motivo:string}}
 */
function _pushTelefono_(titulo, cuerpo) {
  try {
    var props = PropertiesService.getScriptProperties();
    var provider = String(props.getProperty('PUSH_PROVIDER') || '').toLowerCase();
    if (!provider) return { enviado: false, motivo: 'PUSH_PROVIDER no seteado (no-op)' };

    var t = String(titulo || 'Satori').slice(0, 120);
    var msg = String(cuerpo || '').slice(0, 900);
    if (!msg) return { enviado: false, motivo: 'cuerpo vacío' };

    if (provider === 'pushover') {
      var token = props.getProperty('PUSHOVER_TOKEN');
      var user = props.getProperty('PUSHOVER_USER');
      if (!token || !user) return { enviado: false, motivo: 'faltan PUSHOVER_TOKEN/USER (no-op)' };
      var rP = UrlFetchApp.fetch('https://api.pushover.net/1/messages.json', {
        method: 'post',
        payload: { token: token, user: user, title: t, message: msg },
        muteHttpExceptions: true
      });
      var okP = rP.getResponseCode() === 200;
      return { enviado: okP, motivo: okP ? 'pushover ok' : 'pushover HTTP ' + rP.getResponseCode() };
    }

    if (provider === 'ntfy') {
      var topic = props.getProperty('NTFY_TOPIC');
      var base = props.getProperty('NTFY_URL') || 'https://ntfy.sh';
      if (!topic) return { enviado: false, motivo: 'falta NTFY_TOPIC (no-op)' };
      // E1-bis (27-ago) — FIX DEL 429. ntfy.sh cuotea por IP, y la IP saliente de Apps Script es
      // compartida con medio mundo: el 429 no era nuestro volumen, era el del vecindario. Una
      // request AUTENTICADA se cuotea contra la cuenta, no contra la IP. De paso cierra el caveat
      // del topic público (un topic adivinable lo puede leer cualquiera; con token, no).
      // El token es OPCIONAL: sin `NTFY_TOKEN` la rama funciona igual que antes (topic anónimo).
      var hdrsN = { Title: t };
      var tokN = props.getProperty('NTFY_TOKEN');
      if (tokN) hdrsN.Authorization = 'Bearer ' + tokN;
      var rN = UrlFetchApp.fetch(base.replace(/\/+$/, '') + '/' + encodeURIComponent(topic), {
        method: 'post',
        contentType: 'text/plain; charset=utf-8',
        headers: hdrsN,
        payload: msg,
        muteHttpExceptions: true
      });
      var okN = rN.getResponseCode() === 200;
      return { enviado: okN, motivo: okN ? 'ntfy ok' : 'ntfy HTTP ' + rN.getResponseCode() };
    }

    return { enviado: false, motivo: 'PUSH_PROVIDER desconocido: ' + provider };
  } catch (e) {
    try { Logger.log('_pushTelefono_ fallo: ' + e.message); } catch (_e) {}
    return { enviado: false, motivo: 'excepción: ' + String(e && e.message) };
  }
}


/**
 * WRAPPER DE PRUEBA — sin argumentos y sin guión bajo final, para que aparezca en el desplegable
 * del editor y se pueda correr a mano. Regla dura de CLAUDE.md §«Funciones que corre Luciano a
 * mano»: el desplegable (a) no lista las que terminan en `_` y (b) las corre SIN pasar nada, así
 * que `_pushTelefono_(titulo, cuerpo)` era incorrible tal cual — 4ª vez de la misma clase
 * (`sgicConsulta_` · `selfTestF2_` · `selfTestTramo(n)` · ésta).
 *
 * Devuelve el diagnóstico COMPLETO, no solo el resultado: si no hay provider configurado lo dice
 * con nombre y propiedad faltante, en vez de un `enviado:false` mudo que no orienta a nada.
 * Read-only sobre la config: no escribe una sola Script Property.
 */
function probarPushTelefono() {
  _soloOwner_('probarPushTelefono');
  var props = PropertiesService.getScriptProperties();
  var provider = String(props.getProperty('PUSH_PROVIDER') || '').toLowerCase();
  var out = {
    provider: provider || '(sin setear)',
    // Se reporta la PRESENCIA de cada credencial, NUNCA su valor (Bastión: un token en el
    // Registro de ejecuciones es un token filtrado).
    config: {
      PUSH_PROVIDER: !!provider,
      PUSHOVER_TOKEN: !!props.getProperty('PUSHOVER_TOKEN'),
      PUSHOVER_USER: !!props.getProperty('PUSHOVER_USER'),
      NTFY_TOPIC: !!props.getProperty('NTFY_TOPIC'),
      NTFY_TOKEN: !!props.getProperty('NTFY_TOKEN')   // E1-bis: opcional, pero es lo que evita el 429 por IP compartida
    }
  };
  if (!provider) {
    out.resultado = { enviado: false, motivo: 'PUSH_PROVIDER no seteado (no-op)' };
    out.que_falta = 'Cargá PUSH_PROVIDER = "pushover" o "ntfy" en Script Properties, más sus credenciales.';
  } else {
    out.resultado = _pushTelefono_('Satori — prueba', 'Si leés esto en el teléfono, el canal de push funciona.');
    if (!out.resultado.enviado) out.que_falta = 'El provider está seteado pero el envío falló: ' + out.resultado.motivo;
  }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
