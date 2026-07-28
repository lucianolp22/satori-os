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
