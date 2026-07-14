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

  var ns = northStarSatori_();
  if (ns) {
    L.push('## North Star');
    L.push('- ' + ns.desc + (ns.horizonte ? ' (horizonte ' + ns.horizonte + ')' : ''));
    L.push('- Progreso: ' + ns.actual + (ns.meta != null ? '/' + ns.meta : '') + ' clientes activos/piloto (proxy de "pagos")');
    L.push('');
  }

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

// SPEC-GAS 14-jul (incidente 08:22 = doPost brief colgado 24-31s). El render de briefDiario es CARO:
// estadoSalud() (los 6 chequeos de correrSalud) + Tareas entera. Bajo contención (CM polleando) el doPost
// se iba a 30s+ y la voz colgaba. Read-only ⇒ solo TTL, sin invalidación. CacheService = strings ≤100KB.
var _BRIEF_CACHE_TTL = 600;         // voz: 10 min (una consulta cada tanto reusa el render)
var _BRIEF_CACHE_TTL_WARM = 21600;  // corridaDiaria calienta 6h → la consulta de la mañana es HIT instantáneo

/**
 * Cache corto del brief para la VOZ. Lee el cache (get endurecido: si tira por cuota no rompe, cae a
 * render); solo si no hay hit renderiza y cachea con TTL corto. SOLO la ruta de LECTURA por voz pasa por
 * acá; corridaDiaria y demás llaman briefDiario directo (siempre fresco). Clave por idCliente.
 */
function briefCacheado_(idCliente) {
  var cache = CacheService.getScriptCache();
  var key = 'brief_v1_' + (idCliente ? String(idCliente) : 'SISTEMA');
  var hit = null;
  try { hit = cache.get(key); } catch (e) { /* get puede tirar por cuota → render */ }
  if (hit) return hit;
  var md = briefDiario(idCliente || undefined);
  try { cache.put(key, md, _BRIEF_CACHE_TTL); } catch (e) { /* >100KB u otro → sin cache, nunca rompe */ }
  return md;
}

/**
 * Calienta el cache del brief de SISTEMA al CIERRE de corridaDiaria (TTL 6h) con el render fresco de la
 * corrida recién terminada → la consulta de voz "el brief del día" de la mañana es HIT instantáneo, sin
 * el render frío que colgaba el doPost. Falla-silenciosa: nunca rompe la corrida.
 */
function calentarBriefCacheSistema_() {
  try {
    var md = briefDiarioSistema_();
    CacheService.getScriptCache().put('brief_v1_SISTEMA', md, _BRIEF_CACHE_TTL_WARM);
    Logger.log('brief-cache SISTEMA calentado (TTL ' + _BRIEF_CACHE_TTL_WARM + 's)');
  } catch (e) { try { Logger.log('calentarBriefCache falló: ' + e); } catch (_e) {} }
}

/**
 * Verificación de editor (SPEC-GAS 14-jul): fuerza cache frío, mide 2 llamadas a briefCacheado_ y loguea
 * el antes/después. Esperado: 1a = render (miss, segundos), 2a = cache (hit, <1s). Correr en el editor GAS.
 */
function verifBriefCache_() {
  try { CacheService.getScriptCache().remove('brief_v1_SISTEMA'); } catch (e) {}
  var t1 = Date.now(); briefCacheado_(); var ms1 = Date.now() - t1;
  var t2 = Date.now(); briefCacheado_(); var ms2 = Date.now() - t2;
  var msg = 'voz-timing brief render(miss)=' + ms1 + 'ms  cache(hit)=' + ms2 + 'ms  hit_rapido=' + (ms2 < 1000);
  Logger.log(msg); try { console.log(msg); } catch (e) {}
  return { render_ms: ms1, cache_ms: ms2, hit_rapido: ms2 < 1000 };
}

