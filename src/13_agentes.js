/**
 * 13_agentes.js — Registry de 13 sub-agentes + presupuesto/cupos + feed (Agentes.gs donante adaptado).
 *
 * 5 activos (piloto) · 8 en el laboratorio (visibles, bloqueados; activar = flag + decisión humana).
 * Adaptaciones al repo (HANDOFF E2+ M5):
 *  - NO hay llamarClaude_: los runners llaman llamadaAPI(idCliente, modulo, {prompt}) → anonimización + log + costeo gratis.
 *  - Gates humanos vía crearAprobacion() (motor E2), NUNCA por canal propio. La columna 'aprobada' del donante se descarta.
 *  - Cupos diarios (maxDia) + tope mensual USD se chequean acá (Consumo_agentes en MAESTRO).
 *  - Los runners leen las hojas REALES del Sheet de cada cliente (CLIENTE_SHEETS: Datos_operativos/KPIs),
 *    NO las ventas/banco/facturas/stock del donante. Sin datos → lo dicen honesto, jamás inventan.
 *  - El feed escribe en la hoja MAESTRO 'Actividad'.
 */

var AGENTES = {
  // ——— Activos (piloto) ———
  vigia:       { nombre: 'Vigía',       rol: 'Monitoreo',    activo: true,  gate: false, maxDia: 24 },
  conciliador: { nombre: 'Conciliador', rol: 'Banco↔Ventas', activo: true,  gate: false, maxDia: 4  },
  cobrador:    { nombre: 'Cobrador',    rol: 'Cobranzas',    activo: true,  gate: true,  maxDia: 2  },
  analista:    { nombre: 'Analista',    rol: 'Tendencias',   activo: true,  gate: false, maxDia: 6  },
  abastecedor: { nombre: 'Abastecedor', rol: 'Stock',        activo: true,  gate: true,  maxDia: 2  },
  // ——— Laboratorio (Trillion) — activo:false hasta decisión explícita ———
  flux:  { nombre: 'Flux',  rol: 'Ingeniería',   activo: false, gate: true,  maxDia: 2 },
  relay: { nombre: 'Relay', rol: 'Soporte',      activo: false, gate: true,  maxDia: 6 },
  scout: { nombre: 'Scout', rol: 'Testing',      activo: false, gate: false, maxDia: 2 },
  prism: { nombre: 'Prism', rol: 'Diseño',       activo: false, gate: true,  maxDia: 2 },
  atlas: { nombre: 'Atlas', rol: 'Research',     activo: false, gate: false, maxDia: 4 },
  spark: { nombre: 'Spark', rol: 'Social',       activo: false, gate: true,  maxDia: 2 },
  forge: { nombre: 'Forge', rol: 'Crea agentes', activo: false, gate: true,  maxDia: 1 },
  lift:  { nombre: 'Lift',  rol: 'Retención',    activo: false, gate: false, maxDia: 2 }
};

/* ============ Feed de actividad (fuente del activity feed de la UI) ============ */

function feed_(agente, tipo, idCliente, texto, tareaId, aprobacionId) {
  appendFila(getMaestro().getSheetByName('Actividad'), {
    ts: ahoraISO(), agente: agente, tipo: tipo, id_cliente: idCliente || '',
    texto: texto, tarea_id: tareaId || '', aprobacion_id: aprobacionId || ''
  });
}

/* ============ Presupuesto y cupos (Consumo_agentes en MAESTRO) ============ */

function budgetMensualUSD_() {
  var p = PropertiesService.getScriptProperties().getProperty('API_BUDGET_MENSUAL_USD');
  var n = Number(p || getConfig('api_budget_mensual_usd') || 25);
  return isNaN(n) ? 25 : n;
}

function filaConsumoAgentes_() {
  var sh = getMaestro().getSheetByName('Consumo_agentes');
  var mes = mesISO();
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === mes) return { fila: i + 1, gasto: Number(vals[i][1]) || 0, corridas: parsearPayload_(vals[i][2]) };
  }
  sh.appendRow([mes, 0, '{}']);
  return { fila: sh.getLastRow(), gasto: 0, corridas: {} };
}

/** Registra una corrida exitosa: suma USD del mes y +1 al cupo diario del agente. */
function registrarConsumoAgente_(usd, clave) {
  var sh = getMaestro().getSheetByName('Consumo_agentes');
  var c = filaConsumoAgentes_();
  var key = clave + ':' + hoyISO();
  c.corridas[key] = (c.corridas[key] || 0) + 1;
  sh.getRange(c.fila, 2).setValue(Math.round((c.gasto + (usd || 0)) * 1e4) / 1e4);
  sh.getRange(c.fila, 3).setValue(sanitizarCelda(JSON.stringify(c.corridas)));
}

