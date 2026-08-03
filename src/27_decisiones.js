/**
 * 27_decisiones.js — DECISION LOG (TC-2 · F4b). Las decisiones de dirección, con su porqué.
 *
 * El problema que resuelve: hasta hoy una decisión de Luciano vivía en el pivot de un North Star,
 * en un HANDOFF que envejece o en su memoria. Seis semanas después nadie recuerda POR QUÉ se
 * eligió eso, y se vuelve a discutir lo mismo — o peor, se revierte sin saber qué se estaba
 * comprando. Acá quedan las tres cosas juntas: qué se decidió, por qué, y sobre qué.
 *
 * DOS REGLAS QUE DEFINEN EL MÓDULO:
 *  1. APPEND-ONLY. No hay borrar ni editar. Cambiar de opinión es `revertirDecision`, que deja la
 *     fila original intacta y le agrega el cuándo y el porqué de la vuelta atrás. El historial de
 *     lo que pensaste distinto vale tanto como lo que decidiste.
 *  2. ALCANCE OBLIGATORIO. Toda decisión nace con `alcance` = 'sistema' o un id_cliente. Es lo
 *     que le permite a Sato leer las decisiones de un tenant sin filtrar las de otro
 *     (AISLAMIENTO DE CLIENTE §2: desde una Ficha se ve lo de ese cliente y lo de sistema, nunca
 *     lo de un tercero). Un alcance inventado no se registra.
 */

var DECISION_ESTADOS = ['vigente', 'revertida'];
var DECISION_ALCANCE_SISTEMA = 'sistema';

/**
 * ¿Esta decisión de alcance `alcance` es visible desde el contexto `ctxCliente`? PURA, para poder
 * aserir el aislamiento sin abrir un Sheet (patrón D19a/D30c).
 *  · contexto SISTEMA (ctxCliente vacío)  → ve todo (privilegio del modo sistema, §2).
 *  · contexto de un cliente               → ve lo de ESE cliente + lo de alcance 'sistema'.
 *    Nunca lo de otro tenant, ni siquiera para "comparar".
 */
function _decisionVisible_(alcance, ctxCliente) {
  var a = String(alcance == null ? '' : alcance).trim();
  var c = String(ctxCliente == null ? '' : ctxCliente).trim();
  if (!c) return true;                              // modo sistema: ve toda la cartera
  return a === c || a === DECISION_ALCANCE_SISTEMA;
}

/** Normaliza y valida los campos de una decisión. Devuelve {ok, error} o {ok:true, fila}. PURA. */
function _decisionNormalizar_(texto, porque, alcance, fuente, ahora) {
  var d = limpiarHostilTexto_(String(texto == null ? '' : texto), 400).trim();
  var p = limpiarHostilTexto_(String(porque == null ? '' : porque), 600).trim();
  var a = String(alcance == null ? '' : alcance).trim() || DECISION_ALCANCE_SISTEMA;
  if (!d) return { ok: false, error: 'falta_decision' };
  // El PORQUÉ es obligatorio a propósito: una decisión sin porqué es un dato suelto que dentro de
  // dos meses no se puede evaluar. Es el 80% del valor de este log.
  if (!p) return { ok: false, error: 'falta_porque' };
  return {
    ok: true,
    fila: {
      fecha: ahora || ahoraISO(),
      decision: d,
      porque: p,
      alcance: a,
      fuente: limpiarHostilTexto_(String(fuente == null ? '' : fuente), 120).trim() || 'manual',
      estado: 'vigente',
      revertida_en: '',
      revertida_porque: ''
    }
  };
}

/**
 * Registra una decisión. `alcance` vacío = 'sistema'; si es un id_cliente, se valida contra el
 * roster real (nunca un id que vino de un modelo — AISLAMIENTO §3).
 * @return {{ok:boolean, id_decision?:string, error?:string}}
 */