/** Brief de SISTEMA (Satori): la movida más urgente + 3 cosas + números + feed. */
function briefDiarioSistema_() {
  var d = datosHoy();
  var sal = estadoSalud();
  var abiertas = tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas')));
  var vencidas = abiertas.filter(function (t) { return esVencida(t.fecha_limite, t.estado); });
  var ap = d.estado.aprobaciones_pendientes, av = d.estado.avisos_activos;

  // A2 (08-jul): BLUF anclado — cita el dato que lo sustenta (espejo honesto, no oráculo).
  var bluf;
  if (sal.global === 'crit') bluf = 'Salud en CRÍTICO (integridad ' + sal.integridad + '%) — estabilizá el sistema antes que nada.';
  else if (vencidas.length) {
    var vB = vencidas.slice().sort(function (a, b) { return String(aFechaISO(a.fecha_limite)) < String(aFechaISO(b.fecha_limite)) ? -1 : 1; })[0];
    var dB = _diasDesde_(vB.fecha_limite);
    bluf = vencidas.length + ' tarea(s) vencida(s) pidiendo cierre' + (dB != null ? ' — la más vieja lleva ' + dB + ' día(s)' : '') + '.';
  }
  else if (ap) bluf = ap + ' aprobación(es) esperando tu decisión.';
  else if (av) bluf = av + ' aviso(s) activo(s) para revisar.';
  else bluf = 'Sin urgencias — día para avanzar lo importante, no lo ruidoso.';

  var L = [];
  L.push('# Brief — Satori — ' + hoyISO());
  L.push('');
  L.push('**' + bluf + '**');
  L.push('');
  var ns = northStarSatori_();
  if (ns) {
    L.push('## North Star');
    L.push('- ' + ns.desc + (ns.meta != null ? ' · ' + ns.actual + '/' + ns.meta : '') + (ns.horizonte ? ' · ' + ns.horizonte : ''));
    L.push('');
  }
  // P2 F2 (07-jul) — contrato de status report fijo (Luke R3): métrica (arriba) →
  // qué espera decisión → plan → números → auto-resuelto → recomendación única.
  L.push('## Espera tu decisión');
  var ban = leerTabla(getMaestro().getSheetByName('Bandeja'));
  var banEsc = ban.filter(function (b) { return String(b.estado) === 'escalado'; }).length;
  L.push('- ' + ap + ' aprobación(es) · ' + av + ' aviso(s) activo(s) · ' + banEsc + ' escalado(s) de Bandeja');
  d.avisos.slice(0, 3).forEach(function (a) {
    L.push('- [' + (a.tipo || 'aviso') + '] ' + truncar_(a.mensaje || '', 110));
  });
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
  L.push('## Se auto-resolvió (agentes, últimas corridas)');
  var feed = feedReciente_(5);
  if (feed.length) feed.forEach(function (f) { L.push('- ' + f.ts + ' · ' + f.agente + ': ' + truncar_(f.texto, 120)); });
  else L.push('- (sin actividad reciente)');
  L.push('');
  L.push('## Qué primero (recomendación)');
  var rec = recomendacionDelDia_({ d: d, sal: sal, abiertas: abiertas, vencidas: vencidas });
  L.push('- ' + rec.texto);
  L.push('- ¿Sirvió este brief? Marcalo con 1 clic en el Centro de Mando (alimenta el lazo de resultados).');
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

  // A2 (08-jul): juicio anclado en KPIs del CLIENTE — si hay KPI en alerta, el juicio lo cita.
  var kpisCli = (cs && cs.getSheetByName('KPIs')) ? leerTabla(cs.getSheetByName('KPIs')) : [];
  var kpisAlerta = kpisCli.filter(function (k) { return String(k.alerta || '') !== ''; });

  var bluf;
  if (vencidas.length) bluf = vencidas.length + ' tarea(s) vencida(s) de ' + c.nombre + '.';
  else if (aprob.length) bluf = aprob.length + ' aprobación(es) pendiente(s) de ' + c.nombre + '.';
  else if (kpisAlerta.length) {
    var k0 = kpisAlerta[kpisAlerta.length - 1];
    bluf = 'Atender ' + (k0.kpi || 'el KPI en alerta') + ' = ' + k0.valor + ((k0.objetivo !== '' && k0.objetivo != null) ? ' (objetivo ' + k0.objetivo + ')' : '') + ' — ' + truncar_(String(k0.alerta), 80);
  }
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
  // A2 (08-jul): señal de KPIs — cada juicio cita el dato del cliente (últimas 3 alertas).
  if (kpisAlerta.length) {
    L.push('## Señal de KPIs');
    kpisAlerta.slice(-3).forEach(function (k) {
      L.push('- ' + (k.kpi || '—') + ' = ' + k.valor +
        ((k.objetivo !== '' && k.objetivo != null) ? ' (objetivo ' + k.objetivo + ')' : '') +
        ' ⚠ ' + truncar_(String(k.alerta), 90) +
        (k.fecha ? ' · ' + aFechaISO(k.fecha) : ''));
    });
    L.push('');
  }
  L.push('— generado por briefDiario(\'' + id + '\')');
  return L.join('\n');
}

