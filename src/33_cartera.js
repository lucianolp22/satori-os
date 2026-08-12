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
  // Ya en el OS: se marca la etapa y —si está vacía— la próxima acción. NUNCA se toca `estado`,
  // ni el conector, ni ninguna otra columna. MesaQuince es el caso que obliga a esta disciplina:
  // baja a `tibio` en el pipeline pero sigue `estado=activo` con su conector encendido hasta que
  // Luciano decida (cartera §15).
  etapas: [
    { id: 'CLI-001', etapa: 'tibio',  prox: 'Ofrecer SGIC solo — esperando respuesta', nota: 'MesaQuince — esperando respuesta por SGIC. SIN tocar el conector.' },
    { id: 'CLI-002', etapa: 'activo', prox: 'Cerrar propuesta USD 250',                nota: 'Vehemence — piloto, propuesta USD 250 en curso.' },
    { id: 'CLI-003', etapa: 'activo', prox: '',                                        nota: 'LC Travel — SGIC completo + cierre mensual.' },
    { id: 'CLI-004', etapa: 'activo', prox: '',                                        nota: 'DAM Barbers — conector Fresha. (Alex es el dueño: "Alex Barbershop" era el mismo.)' },
    { id: 'CLI-005', etapa: 'tibio',  prox: 'Ofrecer SGIC + consultoría básica — pendiente reunión', nota: 'SIP — potencial, pendiente reunión.' },
    { id: 'CLI-007', etapa: 'activo', prox: '',                                        nota: 'EJF + Figueras Music — UN tenant, dos líneas.' }
  ],
  // Tibios de la cartera que pueden NO estar en el roster. ALTA LIVIANA (decisión de Luciano,
  // 11-ago tarde): fila en el roster con `url_sheet_cliente` VACÍO — el Spreadsheet se crea recién
  // cuando el candidato pasa a caliente/activo, vía `crearCliente` sin el flag.
  //
  // `rubro` VA VACÍO A PROPÓSITO. La cartera v2 no dice a qué se dedica cada uno: dice qué
  // ofrecerles. Poner «SGIC + Web» en `rubro` era el préstamo que T1 hizo por falta de columna, y
  // adivinar el rubro real desde el nombre sería inventar un dato del roster de un cliente. Lo
  // completa Luciano; mientras tanto, vacío es honesto.
  altas: [
    { nombre: 'Pol Train',                      rubro: '', prox: 'Ofrecer App + Web' },
    { nombre: 'Pipol Coffee',                   rubro: '', prox: 'Ofrecer SGIC + consultoría básica + Web' },
    { nombre: 'Nook Coffee',                    rubro: '', prox: 'Ofrecer SGIC + Web' },
    { nombre: 'Alejandro Bono Seguros',         rubro: '', prox: 'Ofrecer SGIC + Web' },
    { nombre: 'Tech Log',                       rubro: '', prox: 'Ofrecer consultoría básica (± SGIC)' },
    { nombre: 'Galgo',                          rubro: '', prox: 'Ofrecer SGIC' },
    { nombre: 'Maravillas Piedras y Minerales', rubro: '', prox: 'Ofrecer SGIC + Web' },
    { nombre: 'Activarte Barcelona',            rubro: '', prox: 'Ofrecer App + SGIC' },
    { nombre: 'Crocante',                       rubro: '', prox: 'Ofrecer SGIC + Web' },
    { nombre: 'Constructora Tullio CBA',        rubro: '', prox: 'Ofrecer SGIC + Web (AR — ojo moneda/jurisdicción)' },
    { nombre: 'Raro Coffee',                    rubro: '', prox: 'Ofrecer SGIC' },
    { nombre: 'Café Sando',                     rubro: '', prox: 'Ofrecer SGIC' },
    { nombre: 'Couleur Café',                   rubro: '', prox: 'Ofrecer SGIC' },
    { nombre: 'Oxaca Badalona',                 rubro: '', prox: 'Ofrecer SGIC' }
  ]
};

