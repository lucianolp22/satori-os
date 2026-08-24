#!/usr/bin/env node
/* _f1_voz_checks.js — harness offline F1 Sato Ejecutor (24-ago-2026).
   Carga src/08_webapp.js en un vm con stubs y verifica las 4 tools nuevas de voz.
   Uso: node _f1_voz_checks.js  (sale !=0 si algo falla) */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
let pasa = 0, falla = 0;
function chk(cond, nombre) { if (cond) { pasa++; console.log('OK  ' + nombre); } else { falla++; console.log('FALLA ' + nombre); } }

const src = fs.readFileSync(path.join(__dirname, 'src', '08_webapp.js'), 'utf8');
const llamadas = { resolver: [], quitar: [], encolar: [], crearTarea: [] };
let espejo = [];
const ctx = {
  console, Logger: { log: function () {} },
  getMaestro: () => ({ getSheetByName: (n) => ({ _n: n }) }),
  leerTabla: (sh) => sh && sh._n === 'Aprobaciones_agregadas' ? espejo
    : (sh && sh._n === 'Clientes' ? [{ id_cliente: 'CLI-002', nombre: 'Vehemence Velas' }] : []),
  limpiarHostilTexto_: (t) => String(t).replace(/[\t\r\n]/g, ' ').replace(/ +/g, ' ').trim(),
  resolverAprobacion: (idc, id, d, ed) => { llamadas.resolver.push([idc, id, d, ed]); return { ok: true, estado: d, ejecucion: d === 'rechazada' ? undefined : { ok: true } }; },
  quitarAgregada_: (id, idc) => { llamadas.quitar.push([id, idc]); },
  encolarAgente: (idc, clave, args) => { llamadas.encolar.push([idc, clave]); return 'COLA-77'; },
  crearTarea: (p) => { llamadas.crearTarea.push(p); return { id_tarea: 'TAR-0009', descripcion: p.descripcion, prioridad: p.prioridad, fecha_limite: p.fecha_limite }; },
  AGENTES: { vigia: { nombre: 'Vigia', activo: true }, analista: { nombre: 'Analista', activo: true }, flux: { nombre: 'Flux', activo: false } },
};
vm.createContext(ctx);
// Solo se ejecutan las DEFINICIONES top-level del archivo; los caminos no stubbeados no se tocan.
try { vm.runInContext(src, ctx, { filename: '08_webapp.js' }); }
catch (e) { console.log('FALLA carga 08_webapp.js en vm: ' + e.message); process.exit(1); }
// 08_webapp.js define sus PROPIAS quitarAgregada_ y crearTarea → pisan los stubs pre-carga.
// Se re-stubbean POST-carga (el lookup global en runtime toma estas) para espiar las llamadas.
ctx.quitarAgregada_ = (id, idc) => { llamadas.quitar.push([id, idc]); };
ctx.crearTarea = (p) => { llamadas.crearTarea.push(p); return { id_tarea: 'TAR-0009', descripcion: p.descripcion, prioridad: p.prioridad, fecha_limite: p.fecha_limite }; };

// 1 · whitelist exacta
const esperadas = ['estado','brief','vehemence','cliente','cerebro','capturar','sgic','accion','aprobaciones','decidir','agente','tarea'];
chk(ctx.VOZ_TOOLS && esperadas.every(k => ctx.VOZ_TOOLS[k] === 1), 'VOZ_TOOLS: las 8 viejas + 4 F1 presentes');
chk(Object.keys(ctx.VOZ_TOOLS).length === 12, 'VOZ_TOOLS: ninguna tool de mas (12 exactas)');
// 2 · dispatch cablea las 4
const dp = String(ctx.doPost);
chk(["case 'aprobaciones'","case 'decidir'","case 'agente'","case 'tarea'"].every(c => dp.indexOf(c) >= 0), 'doPost: los 4 cases existen');
chk(/case 'agente':\s*if \(!id\)/.test(dp), 'doPost: agente exige idCliente');
// 3 · listar: filtra pendientes + sanea hostil
espejo = [ { id: 'APR-0007', estado: 'pendiente', id_cliente: 'CLI-002', cliente: 'Vehemence', tipo_accion: 'enviar_email', descripcion: 'Cobrar\tfactura\nF-88', monto: 120 },
           { id: 'APR-0008', estado: 'aprobada', id_cliente: 'CLI-003', cliente: 'LC', tipo_accion: 'x', descripcion: 'ya resuelta', monto: '' } ];
