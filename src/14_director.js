/**
 * 14_director.js — Director (orquestación) (ETAPA 8a · módulo a2).
 *
 * correrDirector(): por cada tenant activo materializa su cerebro (estado + índice),
 * lee sus objetivos y ENCOLA la capa dirigida por objetivos (un Analista por objetivo
 * con métrica). NO corre los agentes ni duplica la Vigía base (esa la encola
 * corridaDiaria); solo decide + encola + escribe un "parte" al cerebro. **0 API**: el
 * costo lo hacen los agentes al drenarse, con sus propios gates (crearAprobacion) y cupos.
 *
 * Cadencia (plano): 1×/día dentro de corridaDiaria() (07:00) — pase completo. Chequeo
 * liviano cada 30 min OPCIONAL (chequeoLivianoDirector): NO se auto-instala por la cuota
 * multi-tenant (supuesto 2 del plano); se prende a mano con instalarTriggerDirector().
 *
 * Decisión v1 (conservadora; el HANDOFF ETAPA 8 §7 la refina cuando haya objetivos/datos):
 *  - por cada objetivo activo CON métrica → encolar Analista (args.pregunta = el objetivo).
 *  - agentes con gate (Cobrador/Abastecedor) NO se disparan en blanco: esperan señal.
 */

/**
 * Corre el Director sobre un tenant, o sobre todos los activos si tenant es null.
 * @param {string} [tenant] id_cliente; si falta, recorre clientes activos/activo-piloto.
 * @return {{tenants:number, encolados:number, partes:Array}}
 */
function correrDirector(tenant) {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
    if (tenant) return c.id_cliente === tenant;
    return ['activo', 'activo-piloto'].indexOf(String(c.estado).toLowerCase()) >= 0;
  });

  var totalEncolados = 0, partes = [];
  clientes.forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    try {
      var ssCli = abrirCliente(c.id_cliente).ss; // PURGA #1: cache de handle (lo reusa materializarEstado)
      if (!ssCli.getSheetByName('estado_actual')) { // cerebro no inicializado en este tenant
        partes.push({ tenant: c.id_cliente, omitido: 'sin cerebro (corré repararCerebro)' });
        return;
      }

      var objetivos = leerTabla(ssCli.getSheetByName('objetivos')).filter(function (o) {
        return ['activo', 'en_curso', 'abierto'].indexOf(String(o.estado).toLowerCase()) >= 0;
      });
      poblarCerebro_(c.id_cliente, objetivos); // MUST #2: pobla el grafo SISTEMA(agentes)+NEGOCIO(objetivos/métricas)
      materializarEstado(c.id_cliente); // refresca estado_actual + Cerebro_index (ya con los nodos poblados)

      var encolados = 0;
      objetivos.forEach(function (o) {
        if (!o.metrica) return; // solo objetivos medibles disparan análisis dirigido
        encolarAgente(c.id_cliente, 'analista', { pregunta: String(o.descripcion || o.metrica).slice(0, 300) });
        encolados++;
      });
      totalEncolados += encolados;

      // Parte del Director al cerebro (append-only).
      logEvento(c.id_cliente, {
        evento: 'parte_director', origen: 'director',
        detalle: { objetivos_activos: objetivos.length, analistas_encolados: encolados }
      });
      // E8a4: surfacear la directiva al feed del MAESTRO (Actividad) para que el Command
      // Center la muestre sin abrir el Sheet del cliente.
      try {
        feed_('Director', 'info', c.id_cliente, 'Directiva: ' +
          (encolados ? (encolados + ' análisis dirigido(s) por objetivo') : 'sin objetivos medibles — monitoreo base') + '.', '', '');
      } catch (e) {}
      partes.push({ tenant: c.id_cliente, objetivos_activos: objetivos.length, encolados: encolados });
    } catch (e) {
      partes.push({ tenant: c.id_cliente, error: e.message });
      try { feed_('Director', 'info', c.id_cliente, 'Director no pudo procesar: ' + e.message, '', ''); } catch (x) {}
    }
  });

  Logger.log('correrDirector: ' + JSON.stringify({ tenants: clientes.length, encolados: totalEncolados }));
  return { tenants: clientes.length, encolados: totalEncolados, partes: partes };
}

/**
 * MUST #2 — Pobla el cerebro del tenant con el grafo vivo (doc canónico CEREBRO §4):
 *   SISTEMA  = el Director + los agentes (auto-conocimiento del OS).
 *   NEGOCIO  = cada objetivo + su métrica (lo que el negocio persigue).
 * Aristas: director orquesta agente · analista responsable_de objetivo · objetivo debe métrica.
 * Cobertura (0-100): rica si el objetivo es medible; baja (<40) = punto ciego → ROJO en el orbe.
 * Idempotente (upsert por id estable) y pasa `dimension` explícito (no dispara la deuda del upsert).
 * @param {string} idCliente
 * @param {Array} objetivos  objetivos activos del tenant
 */
