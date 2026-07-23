/**
 * 15_cerebro.js — Cerebro (grafo de memoria) multi-tenant (ETAPA 8a · módulo a1).
 *
 * Un cerebro POR TENANT: las pestañas nodos/aristas/cerebro_log/estado_actual/objetivos
 * viven en el Sheet de CADA cliente (aislamiento real, caso 20). El MAESTRO solo guarda
 * un índice agregado SIN PII (Cerebro_index). El Director (a2) y Salud (a3) leen/escriben acá.
 *
 * Modelo (v1, diseño Cowork aprobado 15-jun; el doc canónico "CEREBRO" lo refina):
 *   nodos:        grafo de entidades (objetivo/proyecto/tarea/hallazgo/agente/…).
 *   aristas:      relaciones entre nodos (depende_de/contribuye_a/bloquea/…).
 *   cerebro_log:  bitácora append-only de eventos (quién tocó qué).
 *   estado_actual: snapshot materializado (derivado de nodos+aristas+log+objetivos).
 *   objetivos:    metas del tenant (las lee el Director).
 *
 * Innegociables: append-only en cerebro_log; '@' en columnas-ID (COLUMNAS_TEXTO);
 * el índice del MAESTRO nunca lleva PII (solo conteos + resumen).
 */

// Pestañas del cerebro por tenant (definidas en CLIENTE_SHEETS / 01_schema.js).
// T3 M3: `cerebro_log_archivo` + `cerebro_resumen` son parte del cerebro (las crea repararCerebro,
// ocultas+protegidas) pero NO de CLIENTE_ORDEN — ver la nota de decisión en 01_schema.js.
var CEREBRO_SHEETS = ['nodos', 'aristas', 'cerebro_log', 'cerebro_log_archivo', 'cerebro_resumen', 'estado_actual', 'objetivos'];

/** Abre una pestaña del cerebro de un tenant. Lanza si falta (corré repararCerebro()). */
function cerebroSheet_(tenant, pestana) {
  var sh = abrirCliente(tenant).ss.getSheetByName(pestana);
  if (!sh) throw new Error('tenant ' + tenant + ' sin pestaña ' + pestana + ' (corré repararCerebro)');
  return sh;
}

/**
 * Upsert genérico por columna-clave: si existe la fila con esa clave la EDITA (campos
 * presentes en obj), si no la appendea. Bajo conLock (nextId + write atómico). Si la
 * clave viene vacía, se genera con nextId(prefijo). @return {id, creado}
 */
function upsertPorClave_(sh, claveCol, obj, prefijo, ancho, snap) {
  return conLock(function () {
    if (!obj[claveCol]) obj[claveCol] = nextId(sh, claveCol, prefijo, ancho || 4);
    // PURGA B5 #1: si el caller pasa `snap` (leerTabla capturado 1 vez), buscar el hit ahí en vez de
    // releer TODA la tabla por cada upsert (rompe el O(n²) del poblado del cerebro). El caller garantiza
    // claves únicas por lote; las filas no se borran → hit._fila sigue válido al escribir.
    var hit = (snap || leerTabla(sh)).filter(function (f) { return String(f[claveCol]) === String(obj[claveCol]); })[0];
    if (hit) {
      var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      for (var i = 0; i < H.length; i++) {
        if (obj.hasOwnProperty(H[i])) sh.getRange(hit._fila, i + 1).setValue(sanitizarCelda(obj[H[i]]));
      }
      return { id: obj[claveCol], creado: false };
    }
    appendFila(sh, obj);
    // #1: mantener el snap consistente dentro del lote → si la MISMA clave vuelve a upsertarse
    // en la misma corrida (p.ej. dos objetivos con la misma métrica), la 2ª vez ACTUALIZA, no duplica.
    if (snap) { var nuevo = {}; for (var k in obj) nuevo[k] = obj[k]; nuevo._fila = sh.getLastRow(); snap.push(nuevo); }
    return { id: obj[claveCol], creado: true };
  });
}

