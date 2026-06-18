/**
 * 18_direccion.js — Capa de Dirección (Fase D · kevinfremon). MUST #1: estadoVigente.
 *
 * estadoVigente([idCliente]) exporta un SNAPSHOT en markdown ("packet of truth") del
 * estado real — KPIs, pendientes y números — para que Cowork/Code (o el brief diario)
 * lo lean sin re-explicar nada. Sin arg → vista SISTEMA (Satori la consultora = el
 * MAESTRO). Con id → vista de ese cliente (incluye North Star si ya tiene `objetivos`).
 *
 * Composición pura sobre el data-layer existente (datosHoy / estadoSistema /
 * estadoSalud dryRun / telemetriaMaestro_ / datosCliente) → 0 API. Sin escrituras
 * propias; la única es el "asegurar fila del mes" interno de filaConsumoAgentes_,
 * idéntico al de la tira de telemetría de la UI (idempotente, benigno).
 */

/** Snapshot markdown del estado vigente. @param {string} [idCliente] @return {string} markdown */
function estadoVigente(idCliente) {
  var md = idCliente ? estadoVigenteCliente_(String(idCliente)) : estadoVigenteSistema_();
  Logger.log(md);
  return md;
}

/** Vista SISTEMA (Satori = MAESTRO): cartera + pendientes + números + salud + próximas 3. */
function estadoVigenteSistema_() {
  var d = datosHoy();              // estado + avisos + proximos_pasos + aprobaciones por patrón
  var sal = estadoSalud();         // dryRun: global + integridad% + hallazgos
  var tel = telemetriaMaestro_();  // llamadas / tokens / gasto / tope / errores
  var e = d.estado;
  var L = [];
  L.push('# Estado vigente — Satori OS — ' + aHoraLegible_(ahoraISO()));
  L.push('');

  // Conteo directo (datosHoy capa proximos_pasos a 25; el snapshot no debe subcontar).
  var tareas = leerTabla(getMaestro().getSheetByName('Tareas'));
  var abiertas = tareas.filter(function (t) { return ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) < 0; });
  var tareasVenc = abiertas.filter(function (t) { return esVencida(t.fecha_limite, t.estado); }).length;
  L.push('## Cartera');
  L.push('- Clientes: ' + e.clientes + ' · Proyectos: ' + e.proyectos + ' · Tareas abiertas: ' + abiertas.length + ' (vencidas: ' + tareasVenc + ')');
  L.push('');

  var ban = leerTabla(getMaestro().getSheetByName('Bandeja'));
  var banSin = ban.filter(function (b) { return ['pendiente', 'procesando', 'escalado'].indexOf(String(b.estado)) >= 0; }).length;
  var porTipo = {};
  d.avisos.forEach(function (a) { porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1; });
  L.push('## Requiere tu decisión');
  L.push('- Aprobaciones pendientes: ' + e.aprobaciones_pendientes);
  L.push('- Avisos activos: ' + e.avisos_activos + (Object.keys(porTipo).length ? ' (' + objetoAConteo_(porTipo) + ')' : ''));
  L.push('- Bandeja sin resolver: ' + banSin);
  L.push('');

  L.push('## Números (' + mesISO() + ')');
  L.push('- Gasto API: $' + tel.gasto_usd + ' / $' + tel.tope_usd + ' · llamadas: ' + tel.llamadas + ' · tokens: ' + tel.tokens + ' · errores: ' + tel.errores);
  L.push('');

  L.push('## Salud: ' + String(sal.global).toUpperCase() + ' (integridad ' + sal.integridad + '%)');
  var noOk = sal.hallazgos.filter(function (h) { return h.estado !== 'ok'; });
  if (noOk.length) noOk.forEach(function (h) { L.push('- ' + h.nombre + ' [' + h.estado + ']: ' + h.detalle); });
  else L.push('- todos los chequeos OK');
  L.push('');

  L.push('## Próximas 3 (lo que movería hoy)');
  var top = d.proximos_pasos.slice(0, 3);
  if (top.length) top.forEach(function (t) {
    L.push('- [' + (t.prioridad || '—') + '] ' + t.descripcion +
      (t.fecha_limite ? ' (límite ' + t.fecha_limite + (t.vencida ? ' · VENCIDA' : '') + ')' : '') +
      (t.id_cliente ? ' · ' + t.id_cliente : ''));
  });
  else L.push('- (sin tareas abiertas)');
  L.push('');

  L.push('— última sync: ' + (e.ultima_sync_ok || '—') + ' · generado por estadoVigente()');
  return L.join('\n');
}

