/**
 * 11_aprobaciones.js — Motor de aprobaciones (ETAPA 2 · Módulo 1).
 *
 * Único camino por el que una acción decidida llega a ejecutarse:
 *   crearAprobacion()  → escribe PENDIENTE en el Sheet del cliente (append-only)
 *   resolverAprobacion() → único punto de decisión (humano); edita estado/autor/fecha
 *   ejecutarAprobada() → ejecuta SOLO si fue aprobada/editada y registra resultado
 *   expirarPendientes() → >N días sin decisión → "expirada" (el silencio NUNCA aprueba)
 *
 * Clasificador default-deny: tipo de acción no registrado → P1 (aprobación) siempre;
 * monto sin fila en Umbrales del cliente → PENDIENTE. Reglas nacen "propuesta" y solo
 * se activan vía una P1 (resolverAprobacion). Append-only sobre la pestaña Aprobaciones:
 * se EDITAN los campos de decisión de una fila pendiente, jamás se borra historia.
 */

/**
 * Clasifica el patrón de una acción (default-deny).
 *  - Config 'clasif_<tipo>' → patrón explícito si está configurado.
 *  - monto presente sin fila en Umbrales del cliente → P1 (default deny).
 *  - resto: P2 si hay monto, P1 si no.
 * @return {{patron:string, motivo:string}}
 */
function clasificarAccion(idCliente, tipoAccion, monto) {
  var explicito = getConfig('clasif_' + tipoAccion);
  if (explicito) return { patron: explicito, motivo: 'config' };

  var hayMonto = monto !== '' && monto !== null && monto !== undefined;
  if (hayMonto) {
    var umbral = umbralPara(idCliente, tipoAccion);
    if (!umbral) return { patron: 'P1', motivo: 'monto sin umbral (default deny)' };
    return { patron: 'P2', motivo: 'monto con umbral' };
  }
  return { patron: 'P1', motivo: 'tipo no registrado (default deny)' };
}

/** Fila de Umbrales del cliente para un tipo de acción, o null. */
function umbralPara(idCliente, tipoAccion) {
  var sh = abrirCliente(idCliente).ss.getSheetByName('Umbrales');
  if (!sh) return null;
  return leerTabla(sh).filter(function (u) { return String(u.tipo_accion) === String(tipoAccion); })[0] || null;
}

/**
 * Crea una aprobación PENDIENTE en el Sheet del cliente. La sync la sube al MAESTRO.
 * @param {string} idCliente
 * @param {string} modulo      flujo/agente que la propone (p.ej. 'cobrador')
 * @param {string} tipoAccion  'email' | 'pago' | 'reposicion' | 'activar_regla' | ...
 * @param {Object|string} payload  datos de la acción (se guarda como JSON)
 * @param {Object} [opts] { descripcion, monto, confianza, patron }
 * @return {{id:string, patron:string}}
 */
function crearAprobacion(idCliente, modulo, tipoAccion, payload, opts) {
  opts = opts || {};
  var cliCtx = abrirCliente(idCliente);
  var shAp = cliCtx.ss.getSheetByName('Aprobaciones');
  if (!shAp) throw new Error('cliente ' + idCliente + ' sin pestaña Aprobaciones');

  var monto = (opts.monto === undefined || opts.monto === null) ? '' : opts.monto;
  var patron = opts.patron || clasificarAccion(idCliente, tipoAccion, monto).patron;
  var payloadStr = (typeof payload === 'string') ? payload : JSON.stringify(payload || {});

  return conLock(function () { // serializa nextId + append (PURGA #4)
    var id = nextId(shAp, 'id', 'APR', 4);
    appendFila(shAp, {
      id: id,
      fecha_creacion: ahoraISO(),
      cliente: cliCtx.cli.nombre,
      modulo: modulo,
      patron: patron,
      tipo_accion: tipoAccion,
      descripcion: opts.descripcion || (modulo + ' · ' + tipoAccion),
      payload: payloadStr,
      monto: monto,
      'confianza_%': (opts.confianza === undefined ? '' : opts.confianza),
      estado: 'pendiente',
      decidido_por: '',
      fecha_decision: '',
      resultado_ejecucion: '',
      notas: ''
    });
    return { id: id, patron: patron };
  });
}

