/**
 * 33_cartera.js — PIPELINE COMERCIAL (E1, 11-ago-2026).
 *
 * QUÉ ES: la cartera no vivía en el OS. Vivía en un .md que Luciano dictaba y que se
 * desactualizaba solo. Acá el roster del MAESTRO pasa a ser la fuente: `etapa_comercial` dice
 * dónde está cada cliente en el embudo, y la vista Cartera del CM lo muestra.
 *
 * QUÉ NO ES: una hoja nueva. Regla multi-vista de BLOQUE 4 — toda vista es filtro/orden/render
 * sobre la MISMA hoja, jamás una copia del dato. La vista Cartera lee `Clientes` y nada más.
 *
 * NIVEL 0 (escalera de maduración): el OS muestra, Luciano mueve. Nada avanza de etapa solo.
 */

/**
 * Foto de la cartera dictada el 11-ago-2026 (`CARTERA-COMERCIAL-SATORI-2026-08-11.md` v2).
 *
 * Es una SEMILLA, no una fuente viva: se aplica una vez y después manda el roster. Está acá y no
 * en la hoja porque el seed tiene que ser auditable en el diff — quién entró, con qué etapa y por
 * qué. Cuando cambie la cartera, se mueve la etapa en el CM; NO se edita esta lista.
 *
 * `nombre` matchea contra el roster case-insensitive (mismo criterio que `crearCliente`), así que
 * un cliente ya cargado con otro id igual se detecta y NO se duplica.
 */
var CARTERA_SEED_2026_08_11 = {
  // Ya en el OS: solo se marca la etapa. NUNCA se toca `estado`, ni el conector, ni ninguna otra
  // columna. MesaQuince es el caso que obliga a esta disciplina: baja a `tibio` en el pipeline
  // pero sigue `estado=activo` con su conector encendido hasta que Luciano decida (cartera §15).
  etapas: [
    { id: 'CLI-001', etapa: 'tibio',  nota: 'MesaQuince — esperando respuesta por SGIC. SIN tocar el conector.' },
    { id: 'CLI-002', etapa: 'activo', nota: 'Vehemence — piloto, propuesta USD 250 en curso.' },
    { id: 'CLI-003', etapa: 'activo', nota: 'LC Travel — SGIC completo + cierre mensual.' },
    { id: 'CLI-004', etapa: 'activo', nota: 'DAM Barbers — conector Fresha. (Alex es el dueño: "Alex Barbershop" era el mismo.)' },
    { id: 'CLI-005', etapa: 'tibio',  nota: 'SIP — potencial, pendiente reunión.' },
    { id: 'CLI-007', etapa: 'activo', nota: 'EJF + Figueras Music — UN tenant, dos líneas.' }
  ],
  // Tibios de la cartera que pueden NO estar en el roster. Se dan de alta `estado=potencial` +
  // `etapa_comercial=tibio`. `crearCliente` es idempotente por nombre: si ya existe, no duplica.
  altas: [
    { nombre: 'Pol Train',                      rubro: 'App + Web' },
    { nombre: 'Pipol Coffee',                   rubro: 'SGIC + consultoría básica + Web' },
    { nombre: 'Nook Coffee',                    rubro: 'SGIC + Web' },
    { nombre: 'Alejandro Bono Seguros',         rubro: 'SGIC + Web' },
    { nombre: 'Tech Log',                       rubro: 'Consultoría básica (± SGIC)' },
    { nombre: 'Galgo',                          rubro: 'SGIC' },
    { nombre: 'Maravillas Piedras y Minerales', rubro: 'SGIC + Web' },
    { nombre: 'Activarte Barcelona',            rubro: 'App + SGIC' },
    { nombre: 'Crocante',                       rubro: 'SGIC + Web' },
    { nombre: 'Constructora Tullio CBA',        rubro: 'SGIC + Web' },
    { nombre: 'Raro Coffee',                    rubro: 'SGIC' },
    { nombre: 'Café Sando',                     rubro: 'SGIC' },
    { nombre: 'Couleur Café',                   rubro: 'SGIC' },
    { nombre: 'Oxaca Badalona',                 rubro: 'SGIC' }
  ]
};

/**
 * Escribe UNA celda de UNA fila del roster. Privada: el camino público es `moverEtapaComercial`,
 * que valida antes. Devuelve el valor viejo para que el llamador pueda LOGUEAR qué pisó — un
 * cambio de etapa sin rastro de qué había antes es un dato perdido.
 */
