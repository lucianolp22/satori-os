/**
 * 26_sato.js — SATO EN LA FICHA (T1.4 · 28-jul-2026)
 * Chat contextual de trabajo por cliente, con MEMORIA PERSISTENTE y espejo al Cerebro.
 *
 * Pedido de Luciano (28-jul): "todo lo hablado con Sato queda registrado, archivado en el grafo
 * de cada cliente y del Cerebro, navegable, y Sato lo tiene en cuenta en las nuevas respuestas.
 * Que me acompañe a cada rincón del OS."
 *
 * Arquitectura (encargo ENCARGO-SATO-EN-FICHA · Fase A ampliada con memoria):
 *  · Hoja lazy `charla` por tenant (ts, rol, texto, modulo) — TRANSCRIPCIÓN COMPLETA, oculta
 *    y protegida como toda hoja sensible. Es la memoria navegable (Sheet = fuente de verdad).
 *  · Cada turno: los últimos SATO_MEMORIA turnos de la hoja entran al prompt → Sato recuerda.
 *  · Espejo al Cerebro: un nodo `charla_sato` por cliente (dimension líder — es la conversación
 *    CON Luciano) cuyo atributo acumula el conteo; cada sesión toca `actualizado_en`. El grafo
 *    del orbe y el Núcleo lo muestran sin exponer el contenido (Bastión: el texto queda en la
 *    hoja sensible del tenant, el grafo solo sabe QUE se habló y cuánto).
 *  · Motor: llamadaAPI (05_costos) — anonimización de PII, costeo por cliente en Costos_API,
 *    módulo 'sato_ficha' (ruteo de modelo por Config `sato_modelo`; default seguro del sistema).
 *  · Seguridad: _soloOwner_ en ambos endpoints · sanitización de entrada · tope de turnos/día
 *    (Config `sato_tope_turnos`, default 40) · guardPresupuesto_ ('sato_ficha') — si el mes
 *    tocó el tope, Sato lo dice y no llama · fail-closed y HONESTO (N4/N5/N9): nunca afirma
 *    acciones no ejecutadas; si la API falla, se dice.
 *
 * Sato NO ejecuta escrituras desde el chat en esta fase: propone, y las acciones reales van por
 * los botones de la ficha (checklist, encargo, aprobaciones) — default-deny del sistema intacto.
 */

var SATO_MEMORIA = 12;      // turnos de la hoja que entran al contexto de cada llamada
var SATO_MAXTOK = 700;      // respuesta acotada: es un chat de trabajo, no un informe

/** Hoja charla del tenant (lazy, patrón checklist/hilo — oculta+protegida al crearla). */
function _charlaSheet_(ss, crear) {
  var sh = ss.getSheetByName('charla');
  if (!sh && crear) {
    sh = ensureSheet(ss, 'charla', CLIENTE_SHEETS.charla);
    try { protegerSheet(sh, false); sh.hideSheet(); } catch (e) { /* estética, no bloquea */ }
  }
  return sh;
}

/** Historial para la UI (últimos `n` turnos). Sin hoja = charla nueva, honesto. */
function satoCharla(idCliente, n) {
  _soloOwner_('satoCharla');
  var id = String(idCliente || '').trim();
  if (!id) return { ok: false, error: 'sin id' };
  var ss;
  try { ss = abrirCliente(id).ss; } catch (e) { return { ok: false, error: 'cliente no accesible' }; }
  var sh = _charlaSheet_(ss, false);
  var turnos = !sh ? [] : leerTabla(sh).slice(-(Math.min(parseInt(n, 10) || 30, 60))).map(function (f) {
    return { ts: String(f.ts || ''), rol: String(f.rol || ''), texto: String(f.texto || '') };
  });
  return { ok: true, id_cliente: id, turnos: turnos };
}

/** Contexto compacto del cliente para el system (fuentes vivas ya existentes, sin inventar). */
function _satoContexto_(id) {
  var partes = [];
  try { partes.push(estadoVigente(id)); } catch (e) { partes.push('(estado no disponible: ' + e.message + ')'); }
  try {
    var cl = checklistCliente(id);
    if (cl.ok && cl.items.length) {
      var abiertos = cl.items.filter(function (i) { return i.estado !== 'hecho'; }).slice(0, 8);
      if (abiertos.length) partes.push('## Checklist abierto\n' + abiertos.map(function (i) { return '- ' + i.item; }).join('\n'));
    }
  } catch (e3) { /* opcional */ }
  return partes.join('\n\n');
}

/**
 * UN turno de chat con Sato sobre un cliente. Persiste ambos lados SIEMPRE (aun si la API
 * falla, queda registrado el intento con la respuesta de error — la memoria no miente).
 */