const L = ctx.vozAprobacionesPendientes_();
chk(L.total === 1 && L.items.length === 1 && L.items[0].id === 'APR-0007', 'aprobaciones: solo pendientes (la resuelta no entra)');
chk(L.items[0].resumen.indexOf('\t') < 0 && L.items[0].resumen.indexOf('\n') < 0, 'aprobaciones: resumen saneado (hostil a plano)');
// 4 · decidir: default-deny
chk(ctx.vozDecidirAprobacion_('APR-0007', 'editar', '').error === 'decision_invalida', 'decidir: whitelist dura (editar NO existe por voz)');
chk(ctx.vozDecidirAprobacion_('borrar todo; DROP', 'aprobar', '').error === 'id_invalido', 'decidir: id malformado rechazado');
chk(ctx.vozDecidirAprobacion_('APR-9999', 'aprobar', '').error === 'aprobacion_no_encontrada', 'decidir: id inexistente rechazado');
chk(llamadas.resolver.length === 0, 'decidir: los rechazos NO tocaron resolverAprobacion');
// 5 · decidir: camino feliz — id_cliente sale del ESPEJO
const D = ctx.vozDecidirAprobacion_('apr-0007', 'aprobar', 'ok\nvamos');
chk(D.ok === true && D.estado === 'aprobada' && D.ejecucion === 'ejecutada', 'decidir: aprueba y reporta ejecucion real');
chk(llamadas.resolver[0][0] === 'CLI-002' && llamadas.resolver[0][1] === 'APR-0007' && llamadas.resolver[0][2] === 'aprobada', 'decidir: id_cliente resuelto server-side (jamas del LLM)');
chk(llamadas.resolver[0][3].notas && llamadas.resolver[0][3].notas.indexOf('\n') < 0, 'decidir: nota saneada');
chk(llamadas.quitar.length === 1 && llamadas.quitar[0][0] === 'APR-0007' && llamadas.quitar[0][1] === 'CLI-002', 'decidir: reflejo inmediato del espejo (quitarAgregada_)');
const R = ctx.vozDecidirAprobacion_('APR-0007', 'rechazar', '');
chk(llamadas.resolver[1][2] === 'rechazada' && R.ok === true && R.ejecucion === null, 'decidir: rechazar mapea a rechazada y NO reporta ejecucion');
// 6 · agente
chk(ctx.vozDispararAgente_('CLI-002', 'flux').error === 'agente_desconocido', 'agente: inactivo (laboratorio) rechazado');
chk(ctx.vozDispararAgente_('CLI-002', 'hacker').error === 'agente_desconocido', 'agente: desconocido rechazado');
chk(llamadas.encolar.length === 0, 'agente: los rechazos NO encolaron nada');
const A = ctx.vozDispararAgente_('CLI-002', '  Analista ');
chk(A.ok === true && A.encolado === true && llamadas.encolar[0][1] === 'analista', 'agente: encola normalizado (encolarAgente, SIN drenar)');
chk(String(ctx.vozDispararAgente_).indexOf('drenarCola') < 0, 'agente: el helper no llama drenarCola (decision N5)');
// 7 · tarea
chk(ctx.vozCrearTarea_('', 'A', '', '').error === 'falta_descripcion', 'tarea: sin texto rechazada');
const T = ctx.vozCrearTarea_('Llamar\ta Micaela\npor el AOV', 'A', '2026-09-01', 'CLI-002');
chk(T.ok === true && T.id_tarea === 'TAR-0009', 'tarea: creada via crearTarea real (whitelists alla)');
chk(llamadas.crearTarea[0].descripcion.indexOf('\n') < 0 && llamadas.crearTarea[0].descripcion.indexOf('\t') < 0, 'tarea: descripcion saneada');
chk(llamadas.crearTarea[0].tipo === 'cliente' && llamadas.crearTarea[0].etiquetas[0] === 'vehemence', 'tarea: tipo cliente + etiqueta del roster');

console.log('\nRESULTADO F1: PASA ' + pasa + ' / FALLA ' + falla);
process.exit(falla ? 1 : 0);
