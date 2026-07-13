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
  if (!owner || who !== owner) {   // PURGA #4: fail-closed — exige OWNER_EMAIL (sin él, nadie entra)
    // PURGA #1: diagnóstico de lockout (efímero, no spamea la hoja) — qué email se detectó vs owner
    try { Logger.log('doGet bloqueado: who=' + (who || '(vacío)') + ' owner=' + (owner || '(no seteado)')); } catch (_lg) {}
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
    try { body = JSON.parse(raw || '{}'); } catch (_p) { vozRechazo_('bad_json'); return vozOut_({ ok: false, error: 'bad_json' }); }
    if (!vozAuth_(body.secret)) { vozRechazo_('unauthorized'); return vozOut_({ ok: false, error: 'unauthorized' }); } // fail-closed + alerta
    if (!vozRate_()) return vozOut_({ ok: false, error: 'rate_limit' });                 // PURGA #3: 30/min (el agente legítimo PUEDE gatillarlo → NO alerta)
    tool = String(body.tool || '');
    if (!VOZ_TOOLS[tool]) { vozRechazo_('unknown_tool'); return vozOut_({ ok: false, error: 'unknown_tool' }); }       // post-auth anómalo (tiene el secreto) → alerta
    // PURGA B5 #7 (decisión Luciano): en PAUSA se congela TODO el canal de voz — lecturas incluidas
    // (cliente/cerebro exponen estado/PII de cualquier tenant), no solo 'capturar'. Máxima contención.
    if (_sistemaPausado_()) return vozOut_({ ok: false, error: 'sistema_en_pausa', pausado: true });
    var args = (body.args && typeof body.args === 'object') ? body.args : {};
    var id = vozStr_(args.idCliente, 24);
    if (id && !clienteExiste_(id)) return vozOut_({ ok: false, error: 'cliente_desconocido' }); // PURGA #5: roster (el agente puede errar el id → NO alerta)
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

/** Comparación en tiempo constante vía digests de largo fijo (PURGA #6: no filtra el largo del secreto). */
function ctEq_(a, b) {
  var ha = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(a), Utilities.Charset.UTF_8);
  var hb = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(b), Utilities.Charset.UTF_8);
  var diff = 0;
  for (var i = 0; i < ha.length; i++) diff |= (ha[i] ^ hb[i]);
  return diff === 0;
}

/** Sanea/trunca texto del agente (todo input externo es hostil). */
function vozStr_(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }

/** PURGA #7: log de cada llamada a la hoja Voz_log (detección persistente, no efímera). */
function vozLog_(tool, ok, err) {
  try {
    var ss = getMaestro();
    var sh = ss.getSheetByName('Voz_log');
    if (!sh) { sh = ss.insertSheet('Voz_log'); sh.appendRow(['ts', 'tool', 'ok', 'err']); }
    sh.appendRow([ahoraISO(), String(tool), ok, String(err || '').slice(0, 300)]);
  } catch (_l) { try { Logger.log('voz ' + tool + ' ok=' + ok + ' ' + (err || '')); } catch (_e) {} }
}

/** PURGA #3: rate-limit por ventana de 1 min (CacheService). Si Cache falla, no bloquea. */
function vozRate_() {
  try {
    var c = CacheService.getScriptCache();
    var k = 'voz_rate_' + Math.floor(Date.now() / 60000);
    var n = (parseInt(c.get(k), 10) || 0) + 1;
    c.put(k, String(n), 120);
    return n <= 30;
  } catch (_r) { return true; }
}

/** PURGA #5: ¿el idCliente existe en el roster Clientes? Valida el input del agente. */
function clienteExiste_(id) {
  try {
    return leerTabla(getMaestro().getSheetByName('Clientes')).some(function (c) { return String(c.id_cliente) === id; });
  } catch (_c) { return false; }
}

