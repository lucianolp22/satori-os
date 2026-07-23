/**
 * 19_conectores.js — Capa de conectores (integración con los sistemas de los clientes).
 *
 * Patrón: PULL-AND-SYNC basado en contrato. Un conector lee la fuente del cliente y escribe
 * agregados en su `Datos_operativos` (el contrato que ya leen los agentes). Los agentes NO
 * cambian. Sin read-live (no se llama la fuente en cada tarea).
 *
 * Vehemence (CLI-002): su ERP (Vehemence SGIC) corre en el MISMO Workspace luciano@ → Satori
 * abre su DB con `openById` **sin credenciales** (acceso ya existente vía el share). El conector
 * SOLO LEE la fuente (jamás escribe en el sistema del cliente).
 *
 * `DB_VENTAS` (contrato del SGIC, Code.gs:244): id·ts·channel·...·subtotal_ars·total_ars·
 * envio_ars·tn_order_id·status·... — channel 'online' | 'pos'(local). Montos en ARS.
 *
 * Purga conector (19-jun): #1 guard anti-wipe · #2 nota de cobertura de canal · #3 adaptador
 * parametrizado (sheetName+fuente) · #4 aviso temprano de escala · #5 canal desconocido→'otro'
 * (no ensucia 'local') · #6 borrado batch por rangos contiguos.
 */

// ID de la planilla DB de Vehemence SGIC. NO es secreto (es un identificador; el acceso lo
// gobierna el ACL del Sheet). Si se escala, mover a un registro `Conectores`.
var VEHEMENCE_DB_ID = '1ac1ccVMdFgO_VyOzsGwvdtEhCil41A6GnrJIAoNAwNk';

// Purga #4: umbral de aviso temprano antes del muro de 6 min. No recorta la lectura (no se
// asume orden cronológico de la fuente → recortar arriesgaría totales); solo loguea para
// evaluar lectura por ventana cuando la fuente crezca.
var CONECTOR_AVISO_FILAS = 50000;

/** Conector de Vehemence (CLI-002): no-arg para correr del editor. Lee DB_VENTAS → Datos_operativos. */
function sincronizarVehemence() {
  return sincronizarConectorVentas_('CLI-002', VEHEMENCE_DB_ID, 'DB_VENTAS', 'Vehemence SGIC · DB_VENTAS');
}

// ═══ TC-W3 (21-jul) — CONECTORES GENERALIZADOS: mapa por Config + adapters ═══
//
// Punto de partida verificado: `sincronizarConectorVentas_` YA era genérica y Vehemence era un
// wrapper de una línea. Lo que faltaba no era el motor: era (a) dónde se declara cada cliente sin
// tocar código, y (b) qué hacer cuando el SGIC del cliente NO tiene la forma de DB_VENTAS.
//
// (a) MAPA POR CONFIG — 3 filas por cliente en la hoja Config del MAESTRO:
//       conector_CLI-00X_db     spreadsheetId del Sheet-DB de su SGIC
//       conector_CLI-00X_tipo   qué adapter usar (clave de CONECTOR_ADAPTERS)
//       conector_CLI-00X_on     'true' | 'false'  ← NACE EN false SIEMPRE
//     Alta de un cliente = 3 filas en una hoja. Cero deploy.
//
// (b) ADAPTERS — cada SGIC tiene su forma. Un adapter mapea SU hoja de operaciones al contrato de
//     `Datos_operativos` ({fecha, concepto, valor, fuente, notas}). El adapter es una función PURA
//     (filas crudas → filas de contrato): se puede aserir con fixtures, sin abrir un solo Sheet real.
//
// POR QUÉ NACEN OFF (regla dura de la cadena): un conector es código que lee el sistema PRODUCTIVO
// de un cliente. Encenderlo sin haber validado al peso que los totales que escribe coinciden con lo
// que ese cliente ve en su propio sistema es sembrar números plausibles y falsos en las hojas que
// alimentan las recomendaciones. La cadena CONSTRUYE; la revisión enciende, uno por uno.
//
// BASTIÓN: read-only estricto sobre el SGIC (jamás una escritura) · allowlist de hojas POR ADAPTER
// (un `conector_X_db` apuntando a la planilla equivocada no puede leer nada que el adapter no
// declare) · sanitizado de toda celda (patrón D13f: la celda de un SGIC es dato hostil) · cap de
// filas · sin credenciales (mismo Workspace, el ACL del Sheet es el gate).

/**
 * Adapters por tipo de SGIC. Cada uno declara:
 *   hojas:   ALLOWLIST — las únicas pestañas que este adapter puede leer de la fuente. Nunca
 *            `Config`, nunca hojas de usuarios/PII: si no está acá, no se abre.
 *   modo:    'ventas'  → reusa `agregarVentasPorMes_` (contrato DB_VENTAS ya verificado)
 *            'operaciones' → usa `mapear` (función PURA propia del adapter)
 *   mapear:  (filas crudas de la hoja) → [{fecha, concepto, valor, notas}]  (solo modo 'operaciones')
 */
