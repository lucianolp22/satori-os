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
  _soloOwner_('correrDirector');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta. Va DESPUÉS de _ctxSistema_: antes rompería el trigger.
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

      // ── PM persistente (D7): el estado de cada objetivo sobrevive a la corrida. ──
      // Fail-safe: si el cerebro o los KPIs no se pueden leer, se sigue con memoria vacía ⇒
      // todos los objetivos caen en `primera_vez` ⇒ análisis completo, como antes de TC-3.
      var snapPM = [], kpis = [];
      try { snapPM = leerTabla(cerebroSheet_(c.id_cliente, 'nodos')) || []; } catch (_ePM) { snapPM = []; }
      try { kpis = leerTabla(ssCli.getSheetByName('KPIs')) || []; } catch (_eK) { kpis = []; }
      var diasRefresco = 7;
      try { var cfgR = parseInt(getConfig('pm_dias_refresco'), 10); if (isFinite(cfgR) && cfgR > 0) diasRefresco = cfgR; } catch (_eC) {}
      var hoyPM = hoyISO();

      var encolados = 0, sinCambios = 0, refrescos = 0, primeros = 0, deltas = [];
      objetivos.forEach(function (o) {
        if (!o.metrica) return; // solo objetivos medibles disparan análisis dirigido
        var nodoId = _pmNodoId_(o.id_objetivo || o.metrica || o.descripcion);
        var previo = null, analizadoEn = '';
        var nodoPrevio = snapPM.filter(function (n) { return String(n.id_nodo) === nodoId; })[0];
        if (nodoPrevio) {
          // Un `atributos` corrupto NO se interpreta como "sin cambios": cae a primera_vez y se
          // analiza completo. Un JSON roto jamás debe AHORRAR trabajo.
          var at = parsearPayload_(nodoPrevio.atributos);
          if (at && at.foto) { previo = at.foto; analizadoEn = String(at.analizado_en || ''); }
        }
        var foto = _pmFoto_(o, _pmValorMetrica_(kpis, o.metrica));
        var delta = _pmDelta_(previo, foto);
        var vencido = _pmVencido_(analizadoEn, diasRefresco, hoyPM);
        var motivo = delta.primera_vez ? 'primera_vez' : (delta.hay_cambios ? 'cambios' : (vencido ? 'refresco' : ''));

        if (motivo) {
          encolarAgente(c.id_cliente, 'analista', {
            pregunta: _pmPregunta_(foto, delta, motivo),
            pm_motivo: motivo,
            pm_delta: delta.cambios
          });
          encolados++;
          if (motivo === 'primera_vez') primeros++; else if (motivo === 'refresco') refrescos++;
        } else {
          // Nada cambió y el refresco no venció: NO se molesta al modelo. Un PM que re-pregunta
          // lo mismo todos los días es costo y ruido, no seguimiento.
          sinCambios++;
        }
        if (!delta.primera_vez && delta.hay_cambios) deltas.push({ objetivo: foto.id_objetivo || foto.metrica, cambios: delta.cambios });

        // Se persiste la FOTO COMPLETA (no el delta): un lector fresco reconstruye el estado sin
        // encadenar diferencias. `analizado_en` solo avanza cuando de verdad se encoló análisis;
        // si no, el reloj del refresco seguiría corriendo sin que nadie mire nada.
        upsertNodo(c.id_cliente, {
          id_nodo: nodoId, dimension: 'sistema', tipo: 'pm_estado',
          etiqueta: 'PM · ' + String(foto.descripcion || foto.metrica).slice(0, 34),
          atributos: { foto: foto, analizado_en: (motivo ? hoyPM : (analizadoEn || '')), ultimo_motivo: motivo || 'sin_cambios' },
          relevancia: 3, cobertura: (previo ? 80 : 40), fuente: 'director'
        }, snapPM);
      });
      totalEncolados += encolados;

      // Parte del Director al cerebro (append-only). El delta va acá para que quede el rastro de
      // QUÉ cambió, no solo cuántos análisis se encolaron.
      logEvento(c.id_cliente, {
        evento: 'parte_director', origen: 'director',
        detalle: { objetivos_activos: objetivos.length, analistas_encolados: encolados,
                   pm_primeros: primeros, pm_refrescos: refrescos, pm_sin_cambios: sinCambios, pm_deltas: deltas }
      });
      // E8a4: surfacear la directiva al feed del MAESTRO (Actividad) para que el Command
      // Center la muestre sin abrir el Sheet del cliente.
      try {
        // El texto distingue las TRES razones de encolar 0: nada medible, o todo quieto. Antes
        // decía siempre "sin objetivos medibles", que con el PM persistente sería mentira el día
        // que hay objetivos y ninguno se movió.
        var msgDir = encolados
          ? (encolados + ' análisis dirigido(s): ' + primeros + ' nuevo(s) · ' +
             (encolados - primeros - refrescos) + ' con cambios · ' + refrescos + ' de refresco')
          : (sinCambios ? (sinCambios + ' objetivo(s) sin cambios — no se re-analiza')
                        : 'sin objetivos medibles — monitoreo base');
        feed_('Director', 'info', c.id_cliente, 'Directiva: ' + msgDir + '.', '', '');
      } catch (e) {}
      partes.push({ tenant: c.id_cliente, objetivos_activos: objetivos.length, encolados: encolados,
                    pm: { primeros: primeros, refrescos: refrescos, sin_cambios: sinCambios, deltas: deltas } });
    } catch (e) {
      partes.push({ tenant: c.id_cliente, error: e.message });
      try { feed_('Director', 'info', c.id_cliente, 'Director no pudo procesar: ' + e.message, '', ''); } catch (x) {}
    }
  });

  Logger.log('correrDirector: ' + JSON.stringify({ tenants: clientes.length, encolados: totalEncolados }));
  return { tenants: clientes.length, encolados: totalEncolados, partes: partes };
}

