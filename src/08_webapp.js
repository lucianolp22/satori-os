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
  // T3-S1: el criterio vive UNA sola vez, en _puertaOwner_ (22_seguridad.js) — el mismo que
  // usan los endpoints de google.script.run. Acá no se re-escribe el nombre de la property.
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (_e) { who = ''; }
  var owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || '';
  if (!_puertaOwner_(who, owner)) {   // PURGA #4: fail-closed — exige OWNER_EMAIL (sin él, nadie entra)
    // PURGA #1: diagnóstico de lockout (efímero, no spamea la hoja) — qué email se detectó vs owner
    try { Logger.log('doGet bloqueado: who=' + (who || '(vacío)') + ' owner=' + (owner || '(no seteado)')); } catch (_lg) {}
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><title>Satori OS</title>' +
      '<p style="font:16px system-ui;padding:2rem">No autorizado.</p>');
  }
  // FIX 3 (20-jul) — CONTRATO DE RETORNO desde la Voz. El CM se sirve dentro de un iframe
  // sandbox en *.googleusercontent.com; la URL que el usuario tiene en la barra es la WRAPPER
  // (script.google.com/…/exec). El cliente NO puede leer la wrapper (cross-origin), así que se
  // la inyecta el server acá. Sin esto, voz.html volvía por document.referrer = la URL interna
  // googleusercontent → GAS servía un error. `v` (vista) vuelve por query param de la wrapper.
  // Se INYECTA con append() y NO con createTemplateFromFile: index.html pesa ~730KB (casi todo
  // base64) y templatizarlo obligaría a GAS a escanear el archivo entero buscando scriptlets en
  // CADA doGet — justo el TTFP que optimizó E3.7. append() no escanea: concatena y listo.
  // Va al final del body, o sea DESPUÉS del script principal; no importa, porque los dos
  // consumidores (init en DOMContentLoaded e irAVoz en el click) leen las vars mucho después.
  var v = (e && e.parameter && String(e.parameter.v || '')) || '';
  var vista = (v === 'despacho' || v === 'akasha') ? v : '';   // whitelist: nada más entra
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (_u) { url = ''; }  // fail-safe: sin URL, la voz cae a sus fallbacks
  return HtmlService.createHtmlOutputFromFile('index')
    .append('<script>var SATORI_WRAPPER_URL=' + JSON.stringify(url) +
            ',SATORI_VISTA=' + JSON.stringify(vista) + ';<\/script>')
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
var VOZ_TOOLS = { estado: 1, brief: 1, vehemence: 1, cliente: 1, cerebro: 1, capturar: 1, sgic: 1, accion: 1 };

// ── Voz-acciones P2 (16-jul) — la voz ESCRIBE estructuras, con gate ──────────
//
// Whitelist DURA de acciones. v1 = UN solo tipo probado (escalera de maduración 0→1: un tipo
// probado > cuatro a medias). Para sumar 'crear_tarea'/'actualizar_objetivo' hay que agregarlos acá
// Y darles un ejecutor en ejecutarAprobada — sin las dos cosas, la acción se rechaza.
var ACCIONES_VOZ = { crear_objetivo: 1 };

// Campos que la voz PUEDE mandar por acción. Todo lo demás del payload se DESCARTA server-side.
//
// `metrica` NO está en la lista, y es a propósito (decisión de Luciano 16-jul — frontera de confianza):
// el Director encola al Analista SOLO para objetivos con `metrica` no vacía (14_director.js:48), y le
// pasa `descripcion` como `pregunta` CRUDA, sin blindar, al prompt del LLM (13_agentes.js:173-177) —
// y GUARDIA_INYECCION encima bendice como legítimo todo "pedido fuera de los marcadores". O sea: si la
// voz pudiera setear `metrica`, un texto dictado llegaría privilegiado al LLM sin lectura humana (el
// camino auto-aprobado por Dirección no tiene gate). Dejando `metrica` vacía, un objetivo creado por
// voz NUNCA alcanza correrAgente_. Completar `metrica` a mano es el acto humano que restaura el
// first-party. Si algún día se quiere `metrica` desde voz, el PREREQUISITO es sanear la pregunta y
// de-privilegiarla en GUARDIA_INYECCION (diseño anotado para Etapa 3) — no se improvisa.
var CAMPOS_ACCION = { crear_objetivo: ['titulo', 'meta', 'deadline', 'horizonte', 'prioridad'] };

