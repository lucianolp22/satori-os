/**
 * 17_bandeja.js — Bandeja de captura única + clasificador Haiku con confianza (Fase 1 · Jarvis).
 *
 * Capa PERSONAL de Luciano (fork A): capturás TODO en un solo lugar (idea, tarea, link, lead) y
 * un Haiku barato lo clasifica con confianza 1-10 y rutea; si duda (< umbral) o no entiende, te
 * ESCALA vía aviso (fusible anti-slop). NO anonimiza (es tu propio texto y el clasificador necesita
 * ver nombres para linkear clientes). Costo a Consumo_agentes como 'clasificador'. Sin cliente.
 *
 * Robado del "Jarvis OS" de @_no_hype_ai: contrato de datos (input→bin+confianza+escalate) y el
 * reparto de modelos (modelo barato para el triaje de alta frecuencia). NO el stack (Obsidian/cron).
 */

var BANDEJA_BINS = ['proyecto', 'tarea', 'idea', 'referencia', 'cliente', 'lead', 'escalate'];
var BANDEJA_MAX_POR_CORRIDA = 25; // Purga F3: tope de items clasificados por corrida (anti-timeout 6min / quota UrlFetch)

/** Captura un input crudo en la Bandeja (estado 'pendiente'). Lo dispara la UI o vos. @return {{id}} */
function capturar(texto, fuente) {
  texto = String(texto || '').trim();
  if (!texto) throw new Error('captura vacía');
  var sh = getMaestro().getSheetByName('Bandeja');
  if (!sh) throw new Error('falta la pestaña Bandeja (corré setup)');
  return conLock(function () { // Purga F1: nextId+appendFila atómico (evita BAN duplicado en capturas concurrentes)
    var id = nextId(sh, 'id', 'BAN', 4);
    appendFila(sh, { id: id, ts: ahoraISO(), texto: texto.slice(0, 4000), fuente: fuente || 'manual', estado: 'pendiente' });
    return { id: id };
  });
}

/** Umbral de confianza para escalar (Config; default 6). */
function bandejaUmbral_() { var n = parseInt(getConfig('bandeja_umbral_confianza') || '6', 10); return isNaN(n) ? 6 : n; }

/**
 * Clasifica los items 'pendiente' de la Bandeja con Haiku: escribe bin/confianza/slug/tags/resumen
 * + linkea id_cliente si aplica; estado='clasificado' o 'escalado' (< umbral o bin=escalate) → aviso.
 * 0 API si no hay pendientes. Lo corre el trigger opt-in o una corrida manual.
 * @return {{procesados, escalados}}
 */
function clasificarBandeja() {
  var ss = getMaestro();
  var sh = ss.getSheetByName('Bandeja');
  if (!sh) return { procesados: 0, escalados: 0, error: 'sin Bandeja' };
  var pend = leerTabla(sh).filter(function (f) { return String(f.estado) === 'pendiente'; });
  if (!pend.length) return { procesados: 0, escalados: 0 };
  if (pend.length > BANDEJA_MAX_POR_CORRIDA) pend = pend.slice(0, BANDEJA_MAX_POR_CORRIDA); // Purga F3: cap por corrida

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  function setCol(filaN, col, val) { var i = headers.indexOf(col); if (i >= 0) sh.getRange(filaN, i + 1).setValue(sanitizarCelda(val)); }
  var shCli = ss.getSheetByName('Clientes'); // Purga F4: guard si falta la pestaña Clientes
  var clientes = shCli ? leerTabla(shCli).map(function (c) { return c.id_cliente + '=' + c.nombre; }) : [];
  var umbral = bandejaUmbral_();
  var procesados = 0, escalados = 0;

  pend.forEach(function (f) {
    // Purga F2: claim atómico — si otra corrida (trigger/manual) ya tomó la fila, saltar (evita doble gasto Haiku).
    var tomada = conLock(function () {
      var ix = headers.indexOf('estado');
      if (String(sh.getRange(f._fila, ix + 1).getValue()) !== 'pendiente') return false;
      sh.getRange(f._fila, ix + 1).setValue('procesando');
      return true;
    });
    if (!tomada) return;
    var r = llamadaClasificador_(promptClasificador_(f.texto, clientes), 400);
    var c = r.ok ? parseClasificacion_(r.texto) : null;
    if (!c) { // el clasificador falló → escalá honesto, no adivines
      setCol(f._fila, 'estado', 'escalado'); setCol(f._fila, 'procesado_en', ahoraISO());
      setCol(f._fila, 'resumen', 'no se pudo clasificar: ' + (r.error || 'error'));
      crearAviso({ origen: 'bandeja', tipo: 'bandeja_escalada', mensaje: 'Bandeja [' + f.id + ']: no se pudo clasificar. Revisá.' });
      escalados++; procesados++; return; // Purga F6: la fila SÍ se procesó (cuenta en procesados)
    }
    var esc = (c.bin === 'escalate') || (Number(c.confianza) < umbral);
    setCol(f._fila, 'bin', c.bin); setCol(f._fila, 'confianza', c.confianza); setCol(f._fila, 'slug', c.slug);
    setCol(f._fila, 'tags', c.tags); setCol(f._fila, 'resumen', c.resumen); setCol(f._fila, 'id_cliente', c.id_cliente || '');
    setCol(f._fila, 'procesado_en', ahoraISO()); setCol(f._fila, 'estado', esc ? 'escalado' : 'clasificado');
    feed_('Clasificador', esc ? 'aprobacion' : 'exito', c.id_cliente || '',
      'Bandeja [' + f.id + '] → ' + c.bin + ' (conf ' + c.confianza + '): ' + c.resumen, '', '');
    if (esc) {
      crearAviso({ origen: 'bandeja', tipo: 'bandeja_escalada', id_cliente: c.id_cliente || '',
        mensaje: 'Bandeja [' + f.id + '] (' + c.bin + ', conf ' + c.confianza + '): ' + String(c.resumen || f.texto).slice(0, 160) });
      escalados++;
    }
    procesados++;
  });

  Logger.log('clasificarBandeja: ' + JSON.stringify({ procesados: procesados, escalados: escalados }));
  return { procesados: procesados, escalados: escalados };
}