/** Vista CLIENTE: North Star + KPIs + operación reciente + pendientes. */
function estadoVigenteCliente_(id) {
  var dc;
  try { dc = datosCliente(id); }
  catch (e) { return '# Estado vigente — ' + id + '\n\n(cliente no encontrado: ' + e.message + ')'; }
  var c = dc.cliente;

  var cs = null;
  try { cs = abrirCliente(id).ss; } catch (e) { cs = null; }
  function leerCli_(pestana) { var sh = cs && cs.getSheetByName(pestana); return sh ? leerTabla(sh) : []; }

  var L = [];
  L.push('# Estado vigente — ' + c.nombre + ' (' + c.id_cliente + ') — ' + aHoraLegible_(ahoraISO()));
  L.push('');

  var obj = leerCli_('objetivos');
  L.push('## Objetivo (North Star)');
  if (obj.length) obj.forEach(function (o) {
    L.push('- [' + (o.horizonte || '—') + '] ' + (o.descripcion || '—') +
      (o.metrica ? ' · meta ' + o.metrica + '=' + o.valor_objetivo : '') +
      (o.estado ? ' (' + o.estado + ')' : ''));
  });
  else L.push('- — sin objetivo definido — (definir North Star)');
  L.push('');

  var kpis = leerCli_('KPIs');
  L.push('## Números (KPIs)');
  if (kpis.length) kpis.slice(-5).forEach(function (k) {
    L.push('- ' + (k.kpi || '—') + ' = ' + k.valor +
      ((k.objetivo !== '' && k.objetivo != null) ? ' (obj ' + k.objetivo + ')' : '') +
      (k.alerta ? ' ⚠ ' + k.alerta : '') +
      (k.fecha ? ' · ' + aFechaISO(k.fecha) : ''));
  });
  else L.push('- (sin KPIs cargados)');
  L.push('');

  var ops = leerCli_('Datos_operativos');
  L.push('## Operación reciente');
  if (ops.length) ops.slice(-5).forEach(function (o) { L.push('- ' + aFechaISO(o.fecha) + ' · ' + (o.concepto || '—') + ' = ' + o.valor); });
  else L.push('- (sin datos operativos)');
  L.push('');

  var aprob = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas')).filter(function (a) { return a.id_cliente === id; });
  var tareasVenc = dc.proximos_pasos.filter(function (t) { return t.vencida; }).length;
  L.push('## Pendientes');
  L.push('- Proyectos: ' + dc.proyectos.length + ' · Tareas abiertas: ' + dc.proximos_pasos.length + ' (vencidas: ' + tareasVenc + ')');
  L.push('- Aprobaciones del cliente: ' + aprob.length);
  L.push('');

  L.push('— ' + c.rubro + ' · estado ' + c.estado + ' · generado por estadoVigente(\'' + id + '\')');
  return L.join('\n');
}

/** {clave:N,...} → "clave:N, clave:N" (para conteos inline). */
function objetoAConteo_(o) {
  return Object.keys(o).map(function (k) { return k + ':' + o[k]; }).join(', ');
}

// ── MUST #2 — Brief operativo diario ─────────────────────────────────────────

/**
 * briefDiario([idCliente]) — BLUF + "las 3 cosas de hoy" + números + movimiento reciente.
 * Rule-based (0 API). Sistema sin arg, o por cliente (con North Star si tiene objetivo).
 * Devuelve markdown y lo loguea; **NO envía nada** (AREL: la entrega por email/Doc es un
 * paso opt-in aparte). Borrador para revisión: la lógica del BLUF la afinás vos.
 */
function briefDiario(idCliente) {
  var md = idCliente ? briefDiarioCliente_(String(idCliente)) : briefDiarioSistema_();
  Logger.log(md);
  return md;
}