function doPost(e) {
  var tool = '';
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var body;
    try { body = JSON.parse(raw || '{}'); } catch (_p) { vozRechazo_('bad_json'); return vozOut_({ ok: false, error: 'bad_json' }); }
    // E3.1 (D1): action 'oficina_sync' usa su PROPIO secreto (whitelist por caller). El secreto de voz
    // NO habilita esta action y este secreto NO habilita las tools de voz. Se rutea ANTES del vozAuth_.
    if (String(body.action || '') === 'oficina_sync') {
      if (!oficinaSyncAuth_(body.secret)) { vozRechazo_('oficina_sync_unauth'); return vozOut_({ ok: false, error: 'unauthorized' }); }
      // T3-S2: credencial con vencimiento — mismo camino fail-closed que `unauthorized`.
      // Sin fecha seteada = NO expira (decisión explícita del módulo S: compat con lo vigente).
      if (_secretoVencido_(PROP_OFICINA_EXPIRA)) { vozRechazo_('oficina_secret_expirado'); return vozOut_({ ok: false, error: 'secret_expirado' }); }
      // T3-S1: recién ACÁ (secreto validado y vigente) esta ejecución es "de sistema" y puede
      // atravesar los _soloOwner_ de los endpoints que reusa. Un request sin auth nunca llega.
      _ctxSistema_();
      try { var rs = oficinaSync_(body.payload); vozLog_('oficina_sync', !!rs.ok, rs.error || ''); return vozOut_(rs); }
      catch (err2) { vozLog_('oficina_sync', false, String((err2 && err2.message) || err2)); return vozOut_({ ok: false, error: 'error_interno' }); }
    }
    if (!vozAuth_(body.secret)) { vozRechazo_('unauthorized'); return vozOut_({ ok: false, error: 'unauthorized' }); } // fail-closed + alerta
    if (_secretoVencido_(PROP_VOZ_EXPIRA)) { vozRechazo_('secret_expirado'); return vozOut_({ ok: false, error: 'secret_expirado' }); } // T3-S2: vencido = mismo corte que unauthorized
    _ctxSistema_();   // T3-S1: secreto válido y vigente → ejecución de sistema (ver bloque de oficina_sync)
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
    var _t0 = Date.now();  // SPEC-GAS 14-jul: medir el tiempo server REAL por tool (separa doPost de render)
    switch (tool) {
      case 'estado':    data = estadoVigente(id || undefined); break;
      case 'brief':     data = briefCacheado_(id || undefined); break;   // SPEC-GAS: cache corto (voz) — evita el render pesado (salud+tareas) en cada consulta
      case 'vehemence': data = estadoVigente('CLI-002'); break;   // verVehemence() solo loguea → acá devolvemos el dato
      case 'cliente':   if (!id) return vozOut_({ ok: false, error: 'falta_idCliente' }); data = datosCliente(id); break;
      case 'cerebro':   if (!id) return vozOut_({ ok: false, error: 'falta_idCliente' }); data = leerEstado(id); break;
      case 'capturar':  data = capturar(vozStr_(args.texto, 4000), 'voz'); break;
      case 'accion':    data = accionVoz_(vozStr_(args.tipo, 40), args.payload, id); break;
      case 'sgic': {    // SGIC 14-jul: consulta read-only de una hoja whitelisted del cliente (o ventas de la fuente viva)
        if (!id) return vozOut_({ ok: false, error: 'falta_idCliente' });
        var sres = sgicConsulta_(id, vozStr_(args.hoja, 40), vozStr_(args.mes, 7), args.limite);
        if (sres && sres.error === 'hoja_no_permitida') return vozOut_({ ok: false, error: 'hoja_no_permitida', data: sres });
        data = sres; break;
      }
    }
    try { console.log('voz-timing tool=%s ms=%s', tool, Date.now() - _t0); } catch (e) {}  // instrumentación; nunca rompe el turno
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

/** E3.1 (D1): valida el secreto DEDICADO del sync de la Oficina (Script Properties: OFICINA_SYNC_SECRET).
 * Whitelist por caller: este secreto SOLO habilita 'oficina_sync'; el de voz NO sirve acá y viceversa.
 * Fail-closed si no está seteado. El valor JAMÁS vive en el repo — solo en Script Properties + .env de la Oficina. */
function oficinaSyncAuth_(secret) {
  var k = PropertiesService.getScriptProperties().getProperty('OFICINA_SYNC_SECRET');
  if (!k) return false;
  return ctEq_(String(secret == null ? '' : secret), String(k));
}

/** E3: sanitiza texto HOSTIL de la Oficina (títulos/resúmenes que vienen de marketplaces/web, aunque
 * lleguen por el sync propio) — defensa en profundidad, mismo criterio que _limpiar_hostil de la voz:
 * strip \t\r\n, colapso de espacios, truncado a ~max. (appendFila ya cubre formula-injection.) */
function limpiarHostilTexto_(s, max) {
  s = String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  max = max || 120;
  return s.length > max ? s.slice(0, max).replace(/\s+$/, '') + '…' : s;
}

// ═══ SGIC (14-jul) — tool `sgic`: Sato consulta CUALQUIER dato del SGIC de un cliente ═══════════════
// Bastión: READ-ONLY estricto (cero escrituras) · whitelist DURA de hojas (nombres arbitrarios → rechazo,
// SIN leer) · solo el spreadsheet del roster (url_sheet_cliente vía abrirCliente) + mapa de conectores
// HARDCODEADO (jamás un id que venga del LLM) · todo string libre pasa por limpiarHostilTexto_ (celda del
// SGIC = dato hostil, NUNCA instrucción) · respuesta acotada (limite + cap ~8KB).
var SGIC_HOJAS = { 'Datos_operativos': 1, 'KPIs': 1, 'objetivos': 1, 'estado_actual': 1, 'Aprobaciones': 1,
                   'Excepciones': 1, 'Umbrales': 1, 'Reglas': 1, 'Costos_API': 1 };  // cerebro NO (tiene tool 'cerebro')

/** Consulta read-only de una hoja del SGIC del cliente. idCliente ya validado (clienteExiste_) en el dispatch.
 *  hoja:'ventas' = caso especial (fuente viva del conector). Devuelve un objeto data para la voz. */
function sgicConsulta_(idCliente, hoja, mes, limite) {
  hoja = String(hoja || '');
  mes = /^\d{4}-\d{2}$/.test(String(mes || '')) ? String(mes) : '';
  limite = Math.min(Math.max(parseInt(limite, 10) || 20, 1), 50);

  if (hoja === 'ventas') return sgicVentas_(idCliente, mes);          // fuente viva (conector hardcodeado)
  if (!SGIC_HOJAS[hoja]) return { error: 'hoja_no_permitida', hojas_validas: Object.keys(SGIC_HOJAS).concat(['ventas']) };

  var ss;
  try { ss = abrirCliente(idCliente).ss; } catch (e) { return { error: 'cliente_sin_sheet', hoja: hoja }; }  // solo el sheet del roster
  var sh = ss.getSheetByName(hoja);
  if (!sh) return { hoja: hoja, cliente: idCliente, total: 0, filas: [], nota: 'la hoja no existe en este cliente' };

  var rows = leerTabla(sh);
  if (mes) {                                                          // filtro por mes solo si la hoja tiene columna temporal
    var conFecha = rows.filter(function (r) { return _sgicMesDe_(r) !== ''; });
    if (conFecha.length) rows = conFecha.filter(function (r) { return _sgicMesDe_(r) === mes; });
  }
  var total = rows.length;
  var filas = rows.slice(-limite).map(_sgicFila_);                   // últimas N (más recientes) + saneadas
  return { hoja: hoja, cliente: idCliente, mes: mes || null, total: total, mostrados: filas.length, filas: _sgicCap_(filas) };
}

// Mapa de conectores de ventas HARDCODEADO (Bastión: jamás un id del LLM). Se resuelve en tiempo de
// request (VEHEMENCE_DB_ID vive en 19_conectores.js). Cliente sin conector → cae a Datos_operativos.
function sgicVentas_(idCliente, mes) {
  var CONECTORES = { 'CLI-002': { id: VEHEMENCE_DB_ID, hoja: 'DB_VENTAS' } };
  var conf = CONECTORES[idCliente];
  if (!conf) return { hoja: 'ventas', con_conector: false, nota: 'este cliente no tiene conector de ventas; probá la hoja Datos_operativos' };
  var shV;
  try { shV = SpreadsheetApp.openById(conf.id).getSheetByName(conf.hoja); }  // SOLO lectura de la fuente
  catch (e) { return { hoja: 'ventas', con_conector: true, error: 'no pude abrir la fuente de ventas' }; }
  if (!shV) return { hoja: 'ventas', con_conector: true, error: 'la fuente no tiene ' + conf.hoja };
  var res = agregarVentasPorMes_(leerTabla(shV));                    // agregador canónico (misma verdad que el sync)
  return _sgicResumenVentas_(res.filas, res.canales, mes, idCliente);
}

/** PURA (testeable): agregados por mes×canal (filas de agregarVentasPorMes_) → resumen del mes pedido.
 *  {ordenes, total, aov, por_canal, cobertura}. Sin `mes`, usa el mes más reciente presente. */
function _sgicResumenVentas_(filasAgg, canales, mes, idCliente) {
  var meses = filasAgg.map(function (f) { return String(f.fecha).slice(0, 7); });
  var mesUsar = mes || (meses.length ? meses.sort().slice(-1)[0] : '');
  var delMes = filasAgg.filter(function (f) { return String(f.fecha).slice(0, 7) === mesUsar; });
  if (!delMes.length) return { hoja: 'ventas', con_conector: true, cliente: idCliente, mes: mesUsar || (mes || null), ordenes: 0, nota: 'sin ventas válidas' + (mes ? ' en ' + mes : '') };
  var ordenes = 0, total = 0, por_canal = [];
  delMes.forEach(function (f) {
    ordenes += Number(f.ordenes) || 0;
    total += Number(f.valor) || 0;
    por_canal.push({ canal: String(f.canal || '?'), ordenes: Number(f.ordenes) || 0, total: Number(f.valor) || 0, aov: Number(f.aov) || 0 });
  });
  return {
    hoja: 'ventas', con_conector: true, cliente: idCliente, mes: mesUsar,
    ordenes: ordenes, total: total, aov: ordenes ? Math.round(total / ordenes) : 0,
    por_canal: por_canal,
    cobertura: (canales && canales.length === 1) ? ('parcial: solo canal ' + canales[0]) : 'multicanal'
  };
}

/** Mes 'YYYY-MM' de una fila, robusto a la columna de fecha que exista (fecha/ts/fecha_creacion/mes). */
function _sgicMesDe_(r) {
  var d = (r.fecha != null && r.fecha !== '') ? r.fecha
        : (r.ts != null && r.ts !== '') ? r.ts
        : (r.fecha_creacion != null && r.fecha_creacion !== '') ? r.fecha_creacion
        : (r.mes != null && r.mes !== '') ? r.mes : '';
  if (d === '' || d == null) return '';
  var iso = aFechaISO(d);
  if (/^\d{4}-\d{2}/.test(iso)) return iso.slice(0, 7);
  return /^\d{4}-\d{2}/.test(String(d)) ? String(d).slice(0, 7) : '';
}

/** Saneo de una fila para la voz: strings hostiles limpiados+truncados, Date→ISO, números tal cual (N4). Sin _fila. */
function _sgicFila_(r) {
  var o = {};
  Object.keys(r).forEach(function (k) {
    if (k === '_fila') return;
    var v = r[k];
    if (typeof v === 'string') v = limpiarHostilTexto_(v, 200);
    else if (Object.prototype.toString.call(v) === '[object Date]') v = aFechaISO(v);
    o[k] = v;
  });
  return o;
}

/** Cap de la respuesta a ~8KB (corta de a filas enteras; nunca parte una fila). */
function _sgicCap_(filas) {
  var out = [], bytes = 0;
  for (var i = 0; i < filas.length; i++) {
    bytes += JSON.stringify(filas[i]).length;
    if (bytes > 8000 && out.length) break;   // al menos 1 fila aunque sea grande
    out.push(filas[i]);
  }
  return out;
}

/** E3.2: asegura el tenant CLI-000 (Oficina Virtual). Idempotente: si ya está en Clientes, no recrea.
 * Sigue el patrón EXACTO de crearCliente (mismas hojas). Se llama al inicio de cada oficina_sync. */
function asegurarTenantOficina_() {
  var sh = getMaestro().getSheetByName('Clientes');
  var existe = leerTabla(sh).some(function (c) { return String(c.id_cliente) === 'CLI-000'; });
  if (!existe) {
    crearCliente({ nombre: 'Oficina Virtual', rubro: 'Negocio digital paralelo',
                   estado: 'activo', forceId: 'CLI-000' });
  }
  return 'CLI-000';
}

/** E3.1: escribe el snapshot de la Oficina en el tenant CLI-000 (Datos_operativos + KPI de autonomía).
 * Payload versionado (v:1). Reemplazo idempotente por 'fuente' (cada sync pisa el anterior). Bajo conLock. */
function oficinaSync_(payload) {
  if (!payload || Number(payload.v) !== 1) return { ok: false, error: 'payload_version' };
  var id = asegurarTenantOficina_();
  var fecha = payload.fecha || hoyISO();
  var ns = payload.north_star || {};
  var costos = payload.costos || {};
  var ap = payload.aprobaciones_pendientes || {};
  var ags = payload.agentes || {};
  var FUENTE = 'Oficina Virtual · sync';
  function n_(x) { var v = Number(x); return isFinite(v) ? v : 0; }
  var titulos = (payload.hallazgos_top || []).slice(0, 10).map(function (h) {
    return '[' + limpiarHostilTexto_(h && h.tipo, 20) + '] ' + limpiarHostilTexto_(h && h.titulo, 80) +
           ' (' + n_(h && h.score) + ')';
  }).join(' | ');
  var resApr = ((ap.resumenes) || []).slice(0, 5).map(function (r) { return limpiarHostilTexto_(r, 80); }).join(' | ');
  var filas = [
    { concepto: 'Autonomía (North Star) %', valor: n_(ns.autonomia_pct), notas: '' },
    { concepto: 'Jobs 30d', valor: n_(ns.jobs_30d), notas: '' },
    { concepto: 'Decisiones 30d', valor: n_(ns.decisiones_30d), notas: '' },
    { concepto: 'Gasto API USD (mes)', valor: n_(costos.gastado_usd), notas: 'cap ' + n_(costos.cap_usd) + ' USD' },
    { concepto: 'Errores 7d', valor: n_(payload.errores_7d), notas: '' },
    { concepto: 'Aprobaciones pendientes', valor: n_(ap.n), notas: resApr },
    { concepto: 'Hallazgos top', valor: (payload.hallazgos_top || []).length, notas: titulos },
    { concepto: 'Agentes', valor: n_(ags.n), notas: limpiarHostilTexto_(ags.estados, 100) },
    // 16-jul: se llamaba 'Negocio paralelo pausado' y con valor 'no' se leía como si la Oficina
    // ESTUVIERA pausada (causó un falso diagnóstico el 14-jul). El nombre nuevo dice qué es.
    // Sin migración: el reemplazo idempotente de abajo borra por FUENTE (no por concepto), así que
    // la fila vieja se va sola en el primer sync — no pueden convivir vieja y nueva.
    { concepto: 'Oficina Virtual — kill-switch (np_pausado)', valor: payload.np_pausado ? 'sí' : 'no', notas: '' },
    { concepto: 'Modo de fuentes', valor: limpiarHostilTexto_(payload.fuentes_modo, 20), notas: '' }
  ];
  return conLock(function () {
    var cs = abrirCliente(id).ss;
    var shDO = cs.getSheetByName('Datos_operativos');
    var viejas = leerTabla(shDO).filter(function (f) { return String(f.fuente) === FUENTE; })
      .map(function (f) { return f._fila; });
    if (viejas.length) borrarFilasBatch_(shDO, viejas);
    filas.forEach(function (r) {
      appendFila(shDO, { fecha: fecha, concepto: r.concepto, valor: r.valor, fuente: FUENTE, notas: r.notas || '' });
    });
    // KPI del norte: autonomía % (reemplazo por nombre de KPI, idempotente).
    var shK = cs.getSheetByName('KPIs');
    var KPI = 'Autonomía OV (North Star)';
    var vk = leerTabla(shK).filter(function (f) { return String(f.kpi) === KPI; }).map(function (f) { return f._fila; });
    if (vk.length) borrarFilasBatch_(shK, vk);
    appendFila(shK, { fecha: fecha, kpi: KPI, valor: n_(ns.autonomia_pct), objetivo: '', alerta: '' });
    return { ok: true, tenant: id, filas: filas.length };
  });
}

/**
 * Voz-acciones P2 — ÚNICO camino por el que la voz escribe una estructura. NO escribe directo:
 * crea una Aprobación P1 tipada que cae en la cola del CM con botón. Al aprobar (1 clic),
 * ejecutarAprobada() la materializa. Si hay una Dirección vigente (F2) que matchea la acción + el
 * tenant, crearAprobacion la auto-aprueba y acá se ejecuta EN EL MISMO TURNO (velocidad 2).
 *
 * Bastión, en orden (todo fail-closed):
 *  - tipo contra ACCIONES_VOZ (whitelist dura) · payload objeto, cap de tamaño
 *  - tenant SOLO del roster (nunca un id del LLM: se valida contra Clientes)
 *  - whitelist de CAMPOS server-side: lo que no está en CAMPOS_ACCION se descarta aunque venga en el
 *    payload (no se confía en que el agente no lo mande; un payload manipulado no debe colar `metrica`)
 *  - todo texto por limpiarHostilTexto_ (defensa en profundidad; appendFila además sanitizarCelda)
 *  - el North Star de SISTEMA no se toca por acá (fuente única = Config): se rechaza explícitamente
 * @return {{ok, estado, id_aprobacion, auto, direccion, id_objetivo, mensaje}}
 */
function accionVoz_(tipo, payload, idCliente) {
  if (!ACCIONES_VOZ[tipo]) return { ok: false, error: 'accion_no_permitida', mensaje: 'No tengo esa acción registrada.' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'payload_invalido' };
  if (JSON.stringify(payload).length > 4000) return { ok: false, error: 'payload_grande' };

  // Tenant SOLO del roster. Sin tenant válido no se escribe nada (default-deny).
  var id = String(idCliente || '').trim();
  var cli = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) { return String(c.id_cliente) === id; })[0];
  if (!cli) return { ok: false, error: 'tenant_desconocido', mensaje: 'No tengo ese cliente en el roster.' };

  // T3-S3: la voz escribe SIEMPRE vía crearAprobacion (motor E2) → declara con_aprobacion.
  // Con la siembra vigente (escribir_tenant='aprobar') pasa; si Luciano pone 'bloquear',
  // la voz deja de escribir en el acto sin tocar una línea de código.
  var gr = gateRiesgo_('escribir_tenant', { con_aprobacion: true, id_cliente: id, detalle: tipo });
  if (!gr.ok) return { ok: false, error: 'riesgo_bloqueado', modo: gr.modo,
                       mensaje: 'Esa acción está bloqueada por la matriz de riesgo del sistema.' };

  // Whitelist de campos: se construye un payload NUEVO solo con lo permitido (descarta el resto).
  // T1-B: los campos de TEXTO LIBRE pasan además por el normalizador de cifras (best-effort
  // server-side, determinista) para que un monto dictado en palabras no quede escrito en palabras.
  // El prompt de Sato ya normaliza aguas arriba; esto es la red por si el STT/LLM se le escapa.
  var CAMPOS_TEXTO_LIBRE = ['titulo', 'descripcion'];
  var limpio = {};
  CAMPOS_ACCION[tipo].forEach(function (k) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') return;
    if (typeof payload[k] === 'number') { limpio[k] = payload[k]; return; }
    var v = limpiarHostilTexto_(payload[k], 200);
    if (CAMPOS_TEXTO_LIBRE.indexOf(k) >= 0) v = normalizarCifrasTexto_(v);
    limpio[k] = v;
  });

  if (tipo === 'crear_objetivo') {
    if (!limpio.titulo) return { ok: false, error: 'falta_titulo', mensaje: 'Necesito el título del objetivo.' };
    // Guarda dura (decisión 16-jul): el North Star de SISTEMA tiene UNA fuente (Config). Nadie puede
    // crear una segunda por voz — ni apuntando a CLI-000 ni con un título que huela a norte.
    if (_hueleANorthStar_(limpio.titulo)) {
      return { ok: false, error: 'north_star_no_por_voz',
               mensaje: 'El North Star de Satori no se cambia por voz: vive en la configuración del sistema y se edita desde el editor. Esto sí puedo registrarlo como objetivo operativo si le cambiás el título.' };
    }
    var desc = limpio.titulo;
    var apPayload = { accion: 'crear_objetivo', tenant: id, titulo: desc,
                      meta: (limpio.meta === undefined ? '' : limpio.meta),
                      deadline: (limpio.deadline || ''), horizonte: (limpio.horizonte || '12m'),
                      prioridad: (limpio.prioridad || 'B') };
    var r = crearAprobacion(id, 'voz', 'crear_objetivo', apPayload, {
      descripcion: 'Registrar objetivo de ' + cli.nombre + ': ' + truncar_(desc, 90),
      confianza: '', patron: 'P1'
    });
    // Velocidad 2: si una Dirección vigente la auto-aprobó, se ejecuta en el mismo turno.
    if (r.auto) {
      var ej = ejecutarAprobada(id, r.id);
      return { ok: true, estado: 'registrado', id_aprobacion: r.id, auto: true, direccion: r.direccion,
               id_objetivo: (ej && ej.id_objetivo) || '',
               mensaje: 'Registrado' + ((ej && ej.id_objetivo) ? ' como ' + ej.id_objetivo : '') + ' (por dirección ' + r.direccion + ').' };
    }
    return { ok: true, estado: 'pendiente_aprobacion', id_aprobacion: r.id, auto: false,
             mensaje: 'Te dejé la aprobación ' + r.id + ' lista en el Centro de Mando — un clic y queda registrado.' };
  }
  return { ok: false, error: 'accion_sin_ejecutor' };
}

