/**
 * 31_admin.js — TC-7 · F4a · MOTOR DE ADMINISTRACIÓN PROPIA (04-ago-2026)
 *
 * La administración de Satori: qué facturamos, qué cobramos, qué gastamos. Esta tanda entrega EL
 * MOTOR, sin datos reales — las facturas 2026 las carga Luciano y ese es el gate de cierre de F4a,
 * que queda ABIERTO a propósito.
 *
 * DÓNDE VIVE: un Spreadsheet PROPIO, `Satori OS — ADMIN`, cuyo id se guarda en Config
 * (`admin_sheet_id`). NO es un cliente del roster y no entra nunca en la hoja Clientes: Satori no
 * es tenant de sí misma (decisión firme, ver HANDOFF). Mezclar nuestra facturación con la de un
 * cliente sería exactamente la falla que prohíbe la regla de AISLAMIENTO.
 *
 * PRUDENCIA FISCAL (regla dura de esta tanda): el calendario fiscal se entrega como ESTRUCTURA
 * VACÍA. Ni una fecha, ni un modelo, ni un tipo impositivo escritos como ciertos. Todo nace
 * marcado «verificar con gestor/AEAT» y lo completa Luciano con su gestor. Un ERP que se inventa
 * un vencimiento fiscal no es útil: es un pasivo. Acá no hay asesoría embebida, hay casilleros.
 *
 * MONEDAS: jamás se suman dos monedas distintas. Todo agregado se agrupa por (jurisdicción,
 * moneda) — la misma lección que obligó a agregar `moneda` a Datos_operativos: un total que suma
 * ARS con EUR es un número que parece válido y no lo es.
 */

/** Lista-contrato de las pestañas del Sheet ADMIN. Agregar una obliga a darle columnas acá y a
 *  revisar `adminSetup` (que las crea) y `_adminResumir_` (que las lee). */
var ADMIN_SHEETS = {
  // El nº de factura es la clave con la que casan los cobros. `estado_cobro` es declarativo del
  // dueño; el pendiente REAL se calcula contra los cobros, no se cree del estado (ver _adminResumir_).
  facturas_emitidas: ['numero', 'fecha', 'id_cliente', 'cliente', 'base', 'iva', 'total', 'moneda', 'jurisdiccion', 'estado_cobro', 'notas'],
  gastos: ['fecha', 'concepto', 'proveedor', 'base', 'iva', 'total', 'moneda', 'jurisdiccion', 'categoria', 'notas'],
  cobros: ['fecha', 'numero_factura', 'importe', 'moneda', 'medio', 'notas'],
  // `modelo`, `fecha_limite` y `tipo` nacen VACÍOS a propósito: ver PRUDENCIA FISCAL arriba.
  calendario_fiscal: ['periodo', 'jurisdiccion', 'modelo', 'descripcion', 'fecha_limite', 'estado', 'fuente']
};

var ADMIN_ORDEN = ['facturas_emitidas', 'gastos', 'cobros', 'calendario_fiscal'];

var ADMIN_NOMBRE = 'Satori OS — ADMIN';
var ADMIN_CONFIG_ID = 'admin_sheet_id';

/** Marca única de "esto todavía no lo validó nadie". Se busca por texto en los asserts: si algún
 *  día alguien escribe una fecha fiscal de verdad, tiene que sacar esta marca a mano. */
var ADMIN_SIN_VERIFICAR = '«verificar con gestor/AEAT»';

var ADMIN_JURISDICCIONES = ['ES', 'AR'];

/** Estados de cobro admitidos. `parcial` existe porque un cobro a cuenta es lo normal en consultoría. */
var ADMIN_ESTADOS_COBRO = ['pendiente', 'parcial', 'cobrada', 'incobrable'];

/**
 * PURA — el calendario fiscal como ESTRUCTURA, para el año que se le pase.
 * Cuatro trimestres × jurisdicción, con `modelo` y `fecha_limite` VACÍOS y la descripción marcada
 * «verificar con gestor/AEAT». Los trimestres naturales de un año no son asesoría fiscal; las
 * fechas de presentación y los modelos SÍ, y por eso no están.
 */
function _calendarioFiscalPlaceholders_(anio) {
  var a = String(anio || '').slice(0, 4);
  var filas = [];
  ADMIN_JURISDICCIONES.forEach(function (j) {
    ['T1', 'T2', 'T3', 'T4'].forEach(function (t) {
      filas.push({
        periodo: a + '-' + t, jurisdiccion: j,
        modelo: '',            // ← lo completa el gestor. Escribir "303" acá sería inventar.
        descripcion: ADMIN_SIN_VERIFICAR,
        fecha_limite: '',      // ← ídem: una fecha de vencimiento inventada es un pasivo, no un dato
        estado: 'sin_verificar',
        fuente: ''
      });
    });
  });
  return filas;
}