// ── Retrofit CEREBRO (doc canónico §4): eje del nodo por tipo ────────────────
// LÍDER (plano interior) · NEGOCIO (estructura) · SISTEMA (auto-conocimiento del OS).
var DIMENSION_POR_TIPO = {
  agente: 'sistema', herramienta: 'sistema', tarea: 'sistema', config: 'sistema', chequeo: 'sistema', chequeo_salud: 'sistema',
  objetivo_personal: 'lider', preferencia: 'lider', limite: 'lider', estilo: 'lider', senal: 'lider',
  cliente: 'negocio', proveedor: 'negocio', factura: 'negocio', producto: 'negocio', proceso: 'negocio',
  objetivo: 'negocio', metrica: 'negocio', evento: 'negocio', decision: 'negocio', riesgo: 'negocio',
  persona: 'negocio', hallazgo: 'negocio', proyecto: 'negocio'
};
/** Eje (dimensión) de un nodo según su tipo. Default conservador: negocio. */
function dimensionDeTipo_(tipo) { return DIMENSION_POR_TIPO[String(tipo)] || 'negocio'; }

/**
 * Upsert de un nodo del cerebro del tenant.
 * @param {string} tenant  id_cliente
 * @param {Object} nodo    { id_nodo?, tipo?, etiqueta?, atributos?, estado?, actor? }
 * @return {{id_nodo:string, creado:boolean}}
 */
function upsertNodo(tenant, nodo, snap) {
  nodo = nodo || {};
  var sh = cerebroSheet_(tenant, 'nodos');
  var tipo = nodo.tipo || 'generico';
  var fila = {
    id_nodo: nodo.id_nodo || '',
    dimension: nodo.dimension || dimensionDeTipo_(tipo),   // eje líder/negocio/sistema (tesis Satori)
    tipo: tipo,
    etiqueta: nodo.etiqueta || '',
    atributos: (typeof nodo.atributos === 'string') ? nodo.atributos : JSON.stringify(nodo.atributos || {}),
    relevancia: (nodo.relevancia == null ? 3 : nodo.relevancia),   // 1-5
    cobertura: (nodo.cobertura == null ? 0 : nodo.cobertura),       // 0-100 (puntos ciegos, §5)
    estado: nodo.estado || 'activo',
    fuente: nodo.fuente || nodo.actor || 'sistema',
    actualizado_en: ahoraISO()
  };
  var r = upsertPorClave_(sh, 'id_nodo', fila, 'NOD', 4, snap);
  logEvento(tenant, { evento: r.creado ? 'nodo_creado' : 'nodo_actualizado', id_nodo: r.id, origen: nodo.actor || 'sistema' });
  return { id_nodo: r.id, creado: r.creado };
}

/**
 * Upsert de una arista (relación dirigida entre dos nodos).
 * @param {string} tenant  id_cliente
 * @param {Object} arista  { id_arista?, origen, destino, tipo?, peso?, atributos?, actor? }
 * @return {{id_arista:string, creado:boolean}}
 */
function upsertArista(tenant, arista, snap) {
  arista = arista || {};
  if (!arista.origen || !arista.destino) throw new Error('arista sin origen/destino');
  var sh = cerebroSheet_(tenant, 'aristas');
  var relacion = arista.relacion || arista.tipo || 'relacion';   // vocabulario canónico (doc CEREBRO §3)
  var fila = {
    id_arista: arista.id_arista || '',
    origen: arista.origen,
    destino: arista.destino,
    relacion: relacion,
    tipo: arista.tipo || relacion,                                 // back-compat con el campo previo
    peso: (arista.peso === undefined || arista.peso === null) ? 1 : arista.peso,
    atributos: (typeof arista.atributos === 'string') ? arista.atributos : JSON.stringify(arista.atributos || {}),
    actualizado_en: ahoraISO()
  };
  var r = upsertPorClave_(sh, 'id_arista', fila, 'ARI', 4, snap);
  logEvento(tenant, { evento: r.creado ? 'arista_creada' : 'arista_actualizada', id_arista: r.id, origen: arista.actor || 'sistema' });
  return { id_arista: r.id, creado: r.creado };
}

/**
 * Append-only: registra un evento en cerebro_log del tenant.
 * @param {string} tenant
 * @param {Object} ev  { evento, id_nodo?, id_arista?, origen?(actor), detalle? }
 */
function logEvento(tenant, ev) {
  ev = ev || {};
  appendFila(cerebroSheet_(tenant, 'cerebro_log'), {
    ts: ahoraISO(),
    evento: ev.evento || 'evento',
    id_nodo: ev.id_nodo || '',
    id_arista: ev.id_arista || '',
    origen: ev.origen || 'sistema',
    detalle: (typeof ev.detalle === 'string') ? ev.detalle : JSON.stringify(ev.detalle || {})
  });
  return true;
}