function poblarCerebro_(idCliente, objetivos) {
  var AGENTES = ['vigia', 'analista', 'conciliador', 'cobrador', 'abastecedor'];
  var sanitId_ = function (s) { return 'X' + String(s).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 22); };
  // PURGA B5 #1: snapshot de nodos/aristas UNA sola vez por corrida (upsert lo reusa en vez de releer
  // la tabla completa por cada nodo/arista → rompe el O(n²) del poblado del cerebro).
  var snapN = leerTabla(cerebroSheet_(idCliente, 'nodos'));
  var snapA = leerTabla(cerebroSheet_(idCliente, 'aristas'));
  // SISTEMA: Director + agentes
  upsertNodo(idCliente, { id_nodo: 'NOD-SIS-director', dimension: 'sistema', tipo: 'agente', etiqueta: 'Director', relevancia: 5, cobertura: 85, fuente: 'director' }, snapN);
  AGENTES.forEach(function (a) {
    upsertNodo(idCliente, { id_nodo: 'NOD-SIS-' + a, dimension: 'sistema', tipo: 'agente', etiqueta: a, relevancia: 3, cobertura: 70, fuente: 'director' }, snapN);
    upsertArista(idCliente, { id_arista: 'ARI-orq-' + a, origen: 'NOD-SIS-director', destino: 'NOD-SIS-' + a, relacion: 'orquesta', actor: 'director' }, snapA);
  });
  // NEGOCIO: objetivos + métricas
  (objetivos || []).forEach(function (o) {
    var oid = 'NOD-OBJ-' + sanitId_(o.id_objetivo || o.metrica || o.descripcion || 'obj');
    var medible = !!o.metrica;
    upsertNodo(idCliente, {
      id_nodo: oid, dimension: 'negocio', tipo: 'objetivo',
      etiqueta: String(o.descripcion || o.metrica || 'objetivo').slice(0, 40),
      relevancia: (String(o.prioridad).toUpperCase() === 'A' ? 5 : 3),
      cobertura: (medible ? 60 : 20), fuente: 'director' // sin métrica → punto ciego (rojo)
    }, snapN);
    upsertArista(idCliente, { id_arista: 'ARI-resp-' + oid, origen: 'NOD-SIS-analista', destino: oid, relacion: 'responsable_de', actor: 'director' }, snapA);
    if (medible) {
      var mid = 'NOD-MET-' + sanitId_(o.metrica);
      upsertNodo(idCliente, { id_nodo: mid, dimension: 'negocio', tipo: 'metrica', etiqueta: String(o.metrica).slice(0, 40), relevancia: 3, cobertura: 50, fuente: 'director' }, snapN);
      upsertArista(idCliente, { id_arista: 'ARI-mide-' + oid, origen: oid, destino: mid, relacion: 'debe', actor: 'director' }, snapA);
    }
  });
}

/**
 * Chequeo liviano (cada 30 min, opcional): NO materializa ni corre el pase completo.
 * Solo mira pendientes de aprobación y cola en curso y los devuelve (la UI los muestra).
 * 0 API, lectura barata del MAESTRO. Trigger opcional vía instalarTriggerDirector().
 */
function chequeoLivianoDirector() {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  if (_sistemaPausado_()) return { pausado: true };
  var pend = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas')).length;
  var cola = leerTabla(getMaestro().getSheetByName('Cola_tareas')).filter(function (f) {
    return ['pendiente', 'tomada'].indexOf(String(f.estado)) >= 0;
  }).length;
  var r = { aprobaciones_pendientes: pend, cola_en_curso: cola, ts: ahoraISO() };
  setConfig('ultimo_chequeo_director', r.ts);
  return r;
}

/**
 * Instala (idempotente) el trigger del chequeo liviano cada 30 min. OPCIONAL: medir
 * la cuota multi-tenant antes de prenderlo en producción (supuesto 2 del plano).
 */
function instalarTriggerDirector() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'chequeoLivianoDirector';
  });
  if (existe) return { ya_existia: true };
  ScriptApp.newTrigger('chequeoLivianoDirector').timeBased().everyMinutes(30).create();
  Logger.log('Trigger "chequeoLivianoDirector" instalado (cada 30 min).');
  return { ya_existia: false };
}
