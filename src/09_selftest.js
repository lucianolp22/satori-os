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
    // Sensibles ocultas. OJO con las hojas LAZY: `CLIENTE_SHEETS_SENSIBLES` ya no es un subconjunto
    // de `CLIENTE_ORDEN`. Desde la cadena (21-jul) hay 3 hojas sensibles que NO las crea
    // `crearCliente` — `cerebro_log_archivo` y `cerebro_resumen` (las hace `repararCerebro` /
    // `comprimirMemoriaFria`) y `hilo` (`repararHilo` / `espejarHilo`). En un cliente recién creado
    // NO existen, y `getSheetByName` devuelve null: por eso este bucle reventaba con
    // `TypeError: null.isSheetHidden` (incidente 23-jul, cazado por el selfTest en el editor).
    //
    // Criterio: ausente es LEGÍTIMO solo si la hoja es lazy (no está en CLIENTE_ORDEN). Si está en
    // CLIENTE_ORDEN y falta, eso SÍ es un fallo real — `crearCliente` debía haberla creado.
    // Si existe, se exige oculta como siempre: quien crea una hoja lazy la crea oculta+protegida.
    CLIENTE_SHEETS_SENSIBLES.forEach(function (n) {
      var sh = cliSS.getSheetByName(n);
      if (!sh) {
        chk(CLIENTE_ORDEN.indexOf(n) < 0,
            'pestaña sensible ausente pero LAZY (se crea a demanda, oculta): ' + n);
        return;
      }
      chk(sh.isSheetHidden(), 'pestaña sensible oculta: ' + n);
    });
    // Invariante de la lista-contrato: una hoja sensible con el nombre mal escrito no existiría en
    // ningún cliente, el bucle de arriba la daría por "lazy" y el chequeo quedaría mudo para siempre.
    CLIENTE_SHEETS_SENSIBLES.forEach(function (n) {
      chk(!!CLIENTE_SHEETS[n], 'hoja sensible declarada existe en CLIENTE_SHEETS (sin typo): ' + n);
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

    // ── ETAPA 8a · a3 — Salud (7 chequeos, dryRun: no escribe a producción) ────
    var sal = correrSalud({ dryRun: true });
    chk(sal.hallazgos.length === 7, 'E8a-3 Salud corre los 7 chequeos (' + sal.hallazgos.length + ')');
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
   { n: 'D16 voz-acciones', f: _asertsD16_ },
   { n: 'D17h boot único', f: _asertsD17h_ },
   { n: 'D17i boot 2 olas', f: _asertsD17i_ },
   { n: 'D17j métrica CM v3', f: _asertsD17j_ },
   { n: 'D18 north star + reset', f: _asertsD18_ },
   { n: 'D19 módulo S seguridad', f: _asertsD19_ },
   { n: 'D20 serie North Star (M2)', f: _asertsD20_ },
   { n: 'D21 memoria caliente/fría (M3)', f: _asertsD21_ },
   { n: 'D22 golden-set evals (M4)', f: _asertsD22_ },
   { n: 'D23 verificación ≥2 dominios (M5)', f: _asertsD23_ },
   { n: 'D24 SOUL + salud humana + cerebroNodo (H)', f: _asertsD24_ },
   { n: 'D25 conectores generalizados (TC-W3)', f: _asertsD25_ },
   { n: 'D26 Hilo end-to-end (TC-W1/W2/W4)', f: _asertsD26_ }].forEach(function (t) {
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
  // M5 (18-jul) insertó "- Verificación:" en [2] → la forma pasó de 4 a 5 renglones; Contrapeso/Acción corridos a [3]/[4].
  chk(d14r.length === 5 && d14r[1].indexOf('d=1') > 0 && d14r[2].indexOf('Verificación:') > 0 && d14r[3].indexOf('Contrapeso:') > 0 && d14r[3].length > 18 && d14r[4].indexOf('Acción:') > 0, 'D14g rec contractual = dato + verificación + contrapeso (fallback no vacío) + acción');

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
  // Restaurar baseline. Las 3 claves enriquecidas van en la lista desde el 20-jul: cargarNorthStarSatori
  // ahora las siembra por default, así que sin esto el test dejaba residuo cuando Config estaba vacía.
  if (!nsB) { ['ns_satori_desc', 'ns_satori_metrica', 'ns_satori_valor', 'ns_satori_horizonte',
               'ns_satori_metricas', 'ns_satori_valores', 'ns_satori_pivots'].forEach(function (k) { setConfig(k, ''); }); }
}


/**
 * D17j — T1 métrica CM v3 (17/18-jul). Tanda aislada: la corre _asertsF2_.
 *
 * NUMERACIÓN: arranca en D17j y NO en D17a como pedía el encargo del 17-jul. AKASHA E3.7 (posterior
 * al encargo) ya ocupó D17h/D17i con los asserts de boot en 2 tiempos; reusar D17a-g los habría
 * pisado. Mapa encargo→acá: A(whitelist+asignarMetricaUI) = D17j-n · B(cifras) = D17o · C(tenant en
 * encolarAgente) = D17p.
 *
 * LO QUE PRUEBA DE VERDAD: que mudar la métrica de "celda a mano en Sheets" a "chip en el CM" NO
 * debilita la frontera de confianza. El enforcement es server-side con match EXACTO (D17j), y el
 * camino de la voz sigue descartando `metrica` como antes (D17l, regresión de D16j).
 */
function _asertsD17j_(chk, log, opts) {
  var cli = crearCliente({ nombre: '__TEST__ metrica ' + ahoraISO(), rubro: 'test', estado: 'potencial' });
  var id = cli.id_cliente;
  var shObj = abrirCliente(id).ss.getSheetByName('objetivos');
  chk(!!shObj, 'D17j-pre el tenant de prueba tiene hoja objetivos');

  // Objetivo de prueba, nacido SIN métrica (como lo deja ejecutarCrearObjetivo_).
  appendFila(shObj, { id_objetivo: 'OBJ-9001', horizonte: '12m', descripcion: '__TEST__ objetivo métrica',
                      metrica: '', valor_objetivo: '', estado: 'activo', prioridad: 'B', fecha_objetivo: '' });
  SpreadsheetApp.flush();
  var filaDe = function (idObj) { return leerTabla(shObj).filter(function (o) { return String(o.id_objetivo) === idObj; })[0]; };

  // ── D17j — métrica fuera de la whitelist → rechazo, y NADA escrito (no hay escritura parcial).
  var r1 = asignarMetricaUI(id, 'OBJ-9001', 'metrica_inventada_por_el_llm');
  chk(r1 && r1.ok === false && r1.error === 'metrica_invalida', 'D17j métrica fuera de la whitelist → metrica_invalida (match EXACTO server-side)');
  chk(String((filaDe('OBJ-9001') || {}).metrica) === '', 'D17j2 el rechazo NO escribió la celda (sigue vacía)');
  // Variantes que un match laxo dejaría pasar: case y wildcard. Patrón Direcciones = case-SENSITIVE.
  chk(asignarMetricaUI(id, 'OBJ-9001', 'Ventas_ARS').error === 'metrica_invalida', 'D17j3 la whitelist es case-sensitive (Ventas_ARS ≠ ventas_ars)');
  chk(asignarMetricaUI(id, 'OBJ-9001', '*').error === 'metrica_invalida', 'D17j4 sin wildcard: "*" no matchea nada');
  chk(asignarMetricaUI('CLI-INVENTADO', 'OBJ-9001', 'ventas_ars').error === 'tenant_desconocido', 'D17j5 tenant fuera del roster → rechazo (mismo criterio que accionVoz_)');

  // ── D17k — asignación válida: escribe la celda Y deja rastro en el feed.
  var shAct = getMaestro().getSheetByName('Actividad');
  var actAntes = leerTabla(shAct).length;
  var r2 = asignarMetricaUI(id, 'OBJ-9001', 'ventas_ars');
  chk(r2 && r2.ok === true && r2.metrica === 'ventas_ars', 'D17k asignación válida → ok con la métrica asignada');
  chk(String((filaDe('OBJ-9001') || {}).metrica) === 'ventas_ars', 'D17k2 la celda metrica quedó escrita en la hoja del tenant');
  var feedNuevo = leerTabla(shAct).slice(actAntes).filter(function (f) { return String(f.tipo) === 'metrica_asignada' && String(f.id_cliente) === id; });
  chk(feedNuevo.length === 1, 'D17k3 la asignación deja UNA entrada metrica_asignada en el feed (trazable)');
  // "sin métrica por ahora" es un camino legítimo del chip: vacía sin pasar por la whitelist.
  var r3 = asignarMetricaUI(id, 'OBJ-9001', '');
  chk(r3 && r3.ok === true && String((filaDe('OBJ-9001') || {}).metrica) === '', 'D17k4 "sin métrica por ahora" vacía la celda (saca el objetivo del análisis dirigido)');

  // ── D17l — REGRESIÓN DE LA FRONTERA: el camino de la VOZ sigue descartando metrica (D16j vigente).
  // Si esto se pone rojo, T1 debilitó la frontera en lugar de mudarla: es el assert que más importa.
  var v = accionVoz_('crear_objetivo', { titulo: '__TEST__ frontera T1', metrica: 'ventas_ars' }, id);
  _aprobarSiOk_(chk, id, v, 'D17l');
  var porVoz = leerTabla(shObj).filter(function (o) { return String(o.descripcion) === '__TEST__ frontera T1'; })[0];
  chk(!!porVoz && String(porVoz.metrica) === '', 'D17l la voz con metrica en el payload SIGUE descartándola (frontera intacta tras T1)');

  // ── D17m — objetivo inexistente → rechazo claro (no crea nada al pasar).
  var filasAntes = leerTabla(shObj).length;
  chk(asignarMetricaUI(id, 'OBJ-NOEXISTE', 'ventas_ars').error === 'objetivo_inexistente', 'D17m objetivo inexistente → rechazo objetivo_inexistente');
  chk(asignarMetricaUI(id, '', 'ventas_ars').error === 'objetivo_inexistente', 'D17m2 id_objetivo vacío → rechazo (no toca la primera fila que encuentre)');
  chk(leerTabla(shObj).length === filasAntes, 'D17m3 los rechazos no agregaron filas');

  // ── D17n — la whitelist es unión: curadas + lo que el cliente YA usa + la columna kpi de KPIs.
  appendFila(shObj, { id_objetivo: 'OBJ-9002', horizonte: '12m', descripcion: '__TEST__ métrica propia',
                      metrica: 'metrica_propia_del_cliente', valor_objetivo: '', estado: 'activo', prioridad: 'B', fecha_objetivo: '' });
  var shKpi = abrirCliente(id).ss.getSheetByName('KPIs');
  if (shKpi) appendFila(shKpi, { fecha: hoyISO(), kpi: 'kpi_propio_del_cliente', valor: 1, objetivo: 1, alerta: '' });
  SpreadsheetApp.flush();
  var ms = metricasValidas_(id);
  chk(ms.indexOf('ventas_ars') >= 0 && ms.indexOf('ticket_promedio_ars') >= 0, 'D17n la whitelist incluye el set curado global');
  chk(ms.indexOf('metrica_propia_del_cliente') >= 0, 'D17n2 incluye lo que el cliente YA usa en objetivos.metrica');
  if (shKpi) chk(ms.indexOf('kpi_propio_del_cliente') >= 0, 'D17n3 incluye la columna kpi de la hoja KPIs del cliente');
  chk(ms.length === ms.filter(function (x, i) { return ms.indexOf(x) === i; }).length, 'D17n4 la whitelist no trae duplicados');
  // Y lo que la whitelist admite, asignarMetricaUI lo acepta (whitelist y endpoint no divergen).
  chk(asignarMetricaUI(id, 'OBJ-9001', 'metrica_propia_del_cliente').ok === true, 'D17n5 una métrica propia del cliente SÍ se puede asignar (whitelist y endpoint coherentes)');

  // ── D17o — cifras SIEMPRE en números (T1-B). Determinista, sin LLM.
  chk(normalizarCifrasTexto_('ciento treinta mil pesos') === '$130.000', 'D17o "ciento treinta mil pesos" → "$130.000"');
  chk(normalizarCifrasTexto_('un millón doscientos mil pesos') === '$1.200.000', 'D17o2 millones también ("un millón doscientos mil pesos" → "$1.200.000")');
  // El ACOTADO es la defensa: sin multiplicador no toca nada, así "un objetivo" no se vuelve "1 objetivo".
  chk(normalizarCifrasTexto_('un objetivo de ventas') === 'un objetivo de ventas', 'D17o3 sin multiplicador NO toca el texto (los artículos un/una quedan intactos)');
  chk(normalizarCifrasTexto_('texto sin cifras') === 'texto sin cifras', 'D17o4 texto sin cifras pasa igual (jamás inventa)');
  // Y de punta a punta: un título dictado en palabras queda en cifras EN LA FILA.
  var vc = accionVoz_('crear_objetivo', { titulo: '__TEST__ ticket de ciento treinta mil pesos' }, id);
  _aprobarSiOk_(chk, id, vc, 'D17o5');
  var filaCifra = leerTabla(shObj).filter(function (o) { return String(o.descripcion).indexOf('__TEST__ ticket de') === 0; })[0];
  chk(!!filaCifra && String(filaCifra.descripcion).indexOf('$130.000') >= 0 && String(filaCifra.descripcion).indexOf('ciento treinta mil') < 0,
      'D17o5 un título dictado en palabras queda escrito en cifras en la fila ($130.000)');

  // ── D17p — defensa de tenant en encolarAgente (hallazgo TERCERA PRUEBA AKASHA).
  // El caso real: idCliente = "Todos los Espacios" (el option nacía sin value) → Analista contra
  // tenant fantasma → "Errores: 1". La UI ya lo corta; esto prueba la capa server.
  var tiro = null;
  try { encolarAgente('Todos los Espacios', 'analista', {}); } catch (e) { tiro = String((e && e.message) || e); }
  chk(tiro !== null && tiro.indexOf('tenant desconocido') >= 0, 'D17p el tenant fantasma REAL ("Todos los Espacios") → throw "tenant desconocido"');
  tiro = null;
  try { encolarAgente('CLI-NOEXISTE', 'analista', {}); } catch (e) { tiro = String((e && e.message) || e); }
  chk(tiro !== null && tiro.indexOf('tenant desconocido') >= 0, 'D17p2 tenant fuera del roster → throw con mensaje claro');
  // El caso feliz sigue encolando (la defensa no rompió el camino bueno). La fila la barre limpiarTodoTest.
  var feliz = null, errFeliz = null;
  try { feliz = encolarAgente(id, 'analista', {}); } catch (e2) { errFeliz = String((e2 && e2.message) || e2); }
  chk(!!feliz && !!feliz.tareaId, 'D17p3 un tenant REAL del roster sigue encolando' + (errFeliz ? ' (tiró: ' + errFeliz + ')' : ''));
  // El agente inexistente sigue rechazándose ANTES que el tenant (no se invirtió el orden de guardas).
  tiro = null;
  try { encolarAgente(id, 'agente_inventado', {}); } catch (e3) { tiro = String((e3 && e3.message) || e3); }
  chk(tiro !== null && tiro.indexOf('agente desconocido') >= 0, 'D17p4 agente desconocido sigue rechazándose (guardas en orden)');
}


/**
 * D18 — North Star enriquecido (A) · pivots descartados (B) · reset (C) · error fantasma (D). 20-jul.
 *
 * LO QUE ESTA TANDA **NO** HACE, A PROPÓSITO: no llama a `resetObjetivosYNorthStar()`. Esa función
 * borra las hojas `objetivos` de tenants REALES; meterla en la batería de tests la convertiría en
 * una bomba que se dispara sola cada vez que alguien corre selfTest. Se testean sus PIEZAS (el
 * respaldo, el restore, y la exclusión hard-coded de CLI-002); el disparo entero lo hace Luciano a
 * mano, una vez, con el backup ya verificado. Tanda aislada: la corre _asertsF2_.
 */
function _asertsD18_(chk, log, opts) {
  // ── D18a (Parte A · sistema) — el lector enriquecido lee los 3 campos nuevos, y sin ellos NO rompe.
  var nsBase = {};
  ['ns_satori_desc', 'ns_satori_metrica', 'ns_satori_valor', 'ns_satori_horizonte',
   'ns_satori_metricas', 'ns_satori_valores', 'ns_satori_pivots'].forEach(function (k) { nsBase[k] = getConfig(k); });
  try {
    setConfig('ns_satori_desc', '__TEST__ norte'); setConfig('ns_satori_metrica', 'm_principal');
    setConfig('ns_satori_valor', '6'); setConfig('ns_satori_horizonte', '2026-12-31');
    // Sin los campos nuevos: backward-compat (el lector viejo no rompe y los nuevos salen vacíos).
    setConfig('ns_satori_metricas', ''); setConfig('ns_satori_valores', ''); setConfig('ns_satori_pivots', '');
    var nsViejo = northStarSatori_();
    chk(!!nsViejo && nsViejo.desc === '__TEST__ norte' && nsViejo.meta === 6, 'D18a sin los campos nuevos, el North Star viejo se sigue leyendo igual');
    chk(nsViejo.metricas.length === 0 && nsViejo.valores.length === 0 && nsViejo.pivots.length === 0, 'D18a2 campos nuevos ausentes → arrays vacíos (backward-compat, no undefined)');
    // Con los campos nuevos: 3 métricas en total (1 principal + 2 extra) + guardrails + pivots.
    setConfig('ns_satori_metricas', 'm_segunda · m_tercera');
    setConfig('ns_satori_valores', 'no crecer a costa de la paz del dueño · no tomar cliente sin fit');
    setConfig('ns_satori_pivots', '2026-05-01·vender por Ads·quemaba caja sin retorno\n2026-06-10·abrir oficina física·no aporta al norte');
    var nsRico = northStarSatori_();
    chk(nsRico.metricas.length === 2 && nsRico.metricas[0] === 'm_segunda' && nsRico.metricas[1] === 'm_tercera', 'D18a3 métricas secundarias separadas por · se leen (hasta 3 en total con la principal)');
    chk(nsRico.valores.length === 2 && nsRico.valores[0].indexOf('paz del dueño') >= 0, 'D18a4 los guardrails se leen');
    chk(nsRico.pivots.length === 2 && nsRico.pivots[0].fecha === '2026-05-01' && nsRico.pivots[0].que === 'vender por Ads' && nsRico.pivots[0].porque.indexOf('caja') >= 0,
        'D18a5 los pivots se parsean a {fecha,qué,porqué}, uno por línea');
    // Parser tolerante: una línea con SOLO el "qué" también vale (lo escribe un humano en una celda).
    chk(_nsPivots_('solo el qué')[0].que === 'solo el qué', 'D18a6 una línea sin fecha ni porqué igual cuenta como pivot');
    chk(_nsPivots_('').length === 0 && _nsLista_('').length === 0, 'D18a7 celda vacía → array vacío (nunca [""])');

    // ── D18c (Parte B) — un pivot descartado NO se re-propone.
    chk(!!_pivotMuerto_({ texto: 'Probar vender por Ads este mes' }, nsRico.pivots), 'D18c una recomendación que cae en un pivot muerto se detecta');
    chk(_pivotMuerto_({ texto: 'Cerrar la vencida más vieja' }, nsRico.pivots) === null, 'D18c2 una recomendación sana NO se marca como pivot');
    chk(_pivotMuerto_({ texto: 'VENDER POR ADS otra vez' }, nsRico.pivots) !== null, 'D18c3 el match ignora mayúsculas/tildes');
    chk(_pivotMuerto_({ texto: 'cualquier cosa' }, [{ que: 'ads' }]) === null, 'D18c4 un "qué" de menos de 4 chars se ignora (no silencia media Bandeja)');
    // La recomendación del día real nunca devuelve algo que caiga en un pivot vigente.
    var recHoy = recomendacionDelDia_();
    chk(!!recHoy && !!recHoy.texto, 'D18c5 recomendacionDelDia_ sigue devolviendo una recomendación tras el refactor a candidatas');
    chk(_pivotMuerto_(recHoy, nsRico.pivots) === null, 'D18c6 la recomendación del día NO cae en un pivot descartado');
  } finally {
    Object.keys(nsBase).forEach(function (k) { setConfig(k, nsBase[k]); });   // baseline restaurado SIEMPRE
  }

  // ── D18b (Parte A · tenant) — las columnas nuevas de `objetivos` se declaran y se leen.
  ['metricas_extra', 'valores', 'pivots_descartados'].forEach(function (col) {
    chk(CLIENTE_SHEETS.objetivos.indexOf(col) >= 0, 'D18b el schema de objetivos declara ' + col);
  });
  var d18cli = crearCliente({ nombre: '__TEST__ northstar ' + ahoraISO(), rubro: 'test', estado: 'potencial' });
  var d18id = d18cli.id_cliente;
  var shO = abrirCliente(d18id).ss.getSheetByName('objetivos');
  appendFila(shO, { id_objetivo: 'OBJ-0001', horizonte: '12m', descripcion: '__TEST__ norte del tenant',
                    metrica: 'ticket_promedio_ars', valor_objetivo: 130000, estado: 'activo', prioridad: 'A', fecha_objetivo: '',
                    metricas_extra: 'ordenes_mes · recompra_pct', valores: 'no vender bajo costo',
                    pivots_descartados: '2026-04-01·bajar precios·mata el margen' });
  SpreadsheetApp.flush();
  var nsT = northStarTenant_(d18id);
  chk(!!nsT && nsT.id_objetivo === 'OBJ-0001' && nsT.metrica === 'ticket_promedio_ars', 'D18b2 northStarTenant_ toma el objetivo activo de mayor prioridad');
  chk(nsT.metricas.length === 2 && nsT.valores.length === 1 && nsT.pivots.length === 1, 'D18b3 el lector de tenant devuelve métricas extra + valores + pivots');
  chk(_pivotsTenant_(d18id).length === 1 && _pivotsTenant_(d18id)[0].que === 'bajar precios', 'D18b4 _pivotsTenant_ junta los pivots del tenant');
  // Un objetivo SIN los campos nuevos no rompe el lector (tenants viejos).
  appendFila(shO, { id_objetivo: 'OBJ-0002', horizonte: '12m', descripcion: '__TEST__ sin campos nuevos',
                    metrica: 'ordenes_mes', valor_objetivo: 200, estado: 'activo', prioridad: 'B', fecha_objetivo: '' });
  SpreadsheetApp.flush();
  chk(!!northStarTenant_(d18id) && northStarTenant_(d18id).id_objetivo === 'OBJ-0001', 'D18b5 un objetivo sin los campos nuevos no rompe el lector (sigue ganando prioridad A)');

  // ── D18d (Parte C) — las PIEZAS del reset. El reset entero NO se dispara acá (ver docstring).
  chk(RESET_EXCLUIR.indexOf('CLI-002') >= 0, 'D18d CLI-002 está hard-codeado en RESET_EXCLUIR (decisión de Luciano 20-jul)');
  chk(typeof resetObjetivosYNorthStar === 'function' && String(resetObjetivosYNorthStar).indexOf('_respaldarObjetivos_') > 0,
      'D18d2 el reset respalda ANTES de borrar (el respaldo es la primera llamada, no un opcional)');
  chk(typeof restaurarObjetivosDesdeBackup === 'function', 'D18d3 existe la vía de restore (el backup sin restore no es backup)');
  if (opts && opts.completo) {
    // Drill de restore REAL sobre el tenant de prueba: respaldar → vaciar → restaurar → comparar.
    var antes = leerTabla(shO);
    var bk = _respaldarObjetivos_();
    chk(bk.ok && !!bk.id, 'D18d4 el respaldo produce un Spreadsheet fechado (id ' + bk.id + ')');
    chk(_verificarRespaldo_(bk) === true, 'D18d5 el respaldo VERIFICA como restaurable antes de habilitar el borrado');
    conLock(function () { if (shO.getLastRow() > 1) shO.deleteRows(2, shO.getLastRow() - 1); });
    chk(shO.getLastRow() === 1, 'D18d6 tras el borrado la hoja queda SOLO con encabezados');
    restaurarObjetivosDesdeBackup(bk.id, d18id);
    var despues = leerTabla(shO);
    chk(despues.length === antes.length, 'D18d7 el restore devuelve el MISMO conteo de filas (' + antes.length + ')');
    chk(despues.length > 0 && String(despues[0].id_objetivo) === String(antes[0].id_objetivo) && String(despues[0].pivots_descartados) === String(antes[0].pivots_descartados),
        'D18d8 el restore devuelve las filas IDÉNTICAS (incluidos los campos nuevos)');
    try { DriveApp.getFileById(bk.id).setTrashed(true); } catch (_t) {}   // el drill no deja basura en Drive
  } else {
    log.push('⏭️  D18d4-d8 (drill de respaldo/restore) omitido: solo en selfTest() completo — crea un Spreadsheet en Drive y abre todos los Sheets cliente');
  }

  // ── D18e (Parte D) — el error fantasma se ARCHIVA (no se borra) y el de un tenant REAL se respeta.
  // OJO: limpiarErroresFantasma_ corre sobre la Cola_tareas REAL, así que además de las filas
  // sintéticas de acá puede archivar el fantasma de verdad del 17-jul. Es exactamente lo que se
  // busca (es idempotente y no destructivo), pero que no sorprenda: queda dicho.
  var shCola = getMaestro().getSheetByName('Cola_tareas');
  var cliReal = leerTabla(getMaestro().getSheetByName('Clientes'))[0];
  appendFila(shCola, { id: 'TAR-TEST-FANTASMA', worker: '__TESTWORKER__', tipo: 'agente',
                       payload: JSON.stringify({ agente: 'analista', id_cliente: 'Todos los Espacios' }),
                       estado: 'fallida', resultado: '', error: '__TEST__ fantasma', tomada_por: '',
                       creada_en: ahoraISO(), tomada_en: '', completada_en: '' });
  if (cliReal) appendFila(shCola, { id: 'TAR-TEST-REAL', worker: '__TESTWORKER__', tipo: 'agente',
                       payload: JSON.stringify({ agente: 'analista', id_cliente: String(cliReal.id_cliente) }),
                       estado: 'fallida', resultado: '', error: '__TEST__ error real', tomada_por: '',
                       creada_en: ahoraISO(), tomada_en: '', completada_en: '' });
  SpreadsheetApp.flush();
  var rD = limpiarErroresFantasma_();
  var colaPost = leerTabla(shCola);
  var fant = colaPost.filter(function (f) { return String(f.id) === 'TAR-TEST-FANTASMA'; })[0];
  chk(!!fant, 'D18e la fila fantasma SIGUE en la hoja (se archiva, NO se borra: conserva historia)');
  chk(!!fant && String(fant.estado) === 'archivada', 'D18e2 la fila fantasma quedó como "archivada" (sale del conteo de errores)');
  if (cliReal) {
    var real = colaPost.filter(function (f) { return String(f.id) === 'TAR-TEST-REAL'; })[0];
    chk(!!real && String(real.estado) === 'fallida', 'D18e3 un error de un tenant REAL NO se archiva (sigue contando, es un error de verdad)');
  }
  chk(rD.archivadas >= 1, 'D18e4 el resultado reporta cuántas archivó (log auditable)');
  // Idempotente: correrla de nuevo no re-archiva lo ya archivado.
  var rD2 = limpiarErroresFantasma_();
  chk(rD2.archivadas === 0, 'D18e5 correrla de nuevo archiva 0 (idempotente: lo ya archivado no vuelve a contar)');
  // El contador que ve el CM: los fantasmas ya no suman.
  var tel = telemetriaMaestro_();
  chk(tel && typeof tel.errores === 'number', 'D18e6 telemetriaMaestro_ sigue devolviendo el contador de errores del mes (=' + (tel && tel.errores) + ')');
  borrarFilasDonde(shCola, function (f) { return String(f.id).indexOf('TAR-TEST-') === 0; });
}


/**
 * Runner ACOTADO (16-jul): corre SOLO D14+D15+D16 con su propia limpieza. NO corre el pipeline
 * pesado de selfTest() (correrDirector / correrSalud / briefs / sync ≈ 7 min). Iterar un assert
 * nuevo tiene que costar segundos, no una corrida entera.
 * selfTest() completo sigue siendo la certificación final: correr UNA vez al cerrar.
 */
/** D17h — bootUnico(): agregador fail-closed POR SECCIÓN. Devuelve las 6 claves;
 *  si una fuente revienta, esa clave viaja null y las otras 5 viven (nunca todo-o-nada).
 *  No toca datos: fuerza el fallo reemplazando temporalmente una función global y la
 *  restaura en finally. Tanda aislada: la corre _asertsF2_. */
/**
 * D19 — MÓDULO S (T3, 21-jul): gate de identidad · expiry de secretos · matriz de riesgo ·
 * security-scan. Tanda aislada: la corre _asertsF2_.
 *
 * NO escribe NINGUNA Script Property (ni para probar): un test que pise OWNER_EMAIL y muera a
 * mitad dejaría a Luciano afuera de su propio CM. Por eso el criterio de puerta y el de
 * vencimiento viven en funciones PURAS (_puertaOwner_ / _vencido_) que se aseran sin tocar nada.
 */
function _asertsD19_(chk, log, opts) {
  // selfTest() invoca doPost() más arriba (assert de voz) y ese camino, con secreto válido,
  // deja SATORI_CTX_SISTEMA en true para el resto de la ejecución. Si no lo bajáramos, los
  // asserts del gate pasarían por el bypass de sistema en vez de por la identidad: verde
  // mentiroso. Se apaga acá y se restaura al final (el resto de la corrida no cambia).
  var _ctxPrevio = SATORI_CTX_SISTEMA;
  SATORI_CTX_SISTEMA = false;
  try {
  // ── S1a — la puerta (función pura). Fail-closed en las 4 combinaciones.
  chk(_puertaOwner_('a@b.com', 'a@b.com') === true, 'D19a el owner pasa');
  chk(_puertaOwner_('otro@b.com', 'a@b.com') === false, 'D19a2 un email distinto NO pasa');
  chk(_puertaOwner_('', 'a@b.com') === false, 'D19a3 email vacío (anónimo del deploy público) NO pasa');
  chk(_puertaOwner_('a@b.com', '') === false, 'D19a4 sin OWNER_EMAIL no pasa NADIE (fail-closed, PURGA #4)');

  // ── S1b — el gate real: en el editor corre como Luciano ⇒ _esOwner_ true y _soloOwner_ no tira.
  // Si este assert sale ❌, la Session del editor NO entrega el email: revisar ESO antes de
  // culpar a cualquier otro rojo de esta corrida (todos los endpoints dependen de esto).
  chk(_esOwner_() === true, 'D19b _esOwner_ es true en el editor (si es ❌, Session no entrega el email)');
  var tiroS1 = '';
  try { _soloOwner_('__test__'); } catch (e) { tiroS1 = String((e && e.message) || e); }
  chk(tiroS1 === '', 'D19b2 _soloOwner_ deja pasar al owner sin tirar');
  chk(_ctxSistema_() === true && SATORI_CTX_SISTEMA === true, 'D19b3 _ctxSistema_ marca la ejecución como de sistema (triggers/doPost)');
  // ── S1b' (M1a) — el criterio PURO de contexto de sistema (ya no es un bypass a ciegas):
  // trigger (email '') y owner califican; un tercero NO. Se asera puro para no tocar Session.
  chk(_ctxSistemaPermitido_('', 'a@b.com') === true, 'D19b4 sin usuario activo (trigger/doPost) SÍ es contexto de sistema');
  chk(_ctxSistemaPermitido_('a@b.com', 'a@b.com') === true, 'D19b4b el owner corriendo un entry point SÍ es contexto de sistema');
  chk(_ctxSistemaPermitido_('otro@b.com', 'a@b.com') === false, 'D19b4c un usuario REAL no-owner NO obtiene contexto de sistema (M1a: ya no es bypass a ciegas)');

  // ── S1c — COBERTURA: cada endpoint declarado tiene el gate en su cuerpo. Es el assert que
  // impide que un endpoint nuevo entre sin puerta (el scan lo canta, esto lo REPRUEBA).
  var sinGate = ENDPOINTS_UI.filter(function (n) { return _tieneGate_(n) !== 'ok'; });
  chk(sinGate.length === 0, 'D19c los ' + ENDPOINTS_UI.length + ' endpoints client-callable tienen _soloOwner_' +
      (sinGate.length ? ' — SIN GATE: ' + sinGate.join(', ') : ''));

  // ── S2 — vencimiento (función pura, sin tocar properties).
  var T = Date.parse('2026-07-21T12:00:00Z');
  chk(_vencido_('2026-07-20', T) === true, 'D19d una fecha pasada = VENCIDO');
  chk(_vencido_('2026-12-31', T) === false, 'D19d2 una fecha futura NO está vencida');
  chk(_vencido_('', T) === false, 'D19d3 sin fecha = NO expira (decisión explícita del módulo S: compat)');
  chk(_vencido_('cualquier cosa', T) === false, 'D19d4 fecha ilegible NO bloquea (el scan la marca warn)');
  chk(_diasPara_('2026-07-28T12:00:00Z', T) === 7, 'D19d5 _diasPara_ calcula los días que faltan (aviso ≤7d)');
  chk(_diasPara_('', T) === null, 'D19d6 sin fecha, _diasPara_ devuelve null (no 0: 0 sería "vence hoy")');
  chk(_isoMasDias_(90, T).length === 10, 'D19d7 _isoMasDias_ produce una fecha ISO de 10 chars (siembra +90d)');
  // ── S2b (M1b) — secreto de fuente FUERTE (Utilities.getUuid, no Math.random): largo ≥40 y no
  // se repite entre dos generaciones (sanity de aleatoriedad; el CSPRNG lo da el runtime).
  var _sec1 = _nuevoSecreto_(), _sec2 = _nuevoSecreto_();
  chk(_sec1.length >= 40 && /^[0-9a-f]+$/.test(_sec1), 'D19d8 _nuevoSecreto_ da ≥40 chars hex (fuente fuerte, M1b)');
  chk(_sec1 !== _sec2, 'D19d8b dos secretos consecutivos difieren (no es un valor fijo)');

  // ── S3 — matriz de riesgo. Default-deny sobre lo NO listado, y los tres modos.
  chk(gateRiesgo_('tipo_que_nadie_declaro').ok === false &&
      gateRiesgo_('tipo_que_nadie_declaro').modo === 'bloquear', 'D19e default-deny: un tipo no listado se BLOQUEA');
  chk(_riesgoModo_('accion_externa') === 'bloquear', 'D19e2 accion_externa nace bloqueada (siembra conservadora)');
  chk(_riesgoModo_('tocar_secretos') === 'bloquear', 'D19e3 tocar_secretos nace bloqueado');
  chk(gateRiesgo_('escribir_tenant', { con_aprobacion: false }).error === 'requiere_aprobacion',
      'D19e4 escribir_tenant sin aprobación se corta con requiere_aprobacion');
  chk(gateRiesgo_('escribir_tenant', { con_aprobacion: true }).ok === true,
      'D19e5 escribir_tenant CON aprobación pasa (la voz escribe vía crearAprobacion)');
  chk(gateRiesgo_('ejecutar_agente', {}).ok === true, 'D19e6 ejecutar_agente permitido (si no, el CM no despierta agentes)');
  RIESGO_TIPOS.forEach(function (t) {
    chk(RIESGO_MODOS.indexOf(_riesgoModo_(t)) >= 0, 'D19e7 riesgo_' + t + ' resuelve a un modo válido (' + _riesgoModo_(t) + ')');
  });
  // La siembra de Config y el default de código dicen LO MISMO (si divergen, borrar una fila
  // de Config cambiaría la política en silencio).
  var _cfgR = {}; CONFIG_DEFAULTS.forEach(function (p) { if (String(p[0]).indexOf('riesgo_') === 0) _cfgR[String(p[0]).slice(7)] = p[1]; });
  RIESGO_TIPOS.forEach(function (t) {
    chk(_cfgR[t] === RIESGO_SIEMBRA[t], 'D19e8 riesgo_' + t + ': Config y RIESGO_SIEMBRA coinciden');
  });

  // ── S4 — el scan detecta un endpoint sin gate SEMBRADO A PROPÓSITO (prueba de que sirve).
  var scanTrampa = securityScan_({ full: false, endpoints: ['_endpointSinGateD19_'] });
  chk(scanTrampa.estado === 'crit' && scanTrampa.detalle.indexOf('_endpointSinGateD19_') >= 0,
      'D19f el scan DETECTA el endpoint sembrado sin _soloOwner_ y lo reporta como crit');
  var scanFantasma = securityScan_({ full: false, endpoints: ['_no_existe_esta_funcion_'] });
  chk(scanFantasma.hallazgos.some(function (h) { return h.que.indexOf('no verificable') >= 0 || h.que.indexOf('no_existe') >= 0; }),
      'D19f2 un endpoint declarado que NO existe se reporta (nunca pasa como ok)');
  chk(_tieneGate_('_endpointSinGateD19_') === 'sin_gate' && _tieneGate_('datosHoy') === 'ok',
      'D19f3 la introspección distingue gateado de no gateado (si esto falla, el scan miente)');

  // ── S4b — el scan real corre y produce un veredicto usable para el chequeo 7 de Salud.
  var sc = securityScan_({ full: false });
  chk(['ok', 'warn', 'crit'].indexOf(sc.estado) >= 0 && typeof sc.detalle === 'string' && sc.hallazgos.length > 0,
      'D19g securityScan_ devuelve {estado,detalle,hallazgos} (estado=' + sc.estado + ')');
  log.push('   ↳ D19 scan: ' + sc.estado + ' — ' + sc.detalle);

  // ── S4c — Salud lo expone como chequeo 7 (dryRun: no escribe feed ni avisos).
  var sal = correrSalud({ dryRun: true });
  var chSeg = sal.hallazgos.filter(function (h) { return h.nombre === 'seguridad'; })[0];
  chk(!!chSeg, 'D19h correrSalud incluye el chequeo "seguridad" (7º)');
  chk(sal.hallazgos.length >= 7, 'D19h2 Salud pasó de 6 a ' + sal.hallazgos.length + ' chequeos');
  if (chSeg) log.push('   ↳ D19 salud/seguridad: ' + chSeg.estado + ' — ' + chSeg.detalle);
  } finally { SATORI_CTX_SISTEMA = _ctxPrevio; }
}

/**
 * D20 — MÓDULO M · M2 (T3, 21-jul): serie temporal del North Star + tendencia del brief.
 * Todo PURO / read-only: la idempotencia se asera sobre _puntoSerieAccion_ (sin escribir NS_serie),
 * la tendencia sobre _tendencia_ con la forma real de la serie, y _serieNorte_ solo LEE. Tanda aislada.
 */
function _asertsD20_(chk, log, opts) {
  // ── M2a — idempotencia por fecha (decisión pura, no toca el MAESTRO).
  var hoy = hoyISO();
  chk(_puntoSerieAccion_([], hoy).accion === 'agregado', 'D20a serie vacía → agrega el primer punto');
  chk(_puntoSerieAccion_([{ fecha: hoy, _fila: 2 }], hoy).accion === 'actualizado' &&
      _puntoSerieAccion_([{ fecha: hoy, _fila: 2 }], hoy).fila === 2,
      'D20a2 mismo día → ACTUALIZA su fila (no duplica: idempotente por fecha)');
  chk(_puntoSerieAccion_([{ fecha: '2026-07-20', _fila: 2 }], '2026-07-21').accion === 'agregado',
      'D20a3 día nuevo → agrega (la serie crece un punto por día)');

  // ── M2b — la tendencia con la forma REAL de la serie (valor = actual observado).
  var serie2 = [{ fecha: '2026-07-20', valor: 5 }, { fecha: '2026-07-21', valor: 7 }];
  var t2 = _tendencia_(serie2);
  chk(!!t2 && t2.palabra === 'acelerando' && t2.detalle.indexOf('+2') >= 0,
      'D20b con ≥2 puntos, la Tendencia del brief da el delta real (+2, acelerando)');
  chk(_tendencia_([{ fecha: '2026-07-21', valor: 7 }]) === null,
      'D20b2 con 1 punto NO inventa tendencia (null → el brief mantiene el texto honesto, D14e)');

  // ── M2c — _serieNorte_ lee sin romper y devuelve la forma esperada; no toca la definición del NS.
  var s = _serieNorte_();
  chk(Array.isArray(s), 'D20c _serieNorte_ devuelve un array (fail-safe si la hoja no existe)');
  chk(s.every(function (p) { return /^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha)) && typeof p.valor === 'number'; }),
      'D20c2 cada punto es {fecha ISO, valor numérico} (filas sin fecha/número se descartan)');
  chk(MAESTRO_SHEETS.NS_serie.join(',') === 'fecha,metrica,actual,meta', 'D20c3 el schema de NS_serie es [fecha,metrica,actual,meta]');
  log.push('   ↳ D20 serie North Star: ' + s.length + ' punto(s) en NS_serie');
}