// ═══ T3 M3 (21-jul) — MEMORIA CALIENTE / FRÍA (D8) ══════════════════════════
//
// Problema: `cerebro_log` es append-only y sin techo. Con 10× eventos, todo lector que hace
// `leerTabla(cerebro_log)` (materializarEstado, y por transitividad el Director en cada corrida)
// paga el crecimiento entero. Nada lee eventos de hace 6 meses uno por uno; lo que se necesita
// de esa cola es el CONTEO.
//
// Solución (append, jamás destructiva):
//   CALIENTE = `cerebro_log` con los últimos `cerebro_corte_dias` (Config, default 30).
//   FRÍA     = las filas más viejas se MUEVEN crudas a `cerebro_log_archivo` (mismo schema,
//              patrón Cola_archivo) y se resumen por mes en `cerebro_resumen`.
// Los lectores consumen CALIENTE + los resúmenes: `materializarEstado` sigue devolviendo el
// total real de eventos (`eventos` = calientes + archivados), así que comprimir NO hace caer
// ningún número visible. Ese es el invariante que asera D21.

/** Corte de la memoria caliente en días (Config `cerebro_corte_dias`; default 30, mínimo 1). */
function cerebroCorteDias_() {
  var n = parseInt(getConfig('cerebro_corte_dias') || '30', 10);
  return (isNaN(n) || n < 1) ? 30 : n;
}

/**
 * PURA (testeable, sin I/O): parte las filas de `cerebro_log` en calientes/frías según el corte
 * y arma las filas-resumen por período (YYYY-MM) de las frías.
 *
 * Regla dura: una fila con `ts` ilegible NUNCA se archiva (se queda caliente). Archivar a ciegas
 * lo que no se puede fechar sería mover datos por una lectura rota — el mismo error que la guarda
 * anti-wipe del conector evita.
 *
 * @param {Array} filas    leerTabla(cerebro_log)
 * @param {string} corteISO YYYY-MM-DD — todo evento ESTRICTAMENTE anterior es frío
 * @return {{frias:Array, resumenes:Array, calientes:number, ilegibles:number}}
 */
