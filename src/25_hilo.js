/**
 * 25_hilo.js — HILO DE TRABAJO por cliente (TC-W1 / W2 / W4 · 21-jul-2026).
 *
 * QUÉ ES: el Hilo es el estado vivo del trabajo con un cliente en cuatro secciones —
 *   PLAN      lo que acordamos hacer
 *   REAL      lo que efectivamente pasó (y el número que lo respalda, si hay conector)
 *   DESVIADO  dónde el real se separó del plan
 *   PENDIENTE lo que falta y de quién depende
 *
 * FUENTE DE VERDAD: el markdown `_cerebro/HILO - <Cliente>.md` en el Mac (decisión cerrada del plan
 * v3 §2.1). Toda vista es downstream. GAS **no puede leer el Mac**, así que esta hoja es un ESPEJO
 * que sube `_hilo_sync.sh`. Consecuencia asumida: la hoja puede quedar vieja respecto del `.md`, y
 * por eso la UI muestra la fecha del espejo — nunca se hace pasar por la fuente.
 *
 * FAIL-CLOSED (mock jamás, SOUL S1): sin hoja o sin filas ⇒ `{sin_hilo:true}` con motivo. Nunca un
 * Hilo de ejemplo, nunca secciones vacías que parezcan "todo en orden". Un Hilo vacío y un Hilo
 * no-cargado son estados DISTINTOS y se dicen distinto.
 *
 * VOCABULARIO CERRADO: `seccion` solo puede ser plan|real|desviado|pendiente. Una fila con otra cosa
 * se descarta y se cuenta (frontera de confianza, SOUL S6): el `.md` lo escribe una skill con un LLM
 * adentro, así que lo que llega es texto propuesto, no dato aceptado.
 */

var HILO_SECCIONES = ['plan', 'real', 'desviado', 'pendiente'];
var HILO_MAX_FILAS = 300;   // tope de lo que viaja al cliente; un Hilo más largo que esto no es un Hilo

/** Títulos humanos de cada sección (los usa la UI; viven acá para que no se dupliquen en el render). */
var HILO_TITULOS = { plan: 'Plan', real: 'Real', desviado: 'Desviado', pendiente: 'Pendiente' };

/**
 * PURA (testeable sin abrir nada): filas crudas de la hoja `hilo` → estructura por sección + semáforo.
 * @param {Array} filas  leerTabla() de la hoja `hilo`
 * @return {{secciones:Object, conteos:Object, descartadas:number, semaforo:string, total:number}}
 */
function _armarHilo_(filas) {
  var sec = { plan: [], real: [], desviado: [], pendiente: [] };
  var descartadas = 0;
  (filas || []).slice(0, HILO_MAX_FILAS).forEach(function (f) {
    var s = _sinTildes_(String(f.seccion || '').toLowerCase().trim());
    if (HILO_SECCIONES.indexOf(s) < 0) { descartadas++; return; }   // vocabulario cerrado
    var item = String(f.item || '').trim();
    if (!item) { descartadas++; return; }                            // una fila sin ítem no es nada
    sec[s].push({
      item: limpiarHostilTexto_(item, 140),
      detalle: limpiarHostilTexto_(String(f.detalle || ''), 300),
      estado: limpiarHostilTexto_(String(f.estado || ''), 40),
      evidencia: limpiarHostilTexto_(String(f.evidencia || ''), 200),
      fecha: aFechaISO(f.fecha) || '',
      prioridad: String(f.prioridad || '').toUpperCase().slice(0, 1),
      dueno: limpiarHostilTexto_(String(f.dueno || ''), 40)
    });
  });
  var conteos = {};
  HILO_SECCIONES.forEach(function (s) { conteos[s] = sec[s].length; });
  var total = conteos.plan + conteos.real + conteos.desviado + conteos.pendiente;
  return { secciones: sec, conteos: conteos, descartadas: descartadas, total: total, semaforo: _semaforoHilo_(conteos) };
}

/**
 * PURA: semáforo del Hilo. Criterio explícito (es juicio de producto, no un dato):
 *   rojo   hay desvíos → el real se separó del plan y eso es lo primero que hay que mirar
 *   ambar  sin desvíos pero con pendientes → hay deuda abierta
 *   verde  ni desvíos ni pendientes Y hay algo de real → el plan está corriendo
 *   gris   no hay nada cargado todavía (≠ "todo bien")
 * El caso `gris` existe justamente para que un Hilo recién creado no se pinte de verde.
 */
