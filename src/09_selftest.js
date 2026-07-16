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
    // Sheets coacciona: estos valores vuelven como NÚMERO, no como el string que se escribió.
    // String(2)==='2' pasaba por suerte; Number() es lo que la comparación quiere decir de verdad.
    chk(ceEst.resumen && Number(ceEst.resumen.nodos) === 2, 'E8a-1 leerEstado devuelve el snapshot materializado');
    chk(ceEst.nodos_por_dimension && Number(ceEst.nodos_por_dimension.sistema) === 1 && Number(ceEst.nodos_por_dimension.negocio) === 1, 'E8a-1 snapshot agrupa por eje (tarea→sistema, objetivo→negocio · tesis Satori)');
    var ceIdx = leerTabla(getMaestro().getSheetByName('Cerebro_index')).filter(function (f) { return f.id_cliente === r.id_cliente; })[0];
    chk(!!ceIdx && Number(ceIdx.nodos) === 2, 'E8a-1 Cerebro_index agrega conteos en el MAESTRO (sin PII)');

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

    // ── Fase D · MUST #2 — briefDiario = CONTRATO v1 (F2, 16-jul), sin API ─────
    // El brief era "BLUF + Las 3 cosas + Números + Qué primero"; F2 lo reemplazó por el contrato de
    // 10 secciones fijas (contratoStatusReport_). Estos asserts verifican EL CONTRATO, no la prosa:
    // lo que no puede romperse es que estén las 10 y en orden. D14 prueba el renderer con datos
    // inyectados; esto prueba que los DOS briefs reales (sistema y cliente) salen por él.
    // Línea EXACTA ('\n## X\n'), nunca substring: '## Cierre' matchea antes '## Cierre acción→métrica'.
    var _secs = CONTRATO_ORDEN.filter(function (k) { return k !== 'bluf'; });
    var _posDe = function (md) { return _secs.map(function (k) { return md.indexOf('\n## ' + CONTRATO_TITULOS[k] + '\n'); }); };

    var brSys = briefDiario();
    chk(typeof brSys === 'string' && brSys.indexOf('# Brief — Satori') === 0, 'D2 briefDiario() devuelve el brief de sistema');
    chk(/\n\*\*.+\*\*\n/.test(brSys), 'D2b el brief abre con el BLUF en negrita');
    chk(brSys.indexOf('\n## Hoy\n') > 0, 'D2c el contrato emite la apertura humana (## Hoy)');
    chk(brSys.indexOf('· contrato v1') > 0, 'D2d el brief de sistema declara el contrato v1');
    var _pSys = _posDe(brSys);
    chk(_pSys.every(function (p) { return p > 0; }), 'D2e el brief de SISTEMA trae las 10 secciones del contrato');
    chk(_pSys.every(function (p, i) { return i === 0 || p > _pSys[i - 1]; }), 'D2f el brief de SISTEMA las trae en el ORDEN contractual');

    var brCli = briefDiario(r.id_cliente);
    chk(brCli.indexOf(r.id_cliente) >= 0, 'D2g briefDiario(cliente) trae el id del cliente (' + r.id_cliente + ')');
    chk(/\n\*\*.+\*\*\n/.test(brCli), 'D2h el brief de CLIENTE abre con el BLUF en negrita');
    chk(brCli.indexOf('· contrato v1') > 0, 'D2i el brief de cliente declara el contrato v1');
    var _pCli = _posDe(brCli);
    chk(_pCli.every(function (p) { return p > 0; }), 'D2j el brief de CLIENTE también trae las 10 secciones (mismo renderer)');
    chk(_pCli.every(function (p, i) { return i === 0 || p > _pCli[i - 1]; }), 'D2k el brief de CLIENTE las trae en el ORDEN contractual');

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
    // cerrada_en es un ahoraISO() que Sheets puede devolver como Date → normalizar (String(Date) !== ''
    // pasaba igual, pero por accidente: la comparación no decía lo que quería decir).
    chk(recFin.cerrada === true && !!recRow && String(recRow.estado) === 'cerrada' && aFechaISO(recRow.cerrada_en) !== '', 'D6 dos juicios cierran el lazo (estado+cerrada_en)');

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
    // 16-jul: el concepto se renombró (el viejo 'Negocio paralelo pausado' + valor 'no' se leía al revés).
    var _pausaD12 = _doD12.filter(function (f) { return String(f.concepto) === 'Oficina Virtual — kill-switch (np_pausado)'; })[0];
    chk(_pausaD12 && String(_pausaD12.valor) === 'sí', 'D12 el sync refleja np_pausado (sí)');
    chk(!_doD12.filter(function (f) { return String(f.concepto) === 'Negocio paralelo pausado'; })[0], 'D12b el concepto viejo no sobrevive al sync (reemplazo por fuente)');
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

    _asertsF2_(chk, log, { completo: true });   // D14 contrato F2 · D15 mantenimiento · D16 voz-acciones (cuerpo compartido con selfTestF2_)

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
 * Aprueba una acción de voz SOLO si la acción realmente creó la aprobación. Si la superficie rechazó
 * (whitelist, cap de tamaño, tenant, North Star…), lo registra como fallo del TEST y devuelve false
 * en vez de llamar a resolverAprobacion con undefined. Ver la "REGLA DEL FLUJO" en D16.
 */
function _aprobarSiOk_(chk, idCliente, res, etiqueta) {
  if (!res || res.ok !== true || !res.id_aprobacion) {
    chk(false, etiqueta + ': se esperaba una aprobación creada y accionVoz_ devolvió ' + JSON.stringify(res));
    return false;
  }
  resolverAprobacion(idCliente, res.id_aprobacion, 'aprobada');
  return true;
}