function _planCompresion_(filas, corteISO) {
  var frias = [], porPeriodo = {}, ilegibles = 0, calientes = 0;
  (filas || []).forEach(function (f) {
    var iso = String(aFechaISO(f.ts) || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { ilegibles++; calientes++; return; }
    if (iso >= String(corteISO)) { calientes++; return; }
    frias.push(f);
    var per = iso.slice(0, 7);
    var r = porPeriodo[per] || (porPeriodo[per] = { periodo: per, eventos: 0, tipos: {}, desde: iso, hasta: iso });
    r.eventos++;
    var ev = String(f.evento || 'evento');
    r.tipos[ev] = (r.tipos[ev] || 0) + 1;
    if (iso < r.desde) r.desde = iso;
    if (iso > r.hasta) r.hasta = iso;
  });
  var resumenes = Object.keys(porPeriodo).sort().map(function (p) {
    var r = porPeriodo[p];
    return { periodo: r.periodo, eventos: r.eventos, tipos: _tiposATexto_(r.tipos), desde: r.desde, hasta: r.hasta };
  });
  return { frias: frias, resumenes: resumenes, calientes: calientes, ilegibles: ilegibles };
}

/** PURA: {evento:n,...} → "evento:n · evento:n" (orden estable alfabético). */
function _tiposATexto_(tipos) {
  return Object.keys(tipos || {}).sort().map(function (t) { return t + ':' + tipos[t]; }).join(' · ');
}

/** PURA: "a:2 · b:1" → {a:2, b:1}. Tolera vacío/basura (devuelve {} o saltea el token). */
function _textoATipos_(txt) {
  var out = {};
  String(txt || '').split('·').forEach(function (p) {
    var m = String(p).trim().match(/^(.+):(\d+)$/);
    if (m) out[m[1]] = (out[m[1]] || 0) + parseInt(m[2], 10);
  });
  return out;
}

/**
 * PURA: fusiona el resumen YA guardado de un período con uno nuevo (una corrida posterior archiva
 * más filas del mismo mes). SUMA los conteos — nunca pisa, o el total del período mentiría.
 * @param {?Object} prev fila existente de cerebro_resumen (o null)
 * @param {Object} nuevo fila de _planCompresion_
 */
function _fusionarResumen_(prev, nuevo) {
  if (!prev) return { periodo: nuevo.periodo, eventos: nuevo.eventos, tipos: nuevo.tipos, desde: nuevo.desde, hasta: nuevo.hasta };
  var tipos = _textoATipos_(prev.tipos);
  var add = _textoATipos_(nuevo.tipos);
  Object.keys(add).forEach(function (k) { tipos[k] = (tipos[k] || 0) + add[k]; });
  var desdePrev = String(prev.desde || ''), hastaPrev = String(prev.hasta || '');
  return {
    periodo: nuevo.periodo,
    eventos: (Number(prev.eventos) || 0) + nuevo.eventos,
    tipos: _tiposATexto_(tipos),
    desde: (desdePrev && desdePrev < nuevo.desde) ? desdePrev : nuevo.desde,
    hasta: (hastaPrev && hastaPrev > nuevo.hasta) ? hastaPrev : nuevo.hasta
  };
}

/** Total de eventos ya archivados de un tenant, según las filas-resumen. 0 si la hoja no existe. */
function _eventosArchivados_(ssCli) {
  var sh = ssCli.getSheetByName('cerebro_resumen');
  if (!sh) return 0;
  return leerTabla(sh).reduce(function (a, r) { return a + (Number(r.eventos) || 0); }, 0);
}

/**
 * Comprime la memoria fría de UN tenant: mueve los eventos anteriores al corte de `cerebro_log`
 * a `cerebro_log_archivo` (crudo) y acumula su conteo en `cerebro_resumen`.
 *
 * Orden de escritura deliberado (append ANTES de borrar): si la corrida muere entre medio, lo peor
 * que queda es un evento duplicado entre log y archivo — nunca uno perdido.
 *
 * @param {string} tenant  id_cliente
 * @param {number} [dias]  override del corte (default: Config)
 * @return {{archivadas:number, calientes:number, periodos:number, ilegibles:number}}
 */
function comprimirMemoriaFria(tenant, dias) {
  var ssCli = abrirCliente(tenant).ss;
  var shLog = ssCli.getSheetByName('cerebro_log');
  if (!shLog) return { archivadas: 0, calientes: 0, periodos: 0, ilegibles: 0, omitido: 'sin cerebro_log' };

  var corte = hace(dias == null ? cerebroCorteDias_() : dias);
  var plan = _planCompresion_(leerTabla(shLog), corte);
  if (!plan.frias.length) {
    return { archivadas: 0, calientes: plan.calientes, periodos: 0, ilegibles: plan.ilegibles };
  }

  // Las hojas destino se aseguran acá (no dependen de que alguien haya corrido repararCerebro).
  var shArch = ensureSheet(ssCli, 'cerebro_log_archivo', CLIENTE_SHEETS.cerebro_log_archivo);
  var shRes = ensureSheet(ssCli, 'cerebro_resumen', CLIENTE_SHEETS.cerebro_resumen);
  try { protegerSheet(shArch, false); shArch.hideSheet(); protegerSheet(shRes, false); shRes.hideSheet(); } catch (_p) {}

  return conLock(function () {
    // 1) crudo al archivo (append: el evento sigue existiendo, entero).
    plan.frias.forEach(function (f) {
      appendFila(shArch, { ts: f.ts, evento: f.evento, id_nodo: f.id_nodo, id_arista: f.id_arista, origen: f.origen, detalle: f.detalle });
    });
    // 2) conteos al resumen (fusión con lo ya acumulado del mismo período).
    var previos = {};
    leerTabla(shRes).forEach(function (r) { previos[String(r.periodo)] = r; });
    plan.resumenes.forEach(function (r) {
      var fila = _fusionarResumen_(previos[r.periodo] || null, r);
      fila.comprimido_en = ahoraISO();
      upsertPorClave_(shRes, 'periodo', fila, 'PER', 4);
    });
    // 3) recién ahora se sacan del log caliente.
    borrarFilasBatch_(shLog, plan.frias.map(function (f) { return f._fila; }));
    Logger.log('comprimirMemoriaFria ' + tenant + ': ' + plan.frias.length + ' evento(s) < ' + corte +
               ' → archivo (' + plan.resumenes.length + ' período/s). Calientes: ' + plan.calientes + '.');
    return { archivadas: plan.frias.length, calientes: plan.calientes, periodos: plan.resumenes.length, ilegibles: plan.ilegibles };
  });
}

/**
 * Comprime la memoria fría de TODOS los tenants activos. Lo llama `corridaDiaria` ANTES del
 * Director (así el pase dirigido lee ya el log chico). Tolerante a fallos por tenant: comprimir
 * es HIGIENE — jamás puede tumbar la corrida.
 */
function comprimirMemoriaFriaTodos_() {
  var out = { tenants: 0, archivadas: 0, errores: [] };
  leerTabla(getMaestro().getSheetByName('Clientes')).forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    if (['activo', 'activo-piloto'].indexOf(String(c.estado).toLowerCase()) < 0) return;
    try {
      var r = comprimirMemoriaFria(c.id_cliente);
      out.tenants++; out.archivadas += r.archivadas;
    } catch (e) { out.errores.push(c.id_cliente + ': ' + ((e && e.message) || e)); }   // id, sin nombre (PURGA #24)
  });
  return out;
}