function _semaforoHilo_(c) {
  if (!c || (!c.plan && !c.real && !c.desviado && !c.pendiente)) return 'gris';
  if (c.desviado > 0) return 'rojo';
  if (c.pendiente > 0) return 'ambar';
  return c.real > 0 ? 'verde' : 'gris';
}

/**
 * Hilo de un cliente para la UI (estación del Espacio en Akasha + panel del CM).
 * Endpoint client-callable → gate `_soloOwner_` + alta en `ENDPOINTS_UI` (regla anti-drift).
 * @param {string} idCliente
 * @return {{sin_hilo:true, motivo:string}|{sin_hilo:false, ...}}
 */
function hiloCliente(idCliente) {
  _soloOwner_('hiloCliente');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var id = String(idCliente || '').trim();
  if (!id) return { sin_hilo: true, motivo: 'sin id de cliente' };

  var ss;
  try { ss = abrirCliente(id).ss; } catch (e) { return { sin_hilo: true, motivo: 'cliente no accesible' }; }
  var sh = ss.getSheetByName('hilo');
  if (!sh) return { sin_hilo: true, motivo: 'Hilo no cargado — correr la skill hilo-de-trabajo y después _hilo_sync.sh' };

  var h = _armarHilo_(leerTabla(sh));
  if (!h.total) return { sin_hilo: true, motivo: 'la hoja hilo existe pero está vacía — el espejo todavía no subió nada' };

  // W2: "Real" enriquecido con el numérico del conector, SOLO si ese conector está encendido.
  // Apagado ⇒ no se muestra número: un conector sin validar al peso puede estar diciendo cualquier cosa.
  var num = null;
  try { num = _numeroConectorCliente_(id); } catch (e) { num = null; }

  return {
    sin_hilo: false,
    id_cliente: id,
    semaforo: h.semaforo,
    conteos: h.conteos,
    secciones: h.secciones,
    descartadas: h.descartadas,
    numerico: num,                                   // null si el conector está OFF o no hay
    espejado_en: _ultimoEspejo_(sh)
  };
}

/**
 * W2 — el numérico que respalda el "Real": último agregado que escribió el conector de este cliente
 * en `Datos_operativos`. Devuelve null si el conector está APAGADO (no basta con que haya filas
 * viejas: si nadie validó ese conector al peso, su número no puede ilustrar el Hilo).
 * @return {?{concepto:string, valor:number, fecha:string, fuente:string}}
 */
function _numeroConectorCliente_(idCliente) {
  var mapa = _mapaConectores_(leerTabla(getMaestro().getSheetByName('Config')));
  var cfg = mapa[idCliente];
  var encendido = !!(cfg && cfg.on) || (idCliente === 'CLI-002');   // CLI-002 corre por código (Vehemence)
  if (!encendido) return null;

  var sh = abrirCliente(idCliente).ss.getSheetByName('Datos_operativos');
  if (!sh) return null;
  var deConector = leerTabla(sh).filter(function (f) { return String(f.fuente || '').indexOf('SGIC') >= 0; });
  if (!deConector.length) return null;
  var u = deConector[deConector.length - 1];
  return { concepto: limpiarHostilTexto_(String(u.concepto || ''), 100), valor: Number(u.valor) || 0,
           fecha: aFechaISO(u.fecha) || '', fuente: limpiarHostilTexto_(String(u.fuente || ''), 80) };
}

/** Fecha del espejo: la fila más reciente de la hoja. '' si no hay fechas — se dice, no se inventa. */
function _ultimoEspejo_(sh) {
  var max = '';
  leerTabla(sh).forEach(function (f) { var d = aFechaISO(f.fecha) || ''; if (d > max) max = d; });
  return max;
}

/**
 * Crea la hoja `hilo` en los Sheets cliente que no la tengan (oculta+protegida, como el resto de la
 * interna). Idempotente. Correr a mano — no está en CLIENTE_ORDEN a propósito (ver 01_schema.js).
 */