// ── MUST #3 — North Star de Satori (nivel sistema, en Config) ─────────────────

/**
 * North Star de Satori a nivel sistema (la consultora). Vive en Config (no es un tenant).
 * Progreso = proxy "clientes pagos en paralelo" = clientes en estado activo/activo-piloto
 * (no hay flag 'pago' explícito en Clientes; supuesto a refinar). null si no está definido.
 */
function northStarSatori_() {
  var desc = getConfig('ns_satori_desc');
  if (!desc) return null;
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes'));
  var pagos = clientes.filter(function (c) { return ['activo', 'activo-piloto'].indexOf(String(c.estado).toLowerCase()) >= 0; }).length;
  var meta = parseInt(getConfig('ns_satori_valor'), 10);
  return { desc: desc, metrica: getConfig('ns_satori_metrica'), valor: getConfig('ns_satori_valor'), horizonte: _hzLimpio_(getConfig('ns_satori_horizonte')), actual: pagos, meta: isNaN(meta) ? null : meta };
}

/** Normaliza una fecha que Config pudo coaccionar a Date-string ("Thu Dec 31 2026 …") → YYYY-MM-DD. */
function _hzLimpio_(v) {
  v = String(v == null ? '' : v);
  if (v.indexOf('GMT') >= 0) { var d = new Date(v); if (!isNaN(d.getTime())) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
  return v;
}

/** Puesta en marcha — EDITAR y correr desde el editor para fijar/cambiar el North Star de Satori. */
function cargarNorthStarSatori() {
  setConfig('ns_satori_desc', 'Gestionar 6 clientes pagos en paralelo, cada mes, entre servicios (resto de 2026)');
  setConfig('ns_satori_metrica', 'clientes_pagos_paralelo');
  setConfig('ns_satori_valor', '6');
  setConfig('ns_satori_horizonte', '2026-12-31');
  Logger.log('North Star Satori seteado.');
  return northStarSatori_();
}

/**
 * Puesta en marcha — North Star de Vehemence (CLI-002). Wrapper SIN argumentos para correr
 * desde el dropdown del editor (que no pasa parámetros). EDITAR el target real y re-correr.
 * Reusa cargarObjetivo (15_cerebro) → escribe en la pestaña `objetivos` del Sheet de Vehemence.
 */
function cargarNorthStarVehemence() {
  // Vehemence opera en ARS. AOV real ≈ $104k/orden (may/jun 2026) → target propuesto $120.000 (+~15%); ajustar.
  // id_objetivo:'OBJ-0001' → actualiza el objetivo existente en lugar (no duplica).
  return cargarObjetivo('CLI-002', { id_objetivo: 'OBJ-0001', descripcion: 'Subir el ticket promedio (AOV)', metrica: 'ticket_promedio_ars', valor_objetivo: 120000, horizonte: '12m', prioridad: 'A' });
}

/** Ver Vehemence (CLI-002) desde el editor: loguea su estado vigente + su brief. No-arg. */
function verVehemence() {
  estadoVigente('CLI-002');
  briefDiario('CLI-002');
  return 'estado vigente + brief de Vehemence (CLI-002) — ver el log';
}

/** Colapsa espacios/saltos y trunca a n chars con … (para que el feed largo no ensucie el brief). */
function truncar_(s, n) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ── P2 F4 (07-jul) — Lazo de resultados: recomendó → se hizo → el KPI se movió ─

/** Días enteros desde una fecha ISO hasta hoy (0 si es hoy; null si no parsea o es futura). */
function _diasDesde_(v) {
  var f = String(aFechaISO(v) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
  var ms = new Date(hoyISO() + 'T00:00:00').getTime() - new Date(f + 'T00:00:00').getTime();
  var dias = Math.round(ms / 86400000);
  return dias >= 0 ? dias : null;
}

/**
 * Regla ÚNICA de la recomendación del día (la misma que muestra el brief y la que
 * se registra). `pre` opcional {d, sal, abiertas, vencidas, kpiAlerta} evita re-leer
 * si el caller ya lo tiene (briefDiario); sin `pre` es self-contained (corridaDiaria).
 * `pre.kpiAlerta` (A3, 08-jul): inyectable para asserts; undefined → escanea las hojas
 * KPIs de los clientes (clienteKpiEnAlerta_) para anclar la rec a un cliente.
 *
 * Trillion-delta A2 (08-jul) — JUICIO ANCLADO: cada recomendación cita el dato real
 * que la sustenta (días vencida, integridad %, espera de la aprobación, progreso NS).
 * Espejo honesto, no oráculo: solo datos que están en las hojas, sin proyecciones.
 * Devuelve {texto, kpi, id_cliente, dato}: id_cliente ('' si no mapea a un tenant)
 * habilita B2 ("→ Aprobación" en el CM); dato es el ancla cruda (asserts D9).
 */
function recomendacionDelDia_(pre) {
  var d = (pre && pre.d) || datosHoy();
  var sal = (pre && pre.sal) || estadoSalud();
  var abiertas = (pre && pre.abiertas) || tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas')));
  var vencidas = (pre && pre.vencidas) || abiertas.filter(function (t) { return esVencida(t.fecha_limite, t.estado); });
  var ap = d.estado.aprobaciones_pendientes;

  if (sal.global === 'crit') {
    var h0 = (sal.hallazgos || []).filter(function (h) { return h.estado !== 'ok'; })[0];
    return {
      texto: 'Estabilizar la salud del sistema — está en CRÍTICO (integridad ' + sal.integridad + '%' + (h0 ? '; ' + h0.nombre : '') + ') antes de cualquier otra cosa.',
      kpi: 'salud', id_cliente: '', dato: 'integridad=' + sal.integridad + '%'
    };
  }

  if (vencidas.length) {
    // la MÁS VIEJA de verdad (por fecha límite), no la primera del orden de prioridad
    var v0 = vencidas.slice().sort(function (a, b) { return String(aFechaISO(a.fecha_limite)) < String(aFechaISO(b.fecha_limite)) ? -1 : 1; })[0];
    var diasV = _diasDesde_(v0.fecha_limite);
    var cliV = String(v0.id_proyecto ? (clienteDeProyecto(v0.id_proyecto) || '') : '');
    return {
      texto: 'Cerrar la vencida más vieja — lleva ' + (diasV == null ? '?' : diasV) + ' día(s) vencida (de ' + vencidas.length + ' vencidas): ' + truncar_(v0.descripcion, 80) + (cliV ? ' · ' + cliV : ''),
      kpi: 'tareas_vencidas', id_cliente: cliV, dato: 'vencidas=' + vencidas.length + ';dias=' + diasV
    };
  }

  // A3 (08-jul): KPI de CLIENTE en alerta → recomendación ANCLADA al cliente (id_cliente set)
  // → el botón "→ Crear aprobación" cobra sentido en el uso real, sin depender de proyectos.
  var ka = (pre && pre.kpiAlerta !== undefined) ? pre.kpiAlerta : clienteKpiEnAlerta_();
  if (ka && ka.id_cliente) {
    var objK = (ka.objetivo === '' || ka.objetivo == null) ? '' : ' (objetivo ' + ka.objetivo + ')';
    return {
      texto: 'Atender ' + (ka.kpi || 'el KPI') + ' de ' + (ka.cliente || ka.id_cliente) + ' = ' + ka.valor + objK + ' — ' + truncar_(String(ka.alerta || ''), 70),
      kpi: 'kpi_cliente', id_cliente: String(ka.id_cliente), dato: 'kpi=' + (ka.kpi || '') + ';valor=' + ka.valor
    };
  }

  if (ap) {
    var ancla = '';
    try { // lazy: solo en esta rama, hoja chica del MAESTRO
      var pend = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas')).filter(function (a) { return String(a.estado).toLowerCase() === 'pendiente'; });
      if (pend.length) {
        var p0 = pend.slice().sort(function (a, b) { return String(aFechaISO(a.fecha_creacion)) < String(aFechaISO(b.fecha_creacion)) ? -1 : 1; })[0];
        var diasA = _diasDesde_(p0.fecha_creacion);
        ancla = ' — la más vieja (' + (p0.cliente || p0.id_cliente || '—') + ') espera hace ' + (diasA == null ? '?' : diasA) + ' día(s)';
      }
    } catch (e) { /* sin ancla, la recomendación sigue */ }
    return {
      texto: 'Despachar las ' + ap + ' aprobación(es) pendiente(s)' + ancla + ' — desbloquean a los agentes.',
      kpi: 'aprobaciones_pendientes', id_cliente: '', dato: 'pendientes=' + ap
    };
  }

  if (abiertas.length) {
    var t0 = abiertas[0];
    var cliT = String(t0.id_proyecto ? (clienteDeProyecto(t0.id_proyecto) || '') : '');
    var lim = t0.fecha_limite ? String(aFechaISO(t0.fecha_limite)) : '';
    return {
      texto: 'Arrancar por: [' + (t0.prioridad || '—') + '] ' + truncar_(t0.descripcion, 80) + (lim ? ' · vence ' + lim : '') + (cliT ? ' · ' + cliT : ''),
      kpi: 'north_star', id_cliente: cliT, dato: lim ? 'limite=' + lim : ''
    };
  }

  var ns = northStarSatori_();
  return {
    texto: 'Definir la próxima movida hacia el North Star' + (ns && ns.meta != null ? ' — vas ' + ns.actual + '/' + ns.meta + ' (' + ns.desc + ')' : '') + '.',
    kpi: 'north_star', id_cliente: '', dato: ns ? 'progreso=' + ns.actual + '/' + (ns.meta == null ? '—' : ns.meta) : ''
  };
}

/**
 * Primer cliente con un KPI en alerta (columna `alerta` no vacía en su hoja KPIs).
 * Fuente del anclaje a cliente de recomendacionDelDia_ (A3). Abre las hojas cliente,
 * por eso solo corre en llamadas de baja frecuencia (corrida/brief), NO en cada carga
 * del CM (datosHoy no llama a recomendacionDelDia_). Fail-safe: cliente ilegible se
 * saltea; null si no hay alerta.
 * @return {?{id_cliente:string, cliente:string, kpi:string, valor:*, objetivo:*, alerta:string}}
 */
function clienteKpiEnAlerta_() {
  try {
    var clientes = leerTabla(getMaestro().getSheetByName('Clientes'));
    for (var i = 0; i < clientes.length; i++) {
      var cli = clientes[i];
      if (!cli.url_sheet_cliente) continue;
      var sh;
      try { sh = SpreadsheetApp.openByUrl(cli.url_sheet_cliente).getSheetByName('KPIs'); } catch (e) { continue; }
      if (!sh) continue;
      var enAlerta = leerTabla(sh).filter(function (k) { return String(k.alerta || '') !== ''; });
      if (enAlerta.length) {
        var k0 = enAlerta[enAlerta.length - 1];
        return {
          id_cliente: cli.id_cliente, cliente: cli.nombre, kpi: String(k0.kpi || 'KPI'),
          valor: (k0.valor === undefined ? '' : k0.valor),
          objetivo: (k0.objetivo === undefined ? '' : k0.objetivo), alerta: String(k0.alerta || '')
        };
      }
    }
  } catch (e) { /* sin alerta accesible → sigue el resto de la lógica */ }
  return null;
}

/**
 * Registra la recomendación del día en la hoja Recomendaciones (estado 'abierta').
 * Dedupe por ESENCIA (kpi_objetivo + id_cliente entre abiertas), no por texto: el texto
 * anclado de A2 cambia a diario ("lleva N día(s)") y dedupear por texto acumularía una
 * fila abierta por día para la misma situación (purga 08-jul). Mientras el humano no
 * cierre el lazo de esa situación, no se apila otra. La llama corridaDiaria (1/día
 * efectivo); el brief solo la MUESTRA (no escribe).
 */
function registrarRecomendacionDelDia() {
  var sh = getMaestro().getSheetByName('Recomendaciones');
  if (!sh) return { ok: false, motivo: 'falta hoja Recomendaciones (correr setup)' };
  var r = recomendacionDelDia_();
  return conLock(function () {
    var ya = leerTabla(sh).filter(function (f) {
      return String(f.estado) === 'abierta' &&
        (String(f.texto) === r.texto ||
          (String(f.kpi_objetivo) === String(r.kpi) && String(f.id_cliente || '') === String(r.id_cliente || '')));
    })[0];
    if (ya) return { ok: true, id: ya.id, dedupe: true };
    var id = nextId(sh, 'id', 'REC', 4);
    // id_cliente (B2): si el header aún no existe (setup pendiente), appendFila lo ignora — degradación limpia.
    appendFila(sh, { id: id, fecha: hoyISO(), texto: r.texto, kpi_objetivo: r.kpi, se_hizo: '', kpi_movio: '', estado: 'abierta', cerrada_en: '', id_cliente: String(r.id_cliente || '') });
    return { ok: true, id: id };
  });
}

/**
 * CM: marca 'se_hizo' o 'kpi_movio' ('si'/'no') de una recomendación abierta.
 * Cuando ambos campos quedan seteados → estado 'cerrada' + cerrada_en. Juicio humano, no automático.
 */
function marcarRecomendacion(id, campo, valor) {
  if (['se_hizo', 'kpi_movio'].indexOf(String(campo)) < 0) throw new Error('campo inválido: ' + campo);
  var v = String(valor).toLowerCase() === 'si' ? 'si' : 'no';
  var sh = getMaestro().getSheetByName('Recomendaciones');
  if (!sh) throw new Error('Falta la hoja Recomendaciones — correr setup().');
  return conLock(function () {
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    function setCol(filaN, col, val) { var i = headers.indexOf(col); if (i >= 0) sh.getRange(filaN, i + 1).setValue(sanitizarCelda(val)); }
    var f = leerTabla(sh).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!f) throw new Error('Recomendación no encontrada: ' + id);
    setCol(f._fila, campo, v);
    var otroVal = campo === 'se_hizo' ? String(f.kpi_movio || '') : String(f.se_hizo || '');
    if (otroVal) { setCol(f._fila, 'estado', 'cerrada'); setCol(f._fila, 'cerrada_en', ahoraISO()); }
    return { ok: true, id: id, cerrada: !!otroVal };
  });
}

/**
 * Trillion-delta B2 (08-jul) — el brief DECIDE: convierte una recomendación abierta en
 * una aprobación P1 del cliente al que refiere. Extiende F4+F5, no crea sistema paralelo:
 * reusa crearAprobacion (default-deny: 'ejecutar_recomendacion' sin monto → P1) y la
 * aprobación entra a la cola/lote existentes del CM vía sync. Reglas duras:
 *  - Sin id_cliente NO se crea nada (Satori no es tenant — decisión firme 07-jul);
 *    el seguimiento de esas queda en el lazo (2 juicios), como hasta ahora.
 *  - Dedupe por rec_id: una recomendación genera a lo sumo UNA aprobación pendiente.
 *  - No marca se_hizo: el juicio del lazo sigue siendo humano (F4 intacto).
 * @param {string} recId  id de la hoja Recomendaciones (REC-####)
 * @return {{ok:boolean, id?:string, patron?:string, dedupe?:boolean, motivo?:string}}
 */
function aprobacionDesdeRecomendacion(recId) {
  var sh = getMaestro().getSheetByName('Recomendaciones');
  if (!sh) return { ok: false, motivo: 'falta hoja Recomendaciones (correr setup)' };
  var rec = leerTabla(sh).filter(function (f) { return String(f.id) === String(recId); })[0];
  if (!rec) return { ok: false, motivo: 'recomendación no encontrada: ' + recId };
  if (String(rec.estado) !== 'abierta') return { ok: false, motivo: 'la recomendación no está abierta (estado: ' + rec.estado + ')' };
  var idc = String(rec.id_cliente || '');
  if (!idc) return { ok: false, motivo: 'la recomendación no refiere a un cliente — seguila por el lazo (¿se hizo? / ¿movió el KPI?)' };

  var shAp;
  try { shAp = abrirCliente(idc).ss.getSheetByName('Aprobaciones'); }
  catch (e) { return { ok: false, motivo: 'cliente ' + idc + ': ' + e.message }; }
  if (!shAp) return { ok: false, motivo: 'cliente ' + idc + ' sin pestaña Aprobaciones' };

  var marca = '"rec_id":"' + String(recId) + '"';
  var ya = leerTabla(shAp).filter(function (a) {
    return String(a.estado).toLowerCase() === 'pendiente' && String(a.payload || '').indexOf(marca) >= 0;
  })[0];
  if (ya) return { ok: true, id: ya.id, dedupe: true };

  var apr = crearAprobacion(idc, 'direccion', 'ejecutar_recomendacion',
    { rec_id: String(recId), kpi: String(rec.kpi_objetivo || ''), texto: String(rec.texto || '') },
    { descripcion: 'Recomendación del día → ' + truncar_(String(rec.texto || ''), 90) });
  try { syncMaestro(); } catch (e) { /* la agregada llega con la próxima sync */ }
  return { ok: true, id: apr.id, patron: apr.patron };
}

/** CM: recomendaciones abiertas (vista del lazo en la card del brief). */
function recomendacionesAbiertas() {
  var sh = getMaestro().getSheetByName('Recomendaciones');
  if (!sh) return [];
  return leerTabla(sh).filter(function (f) { return String(f.estado) === 'abierta'; }).map(function (f) {
    return { id: f.id, fecha: aFechaISO(f.fecha), texto: String(f.texto || ''), kpi: String(f.kpi_objetivo || ''), se_hizo: String(f.se_hizo || ''), kpi_movio: String(f.kpi_movio || ''), id_cliente: String(f.id_cliente || '') };
  });
}

// ── Agenda semanal (07-jul, norte v9 §3.5 — opción A: pestaña MAESTRO, sin scope Calendar) ──

/** CM: eventos de HOY a +7 días desde la pestaña Agenda, ordenados. Estado != cancelado. */
function agendaSemana() {
  var sh = getMaestro().getSheetByName('Agenda');
  if (!sh) return [];
  var hoy = hoyISO();
  var fin = Utilities.formatDate(new Date(Date.now() + 7 * 86400000), TZ, 'yyyy-MM-dd');
  return leerTabla(sh)
    .map(function (f) { return { id: f.id, fecha: aFechaISO(f.fecha), hora: String(f.hora || ''), titulo: String(f.titulo || ''), id_cliente: String(f.id_cliente || ''), notas: String(f.notas || ''), estado: String(f.estado || '') }; })
    .filter(function (e) { return e.fecha >= hoy && e.fecha <= fin && e.estado !== 'cancelado' && e.titulo; })
    .sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; })
    .slice(0, 20);
}

