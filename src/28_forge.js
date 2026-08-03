/**
 * 28_forge.js — FORGE (TC-9 · adenda 03-ago). Promoción laboratorio → producción de agentes.
 *
 * QUÉ RESUELVE: hasta hoy, encender un agente del laboratorio era editar `13_agentes.js`
 * (`activo:false` → `true`) y hacer `clasp push`. O sea: una decisión de privilegio se tomaba
 * editando código, sin registro, sin prueba previa y sin forma de revertirla en caliente.
 *
 * CÓMO QUEDA: el estado vive en DATOS (`Agentes_estado`, ver `agenteEfectivo_` en 13_agentes.js) y
 * el camino para cambiarlo es asimétrico A PROPÓSITO:
 *
 *   PROMOVER  → NUNCA activa directo. Corre un test-gate, crea una APROBACIÓN default-deny con el
 *               resultado del test ADJUNTO y visible, y ahí se detiene. Activa solo si Luciano
 *               aprueba. Un test-gate FALLIDO no bloquea la creación de la aprobación: la crea con
 *               el veredicto adverso a la vista y la recomendación de NO aprobar. Esconder un test
 *               fallido sería peor que no tener test — dejaría creer que nadie lo probó.
 *   DEMOVER   → inmediato, sin aprobación, sin test. Apagar SIEMPRE se puede (filosofía kill
 *               switch). Cualquier fricción para apagar es fricción en el peor momento posible.
 *
 * ⚠ REGLA DURA DE LA TANDA (adenda): FORGE CONSTRUIDO ≠ AGENTES ENCENDIDOS. Esta tanda entrega el
 * MECANISMO, probado con un agente `__TEST__`. NINGÚN agente del laboratorio se promueve acá:
 * Lift y los otros siete conservan su gatillo. La única forma de encender uno es que Luciano
 * apruebe su aprobación, a mano, después de leer el test-gate.
 */

/** Vocabulario cerrado de `status` que un runner puede devolver. Contrato, no criterio. */
var FORGE_STATUS_VALIDOS = ['ok', 'error', 'esperando_aprobacion', 'sin_datos'];

/**
 * Marcas de slop: lo que delata a un modelo que no produjo nada útil. Se mira la FORMA, nunca el
 * contenido — igual que el piso determinístico de evals (`_evalEstructuraClasificacion_`): qué
 * dijo el agente es criterio; que haya dicho algo con forma de respuesta es contrato.
 */
var FORGE_SLOP = [
  /como (modelo|IA) de lenguaje/i,
  /no (puedo|tengo acceso|estoy en condiciones)/i,
  /lo siento,? (pero )?no/i,
  /\[(insertar|completar|tu texto|placeholder)\]/i,
  /lorem ipsum/i
];

/**
 * ¿La salida de un runner tiene forma de respuesta útil? PURO.
 * @return {{ok:boolean, motivos:Array<string>}}
 */
function _forgeSlop_(salida) {
  var m = [];
  if (!salida || typeof salida !== 'object') return { ok: false, motivos: ['el runner no devolvió un objeto'] };
  var st = String(salida.status || '');
  if (FORGE_STATUS_VALIDOS.indexOf(st) < 0) m.push('status fuera del vocabulario: "' + st + '"');
  var det = String(salida.detalle == null ? '' : salida.detalle).trim();
  if (!det) m.push('detalle vacío (una respuesta sin contenido no es una respuesta)');
  else if (det.length < 12) m.push('detalle demasiado corto (' + det.length + ' chars)');
  FORGE_SLOP.forEach(function (re) { if (re.test(det)) m.push('marca de slop: ' + re.source.slice(0, 30)); });
  return { ok: !m.length, motivos: m };
}

/**
 * Test-gate DETERMINÍSTICO (0 API, 0 Sheets de cliente). Lo que se puede saber sin gastar nada.
 * @return {{ok:boolean, checks:Array<{check:string, ok:boolean, detalle:string}>}}
 */
function _forgeTestGateDet_(clave) {
  var checks = [];
  function add(n, ok, det) { checks.push({ check: n, ok: !!ok, detalle: det || '' }); }
  var base = AGENTES[clave];
  add('existe_en_roster', !!base, base ? '' : 'la clave no está en el roster del código — los datos no pueden inventar un agente');
  if (base) {
    var ef = agenteEfectivo_(clave);
    add('tiene_runner', !!RUNNERS[clave], RUNNERS[clave] ? '' : 'no hay runner implementado: promoverlo lo dejaría fallando en cada corrida');
    add('no_esta_activo_ya', !ef.activo, ef.activo ? 'ya está activo (nada que promover)' : '');
    add('cupo_sano', ef.maxDia > 0 && ef.maxDia <= 48, 'maxDia=' + ef.maxDia);
    add('tiene_nombre_y_rol', !!base.nombre && !!base.rol, '');
  }
  return { ok: checks.every(function (c) { return c.ok; }), checks: checks };
}

