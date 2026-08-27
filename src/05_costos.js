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

// ═══ TC-10 · PROMPT CACHING (B8d) ════════════════════════════════════════════
//
// QUÉ HACE: marca la parte FIJA del system con `cache_control: ephemeral` para que la API la
// cachee entre llamadas. El caching es un MATCH DE PREFIJO: cualquier byte que cambie invalida
// todo lo que viene después, y el orden de render es tools → system → messages.
//
// LA LÍNEA ROJA (Luciano, 03-ago): el breakpoint va ANTES de cualquier contexto vivo del cliente
// o memoria. Si se cachea un bloque que contiene datos del tenant, pasan dos cosas y las dos son
// malas: (1) el cache no pega NUNCA, porque ese bloque cambia en cada turno; (2) peor, se fija un
// prefijo con datos de UN cliente, que es exactamente lo que el aislamiento prohíbe.
//   · Los 5 agentes y la Bandeja mandan `GUARDIA_INYECCION`, una constante — pero de sólo ~143
//     tokens, o sea MUY por debajo del mínimo de cualquier modelo (1024 Sonnet / 4096 Haiku).
//     Constante NO es lo mismo que cacheable: hoy `_systemBloques_` los rechaza con motivo y
//     `cache_intentado` queda en false. (R9, 27-ago: antes esta línea decía «todo cacheable»,
//     que era falso y hacía creer que el caching estaba operando cuando no lo está.)
//   · Sato NO: su system incluye `_satoContexto_(id)` y la charla previa. Por eso `llamadaAPI`
//     recibe la parte fija en `system` y la viva en `systemVivo`, y SOLO la primera se marca.
//
// AHORRO HOY = CERO, y no por poco volumen: NINGÚN módulo llega hoy al mínimo del modelo que
// usa, así que no se cachea nada (medido 27-ago, F1). El valor de la
// tanda es la TELEMETRÍA y quedar listo para cuando el volumen crezca. No se infla ningún prompt
// para llegar al mínimo — si el bloque fijo no llega, no se cachea y se dice por qué.

/**
 * Mínimo de tokens que la API exige para cachear un prefijo, POR MODELO. Verificado contra la
 * doc de Anthropic (03-ago-2026). ⚠ NO es monótono por generación: Haiku 4.5 pide 4096 mientras
 * Sonnet 4.6 pide 1024. Un prefijo por debajo del mínimo NO se cachea y la API no avisa —
 * devuelve `cache_creation_input_tokens: 0` en silencio. Por eso el gate se hace de este lado.
 * Modelo desconocido ⇒ el mínimo MÁS ALTO (4096): en la duda, no se intenta cachear.
 */
var CACHE_MIN_TOKENS = {
  'claude-haiku-4-5': 4096, 'claude-haiku-4-5-20251001': 4096,
  'claude-opus-4-6': 4096, 'claude-opus-4-5': 4096,
  'claude-opus-4-7': 2048,
  'claude-sonnet-4-6': 1024, 'claude-sonnet-4-5': 1024, 'claude-sonnet-5': 1024,
  'claude-opus-4-8': 1024, 'claude-opus-4-1': 1024,
  'claude-opus-5': 512, 'claude-fable-5': 512
};
var CACHE_MIN_DESCONOCIDO = 4096;

/** Mínimo cacheable del modelo. PURO. */
function _cacheMinimo_(modelo) {
  var m = CACHE_MIN_TOKENS[String(modelo || '')];
  return m == null ? CACHE_MIN_DESCONOCIDO : m;
}

/**
 * Estimación CONSERVADORA de tokens de un texto. PURA.
 * 4 chars/token SUBESTIMA para español (el real ronda 3.2-3.8), y eso es deliberado: subestimar
 * hace el gate MÁS estricto, así que se intenta cachear solo cuando sobra margen. La verdad la
 * dice la telemetría (`cache_write` > 0), no esta cuenta.
 */
function _estimarTokens_(texto) { return Math.floor(String(texto || '').length / 4); }

/**
 * Arma el `system` del request. PURO — el corazón aserible de la tanda.
 * @param {string} fijo   parte estable (reglas, doctrina, roster de fuentes). Se cachea.
 * @param {string} vivo   contexto del cliente / memoria. NUNCA se cachea; va DESPUÉS.
 * @param {string} modelo
 * @return {{bloques:Array|null, cacheado:boolean, motivo:string, tokens_estimados:number}}
 */