/**
 * D21 — MÓDULO M · M3 (T3, 21-jul): memoria caliente/fría del cerebro.
 * TODO sobre las funciones PURAS (`_planCompresion_`, `_fusionarResumen_`, los conversores de
 * tipos): no se escribe una sola celda de ningún tenant. Lo que se asera es el invariante que
 * hace segura la compresión — que NO se pierda ni se invente un evento.
 */
function _asertsD21_(chk, log, opts) {
  var filas = [
    { ts: '2026-01-05T10:00:00', evento: 'nodo_creado', _fila: 2 },
    { ts: '2026-01-20T10:00:00', evento: 'nodo_creado', _fila: 3 },
    { ts: '2026-02-10T10:00:00', evento: 'parte_director', _fila: 4 },
    { ts: '2026-07-20T10:00:00', evento: 'nodo_actualizado', _fila: 5 },   // caliente
    { ts: 'no-es-fecha', evento: 'raro', _fila: 6 }                        // ilegible
  ];
  var p = _planCompresion_(filas, '2026-07-01');

  // (a) el resumen CONSERVA los conteos: la suma de los períodos == las filas archivadas.
  var sumaRes = p.resumenes.reduce(function (a, r) { return a + r.eventos; }, 0);
  chk(p.frias.length === 3 && sumaRes === 3,
      'D21a el resumen conserva el conteo (3 frías = 3 eventos sumados en los resúmenes)');
  chk(p.frias.length + p.calientes === filas.length,
      'D21a2 ningún evento se evapora: frías + calientes == total de entrada');

  // (b) el crudo archivado no se pierde: cada fría lleva su _fila para poder moverla, y el
  //     desglose por tipo del período reproduce los tipos originales.
  chk(p.frias.every(function (f) { return typeof f._fila === 'number'; }),
      'D21b cada fila fría conserva su _fila (se puede archivar y recién después borrar)');
  var ene = p.resumenes.filter(function (r) { return r.periodo === '2026-01'; })[0];
  chk(!!ene && ene.eventos === 2 && ene.tipos === 'nodo_creado:2' && ene.desde === '2026-01-05' && ene.hasta === '2026-01-20',
      'D21b2 el resumen del período trae conteo por tipo + rango real de fechas');
  chk(p.resumenes.length === 2, 'D21b3 un resumen por período YYYY-MM (enero + febrero)');

  // (c) fail-safe: un ts ilegible NUNCA se archiva (se queda caliente). Archivar lo que no se
  //     puede fechar sería mover datos por una lectura rota.
  chk(p.ilegibles === 1 && p.frias.every(function (f) { return f.evento !== 'raro'; }),
      'D21c un evento con ts ilegible queda CALIENTE (no se archiva a ciegas)');

  // (d) idempotencia del corte: correr el plan sobre las calientes no archiva nada más.
  var p2 = _planCompresion_(filas.filter(function (f) { return f._fila >= 5; }), '2026-07-01');
  chk(p2.frias.length === 0, 'D21d segunda pasada sobre lo caliente no archiva nada (idempotente)');

  // (e) fusión de resúmenes: una corrida posterior del MISMO período SUMA, no pisa.
  var fus = _fusionarResumen_({ periodo: '2026-01', eventos: 2, tipos: 'nodo_creado:2', desde: '2026-01-05', hasta: '2026-01-20' },
                              { periodo: '2026-01', eventos: 1, tipos: 'nodo_creado:1', desde: '2026-01-25', hasta: '2026-01-25' });
  chk(fus.eventos === 3 && fus.tipos === 'nodo_creado:3' && fus.desde === '2026-01-05' && fus.hasta === '2026-01-25',
      'D21e re-comprimir el mismo período SUMA conteos y ensancha el rango (no pisa)');
  chk(_fusionarResumen_(null, { periodo: '2026-03', eventos: 4, tipos: 'x:4', desde: '2026-03-01', hasta: '2026-03-09' }).eventos === 4,
      'D21e2 período nuevo (sin previo) entra tal cual');
  chk(_tiposATexto_(_textoATipos_('a:2 · b:1')) === 'a:2 · b:1', 'D21e3 tipos texto↔objeto es ida y vuelta sin pérdida');

  // (f) contrato de los lectores: el corte sale de Config y `materializarEstado` sigue
  //     devolviendo las MISMAS claves (lo que cambia es que `eventos` ya es el total histórico).
  chk(typeof cerebroCorteDias_() === 'number' && cerebroCorteDias_() >= 1,
      'D21f el corte caliente/frío es un entero ≥1 (Config cerebro_corte_dias, default 30)');
  chk(CLIENTE_SHEETS.cerebro_log_archivo.join(',') === CLIENTE_SHEETS.cerebro_log.join(','),
      'D21f2 cerebro_log_archivo tiene EXACTAMENTE el schema de cerebro_log (el crudo entra entero)');
  chk(CLIENTE_SHEETS.cerebro_resumen.join(',') === 'periodo,eventos,tipos,desde,hasta,comprimido_en',
      'D21f3 el schema de cerebro_resumen es [periodo,eventos,tipos,desde,hasta,comprimido_en]');
  chk(CLIENTE_ORDEN.indexOf('cerebro_log_archivo') < 0 && CLIENTE_ORDEN.indexOf('cerebro_resumen') < 0,
      'D21f4 las hojas de archivo NO están en CLIENTE_ORDEN (no abren ventana roja en Salud/selfTest)');
  chk(CEREBRO_SHEETS.indexOf('cerebro_log_archivo') >= 0 && CEREBRO_SHEETS.indexOf('cerebro_resumen') >= 0,
      'D21f5 pero SÍ en CEREBRO_SHEETS (repararCerebro las crea ocultas+protegidas)');
  chk(CLIENTE_SHEETS_SENSIBLES.indexOf('cerebro_log_archivo') >= 0 && CLIENTE_SHEETS_SENSIBLES.indexOf('cerebro_resumen') >= 0,
      'D21f6 y son SENSIBLES (el archivo tiene la misma carga que el log vivo)');
  log.push('   ↳ D21 memoria: corte ' + cerebroCorteDias_() + 'd · plan de prueba ' + p.frias.length + ' frías / ' + p.calientes + ' calientes');
}