/** ¿El título pretende ser el North Star de sistema? (fuente única = Config, ver accionVoz_). */
function _hueleANorthStar_(t) {
  var s = String(t || '').toLowerCase();
  return /north\s*star|norte\s+de\s+satori|objetivo\s+de\s+satori|mi\s+objetivo\s+propio/.test(s);
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
// H4 (T3 · MÓDULO H, 21-jul): `cerebro_map` enciende el mapa neural del Espacio en Akasha.
// NACE 'off' (regla de la cadena: lo riesgoso nace apagado). Es render 3D extra por tenant y el
// presupuesto de perf —30fps en iPhone— no se puede medir desde acá: el CM vive en un iframe
// cross-origin, así que el fps lo valida Luciano a ojo y recién ahí lo prende.
var PREFS_UI_OK = ['orbe_calidad', 'cerebro_map'];
function setPrefUI(clave, valor) {
  _soloOwner_('setPrefUI');   // S1 (T3-S): endpoint client-callable — gate de identidad
  clave = String(clave || '');
  valor = String(valor || '').slice(0, 40);
  if (PREFS_UI_OK.indexOf(clave) < 0) throw new Error('preferencia no permitida');
  setConfig(clave, valor);
  return { ok: true };
}
/** Lee las preferencias de UI (default seguro si faltan). */
function prefsUI() {
  _soloOwner_('prefsUI');   // S1 (T3-S): endpoint client-callable — gate de identidad
  return { orbe_calidad: getConfig('orbe_calidad') || 'alto', cerebro_map: getConfig('cerebro_map') || 'off' };
}

/**
 * CEREBRO → ORBE: grafo del cerebro de un cliente para visualizarlo en el orbe 3D.
 * Estructura SIN PII: por nodo solo dimensión (líder/negocio/sistema) + flag de alerta
 * (cobertura < 40 = punto ciego); aristas como pares de índices. Nunca etiquetas/atributos.
 */
function cerebroGrafo(idCliente) {
  _soloOwner_('cerebroGrafo');   // S1 (T3-S): endpoint client-callable — gate de identidad
  try {
    var ss = abrirCliente(idCliente).ss;
    var nodos = leerTabla(ss.getSheetByName('nodos')) || [];
    var aristas = leerTabla(ss.getSheetByName('aristas')) || [];
    var idx = {}, outN = [];
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i]; idx[String(n.id_nodo)] = i;
      var cob = parseFloat(n.cobertura);
      // E3.5 (H3, 21-jul): se agrega `id` — el identificador OPACO de la fila (NOD-0007), que es el
      // handle para pedir el detalle con cerebroNodo(). El bulk sigue ANÓNIMO en el sentido que
      // importa: no viaja ni una etiqueta, ni un atributo, ni una relación con nombre. Un id sin
      // etiqueta no dice nada de nadie; sin él, el detalle por nodo sería imposible o habría que
      // direccionarlo por POSICIÓN en el array, que se rompe en cuanto alguien agrega un nodo.
      outN.push({ id: String(n.id_nodo), dim: String(n.dimension || 'negocio'), alert: (!isNaN(cob) && cob < 40) });
    }
    var outA = [];
    for (var j = 0; j < aristas.length; j++) {
      var o = idx[String(aristas[j].origen)], d = idx[String(aristas[j].destino)];
      if (o != null && d != null) outA.push([o, d]);
    }
    return { nodos: outN, aristas: outA };
  } catch (e) { return { nodos: [], aristas: [] }; } // sin cerebro → orbe decorativo
}