/**
 * Cuerpo COMPARTIDO de las tandas nuevas (D14 contrato F2 · D15 mantenimiento · D16 voz-acciones).
 * Vive acá y no dentro de selfTest para que los DOS runners corran EXACTAMENTE los mismos asserts:
 * selfTest() (certificación completa, lenta) y selfTestF2_() (iteración, segundos). Duplicarlos
 * garantizaría que diverjan.
 *
 * Cada tanda va AISLADA en su try/catch: una que reviente (una excepción inesperada, o una variable
 * que quedó undefined tras un rojo cuando chk acumula) NO puede llevarse puestas a las otras dos —
 * ese es justo el punto de acumular. Con el chk FATAL de selfTest() el catch re-lanza y la corrida
 * corta igual (es certificación); con el chk acumulativo de selfTestF2_() sigue a la tanda siguiente.
 * @param {function} chk  aserción del runner
 * @param {Array} log     el log del runner
 */
function _asertsF2_(chk, log, opts) {
  [{ n: 'D14 contrato F2', f: _asertsD14_ },
   { n: 'D15 mantenimiento', f: _asertsD15_ },
   { n: 'D16 voz-acciones', f: _asertsD16_ }].forEach(function (t) {
    try { t.f(chk, log, opts || {}); }
    catch (e) { chk(false, 'tanda ' + t.n + ' ABORTÓ: ' + ((e && e.message) || e)); }
  });
}

/** D14 — contrato de status report v1 + direcciones pre-aprobadas (F2). Tanda aislada: la corre _asertsF2_. */
function _asertsD14_(chk, log, opts) {
  // ── D14 (16-jul) F2: contrato de status report v1 + direcciones pre-aprobadas ──
  // (a) el contrato renderiza las 10 secciones en orden con datos inyectados (renderer PURO).
  var d14ctx = { titulo: 'T', bluf: 'B' };
  CONTRATO_ORDEN.forEach(function (k) { if (k !== 'bluf') d14ctx[k] = ['- x']; });
  var d14md = contratoStatusReport_(d14ctx);
  // OJO: buscar por línea EXACTA ('\n## X\n'), no por substring: '## Cierre' matchearía primero
  // '## Cierre acción→métrica' (sección 7) y el chequeo de orden daría un falso fallo.
  var d14pos = CONTRATO_ORDEN.filter(function (k) { return k !== 'bluf'; })
    .map(function (k) { return d14md.indexOf('\n## ' + CONTRATO_TITULOS[k] + '\n'); });
  chk(d14pos.every(function (p) { return p > 0; }), 'D14a contrato renderiza las 9 secciones con encabezado + BLUF (10 del contrato)');
  chk(d14pos.every(function (p, i) { return i === 0 || p > d14pos[i - 1]; }), 'D14b el ORDEN contractual se respeta (posiciones crecientes)');
  // (c) una sección sin dato NO se omite: emite el fallback honesto (el hueco silencioso miente).
  var d14vacio = contratoStatusReport_({ titulo: 'T', bluf: 'B', metricas: [] });
  chk(d14vacio.indexOf('\n## ' + CONTRATO_TITULOS.metricas + '\n') > 0 && d14vacio.indexOf('(sin dato)') > 0, 'D14c sección vacía → encabezado + "(sin dato)", no se omite');
  // (d) tendencia REAL con serie; sin 2 puntos comparables → null (no se estima).
  var d14t = _tendencia_([{ fecha: '2026-07-01', valor: 10 }, { fecha: '2026-07-15', valor: 25 }]);
  chk(d14t && d14t.palabra === 'acelerando' && d14t.detalle.indexOf('+15') >= 0, 'D14d tendencia acelerando con delta real (+15)');
  chk(_tendencia_([{ fecha: '2026-07-01', valor: 10 }]) === null, 'D14e sin 2 puntos NO hay tendencia (null, no estimación)');
  chk(_tendencia_([{ fecha: '2026-07-01', valor: 30 }, { fecha: '2026-07-15', valor: 12 }]).palabra === 'frenando', 'D14f tendencia frenando con delta negativo');
  // (g) toda rec contractual trae dato + contrapeso + acción (el contrapeso nunca es vacío).
  var d14r = _recContractual_({ texto: 'x', kpi: 'kpi_desconocido_xyz', id_cliente: '', dato: 'd=1' });
  chk(d14r.length === 4 && d14r[1].indexOf('d=1') > 0 && d14r[2].indexOf('Contrapeso:') > 0 && d14r[2].length > 18 && d14r[3].indexOf('Acción:') > 0, 'D14g rec contractual = dato + contrapeso (fallback no vacío) + acción');

  // ── D14 direcciones: la superficie de AUTO-aprobación. Default-deny debe sobrevivir intacto. ──
  var shDir = getMaestro().getSheetByName('Direcciones');
  chk(!!shDir, 'D14h setup() reconcilió la hoja Direcciones');
  var d14cli = crearCliente({ nombre: '__TEST__ dir ' + ahoraISO(), rubro: 'test', estado: 'potencial' });
  var manana = Utilities.formatDate(new Date(Date.now() + 86400000), TZ, 'yyyy-MM-dd');
  var ayer = Utilities.formatDate(new Date(Date.now() - 86400000), TZ, 'yyyy-MM-dd');
  // (i) SIN dirección → pendiente (default-deny intacto: es el assert que más importa).
  var apSin = crearAprobacion(d14cli.id_cliente, '__TEST__mod', '__TEST__accion', { x: 1 });
  chk(apSin.auto === false, 'D14i sin dirección vigente → NO auto-aprueba (default-deny intacto)');
  // (j) dirección VIGENTE + match exacto → auto-aprueba, cita la dirección y deja rastro en el feed.
  appendFila(shDir, { id: 'DIR-TEST-1', tipo_accion: '__TEST__accion', alcance: d14cli.id_cliente, aprobada_fecha: hoyISO(), vigencia: manana, activa: 'si', notas: '__TEST__' });
  var apCon = crearAprobacion(d14cli.id_cliente, '__TEST__mod', '__TEST__accion', { x: 2 });
  var filaCon = leerTabla(abrirCliente(d14cli.id_cliente).ss.getSheetByName('Aprobaciones')).filter(function (a) { return String(a.id) === String(apCon.id); })[0];
  chk(apCon.auto === true && apCon.direccion === 'DIR-TEST-1', 'D14j dirección vigente → auto-aprueba citando DIR-TEST-1');
  chk(filaCon && String(filaCon.estado) === 'aprobada' && String(filaCon.decidido_por) === 'direccion:DIR-TEST-1' && String(filaCon.notas).indexOf('DIR-TEST-1') >= 0, 'D14k la fila nace aprobada + LOGUEA la dirección (trazable)');
  var feedDir = leerTabla(getMaestro().getSheetByName('Actividad')).filter(function (f) { return String(f.tipo) === 'auto_aprobacion' && String(f.aprobacion_id) === String(apCon.id); });
  chk(feedDir.length === 1, 'D14l la auto-aprobación deja rastro en Actividad (nunca silenciosa)');
  // (m) VENCIDA → no matchea. (n) activa=false → no matchea. (o) otro tenant → no matchea (sin wildcard).
  borrarFilasDonde(shDir, function (f) { return String(f.id) === 'DIR-TEST-1'; });
  appendFila(shDir, { id: 'DIR-TEST-2', tipo_accion: '__TEST__accion', alcance: d14cli.id_cliente, aprobada_fecha: ayer, vigencia: ayer, activa: 'si', notas: '__TEST__' });
  chk(direccionVigente_(d14cli.id_cliente, '__TEST__accion') === null, 'D14m dirección VENCIDA no matchea');
  borrarFilasDonde(shDir, function (f) { return String(f.id) === 'DIR-TEST-2'; });
  appendFila(shDir, { id: 'DIR-TEST-3', tipo_accion: '__TEST__accion', alcance: d14cli.id_cliente, aprobada_fecha: hoyISO(), vigencia: manana, activa: 'no', notas: '__TEST__' });
  chk(direccionVigente_(d14cli.id_cliente, '__TEST__accion') === null, 'D14n dirección activa=false no matchea (revocable)');
  borrarFilasDonde(shDir, function (f) { return String(f.id) === 'DIR-TEST-3'; });
  appendFila(shDir, { id: 'DIR-TEST-4', tipo_accion: '__TEST__accion', alcance: '*', aprobada_fecha: hoyISO(), vigencia: manana, activa: 'si', notas: '__TEST__' });
  chk(direccionVigente_(d14cli.id_cliente, '__TEST__accion') === null, 'D14o alcance wildcard "*" NO matchea (sin wildcard de tenant)');
  chk(direccionVigente_(d14cli.id_cliente, '__TEST__otra') === null, 'D14p tipo_accion distinto no matchea (match exacto)');
  borrarFilasDonde(shDir, function (f) { return String(f.id).indexOf('DIR-TEST') === 0; });
  // (q) feedback del contrato escribe en Feedback (P2.1, patrón reusado — no duplicado).
  var d14fb = registrarFeedback('brief', '__TEST__f2', 'si', 'assert D14');
  var d14fbRow = leerTabla(getMaestro().getSheetByName('Feedback')).filter(function (f) { return String(f.id) === String(d14fb); })[0];
  chk(!!d14fbRow && String(d14fbRow.origen_tipo) === 'brief' && String(d14fbRow.util) === 'si', 'D14q feedback del brief escribe en la hoja Feedback');
}