/**
 * PURGA #8 (Centinela): registra un rechazo de seguridad y AVISA al primero del día.
 * Umbral mínimo (≥1 intento) + 1 aviso/día (dedupe por `voz_alerta_fecha`) para no floodear.
 * Solo lo llaman los rechazos que el agente legítimo NUNCA produce (no tiene/no manda el secreto,
 * o tool fuera de whitelist). Forense completo en Ejecuciones (Logger); 1 fila/día en Voz_log.
 */
function vozRechazo_(motivo) {
  try {
    Logger.log('voz RECHAZO ' + motivo);                         // forense (Ejecuciones), siempre, sin escribir hoja
    var props = PropertiesService.getScriptProperties();
    var hoy = hoyISO();
    if (props.getProperty('voz_alerta_fecha') === hoy) return;   // ya avisé hoy → corto (anti-flood)
    props.setProperty('voz_alerta_fecha', hoy);
    vozLog_('RECHAZO:' + motivo, false, 'primer rechazo del día');
    crearAviso({ origen: 'voz', tipo: 'voz_acceso_no_autorizado',
      mensaje: 'Voz: rechazo de seguridad en el tool-backend hoy (' + motivo + '). Revisá Voz_log; si no fuiste vos, rotá VOZ_TOOL_SECRET.' });
  } catch (_x) {}
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

  var activas = tareasActivasOrdenadas(leerTabla(ss.getSheetByName('Tareas')));
  // Tareas-v2 F1.1: conteos de CONTEXTO para la card Tareas del CM (el "checklist de hoy" real =
  // vence hoy o ya vencida; los tipos vienen de la columna nueva). Campo aditivo: no cambia el shape viejo.
  var hoyCtx = hoyISO();
  var tareasCtx = { hoy: 0, clientes: 0, periodicas: 0, en_curso: 0, abiertas: activas.length };
  activas.forEach(function (t) {
    var fl = aFechaISO(t.fecha_limite);
    if (fl && fl <= hoyCtx) tareasCtx.hoy++;
    var tp = String(t.tipo || '').toLowerCase();
    if (tp === 'cliente') tareasCtx.clientes++;
    if (tp === 'periodica') tareasCtx.periodicas++;
    if (String(t.estado).toLowerCase() === 'en_curso') tareasCtx.en_curso++;
  });
  var proximos = activas
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

  return { estado: estadoSistema(), avisos: avisos, proximos_pasos: proximos, aprobaciones_por_patron: porPatron, tareas_ctx: tareasCtx };
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
  // v11 (07-jul): actividad de HOY por agente desde la MISMA lectura de cola (sin I/O extra).
  // Alimenta la barra "Hoy" del roster; NO hay dato de entrenamiento hasta E8b (no se inventa).
  var hoyI = hoyISO(), hoyAg = {}, encoladasHoy = 0, completadasHoy = 0;
  cola.forEach(function (r) {
    if (String(r.tipo) !== 'agente') return;
    if (aFechaISO(r.creada_en) !== hoyI) return;
    var p = parsearPayload_(r.payload);
    if (!p.agente) return;
    var h = hoyAg[p.agente] || (hoyAg[p.agente] = { total: 0, ok: 0 });
    h.total++; encoladasHoy++;
    if (String(r.estado) === 'completada') { h.ok++; completadasHoy++; }
  });
  var feed = feedReciente_(30);
  var ultimoDe = {}; // primer item del feed (ya viene reverse = más nuevo) por nombre de agente
  feed.forEach(function (f) { var n = String(f.agente || ''); if (n && !ultimoDe[n]) ultimoDe[n] = String(f.texto || ''); });
  // E1.1: avatar_url por agente desde Config (una sola lectura). Vacío => el CM cae al placeholder.
  var avatares = configPrefijo_('avatar_');
  var agentes = Object.keys(AGENTES).map(function (k) {
    var a = AGENTES[k];
    return { clave: k, nombre: a.nombre, rol: a.rol, activo: a.activo, gate: a.gate, estado: estados[k] || 'idle',
             hoy: hoyAg[k] || { total: 0, ok: 0 }, ultimo: ultimoDe[a.nombre] || '', avatar_url: avatares[k] || '' };
  });
  // Director (orquestador, no vive en AGENTES): carga real = encoladas de hoy en la cola.
  agentes.push({ clave: 'director', nombre: 'Director', rol: 'Orquestación', activo: true, gate: false,
                 estado: (encoladasHoy > completadasHoy) ? 'work' : (encoladasHoy > 0 ? 'ok' : 'idle'),
                 hoy: { total: encoladasHoy, ok: completadasHoy }, ultimo: ultimoDe['Director'] || '',
                 avatar_url: avatares['director'] || '' });
  var c = filaConsumoAgentes_();   // PURGA #2: Consumo una sola vez (gasto)
  var tope = budgetMensualUSD_();  // PURGA #2: tope una sola vez
  return {
    agentes: agentes,
    feed: feed,
    // E1.1: URLs de servicios locales que el CM abre. voz_url cae al hardcode histórico si Config
    // aún no se sembró; oficina_url va CRUDA (vacía => el CM oculta el botón, por diseño B1).
    cfg: { voz_url: getConfig('voz_url') || 'http://127.0.0.1:8787', oficina_url: getConfig('oficina_url') },
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
  var res = resolverAprobacion(idCliente, id, decision, ediciones || {});
  // Reflejo inmediato (08-jul): el espejo agregado es "pendientes only"; una resuelta
  // sale YA, sin esperar al próximo syncMaestro (antes reaparecía en el CM al recargar).
  if (res && res.ok) { try { quitarAgregada_(id); } catch (e) { /* la resolución ya quedó; el próximo sync la limpia */ } }
  return res;
}

/** Quita una aprobación del espejo agregado por id (consistente con syncMaestro = pendientes only). */
function quitarAgregada_(id) {
  var sh = getMaestro().getSheetByName('Aprobaciones_agregadas');
  if (!sh || sh.getLastRow() < 2) return;
  conLock(function () {
    var m = sh.getDataRange().getValues();
    var ic = m[0].indexOf('id');
    if (ic < 0) return;
    for (var r = m.length - 1; r >= 1; r--) {
      if (String(m[r][ic]) === String(id)) sh.deleteRow(r + 1);
    }
  });
}

// ── Tablero de tareas (kanban del Command Center · B4) ───────────────────────

/**
 * Whitelist de ESCRITURA del kanban (riel 1). Solo estos literales se pueden setear
 * por drag&drop. 'cancelada'/'completada' NO se setean por drag (semántica aparte):
 * la columna de cierre AGRUPA los 3 terminales en LECTURA, pero al cerrar se escribe 'hecha'.
 */
var ESTADOS_TAREA_UI = ['pendiente', 'en_curso', 'hecha'];
var TERMINALES_TAREA = ['hecha', 'completada', 'cancelada'];

/** Tablero completo de tareas del MAESTRO para el kanban (solo lectura). */
function tableroTareas() {
  var ss = getMaestro();
  return leerTabla(ss.getSheetByName('Tareas')).map(function (t) {
    var est = String(t.estado || '').toLowerCase();
    // riel: en lectura, los 3 terminales caen en el carril 'hecha'
    var carril = (TERMINALES_TAREA.indexOf(est) >= 0) ? 'hecha' : (est === 'en_curso' ? 'en_curso' : 'pendiente');
    return {
      id_tarea: t.id_tarea, descripcion: t.descripcion, prioridad: t.prioridad,
      estado: est, carril: carril, fecha_limite: aFechaISO(t.fecha_limite),
      id_cliente: clienteDeProyecto(t.id_proyecto), vencida: esVencida(t.fecha_limite, t.estado),
      // Tareas-v2 F1: contexto + recurrencia para chips/filtros del board
      tipo: String(t.tipo || '').toLowerCase(), etiquetas: String(t.etiquetas || ''), recurrencia: String(t.recurrencia || '').toLowerCase()
    };
  });
}

// ── Tareas-v2 F1 (07-jul, docs/TRELLO-a-Satori-mapeo.md §6) — alta rápida + recurrencia ──

var TAREA_TIPOS = ['cliente', 'periodica', 'objetivo', 'personal', 'admin'];
var TAREA_RECS = ['1d', '1s', '2s', '1m'];

/** PURA (testeable): suma n días a un ISO YYYY-MM-DD. */
function sumarDiasISO_(iso, n) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  var dt = new Date(+m[1], +m[2] - 1, +m[3] + n);
  return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
}

