/**
 * 09_selftest.js — Verificación end-to-end (handoff: "ejecutar, no asumir").
 *
 * selfTest() cubre los casos de aceptación mínimos:
 *  (a) crearCliente() genera el Sheet cliente completo de una;
 *  (b) una aprobación pendiente creada en el cliente aparece agregada en el
 *      maestro tras syncMaestro();
 *  (c) corridaDiaria() corre y escribe Avisos;
 *  (d) el esquema soporta default-deny (monto sin fila en Umbrales).
 * Limpia su cliente de prueba al final (lo manda a la papelera — reversible).
 */
function selfTest() {
  var log = [];
  function chk(cond, msg) { log.push((cond ? '✅ ' : '❌ ') + msg); if (!cond) throw new Error('FALLO: ' + msg); }

  try {
    // 0) setup idempotente
    var s = setup();

    // Pre-clean: barre restos de corridas anteriores para que las aserciones no se
    // contaminen con un cliente/fila __TEST__ huérfano (Verificador). Va DESPUÉS de
    // setup() — limpiarTodoTest usa getMaestro() y reventaría en proyecto virgen (PURGA #15).
    limpiarTodoTest();
    chk(s.pestanas.length >= 9, 'MAESTRO con 9 pestañas (' + s.pestanas.length + ')');
    MAESTRO_ORDEN.forEach(function (n) { chk(s.pestanas.indexOf(n) >= 0, 'pestaña maestro: ' + n); });

    // a) crearCliente con nombre único de prueba
    var nombrePrueba = '__TEST__ ' + ahoraISO();
    var r = crearCliente({ nombre: nombrePrueba, rubro: 'test', estado: 'potencial' });
    chk(!!r.id_cliente && !r.ya_existia, 'crearCliente devolvió id nuevo: ' + r.id_cliente);
    var cliSS = SpreadsheetApp.openByUrl(r.url);
    CLIENTE_ORDEN.forEach(function (n) {
      chk(!!cliSS.getSheetByName(n), 'pestaña cliente: ' + n);
    });
    // sensibles ocultas
    CLIENTE_SHEETS_SENSIBLES.forEach(function (n) {
      chk(cliSS.getSheetByName(n).isSheetHidden(), 'pestaña sensible oculta: ' + n);
    });

    // b) crear una aprobación PENDIENTE en el cliente (d: monto sin fila en Umbrales)
    var shAp = cliSS.getSheetByName('Aprobaciones');
    appendFila(shAp, {
      id: 'APR-TEST-1', fecha_creacion: hoyISO(), cliente: nombrePrueba, modulo: 'test',
      patron: 'P2', tipo_accion: 'pago', descripcion: 'pago test default-deny',
      payload: '{}', monto: 999, 'confianza_%': 50, estado: 'pendiente'
    });
    chk(leerTabla(cliSS.getSheetByName('Umbrales')).length === 0, 'Umbrales vacío → default deny aplica');

    var sync = syncMaestro();
    var agg = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas'))
      .filter(function (f) { return f.id === 'APR-TEST-1' && f.cliente === nombrePrueba; });
    chk(agg.length === 1, 'aprobación pendiente del cliente aparece agregada en el maestro');
    chk(String(getConfig('ultima_sync_ok')) !== '', 'ultima_sync_ok seteado');

    // c) detector de vencidas escribe avisos (creamos una tarea vencida).
    // NB: se llama el detector directo, NO corridaDiaria() — en Etapa 2 esa encola
    // Vigía para clientes reales y consolida costos; correrla en el test tocaría producción.
    var shT = getMaestro().getSheetByName('Tareas');
    appendFila(shT, {
      id_tarea: 'TAR-TEST-1', id_proyecto: 'PRY-TEST', descripcion: 'tarea vencida test',
      prioridad: 'A', estado: 'en_curso', fecha_limite: '2020-01-01', fecha_creacion: '2020-01-01'
    });
    invalidarMapaPC();
    detectarVencimientos();
    var avisos = leerTabla(getMaestro().getSheetByName('Avisos'))
      .filter(function (f) { return String(f.mensaje).indexOf('TAR-TEST-1') >= 0; });
    chk(avisos.length >= 1, 'detectarVencimientos generó aviso de tarea vencida');

    // ── ETAPA 2 ───────────────────────────────────────────────────────────────
    // Releemos el Sheet del cliente con openByUrl FRESCO en cada aserción: las funciones
    // E2 escriben por su propia instancia (abrirCliente). La instancia cliSS abierta en (a)
    // no ve esas escrituras (cache de GAS de una instancia abierta ANTES del write);
    // open-after-write sí las ve. También se appendea/relee por instancia fresca.
    function aprCli() { return leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones')); }
    function regCli() { return leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Reglas')); }

    // E2-1) default-deny: crearAprobacion con monto y sin fila en Umbrales → PENDIENTE + P1.
    var apr1 = crearAprobacion(r.id_cliente, 'test', 'pago', { x: 1 }, { monto: 500, descripcion: 'pago test' });
    var aprRow = aprCli().filter(function (f) { return f.id === apr1.id; })[0];
    chk(!!aprRow && String(aprRow.estado).toLowerCase() === 'pendiente', 'E2-1 aprobación nace PENDIENTE');
    chk(apr1.patron === 'P1', 'E2-1 default-deny: monto sin umbral → P1 (' + apr1.patron + ')');

    // E2-4) regla desde excepción: nace 'propuesta' + P1; solo se activa al aprobar esa P1.
    var reg = crearReglaDesdeExcepcion(r.id_cliente, 'si X', 'hacer Y', 'test');
    var regRow = regCli().filter(function (f) { return f.id_regla === reg.id_regla; })[0];
    chk(!!regRow && String(regRow.estado) === 'propuesta', 'E2-4 regla nace "propuesta"');
    resolverAprobacion(r.id_cliente, reg.aprobacion.id, 'aprobada');
    var regRow2 = regCli().filter(function (f) { return f.id_regla === reg.id_regla; })[0];
    chk(regRow2 && String(regRow2.estado) === 'activa', 'E2-4 regla se activa SOLO tras aprobar la P1');

    // E2-2) expiración: pendiente con fecha de hace 8 días → "expirada", nada se ejecuta.
    appendFila(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones'), {
      id: 'APR-TEST-EXP', fecha_creacion: hace(8), cliente: nombrePrueba, modulo: 'test',
      patron: 'P1', tipo_accion: 'email', descripcion: 'expira test', payload: '{}', estado: 'pendiente'
    });
    SpreadsheetApp.flush();
    expirarAprobaciones(r.id_cliente); // acotado al cliente de prueba: no toca pendientes reales
    var expRow = aprCli().filter(function (f) { return f.id === 'APR-TEST-EXP'; })[0];
    chk(expRow && String(expRow.estado) === 'expirada', 'E2-2 pendiente >7d → expirada (el silencio no aprueba)');

    // E2-6) anonimización: email/teléfono salen tokenizados; el mapa revierte.
    var an = anonimizar('Escribir a ana@correo.com o al +34 600 123 456');
    chk(an.texto.indexOf('@correo.com') < 0 && /CLIENTA_EMAIL/.test(an.texto), 'E2-6 email anonimizado antes de salir');
    chk(desanonimizar(an.texto, an.mapa).indexOf('ana@correo.com') >= 0, 'E2-6 desanonimizar revierte');

    // Caso 7) cola durable: encolar + claim + ejecutar → completada (worker de prueba, no toca la cola real).
    var qid = encolar('__TESTWORKER__', 'noop', {});
    var tk = tomar_('__TESTWORKER__', 'test');
    chk(!!tk && tk.id === qid, 'caso7 claim atómico toma la tarea encolada');
    ejecutarTarea_(tk);
    var qrow = leerTabla(getMaestro().getSheetByName('Cola_tareas')).filter(function (f) { return f.id === qid; })[0];
    chk(qrow && String(qrow.estado) === 'completada', 'caso7 noop queda completada (drain-on-startup)');

    // Caso 10) laboratorio: agente no activo → error honesto, nunca corre.
    var lab = correrAgente_('flux', {}, 'TST', r.id_cliente);
    chk(lab.status === 'error' && /laboratorio/i.test(lab.detalle), 'caso10 agente de laboratorio no corre');

    // Caso 12) runner contra cliente sin datos → "sin datos aún", jamás inventa (sin llamar API).
    var sd = correrAgente_('vigia', {}, 'TST', r.id_cliente);
    chk(sd.status === 'completado' && sd.detalle === 'sin datos aún', 'caso12 sin datos = honesto');

    // ── ETAPA 8a · a1 — Cerebro (grafo de memoria por tenant) ──────────────────
    // crearCliente ya creó las pestañas del cerebro (CLIENTE_SHEETS). Tenant = r.id_cliente.
    var ceN1 = upsertNodo(r.id_cliente, { tipo: 'objetivo', etiqueta: 'nodo test' });
    chk(!!ceN1.id_nodo && ceN1.creado, 'E8a-1 upsertNodo crea nodo (' + ceN1.id_nodo + ')');
    chk(!upsertNodo(r.id_cliente, { id_nodo: ceN1.id_nodo, estado: 'cerrado' }).creado, 'E8a-1 upsert del mismo id actualiza (no duplica)');
    var ceN2 = upsertNodo(r.id_cliente, { tipo: 'tarea', etiqueta: 'nodo test 2' });
    var ceA = upsertArista(r.id_cliente, { origen: ceN1.id_nodo, destino: ceN2.id_nodo, tipo: 'contribuye_a' });
    chk(!!ceA.id_arista && ceA.creado, 'E8a-1 upsertArista crea arista');
    // Retrofit CEREBRO (doc canónico §3-4): ejes líder/negocio/sistema + cobertura + relacion
    chk(CLIENTE_SHEETS.nodos.indexOf('dimension') >= 0 && CLIENTE_SHEETS.nodos.indexOf('cobertura') >= 0, 'E8a-1 schema nodos canónico (dimension+cobertura)');
    chk(CLIENTE_SHEETS.aristas.indexOf('relacion') >= 0, 'E8a-1 schema aristas canónico (relacion)');
    chk(dimensionDeTipo_('tarea') === 'sistema' && dimensionDeTipo_('factura') === 'negocio' && dimensionDeTipo_('zzz') === 'negocio', 'E8a-1 dimensión por tipo (sistema/negocio + default)');
    logEvento(r.id_cliente, { evento: 'test_evento', origen: 'selftest', detalle: { x: 1 } });
    var ceLog = leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('cerebro_log'));
    chk(ceLog.length >= 4, 'E8a-1 cerebro_log append-only acumula eventos (' + ceLog.length + ')');
    var ceMat = materializarEstado(r.id_cliente);
    chk(ceMat.nodos === 2 && ceMat.aristas === 1, 'E8a-1 materializarEstado cuenta nodos/aristas');
    var ceEst = leerEstado(r.id_cliente);
    chk(ceEst.resumen && String(ceEst.resumen.nodos) === '2', 'E8a-1 leerEstado devuelve el snapshot materializado');
    chk(ceEst.nodos_por_dimension && String(ceEst.nodos_por_dimension.sistema) === '1' && String(ceEst.nodos_por_dimension.negocio) === '1', 'E8a-1 snapshot agrupa por eje (tarea→sistema, objetivo→negocio · tesis Satori)');
    var ceIdx = leerTabla(getMaestro().getSheetByName('Cerebro_index')).filter(function (f) { return f.id_cliente === r.id_cliente; })[0];
    chk(!!ceIdx && String(ceIdx.nodos) === '2', 'E8a-1 Cerebro_index agrega conteos en el MAESTRO (sin PII)');

    // ── ETAPA 8a · a2 — Director (orquestación dirigida por objetivos) ─────────
    appendFila(SpreadsheetApp.openByUrl(r.url).getSheetByName('objetivos'), {
      id_objetivo: 'OBJ-TEST-1', horizonte: '12m', descripcion: 'Subir margen neto', metrica: 'margen_%',
      valor_objetivo: 30, estado: 'activo', prioridad: 'A', fecha_objetivo: '2026-12-31'
    });
    var dir = correrDirector(r.id_cliente);
    chk(dir.tenants === 1 && dir.encolados >= 1, 'E8a-2 Director procesa el tenant y encola por objetivo (' + dir.encolados + ')');
    var ceNodosD = leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('nodos'));
    chk(ceNodosD.filter(function (n) { return String(n.dimension) === 'sistema'; }).length >= 5, 'E8a-2 Director pobla el cerebro: agentes SISTEMA (' + ceNodosD.filter(function (n) { return String(n.dimension) === 'sistema'; }).length + ')');
    chk(ceNodosD.filter(function (n) { return String(n.dimension) === 'negocio' && String(n.tipo) === 'objetivo'; }).length >= 1, 'E8a-2 Director pobla objetivos NEGOCIO');
    var ceParte = leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('cerebro_log')).filter(function (f) { return String(f.evento) === 'parte_director'; });
    chk(ceParte.length >= 1, 'E8a-2 Director escribe el "parte" al cerebro');
    var colaDir = leerTabla(getMaestro().getSheetByName('Cola_tareas')).filter(function (f) {
      var p = String(f.payload); return p.indexOf('"id_cliente":"' + r.id_cliente + '"') >= 0 && p.indexOf('analista') >= 0;
    });
    chk(colaDir.length >= 1, 'E8a-2 el Analista del objetivo quedó encolado en la cola');

    // ── ETAPA 8a · a3 — Salud (6 chequeos, dryRun: no escribe a producción) ────
    var sal = correrSalud({ dryRun: true });
    chk(sal.hallazgos.length === 6, 'E8a-3 Salud corre los 6 chequeos (' + sal.hallazgos.length + ')');
    chk(['ok', 'warn', 'crit'].indexOf(sal.global) >= 0, 'E8a-3 Salud clasifica el estado global (' + sal.global + ')');
    chk(sal.autoheal === false, 'E8a-3 auto-heal apagado en piloto (alerta, no arregla)');

    // ── Fase 1 — Bandeja + clasificador (plumbing, sin gastar API) ──────────────
    ensureSheet(getMaestro(), 'Bandeja', MAESTRO_SHEETS.Bandeja);
    var cap = capturar('__TEST__ idea de prueba para clasificar', '__TEST__');
    chk(/^BAN-\d+$/.test(cap.id), 'F1 capturar genera id de bandeja (' + cap.id + ')');
    var enBandeja = leerTabla(getMaestro().getSheetByName('Bandeja')).filter(function (f) { return f.id === cap.id && String(f.estado) === 'pendiente'; });
    chk(enBandeja.length === 1, 'F1 la captura nace pendiente en la Bandeja');
    var pc = parseClasificacion_('{"bin":"idea","confianza":8,"slug":"x","tags":"a,b","resumen":"r","id_cliente":""}');
    chk(!!pc && pc.bin === 'idea' && pc.confianza === 8, 'F1 parseClasificacion_ parsea el JSON del Haiku');
    var pcBad = parseClasificacion_('{"bin":"inventado","confianza":99}');
    chk(!!pcBad && pcBad.bin === 'escalate' && pcBad.confianza === 10, 'F1 parse: bin inválido→escalate + confianza clamp');
    chk(typeof bandejaUmbral_() === 'number', 'F1 umbral de confianza es numérico (' + bandejaUmbral_() + ')');

    // ── Fase D — Capa de Dirección · estadoVigente (snapshot MD, sin API) ──────
    var mdSys = estadoVigente();
    chk(typeof mdSys === 'string' && mdSys.indexOf('# Estado vigente — Satori OS') === 0, 'D1 estadoVigente() devuelve el snapshot de sistema en markdown');
    chk(/## Cartera/.test(mdSys) && /## Salud/.test(mdSys), 'D1 el snapshot de sistema trae Cartera + Salud');
    var mdCli = estadoVigente(r.id_cliente);
    chk(mdCli.indexOf(r.id_cliente) >= 0 && /## Objetivo \(North Star\)/.test(mdCli), 'D1 estadoVigente(cliente) trae el id + sección North Star (' + r.id_cliente + ')');

    // ── Fase D · MUST #2 — briefDiario (BLUF + 3 cosas, sin API) ───────────────
    var brSys = briefDiario();
    chk(typeof brSys === 'string' && brSys.indexOf('# Brief — Satori') === 0, 'D2 briefDiario() devuelve el brief de sistema');
    chk(/## Las 3 cosas de hoy/.test(brSys) && /\*\*/.test(brSys), 'D2 el brief trae BLUF + "Las 3 cosas de hoy"');
    var brCli = briefDiario(r.id_cliente);
    chk(brCli.indexOf(r.id_cliente) >= 0, 'D2 briefDiario(cliente) trae el id del cliente (' + r.id_cliente + ')');

    // ── Fase D · MUST #3 — North Star de Satori (Config + progreso; restaura prod) ──
    var nsB = { d: getConfig('ns_satori_desc'), m: getConfig('ns_satori_metrica'), v: getConfig('ns_satori_valor') };
    setConfig('ns_satori_desc', '__TEST__ NS'); setConfig('ns_satori_metrica', 'clientes_pagos'); setConfig('ns_satori_valor', '6');
    var nsT = northStarSatori_();
    chk(!!nsT && nsT.meta === 6 && typeof nsT.actual === 'number', 'D3 northStarSatori_ lee meta + calcula progreso (' + (nsT ? nsT.actual + '/' + nsT.meta : 'null') + ')');
    chk(/## North Star/.test(estadoVigente()), 'D3 el snapshot de sistema muestra el North Star de Satori');
    setConfig('ns_satori_desc', nsB.d); setConfig('ns_satori_metrica', nsB.m); setConfig('ns_satori_valor', nsB.v);

    // ── Conectores · D4 — agregación de ventas por mes×canal (puro, sin I/O) ─────
    var aggT = agregarVentasPorMes_([
      { ts: '2026-05-10T12:00:00', channel: 'online', total_ars: 100000, subtotal_ars: 90000, envio_ars: 10000, status: 'paid' },
      { ts: '2026-05-20', channel: 'online', total_ars: 200000, subtotal_ars: 180000, envio_ars: 20000, status: 'Recibido' },
      { ts: '2026-05-15', channel: 'pos', total_ars: 50000, subtotal_ars: 50000, envio_ars: 0, status: 'open' },
      { ts: '2026-05-31', channel: 'online', total_ars: 999999, subtotal_ars: 0, envio_ars: 0, status: 'Cancelada' }
    ]).filas;
    var onlineMayo = aggT.filter(function (a) { return a.concepto.indexOf('online') >= 0 && a.fecha === '2026-05-01'; })[0];
    chk(!!onlineMayo && onlineMayo.valor === 300000, 'D4 agrega online de mayo, excluye cancelada (' + (onlineMayo ? onlineMayo.valor : 'null') + ')');
    chk(!!onlineMayo && /2 órdenes · AOV \$150000/.test(onlineMayo.notas), 'D4 calcula AOV por mes (2 órdenes, AOV 150000)');
    chk(aggT.filter(function (a) { return a.concepto.indexOf('local') >= 0; }).length === 1, 'D4 separa canal local (pos→local)');
    // Purga conector (19-jun): #2 cobertura parcial, #5 canal desconocido → 'otro'
    var aggCob = agregarVentasPorMes_([{ ts: '2026-05-10', channel: 'online', total_ars: 100000, status: 'paid' }]);
    chk(/cobertura: solo canal online/.test(aggCob.filas[0].notas), 'D4 marca cobertura parcial si la fuente trae 1 solo canal');
    chk(aggCob.canales.length === 1 && aggCob.canales[0] === 'online', 'D4 reporta canales presentes');
    var aggOtro = agregarVentasPorMes_([{ ts: '2026-05-10', channel: 'mayorista', total_ars: 100000, status: 'paid' }]);
    chk(aggOtro.desconocidos.indexOf('mayorista') >= 0, 'D4 rutea canal desconocido a otro (no ensucia local)');
    var aggLoc = agregarVentasPorMes_([{ ts: '2026-05-10', channel: 'local', total_ars: 100000, status: 'paid' }]);
    chk(aggLoc.filas[0].concepto.indexOf('local') >= 0, 'D4 acepta channel=local como local (serie Castelar)');

    // ── Fase D · P2 F1/F4/F5 + Agenda (07-jul) — lazo de resultados, auto-limpiante ──
    // D5 Feedback: registrar normaliza util y persiste (la fila TEST la barre limpiarTodoTest por origen_id).
    var fbId = registrarFeedback('brief', '__TEST__', 'SI', 'assert selfTest');
    chk(/^FBK-\d+$/.test(fbId), 'D5 registrarFeedback devuelve id (' + fbId + ')');
    var fbRow = leerTabla(getMaestro().getSheetByName('Feedback')).filter(function (f) { return String(f.id) === fbId; })[0];
    chk(!!fbRow && String(fbRow.util) === 'si' && String(fbRow.origen_id) === '__TEST__', 'D5 fila de feedback persistida con util normalizado (SI→si)');

    // D6 Recomendaciones: regla pura + el lazo cierra SOLO con los 2 juicios humanos.
    // kpiAlerta:null → no escanea las hojas cliente (la rama A3 se testea por inyección en D10).
    var recT = recomendacionDelDia_({ kpiAlerta: null });
    chk(!!recT && typeof recT.texto === 'string' && recT.texto.length > 0 && !!recT.kpi, 'D6 recomendacionDelDia_ devuelve texto+kpi (' + recT.kpi + ')');
    var shRec = getMaestro().getSheetByName('Recomendaciones');
    appendFila(shRec, { id: 'REC-TEST-1', fecha: hoyISO(), texto: '__TEST__ rec de prueba', kpi_objetivo: 'north_star', se_hizo: '', kpi_movio: '', estado: 'abierta', cerrada_en: '' });
    chk(recomendacionesAbiertas().some(function (x) { return String(x.id) === 'REC-TEST-1'; }), 'D6 recomendacionesAbiertas lista la abierta');
    // Lecturas post-write con instancia FRESCA (open-after-write): getMaestro() NO memoiza y
    // marcarRecomendacion escribe por su propia instancia — releer por shRec (abierta antes) puede ver stale (patrón E2).
    marcarRecomendacion('REC-TEST-1', 'se_hizo', 'si');
    var recMid = leerTabla(getMaestro().getSheetByName('Recomendaciones')).filter(function (f) { return String(f.id) === 'REC-TEST-1'; })[0];
    chk(!!recMid && String(recMid.estado) === 'abierta', 'D6 un solo juicio NO cierra el lazo');
    var recFin = marcarRecomendacion('REC-TEST-1', 'kpi_movio', 'no');
    var recRow = leerTabla(getMaestro().getSheetByName('Recomendaciones')).filter(function (f) { return String(f.id) === 'REC-TEST-1'; })[0];
    chk(recFin.cerrada === true && !!recRow && String(recRow.estado) === 'cerrada' && String(recRow.cerrada_en) !== '', 'D6 dos juicios cierran el lazo (estado+cerrada_en)');

    // D7 Agenda: alta rápida + la vista semanal la incluye (hoy ∈ [hoy, hoy+7]).
    var ageId = agendarEvento(hoyISO(), '09:00', '__TEST__ evento selfTest', '', 'assert selfTest');
    chk(/^AGE-\d+$/.test(ageId), 'D7 agendarEvento devuelve id (' + ageId + ')');
    chk(agendaSemana().some(function (e) { return String(e.id) === ageId; }), 'D7 agendaSemana incluye el evento de hoy');
    // D7b agendaRango (v11 calendario): rango puntual lo incluye; rango inválido = vacío.
    chk(agendaRango(hoyISO(), hoyISO()).some(function (e) { return String(e.id) === ageId; }), 'D7b agendaRango(hoy,hoy) incluye el evento');
    chk(agendaRango('2020-01-02', '2020-01-01').length === 0 && agendaRango('x', 'y').length === 0, 'D7b agendaRango rechaza rango inválido (fail-closed)');

    // ── D8 Tareas-v2 F1 — parsers puros + alta + clon-al-completar (auto-limpiante) ──
    var q8 = parseQuickAdd('Llamar a @vehemence por EERR !a #finanzas 15/08 cada semana', '2026-07-07');
    chk(q8.prioridad === 'A' && q8.recurrencia === '1s' && q8.etiquetas[0] === 'finanzas' && q8.cliente_txt === 'vehemence' && q8.fecha_limite === '2026-08-15' && q8.tipo === 'cliente', 'D8 parseQuickAdd: !a #etiqueta @cliente dd/mm y "cada semana"');
    chk(parseQuickAdd('cosa simple', '2026-07-07').tipo === 'personal' && parseQuickAdd('regar cada mes', '2026-07-07').tipo === 'periodica', 'D8 heurística de tipo (default personal · recurrente→periodica)');
    chk(parseRecurrencia('1s', '2026-07-07') === '2026-07-14' && parseRecurrencia('1m', '2026-01-31') === '2026-02-28' && parseRecurrencia('zz', '2026-07-07') === '', 'D8 parseRecurrencia (semana · clamp fin de mes · regla inválida)');
    var t8 = crearTarea({ descripcion: '__TEST__ tarea v2 recurrente', prioridad: 'A', tipo: 'personal', recurrencia: '1d' });
    chk(/^TAR-\d+$/.test(t8.id_tarea), 'D8 crearTarea devuelve id (' + t8.id_tarea + ')');
    var mv8 = moverTarea(t8.id_tarea, 'hecha');
    chk(!!mv8.renace && mv8.renace !== t8.id_tarea, 'D8 recurrente completada RENACE (' + mv8.renace + ')');
    var clon8 = leerTabla(getMaestro().getSheetByName('Tareas')).filter(function (f) { return String(f.id_tarea) === mv8.renace; })[0];
    chk(!!clon8 && String(clon8.estado) === 'pendiente' && aFechaISO(clon8.fecha_limite) === sumarDiasISO_(hoyISO(), 1), 'D8 el clon nace pendiente con fecha +1d');
    moverTarea(t8.id_tarea, 'pendiente');
    chk(moverTarea(t8.id_tarea, 'hecha').renace === '', 'D8 dedupe: con un clon vivo idéntico NO re-clona (re-drag)');
    var t8b = crearTarea({ descripcion: '__TEST__ tarea v2 simple' });
    chk(moverTarea(t8b.id_tarea, 'hecha').renace === '', 'D8 no-recurrente completada NO renace');
    var ctx8 = datosHoy().tareas_ctx;
    chk(!!ctx8 && typeof ctx8.hoy === 'number' && typeof ctx8.periodicas === 'number' && ctx8.abiertas >= ctx8.en_curso, 'D8b datosHoy expone tareas_ctx (checklist de contexto)');

    // ── D9 Trillion-delta Tanda 2 (08-jul) — juicio anclado (A2) + rec→aprobación (B2) ──
    // A2: determinístico con `pre` inyectado (no depende del estado real del sistema).
    var pre9 = {
      d: { estado: { aprobaciones_pendientes: 0 } },
      sal: { global: 'ok', integridad: 100, hallazgos: [] },
      abiertas: [{ descripcion: 'abierta test', fecha_limite: '', id_proyecto: '', estado: 'en_curso', prioridad: 'A' }],
      vencidas: [{ descripcion: 'vencida ancla test', fecha_limite: '2020-01-01', id_proyecto: '', estado: 'en_curso', prioridad: 'A' }]
    };
    var rec9 = recomendacionDelDia_(pre9);
    chk(rec9.kpi === 'tareas_vencidas' && /lleva \d+ día\(s\) vencida/.test(rec9.texto) && rec9.texto.indexOf('vencida ancla test') >= 0,
      'D9 A2 juicio ANCLADO: la recomendación cita días + dato real');
    chk(String(rec9.id_cliente) === '' && String(rec9.dato).indexOf('vencidas=1') === 0,
      'D9 A2 expone id_cliente y dato (ancla cruda)');
    // B2: rec con cliente → crea APR P1 en el cliente de prueba; dedupe; fail-closed sin cliente.
    appendFila(getMaestro().getSheetByName('Recomendaciones'), { id: 'REC-TEST-9', fecha: hoyISO(), texto: '__TEST__ rec para aprobación', kpi_objetivo: 'north_star', se_hizo: '', kpi_movio: '', estado: 'abierta', cerrada_en: '', id_cliente: r.id_cliente });
    var a9 = aprobacionDesdeRecomendacion('REC-TEST-9');
    chk(a9.ok === true && /^APR-\d+$/.test(String(a9.id)) && a9.patron === 'P1',
      'D9 B2 rec→aprobación crea P1 en el cliente (' + (a9.id || a9.motivo) + ')');
    var a9row = aprCli().filter(function (f) { return String(f.id) === String(a9.id); })[0];
    chk(!!a9row && String(a9row.estado).toLowerCase() === 'pendiente' && String(a9row.payload).indexOf('"rec_id":"REC-TEST-9"') >= 0,
      'D9 B2 la aprobación nace PENDIENTE con payload de la recomendación');
    var a9b = aprobacionDesdeRecomendacion('REC-TEST-9');
    chk(a9b.ok === true && a9b.dedupe === true && String(a9b.id) === String(a9.id),
      'D9 B2 dedupe: segunda llamada NO duplica la pendiente');
    chk(aprobacionDesdeRecomendacion('REC-NO-EXISTE').ok === false, 'D9 B2 rec inexistente → ok:false (no escribe)');
    appendFila(getMaestro().getSheetByName('Recomendaciones'), { id: 'REC-TEST-9B', fecha: hoyISO(), texto: '__TEST__ rec de sistema', kpi_objetivo: 'salud', se_hizo: '', kpi_movio: '', estado: 'abierta', cerrada_en: '', id_cliente: '' });
    var a9c = aprobacionDesdeRecomendacion('REC-TEST-9B');
    chk(a9c.ok === false && String(a9c.motivo).indexOf('lazo') >= 0,
      'D9 B2 rec sin cliente → ok:false con motivo (no inventa tenant)');

    // ── D10 (08-jul) A3: recomendación ANCLADA a un KPI de cliente (inyectada, determinística) ──
    var recK = recomendacionDelDia_({
      d: { estado: { aprobaciones_pendientes: 0 } }, sal: { global: 'ok', integridad: 100, hallazgos: [] },
      abiertas: [], vencidas: [],
      kpiAlerta: { id_cliente: r.id_cliente, cliente: '__TEST__ cli', kpi: 'margen_%', valor: 12, objetivo: 30, alerta: 'por debajo del piso' }
    });
    chk(recK.kpi === 'kpi_cliente' && String(recK.id_cliente) === String(r.id_cliente) && recK.texto.indexOf('margen_%') >= 0 && String(recK.dato).indexOf('kpi=margen_%') === 0,
      'D10 A3 recomendación anclada al KPI de cliente (id_cliente + dato)');
    var recSinKpi = recomendacionDelDia_({ d: { estado: { aprobaciones_pendientes: 0 } }, sal: { global: 'ok', integridad: 100, hallazgos: [] }, abiertas: [], vencidas: [], kpiAlerta: null });
    chk(String(recSinKpi.kpi) === 'north_star' && String(recSinKpi.id_cliente) === '', 'D10 A3 sin KPI en alerta → NO ancla (cae a north_star, sin cliente)');

    // ── D11 (08-jul): quitarAgregada_ saca una fila del espejo por id → reflejo inmediato al resolver ──
    var shAggT = getMaestro().getSheetByName('Aprobaciones_agregadas');
    appendFila(shAggT, { id: 'APR-TEST-AGG', cliente: '__TEST__', estado: 'pendiente' });
    var aggAntes = leerTabla(shAggT).some(function (f) { return String(f.id) === 'APR-TEST-AGG'; });
    quitarAgregada_('APR-TEST-AGG');
    var aggDespues = leerTabla(shAggT).some(function (f) { return String(f.id) === 'APR-TEST-AGG'; });
    chk(aggAntes && !aggDespues, 'D11 quitarAgregada_ saca la aprobación del espejo (no reaparece en el CM al resolver)');

    // ── D12 (14-jul) E3: oficina_sync — guard de versión, whitelist por caller, escritura en CLI-000, np_pausado ──
    // (a) guard de versión: payload malformado NO escribe, error limpio (retorna antes de crear/tocar nada).
    chk(oficinaSync_({ v: 2 }).error === 'payload_version', 'D12 payload version != 1 → error sin escribir');
    chk(oficinaSync_(null).error === 'payload_version', 'D12 payload nulo → error sin escribir');
    // (b) whitelist por caller: con secretos de prueba, cada secreto habilita SOLO su canal (save/restore).
    var _propsD12 = PropertiesService.getScriptProperties();
    var _vozOrig = _propsD12.getProperty('VOZ_TOOL_SECRET');
    var _synOrig = _propsD12.getProperty('OFICINA_SYNC_SECRET');
    try {
      _propsD12.setProperty('VOZ_TOOL_SECRET', 'voz-test-123');
      _propsD12.setProperty('OFICINA_SYNC_SECRET', 'sync-test-999');
      chk(oficinaSyncAuth_('sync-test-999') === true, 'D12 oficina_sync acepta su propio secreto');
      chk(oficinaSyncAuth_('voz-test-123') === false, 'D12 oficina_sync RECHAZA el secreto de voz (whitelist)');
      chk(vozAuth_('sync-test-999') === false, 'D12 la voz RECHAZA el secreto de sync (whitelist)');
    } finally {
      if (_vozOrig === null) _propsD12.deleteProperty('VOZ_TOOL_SECRET'); else _propsD12.setProperty('VOZ_TOOL_SECRET', _vozOrig);
      if (_synOrig === null) _propsD12.deleteProperty('OFICINA_SYNC_SECRET'); else _propsD12.setProperty('OFICINA_SYNC_SECRET', _synOrig);
    }
    // (c) escritura real en CLI-000 con payload válido → refleja np_pausado y números; título hostil re-sanitizado.
    var _payD12 = { v: 1, fecha: hoyISO(), north_star: { autonomia_pct: 42.9, jobs_30d: 7, decisiones_30d: 3 },
                    costos: { gastado_usd: 0.01, cap_usd: 30 }, agentes: { n: 4, estados: 'idle' },
                    hallazgos_top: [{ tipo: 'oportunidad', titulo: 'Titulo\ncon\tsalto', score: 9.5 }],
                    aprobaciones_pendientes: { n: 1, resumenes: ['r'] }, errores_7d: 0, fuentes_modo: 'live', np_pausado: true };
    var rSyncD12 = oficinaSync_(_payD12);
    chk(rSyncD12.ok === true && rSyncD12.tenant === 'CLI-000', 'D12 oficina_sync escribe en CLI-000 (ok + tenant)');
    var _doD12 = leerTabla(abrirCliente('CLI-000').ss.getSheetByName('Datos_operativos'))
      .filter(function (f) { return String(f.fuente) === 'Oficina Virtual · sync'; });
    var _pausaD12 = _doD12.filter(function (f) { return String(f.concepto) === 'Negocio paralelo pausado'; })[0];
    chk(_pausaD12 && String(_pausaD12.valor) === 'sí', 'D12 el sync refleja np_pausado (sí)');
    var _autoD12 = _doD12.filter(function (f) { return String(f.concepto) === 'Autonomía (North Star) %'; })[0];
    chk(_autoD12 && Number(_autoD12.valor) === 42.9, 'D12 el sync escribe los números reales (autonomía 42.9)');
    var _hallD12 = _doD12.filter(function (f) { return String(f.concepto) === 'Hallazgos top'; })[0];
    chk(_hallD12 && String(_hallD12.notas).indexOf('\n') < 0 && String(_hallD12.notas).indexOf('\t') < 0,
        'D12 títulos re-sanitizados server-side (sin saltos ni tabs)');
    // limpieza D12: sacar las filas de sync de prueba de CLI-000 (el sync real las repuebla en el próximo ciclo).
    var _shDOc = abrirCliente('CLI-000').ss.getSheetByName('Datos_operativos');
    var _viejasc = leerTabla(_shDOc).filter(function (f) { return String(f.fuente) === 'Oficina Virtual · sync'; }).map(function (f) { return f._fila; });
    if (_viejasc.length) borrarFilasBatch_(_shDOc, _viejasc);
    var _shKc = abrirCliente('CLI-000').ss.getSheetByName('KPIs');
    var _vkc = leerTabla(_shKc).filter(function (f) { return String(f.kpi) === 'Autonomía OV (North Star)'; }).map(function (f) { return f._fila; });
    if (_vkc.length) borrarFilasBatch_(_shKc, _vkc);

    // ── Costos · C — ruteo de modelo por costo (quick win, 19-jun) ───────────────
    chk(MODELOS_POR_MODULO.analista === MODELO_SONNET && MODELOS_POR_MODULO.conciliador === MODELO_SONNET, 'C analista/conciliador rutean a Sonnet (veredicto)');
    chk(modeloDeModulo_('triajeX') === MODELO_DEFAULT, 'C módulo sin mapear cae a Haiku (default seguro)');
    chk(TARIFAS[MODELO_SONNET].in === 3 && TARIFAS[MODELO_SONNET].out === 15, 'C tarifa Sonnet $3/$15 por MTok (no Haiku)');
    chk(costearUSD_(MODELO_SONNET, 1e6, 1e6) === 18, 'C costearUSD usa la tarifa por modelo (Sonnet 1M+1M = $18)');

    // ── Pref UI (orbe 3D) — whitelist Bastión ────────────────────────────────────
    var prefRej = false; try { setPrefUI('clave_no_permitida', 'x'); } catch (e) { prefRej = true; }
    chk(prefRej, 'PrefUI rechaza claves fuera de whitelist (Bastión)');
    chk(!!prefsUI().orbe_calidad, 'prefsUI devuelve orbe_calidad con default seguro');

    // ── Voz · tool-backend doPost (auth + whitelist + detección; sin deploy, read-only) ──
    function vozCall_(obj) { return JSON.parse(doPost({ postData: { contents: JSON.stringify(obj) } }).getContent()); }
    var vSecB = PropertiesService.getScriptProperties().getProperty('VOZ_TOOL_SECRET');
    var vAlertB = PropertiesService.getScriptProperties().getProperty('voz_alerta_fecha');
    PropertiesService.getScriptProperties().setProperty('voz_alerta_fecha', hoyISO());   // PURGA #8: suprime el aviso real durante los tests de rechazo
    PropertiesService.getScriptProperties().setProperty('VOZ_TOOL_SECRET', '__TESTSECRET__');
    // Bonus (14-jul): baseline de avisos voz para resolver SOLO los que este test pudiera crear (nunca
    // toca un aviso de seguridad real preexistente — limpiarTodoTest no puede identificarlos sin marker).
    var _vozAviPre = {};
    leerTabla(getMaestro().getSheetByName('Avisos')).forEach(function (f) {
      if (String(f.tipo) === 'voz_acceso_no_autorizado') _vozAviPre[String(f.id_aviso)] = true;
    });
    try {
      chk(ctEq_('abc', 'abc') && !ctEq_('abc', 'abd'), 'Voz ctEq_ por digest (igual vs distinto)');
      chk(vozCall_({ secret: '__no_matchea__', tool: 'estado' }).error === 'unauthorized', 'Voz secreto inválido → unauthorized (fail-closed)');
      chk(JSON.parse(doPost({ postData: { contents: '{no json' } }).getContent()).error === 'bad_json', 'Voz body no-JSON → bad_json');
      chk(vozCall_({ secret: '__TESTSECRET__', tool: 'no_existe' }).error === 'unknown_tool', 'Voz tool fuera de whitelist → unknown_tool');
      var vEstado = vozCall_({ secret: '__TESTSECRET__', tool: 'estado' });
      chk(vEstado.ok === true && typeof vEstado.data === 'string' && vEstado.data.indexOf('# Estado vigente') === 0, 'Voz tool "estado" devuelve el snapshot');

      // ── D13 (14-jul) SGIC: tool sgic read-only + whitelist dura + ventas exactas + saneo hostil ──
      // Sembramos Datos_operativos en el cliente __TEST__ (via el handle que usará sgic → writes visibles tras flush).
      var _doTest = abrirCliente(r.id_cliente).ss.getSheetByName('Datos_operativos');
      appendFila(_doTest, { fecha: '2026-06-01', concepto: 'Ventas online (mes, ARS)', valor: 1000000, fuente: '__TEST__', notas: '50 ordenes' });
      appendFila(_doTest, { fecha: '2026-07-01', concepto: 'Ventas online (mes, ARS)', valor: 2000000, fuente: '__TEST__', notas: 'linea1\nlinea2\t<script>alerta</script>' });
      appendFila(_doTest, { fecha: '2026-07-15', concepto: 'stock', valor: 5, fuente: '__TEST__', notas: '' });
      SpreadsheetApp.flush();
      // (a) hoja fuera de whitelist → rechazada SIN leer (whitelist antes de abrir el sheet)
      var d13a = vozCall_({ secret: '__TESTSECRET__', tool: 'sgic', args: { idCliente: r.id_cliente, hoja: 'Cerebro_nodos' } });
      chk(d13a.error === 'hoja_no_permitida', 'D13a hoja fuera de whitelist → hoja_no_permitida (sin leer)');
      // (b) lee Datos_operativos del cliente __TEST__
      var d13b = vozCall_({ secret: '__TESTSECRET__', tool: 'sgic', args: { idCliente: r.id_cliente, hoja: 'Datos_operativos' } });
      chk(d13b.ok === true && d13b.data.total >= 3 && d13b.data.filas.length >= 3, 'D13b sgic lee Datos_operativos del cliente');
      // (c) filtro por mes
      var d13c = vozCall_({ secret: '__TESTSECRET__', tool: 'sgic', args: { idCliente: r.id_cliente, hoja: 'Datos_operativos', mes: '2026-07' } });
      chk(d13c.data.total === 2, 'D13c filtro por mes (2 filas de julio)');
      // (d) limite acota
      var d13d = vozCall_({ secret: '__TESTSECRET__', tool: 'sgic', args: { idCliente: r.id_cliente, hoja: 'Datos_operativos', limite: 2 } });
      chk(d13d.data.mostrados <= 2, 'D13d limite acota los mostrados (<=2)');
      // (e) ventas con fixture → órdenes/total/AOV EXACTOS (puro, sin I/O): 2 válidas (cancelada excluida)
      var d13vf = agregarVentasPorMes_([
        { ts: '2026-07-05', channel: 'online', total_ars: 100000, status: 'paid' },
        { ts: '2026-07-20', channel: 'online', total_ars: 200000, status: 'paid' },
        { ts: '2026-07-10', channel: 'online', total_ars: 999, status: 'cancelled' }
      ]);
      var d13e = _sgicResumenVentas_(d13vf.filas, d13vf.canales, '2026-07', 'CLI-FIX');
      chk(d13e.ordenes === 2 && d13e.total === 300000 && d13e.aov === 150000, 'D13e ventas: órdenes/total/AOV exactos (2 / 300000 / 150000)');
      // (f) celda hostil sale sanitizada (sin \n\t) + truncada
      var d13f = _sgicFila_({ concepto: 'x', notas: 'a\nb\tc ' + new Array(300).join('z') });
      chk(String(d13f.notas).indexOf('\n') < 0 && String(d13f.notas).indexOf('\t') < 0 && d13f.notas.length <= 201, 'D13f celda hostil sanitizada + truncada');
    } finally {
      if (vSecB == null) PropertiesService.getScriptProperties().deleteProperty('VOZ_TOOL_SECRET');
      else PropertiesService.getScriptProperties().setProperty('VOZ_TOOL_SECRET', vSecB);
      if (vAlertB == null) PropertiesService.getScriptProperties().deleteProperty('voz_alerta_fecha');
      else PropertiesService.getScriptProperties().setProperty('voz_alerta_fecha', vAlertB);
      // Bonus (14-jul): resolver los avisos voz_acceso_no_autorizado que ESTE test creó (baseline diff).
      // Junto con limpiarTodoTest (que ya barre tarea_vencida [TAR-TEST-1] y aprobacion_expirada
      // [APR-TEST-EXP] por marcador), el selfTest deja de ensuciar el CM con avisos de prueba.
      borrarFilasDonde(getMaestro().getSheetByName('Avisos'), function (f) {
        return String(f.tipo) === 'voz_acceso_no_autorizado' && !_vozAviPre[String(f.id_aviso)];
      });
    }

    log.push('— TODO OK —');
  } finally {
    // La limpieza corre SIEMPRE (pase o falle), y barre cualquier resto de
    // corridas anteriores (clientes __TEST__ huérfanos, filas TEST).
    var limpiados = limpiarTodoTest();
    log.push('🧹 limpieza: ' + limpiados.clientes + ' cliente(s) __TEST__ a papelera, filas TEST removidas');
  }

  var salida = log.join('\n');
  Logger.log(salida);
  return salida;
}

/**
 * Diagnóstico aislado de E2-1 (correr a mano en el editor). NO es un fix: instrumenta
 * cada paso de crearAprobacion y compara contra un appendFila de control en la misma
 * corrida. Crea un cliente __TEST__ y lo manda a papelera al final.
 */
function debugE21() {
  var out = [];
  function L(x) { out.push(String(x)); Logger.log(String(x)); }
  var r = null;
  try {
    setup();
    r = crearCliente({ nombre: '__TEST__ debugE21 ' + ahoraISO(), rubro: 'test', estado: 'potencial' });
    L('cliente=' + r.id_cliente + ' ya_existia=' + r.ya_existia);
    L('r.url=' + r.url);

    // (c) headers reales de Aprobaciones del cliente (instancia fresca)
    var shA = SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones');
    L('Aprobaciones? ' + !!shA + ' lastRow=' + (shA ? shA.getLastRow() : '-') + ' lastCol=' + (shA ? shA.getLastColumn() : '-') + ' hidden=' + (shA ? shA.isSheetHidden() : '-'));
    L('headers=' + JSON.stringify(shA.getRange(1, 1, 1, shA.getLastColumn()).getValues()[0]));

    // url registrada en Clientes vs r.url (¿misma hoja?)
    var cliRow = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (f) { return f.id_cliente === r.id_cliente; })[0];
    L('url en Clientes=' + (cliRow ? cliRow.url_sheet_cliente : '(no encontrado)'));
    L('mismaURL=' + (cliRow && cliRow.url_sheet_cliente === r.url));

    // (a) replicar lo que crearAprobacion arma, sin escribir
    var clasif = clasificarAccion(r.id_cliente, 'pago', 500);
    L('clasificarAccion=' + JSON.stringify(clasif));

    var antes = leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones')).length;
    L('filas ANTES de crearAprobacion=' + antes);

    // (b/e) llamada REAL con catch
    var ret = null;
    try {
      ret = crearAprobacion(r.id_cliente, 'test', 'pago', { x: 1 }, { monto: 500, descripcion: 'pago test' });
      L('crearAprobacion RETURN=' + JSON.stringify(ret));
    } catch (e) {
      L('crearAprobacion THREW: ' + e.message + ' :: ' + (e.stack || ''));
    }

    // (d) leerTabla completo, instancia fresca
    var filas = leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones'));
    L('filas DESPUES=' + filas.length + (ret ? ' (esperaba id ' + ret.id + ')' : ''));
    filas.forEach(function (f) {
      L('  fila' + f._fila + ' id=' + JSON.stringify(f.id) + ' estado=' + JSON.stringify(f.estado) +
        ' tipo_accion=' + JSON.stringify(f.tipo_accion) + ' patron=' + JSON.stringify(f.patron) + ' monto=' + JSON.stringify(f.monto));
    });
    if (ret) {
      var hit = filas.filter(function (f) { return f.id === ret.id; })[0];
      L('match por id exacto? ' + !!hit + (hit ? ' estado=' + JSON.stringify(hit.estado) : ''));
    }

    // control: appendFila directo (el camino del paso E1 que SÍ persiste)
    appendFila(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones'), {
      id: 'APR-CTRL', fecha_creacion: hoyISO(), cliente: 'x', modulo: 'test', patron: 'P2',
      tipo_accion: 'pago', descripcion: 'control', payload: '{}', monto: 1, 'confianza_%': 1, estado: 'pendiente'
    });
    var ctrl = leerTabla(SpreadsheetApp.openByUrl(r.url).getSheetByName('Aprobaciones')).filter(function (f) { return f.id === 'APR-CTRL'; })[0];
    L('control APR-CTRL presente? ' + !!ctrl + (ctrl ? ' estado=' + JSON.stringify(ctrl.estado) : ''));
  } catch (e) {
    L('ERROR debugE21: ' + e.message + ' :: ' + (e.stack || ''));
  } finally {
    try { if (r && r.url) DriveApp.getFileById(SpreadsheetApp.openByUrl(r.url).getId()).setTrashed(true); } catch (x) {}
    try { if (r) borrarFilasDonde(getMaestro().getSheetByName('Clientes'), function (f) { return f.id_cliente === r.id_cliente; }); } catch (x) {}
  }
  var s = out.join('\n');
  Logger.log('—— debugE21 ——\n' + s);
  return s;
}

