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
function doGet(e) {
  // PURGA #9: sin ALLOWALL — XFrameOptions por defecto (no embebible por terceros).
  // VOZ/Bastión: este código corre TAMBIÉN en el deployment "cualquiera" del tool-backend
  // (doPost). En ese deployment público un GET anónimo NO debe servir la shell del cerebro.
  // Gate por identidad: sirve la UI solo a un email del dominio; el visitante anónimo del
  // deploy público trae getActiveUser().getEmail() vacío → corte.
  // ⚠ RIESGO DE LOCKOUT: si getEmail() viniera vacío para Luciano en su propio deployment,
  // lo dejaría afuera. PROBAR en el deployment de la UI ANTES de confiar; revertir con git si corta.
  // OWNER_EMAIL (Script Properties) afina el match exacto; si falta, basta con email no vacío.
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (_e) { who = ''; }
  var owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || '';
  if (!who || (owner && who !== owner)) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><title>Satori OS</title>' +
      '<p style="font:16px system-ui;padding:2rem">No autorizado.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Satori OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── VOZ — tool-backend (doPost) · BLUEPRINT voz/§3 ───────────────────────────
/**
 * doPost(e) — tool-backend HTTPS del agente de Voz (LiveKit). Va en un deployment
 * DEDICADO "cualquiera", SEPARADO del de la UI (no tocar el de la UI: riesgo lockout).
 * Auth: secreto compartido en el BODY (GAS no entrega headers de forma fiable en deploy
 * público) validado en tiempo ~constante; fail-closed si no hay secreto seteado.
 * Router whitelist a funciones existentes (cero reinvención). Least-privilege: solo lectura
 * + capturar — nada de aprobaciones / email / borrados por este canal. Responde JSON.
 */
var VOZ_TOOLS = { estado: 1, brief: 1, vehemence: 1, cliente: 1, cerebro: 1, capturar: 1 };

function doPost(e) {
  var tool = '';
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var body;
    try { body = JSON.parse(raw || '{}'); } catch (_p) { return vozOut_({ ok: false, error: 'bad_json' }); }
    if (!vozAuth_(body.secret)) return vozOut_({ ok: false, error: 'unauthorized' });   // secreto en body, fail-closed
    tool = String(body.tool || '');
    if (!VOZ_TOOLS[tool]) return vozOut_({ ok: false, error: 'unknown_tool' });          // whitelist (sin eval/dispatch dinámico)
    var args = (body.args && typeof body.args === 'object') ? body.args : {};
    var id = vozStr_(args.idCliente, 24);
    var data;
    switch (tool) {
      case 'estado':    data = estadoVigente(id || undefined); break;
      case 'brief':     data = briefDiario(id || undefined); break;
      case 'vehemence': data = estadoVigente('CLI-002'); break;   // verVehemence() solo loguea → acá devolvemos el dato
      case 'cliente':   if (!id) return vozOut_({ ok: false, error: 'falta_idCliente' }); data = datosCliente(id); break;
      case 'cerebro':   if (!id) return vozOut_({ ok: false, error: 'falta_idCliente' }); data = leerEstado(id); break;
      case 'capturar':  data = capturar(vozStr_(args.texto, 4000), 'voz'); break;
    }
    vozLog_(tool, true, '');
    return vozOut_({ ok: true, tool: tool, data: data });
  } catch (err) {
    vozLog_(tool, false, String((err && err.message) || err));    // detección; afuera error genérico (no filtra stack/PII)
    return vozOut_({ ok: false, error: 'error_interno' });
  }
}

/** Salida JSON estándar del tool-backend. */
function vozOut_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Valida el secreto compartido (Script Properties: VOZ_TOOL_SECRET). Fail-closed si no está seteado. */
function vozAuth_(secret) {
  var k = PropertiesService.getScriptProperties().getProperty('VOZ_TOOL_SECRET');
  if (!k) return false;
  return ctEq_(String(secret == null ? '' : secret), String(k));
}

/** Comparación de strings en tiempo ~constante (mitiga timing-attack sobre el secreto). */
function ctEq_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return diff === 0;
}

/** Sanea/trunca texto del agente (todo input externo es hostil). */
function vozStr_(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }

/** Log liviano de cada llamada (Centinela). Va al transcript de Ejecuciones; sin PII pesada. */
function vozLog_(tool, ok, err) {
  try { Logger.log('voz doPost tool=' + tool + ' ok=' + ok + (err ? ' err=' + err : '')); } catch (_l) {}
}

/**
 * Preferencias de presentación de la UI (cliente → backend). Whitelist ESTRICTA: solo claves
 * cosméticas, nunca config sensible. Bastión: todo input del cliente es hostil (validar+tipar).
 */
var PREFS_UI_OK = ['orbe_calidad'];
function setPrefUI(clave, valor) {
  clave = String(clave || '');
  valor = String(valor || '').slice(0, 40);
  if (PREFS_UI_OK.indexOf(clave) < 0) throw new Error('preferencia no permitida');
  setConfig(clave, valor);
  return { ok: true };
}
/** Lee las preferencias de UI (default seguro si faltan). */
function prefsUI() {
  return { orbe_calidad: getConfig('orbe_calidad') || 'alto' };
}

/**
 * CEREBRO → ORBE: grafo del cerebro de un cliente para visualizarlo en el orbe 3D.
 * Estructura SIN PII: por nodo solo dimensión (líder/negocio/sistema) + flag de alerta
 * (cobertura < 40 = punto ciego); aristas como pares de índices. Nunca etiquetas/atributos.
 */
