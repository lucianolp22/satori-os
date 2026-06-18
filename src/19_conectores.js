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
 */

// ID de la planilla DB de Vehemence SGIC. NO es secreto (es un identificador; el acceso lo
// gobierna el ACL del Sheet). Si se escala, mover a un registro `Conectores`.
var VEHEMENCE_DB_ID = '1ac1ccVMdFgO_VyOzsGwvdtEhCil41A6GnrJIAoNAwNk';

/** Conector de Vehemence (CLI-002): no-arg para correr del editor. Lee DB_VENTAS → Datos_operativos. */
function sincronizarVehemence() {
  return sincronizarConectorVentas_('CLI-002', VEHEMENCE_DB_ID);
}

/** Corre todos los conectores configurados. Lo llama corridaDiaria. Tolerante a fallos por conector. */
function sincronizarConectores() {
  var out = {};
  try { out.vehemence = sincronizarVehemence(); } catch (e) { out.vehemence = { error: e.message }; }
  return out;
}

/**
 * Lee DB_VENTAS de la fuente, agrega ventas por mes×canal y refresca las filas del conector en
 * `Datos_operativos` del cliente (full-refresh de SUS filas; las cargadas a mano no se tocan).
 * @return {{meses, nuevas, fuente}}
 */
function sincronizarConectorVentas_(idCliente, srcId) {
  var src = SpreadsheetApp.openById(srcId);       // SOLO lectura de la fuente
  var shV = src.getSheetByName('DB_VENTAS');
  if (!shV) throw new Error('la fuente de ' + idCliente + ' no tiene DB_VENTAS');
  var agregados = agregarVentasPorMes_(leerTabla(shV));

  var dst = abrirCliente(idCliente).ss.getSheetByName('Datos_operativos');
  if (!dst) throw new Error(idCliente + ' sin Datos_operativos');
  var FUENTE = 'Vehemence SGIC · DB_VENTAS';

  return conLock(function () {
    // Full-refresh: borro SOLO las filas previas de este conector (no las manuales) y reescribo.
    // Son agregados derivados (no registros decididos) → refrescar es correcto, no rompe append-only.
    var filas = leerTabla(dst);
    for (var i = filas.length - 1; i >= 0; i--) {
      if (String(filas[i].fuente) === FUENTE) dst.deleteRow(filas[i]._fila);
    }
    agregados.forEach(function (a) {
      appendFila(dst, { fecha: a.fecha, concepto: a.concepto, valor: a.valor, fuente: FUENTE, notas: a.notas });
    });
    Logger.log('sincronizarConectorVentas_ ' + idCliente + ': ' + agregados.length + ' filas (mes×canal).');
    return { meses: agregados.length, nuevas: agregados.length, fuente: FUENTE };
  });
}

/**
 * PURA (testeable, sin I/O): filas crudas de DB_VENTAS → array de agregados por mes×canal,
 * listos para Datos_operativos. Excluye canceladas/pendientes. AOV = total/órdenes (ARS).
 */
function agregarVentasPorMes_(ventas) {
  var agg = {}; // 'YYYY-MM|canal' → acumulador
  ventas.forEach(function (v) {
    var st = String(v.status || '').toLowerCase();
    if (/cancel|pend|anul|borrador|draft/.test(st)) return; // solo ventas válidas
    var mes = aFechaISO(v.ts).slice(0, 7);                  // robusto a Date/string
    if (!/^\d{4}-\d{2}$/.test(mes)) return;
    var canal = String(v.channel) === 'online' ? 'online' : 'local';
    var k = mes + '|' + canal;
    if (!agg[k]) agg[k] = { mes: mes, canal: canal, total: 0, subtotal: 0, envio: 0, n: 0 };
    agg[k].total += Number(v.total_ars) || 0;
    agg[k].subtotal += Number(v.subtotal_ars) || 0;
    agg[k].envio += Number(v.envio_ars) || 0;
    agg[k].n += 1;
  });
  return Object.keys(agg).sort().map(function (k) {
    var a = agg[k];
    var aov = a.n ? Math.round(a.total / a.n) : 0;
    return {
      fecha: a.mes + '-01',
      concepto: 'Ventas ' + a.canal + ' (mes, ARS)',
      valor: Math.round(a.total),
      notas: a.n + ' órdenes · AOV $' + aov + ' · prod $' + Math.round(a.subtotal) + ' · envío $' + Math.round(a.envio) + ' · ' + a.mes
    };
  });
}