function repararHilo() {
  var n = 0;
  leerTabla(getMaestro().getSheetByName('Clientes')).forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    try {
      var sh = ensureSheet(SpreadsheetApp.openByUrl(c.url_sheet_cliente), 'hilo', CLIENTE_SHEETS.hilo);
      protegerSheet(sh, false); sh.hideSheet(); n++;
    } catch (e) { Logger.log('repararHilo ' + c.id_cliente + ': ' + e.message); }   // id, sin nombre
  });
  Logger.log('repararHilo: hoja `hilo` en ' + n + ' cliente(s).');
  return { clientes: n };
}

/**
 * ESPEJO md → hoja. Lo llama `_hilo_sync.sh` (vía clasp/Apps Script API) o se pega el CSV a mano.
 * Reemplaza TODO el Hilo del cliente: el `.md` es la fuente, así que un merge parcial dejaría filas
 * fantasma que ya no están en la fuente. Es un espejo, no un log.
 *
 * @param {string} idCliente
 * @param {Array<Array>} filas  [[seccion,item,detalle,estado,evidencia,fecha,prioridad,dueno], ...]
 * @return {{escritas:number, descartadas:number}}
 */
function espejarHilo(idCliente, filas) {
  var ss = abrirCliente(idCliente).ss;
  var sh = ensureSheet(ss, 'hilo', CLIENTE_SHEETS.hilo);
  try { protegerSheet(sh, false); sh.hideSheet(); } catch (_p) {}
  var H = CLIENTE_SHEETS.hilo;

  // Validar ANTES de borrar: si el payload viene roto, la hoja vieja se queda. Un espejo que se
  // vacía porque el parser falló es peor que uno desactualizado.
  var buenas = [], descartadas = 0;
  (filas || []).slice(0, HILO_MAX_FILAS).forEach(function (r) {
    var s = _sinTildes_(String(r[0] || '').toLowerCase().trim());
    if (HILO_SECCIONES.indexOf(s) < 0 || !String(r[1] || '').trim()) { descartadas++; return; }
    buenas.push(H.map(function (_, i) { return sanitizarCelda(i === 0 ? s : (r[i] == null ? '' : r[i])); }));
  });
  if (!buenas.length) throw new Error(idCliente + ': el espejo no trajo ninguna fila válida (' + descartadas +
                                      ' descartadas) — NO piso el Hilo que ya está cargado.');

  return conLock(function () {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, H.length).clearContent();
    sh.getRange(2, 1, buenas.length, H.length).setValues(buenas);
    Logger.log('espejarHilo ' + idCliente + ': ' + buenas.length + ' fila(s)' + (descartadas ? ' · ' + descartadas + ' descartadas' : ''));
    return { escritas: buenas.length, descartadas: descartadas };
  });
}

/**
 * Espejo desde CSV (la vía que usa `_hilo_sync.sh`: parsea el md en el Mac y deja un CSV listo,
 * que se pega acá). Se eligió CSV sobre "que el script escriba el Sheet por la API" porque no
 * agrega credenciales ni scopes nuevos, y porque el paso queda auditable a ojo antes de aplicarlo.
 */
function espejarHiloCSV(idCliente, csv) {
  var filas = String(csv || '').split('\n').map(function (l) { return l.trim(); }).filter(String)
    .map(function (l) { return _parseCSVLinea_(l); });
  if (filas.length && _sinTildes_(String(filas[0][0] || '').toLowerCase()) === 'seccion') filas.shift();  // header
  return espejarHilo(idCliente, filas);
}