/**
 * Escribe UNA celda de UNA fila del roster. Privada: el camino público es `moverEtapaComercial`,
 * que valida antes. Devuelve el valor viejo para que el llamador pueda LOGUEAR qué pisó — un
 * cambio de etapa sin rastro de qué había antes es un dato perdido.
 */
function _setColumnaCliente_(sh, fila, columna, valor) {
  var mapa = {}; mapa[columna] = valor;
  return _setColumnasCliente_(sh, fila, mapa)[columna];
}

/**
 * Escribe VARIAS celdas de UNA fila leyendo los headers UNA sola vez. `moverEtapaComercial` toca
 * dos columnas por movimiento (`etapa_comercial` + `etapa_desde`) y el seed hasta tres por fila:
 * un header-read por celda era I/O regalado.
 *
 * @return {Object} { columna: valorViejo } — para poder LOGUEAR qué se pisó.
 */
function _setColumnasCliente_(sh, fila, mapa) {
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var viejos = {};
  Object.keys(mapa).forEach(function (columna) {
    var ix = H.indexOf(columna);
    // Fail-closed: si la columna no existe, la migración (`setup()`) no corrió. Escribir a ciegas
    // en `ix+1 === 0` reventaría o —peor— pisaría otra columna.
    if (ix < 0) throw new Error('la columna `' + columna + '` no existe en Clientes: corré setup() primero');
    viejos[columna] = String(fila[columna] == null ? '' : fila[columna]);
    sh.getRange(fila._fila, ix + 1).setValue(sanitizarCelda(mapa[columna]));
  });
  return viejos;
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

  var hoy = hoyISO();

  // ── 1. Etapa de los que YA están. `etapa_comercial` + `etapa_desde` (marcar etapa ES un
  //    movimiento: sin fecha, los días-en-etapa arrancarían en blanco para toda la cartera vieja)
  //    + `prox_accion` SOLO si está vacía — el seed no pisa lo que Luciano ya escribió. ──
  CARTERA_SEED_2026_08_11.etapas.forEach(function (e) {
    var fila = porId[e.id];
    if (!fila) { plan.no_encontrados.push(e.id + ' (' + e.nota + ')'); return; }
    var actual = String(fila.etapa_comercial || '');
    var proxNueva = (e.prox && !String(fila.prox_accion || '').trim()) ? e.prox : '';
    if (actual === e.etapa && !proxNueva) { plan.sin_cambio.push(e.id + '=' + e.etapa); return; }
    plan.etapas.push({ id: e.id, nombre: fila.nombre, de: actual || '(vacía)', a: e.etapa, prox: proxNueva, nota: e.nota });
    if (!aplicar) return;
    try {
      var mapa = {};
      if (actual !== e.etapa) { mapa.etapa_comercial = e.etapa; mapa.etapa_desde = hoy; }
      if (proxNueva) mapa.prox_accion = proxNueva;
      _setColumnasCliente_(sh, fila, mapa);
    } catch (x) { plan.errores.push(e.id + ': ' + ((x && x.message) || x)); }
  });

  // ── 2. Altas de tibios · ALTA LIVIANA (`sinSheet:true`). Fila en el roster y NADA en Drive: un
  //    prospecto no necesita Sheet hasta que compra. Cuando pase a caliente/activo, el alta real
  //    es `crearCliente` sin el flag — y `moverEtapaComercial` lo recuerda con un aviso. ──
  CARTERA_SEED_2026_08_11.altas.forEach(function (a) {
    var ya = porNombre[String(a.nombre).toLowerCase()];
    if (ya) { plan.sin_cambio.push('"' + a.nombre + '" ya existe como ' + ya.id_cliente); return; }
    plan.altas.push({ nombre: a.nombre, rubro: a.rubro, prox: a.prox, estado: 'potencial', etapa: 'tibio', sin_sheet: true });
    if (!aplicar) return;
    try {
      var r = crearCliente({ nombre: a.nombre, rubro: a.rubro, estado: 'potencial', sinSheet: true });
      // Relectura FRESCA: `crearCliente` appendeó por su cuenta y la tabla que leímos arriba no
      // ve esa fila (open-after-write). Sin esto, `_fila` apuntaría a la fila equivocada.
      var nueva = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === String(r.id_cliente); })[0];
      if (nueva) _setColumnasCliente_(sh, nueva, { etapa_comercial: 'tibio', etapa_desde: hoy, prox_accion: a.prox || '' });
      plan.altas[plan.altas.length - 1].id_cliente = r.id_cliente;
      plan.altas[plan.altas.length - 1].ya_existia = r.ya_existia;
      plan.altas[plan.altas.length - 1].sin_sheet = r.sin_sheet === true;
    } catch (x) { plan.errores.push('alta "' + a.nombre + '": ' + ((x && x.message) || x)); }
  });

  var res = 'seedCartera [' + plan.modo + ']\n' +
    '  etapas a marcar: ' + plan.etapas.length + (plan.etapas.length ? '\n' + plan.etapas.map(function (x) { return '    · ' + x.id + ' "' + x.nombre + '" ' + x.de + ' → ' + x.a + (x.prox ? '   [prox: ' + x.prox + ']' : '') + '   ' + x.nota; }).join('\n') : '') + '\n' +
    '  ALTAS LIVIANAS (fila en el roster, SIN Spreadsheet en Drive): ' + plan.altas.length + (plan.altas.length ? '\n' + plan.altas.map(function (x) { return '    · "' + x.nombre + '" → potencial/tibio · rubro: ' + (x.rubro || '(vacío — lo completa Luciano)') + ' · prox: ' + (x.prox || '—') + (x.id_cliente ? '  ⇒ ' + x.id_cliente : ''); }).join('\n') : '') + '\n' +
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
  var hoy = hoyISO();
  var cols = {}, sinEtapa = [];
  ETAPAS_COMERCIALES.forEach(function (e) { cols[e] = []; });
  filas.forEach(function (c) {
    // CLI-000 es el tenant de sistema (Oficina Virtual), no un cliente comercial: fuera del embudo.
    if (String(c.id_cliente) === 'CLI-000') return;
    // T1.e: `dias_etapa` se computa ACÁ y no en el front. Es la misma razón de siempre — la zona
    // horaria del navegador no es la del Sheet, y dos relojes distintos dan dos números distintos
    // para el mismo dato. Sin `etapa_desde` es `null`, no 0: «no sé» y «hoy» no son lo mismo.
    var desde = aFechaISO(c.etapa_desde);
    var card = { id_cliente: String(c.id_cliente), nombre: String(c.nombre || ''),
                 rubro: String(c.rubro || ''), estado: String(c.estado || ''),
                 logo_url: String(c.logo_url || ''), etapa: String(c.etapa_comercial || ''),
                 prox_accion: String(c.prox_accion || ''), prox_accion_fecha: aFechaISO(c.prox_accion_fecha),
                 etapa_desde: desde, dias_etapa: desde ? _diasEntreISO_(desde, hoy) : null,
                 // Alta liviana: la card lo DICE. Un prospecto sin Sheet es un estado legítimo,
                 // pero uno en `caliente`/`activo` sin Sheet es un alta a medio hacer.
                 sin_sheet: !String(c.url_sheet_cliente || '').trim() };
    if (cols[card.etapa]) cols[card.etapa].push(card); else sinEtapa.push(card);
  });
  return { etapas: ETAPAS_COMERCIALES, columnas: cols, sin_etapa: sinEtapa, hoy: hoy,
           total: filas.length, migrada: filas.length === 0 || filas[0].hasOwnProperty('etapa_comercial') };
}