function registrarDecision(texto, porque, alcance, fuente) {
  _soloOwner_('registrarDecision');
  var n = _decisionNormalizar_(texto, porque, alcance, fuente);
  if (!n.ok) return { ok: false, error: n.error };
  if (n.fila.alcance !== DECISION_ALCANCE_SISTEMA && !_satoClienteValido_(n.fila.alcance)) {
    return { ok: false, error: 'alcance_inexistente' };
  }
  var sh = getMaestro().getSheetByName('Decisiones');
  if (!sh) return { ok: false, error: 'falta la hoja Decisiones (correr setup)' };
  return conLock(function () {
    // Idempotencia por (decision, alcance) entre las VIGENTES: registrar dos veces la misma
    // decisión no crea dos verdades. Permite re-correr una siembra sin ensuciar el log.
    var previa = leerTabla(sh).filter(function (f) {
      return String(f.estado) === 'vigente' && String(f.decision) === n.fila.decision &&
             String(f.alcance) === n.fila.alcance;
    })[0];
    if (previa) return { ok: true, id_decision: String(previa.id_decision), ya_estaba: true };
    var id = nextId(sh, 'id_decision', 'DEC', 4);
    n.fila.id_decision = id;
    appendFila(sh, n.fila);
    return { ok: true, id_decision: id };
  });
}

/**
 * Decisiones VIGENTES visibles desde `ctxCliente` ('' = modo sistema, ve todo).
 * Read-only. Las revertidas NO salen: son historia, no marco vigente.
 * @return {Array<{id_decision, fecha, decision, porque, alcance, fuente}>}
 */
function decisionesVigentes(ctxCliente) {
  _soloOwner_('decisionesVigentes');
  var sh = getMaestro().getSheetByName('Decisiones');
  if (!sh) return [];
  return leerTabla(sh)
    .filter(function (f) { return String(f.estado) === 'vigente' && _decisionVisible_(f.alcance, ctxCliente); })
    .map(function (f) {
      return { id_decision: String(f.id_decision), fecha: String(f.fecha), decision: String(f.decision),
               porque: String(f.porque), alcance: String(f.alcance), fuente: String(f.fuente) };
    });
}

/**
 * Revierte una decisión vigente. NO borra: marca estado='revertida' y graba cuándo y por qué.
 * El porqué es obligatorio, igual que al registrarla — una vuelta atrás sin motivo es la misma
 * amnesia que este módulo vino a evitar.
 */
function revertirDecision(idDecision, porque) {
  _soloOwner_('revertirDecision');
  var id = String(idDecision || '').trim();
  var p = limpiarHostilTexto_(String(porque == null ? '' : porque), 600).trim();
  if (!id) return { ok: false, error: 'falta_id' };
  if (!p) return { ok: false, error: 'falta_porque' };
  var sh = getMaestro().getSheetByName('Decisiones');
  if (!sh) return { ok: false, error: 'falta la hoja Decisiones (correr setup)' };
  return conLock(function () {
    var filas = leerTabla(sh);
    var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    for (var i = 0; i < filas.length; i++) {
      if (String(filas[i].id_decision) !== id) continue;
      if (String(filas[i].estado) !== 'vigente') return { ok: false, error: 'no_vigente' };
      var fila = i + 2;   // +1 encabezado, +1 base-1
      sh.getRange(fila, H.indexOf('estado') + 1).setValue('revertida');
      sh.getRange(fila, H.indexOf('revertida_en') + 1).setValue(sanitizarCelda(ahoraISO()));
      sh.getRange(fila, H.indexOf('revertida_porque') + 1).setValue(sanitizarCelda(p));
      return { ok: true, id_decision: id };
    }
    return { ok: false, error: 'no_existe' };
  });
}

/**
 * Siembra la PRIMERA decisión real del log: la del 03-ago 20:30, en la que Luciano reactivó
 * Forge, prompt-caching y A5 adelantando su gatillo. Está redactada en la propia
 * `ADENDA-ENCARGO-TC9-TC11-2026-08-03.md`, que la dejó lista "para el decision log cuando exista".
 *
 * Es idempotente (registrarDecision dedupea por decisión+alcance vigente), así que se puede
 * re-correr sin ensuciar el log — por eso el selfTest la usa como caso de prueba VIVO en vez de
 * un `__TEST__` inventado: se prueba el camino real con el dato real.
 */
function sembrarDecisionInicial() {
  _soloOwner_('sembrarDecisionInicial');
  return registrarDecision(
    'Reactivar Forge lab→prod, prompt-caching (B8d) y A5 vigilancia multi-superficie, adelantando su gatillo.',
    'Completar el Plan Integral ahora. Cowork marcó el riesgo de verde falso y se mitigó por diseño: ' +
      'gris-sin-datos en A5, mecanismo-sin-encender en Forge, telemetría-sin-inflar en caching. ' +
      'El resto de los diferidos (D9, D10, VPS, Lift, B8, os@, Telegram) conserva su gatillo.',
    DECISION_ALCANCE_SISTEMA,
    'ADENDA-ENCARGO-TC9-TC11-2026-08-03.md'
  );
}