/**
 * Único punto de decisión humana. Edita la fila pendiente (append-only sobre los
 * campos de decisión) y, si se aprueba/edita, dispara la ejecución.
 * @param {string} idCliente
 * @param {string} id          id de la aprobación (APR-####)
 * @param {string} decision    'aprobada' | 'editada' | 'rechazada'
 * @param {Object} [ediciones] { payload?, descripcion?, notas? } — solo en 'editada'
 * @return {{ok:boolean, estado:string, ejecucion?:Object}}
 */
function resolverAprobacion(idCliente, id, decision, ediciones) {
  decision = String(decision || '').toLowerCase();
  if (['aprobada', 'editada', 'rechazada'].indexOf(decision) < 0) {
    throw new Error('decisión inválida: ' + decision);
  }
  ediciones = ediciones || {};
  var shAp = abrirCliente(idCliente).ss.getSheetByName('Aprobaciones');
  if (!shAp) throw new Error('cliente ' + idCliente + ' sin pestaña Aprobaciones');

  return conLock(function () {
    var matriz = shAp.getDataRange().getValues();
    var H = matriz[0];
    var c = {
      id: H.indexOf('id'), estado: H.indexOf('estado'), payload: H.indexOf('payload'),
      desc: H.indexOf('descripcion'), autor: H.indexOf('decidido_por'),
      fdec: H.indexOf('fecha_decision'), notas: H.indexOf('notas')
    };
    for (var r = 1; r < matriz.length; r++) {
      if (String(matriz[r][c.id]) !== String(id)) continue;
      if (String(matriz[r][c.estado]).toLowerCase() !== 'pendiente') {
        throw new Error('aprobación ' + id + ' no está pendiente (estado: ' + matriz[r][c.estado] + ')');
      }
      if (decision === 'editada') {
        if (ediciones.payload !== undefined) {
          matriz[r][c.payload] = sanitizarCelda(typeof ediciones.payload === 'string'
            ? ediciones.payload : JSON.stringify(ediciones.payload));
        }
        if (ediciones.descripcion !== undefined) matriz[r][c.desc] = sanitizarCelda(String(ediciones.descripcion));
      }
      matriz[r][c.estado] = decision;
      if (c.autor >= 0) matriz[r][c.autor] = autorActual_();
      if (c.fdec >= 0) matriz[r][c.fdec] = hoyISO();
      if (c.notas >= 0 && ediciones.notas !== undefined) matriz[r][c.notas] = sanitizarCelda(String(ediciones.notas));
      shAp.getRange(1, 1, matriz.length, H.length).setValues(matriz);

      if (decision === 'rechazada') return { ok: true, estado: decision };
      var ejec = ejecutarAprobada(idCliente, id); // aprobada | editada → ejecutar
      return { ok: true, estado: decision, ejecucion: ejec };
    }
    throw new Error('aprobación no encontrada: ' + id + ' en ' + idCliente);
  });
}

/**
 * Ejecuta una aprobación ya decidida (aprobada/editada) y registra resultado_ejecucion.
 * Ninguna acción externa existe fuera de este camino. Despacha por tipo_accion.
 * AREL: el envío de email solo ocurre acá, DESPUÉS del OK humano de resolverAprobacion.
 */