var CONECTOR_ADAPTERS = {
  // Contrato DB_VENTAS (Vehemence SGIC): id·ts·channel·subtotal_ars·total_ars·envio_ars·status.
  // Es el único adapter con kilómetros reales encima — por eso los demás no lo copian, lo reusan.
  ventas_sgic: {
    hojas: ['DB_VENTAS'],
    modo: 'ventas',
    descripcion: 'SGIC con hoja DB_VENTAS (contrato Vehemence): agrega ventas por mes×canal.'
  },
  // Genérico de operaciones: cualquier hoja con fecha + concepto + importe. Es el que absorbe a los
  // SGIC cuyo esquema NO se pudo confirmar todavía — con la hoja declarada en el adapter, no adivinada.
  operaciones_generico: {
    hojas: ['Operaciones', 'Movimientos', 'Libro', 'Cartera', 'Reservas'],
    modo: 'operaciones',
    descripcion: 'Hoja de operaciones con columnas fecha/concepto/importe (nombres flexibles).',
    mapear: function (filas) { return mapearOperacionesGenerico_(filas); }
  },

  // ── Adapters por SGIC real (esquemas verificados en el barrido A3 del 21-jul; el origen de cada
  //    ID y de cada esquema está en REPORTE-CADENA-2026-07-21.md). Los tres nacen APAGADOS.
  //
  //    Por qué cada uno tiene su función y no reusan `operaciones_generico`: la diferencia entre
  //    estos SGIC no está en cómo se llaman las columnas — está en qué filas NO hay que sumar. Un
  //    adapter que ignore eso produce totales plausibles y falsos, que es el peor resultado posible.

  // LC Travel — `DB_LIBRO` es el libro de movimientos y el EERR lee SOLO de ahí, por devengado.
  libro_lctravel: {
    hojas: ['DB_LIBRO'],
    modo: 'operaciones',
    descripcion: 'LC Travel · DB_LIBRO (libro de movimientos). Excluye transferencias y archivados.',
    mapear: function (filas) { return mapearLibroLcTravel_(filas); }
  },

  // MesaQuince — `tx_movimientos` es warehouse-owned y TODO viene como texto (evita que Sheets
  // coaccione fechas y números).
  movimientos_mesaquince: {
    hojas: ['tx_movimientos'],
    modo: 'operaciones',
    descripcion: 'MesaQuince · tx_movimientos (todo texto). Excluye transferencias y clases no-EERR.',
    mapear: function (filas) { return mapearMovimientosMesaquince_(filas); }
  },

  // DAM — `Fresha_Daily` es la única hoja transaccional de ingresos (upsert idempotente por fecha).
  fresha_dam: {
    hojas: ['Fresha_Daily'],
    modo: 'operaciones',
    descripcion: 'DAM · Fresha_Daily (ingresos diarios). Solo ingresos: los costos viven en Costos_Cal.',
    mapear: function (filas) { return mapearFreshaDam_(filas); }
  }
};

/**
 * PURA — LC Travel · `DB_LIBRO` → contrato.
 * Reglas del esquema (verificadas, no inferidas): `tipo` ∈ ingreso|egreso|transferencia ·
 * `archived` marca bajas · `mes` es el eje de devengado · `ext_id` es la clave natural.
 *
 * Se EXCLUYEN transferencias: mover plata entre cuentas propias no es ingreso ni egreso, y sumarlas
 * infla las dos puntas. Se excluyen archivadas. El signo lo da `tipo`, no el signo del campo `monto`
 * (el SGIC guarda montos positivos y decide por tipo) — por eso el egreso se emite en negativo acá.
 */
function mapearLibroLcTravel_(filas) {
  var out = [], descartadas = 0;
  (filas || []).forEach(function (f) {
    var tipo = _sinTildes_(String(f.tipo || '').toLowerCase().trim());
    if (tipo === 'transferencia') { descartadas++; return; }         // no es resultado, es movimiento interno
    if (String(f.archived).toLowerCase() === 'true') { descartadas++; return; }
    var iso = aFechaISO(f.fecha);
    var v = Number(f.monto);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) || isNaN(v)) { descartadas++; return; }
    out.push({
      fecha: iso,
      concepto: limpiarHostilTexto_(String(f.concepto || f.rubro || 'Movimiento'), 120),
      valor: (tipo === 'egreso' ? -Math.abs(v) : Math.abs(v)),
      notas: limpiarHostilTexto_([f.rubro, f.medio, tipo].filter(String).join(' · '), 120)
    });
  });
  return { filas: out, descartadas: descartadas, columnas: { fecha: 'fecha', concepto: 'concepto', valor: 'monto' } };
}

