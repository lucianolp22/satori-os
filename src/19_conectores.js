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

/** Corre todos los conectores configurados. Lo llama corridaDiaria. Tolerante a fallos por conector. */
function sincronizarConectores() {
  var out = {};
  try { out.vehemence = sincronizarVehemence(); } catch (e) { out.vehemence = { error: e.message }; }
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