/**
 * D22 — MÓDULO M · M4 (T3, 21-jul): PISO DETERMINÍSTICO del golden-set.
 * Corre los casos que NO dependen del modelo (`EVALS_FAMILIAS_DET`). Cero API. Un rojo acá es
 * una regresión de producto: el sistema dejó de decidir lo que decidía, aunque no reviente.
 */
function _asertsD22_(chk, log, opts) {
  var det = EVALS_GOLDEN.filter(function (c) { return EVALS_FAMILIAS_DET.indexOf(c.familia) >= 0; });
  chk(det.length >= 20, 'D22a el golden-set determinístico tiene ≥20 casos (' + det.length + ')');
  EVALS_FAMILIAS_DET.forEach(function (f) {
    chk(det.filter(function (c) { return c.familia === f; }).length > 0, 'D22a2 la familia ' + f + ' tiene casos');
  });
  var ids = {}, dup = [];
  det.forEach(function (c) { if (ids[c.id]) dup.push(c.id); ids[c.id] = true; });
  chk(!dup.length, 'D22a3 no hay ids duplicados en el golden-set' + (dup.length ? ': ' + dup.join(',') : ''));

  var r = correrEvals({});
  chk(r.api === false, 'D22b selfTest corre los evals SIN API (el piso determinístico no gasta)');
  chk(r.total === det.length, 'D22b2 correrEvals() sin conApi corre exactamente los determinísticos (' + r.total + ')');
  chk(r.ok === r.total, 'D22c golden-set determinístico ' + r.ok + '/' + r.total + ' OK' +
      (r.fallos.length ? ' — FALLOS: ' + r.fallos.map(function (x) { return x.id + ' (' + x.detalle + ')'; }).join(' · ') : ''));

  // El comparador tiene que poder decir que NO: un comparador que siempre da verde es peor que ninguno.
  chk(_evalComparar_({ a: 1 }, { a: 2 }).ok === false, 'D22d el comparador detecta una diferencia (no es un sello de goma)');
  chk(_evalComparar_(null, { a: 1 }).ok === false, 'D22d2 esperaba null y vino objeto ⇒ falla');
  chk(_evalComparar_({ a: 1 }, null).ok === false, 'D22d3 esperaba objeto y vino null ⇒ falla');
  chk(_evalComparar_({ a: 1 }, { a: 1, b: 9 }).ok === true, 'D22d4 una clave EXTRA en la salida no rompe el caso (solo se comparan las declaradas)');

  // El validador de estructura del piso LLM también tiene que poder rechazar.
  chk(_evalEstructuraClasificacion_(null).ok === false, 'D22e estructura: sin salida parseable ⇒ rechaza');
  chk(_evalEstructuraClasificacion_({ bin: 'inventado', confianza: 5, slug: '', tags: '', resumen: '', id_cliente: '' }).ok === false,
      'D22e2 estructura: bin fuera del vocabulario ⇒ rechaza');
  chk(_evalEstructuraClasificacion_({ bin: 'tarea', confianza: 99, slug: '', tags: '', resumen: '', id_cliente: '' }).ok === false,
      'D22e3 estructura: confianza fuera de 1-10 ⇒ rechaza');
  chk(_evalEstructuraClasificacion_({ bin: 'tarea', confianza: 8, slug: 's', tags: 't', resumen: 'r', id_cliente: '' }).ok === true,
      'D22e4 estructura: una clasificación bien formada pasa');
  log.push('   ↳ D22 evals: ' + r.ok + '/' + r.total + ' determinísticos OK · familias ' + Object.keys(r.por_familia).join(', '));
}