/** PURA — días calendario entre dos ISO (yyyy-MM-dd). Negativo si `b` es anterior a `a`. */
function _diasEntreISO_(a, b) {
  var pa = String(a).split('-'), pb = String(b).split('-');
  if (pa.length !== 3 || pb.length !== 3) return null;
  var ma = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), mb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
  if (isNaN(ma) || isNaN(mb)) return null;
  return Math.round((mb - ma) / 864e5);
}

/**
 * PURA — la señal pasiva del pipeline para el brief de sistema (sección métricas). UNA línea, y
 * solo si hay `prox_accion_fecha` VENCIDA. Nada más automático: nivel 0, el OS muestra y Luciano
 * mueve — un pipeline que persigue solo se vuelve ruido y se ignora a la semana.
 *
 * Devuelve `[]` cuando no hay vencidas: el brief no gana nada con una línea que dice «todo bien».
 * Mismo patrón que `_vigLineasBrief_` (29_vigilancia.js): pura, testeable offline, sin I/O.
 *
 * @param {Array} filas  roster ya leído (el brief NO hace una lectura extra por esto)
 * @param {string} hoy   ISO yyyy-MM-dd
 */
function _carteraLineasBrief_(filas, hoy) {
  var venc = (filas || []).filter(function (c) {
    if (String(c.id_cliente) === 'CLI-000') return false;
    var f = aFechaISO(c.prox_accion_fecha);
    return !!f && f < String(hoy);
  }).sort(function (a, b) { return aFechaISO(a.prox_accion_fecha) < aFechaISO(b.prox_accion_fecha) ? -1 : 1; });
  if (!venc.length) return [];
  // Se nombran las 3 más viejas y se dice cuántas quedaron afuera: un recorte mudo se lee como
  // lista completa (misma disciplina que el `+N sin mostrar` de la vigilancia).
  var det = venc.slice(0, 3).map(function (c) {
    return String(c.id_cliente) + ' "' + String(c.nombre || '') + '" ' +
           (String(c.prox_accion || '').trim() || '(sin acción escrita)') +
           ' — vencía ' + aFechaISO(c.prox_accion_fecha);
  });
  return ['- Cartera: ' + venc.length + ' próxima(s) acción(es) VENCIDA(s) → ' + det.join(' · ') +
          (venc.length > 3 ? ' · +' + (venc.length - 3) + ' más — ver la vista Cartera.' : '')];
}