// ═══ PM PERSISTENTE (TC-3 · D7) ═════════════════════════════════════════════
//
// El problema: hasta hoy el Director re-analizaba de cero todos los días. Encolaba un Analista
// por objetivo medible sin importar si algo había cambiado desde ayer — pagando API para
// re-descubrir lo mismo, y sin poder decir nunca "esto se movió".
//
// La memoria vive en el CEREBRO del tenant, en un nodo por objetivo (`NOD-PM-*`), y guarda la
// FOTO COMPLETA del último análisis, no el delta. Decisión deliberada (Luciano, 03-ago):
// reconstruir el estado encadenando deltas es frágil — basta una corrida perdida para que la
// cadena mienta. El delta se CALCULA al vuelo comparando dos fotos y sirve para el reporte; la
// foto es lo que persiste y lo que un lector fresco (o el brief) puede leer sin reconstruir nada.
//
// FAIL-SAFE en todas las ramas: sin nodo previo, con nodo ilegible o con el cerebro caído →
// análisis COMPLETO, el comportamiento de siempre. El PM nunca analiza MENOS por culpa de un
// error de lectura; en la duda, gasta.

var PM_NODO_PREFIJO = 'NOD-PM-';
/** Campos de la foto que se comparan para el delta. LISTA-CONTRATO: agregar uno cambia qué
 *  cuenta como "cambio" y por lo tanto cuándo se re-analiza. `_pmDelta_` deriva de acá. */
var PM_CAMPOS_DELTA = ['descripcion', 'metrica', 'valor_objetivo', 'valor_actual', 'prioridad', 'estado', 'horizonte'];

/** Id estable del nodo de seguimiento de un objetivo. */
function _pmNodoId_(idObjetivo) {
  return PM_NODO_PREFIJO + 'X' + String(idObjetivo || 'obj').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 22);
}

/**
 * FOTO COMPLETA del objetivo en este momento. PURA — es lo que se persiste en el nodo.
 * Todo lo que haga falta para entender el objetivo sin abrir nada más va acá dentro.
 */
function _pmFoto_(o, valorActual) {
  o = o || {};
  return {
    id_objetivo: String(o.id_objetivo || ''),
    descripcion: String(o.descripcion || '').slice(0, 200),
    metrica: String(o.metrica || ''),
    valor_objetivo: (o.valor_objetivo == null ? '' : String(o.valor_objetivo)),
    valor_actual: (valorActual == null ? '' : String(valorActual)),
    prioridad: String(o.prioridad || ''),
    estado: String(o.estado || ''),
    horizonte: String(o.horizonte || '')
  };
}

