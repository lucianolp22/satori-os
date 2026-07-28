#!/usr/bin/env node
/**
 * _harness.js — arnés OFFLINE de Satori OS (Node, sin GAS). Versionado en el repo el 27-jul-2026
 * (micro-encargo 24-jul: se perdió dos veces; `.claspignore` lo excluye de `clasp push`).
 *
 * QUÉ ES: carga los módulos de `src/` en un contexto `vm` con stubs mínimos de GAS y asera las
 * funciones PURAS y los chokepoints de seguridad — lo que se puede probar sin abrir un Sheet.
 * QUÉ NO ES: no reemplaza a `selfTest()` en el editor (datos vivos + integración) ni al eyeball.
 *
 * REGLAS APRENDIDAS (CLAUDE.md):
 *  · STUB divergente = VERDE FALSO: los stubs de acá NO imitan lógica de negocio — solo I/O.
 *    Los asserts de seguridad van contra el chokepoint REAL pure-loadable (sanitizarCelda).
 *  · Este arnés es la reconstrucción v2 (27-jul) tras la pérdida del original (161 checks).
 *    Cubre las funciones puras documentadas + los fixes del cierre 27-jul. Ampliarlo al tocar código.
 *
 * USO: node _harness.js   → imprime cada check y termina con RESULTADO: PASA x / FALLA y (exit 1 si falla).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── Stubs GAS mínimos (I/O muerto; nada de lógica de negocio) ────────────────
function makeCache() {
  const store = {};
  return {
    get: (k) => (k in store ? store[k].v : null),
    put: (k, v, ttl) => { store[k] = { v: String(v), ttl: ttl }; },
    remove: (k) => { delete store[k]; },
    _store: store,
  };
}
const cacheScript = makeCache();

const ctx = {
  console: { log: () => {}, warn: () => {}, error: () => {} },
  Logger: { log: () => {} },
  SpreadsheetApp: {
    openById: () => { throw new Error('harness: sin Sheets'); },
    openByUrl: () => { throw new Error('harness: sin Sheets'); },
    flush: () => {},
    ProtectionType: { SHEET: 'SHEET' },
  },
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {}, deleteProperty: () => {} }),
  },
  CacheService: { getScriptCache: () => cacheScript },
  Session: { getActiveUser: () => ({ getEmail: () => '' }), getScriptTimeZone: () => 'Europe/Madrid' },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      const p = (n) => ('0' + n).slice(-2);
      return String(fmt)
        .replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
        .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes()));
    },
    getUuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]),
    sleep: () => {},
  },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }), everyMinutes: () => ({ create: () => {} }), everyHours: () => ({ create: () => {} }) }) }), deleteTrigger: () => {} },
  ContentService: { createTextOutput: (s) => ({ setMimeType: () => ({ getContent: () => s }) }), MimeType: { JSON: 'JSON' } },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  MailApp: { sendEmail: () => {} },
  UrlFetchApp: { fetch: () => { throw new Error('harness: sin red'); } },
  HtmlService: { createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({}) }) }), createHtmlOutputFromFile: () => ({}) },
  Browser: {},
};
ctx.globalThis = ctx;
vm.createContext(ctx);

// ── Carga de módulos (mismo contexto: respeta dependencias cruzadas) ─────────
const SRC = path.join(__dirname, 'src');
const MODULOS = ['01_schema.js', '07_util.js', '22_seguridad.js', '12_cola.js', '17_bandeja.js', '19_conectores.js',
                 '25_hilo.js', '18_direccion.js', '08_webapp.js', '26_sato.js', '09_selftest.js'];
for (const f of MODULOS) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  try { vm.runInContext(code, ctx, { filename: f }); }
  catch (e) { console.error('❌ CARGA ' + f + ': ' + e.message); process.exit(1); }
}

// ── Runner ───────────────────────────────────────────────────────────────────
const log = [];
function chk(cond, msg) { log.push((cond ? '✅ ' : '❌ ') + msg); }
function seccion(t) { log.push('— ' + t + ' —'); }

// ═══ 1 · Seguridad: chokepoints reales (regla D25e: nunca un stub adivinado) ═
seccion('sanitizarCelda (chokepoint anti formula-injection)');
for (const mal of ['=IMPORTRANGE("x")', '+1+1', '-2', '@cmd', '\tx', '\rx', '\nx']) {
  const out = ctx.sanitizarCelda(mal);
  chk(String(out).charAt(0) === "'", `sanitizarCelda neutraliza ${JSON.stringify(mal.slice(0, 12))} con apóstrofe`);
}
chk(ctx.sanitizarCelda('hola') === 'hola', 'sanitizarCelda deja el texto benigno intacto');
chk(ctx.sanitizarCelda(123) === 123, 'sanitizarCelda no toca números');

seccion('_puertaOwner_ (criterio puro del gate de identidad)');
chk(ctx._puertaOwner_('a@x.com', 'a@x.com') === true, 'owner exacto pasa');
chk(ctx._puertaOwner_('otro@x.com', 'a@x.com') === false, 'otro usuario NO pasa');
chk(ctx._puertaOwner_('', 'a@x.com') === false, 'sin email NO pasa (fail-closed)');
chk(ctx._puertaOwner_('a@x.com', '') === false, 'sin OWNER_EMAIL seteado NO pasa (fail-closed X1)');

// ═══ 2 · P0 (27-jul): borrarFilasBatch_ — el refresh 100%-conector ═══════════
seccion('borrarFilasBatch_ (P0: borrar todas las filas no-inmovilizadas)');
function sheetStub(maxRows, frozen, lastCol) {
  const borradas = [], limpiadas = [];
  return {
    getMaxRows: () => maxRows,
    getFrozenRows: () => frozen,
    getLastColumn: () => lastCol || 3,
    deleteRows: (ini, n) => {
      if (borradas.reduce((a, b) => a + b.n, 0) + n >= maxRows - frozen + 1) {
        throw new Error('No se pueden eliminar todas las filas que no estén inmovilizadas');
      }
      borradas.push({ ini, n }); maxRows -= n;
    },
    getRange: (r, c, nr, nc) => ({ clearContent: () => { limpiadas.push({ r, c, nr, nc }); } }),
    _borradas: borradas, _limpiadas: limpiadas, _maxRows: () => maxRows,
  };
}
// Caso Vehemence: grid 4 filas (1 header congelado + 3 datos), borrar [2,3,4] = TODO el cuerpo.
let sh = sheetStub(4, 1);
let tiro = false;
try { ctx.borrarFilasBatch_(sh, [2, 3, 4]); } catch (e) { tiro = true; }
chk(!tiro, 'P0: borrar el 100% de las filas de datos NO tira');
chk(sh._limpiadas.length === 1 && sh._limpiadas[0].r === 2, 'P0: la fila preservada (la menor) se limpia con clearContent');
chk(sh._borradas.reduce((a, b) => a + b.n, 0) === 2, 'P0: se borran n-1 filas por batch');
// Caso parcial: hay colchón → camino clásico intacto, sin clearContent.
sh = sheetStub(100, 1);
ctx.borrarFilasBatch_(sh, [5, 4, 9]);
chk(sh._limpiadas.length === 0, 'parcial: sin clearContent (no hacía falta preservar)');
chk(sh._borradas.length === 2 && sh._borradas[0].ini === 9 && sh._borradas[1].ini === 4 && sh._borradas[1].n === 2,
    'parcial: rangos contiguos agrupados, de mayor a menor');
// Sin frozen y con colchón: borrar todas las filas de DATOS no viola la regla del grid.
sh = sheetStub(50, 0);
ctx.borrarFilasBatch_(sh, [2, 3]);
chk(sh._limpiadas.length === 0, 'con colchón de grid no se activa la preservación');

// ═══ 3 · Fix A (27-jul): estadoCacheado_ ═════════════════════════════════════
seccion('estadoCacheado_ (cache del estado para la voz)');
let renders = 0;
ctx.estadoVigente = function (id) { renders++; return '# Estado vigente — stub ' + (id || 'SISTEMA'); };
delete cacheScript._store['estado_v1_SISTEMA'];
const r1 = ctx.estadoCacheado_();
const r2 = ctx.estadoCacheado_();
chk(renders === 1, 'miss renderiza UNA vez; el hit no recomputa');
chk(r1 === r2 && r1.indexOf('# Estado vigente') === 0, 'hit devuelve byte a byte el render cacheado');
chk(cacheScript._store['estado_v1_SISTEMA'].ttl === 600, 'TTL de voz = 600s (espejo del brief)');
const rc = ctx.estadoCacheado_('CLI-002');
chk(renders === 2 && rc.indexOf('CLI-002') > 0, 'clave por cliente: CLI-002 tiene su propio cache');
chk(cacheScript._store['estado_v1_CLI-002'] != null, 'la clave del cliente existe en el cache');

// ═══ 4 · Fix C (27-jul): prefijos deterministas de la Bandeja ════════════════
seccion('Bandeja: prefijos deterministas');
chk(ctx.esResearch_('[RESEARCH] competidores') === true, '[RESEARCH] se reconoce');
chk(ctx.esPreparaReunion_('[PREPARAR_REUNION] CLI-003') === true, '[PREPARAR_REUNION] se reconoce');
chk(ctx.esPreparaReunion_('preparar la reunión de CLI-003') === false, 'sin prefijo NO entra por la vía determinista');
chk(ctx.BANDEJA_BINS.indexOf('preparar_reunion') >= 0 && ctx.BANDEJA_BINS.indexOf('research') >= 0,
    'los bins deterministas están en BANDEJA_BINS');
chk(String(ctx.clasificarBandeja).indexOf('_resolverClientePrep_') >= 0,
    'clasificarBandeja resuelve el cliente del pedido de reunión SERVER-SIDE (incidente BAN-0017)');
// _resolverClientePrep_ con roster stub (se inyectan getMaestro/leerTabla/clienteExiste_ y se restauran)
{
  const gmOrig = ctx.getMaestro, ltOrig = ctx.leerTabla, ceOrig = ctx.clienteExiste_;
  ctx.getMaestro = () => ({ getSheetByName: () => ({}) });
  ctx.leerTabla = () => [
    { id_cliente: 'CLI-001', nombre: 'MesaQuince' },
    { id_cliente: 'CLI-002', nombre: 'Vehemence' },
    { id_cliente: 'CLI-003', nombre: 'LC Travel' },
    { id_cliente: 'CLI-004', nombre: 'DAM Barbers' },
    { id_cliente: 'CLI-007', nombre: 'EJF' },
  ];
  ctx.clienteExiste_ = (id) => ['CLI-001', 'CLI-002', 'CLI-003', 'CLI-004', 'CLI-007'].includes(id);
  chk(ctx._resolverClientePrep_('LC Travel') === 'CLI-003', 'resolver: "LC Travel" → CLI-003 (el caso del incidente)');
  chk(ctx._resolverClientePrep_('lc travel') === 'CLI-003', 'resolver: case-insensitive');
  chk(ctx._resolverClientePrep_('CLI-004') === 'CLI-004', 'resolver: un id válido pasa directo');
  chk(ctx._resolverClientePrep_('CLI-099') === '', 'resolver: id fuera del roster = vacío (escala)');
  chk(ctx._resolverClientePrep_('la reunión de mañana') === '', 'resolver: texto sin match = vacío (no adivina)');
  chk(ctx._resolverClientePrep_('DAM') === 'CLI-004', 'resolver: prefijo único "DAM" matchea DAM Barbers');
  ctx.getMaestro = gmOrig; ctx.leerTabla = ltOrig; ctx.clienteExiste_ = ceOrig;
}

// ═══ 5 · P0-bis: el error del sync no se traga ═══════════════════════════════
seccion('sincronizarConectores: error visible');
chk(String(ctx.sincronizarConectores).indexOf("'conector_error'") >= 0, 'levanta aviso conector_error');
chk(String(ctx.sincronizarConectores).indexOf('resolverAvisosDonde_') >= 0, 'resuelve por baseline al recuperarse');

// ═══ 6 · Conectores: puras ═══════════════════════════════════════════════════
seccion('conectores (mapa, decisión, moneda, adapters)');
const mapa = ctx._mapaConectores_([
  { clave: 'conector_CLI-004_db', valor: 'ABC' },
  { clave: 'conector_CLI-004_tipo', valor: 'fresha_dam' },
  { clave: 'conector_CLI-004_on', valor: 'true' },
  { clave: 'conector_CLI-004_moneda', valor: 'EUR' },
  { clave: 'otra_clave', valor: 'x' },
]);
chk(mapa['CLI-004'] && mapa['CLI-004'].on === true && mapa['CLI-004'].moneda === 'EUR', 'mapa arma db/tipo/on/moneda');
chk(ctx._decidirConector_('CLI-9', null).correr === false, 'sin configuración no corre');
chk(ctx._decidirConector_('CLI-4', { db: 'x', tipo: 'fresha_dam', on: false }).correr === false, 'apagado no corre (default-deny)');
chk(ctx._decidirConector_('CLI-4', { db: 'x', tipo: 'fresha_dam', on: true }).correr === true, 'configurado y encendido corre');
chk(ctx._monedaConector_({ moneda: 'ars' }, { moneda: 'EUR' }, { moneda: 'USD' }) === 'ARS', 'moneda: la fila gana');
chk(ctx._monedaConector_(null, null, null) === '', 'moneda: sin fuente queda vacía, no inventada');
const ven = ctx.agregarVentasPorMes_([
  { ts: '2026-07-05', channel: 'online', total_ars: 100000, subtotal_ars: 90000, envio_ars: 10000, status: 'paid' },
  { ts: '2026-07-20', channel: 'online', total_ars: 200000, subtotal_ars: 180000, envio_ars: 20000, status: 'paid' },
  { ts: '2026-07-10', channel: 'online', total_ars: 999, status: 'cancelled' },
  { ts: '2026-07-11', channel: 'online', total_ars: -500, status: 'paid' },
]);
chk(ven.filas.length === 1 && ven.filas[0].valor === 300000 && ven.filas[0].ordenes === 2 && ven.filas[0].aov === 150000,
    'ventas: cancelada y negativa fuera; total/órdenes/AOV exactos');
chk(ven.excluidas === 2, 'ventas: las excluidas se cuentan (no desaparecen en silencio)');
const lc = ctx.mapearLibroLcTravel_([
  { tipo: 'ingreso', fecha: '2026-06-01', monto: 1000, concepto: 'a', archived: 'false' },
  { tipo: 'egreso', fecha: '2026-06-02', monto: 300, concepto: 'b', archived: 'false' },
  { tipo: 'transferencia', fecha: '2026-06-03', monto: 99, concepto: 'c', archived: 'false' },
  { tipo: 'ingreso', fecha: '2026-06-04', monto: 50, concepto: 'd', archived: 'true' },
]);
chk(lc.filas.length === 2 && lc.filas[1].valor === -300 && lc.descartadas === 2,
    'LC Travel: transferencias y archivadas fuera; egreso en negativo');
const dam = ctx.mapearFreshaDam_([{ date: '2026-07-01', rev: 500, tx: 12 }, { date: 'mala', rev: 1 }]);
chk(dam.filas.length === 1 && dam.filas[0].valor === 500 && dam.descartadas === 1, 'DAM: fila válida entra, inválida se cuenta');
const mq = ctx.mapearMovimientosMesaquince_([
  { tipo: 'gasto', rubro: 'insumos', fecha: '2026-07-02', mes_devengado: '2026-06', importe: '1.234,56', concepto: 'x' },
  { tipo: 'transferencia', rubro: 'z', fecha: '2026-07-02', importe: '10', concepto: 'y' },
]);
chk(mq.filas.length === 1 && mq.filas[0].fecha === '2026-06-01' && Math.abs(mq.filas[0].valor - 1234.56) < 0.001,
    'MesaQuince: mes_devengado manda y el importe con coma es-ES se parsea');
// Fix 27-jul (bug ×100 cazado por Luciano): el warehouse escribe PUNTO decimal — valores del CRUDO real.
chk(ctx._importeMQ_('-87.61') === -87.61, 'MQ importe "-87.61" = −87,61 € (NO −8.761: el punto es decimal)');
chk(ctx._importeMQ_('-12.0') === -12, 'MQ importe "-12.0" = −12 €');
chk(ctx._importeMQ_('-314.0') === -314, 'MQ importe "-314.0" = −314 € (NO −3.140)');
chk(ctx._importeMQ_('-0.22') === -0.22, 'MQ importe "-0.22" = −0,22 €');
chk(ctx._importeMQ_('1.234,56') === 1234.56, 'MQ importe con coma "1.234,56" sigue siendo 1.234,56 (es-ES)');
chk(ctx._importeMQ_('1200') === 1200, 'MQ importe entero "1200" intacto');
chk(isNaN(ctx._importeMQ_('')), 'MQ importe vacío = NaN (la fila se descarta, no se inventa 0)');
const mqPunto = ctx.mapearMovimientosMesaquince_([
  { tipo: 'gasto', rubro: 'seg_social', fecha: '2026-01-02', mes_devengado: '2026-01', importe: '-87.61', concepto: 'TGSS' },
]);
chk(mqPunto.filas.length === 1 && mqPunto.filas[0].valor === -87.61,
    'MQ end-to-end: la fila TGSS real entra como −87,61, no −8.761');
// Incidente 27-jul: se pidió correr apagarMQ y no existía. El TRÍO completo por cliente es contrato.
for (const cli of ['DAM', 'LC', 'MQ']) {
  for (const op of ['probar', 'encender', 'apagar']) {
    chk(typeof ctx[op + cli] === 'function', 'wrapper de editor ' + op + cli + ' existe (trío completo)');
  }
}

// ═══ 7 · Hilo: puras + espejo ════════════════════════════════════════════════
seccion('Hilo (armado, semáforo, CSV)');
const armado = ctx._armarHilo_([
  { seccion: 'plan', item: 'a', detalle: 'd1' },
  { seccion: 'real', item: 'b', estado: 'hecho' },
  { seccion: 'desviado', item: 'c' },
  { seccion: 'pendiente', item: 'e', prioridad: 'A' },
  { seccion: 'otra', item: 'x' },
  { seccion: 'plan', item: '' },
]);
chk(armado.total === 4 && armado.descartadas === 2, 'vocabulario cerrado: fuera-de-vocabulario y sin-item se descartan');
chk(armado.semaforo === 'rojo', 'semáforo: con desvío = rojo');
chk(ctx._semaforoHilo_({ plan: 1, real: 1, desviado: 0, pendiente: 0 }) === 'verde', 'semáforo: real sin deuda = verde');
chk(ctx._semaforoHilo_({ plan: 0, real: 0, desviado: 0, pendiente: 0 }) === 'gris', 'semáforo: vacío = gris (no verde)');
const linea = ctx._parseCSVLinea_('plan,"con, coma","con ""comillas""",x');
chk(linea.length === 4 && linea[1] === 'con, coma' && linea[2] === 'con "comillas"', 'CSV: comas y comillas escapadas');

// ═══ 8 · Cola / serie / tendencia / resumen ══════════════════════════════════
seccion('cola, NS_serie, tendencia, resumen del selfTest');
chk(ctx._puntoSerieAccion_([], '2026-07-27').accion === 'agregado', 'serie vacía agrega');
chk(ctx._puntoSerieAccion_([{ fecha: '2026-07-27', _fila: 2 }], '2026-07-27').accion === 'actualizado', 'mismo día actualiza (idempotente)');
const t = ctx._tendencia_([{ fecha: '2026-07-20', valor: 5 }, { fecha: '2026-07-21', valor: 7 }]);
chk(t && t.palabra === 'acelerando', 'tendencia con 2 puntos da delta real');
chk(ctx._tendencia_([{ fecha: '2026-07-21', valor: 7 }]) === null, 'con 1 punto NO inventa (null)');
const res = ctx._resumenSelfTest_(['✅ a', '✅ b', '❌ c malo', '   x']);
chk(res.indexOf('PASA 2 / FALLA 1') >= 0 && res.indexOf('❌ c malo') >= 0, '_resumenSelfTest_ cuenta y repite los rojos');
chk(ctx._colaArchivable_({ estado: 'completada', creada_en: '2026-01-01' }, '2026-06-01', '2026-07-01', false) === true,
    '_colaArchivable_ archiva una terminal vieja fuera del mes en curso');
chk(ctx._colaArchivable_({ estado: 'completada', creada_en: '2026-01-01' }, '2026-06-01', '2026-07-01', true) === false,
    '_colaArchivable_ protege la última fila del agente');
chk(ctx._colaArchivable_({ estado: 'pendiente', creada_en: '2026-01-01' }, '2026-06-01', '2026-07-01', false) === false,
    '_colaArchivable_ jamás archiva una no-terminal');

// ═══ 9 · Voz / util puras ════════════════════════════════════════════════════
seccion('voz + util');
chk(ctx.normalizarCifrasTexto_('cincuenta mil unidades').indexOf('50.000') >= 0 &&
    ctx.normalizarCifrasTexto_('cincuenta mil unidades').indexOf('unidades') > 0,
    'normalizarCifrasTexto_ respeta el límite de palabra (el bug del golden-set M4)');
chk(ctx.limpiarHostilTexto_('a\nb\tc', 100).indexOf('\n') < 0, 'limpiarHostilTexto_ saca saltos/tabs');
const pq = ctx.parseQuickAdd('llamar a Ana !a #ventas hoy');
chk(pq && pq.prioridad === 'A' && pq.descripcion.indexOf('llamar a Ana') >= 0, 'parseQuickAdd: sigilos básicos');
chk(ctx.parseRecurrencia('1s', '2026-07-27') === '2026-08-03', 'parseRecurrencia 1s suma 7 días');
chk(ctx.parseRecurrencia('1m', '2026-01-31') === '2026-02-28', 'parseRecurrencia 1m clampa fin de mes');
chk(ctx.parseRecurrencia('raro', '2026-07-27') === '', 'parseRecurrencia fuera de vocabulario devuelve vacío');

// ═══ 10 · Fix D: agenda gateada (estructural) ════════════════════════════════
seccion('agenda (Fix D)');
for (const fn of ['agendarEvento', 'actualizarEvento', 'cancelarEvento', 'agendaSemana']) {
  chk(String(ctx[fn]).indexOf('_soloOwner_') >= 0, fn + ' lleva _soloOwner_');
  chk(ctx.ENDPOINTS_UI.indexOf(fn) >= 0, fn + ' está en ENDPOINTS_UI');
}
let rechazoFecha = false;
ctx.SATORI_CTX_SISTEMA = true;   // atravesar el gate para probar la validación de fecha
try { ctx.agendarEvento('27/07/2026', '', 'x', '', ''); } catch (e) { rechazoFecha = /fecha/i.test(e.message); }
chk(rechazoFecha, 'agendarEvento rechaza fecha no-ISO antes de tocar la hoja');

// ═══ 11 · Ficha de Cliente 360 (T1 tanda UI · 28-jul): fichaCliente ══════════
seccion('fichaCliente (endpoint de la Ficha 360)');
chk(ctx.ENDPOINTS_UI.indexOf('fichaCliente') >= 0, 'fichaCliente está en ENDPOINTS_UI (anti-drift, mismo commit)');
chk(String(ctx.fichaCliente).indexOf("_soloOwner_('fichaCliente')") >= 0, 'fichaCliente lleva _soloOwner_ (introspección del código real)');
{
  // Inyección + restore (patrón _resolverClientePrep_): stubs de I/O muerto, jamás lógica de negocio.
  const acOrig = ctx.abrirCliente, ltOrig = ctx.leerTabla, gmOrig = ctx.getMaestro, gcOrig = ctx.getConfig;
  ctx.SATORI_CTX_SISTEMA = true;
  const hojas = {
    objetivos: [{ horizonte: '12m', descripcion: 'Facturar más', metrica: 'ventas_mes', valor_objetivo: '30000', estado: 'activo', fecha_objetivo: '2026-12-31' }],
    KPIs: [{ kpi: 'ventas_mes', valor: '21500', objetivo: '30000', alerta: '', fecha: '2026-07-20' }],
    Datos_operativos: [
      { fecha: '2026-07-01', concepto: 'viejo', valor: '1', notas: '', fuente: 'SGIC x' },
      { fecha: '2026-07-27', concepto: 'ventas\tjulio\ncrudas', valor: '33904', notas: 'n', fuente: 'SGIC · sync' },
    ],
  };
  ctx.abrirCliente = (id) => { if (id !== 'CLI-001') throw new Error('no existe'); return { ss: { getSheetByName: (n) => (n in hojas ? { _n: n } : null) } }; };
  // Columnas REALES de Aprobaciones_agregadas (01_schema.js:22) — regla del stub divergente:
  // el stub v1 usaba "resumen"/"prioridad" (inexistentes) y daba verde falso; cazado en la purga 28-jul.
  ctx.leerTabla = (sh) => (sh && sh._n === 'AGG' ? [
    { id: 'APR-0009', fecha_creacion: '2026-07-27', id_cliente: 'CLI-001', cliente: 'MesaQuince', modulo: 'director',
      patron: '', tipo_accion: 'crear_objetivo', descripcion: 'decidir X', payload: '{}', monto: '1500', 'confianza_%': 80, estado: 'pendiente' },
    { id: 'APR-0010', fecha_creacion: '2026-07-27', id_cliente: 'CLI-002', cliente: 'Vehemence', modulo: 'director',
      patron: '', tipo_accion: 'otro', descripcion: 'de otro', payload: '{}', monto: '', 'confianza_%': 70, estado: 'pendiente' },
  ] : (sh && hojas[sh._n]) || []);
  ctx.getMaestro = () => ({ getSheetByName: (n) => ({ _n: 'AGG' }) });
  ctx.getConfig = (k) => (k === 'avatar_cliente_CLI-001' ? 'https://drive.google.com/thumbnail?id=F&sz=w512' : '');

  const f = ctx.fichaCliente('CLI-001');
  chk(f.ok === true && f.id_cliente === 'CLI-001', 'camino feliz: ok:true con el id');
  chk(f.objetivos.length === 1 && f.objetivos[0].valor_objetivo === 30000 && f.objetivos[0].fecha_objetivo === '2026-12-31',
      'objetivos: valor_objetivo → Number, fecha → ISO (trilogía de tipos)');
  chk(f.kpis.length === 1 && f.kpis[0].valor === 21500 && f.kpis[0].objetivo === 30000, 'kpis: valor/objetivo numéricos');
  chk(f.operacion[0].fecha === '2026-07-27' && f.operacion[1].fecha === '2026-07-01', 'operación: la más reciente PRIMERO');
  chk(f.operacion[0].concepto.indexOf('\t') < 0 && f.operacion[0].concepto.indexOf('\n') < 0,
      'operación: celda del SGIC pasa por limpiarHostilTexto_ (dato hostil)');
  chk(f.aprobaciones.length === 1 && f.aprobaciones[0].id === 'APR-0009', 'aprobaciones: SOLO las del cliente pedido');
  chk(f.aprobaciones[0].resumen === 'decidir X' && f.aprobaciones[0].tipo === 'crear_objetivo' && f.aprobaciones[0].monto === 1500,
      'aprobaciones: resumen sale de `descripcion`, tipo de `tipo_accion`, monto Number (columnas REALES del espejo)');
  chk(f.avatar_url.indexOf('thumbnail') > 0, 'avatar: lee Config avatar_cliente_<id> (T2-ready)');
  chk(f.hoja_falta.objetivos === false && f.hoja_falta.kpis === false, 'hoja_falta en false cuando las hojas existen');

  delete hojas.KPIs;
  const f2 = ctx.fichaCliente('CLI-001');
  chk(f2.ok === true && f2.hoja_falta.kpis === true && f2.kpis.length === 0,
      'hoja KPIs ausente → hoja_falta.kpis=true y lista vacía (se DICE, no se inventa)');

  const f3 = ctx.fichaCliente('CLI-099');
  chk(f3.ok === false && !!f3.error, 'cliente inaccesible → {ok:false} sin tirar (fail-closed)');
  chk(ctx.fichaCliente('').ok === false, 'id vacío → {ok:false}');

  ctx.abrirCliente = acOrig; ctx.leerTabla = ltOrig; ctx.getMaestro = gmOrig; ctx.getConfig = gcOrig;
}

// ═══ 12 · T1.2 (28-jul): checklist + situación de la Ficha 360 ═══════════════
seccion('checklist + briefCliente (T1.2)');
for (const fn of ['checklistCliente', 'checklistMarcar', 'checklistAgregar', 'briefCliente']) {
  chk(ctx.ENDPOINTS_UI.indexOf(fn) >= 0, fn + ' está en ENDPOINTS_UI (anti-drift)');
  chk(String(ctx[fn]).indexOf("_soloOwner_('" + fn + "')") >= 0, fn + ' lleva _soloOwner_');
}
chk(ctx.CLIENTE_SHEETS.checklist && ctx.CLIENTE_SHEETS.checklist.indexOf('tildado_en') >= 0,
    'CLIENTE_SHEETS declara la hoja checklist (con tildado_en)');
chk(ctx.CLIENTE_ORDEN.indexOf('checklist') < 0, 'checklist NO está en CLIENTE_ORDEN (lazy, como hilo)');
chk(ctx.CLIENTE_SHEETS_SENSIBLES.indexOf('checklist') >= 0, 'checklist es hoja sensible (oculta+protegida)');
{
  const acOrig = ctx.abrirCliente, ltOrig = ctx.leerTabla, apOrig = ctx.appendFila, niOrig = ctx.nextId, esOrig = ctx.ensureSheet;
  ctx.SATORI_CTX_SISTEMA = true;
  const escritas = [], sets = [];
  const filas = [
    { id: 'CHK-0001', item: 'llamar al gestor', detalle: '', origen: 'manual', estado: 'pendiente', creado_en: '2026-07-27', tildado_en: '' },
    { id: 'CHK-0002', item: 'Deploy V22', detalle: '', origen: 'hilo', estado: 'hecho', creado_en: '2026-07-27', tildado_en: '2026-07-27' },
  ];
  const shStub = { getSheetByName: null, getRange: (r, c) => ({ setValue: (v) => sets.push({ r, c, v }) }) };
  ctx.abrirCliente = () => ({ ss: { getSheetByName: (n) => (n === 'checklist' ? shStub : null) } });
  ctx.leerTabla = () => filas;
  ctx.appendFila = (sh, obj) => escritas.push(obj);
  ctx.nextId = () => 'CHK-0003';
  ctx.ensureSheet = () => shStub;

  const cl = ctx.checklistCliente('CLI-001');
  chk(cl.ok === true && cl.items.length === 2 && cl.items[1].estado === 'hecho' && cl.items[1].tildado_en === '2026-07-27',
      'checklistCliente lee ítems con estado y fecha de tilde');
  const m1 = ctx.checklistMarcar('CLI-001', 'hilo::Capturar la reunión del 22/07', true);
  chk(m1.ok === true && escritas.length === 1 && escritas[0].origen === 'hilo' && escritas[0].estado === 'hecho',
      'tilde de un pendiente del Hilo se REGISTRA como fila hecho (upsert, el espejo no se toca)');
  const m2 = ctx.checklistMarcar('CLI-001', 'CHK-0001', true);
  chk(m2.ok === true && sets.length === 2 && sets[0].r === 2,
      'tilde manual actualiza estado+tildado_en en la fila correcta (i+2, patrón 12_cola)');
  const a1 = ctx.checklistAgregar('CLI-001', 'texto\thostil\ncon saltos');
  chk(a1.ok === true && escritas.length === 2 && escritas[1].item.indexOf('\t') < 0 && escritas[1].item.indexOf('\n') < 0,
      'alta manual sanitiza el texto (limpiarHostilTexto_)');
  chk(ctx.checklistMarcar('CLI-001', '', true).ok === false, 'ref vacía → ok:false sin tirar');
  ctx.abrirCliente = acOrig; ctx.leerTabla = ltOrig; ctx.appendFila = apOrig; ctx.nextId = niOrig; ctx.ensureSheet = esOrig;
}

// ═══ 13 · T1.4 (28-jul): Sato en la ficha — memoria persistente + espejo al cerebro ═══
seccion('satoChat / satoCharla (T1.4)');
for (const fn of ['satoChat', 'satoCharla']) {
  chk(ctx.ENDPOINTS_UI.indexOf(fn) >= 0, fn + ' está en ENDPOINTS_UI (anti-drift)');
  chk(String(ctx[fn]).indexOf("_soloOwner_('" + fn + "')") >= 0, fn + ' lleva _soloOwner_');
}
chk(ctx.CLIENTE_SHEETS.charla && ctx.CLIENTE_SHEETS.charla.indexOf('rol') >= 0, 'CLIENTE_SHEETS declara la hoja charla');
chk(ctx.CLIENTE_ORDEN.indexOf('charla') < 0, 'charla NO está en CLIENTE_ORDEN (lazy)');
chk(ctx.CLIENTE_SHEETS_SENSIBLES.indexOf('charla') >= 0, 'charla es hoja sensible');
{
  const bk = {};
  ['abrirCliente', 'leerTabla', 'appendFila', 'ensureSheet', 'llamadaAPI', 'upsertNodo', 'guardPresupuesto_',
   'estadoVigente', 'checklistCliente', 'getConfig'].forEach(k => { bk[k] = ctx[k]; });
  ctx.SATORI_CTX_SISTEMA = true;
  const escritas = [];
  const filas = [{ ts: '2026-07-28T10:00:00', rol: 'user', texto: 'hola', modulo: 'sato_ficha' },
                 { ts: '2026-07-28T10:00:05', rol: 'sato', texto: 'hola Luciano', modulo: 'sato_ficha' }];
  const shStub = {};
  let nodoTocado = null, systemVisto = '';
  ctx.abrirCliente = () => ({ ss: { getSheetByName: (n) => (n === 'charla' ? shStub : null) } });
  ctx.leerTabla = () => filas;
  ctx.appendFila = (sh, o) => escritas.push(o);
  ctx.ensureSheet = () => shStub;
  ctx.llamadaAPI = (id, mod, opts) => { systemVisto = String(opts.system || ''); return { ok: true, texto: 'respuesta de sato', usd: 0.002, tokens_in: 10, tokens_out: 20 }; };
  ctx.upsertNodo = (t, n) => { nodoTocado = n; };
  ctx.guardPresupuesto_ = () => ({});
  ctx.estadoVigente = () => '# Estado vigente CLI-001';
  ctx.checklistCliente = () => ({ ok: true, items: [{ item: 'ítem abierto', estado: 'pendiente' }] });
  ctx.getConfig = () => '';

  const ch = ctx.satoCharla('CLI-001', 10);
  chk(ch.ok === true && ch.turnos.length === 2 && ch.turnos[1].rol === 'sato', 'satoCharla lee la transcripción persistida');
  const r1 = ctx.satoChat('CLI-001', 'qué priorizo hoy\tcon\ttabs');
  chk(r1.ok === true && r1.texto === 'respuesta de sato', 'satoChat responde con el texto del modelo');
  chk(escritas.length === 2 && escritas[0].rol === 'user' && escritas[1].rol === 'sato', 'ambos lados de la charla se PERSISTEN (memoria real)');
  chk(escritas[0].texto.indexOf('\t') < 0, 'la entrada se sanitiza antes de persistir');
  chk(systemVisto.indexOf('Estado vigente') >= 0 && systemVisto.indexOf('hola Luciano') >= 0,
      'el system lleva contexto vivo + conversación previa (Sato recuerda)');
  chk(systemVisto.indexOf('NUNCA afirmes que ejecutaste') >= 0, 'el system fija la honestidad N9 (no inventa acciones)');
  chk(!!nodoTocado && nodoTocado.tipo === 'charla_sato' && nodoTocado.dimension === 'lider', 'la charla se espeja al Cerebro como nodo (grafo navegable)');
  ctx.getConfig = (k) => (k === 'sato_tope_turnos' ? '1' : '');
  const r2 = ctx.satoChat('CLI-001', 'otro');
  chk(r2.ok === false && String(r2.error).indexOf('tope') >= 0, 'tope diario de turnos aplica (no se come el mes)');
  chk(ctx.satoChat('', 'x').ok === false && ctx.satoChat('CLI-001', '').ok === false, 'entradas vacías → ok:false');
  Object.keys(bk).forEach(k => { ctx[k] = bk[k]; });
}

// ── Veredicto ────────────────────────────────────────────────────────────────
const fallos = log.filter((l) => l.indexOf('❌') === 0);
const pasa = log.filter((l) => l.indexOf('✅') === 0).length;
console.log(log.join('\n'));
console.log('\nRESULTADO: PASA ' + pasa + ' / FALLA ' + fallos.length);
if (fallos.length) { console.log(fallos.join('\n')); process.exit(1); }