/** No-arg para correr del editor sobre toda la cartera. */
function comprimirMemoria() { return comprimirMemoriaFriaTodos_(); }

/**
 * Reconstruye estado_actual del tenant (snapshot derivado de nodos+aristas+log+objetivos)
 * y refresca el índice agregado del MAESTRO (Cerebro_index, SIN PII).
 *
 * T3 M3: `eventos` es el TOTAL histórico (calientes + archivados). Comprimir no lo baja —
 * ese es el invariante del contrato: el lector no se entera de que hubo compresión.
 * @return {{nodos:number, aristas:number, eventos:number, objetivos_activos:number}}
 */
function materializarEstado(tenant) {
  var ssCli = abrirCliente(tenant).ss;
  var nodos = leerTabla(ssCli.getSheetByName('nodos'));
  var aristas = leerTabla(ssCli.getSheetByName('aristas'));
  var log = leerTabla(ssCli.getSheetByName('cerebro_log'));
  var objetivos = leerTabla(ssCli.getSheetByName('objetivos'));
  var archivados = _eventosArchivados_(ssCli);
  var eventosTotal = log.length + archivados;

  var porTipo = {};
  var porDim = { lider: 0, negocio: 0, sistema: 0 };
  var covSum = 0, covN = 0, ciegos = 0;
  nodos.forEach(function (n) {
    var t = String(n.tipo || '—'); porTipo[t] = (porTipo[t] || 0) + 1;
    var d = String(n.dimension || dimensionDeTipo_(n.tipo)); porDim[d] = (porDim[d] || 0) + 1;
    var c = Number(n.cobertura); if (n.cobertura !== '' && n.cobertura != null && !isNaN(c)) { covSum += c; covN++; if (c < 40) ciegos++; }
  });
  // M3: si el log caliente quedó vacío tras comprimir, el "último evento" no es '' — es el
  // borde superior de lo archivado. Un tenant con historia no puede figurar como sin actividad.
  var ultimoEvento = log.length ? String(log[log.length - 1].ts) : _ultimoArchivado_(ssCli);
  var objActivos = objetivos.filter(function (o) {
    return ['activo', 'en_curso', 'abierto'].indexOf(String(o.estado).toLowerCase()) >= 0;
  }).length;

  var filas = [
    { seccion: 'resumen', clave: 'nodos', valor: nodos.length },
    { seccion: 'resumen', clave: 'aristas', valor: aristas.length },
    { seccion: 'resumen', clave: 'eventos', valor: eventosTotal },
    // M3: desglose caliente/frío — diagnóstico de la compresión, sin cambiar 'eventos'.
    { seccion: 'resumen', clave: 'eventos_calientes', valor: log.length },
    { seccion: 'resumen', clave: 'eventos_archivados', valor: archivados },
    { seccion: 'resumen', clave: 'ultimo_evento', valor: ultimoEvento },
    { seccion: 'objetivos', clave: 'activos', valor: objActivos }
  ];
  Object.keys(porTipo).forEach(function (t) {
    filas.push({ seccion: 'nodos_por_tipo', clave: t, valor: porTipo[t] });
  });
  // Retrofit CEREBRO: los 3 ejes (tesis Satori) + diagnóstico de cobertura (puntos ciegos, §5).
  ['lider', 'negocio', 'sistema'].forEach(function (d) {
    filas.push({ seccion: 'nodos_por_dimension', clave: d, valor: porDim[d] || 0 });
  });
  filas.push({ seccion: 'cobertura', clave: 'promedio', valor: covN ? Math.round(covSum / covN) : 0 });
  filas.push({ seccion: 'cobertura', clave: 'puntos_ciegos', valor: ciegos });

  // Reescribir estado_actual completo (snapshot, NO append-only). PURGA #5: clear+write bajo
  // conLock para que sea atómico (si setValues fallara entre medio, no queda la hoja vacía).
  var sh = ssCli.getSheetByName('estado_actual');
  conLock(function () {
    var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    var now = ahoraISO();
    var matriz = filas.map(function (f) {
      f.materializado_en = now;
      return H.map(function (h) { return sanitizarCelda(f.hasOwnProperty(h) ? f[h] : ''); });
    });
    if (matriz.length) sh.getRange(2, 1, matriz.length, H.length).setValues(matriz);
  });

  // Índice agregado en el MAESTRO: SOLO conteos + resumen, nunca PII (caso 20).
  actualizarCerebroIndex_(tenant, {
    nodos: nodos.length, aristas: aristas.length, ultimo_evento: ultimoEvento,
    estado_resumen: nodos.length + ' nodos · ' + aristas.length + ' aristas · ' + objActivos + ' obj. activos'
  });

  return { nodos: nodos.length, aristas: aristas.length, eventos: eventosTotal, objetivos_activos: objActivos };
}