/** Cuántos eventos del log de un nodo se devuelven en el detalle (H3). Tope duro, no configurable. */
var CEREBRO_NODO_EVENTOS = 8;

/**
 * E3.5 · H3 (T3, 21-jul) — DETALLE de UN nodo del cerebro de un tenant: propiedades reales
 * (etiqueta, tipo, atributos, cobertura), sus aristas con el nombre de la relación y el nodo del
 * otro lado, y los últimos eventos del `cerebro_log` que lo tocan.
 *
 * Bastión — por qué esto SÍ lleva etiquetas y el bulk no: `cerebroGrafo` alimenta un render de 3
 * dígitos de nodos y viaja entero al cliente en cada carga; llevar etiquetas ahí sería exponer el
 * mapa completo del negocio de cada tenant en cada boot. Este endpoint devuelve UN nodo, a pedido
 * explícito del owner (gate `_soloOwner_`), y es la única superficie donde el detalle sale.
 *
 * Fail-closed y honesto: tenant/nodo inexistente → `{sin_nodo:true}`, jamás un objeto vacío que la
 * UI pueda pintar como "nodo sin datos". Celdas del tenant sanitizadas (dato potencialmente hostil).
 *
 * M3: el log ya está comprimido (caliente = últimos `cerebro_corte_dias`). Si un nodo no tiene
 * eventos recientes se dice eso — no se va a buscar al archivo, que es justo lo que la memoria fría
 * viene a evitar.
 *
 * @param {string} idCliente
 * @param {string} idNodo
 * @return {{sin_nodo?:boolean, nodo?:Object, aristas?:Array, eventos?:Array, log_comprimido?:boolean}}
 */