/** Prompt del clasificador (Haiku). Pide JSON estricto con bin + confianza + metadatos. */
function promptClasificador_(texto, clientes) {
  return 'Sos el clasificador de la bandeja de entrada de Luciano (consultor de negocios, marca Satori). ' +
    'Leé el INPUT y devolvé SOLO un JSON válido (sin texto extra, sin markdown) con las claves: ' +
    '{"bin": uno de [proyecto,tarea,idea,referencia,cliente,lead,escalate], "confianza": entero 1-10, ' +
    '"slug": "titulo-corto-en-kebab", "tags": "tag1,tag2", "resumen": "una linea", "id_cliente": "CLI-XXX o vacio"}. ' +
    'Definiciones: proyecto=algo a construir/desarrollar multi-paso con entregable; tarea=accion concreta puntual; ' +
    'idea=pensamiento o musing sin accion inmediata; referencia=link/recurso/herramienta a guardar; ' +
    'cliente=observacion/dato/pendiente sobre un cliente EXISTENTE (poné su id_cliente); lead=prospecto u oportunidad comercial NUEVA; ' +
    'escalate=no se entiende o falta info. Si dudás, usá bin=escalate con confianza baja. La confianza es qué tan seguro estás de la clasificación. ' +
    'Clientes existentes (id=nombre): ' + (clientes.join('; ') || '(ninguno)') + '. ' +
    'INPUT: """' + String(texto).slice(0, 3000) + '"""';
}

/** Parsea el JSON del clasificador con tolerancia (extrae el primer bloque {...}). null si no puede. */
function parseClasificacion_(texto) {
  try {
    var m = String(texto).match(/\{[\s\S]*\}/);
    if (!m) return null;
    var o = JSON.parse(m[0]);
    if (BANDEJA_BINS.indexOf(String(o.bin)) < 0) o.bin = 'escalate';
    o.confianza = Math.max(1, Math.min(10, parseInt(o.confianza, 10) || 1));
    o.slug = String(o.slug || '').slice(0, 60);
    o.tags = String(o.tags || '').slice(0, 120);
    o.resumen = String(o.resumen || '').slice(0, 300);
    o.id_cliente = String(o.id_cliente || '').slice(0, 20);
    return o;
  } catch (e) { return null; }
}

/**
 * Llama a Haiku para clasificar — SIN anonimizar (es texto propio; necesita ver nombres) y logueando
 * el costo a Consumo_agentes como 'clasificador'. Reusa las constantes/costeo de 05_costos sin tocar
 * la ruta E2 (llamadaAPI, que es client-scoped). Respeta el tope mensual global.
 */
function llamadaClasificador_(prompt, maxTokens) {
  var out = { ok: false, texto: '', usd: 0, error: null };
  var key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!key) { out.error = 'CLAUDE_API_KEY no configurada'; return out; }
  var c = filaConsumoAgentes_(), tope = budgetMensualUSD_();
  if (c.gasto >= tope) { out.error = 'tope mensual de API alcanzado'; return out; }
  try {
    var resp = UrlFetchApp.fetch(CLAUDE_ENDPOINT, {
      method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: MODELO_DEFAULT, max_tokens: maxTokens || 400, messages: [{ role: 'user', content: prompt }] }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      out.texto = (data.content && data.content[0]) ? data.content[0].text : '';
      var tin = data.usage ? (data.usage.input_tokens || 0) : 0, tout = data.usage ? (data.usage.output_tokens || 0) : 0;
      out.usd = costearUSD_(MODELO_DEFAULT, tin, tout);
      registrarConsumoAgente_(out.usd, 'clasificador');
      out.ok = true;
    } else { out.error = 'proveedor respondió ' + resp.getResponseCode(); }
  } catch (e) { out.error = e.message; }
  return out;
}

/** Instala (idempotente) el trigger del clasificador cada 30 min. OPT-IN (cuota de triggers). */
function instalarTriggerBandeja() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'clasificarBandeja'; });
  if (existe) return { ya_existia: true };
  ScriptApp.newTrigger('clasificarBandeja').timeBased().everyMinutes(30).create();
  Logger.log('Trigger "clasificarBandeja" instalado (cada 30 min).');
  return { ya_existia: false };
}