/**
 * Mueve UN cliente de etapa. Update de UNA celda del roster — no hay hoja de pipeline.
 *
 * AISLAMIENTO §3 ("el id lo pone el sistema, no el modelo"): el `id_cliente` llega del front y por
 * eso se valida contra el roster REAL antes de escribir. Un id que no está en la cartera no se
 * consulta ni se crea: se rechaza con motivo. Y la etapa se valida contra `ETAPAS_COMERCIALES`:
 * una etapa inventada no entra a la hoja, porque después la vista no sabría dónde pintarla.
 *
 * T1.e: cada movimiento sella `etapa_desde` con la fecha de HOY. De ahí salen los días-en-etapa
 * de la card — un tibio que lleva 90 días quieto es la señal que el embudo tiene que dar.
 *
 * @return {{ok:boolean, id_cliente?:string, de?:string, a?:string, desde?:string, aviso?:string, error?:string}}
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
    var hoy = hoyISO();
    var viejos = _setColumnasCliente_(sh, fila, { etapa_comercial: e, etapa_desde: hoy });
    var viejo = viejos.etapa_comercial;
    // El movimiento queda en Actividad: mover de etapa es una decisión comercial, y una decisión
    // sin rastro de cuándo se tomó no se puede revisar después.
    try { feed_('Cartera', 'cartera', id, 'Etapa comercial: ' + (viejo || '(vacía)') + ' → ' + (e || '(vacía)')); } catch (_f) {}
    // ALTA LIVIANA — el recordatorio. Un tibio sin Sheet está bien; un caliente/activo sin Sheet
    // es un alta a medio hacer: no tiene dónde vivir ni un dato, y el sync/vigilancia lo van a
    // saltear en silencio para siempre. Se AVISA (el movimiento sí ocurre: el que decide es Luciano).
    var aviso = '';
    if (['caliente', 'activo'].indexOf(e) >= 0 && !String(fila.url_sheet_cliente || '').trim()) {
      aviso = 'Falta el alta real: ' + id + ' no tiene Sheet de cliente. Corré crearCliente para que el OS pueda leerle datos.';
    }
    return { ok: true, id_cliente: id, de: viejo, a: e, desde: hoy, aviso: aviso };
  });
}