/**
 * PURA — MesaQuince · `tx_movimientos` → contrato.
 * Reglas del esquema: todo llega como TEXTO · `mes_devengado` (no `fecha`) es el eje del EERR ·
 * se excluyen las clases que no son resultado.
 *
 * LÍMITE CONOCIDO Y DECLARADO: el rubro EFECTIVO de MesaQuince no es la columna `rubro` cruda —
 * sale de aplicar un overlay guardado en un blob JSON (`_dash_movimientos_overlay`) y después el
 * catálogo de 59 cuentas → 17 rubros. Este adapter NO aplica ese overlay: trae el movimiento con su
 * rubro crudo. Sirve para el volumen y la serie temporal; NO sirve para reproducir el EERR por rubro
 * de MesaQuince. Está anotado acá y en el REPORTE para que nadie lo use como si fuera el EERR.
 */
var MESAQUINCE_EXCLUIR = ['transferencia', 'pago_tarjeta', 'prestamo_socio', 'extraordinario', 'sin_categorizar'];
function mapearMovimientosMesaquince_(filas) {
  var out = [], descartadas = 0;
  (filas || []).forEach(function (f) {
    var tipo = _sinTildes_(String(f.tipo || '').toLowerCase().trim().replace(/\s+/g, '_'));
    var rubro = _sinTildes_(String(f.rubro || '').toLowerCase().trim().replace(/\s+/g, '_'));
    if (MESAQUINCE_EXCLUIR.indexOf(tipo) >= 0 || MESAQUINCE_EXCLUIR.indexOf(rubro) >= 0) { descartadas++; return; }
    // `mes_devengado` manda (es el eje del EERR); si falta, se cae a `fecha`.
    var iso = aFechaISO(f.fecha);
    var mes = String(f.mes_devengado || '').trim();
    if (/^\d{4}-\d{2}$/.test(mes)) iso = mes + '-01';
    var v = Number(String(f.importe || '').replace(/\./g, '').replace(',', '.'));   // todo viene como texto
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) || isNaN(v)) { descartadas++; return; }
    out.push({
      fecha: iso,
      concepto: limpiarHostilTexto_(String(f.concepto || f.rubro || 'Movimiento'), 120),
      valor: v,
      notas: limpiarHostilTexto_([f.rubro, f.cuenta_nombre, f.proveedor_nombre].filter(String).join(' · '), 120) +
             ' · rubro CRUDO (sin overlay del dashboard)'
    });
  });
  return { filas: out, descartadas: descartadas, columnas: { fecha: 'mes_devengado|fecha', concepto: 'concepto', valor: 'importe' } };
}

/**
 * PURA — DAM · `Fresha_Daily` → contrato. Esquema chico y limpio: `date, rev, tx`.
 * SOLO ingresos: los costos de DAM viven en `Costos_Cal`, con su propia forma (`ym`+`day` separados
 * y filas plantilla con `ym='tmpl'`). Mezclarlos acá exigiría dos hojas en un adapter y un criterio
 * de devengado que todavía no está validado — queda documentado como el siguiente paso, no improvisado.
 */
function mapearFreshaDam_(filas) {
  var out = [], descartadas = 0;
  (filas || []).forEach(function (f) {
    var iso = aFechaISO(f.date || f.fecha);
    var v = Number(f.rev);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) || isNaN(v)) { descartadas++; return; }
    var tx = Number(f.tx);
    out.push({
      fecha: iso,
      concepto: 'Ingresos Fresha (día)',
      valor: v,
      notas: (isNaN(tx) ? '' : tx + ' transacción(es)') + ' · solo ingresos (los costos viven en Costos_Cal)'
    });
  });
  return { filas: out, descartadas: descartadas, columnas: { fecha: 'date', concepto: '(fijo)', valor: 'rev' } };
}

/**
 * Siembra las 3 filas de Config de los SGIC cuyo Spreadsheet-ID quedó CONFIRMADO en el barrido A3
 * (21-jul). Correr UNA vez desde el editor. **Todos quedan APAGADOS**: sembrar no es encender.
 *
 * NO se siembran (y el porqué, para que nadie los "complete" de memoria):
 *   · EJF/Figueras — su Spreadsheet-ID no existe en ningún archivo del Mac: vive solo en la Script
 *     Property `FIGUERAS_SS_ID` de SU proyecto GAS. Además su SGIC no tiene libro contable (es CMS
 *     de artista); el único mapeo honesto sería su hoja `metrics`, que no es dinero.
 *   · Oficina Virtual — no es GAS+Sheets: es Python + SQLite (`data/oficina.db`). Un conector de
 *     Sheets no puede leerla; su enganche previsto es otro (clave `np_*` en Config).
 *
 * Los id_cliente son los del MAESTRO. Si alguno no coincide con la cartera real, la fila queda
 * huérfana y `estadoConectores()` la muestra sin cliente — se corrige ahí, no se adivina acá.
 */