/**
 * PURA: próxima fecha de una regla de recurrencia desde una base.
 * 1d=+1día · 1s=+7 · 2s=+14 · 1m=+1 mes calendario (clampa fin de mes: 31/01→28/02).
 */
function parseRecurrencia(rec, baseISO) {
  var r = String(rec || '').trim().toLowerCase();
  var m = String(baseISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || TAREA_RECS.indexOf(r) < 0) return '';
  if (r === '1d') return sumarDiasISO_(baseISO, 1);
  if (r === '1s') return sumarDiasISO_(baseISO, 7);
  if (r === '2s') return sumarDiasISO_(baseISO, 14);
  var y = +m[1], mo = +m[2] - 1, d = +m[3];
  var dt = new Date(y, mo + 1, d);
  if (dt.getMonth() !== (mo + 1) % 12) dt = new Date(y, mo + 2, 0); // se pasó de mes → último día del mes destino
  return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
}

/**
 * PURA: parsea el quick-add del board con sigilos. hoyBase opcional (inyectable en tests).
 *   !a/!b/!c → prioridad · #etiqueta (multi) · @cliente → cliente_txt · ^tipo → override
 *   "hoy" | "mañana" | dd/mm → fecha_limite · "cada dia|semana|quincena|mes" → recurrencia
 * Heurística de tipo si no hay ^override: @cliente→'cliente' · recurrencia→'periodica' · resto 'personal'.
 */
