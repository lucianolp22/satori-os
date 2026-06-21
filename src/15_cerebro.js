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
function upsertNodo(tenant, nodo) {
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
  var porDim = { lider: 0, negocio: 0, sistema: 0 };
  var covSum = 0, covN = 0, ciegos = 0;
  nodos.forEach(function (n) {
    var t = String(n.tipo || '—'); porTipo[t] = (porTipo[t] || 0) + 1;
    var d = String(n.dimension || dimensionDeTipo_(n.tipo)); porDim[d] = (porDim[d] || 0) + 1;
    var c = Number(n.cobertura); if (n.cobertura !== '' && n.cobertura != null && !isNaN(c)) { covSum += c; covN++; if (c < 40) ciegos++; }
  });
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
    fecha_objetivo: obj.fecha_objetivo || ''
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
