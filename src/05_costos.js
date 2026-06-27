/**
 * 05_costos.js — Wrapper de costos de API + Bastión de seguridad (ETAPA 2 · Módulos 2-3).
 *
 * TODA llamada a un proveedor externo pasa por llamadaAPI(), que:
 *   1. ANONIMIZA el prompt antes de enviarlo (emails/teléfonos de clientes finales → tokens).
 *   2. Hace el UrlFetch con la key desde Script Properties (jamás en código/Sheets).
 *   3. LOGUEA SIEMPRE (éxito y fallo) en Costos_API del Sheet del cliente: timestamp,
 *      módulo, endpoint, tokens in/out, USD según tarifario en Config.
 *   4. Devuelve la respuesta DES-anonimizada o un error tipado (sin stack trace al frontend).
 *
 * Consolidación mensual al MAESTRO (USD + EUR vía tipo_cambio_usd_eur de Config) y alerta
 * si el mes corriente supera el presupuesto configurado por cliente.
 */

var CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
var MODELO_DEFAULT = 'claude-haiku-4-5-20251001';   // triaje / alta frecuencia (barato)
var MODELO_SONNET  = 'claude-sonnet-4-6';            // veredicto / análisis con números
var MODELO_OPUS    = 'claude-opus-4-8';              // escalable vía Config; no ruteado por defecto

// Ruteo de modelo por costo (quick win): cada agente/flujo usa el modelo adecuado a su tarea.
// Triaje y alta frecuencia → Haiku; veredicto/razonamiento financiero → Sonnet. Override operativo
// sin deploy vía Config 'modelo_<modulo>' (p.ej. modelo_analista=claude-opus-4-8). Default = Haiku.
var MODELOS_POR_MODULO = { analista: MODELO_SONNET, conciliador: MODELO_SONNET };
function modeloDeModulo_(modulo) {
  var cfg = getConfig('modelo_' + modulo);
  if (cfg) return cfg;                                // Config pisa el código
  return MODELOS_POR_MODULO[modulo] || MODELO_DEFAULT;
}

// Tarifas USD por 1M tokens por modelo (verificadas docs.anthropic.com, jun-2026). Config
// 'tarifa_in/out_<modelo>' pisa. Default = Haiku para un modelo no listado (conservador).
var TARIFA_DEFAULT = { in: 1, out: 5 };               // Haiku 4.5
var TARIFAS = {
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-haiku-4-5':          { in: 1, out: 5 },
  'claude-sonnet-4-6':         { in: 3, out: 15 },
  'claude-opus-4-8':           { in: 5, out: 25 }
};

/**
 * Llama a Claude para un cliente, con anonimización + log + costeo.
 * @param {string} idCliente
 * @param {string} modulo    flujo/agente que llama (p.ej. 'vigia')
 * @param {Object} opts      { prompt, maxTokens?, modelo?, proveedor?, anonimizar? (def true) }
 * @return {{ok, texto, usd, tokens_in, tokens_out, status, error}}
 */