/** PURA — normaliza un importe a número. '' / basura ⇒ 0, nunca NaN (un NaN en un total contable
 *  se propaga y ensucia todo el resumen sin decir dónde empezó). */
function _adminNum_(v) {
  if (v === '' || v == null) return 0;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** PURA — clave de agrupación. NUNCA se suman dos monedas ni dos jurisdicciones distintas. */
function _adminClave_(jurisdiccion, moneda) {
  return String(jurisdiccion || '?').toUpperCase() + '·' + String(moneda || '?').toUpperCase();
}

/**
 * PURA — EL RESUMEN DEL MES. Recibe las tablas ya leídas (por eso es aserible con fixtures).
 *
 * Tres cifras, cada una con su procedencia declarada (regla 7 del AISLAMIENTO: toda cifra dice de
 * dónde sale). Se calculan distinto A PROPÓSITO y no son intercambiables:
 *  · `facturado`   = facturas con fecha DENTRO del mes.
 *  · `cobrado_mes` = cobros con fecha DENTRO del mes — pueden corresponder a facturas viejas, así
 *                    que NO es "lo cobrado de lo facturado este mes". Se llama distinto por eso.
 *  · `pendiente`   = de las facturas del mes, lo que todavía no tiene cobro casado por número.
 *                    Se calcula contra los cobros REALES (de cualquier fecha), no contra la
 *                    columna `estado_cobro`, que es una declaración y puede estar desactualizada.
 *
 * Todo agrupado por (jurisdicción, moneda). Sin totales globales: sumar EUR con ARS da un número
 * que parece válido y miente.
 */
function _adminResumir_(facturas, cobros, mes) {
  var m = String(mes || '').slice(0, 7);
  var cobradoPorFactura = {};
  (cobros || []).forEach(function (c) {
    var num = String(c.numero_factura || '').trim();
    if (!num) return;
    cobradoPorFactura[num] = (cobradoPorFactura[num] || 0) + _adminNum_(c.importe);
  });

  var grupos = {};
  function grupo(j, mon) {
    var k = _adminClave_(j, mon);
    if (!grupos[k]) grupos[k] = { jurisdiccion: String(j || '?').toUpperCase(), moneda: String(mon || '?').toUpperCase(),
                                  facturado: 0, cobrado_mes: 0, pendiente: 0, facturas: 0 };
    return grupos[k];
  }

  (facturas || []).forEach(function (f) {
    var fecha = aFechaISO(f.fecha) || '';
    if (fecha.slice(0, 7) !== m) return;
    var g = grupo(f.jurisdiccion, f.moneda);
    var total = _adminNum_(f.total);
    var cob = cobradoPorFactura[String(f.numero || '').trim()] || 0;
    g.facturado += total;
    g.pendiente += Math.max(0, total - cob);
    g.facturas++;
  });

  (cobros || []).forEach(function (c) {
    var fecha = aFechaISO(c.fecha) || '';
    if (fecha.slice(0, 7) !== m) return;
    // El cobro no trae jurisdicción: se hereda de su factura. Sin factura casada, el cobro NO se
    // inventa una jurisdicción — cae en un grupo '?' visible, que es la forma honesta de decir
    // "hay plata entrando que no sé imputar".
    var fac = (facturas || []).filter(function (f) {
      return String(f.numero || '').trim() === String(c.numero_factura || '').trim();
    })[0];
    var g = grupo(fac ? fac.jurisdiccion : '?', c.moneda);
    g.cobrado_mes += _adminNum_(c.importe);
  });

  var lineas = Object.keys(grupos).sort().map(function (k) {
    var g = grupos[k];
    return { jurisdiccion: g.jurisdiccion, moneda: g.moneda, facturas: g.facturas,
             facturado: Math.round(g.facturado * 100) / 100,
             cobrado_mes: Math.round(g.cobrado_mes * 100) / 100,
             pendiente: Math.round(g.pendiente * 100) / 100 };
  });
  return { mes: m, grupos: lineas, sin_datos: lineas.length === 0 };
}

/** PURA — render del resumen para el brief de sistema. Sin datos ⇒ lo DICE (jamás un cero que
 *  parezca "no facturamos nada" cuando en realidad nadie cargó las facturas todavía). */
function _adminLineasBrief_(res) {
  if (!res || res.sin_datos || !res.grupos || !res.grupos.length) {
    return ['- Administración: sin facturación cargada para el mes — el motor está, los datos no (F4a espera las facturas 2026).'];
  }
  return res.grupos.map(function (g) {
    return '- Administración ' + g.jurisdiccion + ' (' + g.moneda + '): facturado ' + g.facturado +
           ' · cobrado en el mes ' + g.cobrado_mes + ' · pendiente ' + g.pendiente +
           ' (' + g.facturas + ' factura[s], mes ' + res.mes + ')';
  });
}

/** Abre el Sheet ADMIN. `null` si todavía no se creó (el caller lo DICE, no lo crea de prestado). */
var _adminSSCache_ = null;
function _adminAbrir_() {
  if (_adminSSCache_) return _adminSSCache_;
  var id = String(getConfig(ADMIN_CONFIG_ID) || '').trim();
  if (!id) return null;
  try { _adminSSCache_ = SpreadsheetApp.openById(id); } catch (e) { return null; }
  return _adminSSCache_;
}

function _adminHoja_(nombre) {
  var ss = _adminAbrir_();
  if (!ss) throw new Error('el Sheet ADMIN no existe todavía — corré adminSetup()');
  var sh = ss.getSheetByName(nombre);
  if (!sh) throw new Error('falta la pestaña ' + nombre + ' en el Sheet ADMIN — corré adminSetup()');
  return sh;
}

/**
 * Crea o repara el Sheet ADMIN. Idempotente, como `setup()` del MAESTRO: se puede correr siempre.
 * Siembra el calendario fiscal SOLO si está vacío — jamás pisa lo que el gestor ya validó.
 */
function adminSetup() {
  _soloOwner_('adminSetup');
  var id = String(getConfig(ADMIN_CONFIG_ID) || '').trim();
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(ADMIN_NOMBRE);
    setConfig(ADMIN_CONFIG_ID, ss.getId());
    _adminSSCache_ = null;
  }
  ADMIN_ORDEN.forEach(function (n) { ensureSheet(ss, n, ADMIN_SHEETS[n]); });

  var shCal = ss.getSheetByName('calendario_fiscal');
  var sembradas = 0;
  if (shCal && leerTabla(shCal).length === 0) {
    _calendarioFiscalPlaceholders_(hoyISO().slice(0, 4)).forEach(function (f) { appendFila(shCal, f); sembradas++; });
  }
  return { ok: true, id: ss.getId(), url: ss.getUrl(), pestanas: ADMIN_ORDEN.slice(), calendario_sembrado: sembradas };
}