function _setColumnaCliente_(sh, fila, columna, valor) {
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var ix = H.indexOf(columna);
  // Fail-closed: si la columna no existe, la migración (`setup()`) no corrió. Escribir a ciegas
  // en `ix+1 === 0` reventaría o —peor— pisaría otra columna.
  if (ix < 0) throw new Error('la columna `' + columna + '` no existe en Clientes: corré setup() primero');
  var viejo = String(fila[columna] == null ? '' : fila[columna]);
  sh.getRange(fila._fila, ix + 1).setValue(sanitizarCelda(valor));
  return viejo;
}

/** Etapa válida = una de ETAPAS_COMERCIALES, o vacía (= sin clasificar, estado legítimo). */
function _etapaValida_(e) {
  var s = String(e == null ? '' : e).trim();
  return s === '' || ETAPAS_COMERCIALES.indexOf(s) >= 0;
}

/**
 * Cuerpo compartido del seed. `aplicar=false` NO escribe nada: devuelve exactamente el mismo
 * plan que ejecutaría. Los dos wrappers corren ESTE cuerpo, así que el dry-run no puede
 * divergir de la corrida real (la lección del stub divergente, 24-jul).
 *
 * IDEMPOTENTE: correrlo dos veces no duplica ni reescribe lo que ya está en su valor final.
 */
function _seedCartera_(aplicar) {
  var ss = getMaestro();
  var sh = ss.getSheetByName('Clientes');
  var plan = { modo: aplicar ? 'APLICAR' : 'DRY-RUN', etapas: [], altas: [], sin_cambio: [], no_encontrados: [], errores: [] };

  var roster = leerTabla(sh);
  var porId = {}, porNombre = {};
  roster.forEach(function (c) {
    porId[String(c.id_cliente)] = c;
    porNombre[String(c.nombre).toLowerCase()] = c;
  });

  // ── 1. Etapa de los que YA están. Solo la columna `etapa_comercial`; nada más se toca. ──
  CARTERA_SEED_2026_08_11.etapas.forEach(function (e) {
    var fila = porId[e.id];
    if (!fila) { plan.no_encontrados.push(e.id + ' (' + e.nota + ')'); return; }
    var actual = String(fila.etapa_comercial || '');
    if (actual === e.etapa) { plan.sin_cambio.push(e.id + '=' + e.etapa); return; }
    plan.etapas.push({ id: e.id, nombre: fila.nombre, de: actual || '(vacía)', a: e.etapa, nota: e.nota });
    if (!aplicar) return;
    try { _setColumnaCliente_(sh, fila, 'etapa_comercial', e.etapa); }
    catch (x) { plan.errores.push(e.id + ': ' + ((x && x.message) || x)); }
  });

  // ── 2. Altas de tibios. `crearCliente` CREA UN SPREADSHEET POR CLIENTE: no es una fila, es un
  //    archivo en Drive. Por eso el dry-run existe y por eso el default es dry-run. ──
  CARTERA_SEED_2026_08_11.altas.forEach(function (a) {
    var ya = porNombre[String(a.nombre).toLowerCase()];
    if (ya) { plan.sin_cambio.push('"' + a.nombre + '" ya existe como ' + ya.id_cliente); return; }
    plan.altas.push({ nombre: a.nombre, rubro: a.rubro, estado: 'potencial', etapa: 'tibio' });
    if (!aplicar) return;
    try {
      var r = crearCliente({ nombre: a.nombre, rubro: a.rubro, estado: 'potencial' });
      // Relectura FRESCA: `crearCliente` appendeó por su cuenta y la tabla que leímos arriba no
      // ve esa fila (open-after-write). Sin esto, `_fila` apuntaría a la fila equivocada.
      var nueva = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === String(r.id_cliente); })[0];
      if (nueva) _setColumnaCliente_(sh, nueva, 'etapa_comercial', 'tibio');
      plan.altas[plan.altas.length - 1].id_cliente = r.id_cliente;
      plan.altas[plan.altas.length - 1].ya_existia = r.ya_existia;
    } catch (x) { plan.errores.push('alta "' + a.nombre + '": ' + ((x && x.message) || x)); }
  });

  var res = 'seedCartera [' + plan.modo + ']\n' +
    '  etapas a marcar: ' + plan.etapas.length + (plan.etapas.length ? '\n' + plan.etapas.map(function (x) { return '    · ' + x.id + ' "' + x.nombre + '" ' + x.de + ' → ' + x.a + '   ' + x.nota; }).join('\n') : '') + '\n' +
    '  ALTAS NUEVAS (cada una crea un Spreadsheet en Drive): ' + plan.altas.length + (plan.altas.length ? '\n' + plan.altas.map(function (x) { return '    · "' + x.nombre + '" (' + x.rubro + ') → potencial/tibio' + (x.id_cliente ? '  ⇒ ' + x.id_cliente : ''); }).join('\n') : '') + '\n' +
    '  sin cambio: ' + plan.sin_cambio.length + (plan.sin_cambio.length ? ' → ' + plan.sin_cambio.join(' · ') : '') + '\n' +
    '  ids del seed que NO están en el roster: ' + (plan.no_encontrados.length ? plan.no_encontrados.join(' · ') : 'ninguno') + '\n' +
    '  errores: ' + (plan.errores.length ? plan.errores.join(' · ') : 'ninguno');
  Logger.log(res);
  plan.resumen = res;
  return plan;
}