/** D15 — dieta de Cola_tareas + avisos de estancadas agrupados. Tanda aislada: la corre _asertsF2_. */
function _asertsD15_(chk, log, opts) {
  // ── D15 (16-jul) Mantenimiento: dieta de Cola_tareas + avisos agrupados ──
  var shCola = getMaestro().getSheetByName('Cola_tareas');
  var shArch = getMaestro().getSheetByName('Cola_archivo');
  chk(!!shArch, 'D15a setup() reconcilió la hoja Cola_archivo');
  var viejo = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), TZ, 'yyyy-MM-dd') + 'T10:00:00';
  var reciente = ahoraISO();
  var _mkCola = function (id, estado, agente, creada) {
    appendFila(shCola, { id: id, worker: '__TESTWORKER__', tipo: 'agente', payload: JSON.stringify({ agente: agente }),
                         estado: estado, resultado: '', error: '', tomada_por: '', creada_en: creada, tomada_en: '', completada_en: '' });
  };
  // 2 terminales viejas del mismo agente ficticio + 1 pendiente vieja + 1 terminal reciente.
  _mkCola('COLA-TEST-1', 'completada', '__testagente__', viejo);
  _mkCola('COLA-TEST-2', 'fallida', '__testagente__', viejo);
  _mkCola('COLA-TEST-3', 'pendiente', '__testagente2__', viejo);
  _mkCola('COLA-TEST-4', 'completada', '__testagente3__', reciente);
  SpreadsheetApp.flush();
  var errAntes = telemetriaMaestro_().errores;
  var d15 = archivarColaVieja_();
  var idsCola = leerTabla(shCola).map(function (f) { return String(f.id); });
  var idsArch = leerTabla(shArch).map(function (f) { return String(f.id); });
  // De las 2 filas de __testagente__, la ÚLTIMA en la hoja es COLA-TEST-2 → esa queda protegida
  // (es la que le da su estado al agente); COLA-TEST-1 sí se archiva.
  chk(idsArch.indexOf('COLA-TEST-1') >= 0, 'D15b archiva la terminal vieja que NO es la última del agente');
  chk(idsCola.indexOf('COLA-TEST-2') >= 0 && idsArch.indexOf('COLA-TEST-2') < 0, 'D15c NUNCA archiva la fila más reciente de un agente (último-estado)');
  chk(idsCola.indexOf('COLA-TEST-3') >= 0 && idsArch.indexOf('COLA-TEST-3') < 0, 'D15d NUNCA archiva una pendiente (aunque sea vieja)');
  chk(idsCola.indexOf('COLA-TEST-4') >= 0 && idsArch.indexOf('COLA-TEST-4') < 0, 'D15e NO archiva una terminal reciente (dentro del horizonte)');
  chk(telemetriaMaestro_().errores === errAntes, 'D15f el conteo de errores del MES queda intacto pre/post archivo');
  // La guarda del mes en curso solo es alcanzable con fechas reales el día 31 → se prueba sobre el
  // predicado PURO, que es donde vive la decisión (determinista, no depende de cuándo corra el test).
  var _pf = function (estado, creada, ultima) { return _colaArchivable_({ estado: estado, creada_en: creada }, '2026-06-16', '2026-07-01', ultima); };
  chk(_pf('completada', '2026-05-01', false) === true, 'D15f2 terminal vieja y fuera del mes en curso → archivable');
  chk(_pf('completada', '2026-07-10', false) === false, 'D15f3 fila del MES EN CURSO nunca se archiva (protege el conteo de errores)');
  chk(_pf('fallida', '2026-07-05', false) === false, 'D15f4 error del mes en curso nunca se archiva (el contador no puede bajar)');
  chk(_pf('pendiente', '2026-05-01', false) === false && _pf('tomada', '2026-05-01', false) === false, 'D15f5 pendiente/tomada nunca se archivan');
  chk(_pf('completada', '2026-05-01', true) === false, 'D15f6 la última fila del agente nunca se archiva aunque sea vieja y terminal');
  chk(_pf('completada', '', false) === false, 'D15f7 sin fecha de creación no se archiva (no sabemos la edad)');
  chk(_pf('hecha', '2026-05-01', false) === false, 'D15f8 "hecha" NO es terminal de la cola (es de Tareas) → no archiva');
  chk(archivarColaVieja_().archivadas === 0, 'D15g idempotente: una segunda corrida no mueve nada');
  // El estado derivado del agente sobrevive al archivo (esa es la razón de la protección).
  chk(estadosAgentesCola_(leerTabla(shCola))['__testagente__'] === 'fail', 'D15h el último-estado-por-agente sobrevive al archivo');
  borrarFilasDonde(shCola, function (f) { return String(f.id).indexOf('COLA-TEST') === 0; });
  borrarFilasDonde(shArch, function (f) { return String(f.id).indexOf('COLA-TEST') === 0; });
  // Estados terminales: los del encargo ('hecha'/'error'/'cancelada') NO son los de la cola.
  chk(COLA_TERMINALES.join(',') === 'completada,fallida', 'D15i los terminales de la COLA son completada/fallida (no los de Tareas)');

  // ── Avisos agrupados. OJO: selfTest corre sobre PRODUCCIÓN, que ya tiene estancadas REALES.
  // Todo esperado se COMPUTA de los datos vivos con el MISMO criterio que detectarTareasEstancadas
  // (activa + no terminal + fecha_creacion < límite). Hardcodear un conteo acá es un assert que
  // depende del día en que corra: falló así el 16-jul (esperaba "5" y prod tenía 18 reales → 23).
  var _avPre = {}; leerTabla(getMaestro().getSheetByName('Avisos')).forEach(function (f) { _avPre[String(f.id_aviso)] = true; });
  var shT = getMaestro().getSheetByName('Tareas');
  var hT = shT.getRange(1, 1, 1, shT.getLastColumn()).getValues()[0];
  var cFC = hT.indexOf('fecha_creacion') + 1;
  // El MISMO predicado que la función (si allá cambia, este assert debe cambiar con él).
  var _diasEst = parseInt(getConfig('dias_estancamiento_tarea') || '7', 10);
  var _limEst = hace(_diasEst);
  var _esEstancada = function (t) {
    var term = ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) >= 0;
    var activa = ['en_curso', 'pendiente', 'en curso', ''].indexOf(String(t.estado).toLowerCase()) >= 0;
    var fc = aFechaISO(t.fecha_creacion);
    return !term && activa && fc && fc < _limEst;
  };
  var _viejaISO = Utilities.formatDate(new Date(Date.now() - 60 * 86400000), TZ, 'yyyy-MM-dd');
  for (var iT = 1; iT <= 5; iT++) {
    var tt = crearTarea({ descripcion: '__TEST__ estancada ' + iT, prioridad: 'C', tipo: 'personal' });
    var fila = leerTabla(shT).filter(function (f) { return String(f.id_tarea) === String(tt.id_tarea); })[0];
    shT.getRange(fila._fila, cFC).setValue(_viejaISO);
  }
  SpreadsheetApp.flush();
  // Esperado = lo que hay AHORA (reales + las 5 de test), contado igual que la función.
  var _estVivas = leerTabla(shT).filter(_esEstancada);
  var _espN = _estVivas.length;
  var _esp3 = _estVivas.slice().sort(function (a, b) {
    return String(aFechaISO(a.fecha_creacion)) < String(aFechaISO(b.fecha_creacion)) ? -1 : 1;
  }).slice(0, 3).map(function (t) { return String(t.id_tarea); });
  chk(_espN > ESTANCADAS_MAX, 'D15j0 el escenario es el de agrupación (' + _espN + ' > ' + ESTANCADAS_MAX + ')');

  var nEst = detectarTareasEstancadas();
  // Invariante REAL: exactamente 1 aviso tarea_estancada ACTIVO (no "1 nuevo"): si el conteo no
  // cambió desde la corrida anterior, crearAviso reusa el aviso existente y no nace ninguno nuevo.
  var _avAct = leerTabla(getMaestro().getSheetByName('Avisos')).filter(function (f) {
    return String(f.tipo) === 'tarea_estancada' && String(f.estado) === 'activo';
  });
  chk(nEst === 1 && _avAct.length === 1, 'D15j con >' + ESTANCADAS_MAX + ' estancadas queda 1 SOLO aviso resumen activo (ni N individuales ni resúmenes viejos apilados)');
  var _m = String(_avAct[0] && _avAct[0].mensaje);
  var _cap = _m.match(/^(\d+) tareas estancadas/);
  chk(!!_cap && Number(_cap[1]) === _espN, 'D15k el resumen abre con el conteo real de estancadas vivas (esperado ' + _espN + ', dijo ' + (_cap ? _cap[1] : '—') + ')');
  // Las 3 más viejas pueden ser REALES (más antiguas que las de test): se comparan contra las
  // computadas de los datos vivos, no contra las de test.
  chk(_esp3.every(function (id) { return _m.indexOf(id) > 0; }) && (_m.match(/TAR-/g) || []).length === 3,
      'D15l el resumen cita exactamente las 3 más viejas por fecha (' + _esp3.join(', ') + ')');
  // Que un resumen viejo NO sobreviva: se re-corre con otro conteo y debe seguir habiendo 1 solo.
  borrarFilasDonde(shT, function (f) { return String(f.descripcion) === '__TEST__ estancada 5'; });
  SpreadsheetApp.flush();
  detectarTareasEstancadas();
  var _avAct2 = leerTabla(getMaestro().getSheetByName('Avisos')).filter(function (f) {
    return String(f.tipo) === 'tarea_estancada' && String(f.estado) === 'activo';
  });
  chk(_avAct2.length === 1 && Number(String(_avAct2[0].mensaje).match(/^(\d+)/)[1]) === _espN - 1,
      'D15m al cambiar el conteo, el resumen viejo se resuelve y queda 1 solo (no se apilan)');
  // Los resúmenes que creó ESTE test citan un conteo que incluye las 5 tareas de prueba (que
  // limpiarTodoTest borra a continuación) → borrarlos por baseline, o el CM mostraría un número
  // falso. Los avisos REALES que la corrida resolvió quedan 'resuelto': eso NO se revierte, es el
  // comportamiento diseñado (el encargo pide resolver los individuales viejos por baseline).
  // Efecto: hasta la próxima corridaDiaria no hay ningún tarea_estancada activo. Es correcto, no
  // es pérdida de datos: la corrida de las 07:00 lo recrea con el conteo real.
  borrarFilasDonde(getMaestro().getSheetByName('Avisos'), function (f) {
    return !_avPre[String(f.id_aviso)] && String(f.tipo) === 'tarea_estancada';
  });
}