function llamadaAPI(idCliente, modulo, opts) {
  opts = opts || {};
  var ts = ahoraISO();
  var proveedor = opts.proveedor || 'anthropic';
  var modelo = opts.modelo || modeloDeModulo_(modulo);   // ruteo por agente/flujo (Config pisa)
  var prompt = String(opts.prompt || '');

  // 1) Anonimizar ANTES de salir (Bastión). El mapa de reversión es local, nunca se envía.
  var anon = (opts.anonimizar === false) ? { texto: prompt, mapa: {} } : anonimizar(prompt);

  var out = { ok: false, texto: '', usd: 0, tokens_in: 0, tokens_out: 0, status: null, error: null };

  try {
    var key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
    if (!key) {
      // Sin key configurada: modo simulado honesto (no inventa datos, no falla en silencio).
      out.error = 'CLAUDE_API_KEY no configurada en Script Properties';
      out.simulado = true;
    } else {
      var cuerpo = {
        model: modelo,
        max_tokens: opts.maxTokens || 800,
        messages: [{ role: 'user', content: anon.texto }]
      };
      // Blindaje prompt-injection: system es OPCIONAL y aditivo (5 callers viejos no lo mandan → payload idéntico).
      // El system NO se anonimiza: es una guardia estática sin PII ni datos del tenant.
      if (opts.system) cuerpo.system = String(opts.system);
      var resp = UrlFetchApp.fetch(CLAUDE_ENDPOINT, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify(cuerpo),
        muteHttpExceptions: true
      });
      out.status = resp.getResponseCode();
      if (out.status === 200) {
        var data = JSON.parse(resp.getContentText());
        out.tokens_in = data.usage ? (data.usage.input_tokens || 0) : 0;
        out.tokens_out = data.usage ? (data.usage.output_tokens || 0) : 0;
        var textoAnon = (data.content && data.content[0]) ? data.content[0].text : '';
        // 4) Des-anonimizar la respuesta antes de devolverla al sistema.
        out.texto = desanonimizar(textoAnon, anon.mapa);
        out.usd = costearUSD_(modelo, out.tokens_in, out.tokens_out);
        out.ok = true;
      } else {
        out.error = 'proveedor respondió ' + out.status; // genérico, sin cuerpo crudo
      }
    }
  } catch (e) {
    out.error = e.message;
  }

  // 3) Loguear SIEMPRE (también fallidas y simuladas) en el Sheet del cliente.
  try {
    logCostoCliente(idCliente, {
      timestamp: ts,
      modulo: modulo,
      endpoint: proveedor + '/' + modelo + (out.ok ? '' : ' [' + (out.status || (out.simulado ? 'SIMULADO' : 'ERR')) + ']'),
      tokens_in: out.tokens_in || '',
      tokens_out: out.tokens_out || '',
      USD: out.usd || ''
    });
  } catch (e) {
    Logger.log('No se pudo loguear costo de ' + idCliente + ': ' + e.message); // PURGA #24: id, sin nombre
  }

  return out;
}

/** USD de una llamada según tarifa de Config (tarifa_in_<modelo>/tarifa_out_<modelo>) o default. */
function costearUSD_(modelo, tin, tout) {
  var base = TARIFAS[modelo] || TARIFA_DEFAULT;        // tarifa real por modelo (no siempre Haiku)
  var ci = parseFloat(getConfig('tarifa_in_' + modelo)) || base.in;
  var co = parseFloat(getConfig('tarifa_out_' + modelo)) || base.out;
  return Math.round((tin / 1e6 * ci + tout / 1e6 * co) * 1e6) / 1e6;
}

/** Escribe una fila en Costos_API del Sheet del cliente indicado. */
function logCostoCliente(idCliente, fila) {
  var sh = abrirCliente(idCliente).ss.getSheetByName('Costos_API');
  if (!sh) throw new Error('cliente ' + idCliente + ' sin pestaña Costos_API');
  appendFila(sh, fila);
}

/* ============ Bastión: anonimización (Módulo 3) ============ */

/**
 * Sustituye PII de clientes finales (emails, teléfonos) por tokens estables dentro
 * de la llamada. El mapa de reversión queda en memoria; NUNCA se envía a la API.
 * Nombres: si se pasan en una lista (opts) se scrubean; sin lista, se cubren los
 * vectores de alto riesgo (email/teléfono) por patrón.
 * @return {{texto:string, mapa:Object}}  mapa: { token: valorOriginal }
 */
