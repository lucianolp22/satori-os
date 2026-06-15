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
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
    if (tenant) return c.id_cliente === tenant;
    return ['activo', 'activo-piloto'].indexOf(String(c.estado).toLowerCase()) >= 0;
  });

  var totalEncolados = 0, partes = [];
  clientes.forEach(function (c) {
    if (!c.url_sheet_cliente) return;
    try {
      var ssCli = SpreadsheetApp.openByUrl(c.url_sheet_cliente);
      if (!ssCli.getSheetByName('estado_actual')) { // cerebro no inicializado en este tenant
        partes.push({ tenant: c.id_cliente, omitido: 'sin cerebro (corré repararCerebro)' });
        return;
      }

      materializarEstado(c.id_cliente); // refresca estado_actual + Cerebro_index (sin PII)

      var objetivos = leerTabla(ssCli.getSheetByName('objetivos')).filter(function (o) {
        return ['activo', 'en_curso', 'abierto'].indexOf(String(o.estado).toLowerCase()) >= 0;
      });

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
 * Chequeo liviano (cada 30 min, opcional): NO materializa ni corre el pase completo.
 * Solo mira pendientes de aprobación y cola en curso y los devuelve (la UI los muestra).
 * 0 API, lectura barata del MAESTRO. Trigger opcional vía instalarTriggerDirector().
 */
function chequeoLivianoDirector() {
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