/** Brief de SISTEMA (Satori): la movida más urgente + 3 cosas + números + feed. */
function briefDiarioSistema_() {
  var d = datosHoy();
  var sal = estadoSalud();
  var abiertas = tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas')));
  var vencidas = abiertas.filter(function (t) { return esVencida(t.fecha_limite, t.estado); });
  var ap = d.estado.aprobaciones_pendientes, av = d.estado.avisos_activos;

  var bluf;
  if (sal.global === 'crit') bluf = 'Salud en CRÍTICO — estabilizá el sistema antes que nada.';
  else if (vencidas.length) bluf = vencidas.length + ' tarea(s) vencida(s) pidiendo cierre.';
  else if (ap) bluf = ap + ' aprobación(es) esperando tu decisión.';
  else if (av) bluf = av + ' aviso(s) activo(s) para revisar.';
  else bluf = 'Sin urgencias — día para avanzar lo importante, no lo ruidoso.';

  var L = [];
  L.push('# Brief — Satori — ' + hoyISO());
  L.push('');
  L.push('**' + bluf + '**');
  L.push('');
  L.push('## Las 3 cosas de hoy');
  var tres = abiertas.slice(0, 3);
  if (tres.length) tres.forEach(function (t, i) {
    var cli = clienteDeProyecto(t.id_proyecto);
    L.push((i + 1) + '. [' + (t.prioridad || '—') + '] ' + t.descripcion +
      (esVencida(t.fecha_limite, t.estado) ? ' · VENCIDA ' + aFechaISO(t.fecha_limite) : (t.fecha_limite ? ' · ' + aFechaISO(t.fecha_limite) : '')) +
      (cli ? ' · ' + cli : ''));
  });
  else L.push('1. (sin tareas abiertas — definí 1 movida hacia tu objetivo)');
  L.push('');
  L.push('## Números');
  L.push('- Cartera: ' + d.estado.clientes + ' clientes · ' + abiertas.length + ' tareas abiertas (' + vencidas.length + ' vencidas) · ' + ap + ' aprobaciones · ' + av + ' avisos');
  L.push('- Salud: ' + String(sal.global).toUpperCase() + ' (' + sal.integridad + '%)');
  L.push('');
  L.push('## Movimiento reciente');
  var feed = feedReciente_(5);
  if (feed.length) feed.forEach(function (f) { L.push('- ' + f.ts + ' · ' + f.agente + ': ' + f.texto); });
  else L.push('- (sin actividad reciente)');
  L.push('');
  L.push('— generado por briefDiario()');
  return L.join('\n');
}

/** Brief por CLIENTE: foco en el North Star + 3 cosas + números del cliente. */
function briefDiarioCliente_(id) {
  var dc;
  try { dc = datosCliente(id); }
  catch (e) { return '# Brief — ' + id + '\n\n(cliente no encontrado: ' + e.message + ')'; }
  var c = dc.cliente;
  var cs = null; try { cs = abrirCliente(id).ss; } catch (e) { cs = null; }
  var objSh = cs && cs.getSheetByName('objetivos');
  var obj = objSh ? leerTabla(objSh) : [];
  var abiertas = dc.proximos_pasos; // ya filtradas+ordenadas por cliente (con .vencida y .fecha_limite)
  var vencidas = abiertas.filter(function (t) { return t.vencida; });
  var aprob = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas')).filter(function (a) { return a.id_cliente === id; });
  var ns = obj.length ? obj[0] : null;

  var bluf;
  if (vencidas.length) bluf = vencidas.length + ' tarea(s) vencida(s) de ' + c.nombre + '.';
  else if (aprob.length) bluf = aprob.length + ' aprobación(es) pendiente(s) de ' + c.nombre + '.';
  else if (ns) bluf = 'Foco: ' + (ns.descripcion || 'objetivo') + (ns.metrica ? ' (' + ns.metrica + '→' + ns.valor_objetivo + ')' : '') + '.';
  else bluf = c.nombre + ' sin North Star definido — definí 1 objetivo.';

  var L = [];
  L.push('# Brief — ' + c.nombre + ' (' + id + ') — ' + hoyISO());
  L.push('');
  L.push('**' + bluf + '**');
  L.push('');
  if (ns) {
    L.push('## North Star');
    L.push('- [' + (ns.horizonte || '—') + '] ' + (ns.descripcion || '—') + (ns.metrica ? ' · meta ' + ns.metrica + '=' + ns.valor_objetivo : ''));
    L.push('');
  }
  L.push('## Las 3 cosas de hoy');
  var tres = abiertas.slice(0, 3);
  if (tres.length) tres.forEach(function (t, i) {
    L.push((i + 1) + '. [' + (t.prioridad || '—') + '] ' + t.descripcion +
      (t.vencida ? ' · VENCIDA ' + t.fecha_limite : (t.fecha_limite ? ' · ' + t.fecha_limite : '')));
  });
  else L.push('1. (sin tareas abiertas para ' + c.nombre + ')');
  L.push('');
  L.push('## Números');
  L.push('- Proyectos: ' + dc.proyectos.length + ' · Tareas abiertas: ' + abiertas.length + ' (' + vencidas.length + ' vencidas) · Aprobaciones: ' + aprob.length);
  L.push('');
  L.push('— generado por briefDiario(\'' + id + '\')');
  return L.join('\n');
}