/** PURA: una línea CSV → array de campos. Soporta comillas dobles y comas adentro. */
function _parseCSVLinea_(linea) {
  var out = [], cur = '', enComillas = false, s = String(linea || '');
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (enComillas) {
      if (ch === '"') { if (s.charAt(i + 1) === '"') { cur += '"'; i++; } else enComillas = false; }
      else cur += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(function (x) { return x.trim(); });
}

// ═══ W4 — LAZO CON DIRECCIÓN ════════════════════════════════════════════════

/**
 * W4a — la foto del Hilo como sección del status report del cliente. Devuelve [] si no hay Hilo:
 * `contratoStatusReport_` ya emite su fallback honesto para una sección vacía, así que el contrato
 * no se rompe y el brief no miente.
 * @return {Array<string>} líneas markdown
 */
function _seccionHilo_(idCliente) {
  var h;
  try { h = hiloCliente(idCliente); } catch (e) { return []; }
  if (!h || h.sin_hilo) return [];
  var L = [];
  var SEM = { verde: '🟢', ambar: '🟡', rojo: '🔴', gris: '⚪' };
  L.push('- ' + (SEM[h.semaforo] || '⚪') + ' Hilo ' + h.semaforo.toUpperCase() +
         ' · plan ' + h.conteos.plan + ' · real ' + h.conteos.real +
         ' · desviado ' + h.conteos.desviado + ' · pendiente ' + h.conteos.pendiente +
         (h.espejado_en ? ' (espejo al ' + h.espejado_en + ')' : ''));
  // Lo que de verdad hay que mirar: los desvíos primero, después los pendientes.
  h.secciones.desviado.slice(0, 3).forEach(function (d) {
    L.push('  - DESVÍO: ' + d.item + (d.detalle ? ' — ' + truncar_(d.detalle, 90) : ''));
  });
  h.secciones.pendiente.slice(0, 3).forEach(function (p) {
    L.push('  - PENDIENTE: ' + p.item + (p.dueno ? ' (' + p.dueno + ')' : '') + (p.fecha ? ' · ' + p.fecha : ''));
  });
  if (h.numerico) L.push('  - Real respaldado por el conector: ' + h.numerico.concepto + ' = ' + h.numerico.valor +
                         (h.numerico.fecha ? ' (' + h.numerico.fecha + ')' : ''));
  return L;
}

/**
 * W4b — candidata de recomendación desde el Hilo: el desvío (o, si no hay, el pendiente) más
 * prioritario del cliente. Devuelve null si no hay Hilo o no hay nada que recomendar.
 *
 * Anclas M5: el Hilo es UN dominio; si el conector está encendido, su número es el segundo. Se
 * declaran solo cuando miden lo mismo — acá no lo hacen, así que el Hilo va como fuente única y
 * la recomendación sale honestamente como "1 fuente".
 */
function _recDesdeHilo_(idCliente) {
  var h;
  try { h = hiloCliente(idCliente); } catch (e) { return null; }
  if (!h || h.sin_hilo) return null;

  var pick = h.secciones.desviado[0] || null, clase = 'desvío';
  if (!pick) {
    // Pendientes: primero por prioridad (A>B>C), después por fecha más vieja.
    var pend = h.secciones.pendiente.slice().sort(function (a, b) {
      var pa = a.prioridad || 'Z', pb = b.prioridad || 'Z';
      if (pa !== pb) return pa < pb ? -1 : 1;
      return String(a.fecha || '9999') < String(b.fecha || '9999') ? -1 : 1;
    });
    pick = pend[0] || null; clase = 'pendiente';
  }
  if (!pick) return null;

  return {
    texto: (clase === 'desvío' ? 'Resolver el desvío del Hilo de ' : 'Cerrar el pendiente del Hilo de ') +
           idCliente + ': ' + truncar_(pick.item, 90) +
           (pick.dueno ? ' (' + pick.dueno + ')' : '') + (pick.fecha ? ' · ' + pick.fecha : ''),
    kpi: 'hilo', id_cliente: idCliente,
    dato: 'hilo=' + h.semaforo + ';desviados=' + h.conteos.desviado + ';pendientes=' + h.conteos.pendiente,
    anclas: [{ dominio: 'hilo', valor: h.conteos.desviado + '/' + h.conteos.pendiente }]
  };
}

/**
 * Clientes activos que HOY tienen Hilo con desvíos o pendientes. Lo consume `_recCandidatas_`.
 * Se hace en el nivel del sistema (no por cliente) porque la rec del día es una sola para todo.
 * Abre Sheets cliente ⇒ solo en llamadas de baja frecuencia (corrida/brief), nunca en `datosHoy`.
 */
function _clienteConHiloCaliente_() {
  try {
    var clientes = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
      return ['activo', 'activo-piloto'].indexOf(String(c.estado).toLowerCase()) >= 0 && c.url_sheet_cliente;
    });
    for (var i = 0; i < clientes.length; i++) {
      var r = _recDesdeHilo_(clientes[i].id_cliente);
      if (r) return r;
    }
  } catch (e) { /* sin Hilo accesible → la rec sigue por las otras ramas */ }
  return null;
}