/**
 * D23 — MÓDULO M · M5 (T3, 21-jul): verificación ≥2 dominios (score ≠ verificado).
 * Puro sobre `_verificacion_`. El punto: 1 fuente JAMÁS puede decir "verificado", y dos fuentes
 * en conflicto SURFACEAN el conflicto en vez de promediarlo.
 */
function _asertsD23_(chk, log, opts) {
  var una = _verificacion_([{ dominio: 'KPIs', valor: 12 }]);
  chk(una.nivel === 'una_fuente' && una.texto.indexOf('NO verificado') >= 0,
      'D23a 1 fuente ≠ verificado (se dice "1 fuente", y se dice que NO está verificado)');

  var dos = _verificacion_([{ dominio: 'KPIs', valor: 12 }, { dominio: 'Datos_operativos', valor: 12 }]);
  chk(dos.nivel === 'verificado' && dos.dominios.length === 2 && dos.texto.indexOf('KPIs + Datos_operativos') >= 0,
      'D23b 2 fuentes coincidentes ⇒ verificado, nombrando los dos dominios');

  var conf = _verificacion_([{ dominio: 'Tareas', valor: 5 }, { dominio: 'Avisos', valor: 3 }]);
  chk(conf.nivel === 'conflicto' && conf.texto.indexOf('CONFLICTO') >= 0 &&
      conf.texto.indexOf('Tareas=5') >= 0 && conf.texto.indexOf('Avisos=3') >= 0,
      'D23c 2 fuentes en conflicto ⇒ CONFLICTO explícito con ambos valores (no se promedia, no se elige)');
  chk(conf.valores.length === 2 && conf.valores.indexOf(5) >= 0 && conf.valores.indexOf(3) >= 0,
      'D23c2 el conflicto expone los dos valores crudos (para poder resolverlo)');

  chk(_verificacion_([]).nivel === 'sin_fuente' && _verificacion_(null).nivel === 'sin_fuente',
      'D23d sin anclas ⇒ sin_fuente (nunca "verificado" por omisión)');
  chk(_verificacion_([{ dominio: 'KPIs', valor: '' }, { dominio: 'X', valor: null }]).nivel === 'sin_fuente',
      'D23d2 un ancla con valor vacío/null NO cuenta como fuente');

  // Dos lecturas de la MISMA hoja no son dos dominios: si lo fueran, cualquier dato quedaría
  // "verificado" leyéndolo dos veces — exactamente el auto-engaño que M5 viene a cerrar.
  var mismo = _verificacion_([{ dominio: 'KPIs', valor: 12 }, { dominio: 'KPIs', valor: 12 }]);
  chk(mismo.nivel === 'una_fuente', 'D23e dos anclas del MISMO dominio siguen siendo 1 fuente');

  // Comparación tolerante al tipo de celda (8 vs '8' no es un conflicto real).
  chk(_verificacion_([{ dominio: 'A', valor: 8 }, { dominio: 'B', valor: '8' }]).nivel === 'verificado',
      'D23f 8 y "8" coinciden (Sheets devuelve number o string según la celda; eso no es conflicto)');

  // Cableado: la recomendación del día lleva anclas y el renderizador contractual las muestra.
  var render = _recContractual_({ texto: 't', kpi: 'salud', dato: 'd', anclas: [{ dominio: 'Salud', valor: 'crit' }, { dominio: 'Avisos', valor: 'crit' }] });
  chk(render.join('\n').indexOf('Verificación: verificado') >= 0,
      'D23g el brief RENDERIZA la verificación en la recomendación (no queda en el modelo de datos)');
  var renderSin = _recContractual_({ texto: 't', kpi: 'salud', dato: 'd' });
  chk(renderSin.join('\n').indexOf('Verificación: sin fuente') >= 0,
      'D23g2 una rec sin anclas dice "sin fuente" — la ausencia se declara, no se calla');
  chk(VERIF_NIVELES.join(',') === 'sin_fuente,una_fuente,verificado,conflicto', 'D23h los 4 niveles del vocabulario están declarados');
  log.push('   ↳ D23 verificación: niveles ' + VERIF_NIVELES.join('/'));
}

