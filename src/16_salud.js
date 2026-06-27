/**
 * 16_salud.js — Loop de salud del sistema (ETAPA 8a · módulo a3).
 *
 * correrSalud() corre 6 chequeos, los clasifica (ok/warn/crit) y escribe los hallazgos
 * al feed (Actividad, agente "Salud") + Avisos para los CRÍTICOS (surfacean en "Hoy").
 * **0 API** (100% reglas). **Alerta, no arregla**: el auto-heal está detrás del flag
 * AUTOHEAL_ON (Script Property o Config 'autoheal_on'); en piloto = false → solo alerta.
 *
 * Cuota (supuesto 2 del plano): el chequeo de schema por-cliente ABRE cada Sheet, así que
 * en el pase diario corre la versión liviana (solo MAESTRO). La versión completa (clientes)
 * se pide con correrSalud({ full:true }) on-demand.
 *
 * Chequeos:
 *  1) schema      — pestañas/columnas esperadas (MAESTRO siempre; clientes si full).
 *  2) sync        — ultima_sync_ok no más vieja que ~25h.
 *  3) cola        — tareas 'tomada' colgadas > 30 min / backlog alto.
 *  4) presupuesto — gasto del mes vs tope USD (80% warn / 100% crit).
 *  5) aprobaciones— pendientes pasadas de N días que el expirador no marcó.
 *  6) cerebro     — cada tenant activo con su fila en Cerebro_index (materializado).
 */

/**
 * @param {Object} [opts] { dryRun?:boolean (no escribe nada), full?:boolean (schema por cliente) }
 * @return {{global:string, hallazgos:Array, autoheal:boolean, healed:Array}}
 */