function _systemBloques_(fijo, vivo, modelo) {
  fijo = String(fijo == null ? '' : fijo);
  vivo = String(vivo == null ? '' : vivo);
  if (!fijo && !vivo) return { bloques: null, cacheado: false, motivo: 'sin system', tokens_estimados: 0 };

  var est = _estimarTokens_(fijo);
  var min = _cacheMinimo_(modelo);
  var bloques = [];
  var cacheado = false, motivo = '';

  if (!fijo) {
    motivo = 'no hay parte fija que cachear (todo el system es contexto vivo)';
  } else if (est < min) {
    // Nada de rellenar el prompt para alcanzar el mínimo: se anota y se sigue.
    motivo = 'el bloque fijo no llega al mínimo de ' + modelo + ' (~' + est + ' < ' + min + ' tokens)';
  } else {
    cacheado = true;
    motivo = 'bloque fijo marcado (~' + est + ' ≥ ' + min + ' tokens)';
  }

  if (fijo) {
    var b = { type: 'text', text: fijo };
    if (cacheado) b.cache_control = { type: 'ephemeral' };
    bloques.push(b);
  }
  // El contexto vivo va SIEMPRE después del breakpoint y SIEMPRE sin marca.
  if (vivo) bloques.push({ type: 'text', text: vivo });
  return { bloques: bloques, cacheado: cacheado, motivo: motivo, tokens_estimados: est };
}

/**
 * Llama a Claude para un cliente, con anonimización + log + costeo.
 * @param {string} idCliente
 * @param {string} modulo    flujo/agente que llama (p.ej. 'vigia')
 * @param {Object} opts      { prompt, maxTokens?, modelo?, proveedor?, anonimizar? (def true) }
 * @return {{ok, texto, usd, tokens_in, tokens_out, status, error}}
 */
function llamadaAPI(idCliente, modulo, opts) {
  _soloOwner_('llamadaAPI');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  opts = opts || {};
  var ts = ahoraISO();
  var proveedor = opts.proveedor || 'anthropic';
  var modelo = opts.modelo || modeloDeModulo_(modulo);   // ruteo por agente/flujo (Config pisa)
  var prompt = String(opts.prompt || '');

  // 1) Anonimizar ANTES de salir (Bastión). El mapa de reversión es local, nunca se envía.
  var anon = (opts.anonimizar === false) ? { texto: prompt, mapa: {} } : anonimizar(prompt);

  var out = { ok: false, texto: '', usd: 0, tokens_in: 0, tokens_out: 0, status: null, error: null,
              cache_write: 0, cache_read: 0, cache_intentado: false, cache_motivo: '' };

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
      // El system NO se anonimiza: `opts.system` es la guardia estática, sin PII ni datos del tenant.
      // TC-10: `opts.systemVivo` es la parte CON contexto del cliente (hoy solo Sato) — va después
      // del breakpoint y jamás se marca para cachear.
      var sysB = _systemBloques_(opts.system, opts.systemVivo, modelo);
      if (sysB.bloques) cuerpo.system = sysB.bloques;
      out.cache_intentado = sysB.cacheado;
      out.cache_motivo = sysB.motivo;
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
        // TC-10 · telemetría honesta. `usage` ausente ⇒ 0 y se sigue (fail-safe): estos números
        // son observación, no deben poder tumbar una llamada que ya salió bien.
        // OJO: `input_tokens` es SOLO el remanente NO cacheado — el prompt total es
        // input + cache_write + cache_read. Sumar mal acá haría parecer que el gasto bajó.
        out.cache_write = data.usage ? (data.usage.cache_creation_input_tokens || 0) : 0;
        out.cache_read = data.usage ? (data.usage.cache_read_input_tokens || 0) : 0;
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
      USD: out.usd || '',
      cache_write: out.cache_write || '',
      cache_read: out.cache_read || ''
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
  _soloOwner_('logCostoCliente');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
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
  _soloOwner_('desanonimizar');   // purga X2: revierte la anonimización — devuelve PII en claro
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
  _soloOwner_('consolidarCostosMes');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
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