/**
 * Barre TODOS los artefactos de prueba (idempotente, reversible):
 * - clientes cuyo nombre empieza con '__TEST__' → Sheet a papelera + fila fuera de Clientes;
 * - filas TAR-TEST* / APR-TEST* y avisos con 'TEST' en el mensaje.
 * Sirve también para limpiar restos de una corrida que falló antes del cleanup.
 */
function limpiarTodoTest() {
  var ss = getMaestro();
  var shClientes = ss.getSheetByName('Clientes');
  var testClientes = leerTabla(shClientes).filter(function (f) {
    return String(f.nombre).indexOf('__TEST__') === 0;
  });
  var idsTest = {}; testClientes.forEach(function (c) { idsTest[String(c.id_cliente)] = true; });
  testClientes.forEach(function (c) {
    try {
      if (c.url_sheet_cliente) {
        DriveApp.getFileById(SpreadsheetApp.openByUrl(c.url_sheet_cliente).getId()).setTrashed(true);
      }
    } catch (e) { Logger.log('No pude mandar a papelera ' + c.id_cliente + ': ' + e.message); }
  });

  borrarFilasDonde(shClientes, function (f) { return String(f.nombre).indexOf('__TEST__') === 0; });
  // D9 (08-jul): la APR creada vía rec→aprobación sube a agregadas con syncMaestro y NO es APR-TEST-*
  // → barrer también por cliente __TEST__ (mismo patrón que Clientes).
  borrarFilasDonde(ss.getSheetByName('Aprobaciones_agregadas'), function (f) { return String(f.id).indexOf('APR-TEST') === 0 || String(f.cliente).indexOf('__TEST__') === 0; });
  borrarFilasDonde(ss.getSheetByName('Tareas'), function (f) { return String(f.id_tarea).indexOf('TAR-TEST') === 0 || String(f.descripcion).indexOf('__TEST__') === 0; });
  // PURGA #14: acotar a marcadores de prueba (TAR-TEST/APR-TEST), nunca a un
  // 'TEST' suelto en el mensaje — borraría avisos reales que mencionen "test".
  borrarFilasDonde(ss.getSheetByName('Avisos'), function (f) {
    var m = String(f.mensaje);
    return m.indexOf('TAR-TEST') >= 0 || m.indexOf('APR-TEST') >= 0;
  });
  // ETAPA 2: cola de prueba (noop / worker de test) y feed del cliente de prueba.
  borrarFilasDonde(ss.getSheetByName('Cola_tareas'), function (f) {
    if (String(f.tipo) === 'noop' || String(f.worker) === '__TESTWORKER__') return true;
    // ETAPA 8a: tareas de agente que el Director encoló para clientes de prueba.
    var p = String(f.payload || '');
    for (var id in idsTest) { if (idsTest[id] && p.indexOf('"id_cliente":"' + id + '"') >= 0) return true; }
    return false;
  });
  borrarFilasDonde(ss.getSheetByName('Actividad'), function (f) { return idsTest[String(f.id_cliente)] === true || String(f.texto).indexOf('__TEST__') >= 0; });
  // ETAPA 8a: índice agregado del cerebro (el grafo por tenant se va con el Sheet a papelera).
  var shCI = ss.getSheetByName('Cerebro_index');
  if (shCI) borrarFilasDonde(shCI, function (f) { return idsTest[String(f.id_cliente)] === true; });
  // Fase 1: filas de prueba de la Bandeja.
  var shBan = ss.getSheetByName('Bandeja');
  if (shBan) borrarFilasDonde(shBan, function (f) { return String(f.fuente) === '__TEST__' || String(f.texto).indexOf('__TEST__') === 0; });
  // P2 F1/F4 + Agenda (07-jul): filas de prueba de las hojas nuevas (asserts D5/D6/D7).
  var shFbk = ss.getSheetByName('Feedback');
  if (shFbk) borrarFilasDonde(shFbk, function (f) { return String(f.origen_id) === '__TEST__'; });
  var shRecL = ss.getSheetByName('Recomendaciones');
  if (shRecL) borrarFilasDonde(shRecL, function (f) { return String(f.id).indexOf('REC-TEST') === 0 || String(f.texto).indexOf('__TEST__') === 0; });
  var shAge = ss.getSheetByName('Agenda');
  if (shAge) borrarFilasDonde(shAge, function (f) { return String(f.titulo).indexOf('__TEST__') === 0; });
  return { clientes: testClientes.length };
}

/** Borra filas de una pestaña según un predicado. PURGA #25: era (sh,columna,valor,pred)
 * con la rama por igualdad muerta — todos los llamadores usaban solo pred. */
function borrarFilasDonde(sh, pred) {
  var filas = leerTabla(sh);
  // de abajo hacia arriba para no desfasar índices
  for (var i = filas.length - 1; i >= 0; i--) {
    if (pred(filas[i])) sh.deleteRow(filas[i]._fila);
  }
}