var CONECTORES_HALLADOS_A3 = [
  { cliente: 'CLI-003', db: '1_5fyiolfK2bvvPwKmGr5kUxrRCUAUOGXiTu-x2Zigzc', tipo: 'libro_lctravel',
    nota: 'LC Travel · "LCTRAVELS - Base de datos" (Code.js:1, confirmado literal)' },
  { cliente: 'CLI-004', db: '16scXurhcVyzjLJoRtjKZViy7aqpvd7wjvEzZ7mwo-d8', tipo: 'movimientos_mesaquince',
    nota: 'MesaQuince/FRANFLACA RB S.L. (code.gs.rtf:28 + HANDOFF_MesaQuince.md:15)' },
  { cliente: 'CLI-005', db: '1_pkEGg5e14gF2_59EmEygDoR9BlIvPAvZZOg6k50dWY', tipo: 'fresha_dam',
    nota: 'DAM Barber Shop · "DAM System · DB" (HANDOFF.md:77 + N3_Plano_DataLayer.md:9)' }
];

function sembrarConectoresHallados() {
  var out = [];
  CONECTORES_HALLADOS_A3.forEach(function (c) {
    try { altaConector(c.cliente, c.db, c.tipo); out.push(c.cliente + ' ✓ (' + c.tipo + ', APAGADO)'); }
    catch (e) { out.push(c.cliente + ' ✗ ' + ((e && e.message) || e)); }
  });
  Logger.log('sembrarConectoresHallados:\n  ' + out.join('\n  ') +
             '\n\n⚠ Los id_cliente son un SUPUESTO: verificá contra la hoja Clientes del MAESTRO antes de encender.' +
             '\n⚠ Ninguno quedó encendido. Por cada uno: probarConector(id) → comparar totales contra la fuente → encenderConector(id).');
  return out;
}

/** Prefijo de las claves de Config del mapa de conectores. */
var CONECTOR_PREFIJO = 'conector_';

/**
 * PURA (testeable): las filas `conector_*` de Config → mapa por cliente.
 * Un conector solo cuenta como CONFIGURADO si tiene `db` y `tipo`; `on` ausente = false
 * (default-deny: la ausencia de una fila jamás enciende nada).
 * @param {Array<{clave:string, valor:*}>} filasConfig
 * @return {Object} { 'CLI-002': {db, tipo, on:boolean}, ... }
 */
function _mapaConectores_(filasConfig) {
  var out = {};
  (filasConfig || []).forEach(function (f) {
    var k = String(f.clave || '');
    if (k.indexOf(CONECTOR_PREFIJO) !== 0) return;
    var resto = k.slice(CONECTOR_PREFIJO.length);
    var i = resto.lastIndexOf('_');
    if (i <= 0) return;
    var cli = resto.slice(0, i), campo = resto.slice(i + 1);
    if (['db', 'tipo', 'on'].indexOf(campo) < 0) return;
    if (!out[cli]) out[cli] = { db: '', tipo: '', on: false };
    if (campo === 'on') out[cli].on = String(f.valor).trim().toLowerCase() === 'true';
    else out[cli][campo] = String(f.valor || '').trim();
  });
  return out;
}

/**
 * PURA: ¿este conector corre? Devuelve {correr:boolean, motivo:string}. El motivo se loguea y se
 * reporta — un conector que no corre en silencio es indistinguible de uno que corrió y no trajo nada.
 */
function _decidirConector_(cli, cfg) {
  if (!cfg) return { correr: false, motivo: 'sin configuración' };
  if (!cfg.db) return { correr: false, motivo: 'sin conector_' + cli + '_db (spreadsheetId del SGIC)' };
  if (!cfg.tipo) return { correr: false, motivo: 'sin conector_' + cli + '_tipo (adapter)' };
  if (!CONECTOR_ADAPTERS[cfg.tipo]) return { correr: false, motivo: 'adapter desconocido: ' + cfg.tipo };
  if (!cfg.on) return { correr: false, motivo: 'apagado (conector_' + cli + '_on=false)' };
  return { correr: true, motivo: '' };
}

/**
 * PURA: hoja cruda de operaciones → contrato de `Datos_operativos`. Nombres de columna flexibles
 * (cada SGIC llama distinto a lo mismo) pero el CONTRATO de salida es fijo.
 *
 * Fail-honesto: una fila sin fecha ISO válida o sin importe numérico se DESCARTA y se cuenta. Meterla
 * con valor 0 o con la fecha de hoy sería inventar un dato — el sistema entero se apoya en que lo que
 * está en `Datos_operativos` pasó de verdad.
 *
 * @param {Array} filas  leerTabla() de la hoja del SGIC
 * @return {{filas:Array, descartadas:number, columnas:Object}}
 */