/** Último valor conocido de una métrica en los KPIs del tenant. PURO. '' si no hay dato. */
function _pmValorMetrica_(kpis, metrica) {
  var m = String(metrica || '').trim().toLowerCase();
  if (!m) return '';
  var mejor = null;
  (kpis || []).forEach(function (k) {
    if (String(k.kpi || '').trim().toLowerCase() !== m) return;
    var f = aFechaISO(k.fecha) || '';
    if (!mejor || f >= mejor.f) mejor = { f: f, v: k.valor };
  });
  return mejor && mejor.v != null ? String(mejor.v) : '';
}

/**
 * Delta entre la foto anterior y la actual. PURO — el corazón del PM persistente.
 * Sin foto previa devuelve `primera_vez` (⇒ análisis completo, nunca un delta inventado).
 * @return {{primera_vez:boolean, hay_cambios:boolean, cambios:Array, resumen:string}}
 */
function _pmDelta_(prev, act) {
  if (!prev || typeof prev !== 'object' || !Object.keys(prev).length) {
    return { primera_vez: true, hay_cambios: true, cambios: [], resumen: 'primer análisis: no hay estado previo de este objetivo' };
  }
  var cambios = [];
  PM_CAMPOS_DELTA.forEach(function (c) {
    var a = String(prev[c] == null ? '' : prev[c]);
    var b = String(act && act[c] != null ? act[c] : '');
    if (a !== b) cambios.push({ campo: c, de: a, a: b });
  });
  return {
    primera_vez: false,
    hay_cambios: cambios.length > 0,
    cambios: cambios,
    resumen: cambios.length
      ? cambios.map(function (c) { return c.campo + ' ' + (c.de || '—') + ' → ' + (c.a || '—'); }).join(' · ')
      : 'sin cambios desde el último análisis'
  };
}

/**
 * ¿Toca refrescar aunque no haya cambios? PURO. Sin fecha previa legible ⇒ sí (fail-safe: en la
 * duda se analiza). Evita que un objetivo quieto quede dormido para siempre.
 */
function _pmVencido_(analizadoEn, dias, hoy) {
  var f = String(analizadoEn || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return true;
  var d = Number(dias) > 0 ? Number(dias) : 7;
  var t = Date.parse(f + 'T00:00:00Z'), h = Date.parse(String(hoy || '').slice(0, 10) + 'T00:00:00Z');
  if (!isFinite(t) || !isFinite(h)) return true;
  return (h - t) / 864e5 >= d;
}

/**
 * La consulta que recibe el Analista. PURA. Con estado previo, el análisis PARTE de ahí en vez
 * de arrancar en blanco — que es todo el punto de D7. Se acota a 450 porque el runner del
 * Analista trunca `pregunta` en 500: si no, el delta se perdería justo al final.
 */
function _pmPregunta_(foto, delta, motivo) {
  var base = String(foto.descripcion || foto.metrica || 'objetivo');
  if (delta.primera_vez) return base.slice(0, 450);
  var partes = [base];
  if (foto.valor_actual) partes.push('Hoy: ' + foto.metrica + '=' + foto.valor_actual +
    (foto.valor_objetivo ? (' (meta ' + foto.valor_objetivo + ')') : ''));
  partes.push(motivo === 'refresco'
    ? 'Sin cambios registrados desde el último análisis: revisá si la tendencia se sostiene.'
    : ('Cambió desde el último análisis: ' + delta.resumen + '. Analizá QUÉ cambió y si el objetivo sigue en camino.'));
  return partes.join(' ').slice(0, 450);
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
  _soloOwner_('chequeoLivianoDirector');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta. Va DESPUÉS de _ctxSistema_: antes rompería el trigger.
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
  _soloOwner_('instalarTriggerDirector');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var existe = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'chequeoLivianoDirector';
  });
  if (existe) return { ya_existia: true };
  ScriptApp.newTrigger('chequeoLivianoDirector').timeBased().everyMinutes(30).create();
  Logger.log('Trigger "chequeoLivianoDirector" instalado (cada 30 min).');
  return { ya_existia: false };
}
