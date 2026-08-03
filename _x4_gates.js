/**
 * _x4_gates.js — TC-1 (X4). Inserta `_soloOwner_('<nombre>')` como PRIMERA sentencia de las
 * funciones top-level públicas que mutan estado o consumen servicios y todavía no tienen puerta.
 *
 * Criterio (el mismo que fijó Bastión el 27-jul, re-derivado el 03-ago contra el repo real):
 *   GATEAR   = pública (sin `_` final ⇒ invocable por google.script.run) Y sin gate Y
 *              (escribe Sheets/Properties/Drive/Cache · instala triggers · manda mail ·
 *               gasta API paga · muta estado global en memoria).
 *   NO GATEAR = (a) parámetros/retornos NO serializables por google.script.run (recibe un
 *               Sheet/Spreadsheet/función, o devuelve un Spreadsheet) ⇒ no explotable por RPC;
 *               (b) puras sin I/O; (c) `doGet`/`doPost` (puerta propia); (d) wrappers no-arg que
 *               delegan en funciones YA gateadas (decisión 27-jul, comentada en 19_conectores.js);
 *               (e) LECTURAS de datos → residual X4b, decisión de Luciano.
 *
 * Los 7 entry points de sistema llevan el gate DESPUÉS de `_ctxSistema_()` (antes rompería los
 * triggers: sin el flag, `_soloOwner_` tira para una ejecución sin usuario activo).
 *
 * Idempotente. Uso: node _x4_gates.js [--dry]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'src');
const DRY = process.argv.indexOf('--dry') >= 0;

// ── las 68, por archivo y en orden de aparición ────────────────────────────────
const X4 = {
  '02_setup.js': ['setup', 'repararFormatosTexto'],
  '03_cliente.js': ['crearCliente', 'cargaInicialClientes'],
  '04_sync.js': ['syncMaestro'],
  '05_costos.js': ['llamadaAPI', 'logCostoCliente', 'consolidarCostosMes'],
  '06_avisos.js': ['probarAlertaEmail', 'probarBriefPush', 'crearAviso', 'corridaDiaria',
    'encolarVigiaClientesActivos', 'detectarVencimientos', 'detectarTareasEstancadas',
    'detectarProyectosSinMovimiento', 'expirarAprobaciones', 'invalidarMapaPC', 'instalarTriggers'],
  '09_selftest.js': ['selfTest', 'selfTestF2', 'debugE21', 'limpiarTodoTest', 'borrarFilasDonde'],
  '10_bootstrap.js': ['bootstrap'],
  '11_aprobaciones.js': ['expirarPendientes'],
  '12_cola.js': ['encolar', 'drenarCola', 'verifArchivoCola', 'archivarColaViejaREAL'],
  '13_agentes.js': ['encolarAgente'],
  '14_director.js': ['correrDirector', 'chequeoLivianoDirector', 'instalarTriggerDirector'],
  '15_cerebro.js': ['upsertNodo', 'upsertArista', 'logEvento', 'comprimirMemoriaFria',
    'comprimirMemoria', 'materializarEstado', 'repararCerebro', 'migrarCerebroSchema',
    'cargarObjetivo', 'cargarObjetivosPiloto', 'sembrarDatosEjemplo'],
  '16_salud.js': ['correrSalud'],
  '17_bandeja.js': ['clasificarBandeja', 'instalarTriggerBandeja'],
  '18_direccion.js': ['calentarBriefCache', 'calentarEstadoCache', 'sembrarNorthStarSatori',
    'cargarNorthStarSatori', 'cargarNorthStarVehemence', 'limpiarErroresFantasma',
    'registrarRecomendacionDelDia'],
  '19_conectores.js': ['sincronizarVehemence', 'sincronizarConectores'],
  '20_killswitch.js': ['smokeKill'],
  '21_backup.js': ['backupSemanal', 'backupAhora', 'instalarTriggerBackup', 'smokeBackup',
    'backupListar', 'drillRestore'],
  '22_seguridad.js': ['securityScan'],
  '23_evals.js': ['correrEvals', 'correrEvalsConApi'],
  '26_sato.js': ['diagVoz']
};

let total = 0, puestos = 0, yaTenian = 0;
const fallos = [];

for (const archivo of Object.keys(X4)) {
  const p = path.join(DIR, archivo);
  const lineas = fs.readFileSync(p, 'utf8').split('\n');
  let cambios = 0;

  for (const nombre of X4[archivo]) {
    total++;
    const re = new RegExp('^function ' + nombre + '\\s*\\(');
    const i = lineas.findIndex(l => re.test(l));
    if (i < 0) { fallos.push(archivo + ' · ' + nombre + ': no se encontró la declaración'); continue; }

    // ¿ya tiene gate? (mirando el cuerpo por balanceo de llaves)
    let d = 0, cuerpo = '', fin = i;
    for (let j = i; j < lineas.length; j++) {
      const s = lineas[j].replace(/'(\\.|[^'\\])*'/g, "''").replace(/"(\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, '');
      cuerpo += lineas[j] + '\n';
      for (const c of s) { if (c === '{') d++; else if (c === '}') d--; }
      if (d === 0 && cuerpo.indexOf('{') >= 0) { fin = j; break; }
    }
    if (cuerpo.indexOf('_soloOwner_') >= 0) { yaTenian++; continue; }

    const gate = "  _soloOwner_('" + nombre + "');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.";

    if (fin === i) {
      // función de una sola línea: se expande para poder anteponer el gate.
      const m = lineas[i].match(/^(function [^{]*\{)(.*)\}\s*$/);
      if (!m) { fallos.push(archivo + ' · ' + nombre + ': one-liner no parseable'); continue; }
      lineas.splice(i, 1, m[1], gate, '  ' + m[2].trim(), '}');
    } else if (/_ctxSistema_\(\)/.test(lineas[i + 1])) {
      // entry point de sistema: el gate va DESPUÉS del contexto, nunca antes.
      lineas.splice(i + 2, 0, gate.replace('⇒ puerta.', '⇒ puerta. Va DESPUÉS de _ctxSistema_: antes rompería el trigger.'));
    } else {
      lineas.splice(i + 1, 0, gate);
    }
    cambios++; puestos++;
  }

  if (cambios && !DRY) fs.writeFileSync(p, lineas.join('\n'));
  if (cambios) console.log(`${archivo}: +${cambios} gate(s)`);
}

console.log(`\nX4: ${total} declaradas · ${puestos} gates puestos · ${yaTenian} ya tenían`);
if (fallos.length) { console.error('FALLOS:\n  ' + fallos.join('\n  ')); process.exit(1); }