function mapearOperacionesGenerico_(filas) {
  var ALIAS = {
    fecha: ['fecha', 'ts', 'date', 'dia', 'fecha_operacion', 'fecha_alta'],
    concepto: ['concepto', 'descripcion', 'detalle', 'operacion', 'titulo', 'item'],
    valor: ['valor', 'importe', 'total', 'monto', 'total_ars', 'importe_ars', 'precio']
  };
  var out = [], descartadas = 0, cols = { fecha: '', concepto: '', valor: '' };
  if (!filas || !filas.length) return { filas: out, descartadas: 0, columnas: cols };

  // Resolver columnas UNA vez, contra los headers reales de la primera fila.
  var headers = Object.keys(filas[0]).filter(function (h) { return h !== '_fila'; });
  Object.keys(ALIAS).forEach(function (campo) {
    for (var i = 0; i < ALIAS[campo].length; i++) {
      var hit = headers.filter(function (h) { return _sinTildes_(String(h).toLowerCase()) === ALIAS[campo][i]; })[0];
      if (hit) { cols[campo] = hit; return; }
    }
  });
  // Sin fecha o sin valor no hay operación posible: se devuelve vacío y el caller lo reporta.
  if (!cols.fecha || !cols.valor) return { filas: out, descartadas: filas.length, columnas: cols };

  filas.forEach(function (f) {
    var iso = aFechaISO(f[cols.fecha]);
    var v = Number(f[cols.valor]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) || isNaN(v)) { descartadas++; return; }
    out.push({
      fecha: iso,
      // Toda celda de un SGIC ajeno es dato hostil: se sanea y se acota (patrón D13f).
      concepto: limpiarHostilTexto_(String(cols.concepto ? (f[cols.concepto] || '') : '') || 'Operación', 120),
      valor: v,
      notas: ''
    });
  });
  return { filas: out, descartadas: descartadas, columnas: cols };
}

/**
 * Sincroniza UN cliente según su configuración de Config. Read-only sobre el SGIC.
 * @param {string} idCliente
 * @param {Object} [cfg]  {db, tipo, on} — si no viene, se lee de Config
 * @return {Object} resultado del adapter, o {omitido, motivo}
 */
function sincronizarCliente_(idCliente, cfg) {
  if (!cfg) cfg = _mapaConectores_(leerTabla(getMaestro().getSheetByName('Config')))[idCliente];
  var d = _decidirConector_(idCliente, cfg);
  if (!d.correr) return { omitido: true, motivo: d.motivo };

  var ad = CONECTOR_ADAPTERS[cfg.tipo];
  var src;
  try { src = SpreadsheetApp.openById(cfg.db); }   // SOLO lectura, siempre
  catch (e) { throw new Error(idCliente + ': no se pudo abrir el SGIC (' + ((e && e.message) || e) + ')'); }

  // Allowlist: la PRIMERA hoja declarada por el adapter que exista en la fuente. Si ninguna existe,
  // se corta — jamás se sale a buscar "alguna hoja que sirva" en la planilla de un cliente.
  var hoja = null;
  for (var i = 0; i < ad.hojas.length; i++) {
    if (src.getSheetByName(ad.hojas[i])) { hoja = ad.hojas[i]; break; }
  }
  if (!hoja) {
    return { omitido: true, motivo: 'la fuente no tiene ninguna de las hojas permitidas por el adapter ' +
             cfg.tipo + ' (' + ad.hojas.join(', ') + ')' };
  }

  var fuente = idCliente + ' SGIC · ' + hoja;
  if (ad.modo === 'ventas') return sincronizarConectorVentas_(idCliente, cfg.db, hoja, fuente);
  return sincronizarConectorOperaciones_(idCliente, src, hoja, fuente, ad);
}

/**
 * Modo 'operaciones': lee la hoja permitida, la mapea con el adapter y refresca SOLO las filas de
 * este conector en `Datos_operativos` (las cargadas a mano no se tocan). Mismo full-refresh y la
 * misma guarda anti-wipe que el conector de ventas.
 */
function sincronizarConectorOperaciones_(idCliente, src, hoja, fuente, ad) {
  var sh = src.getSheetByName(hoja);
  if (sh.getLastRow() > CONECTOR_AVISO_FILAS) {
    Logger.log('AVISO conector ' + idCliente + ': ' + hoja + ' tiene ' + sh.getLastRow() +
               ' filas (>' + CONECTOR_AVISO_FILAS + ') — evaluar lectura por ventana.');
  }
  var r = ad.mapear(leerTabla(sh));

  // Guarda anti-wipe (purga #1 del conector original): una lectura vacía o rota NO borra lo bueno.
  if (!r.filas.length) {
    throw new Error(idCliente + ': ' + hoja + ' no devolvió operaciones válidas (' + r.descartadas +
                    ' fila(s) descartadas; columnas detectadas: ' + JSON.stringify(r.columnas) +
                    ') — no refresco, evito borrar datos sincronizados.');
  }

  var dst = abrirCliente(idCliente).ss.getSheetByName('Datos_operativos');
  if (!dst) throw new Error(idCliente + ' sin Datos_operativos');

  return conLock(function () {
    var aBorrar = leerTabla(dst)
      .filter(function (f) { return String(f.fuente) === fuente; })
      .map(function (f) { return f._fila; });
    borrarFilasBatch_(dst, aBorrar);
    r.filas.forEach(function (a) {
      appendFila(dst, { fecha: a.fecha, concepto: a.concepto, valor: a.valor, fuente: fuente, notas: a.notas || '' });
    });
    Logger.log('sincronizarConectorOperaciones_ ' + idCliente + ': ' + r.filas.length + ' fila(s) de ' + hoja +
               (r.descartadas ? ' · ' + r.descartadas + ' descartadas (sin fecha/importe válidos)' : ''));
    return { filas: r.filas.length, descartadas: r.descartadas, fuente: fuente, hoja: hoja, columnas: r.columnas };
  });
}