/**
 * SEED · DRY-RUN (default a propósito). Dice qué haría y NO toca nada.
 * Sin argumentos y sin `_` final: sale en el desplegable del editor (regla dura 04-ago).
 */
function seedCartera2026_08_11() {
  _soloOwner_('seedCartera2026_08_11');
  return _seedCartera_(false);
}

/**
 * SEED · APLICAR. Corre lo mismo que el dry-run pero escribiendo.
 * Wrapper aparte en vez de un argumento porque el desplegable del editor corre sin argumentos:
 * un `seedCartera(aplicar)` llamado desde ahí recibiría `undefined` y aplicaría o no por azar
 * (el incidente `selfTestTramo(n)` del 04-ago, tercera vez de la misma clase).
 */
function seedCartera2026_08_11Aplicar() {
  _soloOwner_('seedCartera2026_08_11Aplicar');
  return _seedCartera_(true);
}

/**
 * Roster agrupado por etapa para la vista Cartera del CM. Solo lectura, sin datos sensibles
 * (ni URLs de Sheets de cliente: la vista no las necesita y exponerlas amplía la superficie).
 *
 * Las columnas salen de `ETAPAS_COMERCIALES` — si mañana se agrega una etapa, la vista la pinta
 * sola. Los clientes sin clasificar viajan en `sin_etapa`: son visibles, no invisibles.
 */
function carteraPipeline() {
  _soloOwner_('carteraPipeline');
  var filas = leerTabla(getMaestro().getSheetByName('Clientes'));
  var cols = {}, sinEtapa = [];
  ETAPAS_COMERCIALES.forEach(function (e) { cols[e] = []; });
  filas.forEach(function (c) {
    // CLI-000 es el tenant de sistema (Oficina Virtual), no un cliente comercial: fuera del embudo.
    if (String(c.id_cliente) === 'CLI-000') return;
    var card = { id_cliente: String(c.id_cliente), nombre: String(c.nombre || ''),
                 rubro: String(c.rubro || ''), estado: String(c.estado || ''),
                 logo_url: String(c.logo_url || ''), etapa: String(c.etapa_comercial || '') };
    if (cols[card.etapa]) cols[card.etapa].push(card); else sinEtapa.push(card);
  });
  return { etapas: ETAPAS_COMERCIALES, columnas: cols, sin_etapa: sinEtapa,
           total: filas.length, migrada: filas.length === 0 || filas[0].hasOwnProperty('etapa_comercial') };
}

/**
 * Mueve UN cliente de etapa. Update de UNA celda del roster — no hay hoja de pipeline.
 *
 * AISLAMIENTO §3 ("el id lo pone el sistema, no el modelo"): el `id_cliente` llega del front y por
 * eso se valida contra el roster REAL antes de escribir. Un id que no está en la cartera no se
 * consulta ni se crea: se rechaza con motivo. Y la etapa se valida contra `ETAPAS_COMERCIALES`:
 * una etapa inventada no entra a la hoja, porque después la vista no sabría dónde pintarla.
 *
 * @return {{ok:boolean, id_cliente?:string, de?:string, a?:string, error?:string}}
 */
function moverEtapaComercial(idCliente, etapa) {
  _soloOwner_('moverEtapaComercial');
  var id = String(idCliente == null ? '' : idCliente).trim();
  var e = String(etapa == null ? '' : etapa).trim();
  if (!id) return { ok: false, error: 'falta id_cliente' };
  if (!_etapaValida_(e)) return { ok: false, error: 'etapa fuera del enum: ' + JSON.stringify(e) };
  return conLock(function () {
    var sh = getMaestro().getSheetByName('Clientes');
    var fila = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === id; })[0];
    if (!fila) return { ok: false, error: 'id_cliente fuera del roster: ' + id };
    var viejo = _setColumnaCliente_(sh, fila, 'etapa_comercial', e);
    // El movimiento queda en Actividad: mover de etapa es una decisión comercial, y una decisión
    // sin rastro de cuándo se tomó no se puede revisar después.
    try { feed_('Cartera', 'cartera', id, 'Etapa comercial: ' + (viejo || '(vacía)') + ' → ' + (e || '(vacía)')); } catch (_f) {}
    return { ok: true, id_cliente: id, de: viejo, a: e };
  });
}
