/**
 * 16_salud.js — Loop de salud del sistema (ETAPA 8a · módulo a3).
 *
 * correrSalud() corre 7 chequeos (el 7º es el security-scan, T3-S4), los clasifica (ok/warn/crit) y escribe los hallazgos
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
 *  7) seguridad   — securityScan_: gate de endpoints, expiry de secretos, properties
 *                   críticas, kill switch (y hojas sensibles solo en full).
 */

/**
 * T3 · MÓDULO H · H2 (21-jul) — capa HUMANA de los 7 chequeos.
 *
 * El panel del CM mostraba el estado crudo: `cola [crit] 0 pendientes · 2 tomadas colgadas`. Eso lo
 * lee bien quien escribió el chequeo; nadie más. Acá vive, por chequeo, el nombre en llano y el
 * "QUÉ HACER" cuando no está en verde.
 *
 * El texto es FIJO por tipo y por estado — nunca sale de un LLM. Un consejo generado sobre un
 * sistema en crítico es exactamente el momento en que menos se puede permitir una alucinación, y
 * además haría que el panel de salud dependiera de que la API esté viva.
 *
 * `accion` vacío = el chequeo está en verde y no hay nada que hacer.
 */
var SALUD_HUMANO = {
  schema: { titulo: 'Estructura de las planillas',
            warn: 'Falta alguna pestaña o columna. Corré setup() y repararCerebro() desde el editor.',
            crit: 'Falta una pestaña o columna que el sistema necesita. Corré setup() y, si el faltante es del cerebro de un cliente, repararCerebro(). Hasta entonces, los datos de esa hoja no se están escribiendo.' },
  sync: { titulo: 'Frescura de los datos',
          warn: 'El espejo del MAESTRO tiene más de un día. Revisá que corridaDiaria siga instalada (el trigger de las 07:00) y corré syncMaestro() a mano para ponerlo al día.',
          crit: 'Hace más de un día que no se sincroniza: lo que ves puede estar viejo. Corré syncMaestro() y revisá el trigger corridaDiaria.' },
  cola: { titulo: 'Cola de trabajo de los agentes',
          warn: 'Se está acumulando trabajo sin drenar. Revisá que el trigger drenarCola (cada 5 min) siga vivo.',
          crit: 'Hay tareas trabadas hace más de 30 minutos: un agente tomó trabajo y no lo terminó. Mirá la hoja Cola_tareas, esas filas quedaron en "tomada" — reseteá su estado a "pendiente" para que se vuelvan a intentar.' },
  presupuesto: { titulo: 'Gasto de API del mes',
                 warn: 'Vas por encima del 80% del tope mensual. Decidí si subís el tope (Config api_budget_mensual_usd) o si frenás agentes hasta fin de mes.',
                 crit: 'Se agotó el tope mensual de API: los agentes ya NO están llamando al modelo. Subí api_budget_mensual_usd en Config o esperá al mes que viene.' },
  aprobaciones: { titulo: 'Decisiones esperándote',
                  warn: 'Hay aprobaciones pendientes más viejas que el plazo de expiración y nadie las marcó. Resolvelas desde el Centro de Mando o corré expirarAprobaciones().',
                  crit: 'Aprobaciones vencidas sin resolver: los agentes que dependen de ellas están frenados. Despachalas desde el Centro de Mando.' },
  cerebro: { titulo: 'Memoria de los clientes',
             warn: 'Hay clientes activos sin su cerebro materializado — el Director no los está dirigiendo. Corré repararCerebro() y después correrDirector().',
             crit: 'Clientes activos sin memoria: no hay contexto para analizarlos. Corré repararCerebro() y correrDirector().' },
  seguridad: { titulo: 'Cerrojos del sistema',
               warn: 'Algo de seguridad pide atención (un secreto sin fecha de vencimiento, o un endpoint que no se pudo verificar). Mirá el detalle y, si es un secreto, corré sembrarExpirySecretos().',
               crit: 'Hay un cerrojo abierto: un endpoint sin gate de identidad, un secreto vencido o una credencial faltante. Esto se resuelve ANTES que cualquier otra cosa — mirá el detalle y corré securityScan_() desde el editor para el desglose completo.' }
};

/** Título humano de un chequeo (fallback: el nombre técnico, jamás vacío). */
function saludTitulo_(nombre) {
  var m = SALUD_HUMANO[String(nombre)];
  return (m && m.titulo) || String(nombre);
}

/**
 * Qué hacer con un hallazgo. '' si está en verde. Si el chequeo no tiene texto cargado, se dice
 * eso explícitamente en vez de devolver vacío: un hueco silencioso se lee como "no hay nada que
 * hacer", que es lo contrario de lo que pasa.
 */
function saludAccion_(nombre, estado) {
  if (String(estado) === 'ok') return '';
  var m = SALUD_HUMANO[String(nombre)];
  var t = m && m[String(estado)];
  return t || ('Sin guía cargada para "' + nombre + '" en estado ' + estado + ' — mirá el detalle técnico.');
}

/**
 * @param {Object} [opts] { dryRun?:boolean (no escribe nada), full?:boolean (schema por cliente) }
 * @return {{global:string, hallazgos:Array, autoheal:boolean, healed:Array}}
 *   hallazgos: {nombre, estado, detalle, titulo, accion} — `titulo`/`accion` son la capa humana H2.
 */
function correrSalud(opts) {
  opts = opts || {};
  var ss = getMaestro();
  var hallazgos = [];
  // H2: cada hallazgo nace ya con su capa humana. Enriquecer acá (y no en la UI) hace que el brief,
  // `estadoVigente` y cualquier consumidor futuro hereden lo mismo sin re-implementarlo.
  function H(nombre, estado, detalle) {
    hallazgos.push({ nombre: nombre, estado: estado, detalle: String(detalle),
                     titulo: saludTitulo_(nombre), accion: saludAccion_(nombre, estado) });
  }

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

  // 7) Seguridad (T3-S4) — securityScan_ (22_seguridad.js, 0 API). En `full` audita además
  //    las hojas sensibles de cada tenant (abre Sheets: por eso va detrás del mismo flag).
  (function () {
    try {
      var sc = securityScan_({ full: !!opts.full });
      H('seguridad', sc.estado, sc.detalle);
    } catch (e) {
      // Un scan que revienta NO puede pasar por "ok": es exactamente el caso que debía detectar.
      H('seguridad', 'crit', 'securityScan_ falló: ' + ((e && e.message) || e));
    }
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