/**
 * Corre TODOS los conectores del mapa de Config. Lo llama corridaDiaria. Tolerante a fallos por
 * conector: uno que revienta no frena a los demás (cada cliente es independiente).
 *
 * Vehemence: sigue cableado por código (`VEHEMENCE_DB_ID`) porque es el único validado al peso y en
 * producción. Si alguien le agrega las 3 filas de Config, el mapa gana y el wrapper no corre dos
 * veces — la deduplicación es explícita, no un accidente de orden.
 */
function sincronizarConectores() {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  var out = { corridos: 0, omitidos: [], errores: [] };
  var mapa = {};
  try { mapa = _mapaConectores_(leerTabla(getMaestro().getSheetByName('Config'))); }
  catch (e) { out.errores.push('no se pudo leer el mapa de conectores: ' + ((e && e.message) || e)); }

  Object.keys(mapa).sort().forEach(function (cli) {
    var d = _decidirConector_(cli, mapa[cli]);
    if (!d.correr) { out.omitidos.push(cli + ': ' + d.motivo); return; }
    try { out[cli] = sincronizarCliente_(cli, mapa[cli]); out.corridos++; }
    catch (e) { out.errores.push(cli + ': ' + ((e && e.message) || e)); }
  });

  // Vehemence por código, salvo que ya haya entrado por el mapa.
  if (!mapa['CLI-002'] || !mapa['CLI-002'].on) {
    try { out.vehemence = sincronizarVehemence(); out.corridos++; }
    catch (e) { out.errores.push('CLI-002 (Vehemence, por código): ' + ((e && e.message) || e)); }
  }

  Logger.log('sincronizarConectores: ' + out.corridos + ' corrido(s) · ' + out.omitidos.length +
             ' omitido(s) · ' + out.errores.length + ' error(es)' +
             (out.omitidos.length ? '\n  omitidos: ' + out.omitidos.join(' | ') : ''));
  return out;
}

/**
 * Alta de un conector desde el editor (evita tipear 3 filas a mano y equivocarse en el prefijo).
 * NACE APAGADO SIEMPRE: `on` no es parámetro. Encenderlo es un acto deliberado y aparte
 * (`encenderConector`), después de validar al peso contra la fuente.
 */
function altaConector(idCliente, spreadsheetIdDB, tipoAdapter) {
  if (!CONECTOR_ADAPTERS[tipoAdapter]) {
    throw new Error('adapter desconocido: ' + tipoAdapter + ' (disponibles: ' + Object.keys(CONECTOR_ADAPTERS).join(', ') + ')');
  }
  setConfig(CONECTOR_PREFIJO + idCliente + '_db', String(spreadsheetIdDB || ''));
  setConfig(CONECTOR_PREFIJO + idCliente + '_tipo', String(tipoAdapter));
  setConfig(CONECTOR_PREFIJO + idCliente + '_on', 'false');
  Logger.log('altaConector ' + idCliente + ': tipo=' + tipoAdapter + ' — queda APAGADO. ' +
             'Corré probarConector("' + idCliente + '") y validá los totales contra la fuente ANTES de encenderlo.');
  return { id_cliente: idCliente, tipo: tipoAdapter, on: false };
}

/**
 * Enciende un conector ya validado. Separado del alta a propósito: encender es la decisión que
 * hace que sus números empiecen a alimentar recomendaciones.
 */
function encenderConector(idCliente) {
  var cfg = _mapaConectores_(leerTabla(getMaestro().getSheetByName('Config')))[idCliente];
  if (!cfg || !cfg.db || !cfg.tipo) throw new Error(idCliente + ': no tiene conector dado de alta (corré altaConector primero)');
  setConfig(CONECTOR_PREFIJO + idCliente + '_on', 'true');
  Logger.log('encenderConector ' + idCliente + ': ENCENDIDO (tipo ' + cfg.tipo + ').');
  return { id_cliente: idCliente, on: true };
}

/** Apaga un conector sin borrar su configuración. */
function apagarConector(idCliente) {
  setConfig(CONECTOR_PREFIJO + idCliente + '_on', 'false');
  return { id_cliente: idCliente, on: false };
}