/** Borde superior de lo archivado (max `hasta` de cerebro_resumen). '' si no hay archivo. */
function _ultimoArchivado_(ssCli) {
  var sh = ssCli.getSheetByName('cerebro_resumen');
  if (!sh) return '';
  var max = '';
  leerTabla(sh).forEach(function (r) { var h = String(r.hasta || ''); if (h > max) max = h; });
  return max;
}

/** Upsert de la fila del tenant en Cerebro_index del MAESTRO (sin PII). */
function actualizarCerebroIndex_(tenant, datos) {
  var sh = getMaestro().getSheetByName('Cerebro_index');
  if (!sh) return; // setup() la crea; si falta, no romper la materialización del tenant
  upsertPorClave_(sh, 'id_cliente', {
    id_cliente: tenant,
    nodos: datos.nodos,
    aristas: datos.aristas,
    ultimo_evento: datos.ultimo_evento || '',
    estado_resumen: datos.estado_resumen || '',
    materializado_en: ahoraISO()
  }, 'CLI', 3); // id_cliente ya viene → nunca genera uno nuevo
}

/** Lee el estado materializado del tenant como { seccion: { clave: valor } }. */
function leerEstado(tenant) {
  var sh = abrirCliente(tenant).ss.getSheetByName('estado_actual');
  if (!sh) throw new Error('tenant ' + tenant + ' sin estado_actual (corré repararCerebro)');
  var out = {};
  leerTabla(sh).forEach(function (f) {
    var s = String(f.seccion || '—');
    if (!out[s]) out[s] = {};
    out[s][String(f.clave)] = f.valor;
  });
  return out;
}

/**
 * Crea las pestañas del cerebro en los Sheets cliente que aún no las tengan (clientes
 * dados de alta antes de E8a) + asegura Cerebro_index en el MAESTRO. Ocultas+protegidas
 * como el resto de la interna. Idempotente (ensureSheet no pisa lo existente). Correr a mano.
 */
function repararCerebro() {
  ensureSheet(getMaestro(), 'Cerebro_index', MAESTRO_SHEETS['Cerebro_index']);
  var n = 0;
  leerTabla(getMaestro().getSheetByName('Clientes')).forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    try {
      var cs = SpreadsheetApp.openByUrl(c.url_sheet_cliente);
      CEREBRO_SHEETS.forEach(function (nombre) {
        var sh = ensureSheet(cs, nombre, CLIENTE_SHEETS[nombre]);
        protegerSheet(sh, false);
        sh.hideSheet();
      });
      n++;
    } catch (e) { Logger.log('repararCerebro ' + c.id_cliente + ': ' + e.message); } // PURGA #24: id, sin nombre
  });
  Logger.log('repararCerebro: cerebro en ' + n + ' cliente(s) + Cerebro_index en MAESTRO.');
  return { clientes: n };
}