function satoChat(idCliente, mensaje) {
  _soloOwner_('satoChat');
  var id = String(idCliente || '').trim();
  var msg = limpiarHostilTexto_(String(mensaje || ''), 1200);
  if (!id || !msg) return { ok: false, error: 'faltan datos' };
  var ss;
  try { ss = abrirCliente(id).ss; } catch (e) { return { ok: false, error: 'cliente no accesible' }; }
  var sh = _charlaSheet_(ss, true);

  // Tope diario de turnos (Config sato_tope_turnos, default 40) — el chat no se come el mes.
  var hoy = hoyISO(), tope = parseInt(getConfig('sato_tope_turnos'), 10) || 40;
  var todas = leerTabla(sh);
  var deHoy = todas.filter(function (f) { return String(f.rol) === 'user' && String(f.ts).indexOf(hoy) === 0; }).length;
  if (deHoy >= tope) return { ok: false, error: 'tope diario de ' + tope + ' turnos alcanzado (Config sato_tope_turnos)' };

  // Presupuesto del mes (mismo guard que los agentes): si está agotado, se dice — no se llama.
  try { var g = guardPresupuesto_('sato_ficha'); if (g && g.bloqueado) return { ok: false, error: 'presupuesto API del mes agotado — Sato vuelve el mes próximo o subí el tope' }; }
  catch (eg) { /* sin guard disponible: la llamadaAPI igual costea y el corte global aplica */ }

  // Memoria: últimos N turnos de la TRANSCRIPCIÓN persistida.
  var prev = todas.slice(-SATO_MEMORIA).map(function (f) {
    return (String(f.rol) === 'user' ? 'Luciano: ' : 'Sato: ') + String(f.texto || '');
  }).join('\n');

  var system = [
    'Sos Sato, el asistente del sistema Satori OS de Luciano (consultor de negocios, Barcelona).',
    'Estás dentro de la Ficha 360 del cliente ' + id + '. Ayudás a Luciano a trabajar ESTE cliente:',
    'analizar, priorizar, redactar, preparar reuniones, pensar decisiones. Español rioplatense, directo, sin relleno.',
    'REGLAS DURAS: (1) cifras exactas de las fuentes de abajo — si un dato no está, decilo, jamás lo inventes;',
    '(2) aclará la frescura ("al último cierre") cuando cites números del conector;',
    '(3) NUNCA afirmes que ejecutaste una acción — no ejecutás nada: proponés, y Luciano actúa con los botones',
    'de la ficha (checklist, encargo a Cowork, aprobaciones); (4) si te piden algo que requiere herramientas',
    'que no tenés (archivos, web, código), decilo y sugerí el botón "Encargar a Cowork".',
    '',
    '=== CONTEXTO VIVO DEL CLIENTE (fuentes del sistema) ===',
    _satoContexto_(id),
    prev ? '\n=== CONVERSACIÓN PREVIA (memoria persistida) ===\n' + prev : ''
  ].join('\n');

  // Persistir el turno del usuario ANTES de llamar (si la llamada muere, el registro queda).
  conLock(function () { appendFila(sh, { ts: ahoraISO(), rol: 'user', texto: msg, modulo: 'sato_ficha' }); });

  var r = llamadaAPI(id, 'sato_ficha', {
    prompt: msg, system: system, maxTokens: SATO_MAXTOK,
    modelo: getConfig('sato_modelo') || undefined
  });
  var texto = r.ok ? String(r.texto || '').trim()
                   : '(Sato no pudo responder: ' + (r.error || 'error del proveedor') + (r.simulado ? ' — falta CLAUDE_API_KEY' : '') + ')';

  conLock(function () { appendFila(sh, { ts: ahoraISO(), rol: 'sato', texto: texto, modulo: 'sato_ficha' }); });

  // Espejo al Cerebro: el grafo sabe QUE se habló y cuánto — el contenido queda en la hoja.
  try {
    upsertNodo(id, {
      id_nodo: 'NOD-CHARLA', dimension: 'lider', tipo: 'charla_sato',
      etiqueta: 'Charla con Sato', atributos: { turnos: todas.length + 2, ultima: hoy },
      relevancia: 3, cobertura: 100, estado: 'activo', fuente: 'sato_ficha'
    });
  } catch (ec) { /* el grafo es espejo: si falla, la charla igual quedó registrada */ }

  return { ok: r.ok, texto: texto, usd: r.usd || 0, error: r.ok ? null : r.error };
}

/* ═══ T1.5 (28-jul) — LA VOZ REAL DE SATO EN LA FICHA ════════════════════════
 * Feedback de Luciano: "cambiaste la voz de Sato, es horrible — imitá tal cual Hablar con Sato".
 * Tenía razón: la ficha usaba `speechSynthesis` (voz sintética del sistema operativo). La voz
 * de "Hablar con Sato" es **ElevenLabs** — `eleven_turbo_v2_5`, español, voz grave (voice_id
 * de `voz/agent/.env.local`, ver `voz/BLUEPRINT.md` §pipeline: Deepgram STT → GPT-4o-mini →
 * ElevenLabs TTS). Este endpoint trae ESA MISMA voz al chat de la Ficha 360: GAS llama a la
 * API y devuelve el MP3 en base64 para que el navegador lo reproduzca.
 *
 * Config (Script Properties): `ELEVENLABS_API_KEY` — la MISMA que usa el agente de voz.
 * Config (hoja Config, opcionales): `sato_voz_id` (default = la voz grave de Sato),
 * `sato_voz_on` ('no' apaga el TTS neuronal y la UI cae a la voz del navegador),
 * `sato_voz_usd_1k` (tarifa estimada por 1.000 caracteres, default 0.10 — es ESTIMACIÓN
 * declarada, no factura: ElevenLabs cobra por créditos según plan).
 *
 * Fail-closed y honesto: sin key → `{ok:false, motivo:'sin_key'}` y la UI lo dice (no finge
 * que habló). Tope duro de caracteres para que un brief largo no queme créditos.
 */