/** Guard de cupo/presupuesto. {ok} o {ok:false, motivo}. Vigía nunca se pausa por tope mensual. */
function guardPresupuesto_(clave) {
  var c = filaConsumoAgentes_(), tope = budgetMensualUSD_();
  var hoy = c.corridas[clave + ':' + hoyISO()] || 0;
  if (hoy >= AGENTES[clave].maxDia) return { ok: false, motivo: 'cupo diario alcanzado (' + AGENTES[clave].maxDia + ')' };
  if (c.gasto >= tope && clave !== 'vigia') return { ok: false, motivo: 'tope mensual de API alcanzado (USD ' + tope + ')' };
  if (c.gasto >= tope * 0.8 && c.gasto < tope) {
    var flag = 'AVISO80_' + mesISO();
    if (!PropertiesService.getScriptProperties().getProperty(flag)) { // avisar una vez por mes
      PropertiesService.getScriptProperties().setProperty(flag, '1');
      feed_('Sistema', 'aprobacion', '', 'Consumo API al ' + Math.round(c.gasto / tope * 100) + '% del tope mensual.', '', '');
    }
  }
  return { ok: true };
}

/* ============ Runners v1 ============
 * Cada runner corre HASTA EL FINAL y devuelve {status, detalle, aprobacion_id?}.
 * status: 'completado' | 'esperando_aprobacion' | 'error'. Sin datos → honesto, no inventa.
 * Los agentes con gate proponen vía crearAprobacion(): acá termina su corrida (gate humano). */

/** Lee una pestaña real del Sheet del cliente. null si no existe o vacía. */
function leerHojaCliente_(idCliente, pestana, maxFilas) {
  var sh = abrirCliente(idCliente).ss.getSheetByName(pestana);
  if (!sh || sh.getLastRow() < 2) return null;
  var n = Math.min(sh.getLastRow() - 1, maxFilas || 200);
  return {
    cab: sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0],
    filas: sh.getRange(2, 1, n, sh.getLastColumn()).getValues()
  };
}

function sinDatos_(nombre, idCliente, tareaId, msg) {
  feed_(nombre, 'info', idCliente, msg, tareaId, '');
  return { status: 'completado', detalle: 'sin datos aún' };
}
function errorRunner_(nombre, idCliente, tareaId, r) {
  feed_(nombre, 'info', idCliente, nombre + ' no pudo completar: ' + (r.error || 'error de proveedor'), tareaId, '');
  return { status: 'error', detalle: r.error || 'error de proveedor' };
}