function cerebroNodo(idCliente, idNodo) {
  _soloOwner_('cerebroNodo');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var id = String(idNodo || '').trim();
  if (!id) return { sin_nodo: true, motivo: 'sin id de nodo' };
  var ss;
  try { ss = abrirCliente(idCliente).ss; } catch (e) { return { sin_nodo: true, motivo: 'tenant no accesible' }; }

  var shN = ss.getSheetByName('nodos');
  if (!shN) return { sin_nodo: true, motivo: 'tenant sin cerebro' };
  var n = leerTabla(shN).filter(function (f) { return String(f.id_nodo) === id; })[0];
  if (!n) return { sin_nodo: true, motivo: 'nodo inexistente' };

  // Etiquetas de TODOS los nodos: hace falta para nombrar el otro extremo de cada arista.
  var etiquetas = {};
  leerTabla(shN).forEach(function (f) { etiquetas[String(f.id_nodo)] = String(f.etiqueta || f.id_nodo); });

  var shA = ss.getSheetByName('aristas');
  var aristas = (shA ? leerTabla(shA) : []).filter(function (a) {
    return String(a.origen) === id || String(a.destino) === id;
  }).map(function (a) {
    var saliente = String(a.origen) === id;
    var otro = saliente ? String(a.destino) : String(a.origen);
    return {
      direccion: saliente ? 'sale' : 'entra',
      relacion: limpiarHostilTexto_(String(a.relacion || a.tipo || 'relación'), 40),
      otro_id: otro,
      otro: limpiarHostilTexto_(etiquetas[otro] || otro, 60),
      peso: (a.peso === '' || a.peso == null) ? 1 : a.peso
    };
  });

  var shL = ss.getSheetByName('cerebro_log');
  var log = shL ? leerTabla(shL) : [];
  var eventos = log.filter(function (e) { return String(e.id_nodo) === id; })
    .slice(-CEREBRO_NODO_EVENTOS).reverse()
    .map(function (e) {
      return {
        ts: fechaHoraCorta_(e.ts) || String(e.ts),
        evento: limpiarHostilTexto_(String(e.evento || 'evento'), 40),
        origen: limpiarHostilTexto_(String(e.origen || 'sistema'), 30),
        detalle: limpiarHostilTexto_(String(e.detalle || ''), 160)
      };
    });

  var cob = parseFloat(n.cobertura);
  return {
    nodo: {
      id: id,
      etiqueta: limpiarHostilTexto_(String(n.etiqueta || ''), 80),
      tipo: limpiarHostilTexto_(String(n.tipo || 'generico'), 40),
      dimension: String(n.dimension || dimensionDeTipo_(n.tipo)),
      estado: limpiarHostilTexto_(String(n.estado || 'activo'), 30),
      relevancia: (n.relevancia === '' || n.relevancia == null) ? null : Number(n.relevancia),
      cobertura: isNaN(cob) ? null : cob,
      alert: (!isNaN(cob) && cob < 40),
      fuente: limpiarHostilTexto_(String(n.fuente || 'sistema'), 40),
      atributos: limpiarHostilTexto_(String(n.atributos || ''), 300),
      actualizado_en: fechaHoraCorta_(n.actualizado_en) || String(n.actualizado_en || '')
    },
    aristas: aristas,
    eventos: eventos,
    // La UI necesita distinguir "este nodo no tuvo actividad" de "la actividad vieja se archivó".
    log_comprimido: !!(ss.getSheetByName('cerebro_resumen'))
  };
}