/** D16 — voz-acciones: la voz escribe con gate + la frontera de confianza. Tanda aislada: la corre _asertsF2_. */
function _asertsD16_(chk, log, opts) {
  // ── D16 (16-jul) Voz-acciones: la voz ESCRIBE, con gate. La frontera de confianza es lo que se prueba. ──
  //
  // REGLA DEL FLUJO (16-jul, la 4ª realidad): accionVoz_ es una superficie CON DEFENSAS. Su retorno de
  // RECHAZO ({ok:false, error}) es un resultado ESPERADO, no un camino imposible. Jamás se llama a
  // resolverAprobacion con res.id_aprobacion sin verificar res.ok antes: si la defensa saltó, se asserta
  // el error y se corta esa rama. (Con chk NO fatal, avanzar con undefined es un crash garantizado —
  // así reventó D16k: mandaba 5000 chars, el cap de 4KB hizo su trabajo y el test no lo contemplaba.)
  var d16cli = crearCliente({ nombre: '__TEST__ accion ' + ahoraISO(), rubro: 'test', estado: 'potencial' });
  var d16obj = abrirCliente(d16cli.id_cliente).ss.getSheetByName('objetivos');
  chk(!!d16obj, 'D16a el tenant de prueba tiene hoja objetivos');
  // (b) whitelist dura de acciones + (c) tenant fuera del roster.
  chk(accionVoz_('borrar_todo', { titulo: 'x' }, d16cli.id_cliente).error === 'accion_no_permitida', 'D16b acción fuera de ACCIONES_VOZ → rechazo (whitelist dura)');
  chk(accionVoz_('crear_objetivo', { titulo: 'x' }, 'CLI-INVENTADO').error === 'tenant_desconocido', 'D16c tenant que no está en el roster → rechazo (nunca un id del LLM)');
  chk(accionVoz_('crear_objetivo', 'no soy objeto', d16cli.id_cliente).error === 'payload_invalido', 'D16d payload no-objeto → rechazo');
  // (e) SIN Dirección: crea aprobación PENDIENTE y NO escribe el objetivo (default-deny).
  var objAntes = leerTabla(d16obj).length;
  var d16r = accionVoz_('crear_objetivo', { titulo: 'Subir la recompra', meta: '30', deadline: '2026-12-31' }, d16cli.id_cliente);
  chk(d16r.ok === true && d16r.estado === 'pendiente_aprobacion' && d16r.auto === false, 'D16e sin Dirección → deja aprobación pendiente (no dice "registrado")');
  chk(leerTabla(d16obj).length === objAntes, 'D16f sin el clic humano NO se escribió el objetivo (default-deny)');
  // (g) al aprobar, se materializa.
  _aprobarSiOk_(chk, d16cli.id_cliente, d16r, 'D16g');
  var objDespues = leerTabla(d16obj);
  var creado = objDespues.filter(function (o) { return String(o.descripcion) === 'Subir la recompra'; })[0];
  chk(!!creado, 'D16g tras aprobar, el objetivo se materializa en la hoja objetivos del tenant');
  creado = creado || {};   // sin esto, un D16g rojo se lleva puestos D16h/D16i con un TypeError
  // ROUND-TRIP DE SHEETS: se escribe '30' y '2026-12-31' (strings) pero la hoja los devuelve como
  // NÚMERO y como DATE — fecha_objetivo NO está en COLUMNAS_TEXTO, así que Sheets la tipa. Comparar
  // String(celda) contra el literal escrito es el bug que rompió D16h: normalizar SIEMPRE
  // (fechas con aFechaISO, números con Number). `estado` sí es texto y se compara tal cual.
  chk(Number(creado.valor_objetivo) === 30 && aFechaISO(creado.fecha_objetivo) === '2026-12-31' && String(creado.estado) === 'activo', 'D16h meta/deadline/estado se materializan bien');
  // (i) LA FRONTERA DE CONFIANZA: metrica SIEMPRE vacía → la voz nunca alcanza correrAgente_.
  chk(String(creado.metrica) === '', 'D16i metrica nace VACÍA → un objetivo de voz NUNCA dispara al Analista (14_director.js:48)');
  // (j) enforcement SERVER-SIDE: aunque el payload traiga metrica, se descarta (no se confía en el agente).
  var d16m = accionVoz_('crear_objetivo', { titulo: 'Con metrica colada', metrica: 'ventas_ars', meta: '5' }, d16cli.id_cliente);
  _aprobarSiOk_(chk, d16cli.id_cliente, d16m, 'D16j');
  var colado = leerTabla(d16obj).filter(function (o) { return String(o.descripcion) === 'Con metrica colada'; })[0];
  chk(!!colado && String(colado.metrica) === '', 'D16j payload con metrica incluida → se DESCARTA server-side (metrica sigue vacía)');
  // (k) payload hostil saneado + truncado en la fila. El título va POR DEBAJO del cap de 4KB a
  // propósito: con 5000 chars saltaba el cap (payload_grande) y este assert no llegaba a ejercitar
  // lo que quiere probar (saneo de \n\t + truncado a 200). El cap se prueba aparte, en D16k2.
  var hostil = 'Objetivo\thostil\ncon saltos ' + new Array(1500).join('z');
  var d16h = accionVoz_('crear_objetivo', { titulo: hostil }, d16cli.id_cliente);
  _aprobarSiOk_(chk, d16cli.id_cliente, d16h, 'D16k');
  var filaH = leerTabla(d16obj).filter(function (o) { return String(o.descripcion).indexOf('Objetivo hostil') === 0; })[0];
  chk(!!filaH && String(filaH.descripcion).indexOf('\n') < 0 && String(filaH.descripcion).indexOf('\t') < 0 && String(filaH.descripcion).length <= 201, 'D16k descripcion hostil (\\n\\t + ~1500 chars) → saneada y truncada a 200 en la fila');
  // (k2) el cap de tamaño es una DEFENSA y debe saltar: se asserta el rechazo, no se avanza.
  var d16big = accionVoz_('crear_objetivo', { titulo: new Array(5000).join('z') }, d16cli.id_cliente);
  chk(d16big && d16big.ok === false && d16big.error === 'payload_grande', 'D16k2 payload > 4KB → rechazo payload_grande (la defensa salta, sin crash)');
  chk(!leerTabla(d16obj).filter(function (o) { return String(o.descripcion).indexOf('zzz') === 0; })[0], 'D16k3 el payload rechazado NO escribió nada');
  // ── D16u (16-jul noche) EL ESPEJO: la aprobación creada por voz aparece en el CM SIN syncMaestro.
  // Bug reportado: crearAprobacion escribe en el Sheet del CLIENTE, el CM lee Aprobaciones_agregadas
  // del MAESTRO, y eso solo lo reconstruía syncMaestro (1×/día) → la voz creaba y no se veía.
  var shAggV = getMaestro().getSheetByName('Aprobaciones_agregadas');
  var espejoDe = function (id) { return leerTabla(shAggV).filter(function (f) { return String(f.id) === String(id) && String(f.id_cliente) === String(d16cli.id_cliente); }); }; // id+tenant: APR-#### es secuencia POR CLIENTE (colisión real cazada por D16y, 16-jul)
  var d16e1 = accionVoz_('crear_objetivo', { titulo: 'Objetivo espejo', meta: '9' }, d16cli.id_cliente);
  chk(d16e1.ok === true && !!d16e1.id_aprobacion, 'D16u la acción creó la aprobación');
  var filaEsp = espejoDe(d16e1.id_aprobacion);
  chk(filaEsp.length === 1, 'D16u la aprobación aparece en Aprobaciones_agregadas SIN correr syncMaestro (el CM la ve al toque)');
  chk(filaEsp[0] && String(filaEsp[0].id_cliente) === String(d16cli.id_cliente) && String(filaEsp[0].estado) === 'pendiente' && String(filaEsp[0].tipo_accion) === 'crear_objetivo',
      'D16v el espejo lleva las columnas que arma syncMaestro (id_cliente/estado/tipo_accion)');
  chk(filaEsp[0] && String(filaEsp[0].url_sheet_cliente) !== '' && String(filaEsp[0].cliente).indexOf('__TEST__') === 0,
      'D16w el espejo trae cliente + url_sheet_cliente (el CM los necesita para abrir la fila)');
  // syncMaestro es wipe-then-rebuild → NO puede duplicar la fila incremental. La idempotencia del
  // espejo es LA propiedad que sostiene el diseño (si alguien pasa syncMaestro a incremental, cada
  // corrida duplicaría) ⇒ merece guard de regresión. Pero syncMaestro abre TODOS los Sheets cliente
  // (15-30s) y selfTestF2 tiene que costar segundos ⇒ solo corre en la certificación completa.
  if (opts && opts.completo) {
    syncMaestro();
    chk(espejoDe(d16e1.id_aprobacion).length === 1, 'D16x syncMaestro posterior NO duplica la fila incremental (wipe-then-rebuild)');
  } else {
    log.push('⏭️  D16x (idempotencia vs syncMaestro) omitido: solo corre en selfTest() completo — abre todos los Sheets cliente');
  }
  // Auto-aprobada por Dirección → NO entra al espejo: el espejo lleva solo pendientes (criterio de syncMaestro).
  var shDirE = getMaestro().getSheetByName('Direcciones');
  var manE = Utilities.formatDate(new Date(Date.now() + 86400000), TZ, 'yyyy-MM-dd');
  appendFila(shDirE, { id: 'DIR-TEST-8', tipo_accion: 'crear_objetivo', alcance: d16cli.id_cliente, aprobada_fecha: hoyISO(), vigencia: manE, activa: 'si', notas: '__TEST__' });
  var d16e2 = accionVoz_('crear_objetivo', { titulo: 'Objetivo auto-aprobado' }, d16cli.id_cliente);
  chk(d16e2.auto === true, 'D16y (pre) la Dirección auto-aprobó');
  chk(espejoDe(d16e2.id_aprobacion).length === 0, 'D16y una auto-aprobada por Dirección NO entra al espejo (no espera decisión de nadie)');
  borrarFilasDonde(shDirE, function (f) { return String(f.id) === 'DIR-TEST-8'; });
  // D16y2/y3 (16-jul, tras cazar la colisión): quitarAgregada_ es POR TENANT. Mismo id 'APR-COLL'
  // en dos clientes → borrar (id, tenant A) NO toca la fila del tenant B. Fixture sintético con
  // nombre __TEST__ (limpiarTodoTest lo barre si esta tanda aborta a mitad).
  agregarAgregada_({ id_cliente: '__T_A__', nombre: '__TEST__ colisionA', url_sheet_cliente: 'x' }, { id: 'APR-COLL', estado: 'pendiente' });
  agregarAgregada_({ id_cliente: '__T_B__', nombre: '__TEST__ colisionB', url_sheet_cliente: 'x' }, { id: 'APR-COLL', estado: 'pendiente' });
  quitarAgregada_('APR-COLL', '__T_A__');
  var collE = leerTabla(shAggV).filter(function (f) { return String(f.id) === 'APR-COLL'; });
  chk(collE.length === 1 && String(collE[0].id_cliente) === '__T_B__', 'D16y2 quitarAgregada_ scoped: borrar (APR-COLL, tenant A) deja intacta la fila del tenant B');
  quitarAgregada_('APR-COLL', '__T_B__');
  chk(leerTabla(shAggV).filter(function (f) { return String(f.id) === 'APR-COLL'; }).length === 0, 'D16y3 limpieza del fixture de colisión (espejo sin residuo)');
  // Fail-safe: el espejo NUNCA rompe la creación. Se simula el fallo con datos inválidos.
  chk(agregarAgregada_(null, { estado: 'pendiente' }) === false, 'D16z1 espejo sin cliente → false, sin tirar');
  chk(agregarAgregada_({ id_cliente: 'X' }, null) === false, 'D16z2 espejo sin fila → false, sin tirar');
  chk(agregarAgregada_({ id_cliente: 'X' }, { estado: 'aprobada' }) === false, 'D16z3 el criterio del espejo (solo pendientes) se respeta en el helper');

  // (l) el North Star de SISTEMA no se crea por voz (fuente única = Config).
  chk(accionVoz_('crear_objetivo', { titulo: 'Mi north star: 6 clientes pagos' }, d16cli.id_cliente).error === 'north_star_no_por_voz', 'D16l un título que pretende ser el North Star de sistema → rechazo (fuente única en Config)');
  chk(_hueleANorthStar_('north star') && _hueleANorthStar_('el objetivo de Satori') && !_hueleANorthStar_('subir el AOV'), 'D16m el detector de North Star no marca objetivos operativos normales');
  // (n) velocidad 2: con Dirección vigente → auto-aprueba Y ejecuta en el mismo turno.
  var shDir16 = getMaestro().getSheetByName('Direcciones');
  var man16 = Utilities.formatDate(new Date(Date.now() + 86400000), TZ, 'yyyy-MM-dd');
  appendFila(shDir16, { id: 'DIR-TEST-9', tipo_accion: 'crear_objetivo', alcance: d16cli.id_cliente, aprobada_fecha: hoyISO(), vigencia: man16, activa: 'si', notas: '__TEST__' });
  var d16v2 = accionVoz_('crear_objetivo', { titulo: 'Objetivo por dirección' }, d16cli.id_cliente);
  chk(d16v2.ok === true && d16v2.estado === 'registrado' && d16v2.auto === true && d16v2.direccion === 'DIR-TEST-9', 'D16n con Dirección vigente → registrado en el mismo turno, citando la dirección');
  var porDir = leerTabla(d16obj).filter(function (o) { return String(o.descripcion) === 'Objetivo por dirección'; })[0];
  chk(!!porDir && String(porDir.id_objetivo) === String(d16v2.id_objetivo), 'D16o la velocidad 2 devuelve el id real creado (evidencia, no promesa)');
  chk(String(porDir.metrica) === '', 'D16p ni siquiera por Dirección se cuela metrica (el camino sin gate humano tampoco)');
  borrarFilasDonde(shDir16, function (f) { return String(f.id) === 'DIR-TEST-9'; });
  // (q) P4 research: el prefijo rutea sin gastar Haiku.
  chk(esResearch_('[RESEARCH] competidores de X') === true && esResearch_('nota normal') === false, 'D16q el prefijo [RESEARCH] se detecta literal');
  chk(BANDEJA_BINS.indexOf('research') >= 0, 'D16r "research" es un bin válido de la Bandeja');
  // (s) P1 North Star: siembra idempotente en Config (fuente única).
  var nsB = getConfig('ns_satori_desc');
  var s1 = sembrarNorthStarSatori_();
  var s2 = sembrarNorthStarSatori_();
  chk(s2.sembrado === false, 'D16s sembrarNorthStarSatori_ es idempotente (la 2a vez no pisa)');
  chk(!!northStarSatori_() && northStarSatori_().meta === 6, 'D16t el North Star queda en Config con meta 6');
  if (!nsB) { ['ns_satori_desc', 'ns_satori_metrica', 'ns_satori_valor', 'ns_satori_horizonte'].forEach(function (k) { setConfig(k, ''); }); } // restaurar baseline
}