/**
 * ENSAYO EN SECO — lee la fuente y muestra lo que ESCRIBIRÍA, sin escribir nada. Es el paso de
 * "validación al peso" antes de encender: Luciano compara estos totales contra lo que el cliente ve
 * en su propio sistema. Corre aunque el conector esté apagado (justamente para eso existe).
 */
function probarConector(idCliente) {
  var cfg = _mapaConectores_(leerTabla(getMaestro().getSheetByName('Config')))[idCliente];
  if (!cfg || !cfg.db || !cfg.tipo) return { error: idCliente + ': sin conector dado de alta' };
  var ad = CONECTOR_ADAPTERS[cfg.tipo];
  if (!ad) return { error: 'adapter desconocido: ' + cfg.tipo };

  var src = SpreadsheetApp.openById(cfg.db);
  var hoja = null;
  for (var i = 0; i < ad.hojas.length; i++) if (src.getSheetByName(ad.hojas[i])) { hoja = ad.hojas[i]; break; }
  if (!hoja) return { error: 'la fuente no tiene ninguna hoja permitida (' + ad.hojas.join(', ') + ')' };

  var filas = leerTabla(src.getSheetByName(hoja));
  var r = (ad.modo === 'ventas') ? { filas: agregarVentasPorMes_(filas).filas, descartadas: 0, columnas: 'contrato DB_VENTAS' }
                                 : ad.mapear(filas);
  var total = r.filas.reduce(function (a, f) { return a + (Number(f.valor) || 0); }, 0);
  var out = {
    cliente: idCliente, tipo: cfg.tipo, hoja: hoja, encendido: cfg.on,
    filas_fuente: filas.length, filas_a_escribir: r.filas.length, descartadas: r.descartadas,
    columnas_detectadas: r.columnas, total_sumado: Math.round(total),
    muestra: r.filas.slice(0, 5),
    SE_ESCRIBIO_ALGO: false
  };
  Logger.log('probarConector ' + idCliente + ' (ENSAYO EN SECO, no escribió nada):\n' + JSON.stringify(out, null, 2));
  return out;
}

/** Estado del mapa completo — qué hay dado de alta, qué está encendido y qué le falta a cada uno. */
function estadoConectores() {
  var mapa = _mapaConectores_(leerTabla(getMaestro().getSheetByName('Config')));
  var out = Object.keys(mapa).sort().map(function (cli) {
    var d = _decidirConector_(cli, mapa[cli]);
    return { id_cliente: cli, tipo: mapa[cli].tipo, on: mapa[cli].on, tiene_db: !!mapa[cli].db, listo: d.correr, motivo: d.motivo };
  });
  Logger.log('estadoConectores:\n' + JSON.stringify(out, null, 2));
  return out;
}

/**
 * Lee la hoja de ventas de la fuente, agrega por mes×canal y refresca las filas del conector en
 * `Datos_operativos` del cliente (full-refresh de SUS filas; las cargadas a mano no se tocan).
 * @param {string} idCliente   id en Clientes (CLI-00X)
 * @param {string} srcId       spreadsheetId de la fuente (ERP del cliente)
 * @param {string} sheetName   hoja de ventas en la fuente (p.ej. 'DB_VENTAS')
 * @param {string} fuente      etiqueta de `fuente` que marca las filas de ESTE conector
 * @return {{meses, nuevas, fuente, canales}}
 */
function sincronizarConectorVentas_(idCliente, srcId, sheetName, fuente) {
  var src = SpreadsheetApp.openById(srcId);          // SOLO lectura de la fuente
  var shV = src.getSheetByName(sheetName);
  if (!shV) throw new Error('la fuente de ' + idCliente + ' no tiene ' + sheetName);

  // Purga #4: aviso temprano de escala (sin cambiar la semántica de lectura).
  if (shV.getLastRow() > CONECTOR_AVISO_FILAS) {
    Logger.log('AVISO conector ' + idCliente + ': ' + sheetName + ' tiene ' + shV.getLastRow() +
               ' filas (>' + CONECTOR_AVISO_FILAS + ') — evaluar lectura por ventana.');
  }

  var res = agregarVentasPorMes_(leerTabla(shV));
  var agregados = res.filas;

  // Purga #1: nunca borro lo bueno por una lectura vacía/rota. Si no hay ventas válidas,
  // aborto (corridaDiaria lo loguea como aviso) en vez de wipear los datos sincronizados.
  if (!agregados.length) {
    throw new Error(idCliente + ': ' + sheetName + ' no devolvió ventas válidas — no refresco ' +
                    '(evito borrar datos sincronizados).');
  }

  var dst = abrirCliente(idCliente).ss.getSheetByName('Datos_operativos');
  if (!dst) throw new Error(idCliente + ' sin Datos_operativos');

  return conLock(function () {
    // Full-refresh: borro SOLO las filas previas de este conector (no las manuales) y reescribo.
    // Son agregados derivados (no registros decididos) → refrescar es correcto, no rompe append-only.
    var filas = leerTabla(dst);
    var aBorrar = filas
      .filter(function (f) { return String(f.fuente) === fuente; })
      .map(function (f) { return f._fila; });
    borrarFilasBatch_(dst, aBorrar);                 // Purga #6: batch por rangos contiguos

    agregados.forEach(function (a) {
      appendFila(dst, { fecha: a.fecha, concepto: a.concepto, valor: a.valor, fuente: fuente, notas: a.notas });
    });
    Logger.log('sincronizarConectorVentas_ ' + idCliente + ': ' + agregados.length +
               ' filas (mes×canal). Canales: ' + res.canales.join(',') +
               (res.desconocidos.length ? ' · desconocidos: ' + res.desconocidos.join(',') : ''));
    return { meses: agregados.length, nuevas: agregados.length, fuente: fuente, canales: res.canales };
  });
}