/** Resumen de cabecera (incluye ultima_sync_ok, visible siempre). */
function estadoSistema() {
  _soloOwner_('estadoSistema');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('datosHoy');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('listaClientes');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('datosCliente');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('estadoAgentes');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
    cfg: { voz_url: getConfig('voz_url') || 'http://127.0.0.1:8787', oficina_url: getConfig('oficina_url'),
      // 16-jul: avatares propios de los nodos nav del CM (Config avatar_bandeja / avatar_cerebro;
      // vacías => el CM conserva el glifo SVG, fail-closed en cmAvataresOrbita)
      avatar_bandeja: getConfig('avatar_bandeja'), avatar_cerebro: getConfig('avatar_cerebro') },
    // Voz-acciones P3 (16-jul): North Star propio de Satori para la card del CM. Fuente ÚNICA = Config
    // (northStarSatori_ ya computa el avance: clientes activos pagos vs meta). null => el CM oculta la
    // card (fail-closed, mismo patrón que el botón Oficina). NO es el objetivo de ningún tenant.
    north_star: northStarSatori_(),
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
  // Errores del MES (16-jul). Antes contaba `estado === 'fallida'` sobre la cola ENTERA, sin ventana:
  // era un contador histórico disfrazado de mensual (el docstring de acá arriba ya decía "del mes").
  // Con la dieta de Cola_tareas (archivarColaVieja_) un contador all-time además se iría comiendo los
  // errores viejos al archivarlos. Acotarlo al mes arregla las dos cosas a la vez: el número es el que
  // el docstring prometía, y archivar no puede alterarlo (archivarColaVieja_ nunca toca el mes en curso).
  var errores = cola.filter(function (f) {
    return String(f.estado) === 'fallida' && String(aFechaISO(f.creada_en) || '').indexOf(mes) === 0;
  }).length;
  return { llamadas: llamadas, tokens: tokens, gasto_usd: c.gasto, tope_usd: tope, errores: errores };
}