var SATO_VOZ_ID_DEF = 'xcAUMhbpNX2WRGsuhjFy';   // voz grave de Sato (misma que el agente LiveKit)
var SATO_VOZ_MAXCH = 700;                        // tope duro por turno hablado

function satoVoz(texto) {
  _soloOwner_('satoVoz');
  var t = limpiarHostilTexto_(String(texto || ''), SATO_VOZ_MAXCH);
  if (!t) return { ok: false, motivo: 'vacio' };
  if (String(getConfig('sato_voz_on') || '').toLowerCase() === 'no') return { ok: false, motivo: 'apagada' };

  var key = '';
  try { key = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_API_KEY') || ''; } catch (e) { /* fail-closed */ }
  if (!key) return { ok: false, motivo: 'sin_key' };

  var voz = String(getConfig('sato_voz_id') || SATO_VOZ_ID_DEF);
  try {
    // mp3_22050_32: liviano (≈4 KB/s) — viaja rápido por google.script.run y suena bien en voz hablada.
    function pegar_(conIdioma) {
      var cuerpo = { text: t, model_id: 'eleven_turbo_v2_5' };
      if (conIdioma) cuerpo.language_code = 'es';
      return UrlFetchApp.fetch(
        'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voz) + '?output_format=mp3_22050_32',
        { method: 'post', contentType: 'application/json',
          headers: { 'xi-api-key': key },
          payload: JSON.stringify(cuerpo),
          muteHttpExceptions: true });
    }
    var resp = pegar_(true);
    var code = resp.getResponseCode();
    // 400/422 con language_code: algunos modelos/planes lo rechazan → un reintento sin él.
    if (code === 400 || code === 422) { resp = pegar_(false); code = resp.getResponseCode(); }
    if (code !== 200) {
      // Diagnóstico acotado: el cuerpo de error de ElevenLabs NO lleva credenciales (dice qué
      // pasó: voz inexistente, cuota, key inválida). Se trunca y se devuelve para que la UI
      // lo muestre — sin esto, "no anda la voz" es indepurable desde el navegador.
      var det = '';
      try { det = String(resp.getContentText() || '').replace(/\s+/g, ' ').slice(0, 180); } catch (e3) { /* opcional */ }
      return { ok: false, motivo: 'proveedor_' + code, detalle: det };
    }

    var b64 = Utilities.base64Encode(resp.getBlob().getBytes());
    // Costeo: ElevenLabs cobra por caracteres. Se registra como estimación declarada.
    var usd = (t.length / 1000) * (parseFloat(getConfig('sato_voz_usd_1k')) || 0.10);
    try {
      logCostoCliente('CLI-000', { timestamp: ahoraISO(), modulo: 'sato_voz',
        endpoint: 'elevenlabs/eleven_turbo_v2_5', tokens_in: t.length, tokens_out: '', USD: usd });
    } catch (e2) { /* el costeo no bloquea la voz */ }
    return { ok: true, mp3: b64, chars: t.length, usd: usd };
  } catch (e) {
    return { ok: false, motivo: 'fetch: ' + (e.message || e) };
  }
}

/**
 * Diagnóstico de la voz — para correr A MANO en el editor de Apps Script cuando "no suena".
 * Dice en el Registro exactamente dónde está el corte: key, voz, modelo o proveedor.
 */
function diagVoz() {
  var out = [];
  var k = '';
  try { k = PropertiesService.getScriptProperties().getProperty('ELEVENLABS_API_KEY') || ''; } catch (e) {}
  out.push('ELEVENLABS_API_KEY: ' + (k ? ('presente (' + k.length + ' chars, empieza ' + k.slice(0, 4) + '…)') : 'AUSENTE ← el problema'));
  out.push('voz configurada: ' + (getConfig('sato_voz_id') || SATO_VOZ_ID_DEF + ' (default Sato)'));
  out.push('sato_voz_on: ' + (getConfig('sato_voz_on') || '(vacío = encendida)'));
  var r = satoVoz('Hola Luciano, soy Sato. Prueba de voz.');
  out.push('satoVoz → ' + (r.ok ? ('OK · ' + r.chars + ' chars · mp3 base64 de ' + r.mp3.length + ' chars · $' + r.usd.toFixed(4))
                                : ('FALLÓ · motivo=' + r.motivo + (r.detalle ? ' · detalle=' + r.detalle : ''))));
  Logger.log(out.join('\n'));
  return out.join('\n');
}