function parseQuickAdd(str, hoyBase) {
  var hoy = /^\d{4}-\d{2}-\d{2}$/.test(String(hoyBase || '')) ? String(hoyBase) : hoyISO();
  var out = { descripcion: '', prioridad: 'B', tipo: '', etiquetas: [], cliente_txt: '', fecha_limite: '', recurrencia: '' };
  var s = String(str || '').trim();
  if (!s) return out;
  s = s.replace(/\bcada\s+d[ií]a\b/i, function () { out.recurrencia = '1d'; return ' '; });
  s = s.replace(/\bcada\s+semana\b/i, function () { out.recurrencia = '1s'; return ' '; });
  s = s.replace(/\bcada\s+quincena\b/i, function () { out.recurrencia = '2s'; return ' '; });
  s = s.replace(/\bcada\s+mes\b/i, function () { out.recurrencia = '1m'; return ' '; });
  s = s.replace(/(^|\s)!([abc])\b/i, function (_, sp, p) { out.prioridad = p.toUpperCase(); return sp; });
  s = s.replace(/(^|\s)#([\wáéíóúñ-]+)/gi, function (_, sp, e) { out.etiquetas.push(e.toLowerCase()); return sp; });
  s = s.replace(/(^|\s)@([\wáéíóúñ-]+)/i, function (_, sp, c) { out.cliente_txt = c.toLowerCase(); return sp; });
  s = s.replace(/(^|\s)\^(cliente|periodica|objetivo|personal|admin)\b/i, function (_, sp, t) { out.tipo = t.toLowerCase(); return sp; });
  s = s.replace(/(^|\s)hoy\b/i, function (_, sp) { out.fecha_limite = hoy; return sp; });
  s = s.replace(/(^|\s)ma[ñn]ana\b/i, function (_, sp) { out.fecha_limite = sumarDiasISO_(hoy, 1); return sp; });
  s = s.replace(/(^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/, function (_, sp, dd, mm) {
    var f = hoy.slice(0, 4) + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2);
    if (f < hoy) f = (+hoy.slice(0, 4) + 1) + f.slice(4); // ya pasó este año → el próximo
    out.fecha_limite = f; return sp;
  });
  if (!out.tipo) out.tipo = out.cliente_txt ? 'cliente' : (out.recurrencia ? 'periodica' : 'personal');
  out.descripcion = s.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * Alta de tarea (board/editor/bridge Bandeja futuro). payload: {descripcion*, prioridad, tipo,
 * etiquetas (array|CSV), recurrencia, fecha_limite, id_proyecto}. Valida contra whitelists,
 * nunca inventa cliente: si cliente_txt no matchea un cliente real, queda como etiqueta visible.
 */
function crearTarea(payload) {
  var p = payload || {};
  var desc = String(p.descripcion || '').trim();
  if (!desc) throw new Error('crearTarea: falta la descripción.');
  var sh = getMaestro().getSheetByName('Tareas');
  if (!sh) throw new Error('Falta la pestaña Tareas — correr setup().');
  var tipo = String(p.tipo || '').toLowerCase(); if (TAREA_TIPOS.indexOf(tipo) < 0) tipo = '';
  var pri = String(p.prioridad || 'B').toUpperCase(); if (['A', 'B', 'C'].indexOf(pri) < 0) pri = 'B';
  var rec = String(p.recurrencia || '').toLowerCase(); if (TAREA_RECS.indexOf(rec) < 0) rec = '';
  var fl = aFechaISO(p.fecha_limite) || '';
  var ets = p.etiquetas || [];
  if (typeof ets === 'string') ets = ets.split(',');
  ets = ets.map(function (e) { return String(e).trim().toLowerCase(); }).filter(String).slice(0, 6);
  var idProy = String(p.id_proyecto || '');
  return conLock(function () {
    var id = nextId(sh, 'id_tarea', 'TAR', 4);
    appendFila(sh, {
      id_tarea: id, id_proyecto: idProy, descripcion: desc, prioridad: pri, estado: 'pendiente',
      fecha_limite: fl, fecha_creacion: hoyISO(), tipo: tipo, etiquetas: ets.join(','), recurrencia: rec, orden: ''
    });
    try { feed_('Director', 'accion', clienteDeProyecto(idProy), 'Tarea creada desde el board: ' + id + ' · ' + desc.slice(0, 80), id, ''); } catch (e) {}
    return { id_tarea: id, descripcion: desc, prioridad: pri, tipo: tipo, recurrencia: rec, fecha_limite: fl };
  });
}

/** CM: quick-add del board — parsea sigilos y crea. @cliente intenta matchear Clientes (por nombre). */
function crearTareaQuick(str) {
  var q = parseQuickAdd(str);
  if (!q.descripcion) throw new Error('Escribí la tarea (los sigilos solos no alcanzan).');
  if (q.cliente_txt) {
    var hit = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
      return String(c.nombre).toLowerCase().indexOf(q.cliente_txt) >= 0;
    })[0];
    // Fase 1: sin proyecto activo por cliente todavía → el vínculo visible queda como etiqueta.
    q.etiquetas.push(hit ? String(hit.nombre).toLowerCase().split(' ')[0] : q.cliente_txt);
  }
  var r = crearTarea(q);
  r.parsed = { tipo: q.tipo, prioridad: q.prioridad, fecha_limite: q.fecha_limite, recurrencia: q.recurrencia, etiquetas: q.etiquetas };
  return r;
}