/**
 * E3.4 — BOOT ÚNICO: las 6 fuentes del primer paint en UNA sola ejecución server.
 *
 * Por qué: el boot disparaba ~10 google.script.run (Akasha 6 + CM 4) y 5 de ellas
 * eran LA MISMA función pedida dos veces (estadoAgentes/datosHoy/estadoSalud/
 * recomendacionesAbiertas/agendaRango). Cada round-trip GAS cuesta 0.5-2s: el
 * costo era la ida y vuelta, no el trabajo. Acá se paga UNA sola ida.
 *
 * Cero lógica nueva: llama a las funciones existentes tal cual. Cero endpoints de
 * datos nuevos (esto es un agregador), cero scopes nuevos, cero secretos.
 *
 * FAIL-CLOSED POR SECCIÓN (paridad con el `pedir()` de Akasha): cada fuente va en
 * su propio try/catch — la que falla viaja `null` y las otras 5 viven. Jamás
 * todo-o-nada: una hoja rota no puede dejar la Oficina en negro.
 *
 * La agenda toma el rango del cliente (desdeISO/hastaISO) para no cambiarle el
 * significado a la grilla: Akasha y el CM piden lunes→domingo y lo calculan en el
 * huso del browser. Sin rango, cae al lunes→domingo del huso del script.
 *
 * NO usa CacheService a propósito (decisión 17-jul): datos viejos en el primer
 * paint es exactamente lo que Bastión no quiere.
 *
 * @param {string=} desdeISO  YYYY-MM-DD (opcional)
 * @param {string=} hastaISO  YYYY-MM-DD (opcional)
 * @return {{agentes:Object, hoy:Object, salud:Object, recs:Array, agenda:Array, clientes:Array}}
 *         cada clave es el retorno de su función, o null si esa fuente falló.
 */
function _bootSeccion_(nombre, fn) {
  try { return fn(); }
  catch (e) {
    // Se traga la excepción A PROPÓSITO: el cliente ya sabe pintar `null` como
    // "sección vacía con aviso". Queda registrada para no fallar en silencio.
    console.error('[boot] ' + nombre + ': ' + ((e && e.message) || e));
    return null;
  }
}

/**
 * E3.7 — BOOT UNIVERSO: SOLO lo que la escena 3D necesita para poblarse.
 *
 * `estadoAgentes()` ya trae agentes + feed + aprobaciones + clientes_activos: con
 * eso el motor arma estaciones, Espacios y Muelle. Es la mitad BARATA del boot, y
 * va en su PROPIA ejecución GAS para que corra en paralelo con `bootResto()`
 * (dos google.script.run concurrentes → el wall-clock es el más lento, no la suma).
 *
 * `estadoSalud()` (lo más caro: 6 chequeos) queda FUERA de acá a propósito: el
 * clima ámbar puede llegar tarde sin frenar el universo. Fail-closed por sección.
 *
 * Incluye `listaClientes()` (no solo el `clientes_activos` de estadoAgentes) para
 * que el anillo de Espacios nazca COMPLETO: los potenciales/pausados (EJF, SIP)
 * son semáforo real y no deben aparecer/desaparecer entre olas. Es un read barato
 * en la misma ejecución.
 *
 * @return {{agentes:Object, clientes:Array}} cada clave es su retorno, o null si falló.
 */
function bootUniverso() {
  _soloOwner_('bootUniverso');   // S1 (T3-S): endpoint client-callable — gate de identidad
  return {
    agentes:  _bootSeccion_('agentes',  function () { return estadoAgentes(); }),
    clientes: _bootSeccion_('clientes', function () { return listaClientes(); })
  };
}

/**
 * E3.7 — BOOT RESTO: los docks + el clima. Corre EN PARALELO con bootUniverso().
 * Acá vive `estadoSalud()`, lo más caro, fuera del camino de poblar el universo.
 * Fail-closed por sección (paridad D17h): la que falla viaja null, las otras viven.
 *
 * @return {{hoy:Object, recs:Array, agenda:Array, salud:Object}}
 */
function bootResto(desdeISO, hastaISO) {
  _soloOwner_('bootResto');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var rango = _bootRangoSemana_(desdeISO, hastaISO);
  return {
    hoy:    _bootSeccion_('hoy',    function () { return datosHoy(); }),
    recs:   _bootSeccion_('recs',   function () { return recomendacionesAbiertas(); }),
    agenda: _bootSeccion_('agenda', function () { return agendaRango(rango.desde, rango.hasta); }),
    salud:  _bootSeccion_('salud',  function () { return estadoSalud(); })
  };
}

/**
 * E3.4/E3.7 — BOOT ÚNICO: las 6 fuentes en UNA ejecución. Ahora es la SUMA de
 * bootUniverso() + bootResto() (+ listaClientes), para no duplicar lógica.
 *
 * Sigue existiendo para compat y para el assert D17i/j; el cliente E3.7 usa las
 * dos mitades en paralelo, no esto. Cero endpoints/scopes/secretos nuevos: es un
 * agregador de funciones que ya existen, cada sección con su try/catch.
 *
 * @return {{agentes,hoy,salud,recs,agenda,clientes:Object}} cada clave o null.
 */
function bootUnico(desdeISO, hastaISO) {
  _soloOwner_('bootUnico');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var u = bootUniverso(), r = bootResto(desdeISO, hastaISO);
  return {
    agentes:  u.agentes,
    clientes: u.clientes,
    hoy:      r.hoy,
    salud:    r.salud,
    recs:     r.recs,
    agenda:   r.agenda
  };
}

/** Rango del cliente si vino bien formado; si no, lunes→domingo en el huso del script. */
function _bootRangoSemana_(desdeISO, hastaISO) {
  var re = /^\d{4}-\d{2}-\d{2}$/;
  if (re.test(String(desdeISO)) && re.test(String(hastaISO)) && String(hastaISO) >= String(desdeISO)) {
    return { desde: String(desdeISO), hasta: String(hastaISO) };
  }
  var d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // lunes
  var l = new Date(d.getTime()), dom = new Date(d.getTime());
  dom.setDate(dom.getDate() + 6);
  return { desde: aFechaISO(l), hasta: aFechaISO(dom) };
}

/**
 * Estado de Salud para el panel del Command Center (E8a4): los 6 chequeos + integridad%.
 * dryRun → NO escribe a producción (no ensucia feed/avisos en cada refresh de la UI).
 */