/**
 * D24 — MÓDULO H (T3, 21-jul): SOUL (H1) · panel de Salud humano (H2) · cerebroNodo (H3).
 * Todo puro / read-only. El espejo de SOUL en `voz/agent/agent.py` no es verificable desde GAS
 * (otro proceso, otra máquina): eso lo cubre el harness offline, que compara los dos archivos.
 */
function _asertsD24_(chk, log, opts) {
  // ── H1 · SOUL
  chk(SOUL_REGLAS.length === 8, 'D24a SOUL tiene las 8 invariantes (' + SOUL_REGLAS.length + ')');
  var ids = SOUL_REGLAS.map(function (r) { return r.id; });
  chk(ids.join(',') === 'S1,S2,S3,S4,S5,S6,S7,S8', 'D24a2 los ids son S1..S8 y en orden (son citables en una purga)');
  chk(SOUL_REGLAS.every(function (r) { return r.regla && r.regla.length > 20 && r.porque && r.porque.length > 20; }),
      'D24a3 cada invariante tiene regla Y porqué (una regla sin porqué se afloja sola)');
  var p678 = soulPrompt_(['S1', 'S6']);
  chk(p678.indexOf('[S1]') >= 0 && p678.indexOf('[S6]') >= 0 && p678.indexOf('[S5]') < 0,
      'D24a4 soulPrompt_ filtra: mete las pedidas y NO las demás');
  chk(soulPrompt_().indexOf('[S5]') >= 0, 'D24a5 sin filtro van las 8');
  // El clasificador REFERENCIA SOUL en vez de re-escribirlo. Si alguien lo desengancha, esto se cae.
  var pc = promptClasificador_('texto de prueba', []);
  chk(pc.indexOf('INVARIANTES DE SATORI OS') >= 0 && pc.indexOf('[S1]') >= 0 && pc.indexOf('[S7]') >= 0,
      'D24a6 el clasificador de Bandeja arranca con las invariantes de SOUL');
  chk(pc.indexOf('[S5]') < 0, 'D24a7 …pero NO con S5 (confirmación verbal): el clasificador no habla con nadie');

  // ── H2 · capa humana de Salud. Los 7 chequeos tienen que estar TODOS cubiertos: un chequeo sin
  //    "qué hacer" es el que te va a agarrar justo el día que se ponga rojo.
  var CHEQUEOS = ['schema', 'sync', 'cola', 'presupuesto', 'aprobaciones', 'cerebro', 'seguridad'];
  chk(Object.keys(SALUD_HUMANO).length === 7, 'D24b SALUD_HUMANO cubre los 7 chequeos');
  CHEQUEOS.forEach(function (n) {
    var m = SALUD_HUMANO[n];
    chk(!!m && !!m.titulo && !!m.warn && !!m.crit, 'D24b2 ' + n + ': título + qué hacer en warn Y en crit');
    chk(!!m && m.titulo !== n, 'D24b3 ' + n + ': el título es humano, no el nombre técnico');
  });
  chk(saludAccion_('cola', 'ok') === '', 'D24b4 un chequeo en verde no propone acción (no hay nada que hacer)');
  chk(saludAccion_('cola', 'crit').indexOf('Cola_tareas') >= 0, 'D24b5 el "qué hacer" es concreto (nombra la hoja a mirar)');
  // Un chequeo NUEVO sin texto cargado tiene que DECIRLO, no devolver vacío: un hueco silencioso se
  // lee como "todo bien", que es exactamente lo contrario.
  chk(saludAccion_('chequeo_inexistente', 'crit').indexOf('Sin guía cargada') >= 0,
      'D24b6 chequeo sin guía cargada lo declara (no devuelve vacío)');
  var sal = estadoSalud();
  chk((sal.hallazgos || []).length > 0 && sal.hallazgos.every(function (h) { return !!h.titulo; }),
      'D24b7 estadoSalud() entrega los hallazgos YA con la capa humana (la UI solo pinta)');
  chk(sal.hallazgos.every(function (h) { return h.estado === 'ok' ? h.accion === '' : !!h.accion; }),
      'D24b8 todo hallazgo no-ok trae su acción; todo hallazgo ok viene sin acción');

  // ── H3 · cerebroNodo. Las guardas de entrada cortan ANTES de tocar ningún Sheet, así que son
  //    aserible sin abrir un tenant. El gate de identidad lo cubre D19 (cobertura de ENDPOINTS_UI).
  chk(ENDPOINTS_UI.indexOf('cerebroNodo') >= 0, 'D24c cerebroNodo está dado de alta en ENDPOINTS_UI (regla anti-drift)');
  chk(cerebroNodo('CLI-000', '').sin_nodo === true, 'D24c2 sin id de nodo ⇒ {sin_nodo:true} (fail-closed, no objeto vacío)');
  chk(cerebroNodo('__NO_EXISTE__', 'NOD-0001').sin_nodo === true, 'D24c3 tenant inexistente ⇒ {sin_nodo:true}, sin reventar');
  chk(typeof CEREBRO_NODO_EVENTOS === 'number' && CEREBRO_NODO_EVENTOS > 0 && CEREBRO_NODO_EVENTOS <= 20,
      'D24c4 el detalle trae un tope acotado de eventos (no vuelca el log entero al cliente)');

  // ── H4 · el mapa neural nace OFF y su flag está en la whitelist de prefs (no es config sensible).
  chk(PREFS_UI_OK.indexOf('cerebro_map') >= 0, 'D24d cerebro_map está en la whitelist de prefs de UI');
  chk(prefsUI().cerebro_map === 'off' || prefsUI().cerebro_map === 'on', 'D24d2 prefsUI expone cerebro_map con valor legible');
  var defMapa = CONFIG_DEFAULTS.filter(function (f) { return f[0] === 'cerebro_map'; })[0];
  chk(!!defMapa && defMapa[1] === 'off', 'D24d3 el default de código de cerebro_map es OFF (lo riesgoso nace apagado)');
  log.push('   ↳ D24 módulo H: SOUL ' + SOUL_REGLAS.length + ' invariantes · Salud ' + sal.hallazgos.length +
           ' chequeos humanizados · mapa neural ' + prefsUI().cerebro_map);
}

