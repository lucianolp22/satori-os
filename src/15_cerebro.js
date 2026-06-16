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
var CEREBRO_SHEETS = ['nodos', 'aristas', 'cerebro_log', 'estado_actual', 'objetivos'];

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
function upsertPorClave_(sh, claveCol, obj, prefijo, ancho) {
  return conLock(function () {
    if (!obj[claveCol]) obj[claveCol] = nextId(sh, claveCol, prefijo, ancho || 4);
    var hit = leerTabla(sh).filter(function (f) { return String(f[claveCol]) === String(obj[claveCol]); })[0];
    if (hit) {
      var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      for (var i = 0; i < H.length; i++) {
        if (obj.hasOwnProperty(H[i])) sh.getRange(hit._fila, i + 1).setValue(sanitizarCelda(obj[H[i]]));
      }
      return { id: obj[claveCol], creado: false };
    }
    appendFila(sh, obj);
    return { id: obj[claveCol], creado: true };
  });
}

/**
 * Upsert de un nodo del cerebro del tenant.
 * @param {string} tenant  id_cliente
 * @param {Object} nodo    { id_nodo?, tipo?, etiqueta?, atributos?, estado?, actor? }
 * @return {{id_nodo:string, creado:boolean}}
 */
function upsertNodo(tenant, nodo) {
  nodo = nodo || {};
  var sh = cerebroSheet_(tenant, 'nodos');
  var fila = {
    id_nodo: nodo.id_nodo || '',
    tipo: nodo.tipo || 'generico',
    etiqueta: nodo.etiqueta || '',
    atributos: (typeof nodo.atributos === 'string') ? nodo.atributos : JSON.stringify(nodo.atributos || {}),
    estado: nodo.estado || 'activo',
    actualizado_en: ahoraISO()
  };
  var r = upsertPorClave_(sh, 'id_nodo', fila, 'NOD', 4);
  logEvento(tenant, { evento: r.creado ? 'nodo_creado' : 'nodo_actualizado', id_nodo: r.id, origen: nodo.actor || 'sistema' });
  return { id_nodo: r.id, creado: r.creado };
}

/**
 * Upsert de una arista (relación dirigida entre dos nodos).
 * @param {string} tenant  id_cliente
 * @param {Object} arista  { id_arista?, origen, destino, tipo?, peso?, atributos?, actor? }
 * @return {{id_arista:string, creado:boolean}}
 */
function upsertArista(tenant, arista) {
  arista = arista || {};
  if (!arista.origen || !arista.destino) throw new Error('arista sin origen/destino');
  var sh = cerebroSheet_(tenant, 'aristas');
  var fila = {
    id_arista: arista.id_arista || '',
    origen: arista.origen,
    destino: arista.destino,
    tipo: arista.tipo || 'relacion',
    peso: (arista.peso === undefined || arista.peso === null) ? 1 : arista.peso,
    atributos: (typeof arista.atributos === 'string') ? arista.atributos : JSON.stringify(arista.atributos || {}),
    actualizado_en: ahoraISO()
  };
  var r = upsertPorClave_(sh, 'id_arista', fila, 'ARI', 4);
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

/**
 * Reconstruye estado_actual del tenant (snapshot derivado de nodos+aristas+log+objetivos)
 * y refresca el índice agregado del MAESTRO (Cerebro_index, SIN PII).
 * @return {{nodos:number, aristas:number, eventos:number, objetivos_activos:number}}
 */
function materializarEstado(tenant) {
  var ssCli = abrirCliente(tenant).ss;
  var nodos = leerTabla(ssCli.getSheetByName('nodos'));
  var aristas = leerTabla(ssCli.getSheetByName('aristas'));
  var log = leerTabla(ssCli.getSheetByName('cerebro_log'));
  var objetivos = leerTabla(ssCli.getSheetByName('objetivos'));

  var porTipo = {};
  nodos.forEach(function (n) { var t = String(n.tipo || '—'); porTipo[t] = (porTipo[t] || 0) + 1; });
  var ultimoEvento = log.length ? String(log[log.length - 1].ts) : '';
  var objActivos = objetivos.filter(function (o) {
    return ['activo', 'en_curso', 'abierto'].indexOf(String(o.estado).toLowerCase()) >= 0;
  }).length;

  var filas = [
    { seccion: 'resumen', clave: 'nodos', valor: nodos.length },
    { seccion: 'resumen', clave: 'aristas', valor: aristas.length },
    { seccion: 'resumen', clave: 'eventos', valor: log.length },
    { seccion: 'resumen', clave: 'ultimo_evento', valor: ultimoEvento },
    { seccion: 'objetivos', clave: 'activos', valor: objActivos }
  ];
  Object.keys(porTipo).forEach(function (t) {
    filas.push({ seccion: 'nodos_por_tipo', clave: t, valor: porTipo[t] });
  });

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

  return { nodos: nodos.length, aristas: aristas.length, eventos: log.length, objetivos_activos: objActivos };
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