function estadoSalud() {
  _soloOwner_('estadoSalud');   // S1 (T3-S): endpoint client-callable — gate de identidad
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

/** Últimos N eventos del feed Actividad (más nuevos primero). XSS lo maneja el front (textContent).
 *  Ya lee SOLO las últimas `cuantos` filas (no la hoja entera). Dieta 14-jul: además trunca el
 *  `texto` a `_FEED_TEXTO_LIM` chars — las celdas de Actividad pueden ser enormes (salidas de agentes)
 *  y el feed es display; recorta payload al CM y costo de render sin perder la línea informativa. */
var _FEED_TEXTO_LIM = 240;
function feedReciente_(cuantos) {
  var sh = getMaestro().getSheetByName('Actividad');
  if (!sh || sh.getLastRow() < 2) return [];
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var ix = {}; H.forEach(function (h, i) { ix[h] = i; });
  var n = sh.getLastRow(), desde = Math.max(2, n - cuantos + 1);
  return sh.getRange(desde, 1, n - desde + 1, sh.getLastColumn()).getValues().map(function (f) {
    var txt = String(f[ix.texto]).replace(/^'/, '');
    if (txt.length > _FEED_TEXTO_LIM) txt = txt.slice(0, _FEED_TEXTO_LIM - 1) + '…';
    return {
      ts: aHoraLegible_(f[ix.ts]), agente: String(f[ix.agente]), tipo: String(f[ix.tipo]),
      id_cliente: String(f[ix.id_cliente] || ''), texto: txt,
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
  _soloOwner_('dispararAgenteUI');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var r = encolarAgente(idCliente, clave, {});
  drenarCola();
  return r;
}

/** Resuelve una aprobación desde la UI (único punto de decisión: resolverAprobacion). */
function resolverAprobacionUI(idCliente, id, decision, ediciones) {
  _soloOwner_('resolverAprobacionUI');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var res = resolverAprobacion(idCliente, id, decision, ediciones || {});
  // Reflejo inmediato (08-jul): el espejo agregado es "pendientes only"; una resuelta
  // sale YA, sin esperar al próximo syncMaestro (antes reaparecía en el CM al recargar).
  if (res && res.ok) { try { quitarAgregada_(id, idCliente); } catch (e) { /* la resolución ya quedó; el próximo sync la limpia */ } }
  return res;
}

/** Métricas admisibles para el tenant, para pintar los chips del CM (T1-A). La UI NO decide: esto es
 *  lo mismo que después re-valida `asignarMetricaUI` server-side. */
function metricasValidasUI(idCliente) {
  _soloOwner_('metricasValidasUI');   // S1 (T3-S): endpoint client-callable — gate de identidad
  if (!clienteExiste_(String(idCliente || '').trim())) return [];
  return metricasValidas_(String(idCliente).trim());
}

/**
 * T1-A — asigna la `metrica` de un objetivo desde el CM (fin de la celda a mano en Sheets).
 *
 * Este es EL acto humano de la frontera de confianza: escribir `metrica` activa el análisis dirigido
 * (14_director.js:48 encola al Analista y le pasa `descripcion` cruda al LLM). Por eso acá NO se
 * confía en la UI: se re-valida todo server-side, en orden, y cualquier fallo es RECHAZO (nunca
 * escritura parcial):
 *   1. tenant en el roster            → `tenant_desconocido`
 *   2. el objetivo existe             → `objetivo_inexistente`
 *   3. metrica ∈ metricasValidas_     → `metrica_invalida`  (match EXACTO, patrón Direcciones)
 * `metrica` JAMÁS puede venir de texto libre de LLM/STT — solo del chip (acto humano dentro del OS).
 * @return {{ok:boolean, error?:string, id_objetivo?:string, metrica?:string, mensaje?:string}}
 */
function asignarMetricaUI(idCliente, id_objetivo, metrica) {
  _soloOwner_('asignarMetricaUI');   // S1 (T3-S): endpoint client-callable — gate de identidad
  var id = String(idCliente || '').trim();
  if (!clienteExiste_(id)) return { ok: false, error: 'tenant_desconocido', mensaje: 'No tengo ese cliente en el roster.' };

  var idObj = String(id_objetivo || '').trim();
  if (!idObj) return { ok: false, error: 'objetivo_inexistente', mensaje: 'Falta el id del objetivo.' };

  // Se acepta '' explícito = "sin métrica por ahora" (deja el objetivo fuera del análisis dirigido).
  var m = String(metrica == null ? '' : metrica).trim();
  if (m && metricasValidas_(id).indexOf(m) < 0) {
    return { ok: false, error: 'metrica_invalida', mensaje: 'Esa métrica no está en la lista del cliente: ' + m };
  }

  var sh = abrirCliente(id).ss.getSheetByName('objetivos');
  if (!sh) return { ok: false, error: 'objetivo_inexistente', mensaje: 'El tenant ' + id + ' no tiene hoja objetivos.' };

  return conLock(function () {
    var matriz = sh.getDataRange().getValues();
    var H = matriz[0];
    var iId = H.indexOf('id_objetivo'), iMet = H.indexOf('metrica');
    if (iId < 0 || iMet < 0) return { ok: false, error: 'objetivo_inexistente', mensaje: 'La hoja objetivos no tiene las columnas esperadas.' };
    for (var r = 1; r < matriz.length; r++) {
      if (String(matriz[r][iId]).trim() !== idObj) continue;
      sh.getRange(r + 1, iMet + 1).setValue(sanitizarCelda(m));
      SpreadsheetApp.flush();
      try { feed_('Director', 'metrica_asignada', id, idObj + ' · metrica: ' + (m || '(sin métrica)'), '', ''); } catch (e) {}
      return { ok: true, id_objetivo: idObj, metrica: m,
               mensaje: m ? ('Objetivo ' + idObj + ' ahora mide ' + m + '.') : ('Objetivo ' + idObj + ' queda sin métrica por ahora.') };
    }
    return { ok: false, error: 'objetivo_inexistente', mensaje: 'No encontré el objetivo ' + idObj + ' en ' + id + '.' };
  });
}

/** Quita una aprobación del espejo agregado por id + id_cliente (D16y 16-jul: APR-#### es secuencia
 *  POR CLIENTE ⇒ en el agregado multi-tenant el id pelado colisiona y podía borrar la fila de OTRO
 *  cliente). Sin idCliente cae al borrado por id (compat con callers viejos, p.ej. D11). */
function quitarAgregada_(id, idCliente) {
  var sh = getMaestro().getSheetByName('Aprobaciones_agregadas');
  if (!sh || sh.getLastRow() < 2) return;
  conLock(function () {
    var m = sh.getDataRange().getValues();
    var ic = m[0].indexOf('id');
    var icli = m[0].indexOf('id_cliente');
    if (ic < 0) return;
    for (var r = m.length - 1; r >= 1; r--) {
      if (String(m[r][ic]) !== String(id)) continue;
      if (idCliente && icli >= 0 && String(m[r][icli]) !== String(idCliente)) continue;
      sh.deleteRow(r + 1);
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
  _soloOwner_('tableroTareas');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('crearTarea');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('crearTareaQuick');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
  _soloOwner_('moverTarea');   // S1 (T3-S): endpoint client-callable — gate de identidad
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