/**
 * Runner ACOTADO (16-jul): corre SOLO D14+D15+D16 con su propia limpieza. NO corre el pipeline
 * pesado de selfTest() (correrDirector / correrSalud / briefs / sync ≈ 7 min). Iterar un assert
 * nuevo tiene que costar segundos, no una corrida entera.
 * selfTest() completo sigue siendo la certificación final: correr UNA vez al cerrar.
 */
function selfTestF2_() {
  var log = [], fallos = [];
  // chk ACUMULATIVO (16-jul): registra y SIGUE. El chk fatal de selfTest() devolvía UN rojo por
  // corrida — con D14-D16 iterándose, eso es un fallo por vuelta. Acá una corrida = TODOS los rojos.
  // Las tandas van aisladas en _asertsF2_, así que un undefined encadenado no se lleva las otras dos.
  function chk(cond, msg) { log.push((cond ? '✅ ' : '❌ ') + msg); if (!cond) fallos.push(msg); }
  try {
    setup();            // reconcilia Direcciones + Cola_archivo (idempotente)
    limpiarTodoTest();  // pre-clean: restos de una corrida que falló a mitad
    // completo:false => se saltea lo que abre TODOS los Sheets cliente (syncMaestro, 15-30s). Ese es
    // el precio de que este runner cueste segundos; la certificación de selfTest() sí lo corre.
    _asertsF2_(chk, log, { completo: false });
  } finally {
    var l = limpiarTodoTest();   // la limpieza corre SIEMPRE, pase o falle
    log.push('🧹 limpieza: ' + l.clientes + ' cliente(s) __TEST__ a papelera, filas TEST removidas');
  }
  log.push(fallos.length
    ? '— ' + fallos.length + ' FALLO(S) —'
    : '— F2 TODO OK: D14 contrato + D15 mantenimiento + D16 voz-acciones —');
  var salida = log.join('\n');
  Logger.log(salida);
  // Tirar al final con la lista COMPLETA: el log ya quedó impreso arriba (no se pierde nada).
  if (fallos.length) throw new Error('FALLOS (' + fallos.length + '):\n- ' + fallos.join('\n- '));
  return salida;
}