/**
 * Mueve una tarea a un estado destino desde el kanban del CM. Reglas duras (03-jul):
 *  (1) whitelist de escritura = ESTADOS_TAREA_UI (valida id destino);
 *  (2) valida que la tarea exista y escribe SOLO la columna estado (nunca borra ni toca otras);
 *  (3) loguea el cambio en Actividad (quién/qué/cuándo) — auditabilidad.
 * AREL: interno + reversible = avanzar (sin gate).
 */
function moverTarea(idTarea, estadoDestino) {
  estadoDestino = String(estadoDestino || '').toLowerCase();
  if (ESTADOS_TAREA_UI.indexOf(estadoDestino) < 0) throw new Error('Estado destino no permitido: ' + estadoDestino);
  var sh = getMaestro().getSheetByName('Tareas');
  if (!sh) throw new Error('No existe la pestaña Tareas');
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var cId = H.indexOf('id_tarea'), cEst = H.indexOf('estado'), cProy = H.indexOf('id_proyecto');
  if (cId < 0 || cEst < 0) throw new Error('Schema Tareas sin columnas id_tarea/estado');
  var n = sh.getLastRow();
  if (n < 2) throw new Error('Sin tareas');
  var filas = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
  var fila = -1, previo = '', idProy = '';
  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][cId]) === String(idTarea)) { fila = i + 2; previo = String(filas[i][cEst]); idProy = cProy >= 0 ? filas[i][cProy] : ''; break; }
  }
  if (fila < 0) throw new Error('Tarea no encontrada: ' + idTarea);
  if (String(previo).toLowerCase() === estadoDestino) return { id_tarea: idTarea, estado: estadoDestino, previo: previo, sin_cambio: true };
  sh.getRange(fila, cEst + 1).setValue(estadoDestino);   // riel 2: SOLO la columna estado
  try { feed_('Director', 'accion', clienteDeProyecto(idProy), 'Tarea ' + idTarea + ': ' + (previo || '—') + ' → ' + estadoDestino + ' (kanban CM)', idTarea, ''); } catch (e) {}
  // Tareas-v2 F1: recurrencia — al COMPLETAR ('hecha') una tarea con regla, renace 1 clon
  // pendiente con la próxima fecha (base = HOY, estilo "after completion"). Guards: nunca en
  // 'cancelada' (no entra por el kanban: whitelist ESTADOS_TAREA_UI) · no-op ya cortó arriba ·
  // dedupe si ya hay una viva idéntica (evita doble clon por re-drag hecha→pendiente→hecha) ·
  // el clon JAMÁS rompe el drag (try/catch).
  var renace = '';
  if (estadoDestino === 'hecha') {
    try {
      var cRec = H.indexOf('recurrencia');
      var rec = cRec >= 0 ? String(filas[fila - 2][cRec] || '').toLowerCase() : '';
      if (rec && TAREA_RECS.indexOf(rec) >= 0) {
        var descV = String(filas[fila - 2][H.indexOf('descripcion')] || '');
        var yaViva = leerTabla(sh).some(function (f) {
          return String(f.descripcion) === descV &&
                 String(f.recurrencia || '').toLowerCase() === rec &&
                 TERMINALES_TAREA.indexOf(String(f.estado).toLowerCase()) < 0;
        });
        if (!yaViva) {
          var cTip = H.indexOf('tipo'), cEt = H.indexOf('etiquetas');
          var clon = crearTarea({
            descripcion: descV, prioridad: filas[fila - 2][H.indexOf('prioridad')],
            tipo: cTip >= 0 ? filas[fila - 2][cTip] : '', etiquetas: cEt >= 0 ? String(filas[fila - 2][cEt] || '') : '',
            recurrencia: rec, fecha_limite: parseRecurrencia(rec, hoyISO()), id_proyecto: idProy
          });
          renace = clon.id_tarea;
        }
      }
    } catch (e) { /* recurrencia nunca bloquea el tablero */ }
  }
  return { id_tarea: idTarea, estado: estadoDestino, previo: previo, renace: renace };
}

/** 'yyyy-MM-ddTHH:mm:ss' → 'YYYY-MM-DD HH:mm' (legible). Acepta Date o string. */
function aHoraLegible_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm');
  }
  return String(v).replace('T', ' ').substring(0, 16);
}
