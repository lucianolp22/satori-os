/**
 * 08_webapp.js — Web App interna (acceso "solo yo", ejecutar como yo).
 *
 * UI = Registro A de DESIGN.md (dashboard/ERP operativo). Implementación
 * GAS-compatible (DESIGN.md §6): HTML/CSS/JS vanilla servido por HtmlService,
 * TODOS los datos entran async vía google.script.run.withSuccessHandler — nunca
 * por templating, así no hay `<?= ?>` ni `<?!= ?>` con datos.
 *
 * doGet sirve la shell estática (index.html). El front llama a:
 *   - datosHoy()              → vista "Hoy"
 *   - listaClientes()         → navegación lateral
 *   - datosCliente(idCliente) → panel por cliente
 */
function doGet() {
  // PURGA #9: sin ALLOWALL — se deja el XFrameOptions por defecto (no embebible
  // por terceros). App interna de un solo usuario, no necesita iframes externos.
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Satori OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Resumen de cabecera (incluye ultima_sync_ok, visible siempre). */
function estadoSistema() {
  var ss = getMaestro();
  var avisosActivos = leerTabla(ss.getSheetByName('Avisos')).filter(function (f) { return f.estado === 'activo'; });
  var pendientes = leerTabla(ss.getSheetByName('Aprobaciones_agregadas')).length;
  return {
    clientes: leerTabla(ss.getSheetByName('Clientes')).length,
    proyectos: leerTabla(ss.getSheetByName('Proyectos')).length,
    tareas: leerTabla(ss.getSheetByName('Tareas')).length,
    avisos_activos: avisosActivos.length,
    aprobaciones_pendientes: pendientes,
    ultima_sync_ok: getConfig('ultima_sync_ok'),
    ultima_sync_estado: getConfig('ultima_sync_estado'),
    ultima_corrida_avisos: getConfig('ultima_corrida_avisos')
  };
}

// ── Vista "Hoy" ─────────────────────────────────────────────────────────────

/**
 * Datos de la vista "Hoy": estado, avisos activos, próximos pasos por prioridad
 * y pendientes de aprobación agrupados por patrón.
 */
function datosHoy() {
  var ss = getMaestro();

  var avisos = leerTabla(ss.getSheetByName('Avisos'))
    .filter(function (f) { return String(f.estado) === 'activo'; })
    .map(function (f) {
      return { tipo: f.tipo, mensaje: f.mensaje, id_cliente: f.id_cliente, fecha: aFechaISO(f.fecha) };
    });

  var proximos = tareasActivasOrdenadas(leerTabla(ss.getSheetByName('Tareas')))
    .slice(0, 25)
    .map(function (t) {
      return {
        id_tarea: t.id_tarea, descripcion: t.descripcion, prioridad: t.prioridad,
        estado: t.estado, fecha_limite: aFechaISO(t.fecha_limite),
        id_cliente: clienteDeProyecto(t.id_proyecto), vencida: esVencida(t.fecha_limite, t.estado)
      };
    });

  // Pendientes de aprobación agrupados por patrón (P1/P2/P3).
  var agg = leerTabla(ss.getSheetByName('Aprobaciones_agregadas'));
  var porPatron = {};
  agg.forEach(function (a) {
    var p = String(a.patron || '—');
    if (!porPatron[p]) porPatron[p] = [];
    porPatron[p].push({
      id: a.id, cliente: a.cliente, descripcion: a.descripcion,
      tipo_accion: a.tipo_accion, monto: a.monto, fecha_creacion: aFechaISO(a.fecha_creacion)
    });
  });

  return { estado: estadoSistema(), avisos: avisos, proximos_pasos: proximos, aprobaciones_por_patron: porPatron };
}

// ── Panel por cliente ───────────────────────────────────────────────────────

/** Lista de clientes para la navegación lateral. */
function listaClientes() {
  return leerTabla(getMaestro().getSheetByName('Clientes')).map(function (c) {
    return { id_cliente: c.id_cliente, nombre: c.nombre, estado: c.estado, rubro: c.rubro };
  });
}

/**
 * Panel completo de un cliente: ficha, proyectos con % avance, próximos pasos,
 * observaciones (Bitácora), widget de consumo API (stub desde Costos_API del
 * Sheet cliente) y ficha de gobernanza.
 */
function datosCliente(idCliente) {
  var ss = getMaestro();
  var cli = leerTabla(ss.getSheetByName('Clientes')).filter(function (c) { return c.id_cliente === idCliente; })[0];
  if (!cli) throw new Error('Cliente no encontrado: ' + idCliente);

  var proyectos = leerTabla(ss.getSheetByName('Proyectos'))
    .filter(function (p) { return p.id_cliente === idCliente; })
    .map(function (p) {
      return {
        id_proyecto: p.id_proyecto, nombre: p.nombre, estado: p.estado,
        avance: p['%_avance'], proximo_hito: p.proximo_hito,
        fecha_objetivo: aFechaISO(p.fecha_objetivo),
        fecha_ultimo_movimiento: aFechaISO(p.fecha_ultimo_movimiento)
      };
    });

  var idsProy = {};
  proyectos.forEach(function (p) { idsProy[p.id_proyecto] = true; });
  var proximos = tareasActivasOrdenadas(leerTabla(ss.getSheetByName('Tareas')))
    .filter(function (t) { return idsProy[t.id_proyecto]; })
    .map(function (t) {
      return {
        id_tarea: t.id_tarea, descripcion: t.descripcion, prioridad: t.prioridad,
        estado: t.estado, fecha_limite: aFechaISO(t.fecha_limite), vencida: esVencida(t.fecha_limite, t.estado)
      };
    });

  var observaciones = leerTabla(ss.getSheetByName('Bitacora'))
    .filter(function (b) { return b.id_cliente === idCliente; })
    .map(function (b) { return { fecha: aFechaISO(b.fecha), observacion: b.observacion, etiqueta: b.etiqueta }; });

  var gobernanza = leerTabla(ss.getSheetByName('Gobernanza'))
    .filter(function (g) { return g.id_cliente === idCliente; })[0] || null;

  return {
    cliente: {
      id_cliente: cli.id_cliente, nombre: cli.nombre, rubro: cli.rubro, estado: cli.estado,
      responsable: cli.responsable_lado_cliente, fecha_alta: aFechaISO(cli.fecha_alta),
      url_sheet_cliente: cli.url_sheet_cliente
    },
    proyectos: proyectos,
    proximos_pasos: proximos,
    observaciones: observaciones,
    consumo_api: consumoApiCliente(cli.url_sheet_cliente),
    gobernanza: gobernanza
  };
}

/**
 * Widget de consumo API (STUB Etapa 1): agrega la pestaña Costos_API del Sheet
 * cliente. Devuelve totales y últimas filas. No estima tokens/USD aún (Etapa 2).
 */
function consumoApiCliente(url) {
  var vacio = { llamadas: 0, tokens_in: 0, tokens_out: 0, usd: 0, por_modulo: {}, ultimas: [], error: '' };
  if (!url) return vacio;
  try {
    var sh = SpreadsheetApp.openByUrl(url).getSheetByName('Costos_API');
    if (!sh) return vacio;
    var filas = leerTabla(sh);
    var tin = 0, tout = 0, usd = 0, porModulo = {};
    filas.forEach(function (f) {
      tin += Number(f.tokens_in) || 0;
      tout += Number(f.tokens_out) || 0;
      usd += Number(f.USD) || 0;
      var m = String(f.modulo || '—');
      porModulo[m] = (porModulo[m] || 0) + 1;
    });
    var ultimas = filas.slice(-5).reverse().map(function (f) {
      return { timestamp: aFechaISO(f.timestamp), modulo: f.modulo, endpoint: f.endpoint, USD: f.USD };
    });
    return { llamadas: filas.length, tokens_in: tin, tokens_out: tout, usd: usd, por_modulo: porModulo, ultimas: ultimas, error: '' };
  } catch (e) {
    return { llamadas: 0, tokens_in: 0, tokens_out: 0, usd: 0, por_modulo: {}, ultimas: [], error: String(e.message) };
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

// PURGA #23: soporte D/E (antes solo A/B/C; D/E caían al peso por defecto).
var PRIORIDAD_PESO = { A: 0, B: 1, C: 2, D: 3, E: 4 };

/** Tareas no terminales, ordenadas por prioridad (A>B>C) y luego fecha_límite. */
function tareasActivasOrdenadas(tareas) {
  return tareas.filter(function (t) {
    return ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) < 0;
  }).sort(function (a, b) {
    var pa = PRIORIDAD_PESO[String(a.prioridad).toUpperCase()]; if (pa === undefined) pa = 9;
    var pb = PRIORIDAD_PESO[String(b.prioridad).toUpperCase()]; if (pb === undefined) pb = 9;
    if (pa !== pb) return pa - pb;
    var fa = aFechaISO(a.fecha_limite) || '9999-12-31';
    var fb = aFechaISO(b.fecha_limite) || '9999-12-31';
    return fa < fb ? -1 : (fa > fb ? 1 : 0);
  });
}

/** ¿Tarea vencida? (fecha_límite pasada y estado no terminal). */
function esVencida(fechaLimite, estado) {
  var term = ['hecha', 'cancelada', 'completada'].indexOf(String(estado).toLowerCase()) >= 0;
  var fl = aFechaISO(fechaLimite);
  return !term && !!fl && fl < hoyISO();
}

// ── Centro de Mando (ETAPA 2 · capa Trillion) ───────────────────────────────

/**
 * Estado del Centro de Mando: agentes con estado real de la cola, feed de Actividad,
 * presupuesto, inbox de aprobaciones y clientes activos para disparar. Solo datos.
 */
function estadoAgentes() {
  var estados = estadosAgentesCola_(); // una sola lectura de la cola para los 13
  var agentes = Object.keys(AGENTES).map(function (k) {
    var a = AGENTES[k];
    return { clave: k, nombre: a.nombre, rol: a.rol, activo: a.activo, gate: a.gate, estado: estados[k] || 'idle' };
  });
  var c = filaConsumoAgentes_();
  return {
    agentes: agentes,
    feed: feedReciente_(30),
    presupuesto: { gastoUsd: c.gasto, topeUsd: budgetMensualUSD_() },
    aprobaciones: inboxAprobaciones_(),
    clientes_activos: listaClientes().filter(function (x) {
      return ['activo', 'activo-piloto'].indexOf(String(x.estado).toLowerCase()) >= 0;
    }),
    ts: aHoraLegible_(ahoraISO())
  };
}

/**
 * Mapa clave_agente → estado derivado de la cola, en UNA sola lectura (antes:
 * 13 lecturas por refresh, ×cada 5 s). work si tiene tarea viva; ok/fail según la última.
 */
function estadosAgentesCola_() {
  var out = {};
  var sh = getMaestro().getSheetByName('Cola_tareas');
  if (!sh || sh.getLastRow() < 2) return out;
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var iTipo = H.indexOf('tipo'), iPayload = H.indexOf('payload'), iEstado = H.indexOf('estado');
  var n = sh.getLastRow(), desde = Math.max(2, n - 200);
  var datos = sh.getRange(desde, 1, n - desde + 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < datos.length; i++) { // en orden: la última fila de cada agente gana
    if (String(datos[i][iTipo]) !== 'agente') continue;
    var p = parsearPayload_(datos[i][iPayload]);
    if (!p.agente) continue;
    var e = String(datos[i][iEstado]);
    out[p.agente] = (e === 'tomada' || e === 'pendiente') ? 'work'
                  : (e === 'completada') ? 'ok'
                  : (e === 'fallida') ? 'fail' : (out[p.agente] || 'idle');
  }
  return out;
}

/** Últimos N eventos del feed Actividad (más nuevos primero). XSS lo maneja el front (textContent). */
function feedReciente_(cuantos) {
  var sh = getMaestro().getSheetByName('Actividad');
  if (!sh || sh.getLastRow() < 2) return [];
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var ix = {}; H.forEach(function (h, i) { ix[h] = i; });
  var n = sh.getLastRow(), desde = Math.max(2, n - cuantos + 1);
  return sh.getRange(desde, 1, n - desde + 1, sh.getLastColumn()).getValues().map(function (f) {
    return {
      ts: aHoraLegible_(f[ix.ts]), agente: String(f[ix.agente]), tipo: String(f[ix.tipo]),
      id_cliente: String(f[ix.id_cliente] || ''), texto: String(f[ix.texto]).replace(/^'/, ''),
      tarea_id: String(f[ix.tarea_id] || ''), aprobacion_id: String(f[ix.aprobacion_id] || '')
    };
  }).reverse();
}

/** Inbox de aprobaciones pendientes (espejo agregado del MAESTRO). */
function inboxAprobaciones_() {
  return leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas')).map(function (a) {
    return {
      id: a.id, id_cliente: a.id_cliente, cliente: a.cliente, modulo: a.modulo, patron: a.patron,
      tipo_accion: a.tipo_accion, descripcion: a.descripcion, payload: a.payload, monto: a.monto,
      fecha_creacion: aFechaISO(a.fecha_creacion)
    };
  });
}

/** Dispara un agente para un cliente desde la UI (encola + drena para feedback inmediato). */
function dispararAgenteUI(idCliente, clave) {
  var r = encolarAgente(idCliente, clave, {});
  drenarCola();
  return r;
}

/** Resuelve una aprobación desde la UI (único punto de decisión: resolverAprobacion). */
function resolverAprobacionUI(idCliente, id, decision, ediciones) {
  return resolverAprobacion(idCliente, id, decision, ediciones || {});
}

/** 'yyyy-MM-ddTHH:mm:ss' → 'YYYY-MM-DD HH:mm' (legible). Acepta Date o string. */
function aHoraLegible_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm');
  }
  return String(v).replace('T', ' ').substring(0, 16);
}