/** Alta rápida de evento (CM o editor). fecha YYYY-MM-DD, hora HH:mm opcional. */
function agendarEvento(fecha, hora, titulo, idCliente, notas) {
  if (!fecha || !titulo) throw new Error('agendarEvento: falta fecha o titulo.');
  var sh = getMaestro().getSheetByName('Agenda');
  if (!sh) throw new Error('Falta la hoja Agenda — correr setup().');
  return conLock(function () {
    var id = nextId(sh, 'id', 'AGE', 4);
    appendFila(sh, { id: id, fecha: String(fecha), hora: String(hora || ''), titulo: String(titulo), id_cliente: String(idCliente || ''), notas: String(notas || ''), estado: 'activo' });
    return id;
  });
}

/**
 * CM (calendario semanal/mensual, v11): eventos en [desdeISO, hastaISO] inclusive
 * (YYYY-MM-DD). Read-only, mismo shape que agendaSemana. Cap defensivo 200.
 * NO reemplaza a agendaSemana (esa queda tal cual para voz/vistas "próximos 7 días").
 */
function agendaRango(desdeISO, hastaISO) {
  var sh = getMaestro().getSheetByName('Agenda');
  if (!sh) return [];
  var d = String(desdeISO || ''), h = String(hastaISO || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(h) || h < d) return [];
  return leerTabla(sh)
    .map(function (f) { return { id: f.id, fecha: aFechaISO(f.fecha), hora: String(f.hora || ''), titulo: String(f.titulo || ''), id_cliente: String(f.id_cliente || ''), notas: String(f.notas || ''), estado: String(f.estado || '') }; })
    .filter(function (e) { return e.fecha >= d && e.fecha <= h && e.estado !== 'cancelado' && e.titulo; })
    .sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; })
    .slice(0, 200);
}

// ── P2 F1 (07-jul) — Feedback 1-clic: semilla del lazo de resultados ─────────

/**
 * registrarFeedback(origenTipo, origenId, util, [nota]) — append-only a la hoja Feedback.
 * Lo llama el CM (google.script.run) desde los botones "¿Sirvió?" del brief.
 * util: 'si' | 'no'. origenTipo: 'brief' | 'aviso' | 'recomendacion'. Devuelve el id.
 */
function registrarFeedback(origenTipo, origenId, util, nota) {
  var u = String(util).toLowerCase() === 'si' ? 'si' : 'no';
  var sh = getMaestro().getSheetByName('Feedback');
  if (!sh) throw new Error('Falta la hoja Feedback — correr setup() para crearla.');
  return conLock(function () {
    var id = nextId(sh, 'id', 'FBK', 4);
    appendFila(sh, {
      id: id,
      ts: ahoraISO(),
      origen_tipo: String(origenTipo || 'brief'),
      origen_id: String(origenId || hoyISO()),
      util: u,
      nota: truncar_(nota || '', 200)
    });
    return id;
  });
}