function ejecutarAprobada(idCliente, id) {
  var shAp = abrirCliente(idCliente).ss.getSheetByName('Aprobaciones');
  var filas = leerTabla(shAp);
  var a = filas.filter(function (f) { return String(f.id) === String(id); })[0];
  if (!a) throw new Error('aprobación no encontrada: ' + id);
  if (['aprobada', 'editada'].indexOf(String(a.estado).toLowerCase()) < 0) {
    throw new Error('ejecutarAprobada exige estado aprobada/editada (es ' + a.estado + ')');
  }

  var payload = parsearPayload_(a.payload);
  var res;
  try {
    switch (String(a.tipo_accion)) {
      case 'email':
        res = ejecutarEmail_(payload);
        break;
      case 'activar_regla':
        res = ejecutarActivarRegla_(idCliente, payload);
        break;
      default:
        // Sin sistema externo cableado todavía (Etapa 3): se registra como ejecutada.
        res = { ok: true, detalle: 'acción "' + a.tipo_accion + '" registrada (sin destino externo en E2)' };
    }
  } catch (e) {
    res = { ok: false, error: e.message };
  }

  // Registrar resultado_ejecucion en la fila (append-only sobre campo de resultado).
  var H = shAp.getRange(1, 1, 1, shAp.getLastColumn()).getValues()[0];
  shAp.getRange(a._fila, H.indexOf('resultado_ejecucion') + 1)
    .setValue(sanitizarCelda(ahoraISO() + ' · ' + JSON.stringify(res)));
  return res;
}

/** Envía email vía MailApp (scope script.send_mail). payload: {destinatario, asunto, cuerpo}. */
function ejecutarEmail_(payload) {
  if (!payload || !payload.destinatario) throw new Error('email sin destinatario');
  MailApp.sendEmail(String(payload.destinatario), String(payload.asunto || '(sin asunto)'), String(payload.cuerpo || ''));
  return { ok: true, detalle: 'email enviado', destinatario: payload.destinatario };
}

/** Activa una Regla del cliente (estado propuesta → activa). payload: {id_regla}. */
function ejecutarActivarRegla_(idCliente, payload) {
  if (!payload || !payload.id_regla) throw new Error('falta id_regla');
  var shR = abrirCliente(idCliente).ss.getSheetByName('Reglas');
  if (!shR) throw new Error('cliente sin pestaña Reglas');
  var H = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0];
  var iId = H.indexOf('id_regla'), iEstado = H.indexOf('estado');
  var filas = leerTabla(shR);
  var rg = filas.filter(function (f) { return String(f.id_regla) === String(payload.id_regla); })[0];
  if (!rg) throw new Error('regla no encontrada: ' + payload.id_regla);
  shR.getRange(rg._fila, iEstado + 1).setValue('activa');
  return { ok: true, detalle: 'regla ' + payload.id_regla + ' activada' };
}

/**
 * Crea una Regla "propuesta" desde una excepción y genera la P1 que la activa.
 * Per Auditor 0.2: nace propuesta; solo resolverAprobacion (aprobar esa P1) la activa.
 * @return {{id_regla:string, aprobacion:Object}}
 */
function crearReglaDesdeExcepcion(idCliente, condicion, accion, origen) {
  var cliCtx = abrirCliente(idCliente);
  var shR = cliCtx.ss.getSheetByName('Reglas');
  if (!shR) throw new Error('cliente sin pestaña Reglas');

  var idRegla = conLock(function () {
    var id = nextId(shR, 'id_regla', 'REG', 3);
    appendFila(shR, {
      id_regla: id, origen: origen || 'excepcion', condicion: condicion,
      accion: accion, estado: 'propuesta'
    });
    return id;
  });

  var apr = crearAprobacion(idCliente, 'gobernanza', 'activar_regla',
    { id_regla: idRegla, condicion: condicion, accion: accion },
    { descripcion: 'Activar regla ' + idRegla + ': ' + condicion + ' → ' + accion, patron: 'P1' });

  return { id_regla: idRegla, aprobacion: apr };
}

/**
 * Aprobaciones pendientes > N días → "expirada" + aviso. Alias del expirador de E1
 * (06_avisos.js) con el nombre que usa la spec de E2. El silencio NUNCA aprueba.
 */
function expirarPendientes() { return expirarAprobaciones(); }

// ── helpers locales ─────────────────────────────────────────────────────────

function parsearPayload_(s) {
  if (s && typeof s === 'object') return s;
  try { return JSON.parse(String(s).replace(/^'/, '')); } catch (e) { return {}; }
}

/** Autor de una decisión: email del usuario activo o etiqueta genérica. */
function autorActual_() {
  try {
    var e = Session.getActiveUser().getEmail();
    return e || 'humano';
  } catch (x) { return 'humano'; }
}