function cerebroGrafo(idCliente) {
  try {
    var ss = abrirCliente(idCliente).ss;
    var nodos = leerTabla(ss.getSheetByName('nodos')) || [];
    var aristas = leerTabla(ss.getSheetByName('aristas')) || [];
    var idx = {}, outN = [];
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i]; idx[String(n.id_nodo)] = i;
      var cob = parseFloat(n.cobertura);
      outN.push({ dim: String(n.dimension || 'negocio'), alert: (!isNaN(cob) && cob < 40) });
    }
    var outA = [];
    for (var j = 0; j < aristas.length; j++) {
      var o = idx[String(aristas[j].origen)], d = idx[String(aristas[j].destino)];
      if (o != null && d != null) outA.push([o, d]);
    }
    return { nodos: outN, aristas: outA };
  } catch (e) { return { nodos: [], aristas: [] }; } // sin cerebro → orbe decorativo
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
  // PURGA #2: una sola lectura de la cola, reusada por estados de agentes + telemetría (errores).
  var colaSh = getMaestro().getSheetByName('Cola_tareas');
  var cola = colaSh ? leerTabla(colaSh) : [];
  var estados = estadosAgentesCola_(cola);
  var agentes = Object.keys(AGENTES).map(function (k) {
    var a = AGENTES[k];
    return { clave: k, nombre: a.nombre, rol: a.rol, activo: a.activo, gate: a.gate, estado: estados[k] || 'idle' };
  });
  var c = filaConsumoAgentes_();   // PURGA #2: Consumo una sola vez (gasto)
  var tope = budgetMensualUSD_();  // PURGA #2: tope una sola vez
  return {
    agentes: agentes,
    feed: feedReciente_(30),
    presupuesto: { gastoUsd: c.gasto, topeUsd: tope },
    aprobaciones: inboxAprobaciones_(),
    clientes_activos: listaClientes().filter(function (x) {
      return ['activo', 'activo-piloto'].indexOf(String(x.estado).toLowerCase()) >= 0;
    }),
    telemetria: telemetriaMaestro_(c, cola, tope),
    ts: aHoraLegible_(ahoraISO())
  };
}

/**
 * Telemetría del MAESTRO para la tira del Command Center (E8a4): llamadas/tokens/gasto del
 * mes (Costos_API_consolidado) + errores (cola fallida). Solo lecturas baratas del MAESTRO.
 */
function telemetriaMaestro_(c, cola, tope) {
  var ss = getMaestro();
  var mes = mesISO();
  // PURGA #2: reusa lo ya leído por estadoAgentes; fallback a lectura propia si se llama suelta.
  if (!c) c = filaConsumoAgentes_();
  if (!cola) { var csh = ss.getSheetByName('Cola_tareas'); cola = csh ? leerTabla(csh) : []; }
  if (tope === undefined || tope === null) tope = budgetMensualUSD_();
  // Gasto LIVE (Consumo_agentes, igual que el budget bar). Llamadas/tokens del consolidado
  // MAESTRO — el crudo Costos_API es por-cliente; el consolidado lo refresca la corrida diaria.
  var llamadas = 0, tokens = 0;
  leerTabla(ss.getSheetByName('Costos_API_consolidado')).forEach(function (f) {
    if (String(f.mes) !== mes) return;
    llamadas += Number(f.llamadas) || 0; tokens += Number(f.tokens) || 0;
  });
  var errores = cola.filter(function (f) { return String(f.estado) === 'fallida'; }).length;
  return { llamadas: llamadas, tokens: tokens, gasto_usd: c.gasto, tope_usd: tope, errores: errores };
}

/**
 * Estado de Salud para el panel del Command Center (E8a4): los 6 chequeos + integridad%.
 * dryRun → NO escribe a producción (no ensucia feed/avisos en cada refresh de la UI).
 */
function estadoSalud() {
  var s = correrSalud({ dryRun: true });
  var ok = s.hallazgos.filter(function (h) { return h.estado === 'ok'; }).length;
  return {
    global: s.global,
    integridad: s.hallazgos.length ? Math.round(ok / s.hallazgos.length * 100) : 100,
    hallazgos: s.hallazgos,
    ts: aHoraLegible_(ahoraISO())
  };
}

/**
 * Mapa clave_agente → estado derivado de la cola, en UNA sola lectura (antes:
 * 13 lecturas por refresh, ×cada 5 s). work si tiene tarea viva; ok/fail según la última.
 */
function estadosAgentesCola_(rows) {
  var out = {};
  // PURGA #2: recibe las filas ya leídas por estadoAgentes; fallback a leer si se llama suelta.
  if (!rows) { var sh = getMaestro().getSheetByName('Cola_tareas'); rows = sh ? leerTabla(sh) : []; }
  rows.forEach(function (r) { // en orden de Sheet: la última fila de cada agente gana
    if (String(r.tipo) !== 'agente') return;
    var p = parsearPayload_(r.payload);
    if (!p.agente) return;
    var e = String(r.estado);
    out[p.agente] = (e === 'tomada' || e === 'pendiente') ? 'work'
                  : (e === 'completada') ? 'ok'
                  : (e === 'fallida') ? 'fail' : (out[p.agente] || 'idle');
  });
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