/**
 * Alta de una factura emitida. Valida ANTES de escribir: un alta que entra a medias ensucia el
 * resumen del mes y nadie se entera hasta que no cuadra contra el gestor.
 */
function altaFactura(datos) {
  _soloOwner_('altaFactura');
  var d = datos || {};
  var numero = String(d.numero || '').trim();
  if (!numero) throw new Error('la factura necesita número');
  var fecha = aFechaISO(d.fecha);
  if (!fecha) throw new Error('la factura necesita una fecha legible (ISO)');
  var jur = String(d.jurisdiccion || '').toUpperCase();
  if (ADMIN_JURISDICCIONES.indexOf(jur) < 0) throw new Error('jurisdicción inválida: ' + jur + ' (esperaba ' + ADMIN_JURISDICCIONES.join('/') + ')');
  var moneda = String(d.moneda || '').toUpperCase();
  if (!moneda) throw new Error('la factura necesita moneda — sin ella el resumen sumaría peras con manzanas');
  var estado = String(d.estado_cobro || 'pendiente').toLowerCase();
  if (ADMIN_ESTADOS_COBRO.indexOf(estado) < 0) throw new Error('estado_cobro inválido: ' + estado);

  var sh = _adminHoja_('facturas_emitidas');
  return conLock(function () {
    var dup = leerTabla(sh).filter(function (f) { return String(f.numero).trim() === numero; })[0];
    if (dup) throw new Error('ya existe una factura con número ' + numero);   // el nº es la clave de los cobros
    var base = _adminNum_(d.base), iva = _adminNum_(d.iva);
    var total = (d.total === '' || d.total == null) ? base + iva : _adminNum_(d.total);
    appendFila(sh, {
      numero: numero, fecha: fecha, id_cliente: String(d.id_cliente || ''), cliente: String(d.cliente || ''),
      base: base, iva: iva, total: total, moneda: moneda, jurisdiccion: jur,
      estado_cobro: estado, notas: String(d.notas || '').slice(0, 300)
    });
    return { ok: true, numero: numero, total: total, moneda: moneda };
  });
}