/**
 * Borra filas por número de fila absoluto, agrupando rangos contiguos para minimizar llamadas
 * a la API (Purga #6). Procesa de mayor a menor → borrar un rango no desplaza los menores.
 */
function borrarFilasBatch_(sh, filasAbs) {
  if (!filasAbs || !filasAbs.length) return;
  var rows = filasAbs.slice().sort(function (a, b) { return b - a; }); // desc
  var i = 0;
  while (i < rows.length) {
    var fin = rows[i], j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++;    // extiende la corrida contigua
    var inicio = rows[j];
    sh.deleteRows(inicio, fin - inicio + 1);
    i = j + 1;
  }
}

/**
 * PURA (testeable, sin I/O): filas crudas de la hoja de ventas → agregados por mes×canal,
 * listos para Datos_operativos. Excluye canceladas/pendientes. AOV = total/órdenes (ARS).
 * @return {{filas:Array, canales:Array, desconocidos:Array}}
 *   filas: agregados; canales: canales presentes; desconocidos: valores de channel fuera de online/pos.
 */
function agregarVentasPorMes_(ventas) {
  var agg = {};               // 'YYYY-MM|canal' → acumulador
  var canalesSet = {}, desconocidosSet = {};
  ventas.forEach(function (v) {
    var st = String(v.status || '').toLowerCase();
    if (/cancel|pend|anul|borrador|draft/.test(st)) return;   // solo ventas válidas
    var mes = aFechaISO(v.ts).slice(0, 7);                     // robusto a Date/string
    if (!/^\d{4}-\d{2}$/.test(mes)) return;
    // Purga #5: mapeo explícito. 'pos' Y 'local' → local (Vehemence DB_VENTAS usa 'pos' por
    // convención, pero la serie local de Castelar viene con channel='local'); cualquier otro/
    // vacío → 'otro' (no se mete en 'local').
    var ch = String(v.channel || '').toLowerCase();
    var canal = ch === 'online' ? 'online' : (ch === 'pos' || ch === 'local') ? 'local' : 'otro';
    if (canal === 'otro') desconocidosSet[ch || 'vacio'] = true;
    canalesSet[canal] = true;
    var k = mes + '|' + canal;
    if (!agg[k]) agg[k] = { mes: mes, canal: canal, total: 0, subtotal: 0, envio: 0, n: 0 };
    agg[k].total += Number(v.total_ars) || 0;
    agg[k].subtotal += Number(v.subtotal_ars) || 0;
    agg[k].envio += Number(v.envio_ars) || 0;
    agg[k].n += 1;
  });
  var canales = Object.keys(canalesSet).sort();
  // Purga #2: si la fuente trae un solo canal, marco cobertura parcial para que el análisis
  // no lea el dato como total del negocio (caso Vehemence: DB_VENTAS hoy ~100% online).
  var coberturaNota = canales.length === 1 ? ' · ⚠ cobertura: solo canal ' + canales[0] : '';
  var filas = Object.keys(agg).sort().map(function (k) {
    var a = agg[k];
    var aov = a.n ? Math.round(a.total / a.n) : 0;
    return {
      fecha: a.mes + '-01',
      concepto: 'Ventas ' + a.canal + ' (mes, ARS)',
      valor: Math.round(a.total),
      // canal/ordenes/aov: aditivos (sincronizarConectorVentas_ solo escribe fecha/concepto/valor/
      // fuente/notas → NO cambian el schema de Datos_operativos). Los consume la tool sgic (hoja 'ventas')
      // para dar el conteo EXACTO por canal sin parsear el string notas.
      canal: a.canal,
      ordenes: a.n,
      aov: aov,
      notas: a.n + ' órdenes · AOV $' + aov + ' · prod $' + Math.round(a.subtotal) +
             ' · envío $' + Math.round(a.envio) + ' · ' + a.mes + coberturaNota
    };
  });
  return { filas: filas, canales: canales, desconocidos: Object.keys(desconocidosSet).sort() };
}