var RUNNERS = {
  vigia: function (idCliente, args, tareaId) {
    var d = leerHojaCliente_(idCliente, 'Datos_operativos', 500);
    if (!d) return sinDatos_('Vigía', idCliente, tareaId, 'Sin datos operativos para vigilar todavía. Esperando datos del cliente.');
    var r = llamadaAPI(idCliente, 'vigia', { maxTokens: 500, prompt:
      'Sos Vigía, monitoreo de un negocio. Datos operativos (cabeceras: ' + d.cab.join(', ') +
      '; últimas filas: ' + JSON.stringify(d.filas.slice(-30)) +
      '). Devolvé en 3 líneas: estado general, anomalía si la hay, y el dato que el dueño debe mirar hoy. Sin preámbulos.' });
    if (!r.ok) return errorRunner_('Vigía', idCliente, tareaId, r);
    registrarConsumoAgente_(r.usd, 'vigia');
    feed_('Vigía', 'exito', idCliente, r.texto, tareaId, '');
    return { status: 'completado', detalle: r.texto };
  },

  conciliador: function (idCliente, args, tareaId) {
    var d = leerHojaCliente_(idCliente, 'Datos_operativos', 400);
    if (!d) return sinDatos_('Conciliador', idCliente, tareaId, 'Sin datos operativos. Nada para conciliar.');
    var r = llamadaAPI(idCliente, 'conciliador', { maxTokens: 700, prompt:
      'Sos Conciliador. En estos movimientos operativos (cabeceras: ' + d.cab.join(', ') + ') cruzá ingresos vs egresos/registros ' +
      'y listá SOLO las diferencias o inconsistencias (concepto, monto, fecha): ' + JSON.stringify(d.filas.slice(-60)) });
    if (!r.ok) return errorRunner_('Conciliador', idCliente, tareaId, r);
    registrarConsumoAgente_(r.usd, 'conciliador');
    feed_('Conciliador', 'exito', idCliente, r.texto, tareaId, '');
    return { status: 'completado', detalle: r.texto };
  },

  analista: function (idCliente, args, tareaId) {
    var d = leerHojaCliente_(idCliente, 'Datos_operativos', 500);
    if (!d) return sinDatos_('Analista', idCliente, tareaId, 'Sin datos para analizar todavía.');
    var pregunta = (args && args.pregunta) ? String(args.pregunta).slice(0, 500) : 'tendencia y margen del último período';
    var r = llamadaAPI(idCliente, 'analista', { maxTokens: 600, prompt:
      'Sos Analista de negocio. Datos (cabeceras: ' + d.cab.join(', ') + '): ' + JSON.stringify(d.filas.slice(-60)) +
      '. Respondé breve y con números: ' + pregunta });
    if (!r.ok) return errorRunner_('Analista', idCliente, tareaId, r);
    registrarConsumoAgente_(r.usd, 'analista');
    feed_('Analista', 'exito', idCliente, r.texto, tareaId, '');
    return { status: 'completado', detalle: r.texto };
  },

  cobrador: function (idCliente, args, tareaId) {
    var d = leerHojaCliente_(idCliente, 'Datos_operativos', 300);
    if (!d) return sinDatos_('Cobrador', idCliente, tareaId, 'Sin datos operativos. Nada para cobrar.');
    var r = llamadaAPI(idCliente, 'cobrador', { maxTokens: 700, prompt:
      'Sos Cobrador. De estos registros operativos detectá pagos vencidos/pendientes y redactá UN recordatorio breve y cordial ' +
      'por cada uno (sin datos personales inventados). Datos: ' + JSON.stringify(d.filas.slice(-60)) });
    if (!r.ok) return errorRunner_('Cobrador', idCliente, tareaId, r);
    registrarConsumoAgente_(r.usd, 'cobrador');
    // GATE humano vía motor E2: NADA se envía sin resolverAprobacion (default-deny).
    var apr = crearAprobacion(idCliente, 'cobrador', 'email',
      { asunto: 'Recordatorio de pago', cuerpo: r.texto, destinatario: '' },
      { descripcion: 'Recordatorios de cobro propuestos por Cobrador (completar destinatario al aprobar)' });
    feed_('Cobrador', 'aprobacion', idCliente, 'Propuesta de recordatorios lista. Requiere aprobación [' + apr.id + '].', tareaId, apr.id);
    return { status: 'esperando_aprobacion', detalle: r.texto, aprobacion_id: apr.id };
  },

  abastecedor: function (idCliente, args, tareaId) {
    var d = leerHojaCliente_(idCliente, 'Datos_operativos', 300);
    if (!d) return sinDatos_('Abastecedor', idCliente, tareaId, 'Sin datos operativos. Nada para reponer.');
    var r = llamadaAPI(idCliente, 'abastecedor', { maxTokens: 600, prompt:
      'Sos Abastecedor. Detectá ítems en nivel crítico y proponé cantidades de reposición a partir de: ' + JSON.stringify(d.filas.slice(-80)) });
    if (!r.ok) return errorRunner_('Abastecedor', idCliente, tareaId, r);
    registrarConsumoAgente_(r.usd, 'abastecedor');
    var apr = crearAprobacion(idCliente, 'abastecedor', 'reposicion',
      { propuesta: r.texto },
      { descripcion: 'Propuesta de reposición de stock por Abastecedor' });
    feed_('Abastecedor', 'aprobacion', idCliente, 'Propuesta de reposición lista. Requiere aprobación [' + apr.id + '].', tareaId, apr.id);
    return { status: 'esperando_aprobacion', detalle: r.texto, aprobacion_id: apr.id };
  }
};

/** Punto de entrada único (lo llama la cola). */
function correrAgente_(clave, args, tareaId, idCliente) {
  var ag = AGENTES[clave];
  if (!ag) return { status: 'error', detalle: 'agente desconocido' };
  if (!ag.activo) { // laboratorio: error honesto, nunca corre (caso 10)
    feed_(ag.nombre, 'info', idCliente || '', ag.nombre + ' está en el laboratorio (no activo).', tareaId, '');
    return { status: 'error', detalle: ag.nombre + ' está en el laboratorio (no activo)' };
  }
  if (!idCliente) return { status: 'error', detalle: 'falta id_cliente' };
  var guard = guardPresupuesto_(clave);
  if (!guard.ok) { // pausa SIEMPRE visible en el feed (caso 11), tarea fallida, sin éxito silencioso
    feed_(ag.nombre, 'aprobacion', idCliente, ag.nombre + ' pausado: ' + guard.motivo + '. Ajustable en Script Properties / Config.', tareaId, '');
    return { status: 'error', detalle: guard.motivo };
  }
  var runner = RUNNERS[clave];
  if (!runner) return { status: 'error', detalle: 'runner no implementado para ' + ag.nombre };
  feed_(ag.nombre, 'info', idCliente, ag.nombre + ' comenzó a trabajar…', tareaId, '');
  return runner(idCliente, args, tareaId); // se espera el final real (started no es done)
}

/** Encola una corrida de agente para un cliente (lo llama la UI). Devuelve {tareaId}. */
function encolarAgente(idCliente, clave, args) {
  if (!AGENTES[clave]) throw new Error('agente desconocido');
  if (!idCliente) throw new Error('falta id_cliente');
  var id = encolar(workerActual_(), 'agente', { agente: clave, id_cliente: idCliente, args: args || {} });
  feed_(AGENTES[clave].nombre, 'info', idCliente, 'Tarea encolada por el usuario.', id, '');
  return { tareaId: id };
}