/**
 * Test-gate COMPLETO. La parte determinística corre siempre; el dry-run contra el runner real
 * solo con `opts.conApi` (gasta API y toca un Sheet `__TEST__`).
 *
 * HONESTIDAD: cuando el dry-run NO corre, se DECLARA (`salida_probada:false`). Un test-gate que
 * dice "ok" sin haber ejecutado nada sería exactamente el verde falso que la adenda prohíbe.
 *
 * @param {string} clave
 * @param {Object} [opts] { conApi?:boolean, idClientePrueba?:string }
 */
function _forgeTestGate_(clave, opts) {
  opts = opts || {};
  var det = _forgeTestGateDet_(clave);
  var out = { ok: det.ok, checks: det.checks.slice(), salida_probada: false, salida: null };
  if (!det.ok) { out.veredicto = 'FALLÓ en los chequeos determinísticos'; return out; }
  if (!opts.conApi || !opts.idClientePrueba) {
    out.veredicto = 'chequeos determinísticos OK · la SALIDA del agente no se probó (hace falta conApi + un cliente __TEST__)';
    return out;
  }
  try {
    var salida = RUNNERS[clave](opts.idClientePrueba, { pregunta: '__TEST__ prueba de promoción Forge' }, '');
    var slop = _forgeSlop_(salida);
    out.salida_probada = true;
    out.salida = { status: (salida || {}).status || '', detalle: String((salida || {}).detalle || '').slice(0, 300) };
    out.checks.push({ check: 'salida_sin_slop', ok: slop.ok, detalle: slop.motivos.join(' · ') });
    out.ok = slop.ok;
    out.veredicto = slop.ok ? 'dry-run OK: la salida tiene forma de respuesta útil'
                            : ('dry-run RECHAZADO: ' + slop.motivos.join(' · '));
  } catch (e) {
    out.salida_probada = true;
    out.checks.push({ check: 'dry_run_sin_excepcion', ok: false, detalle: String((e && e.message) || e) });
    out.ok = false;
    out.veredicto = 'el dry-run tiró una excepción: ' + ((e && e.message) || e);
  }
  return out;
}

/**
 * Promueve un agente de laboratorio a producción. NO lo activa: crea la aprobación default-deny.
 * @param {string} clave
 * @param {Object} [opts] { notas?:string, conApi?:boolean, idClientePrueba?:string }
 * @return {{ok:boolean, aprobacion_id?:string, test_gate?:Object, error?:string}}
 */
function promoverAgente(clave, opts) {
  _soloOwner_('promoverAgente');
  opts = opts || {};
  clave = String(clave || '').trim();
  if (!AGENTES[clave]) return { ok: false, error: 'agente_desconocido', detalle: 'la clave no está en el roster del código' };

  // La matriz de riesgo decide si esta clase de acción puede siquiera proponerse. `con_aprobacion`
  // es true porque lo que se está creando ES la aprobación: el modo 'aprobar' es justamente esto.
  var g = gateRiesgo_('promover_agente', { con_aprobacion: true, detalle: clave });
  if (!g.ok) return { ok: false, error: g.error, modo: g.modo,
                      detalle: 'la matriz de riesgo tiene promover_agente=' + g.modo + ' (se cambia en Config: riesgo_promover_agente)' };

  var tg = _forgeTestGate_(clave, opts);
  var ef = agenteEfectivo_(clave);
  // El test-gate NO decide: informa. Una aprobación con veredicto adverso se crea IGUAL, con el
  // resultado a la vista — esconderla dejaría creer que nadie lo probó.
  var desc = 'Promover el agente ' + ef.nombre + ' (' + clave + ') de laboratorio a producción. ' +
             'TEST-GATE: ' + (tg.ok ? 'PASÓ' : 'FALLÓ') + ' — ' + tg.veredicto +
             (tg.salida_probada ? '' : ' [la salida del agente NO se ejecutó en esta prueba]') +
             '. RECOMENDACIÓN: ' + (tg.ok ? 'revisar y decidir.' : 'NO APROBAR hasta resolver lo de arriba.');

  var apr = crearAprobacion(SATO_TENANT_SISTEMA, 'forge', 'promover_agente',
    { id_agente: clave, activo: true, test_gate: tg, notas: String(opts.notas || '') },
    { descripcion: desc, confianza: tg.ok ? 70 : 10 });

  feed_('Forge', 'aprobacion', '', 'Promoción de ' + ef.nombre + ' propuesta. Test-gate: ' +
        (tg.ok ? 'PASÓ' : 'FALLÓ') + '. Requiere aprobación [' + apr.id + '].', '', apr.id);
  return { ok: true, aprobacion_id: apr.id, test_gate: tg, activado: false,
           nota: 'La promoción NO está aplicada: se aplica cuando la aprobación se apruebe y ejecute.' };
}