/**
 * Retrofit CEREBRO al doc canónico: agrega a las pestañas nodos/aristas YA existentes de cada
 * cliente las columnas canónicas que falten (dimension/relevancia/cobertura/fuente en nodos;
 * relacion en aristas), al final y sin tocar datos. Backfilla filas existentes con defaults.
 * Idempotente. Correr a mano UNA vez tras desplegar el retrofit. @return {{nodos, aristas}}
 */
function migrarCerebroSchema() {
  var add = { nodos: 0, aristas: 0 };
  leerTabla(getMaestro().getSheetByName('Clientes')).forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    try {
      var cs = SpreadsheetApp.openByUrl(c.url_sheet_cliente);
      add.nodos += agregarColumnasFaltantes_(cs.getSheetByName('nodos'), CLIENTE_SHEETS.nodos, { dimension: 'negocio', relevancia: 3, cobertura: 0, fuente: 'sistema' });
      add.aristas += agregarColumnasFaltantes_(cs.getSheetByName('aristas'), CLIENTE_SHEETS.aristas, { relacion: 'relacion' });
    } catch (e) { Logger.log('migrarCerebroSchema ' + c.id_cliente + ': ' + e.message); } // PURGA #24: id, sin nombre
  });
  Logger.log('migrarCerebroSchema: +' + add.nodos + ' col nodos, +' + add.aristas + ' col aristas (acumulado).');
  return add;
}

/**
 * Agrega al FINAL de `sh` las columnas de `headersCanon` ausentes en la fila 1; backfilla las
 * filas existentes con `defaults`. Bajo conLock (atómico). No reordena ni borra. @return n agregadas.
 */
function agregarColumnasFaltantes_(sh, headersCanon, defaults) {
  if (!sh) return 0;
  var hdr = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  var nuevas = headersCanon.filter(function (h) { return hdr.indexOf(h) < 0; });
  if (!nuevas.length) return 0;
  return conLock(function () {
    var startCol = sh.getLastColumn() + 1;
    sh.getRange(1, startCol, 1, nuevas.length).setValues([nuevas]).setFontWeight('bold').setBackground('#f0f0f0');
    var filas = sh.getLastRow() - 1;
    if (filas > 0) {
      var matriz = [];
      for (var r = 0; r < filas; r++) matriz.push(nuevas.map(function (h) { return (defaults && defaults.hasOwnProperty(h)) ? defaults[h] : ''; }));
      sh.getRange(2, startCol, filas, nuevas.length).setValues(matriz);
    }
    return nuevas.length;
  });
}

/**
 * Alta de un objetivo en el cerebro del tenant (lo dirige el Director). Pone formato correcto
 * (id-texto) y deja la pestaña oculta/protegida intacta. estado='activo' por defecto → el
 * Director lo toma en la próxima corrida. Requiere descripcion y/o metrica.
 * @return {{id, creado}}
 */
function cargarObjetivo(idCliente, obj) {
  obj = obj || {};
  if (!obj.descripcion && !obj.metrica) throw new Error('el objetivo necesita descripcion y/o metrica');
  var sh = cerebroSheet_(idCliente, 'objetivos');
  var r = upsertPorClave_(sh, 'id_objetivo', {
    id_objetivo: obj.id_objetivo || '',
    horizonte: obj.horizonte || '12m',
    descripcion: obj.descripcion || '',
    metrica: obj.metrica || '',
    valor_objetivo: (obj.valor_objetivo == null ? '' : obj.valor_objetivo),
    estado: obj.estado || 'activo',
    prioridad: obj.prioridad || 'B',
    fecha_objetivo: obj.fecha_objetivo || '',
    // North Star enriquecido (20-jul). Opcionales: si no vienen, quedan vacíos y la fila es la de antes.
    metricas_extra: obj.metricas_extra || '',
    valores: obj.valores || '',
    pivots_descartados: obj.pivots_descartados || ''
  }, 'OBJ', 4);
  logEvento(idCliente, { evento: r.creado ? 'objetivo_creado' : 'objetivo_actualizado', origen: 'alta', detalle: { id: r.id, metrica: obj.metrica || '' } });
  Logger.log('cargarObjetivo ' + idCliente + ': ' + r.id + (r.creado ? ' (creado)' : ' (actualizado)'));
  return r;
}

/**
 * Puesta en marcha — EDITAR los valores y correr desde el editor para cargar objetivos reales.
 * Solo objetivos CON `metrica` disparan el análisis dirigido del Director (el Vigía igual corre
 * con solo tener datos en Datos_operativos).
 */
