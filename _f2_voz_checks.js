#!/usr/bin/env node
/* _f2_voz_checks.js -- harness offline F2 Sato Ejecutor (bandeja de Encargos, lado GAS). 24-ago-2026.
   Carga src/08_webapp.js en un vm con stubs y verifica las tools/actions nuevas. Sale !=0 si falla. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
let pasa = 0, falla = 0;
function chk(c, n, d) { if (c) { pasa++; console.log('OK  ' + n); } else { falla++; console.log('FALLA ' + n + (d ? ' -- ' + d : '')); } }

// ---- fake sheet Encargos (soporta getDataRange/getRange.setValues/appendFila) ----
function makeSheet(headers) {
  const rows = [headers.slice()];
  return {
    _rows: rows,
    getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
    getLastRow: () => rows.length,
    getLastColumn: () => headers.length,
    getRange: () => ({ setValues: (m) => { for (let i = 0; i < m.length; i++) rows[i] = m[i].slice(); } }),
  };
}
const HEADERS = ['id_encargo', 'ts_creacion', 'origen', 'id_cliente', 'tipo', 'repo', 'texto', 'estado', 'id_aprobacion', 'ts_inicio', 'ts_fin', 'resultado_resumen', 'artefactos', 'log_ref', 'decidido_por'];
let ENC = makeSheet(HEADERS);
let encN = 0, aprN = 0, pausado = false, secretoProp = 'sec-encargos', avisos = [];
const aprCalls = [];

const ctx = {
  console, Logger: { log() {} },
  // helpers de OTROS archivos (no cargados) -> el stub persiste
  conLock: (fn) => fn(),
  nextId: () => 'ENC-000' + (++encN),
  appendFila: (sh, obj) => { const H = sh._rows[0]; sh._rows.push(H.map(h => (obj[h] !== undefined ? obj[h] : ''))); },
  ahoraISO: () => '2026-08-24T23:00:00Z',
  limpiarHostilTexto_: (t, n) => String(t == null ? '' : t).replace(/[\t\r\n]/g, ' ').replace(/ +/g, ' ').trim().slice(0, n || 200),
  truncar_: (t, n) => String(t).slice(0, n),
  gateRiesgo_: () => ({ ok: true }),
  crearAprobacion: (idc, mod, tipo, payload, opts) => { aprCalls.push({ idc, mod, tipo, payload, opts }); return { id: 'APR-00' + (++aprN), auto: false }; },
  ejecutarAprobada: () => ({ ok: true }),
  _sistemaPausado_: () => pausado,
  crearAviso: (a) => { avisos.push(a); },
  getMaestro: () => ({ getSheetByName: () => null }),
  leerTabla: () => [],
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'ENCARGOS_SECRET' ? secretoProp : null) }) },
};
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', '08_webapp.js'), 'utf8'), ctx, { filename: '08_webapp.js' }); }
catch (e) { console.log('FALLA carga 08_webapp.js: ' + e.message); process.exit(1); }

// override POST-carga de lo que 08_webapp define (pisa los stubs pre-carga)
ctx._hqHoja_ = () => ENC;                                  // hoja lazy Encargos -> fake
ctx.ctEq_ = (a, b) => String(a) === String(b);             // real usa SHA-256/Utilities (no en vm)

// 1 · whitelist
const esperadas = ['estado', 'brief', 'vehemence', 'cliente', 'cerebro', 'capturar', 'sgic', 'accion', 'aprobaciones', 'decidir', 'agente', 'tarea', 'encargar'];
chk(esperadas.every(k => ctx.VOZ_TOOLS[k] === 1) && Object.keys(ctx.VOZ_TOOLS).length === 13, 'VOZ_TOOLS: 13 exactas incl. encargar');
chk(String(ctx.doPost).indexOf("case 'encargar'") >= 0, "doPost: case encargar");
chk(String(ctx.doPost).indexOf("encargos_poll") >= 0 && String(ctx.doPost).indexOf("encargos_reportar") >= 0, 'doPost: ruteo poll/reportar');
chk(String(ctx.doPost).indexOf('encargosAuth_') >= 0, 'doPost: poll/reportar por encargosAuth_ (secreto dedicado)');

// 2 · vozEncargar_ rechazos (whitelist server-side)
chk(ctx.vozEncargar_('x', 'codigo_dry', 'SatoriOS').error === 'tipo_no_permitido', 'encargar: codigo_dry NO por voz');
chk(ctx.vozEncargar_('x', 'investigar', 'OtroRepo').error === 'repo_no_permitido', 'encargar: repo fuera de whitelist');
chk(ctx.vozEncargar_('   ', 'investigar', 'SatoriOS').error === 'falta_texto', 'encargar: texto vacio');
chk(aprCalls.length === 0, 'encargar: los rechazos NO crearon aprobacion');

// 3 · vozEncargar_ camino feliz
const R = ctx.vozEncargar_('investiga\tcompetidores\nde Vehemence', 'investigar', 'SatoriOS');
chk(R.ok === true && /^ENC-000\d$/.test(R.id_encargo) && R.estado === 'pendiente_aprobacion', 'encargar: crea encargo pendiente_aprobacion');
chk(aprCalls.length === 1 && aprCalls[0].tipo === 'ejecutar_encargo' && aprCalls[0].idc === 'CLI-000', 'encargar: crea Aprobacion ejecutar_encargo en CLI-000');
chk(aprCalls[0].payload.id_encargo === R.id_encargo, 'encargar: la aprobacion referencia el id del encargo');
// la fila quedo con texto saneado + id_aprobacion enlazado
const fila = ENC._rows.find(r => r[0] === R.id_encargo);
chk(fila && fila[6].indexOf('\t') < 0 && fila[6].indexOf('\n') < 0, 'encargar: texto saneado en la hoja');
chk(fila && fila[7] === 'pendiente_aprobacion' && fila[8] === R.id_aprobacion, 'encargar: estado + id_aprobacion en la fila');

// 4 · _encargoAprobar_ flipea a aprobado (lo que hace el ejecutor de la Aprobacion)
const A = ctx._encargoAprobar_({ id_encargo: R.id_encargo });
chk(A.ok === true, 'aprobar: _encargoAprobar_ ok');
chk(ENC._rows.find(r => r[0] === R.id_encargo)[7] === 'aprobado', 'aprobar: flipea estado a aprobado');
chk(ctx._encargoAprobar_({}).error === 'sin_id_encargo', 'aprobar: sin id -> error');
chk(ctx._encargoAprobar_({ id_encargo: 'ENC-9999' }).error === 'encargo_no_encontrado', 'aprobar: id inexistente -> error');

// 5 · encargosPoll_ entrega aprobados y los pasa a en_ejecucion (lock), solo id/tipo/repo/texto
const P = ctx.encargosPoll_();
chk(P.ok === true && P.encargos.length === 1 && P.encargos[0].id_encargo === R.id_encargo, 'poll: entrega el aprobado');
chk(Object.keys(P.encargos[0]).sort().join(',') === 'id_encargo,repo,texto,tipo', 'poll: expone solo id/tipo/repo/texto');
chk(ENC._rows.find(r => r[0] === R.id_encargo)[7] === 'en_ejecucion', 'poll: lock -> en_ejecucion');
chk(ctx.encargosPoll_().encargos.length === 0, 'poll: idempotente (ya no re-entrega)');

// 6 · kill-switch
pausado = true;
const Pp = ctx.encargosPoll_();
chk(Pp.pausado === true && Pp.encargos.length === 0, 'poll: en pausa (#7) no entrega nada');
pausado = false;

// 7 · encargosReportar_
chk(ctx.encargosReportar_({ id_encargo: R.id_encargo, estado: 'borrar' }).error === 'estado_invalido', 'reportar: estado fuera de {hecho,fallido}');
chk(ctx.encargosReportar_({ estado: 'hecho' }).error === 'falta_id_encargo', 'reportar: sin id');
const Rep = ctx.encargosReportar_({ id_encargo: R.id_encargo, estado: 'hecho', resumen: 'listo', artefactos: 'entregables/encargos/ENC-0001/resultado.md' });
chk(Rep.ok === true, 'reportar: hecho ok');
const f2 = ENC._rows.find(r => r[0] === R.id_encargo);
chk(f2[7] === 'hecho' && f2[11] === 'listo', 'reportar: escribe estado + resumen');
chk(avisos.some(a => a.tipo === 'encargo_hecho'), 'reportar: emite aviso');

// 8 · encargosAuth_ fail-closed
chk(ctx.encargosAuth_('sec-encargos') === true, 'auth: secreto correcto pasa');
chk(ctx.encargosAuth_('malo') === false, 'auth: secreto malo rechazado');
secretoProp = null;
chk(ctx.encargosAuth_('sec-encargos') === false, 'auth: sin property -> fail-closed');

console.log('\nRESULTADO F2: PASA ' + pasa + ' / FALLA ' + falla);
process.exit(falla ? 1 : 0);