function correrSalud(opts) {
  opts = opts || {};
  var ss = getMaestro();
  var hallazgos = [];
  function H(nombre, estado, detalle) { hallazgos.push({ nombre: nombre, estado: estado, detalle: String(detalle) }); }

  // 1) Schema (MAESTRO siempre; clientes solo en full por la cuota).
  (function () {
    var faltan = [];
    MAESTRO_ORDEN.forEach(function (n) {
      var sh = ss.getSheetByName(n);
      if (!sh) { faltan.push('MAESTRO/' + n); return; }
      var H0 = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
      MAESTRO_SHEETS[n].forEach(function (col) { if (H0.indexOf(col) < 0) faltan.push('MAESTRO/' + n + '.' + col); });
    });
    if (opts.full) {
      leerTabla(ss.getSheetByName('Clientes')).forEach(function (c) {
        if (!c.url_sheet_cliente) return;
        try {
          var cs = SpreadsheetApp.openByUrl(c.url_sheet_cliente);
          CLIENTE_ORDEN.forEach(function (n) { if (!cs.getSheetByName(n)) faltan.push(c.id_cliente + '/' + n); });
        } catch (e) { faltan.push(c.id_cliente + ' (no abre)'); }
      });
    }
    H('schema', faltan.length ? 'crit' : 'ok', faltan.length ? ('faltan: ' + faltan.slice(0, 10).join(', ')) : 'completo' + (opts.full ? ' (incl. clientes)' : ' (MAESTRO)'));
  })();

  // 2) Frescura de sync.
  (function () {
    var u = aFechaHora_(getConfig('ultima_sync_ok'));
    var horas = u ? (Date.now() - u.getTime()) / 36e5 : 9999;
    H('sync', horas > 25 ? 'warn' : 'ok', 'última sync hace ' + Math.round(horas) + 'h');
  })();

  // 3) Cola atascada.
  (function () {
    var cola = leerTabla(ss.getSheetByName('Cola_tareas'));
    var pend = cola.filter(function (f) { return String(f.estado) === 'pendiente'; }).length;
    var colgadas = cola.filter(function (f) {
      if (String(f.estado) !== 'tomada') return false;
      var t = aFechaHora_(f.tomada_en);
      return t && (Date.now() - t.getTime()) > 30 * 60 * 1000;
    }).length;
    H('cola', colgadas > 0 ? 'crit' : (pend > 50 ? 'warn' : 'ok'), pend + ' pendientes · ' + colgadas + ' tomadas colgadas');
  })();

  // 4) Presupuesto.
  (function () {
    var c = filaConsumoAgentes_(), tope = budgetMensualUSD_();
    var pct = tope ? Math.round(c.gasto / tope * 100) : 0;
    H('presupuesto', pct >= 100 ? 'crit' : (pct >= 80 ? 'warn' : 'ok'), 'USD ' + c.gasto + ' / ' + tope + ' (' + pct + '%)');
  })();

  // 5) Aprobaciones pasadas de fecha sin expirar.
  (function () {
    var dias = parseInt(getConfig('expiracion_aprobaciones_dias') || '7', 10);
    var limite = hace(dias);
    var vivas = leerTabla(ss.getSheetByName('Aprobaciones_agregadas')).filter(function (a) {
      return String(a.estado).toLowerCase() === 'pendiente' && aFechaISO(a.fecha_creacion) && aFechaISO(a.fecha_creacion) < limite;
    }).length;
    H('aprobaciones', vivas > 0 ? 'warn' : 'ok', vivas + ' pendientes pasadas de ' + dias + 'd sin expirar');
  })();

  // 6) Cerebro materializado por tenant activo (índice agregado, sin abrir clientes).
  (function () {
    var idx = {}; leerTabla(ss.getSheetByName('Cerebro_index')).forEach(function (f) { idx[String(f.id_cliente)] = true; });
    var sin = leerTabla(ss.getSheetByName('Clientes')).filter(function (c) {
      return ['activo', 'activo-piloto'].indexOf(String(c.estado).toLowerCase()) >= 0 && !idx[c.id_cliente];
    }).map(function (c) { return c.id_cliente; });
    H('cerebro', sin.length ? 'warn' : 'ok', sin.length ? ('sin materializar: ' + sin.join(', ')) : 'todos al día');
  })();

  // Clasificación global.
  var crit = hallazgos.filter(function (h) { return h.estado === 'crit'; });
  var warn = hallazgos.filter(function (h) { return h.estado === 'warn'; });
  var global = crit.length ? 'crit' : (warn.length ? 'warn' : 'ok');

  var healed = [];
  var autoheal = String(PropertiesService.getScriptProperties().getProperty('AUTOHEAL_ON') || getConfig('autoheal_on') || 'false') === 'true';

  if (!opts.dryRun) {
    // Hallazgos al feed (Actividad) + Avisos para CRÍTICOS.
    feed_('Salud', global === 'ok' ? 'info' : 'aprobacion', '',
      'Salud ' + global.toUpperCase() + ': ' + hallazgos.map(function (h) { return h.nombre + '=' + h.estado; }).join(' · '), '', '');
    crit.forEach(function (h) {
      crearAviso({ origen: 'salud', tipo: 'salud_' + h.nombre, mensaje: 'Salud CRÍTICO — ' + h.nombre + ': ' + h.detalle });
    });
    if (crit.length) {
      alertaEmail_('Salud CRITICA (' + crit.length + ')',
        'El sistema detecto ' + crit.length + ' chequeo(s) en estado CRITICO:\n\n' +
        crit.map(function (h) { return '- ' + h.nombre + ': ' + h.detalle; }).join('\n') +
        '\n\nRevisa el Centro de Mando.', 'salud_crit');
    }
    setConfig('ultima_corrida_salud', ahoraISO());

    // Auto-heal SOLO si AUTOHEAL_ON=true (piloto: false → no entra). Conservador: solo schema.
    if (autoheal && crit.length) {
      crit.forEach(function (h) {
        try {
          if (h.nombre === 'schema') { setup(); repararCerebro(); healed.push('schema'); feed_('Salud', 'exito', '', 'Auto-heal: schema reparado (setup + repararCerebro).', '', ''); }
        } catch (e) { feed_('Salud', 'info', '', 'Auto-heal falló en ' + h.nombre + ': ' + e.message, '', ''); }
      });
    }
  }

  Logger.log('correrSalud: ' + global + ' ' + JSON.stringify(hallazgos.map(function (h) { return h.nombre + '=' + h.estado; })));
  return { global: global, hallazgos: hallazgos, autoheal: autoheal, healed: healed };
}