function cargarObjetivosPiloto() {
  // ↓↓↓ Cambiá idCliente y los objetivos por los reales del cliente piloto ↓↓↓
  cargarObjetivo('CLI-001', { descripcion: 'Subir el ticket promedio', metrica: 'ticket_promedio_eur', valor_objetivo: 25, horizonte: '12m', prioridad: 'A' });
  // cargarObjetivo('CLI-001', { descripcion: 'Bajar la merma de stock', metrica: 'merma_pct', valor_objetivo: 5, prioridad: 'B' });
  // cargarObjetivo('CLI-001', { descripcion: 'Reducir días de cobro', metrica: 'dias_cobro_promedio', valor_objetivo: 30 });
}

/**
 * Siembra datos operativos de EJEMPLO en Datos_operativos de un cliente (default CLI-001) para
 * ver el loop produciendo sin pelear con pegados de CSV. Correr desde el editor. Borrá las filas
 * cuando cargues las reales. Resto de Barcelona, 2 semanas.
 */
function sembrarDatosEjemplo(idCliente) {
  idCliente = idCliente || 'CLI-001';
  var sh = abrirCliente(idCliente).ss.getSheetByName('Datos_operativos');
  if (!sh) throw new Error(idCliente + ' sin Datos_operativos');
  var datos = [
    { fecha: '2026-06-01', concepto: 'Ventas del día', valor: 1840.50, fuente: 'TPV', notas: '68 cubiertos' },
    { fecha: '2026-06-02', concepto: 'Ventas del día', valor: 1620.00, fuente: 'TPV', notas: '59 cubiertos' },
    { fecha: '2026-06-03', concepto: 'Ventas del día', valor: 1755.25, fuente: 'TPV', notas: '64 cubiertos' },
    { fecha: '2026-06-03', concepto: 'Compra carnes', valor: -420.00, fuente: 'Proveedor Solà', notas: 'factura 1021' },
    { fecha: '2026-06-05', concepto: 'Compra verduras', valor: -180.40, fuente: 'Mercabarna', notas: '' },
    { fecha: '2026-06-06', concepto: 'Ventas del día', valor: 2310.00, fuente: 'TPV', notas: 'fin de semana · 81 cubiertos' },
    { fecha: '2026-06-07', concepto: 'Ventas del día', valor: 2580.75, fuente: 'TPV', notas: 'fin de semana · 92 cubiertos' },
    { fecha: '2026-06-08', concepto: 'Alquiler local', valor: -2200.00, fuente: 'Inmobiliaria', notas: 'junio' },
    { fecha: '2026-06-09', concepto: 'Sueldos quincena', valor: -3100.00, fuente: 'Nómina', notas: '5 empleados' },
    { fecha: '2026-06-10', concepto: 'Ventas del día', valor: 1490.00, fuente: 'TPV', notas: '54 cubiertos' },
    { fecha: '2026-06-10', concepto: 'Compra bebidas', valor: -640.00, fuente: 'Distribuidora Vega', notas: 'factura 0098 · vence 2026-06-25' },
    { fecha: '2026-06-12', concepto: 'Ventas del día', valor: 1705.50, fuente: 'TPV', notas: '61 cubiertos' },
    { fecha: '2026-06-13', concepto: 'Ventas del día', valor: 2420.00, fuente: 'TPV', notas: 'fin de semana · 86 cubiertos' },
    { fecha: '2026-06-14', concepto: 'Evento privado', valor: 1200.00, fuente: 'Reserva', notas: 'seña parcial · resta 600 · vence 2026-06-28' },
    { fecha: '2026-06-15', concepto: 'Ventas del día', valor: 1980.00, fuente: 'TPV', notas: '70 cubiertos' },
    { fecha: '2026-06-15', concepto: 'Compra carnes', valor: -510.00, fuente: 'Proveedor Solà', notas: 'factura 1044 · vence 2026-06-30' },
    { fecha: '2026-06-16', concepto: 'Ventas del día', valor: 1610.00, fuente: 'TPV', notas: '58 cubiertos' },
    { fecha: '2026-06-16', concepto: 'Servicios luz/gas', valor: -380.00, fuente: 'Endesa', notas: '' }
  ];
  datos.forEach(function (d) { appendFila(sh, d); });
  Logger.log('sembrarDatosEjemplo ' + idCliente + ': ' + datos.length + ' filas en Datos_operativos.');
  return { cliente: idCliente, filas: datos.length };
}