/** Alta de un gasto. Mismo criterio de validación que la factura. */
function altaGasto(datos) {
  _soloOwner_('altaGasto');
  var d = datos || {};
  var fecha = aFechaISO(d.fecha);
  if (!fecha) throw new Error('el gasto necesita una fecha legible (ISO)');
  if (!String(d.concepto || '').trim()) throw new Error('el gasto necesita concepto');
  var moneda = String(d.moneda || '').toUpperCase();
  if (!moneda) throw new Error('el gasto necesita moneda');
  var jur = String(d.jurisdiccion || '').toUpperCase();
  if (ADMIN_JURISDICCIONES.indexOf(jur) < 0) throw new Error('jurisdicción inválida: ' + jur);
  var base = _adminNum_(d.base), iva = _adminNum_(d.iva);
  appendFila(_adminHoja_('gastos'), {
    fecha: fecha, concepto: String(d.concepto).slice(0, 200), proveedor: String(d.proveedor || '').slice(0, 120),
    base: base, iva: iva, total: (d.total === '' || d.total == null) ? base + iva : _adminNum_(d.total),
    moneda: moneda, jurisdiccion: jur, categoria: String(d.categoria || '').slice(0, 60),
    notas: String(d.notas || '').slice(0, 300)
  });
  return { ok: true };
}

/**
 * Alta de un cobro. Exige que la factura EXISTA: un cobro suelto no se imputa a nada y
 * desbalancearía el pendiente sin dejar rastro de por qué.
 */
function altaCobro(datos) {
  _soloOwner_('altaCobro');
  var d = datos || {};
  var fecha = aFechaISO(d.fecha);
  if (!fecha) throw new Error('el cobro necesita una fecha legible (ISO)');
  var num = String(d.numero_factura || '').trim();
  if (!num) throw new Error('el cobro necesita el número de factura al que se imputa');
  var importe = _adminNum_(d.importe);
  if (importe <= 0) throw new Error('el importe del cobro tiene que ser > 0');
  var fac = leerTabla(_adminHoja_('facturas_emitidas')).filter(function (f) { return String(f.numero).trim() === num; })[0];
  if (!fac) throw new Error('no existe la factura ' + num + ' — un cobro sin factura no se imputa');
  var moneda = String(d.moneda || fac.moneda || '').toUpperCase();
  if (moneda !== String(fac.moneda || '').toUpperCase()) {
    throw new Error('el cobro viene en ' + moneda + ' y la factura ' + num + ' está en ' + fac.moneda + ' — no se convierten monedas acá');
  }
  appendFila(_adminHoja_('cobros'), {
    fecha: fecha, numero_factura: num, importe: importe, moneda: moneda,
    medio: String(d.medio || '').slice(0, 60), notas: String(d.notas || '').slice(0, 300)
  });
  return { ok: true, numero_factura: num, importe: importe, moneda: moneda };
}

/**
 * Resumen del mes (default: el mes en curso). Lo cita el brief de sistema.
 * Sin Sheet ADMIN todavía ⇒ lo dice; no devuelve ceros que parezcan datos.
 */
function adminResumenMes(mes) {
  _soloOwner_('adminResumenMes');
  var m = String(mes || hoyISO()).slice(0, 7);
  var ss = _adminAbrir_();
  if (!ss) return { mes: m, grupos: [], sin_datos: true, motivo: 'el Sheet ADMIN no existe todavía (adminSetup)' };
  var facturas = [], cobros = [];
  try { facturas = leerTabla(ss.getSheetByName('facturas_emitidas')) || []; } catch (e) { facturas = []; }
  try { cobros = leerTabla(ss.getSheetByName('cobros')) || []; } catch (e) { cobros = []; }
  return _adminResumir_(facturas, cobros, m);
}

/**
 * Refresca el resumen cacheado que lee el brief (mismo patrón que la vigilancia de TC-11: el brief
 * no abre Sheets, lee lo que dejó la corrida). Devuelve el resumen para el log de corridaDiaria.
 */
function adminRefrescarResumen_() {
  var r = adminResumenMes(hoyISO().slice(0, 7));
  setConfig('admin_resumen', JSON.stringify(r));
  return { mes: r.mes, grupos: r.grupos.length, sin_datos: !!r.sin_datos };
}

/** Lee el resumen persistido por la última corrida. null si no hay o está roto — el brief lo dice. */
function _adminResumenCacheado_() {
  try {
    var s = getConfig('admin_resumen');
    if (!s) return null;
    return JSON.parse(s) || null;
  } catch (e) { return null; }
}