function anonimizar(texto, nombres) {
  texto = String(texto == null ? '' : texto);
  var mapa = {};
  var contadores = { EMAIL: 0, TEL: 0, NOM: 0 };

  function token(tipo) {
    contadores[tipo]++;
    var n = String(contadores[tipo]); while (n.length < 3) n = '0' + n;
    return 'CLIENTA_' + tipo + '_' + n;
  }
  function sustituir(re, tipo) {
    texto = texto.replace(re, function (m) {
      // reusar token si ya vimos este valor (estabilidad dentro de la llamada)
      for (var k in mapa) if (mapa[k] === m) return k;
      var t = token(tipo); mapa[t] = m; return t;
    });
  }

  // Nombres explícitos primero (más específicos), luego email, luego teléfono.
  if (nombres && nombres.length) {
    nombres.filter(Boolean).forEach(function (nom) {
      nom = String(nom).trim();
      if (nom.length < 2) return;
      var re = new RegExp(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      sustituir(re, 'NOM');
    });
  }
  sustituir(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, 'EMAIL');
  sustituir(/\+?\d[\d\s().\-]{7,}\d/g, 'TEL');

  return { texto: texto, mapa: mapa };
}

/** Revierte la anonimización sobre la respuesta del proveedor. */
function desanonimizar(texto, mapa) {
  texto = String(texto == null ? '' : texto);
  if (!mapa) return texto;
  Object.keys(mapa).forEach(function (token) {
    texto = texto.split(token).join(mapa[token]);
  });
  return texto;
}

/* ============ Consolidación mensual al MAESTRO ============ */

/**
 * Agrega Costos_API de cada cliente del mes corriente en Costos_API_consolidado
 * (USD + EUR vía tipo_cambio_usd_eur). Reescribe solo las filas del mes corriente.
 * Alerta si un cliente supera su presupuesto (Config 'presupuesto_usd_<idCliente>').
 * @return {{mes:string, filas:number, alertas:number}}
 */
function consolidarCostosMes() {
  var ss = getMaestro();
  var shCons = ss.getSheetByName('Costos_API_consolidado');
  var H = shCons.getRange(1, 1, 1, shCons.getLastColumn()).getValues()[0];
  var mes = mesISO();
  var tc = parseFloat(getConfig('tipo_cambio_usd_eur')) || 0.92;
  var clientes = leerTabla(ss.getSheetByName('Clientes'));

  // agregación: { idCliente|modulo : {llamadas, tokens, usd} }
  var acc = {};
  var alertas = 0;
  clientes.forEach(function (cli) {
    if (!cli.url_sheet_cliente) return;
    try {
      var sh = SpreadsheetApp.openByUrl(cli.url_sheet_cliente).getSheetByName('Costos_API');
      if (!sh) return;
      var totalClienteUSD = 0;
      leerTabla(sh).forEach(function (f) {
        if (String(aFechaISO(f.timestamp)).substring(0, 7) !== mes) return;
        var k = cli.id_cliente + '|' + String(f.modulo || '—');
        if (!acc[k]) acc[k] = { id_cliente: cli.id_cliente, modulo: String(f.modulo || '—'), llamadas: 0, tokens: 0, usd: 0 };
        acc[k].llamadas++;
        acc[k].tokens += (Number(f.tokens_in) || 0) + (Number(f.tokens_out) || 0);
        acc[k].usd += Number(f.USD) || 0;
        totalClienteUSD += Number(f.USD) || 0;
      });
      var presupuesto = parseFloat(getConfig('presupuesto_usd_' + cli.id_cliente));
      if (presupuesto && totalClienteUSD > presupuesto) {
        crearAviso({
          id_cliente: cli.id_cliente, tipo: 'presupuesto_excedido',
          mensaje: 'Consumo API del mes (USD ' + (Math.round(totalClienteUSD * 100) / 100) +
                   ') supera el presupuesto (USD ' + presupuesto + ') [' + cli.id_cliente + ']'
        });
        alertas++;
      }
    } catch (e) {
      crearAviso({ tipo: 'sync_error', mensaje: 'Consolidar costos falló en ' + cli.id_cliente + ': ' + e.message });
    }
  });

  // Reescribir solo las filas del mes corriente (idempotente; meses pasados intactos).
  var filas = leerTabla(shCons).filter(function (f) { return String(f.mes) !== mes; });
  var nuevas = Object.keys(acc).map(function (k) {
    var a = acc[k];
    return { mes: mes, id_cliente: a.id_cliente, modulo: a.modulo, llamadas: a.llamadas,
             tokens: a.tokens, USD: Math.round(a.usd * 1e6) / 1e6, EUR: Math.round(a.usd * tc * 1e6) / 1e6 };
  });
  var todo = filas.concat(nuevas).map(function (obj) {
    return H.map(function (h) { return sanitizarCelda(obj.hasOwnProperty(h) ? obj[h] : ''); });
  });
  if (shCons.getLastRow() > 1) shCons.getRange(2, 1, shCons.getLastRow() - 1, shCons.getLastColumn()).clearContent();
  if (todo.length) shCons.getRange(2, 1, todo.length, H.length).setValues(todo);

  return { mes: mes, filas: nuevas.length, alertas: alertas };
}