/**
 * D25 — TC-W3 (21-jul): conectores generalizados. TODO con fixtures: no se abre ni un Sheet real,
 * no se lee el SGIC de ningún cliente. Lo que se asera es el mapa (Config → decisión), el adapter
 * (esquema → contrato) y las tres guardas de Bastión.
 */
function _asertsD25_(chk, log, opts) {
  // ── Mapa por Config. Fixture con un conector completo, uno a medias y ruido que NO es de conectores.
  var cfg = [
    { clave: 'conector_CLI-007_db', valor: '1abcDEF' },
    { clave: 'conector_CLI-007_tipo', valor: 'ventas_sgic' },
    { clave: 'conector_CLI-007_on', valor: 'true' },
    { clave: 'conector_CLI-008_db', valor: '1zzz' },        // sin tipo
    { clave: 'conector_CLI-009_tipo', valor: 'ventas_sgic' }, // sin db, sin on
    { clave: 'voz_url', valor: 'http://x' },                  // ruido: no es conector
    { clave: 'riesgo_leer_tenant', valor: 'permitir' }
  ];
  var m = _mapaConectores_(cfg);
  chk(Object.keys(m).sort().join(',') === 'CLI-007,CLI-008,CLI-009', 'D25a el mapa toma SOLO las claves conector_* (ignora el resto de Config)');
  chk(m['CLI-007'].db === '1abcDEF' && m['CLI-007'].tipo === 'ventas_sgic' && m['CLI-007'].on === true,
      'D25a2 un conector completo se lee entero (db + tipo + on)');
  chk(m['CLI-009'].on === false, 'D25a3 sin fila `_on` ⇒ APAGADO (default-deny: la ausencia no enciende nada)');
  // El id de cliente lleva guión: el parseo tiene que cortar por el ÚLTIMO '_', no por el primero.
  chk(m['CLI-007'].tipo === 'ventas_sgic', 'D25a4 el id con guión no rompe el parseo de la clave');

  // ── Decisión de corrida: por qué NO corre es tan importante como que no corra.
  chk(_decidirConector_('CLI-007', m['CLI-007']).correr === true, 'D25b conector completo y encendido ⇒ corre');
  chk(_decidirConector_('CLI-008', m['CLI-008']).correr === false &&
      _decidirConector_('CLI-008', m['CLI-008']).motivo.indexOf('tipo') >= 0, 'D25b2 sin adapter ⇒ no corre, y dice por qué');
  chk(_decidirConector_('CLI-009', m['CLI-009']).correr === false, 'D25b3 sin db ⇒ no corre');
  chk(_decidirConector_('CLI-010', null).correr === false, 'D25b4 cliente sin configuración ⇒ no corre');
  var off = { db: '1x', tipo: 'ventas_sgic', on: false };
  chk(_decidirConector_('CLI-011', off).correr === false && _decidirConector_('CLI-011', off).motivo.indexOf('apagado') >= 0,
      'D25c CONECTOR APAGADO NO CORRE (la regla dura de la cadena: nace OFF)');
  chk(_decidirConector_('CLI-012', { db: '1x', tipo: 'inventado', on: true }).correr === false,
      'D25c2 adapter desconocido ⇒ no corre (no se improvisa un mapeo)');

  // ── Adapter: esquema del cliente → contrato de Datos_operativos.
  var crudas = [
    { Fecha: '2026-06-01', Detalle: 'Venta mostrador', Importe: 15000, _fila: 2 },
    { Fecha: '2026-06-02', Detalle: 'Venta online', Importe: 8500, _fila: 3 },
    { Fecha: 'sin fecha', Detalle: 'rota', Importe: 100, _fila: 4 },      // descarte: fecha ilegible
    { Fecha: '2026-06-03', Detalle: 'sin importe', Importe: 'ocho mil', _fila: 5 }  // descarte: no numérico
  ];
  var r = mapearOperacionesGenerico_(crudas);
  chk(r.filas.length === 2 && r.descartadas === 2, 'D25d el adapter mapea 2 filas válidas y DESCARTA 2 (no las mete con valor 0)');
  chk(r.filas[0].fecha === '2026-06-01' && r.filas[0].valor === 15000 && r.filas[0].concepto === 'Venta mostrador',
      'D25d2 el mapeo respeta el contrato {fecha, concepto, valor}');
  chk(r.columnas.fecha === 'Fecha' && r.columnas.valor === 'Importe' && r.columnas.concepto === 'Detalle',
      'D25d3 resuelve los nombres de columna por alias (cada SGIC llama distinto a lo mismo)');
  chk(mapearOperacionesGenerico_([{ Cosa: 'x', Otra: 1 }]).filas.length === 0,
      'D25d4 hoja sin fecha ni importe ⇒ 0 filas (no se inventa un mapeo)');
  chk(mapearOperacionesGenerico_([]).filas.length === 0, 'D25d5 hoja vacía no revienta');

  // ── Bastión.
  var hostil = mapearOperacionesGenerico_([{ fecha: '2026-06-01', concepto: '=IMPORTRANGE("hoja","A1")', valor: 10, _fila: 2 }]);
  chk(hostil.filas.length === 1 && String(hostil.filas[0].concepto).charAt(0) !== '=',
      'D25e celda HOSTIL del SGIC sanitizada (una fórmula del cliente no se ejecuta en nuestra hoja)');
  Object.keys(CONECTOR_ADAPTERS).forEach(function (t) {
    var ad = CONECTOR_ADAPTERS[t];
    chk(ad.hojas && ad.hojas.length > 0, 'D25e2 el adapter ' + t + ' declara su allowlist de hojas');
    chk(ad.hojas.every(function (h) { return ['Config', 'Usuarios', 'Clientes', 'Secretos'].indexOf(h) < 0; }),
        'D25e3 la allowlist de ' + t + ' no incluye hojas de config/PII');
    chk(ad.modo === 'ventas' || typeof ad.mapear === 'function', 'D25e4 el adapter ' + t + ' tiene modo válido');
  });
  chk(typeof CONECTOR_AVISO_FILAS === 'number' && CONECTOR_AVISO_FILAS > 0, 'D25e5 hay cap/aviso de filas configurado');

  // ── El alta NUNCA enciende. Se asera sobre la fuente, no corriendo altaConector (escribiría Config).
  var srcAlta = String(altaConector);
  chk(/_on', 'false'/.test(srcAlta), 'D25f altaConector deja el conector en false (encender es un acto aparte)');
  chk(srcAlta.indexOf('probarConector') >= 0, 'D25f2 el alta te manda a validar al peso antes de encender');
  chk(String(probarConector).indexOf('SE_ESCRIBIO_ALGO') >= 0, 'D25f3 probarConector es ensayo EN SECO (declara que no escribió)');

  // ── Mapeo cliente↔SGIC de la siembra A3. FIJADO tras la purga integral (23-jul): la versión
  //    original cruzaba los id_cliente (DAM apuntaba a la DB de MesaQuince, y CLI-005 —que no tiene
  //    SGIC— a la de DAM). Nacían apagados, así que no se escribió nada; pero un `encenderConector`
  //    sin mirar habría metido las finanzas de un cliente en el Sheet de otro. Este assert vuelve el
  //    mapeo un CONTRATO: reordenarlo o agregar un cliente equivocado ahora pone rojo el selfTest.
  var ESPERADO_A3 = { 'CLI-001': 'movimientos_mesaquince', 'CLI-003': 'libro_lctravel', 'CLI-004': 'fresha_dam' };
  var vistos = {};
  CONECTORES_HALLADOS_A3.forEach(function (c) { vistos[c.cliente] = c.tipo; });
  chk(Object.keys(vistos).sort().join(',') === 'CLI-001,CLI-003,CLI-004',
      'D25g la siembra A3 cubre exactamente CLI-001, CLI-003 y CLI-004 (fue: ' + Object.keys(vistos).sort().join(',') + ')');
  Object.keys(ESPERADO_A3).forEach(function (cli) {
    chk(vistos[cli] === ESPERADO_A3[cli],
        'D25g2 ' + cli + ' → adapter ' + ESPERADO_A3[cli] + ' (roster real del MAESTRO; fue: ' + (vistos[cli] || 'ausente') + ')');
  });
  // CLI-005 (SIP) NO tiene SGIC: si aparece en la siembra, alguien le inventó uno.
  chk(!vistos['CLI-005'], 'D25g3 CLI-005 (SIP) NO se siembra — no tiene SGIC que conectar');
  // CLI-002 (Vehemence) corre por código, no por el mapa: sembrarlo lo duplicaría.
  chk(!vistos['CLI-002'], 'D25g4 CLI-002 (Vehemence) no se siembra — corre por código y se duplicaría');
  // Cada DB tiene que ser única: dos clientes con el mismo spreadsheetId es el bug que se acaba de arreglar.
  var dbs = CONECTORES_HALLADOS_A3.map(function (c) { return c.db; });
  chk(dbs.length === dbs.filter(function (d, i) { return dbs.indexOf(d) === i; }).length,
      'D25g5 ningún spreadsheetId se repite entre clientes (dos tenants leyendo la misma DB = datos cruzados)');
  CONECTORES_HALLADOS_A3.forEach(function (c) {
    chk(!!CONECTOR_ADAPTERS[c.tipo], 'D25g6 el adapter sembrado para ' + c.cliente + ' existe: ' + c.tipo);
  });

  log.push('   ↳ D25 conectores: ' + Object.keys(CONECTOR_ADAPTERS).length + ' adapter(s) · mapa fixture ' +
           Object.keys(m).length + ' cliente(s), 1 corre · siembra A3 ' +
           CONECTORES_HALLADOS_A3.map(function (c) { return c.cliente + '→' + c.tipo; }).join(', '));
}

/**
 * D26 — TC-W1/W2/W4 (21-jul): Hilo end-to-end. Puro sobre `_armarHilo_`/`_semaforoHilo_` + las
 * guardas de `hiloCliente`. No se toca la hoja `hilo` de ningún cliente.
 */
function _asertsD26_(chk, log, opts) {
  // ── W1 · contrato y vocabulario CERRADO.
  chk(CLIENTE_SHEETS.hilo.join(',') === 'seccion,item,detalle,estado,evidencia,fecha,prioridad,dueno',
      'D26a el schema de `hilo` es el del contrato');
  chk(HILO_SECCIONES.join(',') === 'plan,real,desviado,pendiente', 'D26a2 las 4 secciones y en orden');
  chk(CLIENTE_ORDEN.indexOf('hilo') < 0, 'D26a3 `hilo` NO está en CLIENTE_ORDEN (un cliente sin Hilo es estado legítimo)');
  chk(CLIENTE_SHEETS_SENSIBLES.indexOf('hilo') >= 0, 'D26a4 `hilo` es hoja sensible (oculta+protegida)');
  chk(ENDPOINTS_UI.indexOf('hiloCliente') >= 0, 'D26a5 hiloCliente dado de alta en ENDPOINTS_UI (regla anti-drift)');

  // ── Parser de filas: lo que llega del espejo es texto PROPUESTO, no dato aceptado (SOUL S6).
  var filas = [
    { seccion: 'plan', item: 'Migrar catálogo', detalle: '1200 SKUs', estado: 'en curso', fecha: '2026-08-01', prioridad: 'A', dueno: 'Luciano', _fila: 2 },
    { seccion: 'Real', item: 'Migrado parcial', detalle: '400', fecha: '2026-07-18', _fila: 3 },
    { seccion: 'desviado', item: 'Atraso', detalle: '400/1200', prioridad: 'A', _fila: 4 },
    { seccion: 'pendiente', item: 'Accesos ERP', dueno: 'Cliente', fecha: '2026-07-22', prioridad: 'A', _fila: 5 },
    { seccion: 'inventada', item: 'no debería entrar', _fila: 6 },
    { seccion: 'plan', item: '', detalle: 'fila sin ítem', _fila: 7 }
  ];
  var h = _armarHilo_(filas);
  chk(h.total === 4 && h.descartadas === 2, 'D26b 4 filas válidas · 2 descartadas (sección inventada + fila sin ítem)');
  chk(h.conteos.real === 1, 'D26b2 "Real" con mayúscula normaliza a `real` (el .md lo escribe un humano)');
  chk(h.secciones.plan[0].item === 'Migrar catálogo' && h.secciones.pendiente[0].dueno === 'Cliente',
      'D26b3 los campos llegan al lugar correcto');

  // ── Semáforo: el criterio es de producto y tiene que poder decir "no sé".
  chk(_semaforoHilo_({ plan: 0, real: 0, desviado: 0, pendiente: 0 }) === 'gris',
      'D26c Hilo vacío ⇒ GRIS, nunca verde (vacío ≠ todo bien)');
  chk(_semaforoHilo_({ plan: 3, real: 2, desviado: 1, pendiente: 0 }) === 'rojo', 'D26c2 con desvíos ⇒ rojo');
  chk(_semaforoHilo_({ plan: 3, real: 2, desviado: 0, pendiente: 2 }) === 'ambar', 'D26c3 sin desvíos y con pendientes ⇒ ámbar');
  chk(_semaforoHilo_({ plan: 3, real: 2, desviado: 0, pendiente: 0 }) === 'verde', 'D26c4 plan corriendo, sin deuda ⇒ verde');
  chk(_semaforoHilo_({ plan: 3, real: 0, desviado: 0, pendiente: 0 }) === 'gris',
      'D26c5 plan cargado pero SIN real todavía ⇒ gris (no hay evidencia de que corra)');

  // ── W1 · fail-closed. Estas guardas cortan antes de abrir nada.
  chk(hiloCliente('').sin_hilo === true, 'D26d sin id ⇒ {sin_hilo:true} (fail-closed)');
  var r = hiloCliente('__NO_EXISTE__');
  chk(r.sin_hilo === true && !!r.motivo, 'D26d2 cliente inexistente ⇒ sin_hilo CON motivo (nunca un Hilo vacío que parezca cargado)');

  // ── CSV del espejo (lo que produce _hilo_sync.sh).
  chk(_parseCSVLinea_('plan,Migrar,"1.200, con comas",en curso').length === 4,
      'D26e el parser CSV respeta comas dentro de comillas');
  chk(_parseCSVLinea_('a,"di""jo",c')[1] === 'di"jo', 'D26e2 comilla escapada ("") se desescapa');

  // ── W2 · ABSORCIÓN: una sola fuente de render. Si aparece una segunda, esto se cae.
  chk(typeof HILO_TITULOS === 'object' && Object.keys(HILO_TITULOS).length === 4,
      'D26f los títulos de sección viven UNA vez en el backend (no duplicados en cada render)');

  // ── W4 · lazo con Dirección.
  chk(typeof _seccionHilo_ === 'function' && _seccionHilo_('__NO_EXISTE__').length === 0,
      'D26g sin Hilo, la sección del brief queda vacía y el contrato emite su fallback honesto');
  chk(_recDesdeHilo_('__NO_EXISTE__') === null, 'D26g2 sin Hilo no hay candidata de recomendación (no se inventa una)');
  chk(!!CONTRAPESO_POR_KPI.hilo, 'D26g3 la nueva clase de rec `hilo` tiene su contrapeso (el contrato lo exige)');
  chk(String(_recCandidatas_.toString()).indexOf('_clienteConHiloCaliente_') >= 0,
      'D26g4 el Hilo está enganchado como candidata de la rec del día');

  log.push('   ↳ D26 Hilo: 4 secciones · semáforo ' + _semaforoHilo_(h.conteos) + ' en el fixture · fail-closed OK');
}

/** Cebo de D19f: endpoint DELIBERADAMENTE sin _soloOwner_. No hace nada y nadie lo llama:
 *  existe para probar que el security-scan detecta una puerta abierta. NO agregarle el gate. */
function _endpointSinGateD19_() { return { cebo: true }; }

function _asertsD17h_(chk, log, opts) {
  var CLAVES = ['agentes', 'hoy', 'salud', 'recs', 'agenda', 'clientes'];

  // (a) camino feliz: las 6 claves presentes.
  var ok = bootUnico();
  chk(!!ok && typeof ok === 'object', 'D17h-a bootUnico() devuelve un objeto');
  CLAVES.forEach(function (k) {
    chk(ok.hasOwnProperty(k), 'D17h-a bootUnico trae la clave ' + k);
  });

  // (b) fail-closed por sección: si datosHoy revienta, hoy=null y las otras 5 sobreviven.
  //     Se pisa la global datosHoy con una que tira y se restaura pase lo que pase.
  var real = datosHoy;
  try {
    datosHoy = function () { throw new Error('D17h fallo simulado'); };
    var deg = bootUnico();
    chk(deg.hoy === null, 'D17h-b la sección que falla viaja null');
    var vivas = CLAVES.filter(function (k) { return k !== 'hoy'; })
                      .filter(function (k) { return deg[k] !== null; });
    chk(vivas.length === 5, 'D17h-b las otras 5 secciones viven pese al fallo (vivas: ' + vivas.length + ')');
  } finally {
    datosHoy = real;   // sin esto, todo test posterior que use datosHoy quedaría envenenado
  }

  // (c) el rango mal formado cae al lunes→domingo del script (no rompe, no viaja el basura).
  var r1 = _bootRangoSemana_('no-es-fecha', 'tampoco');
  chk(/^\d{4}-\d{2}-\d{2}$/.test(r1.desde) && /^\d{4}-\d{2}-\d{2}$/.test(r1.hasta),
      'D17h-c rango inválido → fallback lunes→domingo válido');
  var r2 = _bootRangoSemana_('2026-07-13', '2026-07-19');
  chk(r2.desde === '2026-07-13' && r2.hasta === '2026-07-19', 'D17h-c rango válido del cliente se respeta');
}

/** D17i — E3.7: bootUniverso()/bootResto() (las 2 olas paralelas) devuelven sus
 *  claves con fail-closed POR SECCIÓN, igual que bootUnico (D17h). No tocan datos:
 *  fuerzan el fallo pisando una global y la restauran en finally. Tanda aislada. */
function _asertsD17i_(chk, log, opts) {
  // (a) bootUniverso: agentes + clientes.
  var u = bootUniverso();
  chk(!!u && u.hasOwnProperty('agentes') && u.hasOwnProperty('clientes'),
      'D17i-a bootUniverso trae agentes y clientes');

  // (b) bootResto: hoy + recs + agenda + salud.
  var r = bootResto('2026-07-13', '2026-07-19');
  ['hoy', 'recs', 'agenda', 'salud'].forEach(function (k) {
    chk(r.hasOwnProperty(k), 'D17i-b bootResto trae ' + k);
  });

  // (c) fail-closed por sección en bootUniverso: si estadoAgentes revienta,
  //     agentes=null pero clientes vive.
  var realEA = estadoAgentes;
  try {
    estadoAgentes = function () { throw new Error('D17i fallo simulado'); };
    var ud = bootUniverso();
    chk(ud.agentes === null, 'D17i-c bootUniverso: la sección que falla viaja null');
    chk(ud.clientes !== null, 'D17i-c bootUniverso: la otra sección vive');
  } finally {
    estadoAgentes = realEA;
  }

  // (d) fail-closed por sección en bootResto: si estadoSalud revienta,
  //     salud=null pero hoy/recs/agenda viven.
  var realES = estadoSalud;
  try {
    estadoSalud = function () { throw new Error('D17i fallo simulado'); };
    var rd = bootResto('2026-07-13', '2026-07-19');
    chk(rd.salud === null, 'D17i-d bootResto: salud que falla viaja null');
    var vivas = ['hoy', 'recs', 'agenda'].filter(function (k) { return rd[k] !== null; });
    chk(vivas.length === 3, 'D17i-d bootResto: las otras 3 secciones viven (vivas: ' + vivas.length + ')');
  } finally {
    estadoSalud = realES;
  }
}

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