/**
 * Apaga un agente YA. Sin aprobación, sin test, sin ceremonia: apagar siempre se puede.
 * Sirve tanto para desactivar un promovido como para frenar uno de los activos de piloto.
 */
function demoverAgente(clave, motivo) {
  _soloOwner_('demoverAgente');
  clave = String(clave || '').trim();
  if (!AGENTES[clave]) return { ok: false, error: 'agente_desconocido' };
  var r = _forgeEstadoUpsert_(clave, { activo: false, notas: 'DEMOVIDO: ' + String(motivo || 'sin motivo') });
  feed_('Forge', 'info', '', AGENTES[clave].nombre + ' APAGADO (' + String(motivo || 'sin motivo') + ').', '', '');
  return { ok: true, id_agente: clave, activo: false, fila: r.fila };
}

/**
 * Escribe (upsert) el estado de un agente en `Agentes_estado`. Privado: el único camino para
 * ENCENDER es la aprobación ejecutada; el único para apagar es `demoverAgente`.
 */
function _forgeEstadoUpsert_(clave, campos) {
  var sh = getMaestro().getSheetByName('Agentes_estado');
  if (!sh) throw new Error('falta la hoja Agentes_estado (correr setup)');
  return conLock(function () {
    var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var filas = leerTabla(sh);
    var fila = { id_agente: clave, activo: String(!!campos.activo), gate: String(AGENTES[clave].gate),
                 max_dia: (campos.max_dia == null ? AGENTES[clave].maxDia : campos.max_dia),
                 promovido_en: ahoraISO(), promovido_por: (campos.por || 'owner'),
                 notas: String(campos.notas || '') };
    for (var i = 0; i < filas.length; i++) {
      if (String(filas[i].id_agente) !== clave) continue;
      Object.keys(fila).forEach(function (k) {
        var ix = H.indexOf(k);
        if (ix >= 0) sh.getRange(i + 2, ix + 1).setValue(sanitizarCelda(fila[k]));
      });
      _AGENTES_EFECTIVO_ = null;   // el cache de esta ejecución quedó viejo
      return { fila: i + 2, creado: false };
    }
    appendFila(sh, fila);
    _AGENTES_EFECTIVO_ = null;
    return { fila: sh.getLastRow(), creado: true };
  });
}

/**
 * Ejecutor de la aprobación `promover_agente` (lo llama `ejecutarAprobada`). ACÁ y solo acá se
 * enciende un agente, y solo con una aprobación ya aprobada por un humano.
 */
function _forgeAplicarPromocion_(payload) {
  var clave = String((payload || {}).id_agente || '').trim();
  if (!AGENTES[clave]) return { ok: false, error: 'agente_desconocido' };
  // Segunda pasada de la matriz: entre que se propuso y se aprobó, la política pudo cambiar.
  var g = gateRiesgo_('promover_agente', { con_aprobacion: true, detalle: clave });
  if (!g.ok) return { ok: false, error: g.error, detalle: 'la matriz de riesgo ahora tiene promover_agente=' + g.modo };
  var r = _forgeEstadoUpsert_(clave, { activo: true, notas: 'Promovido vía aprobación' });
  feed_('Forge', 'ok', '', AGENTES[clave].nombre + ' PROMOVIDO a producción (aprobación ejecutada).', '', '');
  return { ok: true, id_agente: clave, activo: true, fila: r.fila };
}

/**
 * Estado de TODOS los agentes: default del código vs. override vigente. Read-only, para el CM y
 * para diagnóstico. Muestra las dos capas por separado a propósito: ver solo el efectivo esconde
 * si algo está encendido por código o por una decisión registrada.
 */
function agentesEstado() {
  _soloOwner_('agentesEstado');
  return Object.keys(AGENTES).map(function (k) {
    var base = AGENTES[k], ef = agenteEfectivo_(k);
    return { id_agente: k, nombre: base.nombre, rol: base.rol,
             default_activo: base.activo, activo: ef.activo,
             promovido: ef.promovido, promovido_en: ef.promovido_en, promovido_por: ef.promovido_por,
             gate: ef.gate, max_dia: ef.maxDia, tiene_runner: !!RUNNERS[k] };
  });
}