/**
 * Wrapper PÚBLICO de selfTestF2_ — el desplegable del editor de Apps Script NO lista las funciones
 * que terminan en guión bajo (son privadas por convención GAS). Sin esto, Luciano no la puede correr.
 * Misma lección que el 14-jul con sgicConsulta_, ya anotada en el HANDOFF.
 */
function selfTestF2() { return selfTestF2_(); }

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
  // D14 (16-jul): el assert del contrato usa origen_id '__TEST__f2' → barrer por prefijo, no por igualdad.
  if (shFbk) borrarFilasDonde(shFbk, function (f) { return String(f.origen_id).indexOf('__TEST__') === 0; });
  // F2 (16-jul): direcciones de prueba (DIR-TEST-*). Es una superficie de auto-aprobación:
  // una fila de test olvidada acá auto-aprobaría de verdad → barrer siempre.
  var shDirL = ss.getSheetByName('Direcciones');
  if (shDirL) borrarFilasDonde(shDirL, function (f) { return String(f.id).indexOf('DIR-TEST') === 0; });
  // F2 (16-jul): archivo de cola — mismo criterio que Cola_tareas (noop / worker de test).
  var shColaArch = ss.getSheetByName('Cola_archivo');
  if (shColaArch) borrarFilasDonde(shColaArch, function (f) {
    if (String(f.tipo) === 'noop' || String(f.worker) === '__TESTWORKER__') return true;
    var p = String(f.payload || '');
    for (var idA in idsTest) { if (idsTest[idA] && p.indexOf('"id_cliente":"' + idA + '"') >= 0) return true; }
    return false;
  });
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
