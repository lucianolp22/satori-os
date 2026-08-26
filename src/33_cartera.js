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
/* CRM PRO — umbral y etapas de la señal de frío, en UN solo lugar del backend. El front NO los
   replica: recibe el booleano `frio_sin_contacto` ya juzgado (regla anti-enum-clavado E-c). */
var CARTERA_FRIO_DIAS = 30;
var CARTERA_ETAPAS_CAPTACION = ['frio', 'tibio', 'caliente'];

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
    // CRM PRO · M1: `ultimo_contacto` lo sella el sistema. Vacío ⇒ `dias_sin_contacto: null`
    // («nunca se registró un contacto»), JAMÁS 0 — misma disciplina que `dias_etapa`: «no sé» y
    // «hoy» no son el mismo dato, y un 0 falso apagaría la señal de frío que justamente buscamos.
    var uc = aFechaISO(c.ultimo_contacto);
    var card = { id_cliente: String(c.id_cliente), nombre: String(c.nombre || ''),
                 rubro: String(c.rubro || ''), estado: String(c.estado || ''),
                 logo_url: String(c.logo_url || ''), etapa: String(c.etapa_comercial || ''),
                 prox_accion: String(c.prox_accion || ''), prox_accion_fecha: aFechaISO(c.prox_accion_fecha),
                 etapa_desde: desde, dias_etapa: desde ? _diasEntreISO_(desde, hoy) : null,
                 // Alta liviana: la card lo DICE. Un prospecto sin Sheet es un estado legítimo,
                 // pero uno en `caliente`/`activo` sin Sheet es un alta a medio hacer.
                 sin_sheet: !String(c.url_sheet_cliente || '').trim(),
                 // CRM 25-ago — regla «el siguiente paso siempre existe»: el JUICIO se computa acá
                 // (el enum vive en el backend; el front solo pinta — regla anti-enum-clavado E-c).
                 pide_prox: ['tibio', 'caliente', 'activo'].indexOf(String(c.etapa_comercial || '')) >= 0 &&
                            !String(c.prox_accion || '').trim(),
                 // CRM PRO · M1 (aditivos — el payload viejo queda intacto). Los días se computan
                 // SERVER-SIDE por la misma razón de siempre: el reloj del navegador no es el del Sheet.
                 ultimo_contacto: uc, dias_sin_contacto: uc ? _diasEntreISO_(uc, hoy) : null,
                 // El JUICIO «es un candidato frío» lo emite el BACKEND, no el front (regla
                 // anti-enum-clavado E-c: si el front filtrara por etapa tendría una segunda copia
                 // del enum, y el día que se agregue una etapa la vista la pierde). Mismo criterio
                 // que `_carteraLineasFrio_`: solo captación y solo con sello REAL.
                 frio_sin_contacto: !!uc && CARTERA_ETAPAS_CAPTACION.indexOf(String(c.etapa_comercial || '')) >= 0 &&
                                    _diasEntreISO_(uc, hoy) > CARTERA_FRIO_DIAS,
                 // CRM PRO · S4: TODAS las oportunidades del cliente (se llenan abajo, tras leer
                 // `recurrentes_propios`). Array vacío = sin oportunidades, nunca `undefined`.
                 ops: [],
                 // CRM PRO · M3: semáforo de retención (solo activos). Se llena abajo desde la
                 // vigilancia YA CACHEADA — nunca re-consultando el Sheet del cliente por card.
                 senal_retencion: null,
                 motivo_perdido: limpiarHostilTexto_(String(c.motivo_perdido || ''), 200) };
    if (cols[card.etapa]) cols[card.etapa].push(card); else sinEtapa.push(card);
  });
  // CRM (25-ago) — campos ADITIVOS (el payload viejo queda intacto): foco semanal (pura — el OS
  // propone, Luciano decide) + resumen/props de `recurrentes_propios` (la propuesta viva en la
  // card). La lectura del HQ degrada a null: la cartera jamás se cae por esa hoja.
  var rec = null, props = {}, opsPorCliente = {};   // S4: opsPorCliente = TODAS las oportunidades por cliente
  try {
    var shRec = _hqHoja_('recurrentes_propios');
    if (shRec) {
      rec = { activos: 0, propuestas: 0, por_moneda: {} };
      leerTabla(shRec).forEach(function (f) {
        var est = String(f.estado || '').toLowerCase(), mon = String(f.moneda || '').trim().toUpperCase();
        var imp = Number(f.importe) || 0, idc = String(f.id_cliente || '');
        if (est === 'activo') { rec.activos++; if (mon) rec.por_moneda[mon] = (rec.por_moneda[mon] || 0) + imp; }
        else if (est === 'propuesta') rec.propuestas++;
        // `firmada` viaja como booleano: el front no compara contra el literal del estado
        // (regla anti-enum-clavado E-c — el juicio es del backend).
        if (idc && est === 'activo') props[idc] = { servicio: limpiarHostilTexto_(String(f.servicio || ''), 60), importe: imp, moneda: mon, firmada: true };
        else if (idc && est === 'propuesta' && !props[idc]) props[idc] = { servicio: limpiarHostilTexto_(String(f.servicio || ''), 60), importe: imp, moneda: mon, firmada: false };
        // CRM PRO · S4 — la card vieja mostraba UNA oportunidad (`props[idc]`, la más relevante) y
        // las demás quedaban invisibles: un cliente con 3 propuestas parecía tener 1. Acá se
        // acumulan TODAS; la card sigue usando `props` para el badge (presupuesto de señal: máx 2
        // por card) y la ficha lista `ops` completa. Estados fuera del vocabulario se ignoran.
        if (idc && (est === 'activo' || est === 'propuesta')) {
          (opsPorCliente[idc] = opsPorCliente[idc] || []).push({
            id_rec: String(f.id_rec || ''), servicio: limpiarHostilTexto_(String(f.servicio || ''), 60),
            importe: imp, moneda: mon, estado: est, firmada: est === 'activo'
          });
        }
      });
    }
  } catch (eR) { rec = null; }
  // S4/M3 — segunda pasada: las cards se arman ANTES de leer `recurrentes_propios`/vigilancia, así
  // que los campos que dependen de esas fuentes se enganchan acá. Recorre las mismas cards (no
  // duplica el dato ni rearma el payload) y degrada a [] / null si la fuente no estaba.
  // Ctx de retención: TODO el I/O de M3 en UNA lectura (vigilancia cacheada + Agenda +
  // Proyectos/Tareas). Por card solo corre el juicio puro — §4: nada de abrir Sheets por card.
  var _retCtx = null;
  try { _retCtx = _senalRetencionCtx_(); } catch (_eV) { _retCtx = null; }
  ETAPAS_COMERCIALES.concat(['__sin_etapa__']).forEach(function (e) {
    var arr = (e === '__sin_etapa__') ? sinEtapa : (cols[e] || []);
    arr.forEach(function (card) {
      card.ops = opsPorCliente[card.id_cliente] || [];
      // M3: el semáforo es SOLO para activos. En el resto del embudo no hay nada que retener, y
      // pintar un semáforo gris en un prospecto es ruido que compite con la señal de captación.
      if (card.etapa === 'activo' && _retCtx) card.senal_retencion = _senalRetencion_(card.id_cliente, _retCtx);
    });
  });
  // CRM PRO · M2 — candidatos de correo SIN resolver, para el panel «Correo → CRM». Viajan con
  // la cartera (una sola llamada, una sola fuente) en vez de un endpoint aparte que se
  // desincronice. Hoja LAZY: si no existe todavía ⇒ [] y el panel queda oculto, no roto.
  var correoStaging = [];
  try {
    var shCC = getMaestro().getSheetByName('correo_cliente');
    if (shCC) {
      correoStaging = leerTabla(shCC).filter(function (f) { return String(f.estado) === 'staging'; })
        .map(function (f) {
          return { id_thread: String(f.id_thread), id_cliente: String(f.id_cliente || ''),
                   asunto: String(f.asunto || ''), remitente: String(f.remitente || ''),
                   fecha: aFechaISO(f.fecha_ultimo) || '' };
        });
    }
  } catch (eCC) { correoStaging = []; }
  return { etapas: ETAPAS_COMERCIALES, columnas: cols, sin_etapa: sinEtapa, hoy: hoy,
           correo_staging: correoStaging,
           total: filas.length, migrada: filas.length === 0 || filas[0].hasOwnProperty('etapa_comercial'),
           foco: _carteraFoco_(filas, hoy), recurrentes: rec, props: props };
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
 * CRM PRO · M1 — PURA. Segunda señal del brief: candidatos del embudo FRÍOS por falta de contacto.
 * Se devuelve aparte (array propio) para no tocar la FORMA de `_carteraLineasBrief_`, cuya salida
 * está aserida por largo e índice (lección FORMA-DE-RETORNO, precedente D14g).
 *
 * DOS recortes deliberados, los dos para que la señal no se vuelva ruido:
 *  (1) Solo `frio|tibio|caliente` — un `activo` no es un candidato a empujar (su vínculo lo mira
 *      el semáforo de retención M3), y `perdido`/`en_pausa` están fuera del embudo a propósito.
 *  (2) Solo con `ultimo_contacto` REAL y viejo. Un cliente SIN sello no es "30 días frío": es
 *      "nunca se registró un contacto" — desconocido, no vencido. Contarlo pintaría de rojo a la
 *      cartera entera el día que esto se estrena, que es la forma más rápida de que se ignore.
 */
function _carteraLineasFrio_(filas, hoy, dias) {
  var UMBRAL = Number(dias) > 0 ? Number(dias) : CARTERA_FRIO_DIAS;
  var ETAPAS = CARTERA_ETAPAS_CAPTACION;
  var frios = (filas || []).filter(function (c) {
    if (String(c.id_cliente) === 'CLI-000') return false;
    if (ETAPAS.indexOf(String(c.etapa_comercial || '')) < 0) return false;
    var uc = aFechaISO(c.ultimo_contacto);
    return !!uc && _diasEntreISO_(uc, String(hoy)) > UMBRAL;
  }).sort(function (a, b) { return aFechaISO(a.ultimo_contacto) < aFechaISO(b.ultimo_contacto) ? -1 : 1; });
  if (!frios.length) return [];
  var det = frios.slice(0, 3).map(function (c) {
    return String(c.id_cliente) + ' "' + String(c.nombre || '') + '" — último contacto ' +
           aFechaISO(c.ultimo_contacto) + ' (' + _diasEntreISO_(aFechaISO(c.ultimo_contacto), String(hoy)) + ' días)';
  });
  return ['- Cartera: ' + frios.length + ' candidato(s) +' + UMBRAL + ' días sin contacto → ' + det.join(' · ') +
          (frios.length > 3 ? ' · +' + (frios.length - 3) + ' más — ver la vista Cartera.' : '')];
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
function moverEtapaComercial(idCliente, etapa, motivo) {
  _soloOwner_('moverEtapaComercial');
  var id = String(idCliente == null ? '' : idCliente).trim();
  var e = String(etapa == null ? '' : etapa).trim();
  if (!id) return { ok: false, error: 'falta id_cliente' };
  if (!_etapaValida_(e)) return { ok: false, error: 'etapa fuera del enum: ' + JSON.stringify(e) };
  // CRM PRO · S5 — MOTIVO OBLIGATORIO al perder. El 3er parámetro es ADITIVO y opcional: los
  // llamadores viejos (que mueven a etapas que no son `perdido`) siguen andando sin tocarse.
  // Se rechaza ANTES del lock y con `error` MAQUINABLE ('motivo_requerido'): el front lo lee para
  // abrir el modal. Un cliente que se pierde sin motivo escrito no se puede aprender después.
  var mot = limpiarHostilTexto_(String(motivo == null ? '' : motivo).trim(), 200);
  if (e === 'perdido' && !mot) return { ok: false, error: 'motivo_requerido' };
  return conLock(function () {
    var sh = getMaestro().getSheetByName('Clientes');
    var fila = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === id; })[0];
    if (!fila) return { ok: false, error: 'id_cliente fuera del roster: ' + id };
    var hoy = hoyISO();
    var cambios = { etapa_comercial: e, etapa_desde: hoy };
    if (e === 'perdido') cambios.motivo_perdido = mot;
    var viejos = _setColumnasCliente_(sh, fila, cambios);
    var viejo = viejos.etapa_comercial;
    // M1 — mover de etapa ES un contacto: se sella. Dentro del lock que ya tenemos y con la fila
    // ya leída (conLock NO es reentrante — 07_util.js: "lockear en los callers, nunca anidado").
    try { _sellarContacto_(id, 'etapa:' + e, { sh: sh, fila: fila }); } catch (_s) {}
    // El movimiento queda en Actividad: mover de etapa es una decisión comercial, y una decisión
    // sin rastro de cuándo se tomó no se puede revisar después.
    try { feed_('Cartera', 'cartera', id, 'Etapa comercial: ' + (viejo || '(vacía)') + ' → ' + (e || '(vacía)') +
                (e === 'perdido' ? ' — motivo: ' + mot : '')); } catch (_f) {}
    // ALTA LIVIANA — el recordatorio. Un tibio sin Sheet está bien; un caliente/activo sin Sheet
    // es un alta a medio hacer: no tiene dónde vivir ni un dato, y el sync/vigilancia lo van a
    // saltear en silencio para siempre. Se AVISA (el movimiento sí ocurre: el que decide es Luciano).
    var aviso = '';
    if (['caliente', 'activo'].indexOf(e) >= 0 && !String(fila.url_sheet_cliente || '').trim()) {
      aviso = 'Falta el alta real: ' + id + ' no tiene Sheet de cliente. Corré crearCliente para que el OS pueda leerle datos.';
    }
    return { ok: true, id_cliente: id, de: viejo, a: e, desde: hoy, aviso: aviso,
             motivo_perdido: (e === 'perdido' ? mot : undefined) };
  });
}

/* ══════════════ CRM (25-ago-2026) — próx. acción editable + lazo propuesta→firma + foco ══════════════
 * Handoff CRM 24-ago §4. Gate anti-rollup: cada campo responde «¿qué haría distinto según este
 * número?». Nivel 0 intacto: el OS propone y muestra; mover, registrar y firmar son SIEMPRE
 * decisiones de Luciano. Cero hojas nuevas: `recurrentes_propios` ya existía (E3 HQ). */

/**
 * PURA — foco semanal (cadencia F3: 2 contactos). Prioridad: próx. acción VENCIDA más vieja →
 * caliente sobre tibio → más días quieto en etapa. Excluye CLI-000 y a los que ya son
 * activo/en_pausa/perdido (el foco es para EMPUJAR el embudo, no para los que ya entraron).
 * No escribe nada: el OS propone, Luciano decide (doctrina E1).
 */
function _carteraFoco_(filas, hoy) {
  var cand = (filas || []).filter(function (c) {
    if (String(c.id_cliente) === 'CLI-000') return false;
    return ['tibio', 'caliente'].indexOf(String(c.etapa_comercial || '')) >= 0;
  }).map(function (c) {
    var f = aFechaISO(c.prox_accion_fecha);
    var desde = aFechaISO(c.etapa_desde);
    return { id_cliente: String(c.id_cliente), nombre: String(c.nombre || ''),
             vencida: (f && f < String(hoy)) ? f : '',
             caliente: String(c.etapa_comercial) === 'caliente' ? 1 : 0,
             dias: desde ? (_diasEntreISO_(desde, hoy) || 0) : 0 };
  });
  cand.sort(function (a, b) {
    if (!!a.vencida !== !!b.vencida) return a.vencida ? -1 : 1;
    if (a.vencida && b.vencida && a.vencida !== b.vencida) return a.vencida < b.vencida ? -1 : 1;
    if (a.caliente !== b.caliente) return b.caliente - a.caliente;
    return (b.dias || 0) - (a.dias || 0);
  });
  return cand.slice(0, 2).map(function (c) {
    var motivo = c.vencida ? ('próx. acción vencida el ' + c.vencida)
               : (c.caliente ? 'caliente — el más cerca de la propuesta'
                             : (c.dias || 0) + ' día(s) quieto en tibio');
    return { id_cliente: c.id_cliente, nombre: c.nombre, motivo: motivo };
  });
}

/**
 * Edita la próxima acción (+fecha) de UN cliente del roster. Mismas guardas que
 * `moverEtapaComercial`: id contra el roster REAL, fecha validada, lock, log a Actividad.
 */
function carteraProxAccion(idCliente, texto, fecha) {
  _soloOwner_('carteraProxAccion');
  var id = String(idCliente == null ? '' : idCliente).trim();
  if (!id) return { ok: false, error: 'falta id_cliente' };
  var tx = String(texto == null ? '' : texto).trim().slice(0, 140);
  var fRaw = String(fecha == null ? '' : fecha).trim();
  var f = fRaw ? aFechaISO(fRaw) : '';
  if (fRaw && !f) return { ok: false, error: 'fecha inválida: ' + JSON.stringify(fRaw) + ' (formato yyyy-MM-dd)' };
  return conLock(function () {
    var sh = getMaestro().getSheetByName('Clientes');
    var fila = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === id; })[0];
    if (!fila) return { ok: false, error: 'id_cliente fuera del roster: ' + id };
    _setColumnasCliente_(sh, fila, { prox_accion: tx, prox_accion_fecha: f });
    try { feed_('Cartera', 'cartera', id, 'Próx. acción: ' + (tx || '(vacía)') + (f ? ' · para el ' + f : '')); } catch (_f) {}
    return { ok: true, id_cliente: id, prox_accion: tx, prox_accion_fecha: f };
  });
}

/**
 * Registra una propuesta en `recurrentes_propios` con estado=propuesta — el HQ la muestra
 * ATENUADA y NO la suma (regla E3: una propuesta no es un ingreso). Importe y moneda los pone
 * Luciano; nada se infiere. La nota sella la fecha de registro (de ahí sale el ciclo medido).
 */
function propuestaRegistrar(idCliente, servicio, importe, moneda) {
  _soloOwner_('propuestaRegistrar');
  var id = String(idCliente == null ? '' : idCliente).trim();
  if (!id) return { ok: false, error: 'falta id_cliente' };
  var svc = String(servicio == null ? '' : servicio).trim().slice(0, 80);
  if (!svc) return { ok: false, error: 'falta el servicio' };
  var imp = Number(importe);
  if (!(imp > 0)) return { ok: false, error: 'importe inválido: ' + JSON.stringify(importe) };
  var mon = String(moneda == null ? '' : moneda).trim().toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(mon)) return { ok: false, error: 'moneda inválida (ej: EUR, USD, ARS)' };
  var _res = conLock(function () {
    var fila = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) { return String(c.id_cliente) === id; })[0];
    if (!fila) return { ok: false, error: 'id_cliente fuera del roster: ' + id };
    var sh = _hqHoja_('recurrentes_propios');
    if (!sh) return { ok: false, error: 'schema recurrentes_propios ausente: corré setup()' };
    var max = 0;
    leerTabla(sh).forEach(function (r) { var m = /^REC-(\d+)$/.exec(String(r.id_rec || '')); if (m) max = Math.max(max, +m[1]); });
    var idRec = 'REC-' + ('0000' + (max + 1)).slice(-4);
    var hoy = hoyISO();
    appendFila(sh, { id_rec: idRec, id_cliente: id, cliente: String(fila.nombre || ''), servicio: svc,
                     importe: imp, moneda: mon, estado: 'propuesta', notas: 'registrada ' + hoy });
    try { feed_('Cartera', 'cartera', id, 'Propuesta ' + idRec + ': ' + svc + ' · ' + mon + ' ' + imp + '/mes (estado=propuesta)'); } catch (_f) {}
    return { ok: true, id_rec: idRec, id_cliente: id };
  });
  // M1 — registrar una propuesta ES un contacto. FUERA del `conLock` de arriba a propósito:
  // `conLock` NO es reentrante y esta función trabaja sobre `recurrentes_propios`, no sobre
  // `Clientes`, así que no tiene la fila para pasar por ctx. El sello toma su propio lock.
  // Envuelto en try: que falle el sello no puede tumbar una propuesta ya escrita.
  if (_res && _res.ok) { try { _sellarContacto_(id, 'propuesta'); } catch (_s) {} }
  return _res;
}

/**
 * Firma: la fila pasa a estado=activo → el HQ la suma al subtotal por moneda y
 * `retenciones_formalizadas` se mueve. IDEMPOTENTE: firmar dos veces no re-escribe nada.
 * Ciclo medido: días desde la nota `registrada yyyy-MM-dd` (si está); queda en Actividad.
 * (`_setColumnasCliente_` es genérica: headers + fila._fila — sirve para cualquier hoja.)
 */
function propuestaFirmar(idRec) {
  _soloOwner_('propuestaFirmar');
  var idr = String(idRec == null ? '' : idRec).trim();
  if (!idr) return { ok: false, error: 'falta id_rec' };
  var _resF = conLock(function () {
    var sh = _hqHoja_('recurrentes_propios');
    if (!sh) return { ok: false, error: 'schema recurrentes_propios ausente: corré setup()' };
    var fila = leerTabla(sh).filter(function (r) { return String(r.id_rec) === idr; })[0];
    if (!fila) return { ok: false, error: 'id_rec inexistente: ' + idr };
    if (String(fila.estado || '').toLowerCase() === 'activo') return { ok: true, id_rec: idr, ya_activa: true };
    var hoy = hoyISO(), dias = null;
    var m = /registrada (\d{4}-\d{2}-\d{2})/.exec(String(fila.notas || ''));
    if (m) dias = _diasEntreISO_(m[1], hoy);
    _setColumnasCliente_(sh, fila, { estado: 'activo', notas: (String(fila.notas || '') + ' · firmada ' + hoy).slice(0, 200) });
    try { feed_('Cartera', 'cartera', String(fila.id_cliente || ''), 'Retención FIRMADA ' + idr + (dias != null ? ' · ciclo ' + dias + ' día(s) desde el registro' : '')); } catch (_f) {}
    return { ok: true, id_rec: idr, id_cliente: String(fila.id_cliente || ''), dias_ciclo: dias };
  });
  // M1 — firmar ES un contacto. Fuera del lock por la misma razón que en `propuestaRegistrar`.
  // Solo si la firma efectivamente ocurrió (la función es idempotente: firmar dos veces no
  // re-escribe, y tampoco debe re-sellar como si hubiera habido contacto nuevo).
  if (_resF && _resF.ok && _resF.id_cliente) { try { _sellarContacto_(_resF.id_cliente, 'firma'); } catch (_s) {} }
  return _resF;
}


/* ══════════ CRM PRO (26-ago-2026) — M1 sello de contacto · S6 recontacto · C8 snapshot ══════════ */

/**
 * M1 — sella `ultimo_contacto = hoy` para UN cliente. PRIVADA (la llaman los flujos que SON un
 * contacto: mover de etapa, registrar/firmar propuesta, ingesta de tablero, confirmar thread).
 *
 * IDEMPOTENTE POR DÍA: si ya está sellada con hoy, no escribe ni vuelve a alimentar Actividad —
 * registrar tres veces el mismo día es una sola verdad ("hoy hubo contacto"), y un feed_ por clic
 * convertiría la Actividad en ruido.
 *
 * LOCK (07_util.js: `conLock` NO es reentrante — el `finally` interno le soltaría el lock al de
 * afuera): si el llamador YA tiene el lock, pasa `ctx = {sh, fila}` y acá no se lockea. Sin ctx
 * abre y lockea por su cuenta.
 *
 * @return {{ok:boolean, sellado:boolean, ya?:boolean, fecha?:string, error?:string}}
 */
function _sellarContacto_(idCliente, fuente, ctx) {
  var id = String(idCliente == null ? '' : idCliente).trim();
  if (!id) return { ok: false, sellado: false, error: 'falta id_cliente' };
  var hoy = hoyISO();
  var src = limpiarHostilTexto_(String(fuente || '').trim(), 40) || 'manual';

  function _sellar(sh, fila) {
    if (!fila) return { ok: false, sellado: false, error: 'id_cliente fuera del roster: ' + id };
    if (aFechaISO(fila.ultimo_contacto) === hoy) return { ok: true, sellado: false, ya: true, fecha: hoy };
    _setColumnaCliente_(sh, fila, 'ultimo_contacto', hoy);
    try { feed_('Cartera', 'cartera', id, 'Contacto registrado (' + src + ')'); } catch (_f) {}
    return { ok: true, sellado: true, fecha: hoy };
  }

  if (ctx && ctx.sh && ctx.fila) return _sellar(ctx.sh, ctx.fila);   // el llamador ya tiene el lock
  return conLock(function () {
    var sh = getMaestro().getSheetByName('Clientes');
    var fila = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === id; })[0];
    return _sellar(sh, fila);
  });
}

/**
 * M1 — registrar un contacto A MANO desde la Ficha 360 ("Registrar contacto (hoy)"). Es el
 * envoltorio client-callable del sello: gateado + alta en ENDPOINTS_UI en este mismo commit.
 * AISLAMIENTO §3: el id se valida contra el roster REAL adentro de `_sellarContacto_`.
 */
function carteraRegistrarContacto(idCliente, fuente) {
  _soloOwner_('carteraRegistrarContacto');
  return _sellarContacto_(idCliente, fuente || 'manual');
}

/**
 * S6 — "Perder + recontactar en 90 días". NO inventa un motor de seguimiento: escribe
 * `prox_accion` + `prox_accion_fecha` y deja que el brief EXISTENTE (`_carteraLineasBrief_`, que
 * ya nombra las vencidas) lo reviva solo el día que corresponde. Cero automatismo nuevo.
 *
 * `dias` por defecto 90. Se acota a [1, 3650]: una fecha a 200 años no es un recontacto, es un
 * dato corrupto que después ensucia el brief para siempre.
 */
function carteraRecontacto(idCliente, dias) {
  _soloOwner_('carteraRecontacto');
  var id = String(idCliente == null ? '' : idCliente).trim();
  if (!id) return { ok: false, error: 'falta id_cliente' };
  var d = Math.round(Number(dias));
  if (!isFinite(d) || d <= 0) d = 90;
  d = Math.min(3650, Math.max(1, d));
  return conLock(function () {
    var sh = getMaestro().getSheetByName('Clientes');
    var fila = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === id; })[0];
    if (!fila) return { ok: false, error: 'id_cliente fuera del roster: ' + id };
    var mot = limpiarHostilTexto_(String(fila.motivo_perdido || '').trim(), 120);
    var fecha = _sumarDiasISO_(hoyISO(), d);
    var texto = 'Recontactar' + (mot ? ' — se perdió por: ' + mot : '');
    _setColumnasCliente_(sh, fila, { prox_accion: texto, prox_accion_fecha: fecha });
    try { feed_('Cartera', 'cartera', id, 'Recontacto programado para ' + fecha + (mot ? ' (motivo: ' + mot + ')' : '')); } catch (_f) {}
    return { ok: true, id_cliente: id, prox_accion: texto, prox_accion_fecha: fecha, dias: d };
  });
}

/** PURA — suma días calendario a un ISO (yyyy-MM-dd) y devuelve ISO. UTC a propósito: evita que
 *  el corrimiento de huso mueva la fecha un día (el bug clásico del round-trip de Sheets). */
function _sumarDiasISO_(iso, dias) {
  var p = String(iso || '').slice(0, 10).split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  d.setUTCDate(d.getUTCDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}


/* ══════════ CRM PRO · C8 (26-ago-2026) — SNAPSHOT MENSUAL DE LA CARTERA A .md ══════════
 * "La data siempre exportable": un .md legible fuera del OS, que sobrevive a que el OS no esté.
 * Se arma DESDE `carteraPipeline()` a propósito — si el snapshot recalculara por su cuenta, un día
 * diría algo distinto a la pantalla y no sabríamos cuál miente. Una sola fuente, dos renders.
 */

var PROP_CARTERA_FOLDER_ID = 'CARTERA_FOLDER_ID';
var CARTERA_FOLDER_NOMBRE = 'Satori OS — Cartera';

/**
 * PURA — el .md a partir del payload de `carteraPipeline()`. Sin I/O ⇒ aserible offline.
 * Orden: etapas del enum (no alfabético: el embudo tiene una dirección) y, dentro, por días en
 * etapa descendente — arriba lo más quieto, que es lo que hay que mirar.
 */
function _carteraSnapshotTexto_(pipe, hoy) {
  var p = pipe || {};
  var fecha = String(hoy || p.hoy || '');
  var L = ['# Cartera Satori — snapshot ' + fecha, ''];
  var tot = 0;
  (p.etapas || []).forEach(function (e) { tot += ((p.columnas || {})[e] || []).length; });
  var sinE = (p.sin_etapa || []).length;
  L.push('**' + tot + '** cliente(s) clasificados' + (sinE ? ' · **' + sinE + '** sin etapa' : '') + '.');
  if (p.recurrentes && p.recurrentes.por_moneda) {
    var mon = Object.keys(p.recurrentes.por_moneda).sort().map(function (m) {
      return m + ' ' + p.recurrentes.por_moneda[m];
    });
    // Subtotal POR MONEDA, jamás un total global: sumar EUR con ARS es el bug que ya mordió en el HQ.
    if (mon.length) L.push('Recurrente/mes: ' + mon.join(' · ') + ' (' + p.recurrentes.activos + ' activa/s).');
  }
  L.push('');

  function bloque(titulo, cards) {
    if (!cards || !cards.length) return;
    L.push('## ' + titulo + ' (' + cards.length + ')', '');
    cards.slice().sort(function (a, b) { return (b.dias_etapa || 0) - (a.dias_etapa || 0); }).forEach(function (c) {
      var linea = '- **' + c.id_cliente + '** ' + (c.nombre || '');
      if (c.dias_etapa != null) linea += ' · ' + c.dias_etapa + 'd en etapa';
      // «no sé» ≠ «hoy»: sin sello se DICE, no se pone 0 (misma disciplina que la card).
      linea += ' · último contacto: ' + (c.ultimo_contacto ? c.ultimo_contacto + ' (' + c.dias_sin_contacto + 'd)' : 'sin registro');
      if (c.senal_retencion && c.senal_retencion.nivel) linea += ' · retención: ' + c.senal_retencion.nivel;
      if (c.prox_accion) linea += ' · próx: ' + c.prox_accion + (c.prox_accion_fecha ? ' (' + c.prox_accion_fecha + ')' : '');
      if (c.motivo_perdido) linea += ' · motivo: ' + c.motivo_perdido;
      L.push(linea);
      (c.ops || []).forEach(function (o) {
        L.push('    - ' + (o.firmada ? 'firmada' : 'propuesta') + ': ' + o.servicio + ' — ' + o.moneda + ' ' + o.importe + '/mes');
      });
    });
    L.push('');
  }
  (p.etapas || []).forEach(function (e) { bloque(e, (p.columnas || {})[e]); });
  bloque('sin etapa', p.sin_etapa);
  L.push('---', '_Generado por Satori OS · carteraSnapshotMd_');
  return L.join('\n');
}

/** Carpeta del snapshot: la guardada en Script Properties, o se crea y se guarda (mismo patrón
 *  que `_backupRootFolder_`). Falla blando: sin carpeta el texto igual se devuelve. */
function _carteraFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_CARTERA_FOLDER_ID);
  if (id) {
    var meta = _driveGet_(id, 'id,trashed');
    if (meta.ok && !meta.trashed) return { ok: true, id: String(id) };
  }
  var nueva = _driveCrearCarpeta_(CARTERA_FOLDER_NOMBRE, null);
  if (!nueva.ok) return { ok: false, error: nueva.error };
  props.setProperty(PROP_CARTERA_FOLDER_ID, nueva.id);
  return { ok: true, id: nueva.id, creada: true };
}

/**
 * C8 — genera el .md y lo deja en Drive. SIN ARGUMENTOS (regla del desplegable del editor: las
 * funciones que corre Luciano a mano no reciben nada) y apta para un trigger mensual.
 * Devuelve TAMBIÉN el texto: si Drive falla, el dato no se pierde — se ve en el Registro.
 */
function carteraSnapshotMd() {
  _soloOwner_('carteraSnapshotMd');
  var pipe = carteraPipeline();
  var hoy = hoyISO();
  var texto = _carteraSnapshotTexto_(pipe, hoy);
  var nombre = 'Cartera-Satori-' + hoy + '.md';
  var res = { ok: true, nombre: nombre, chars: texto.length, texto: texto };
  try {
    var f = _carteraFolder_();
    if (!f.ok) { res.drive = null; res.aviso = 'no pude preparar la carpeta: ' + f.error; return res; }
    var file = DriveApp.createFile(nombre, texto, MimeType.PLAIN_TEXT);
    _driveMover_(file.getId(), f.id);
    res.drive = { id: file.getId(), carpeta: f.id, url: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
  } catch (e) {
    res.drive = null;
    res.aviso = 'el .md se generó pero no se pudo guardar en Drive: ' + ((e && e.message) || e);
  }
  return res;
}


/**
 * §2d · ENCAJE KAIROS tildable — write path del `encaje_kairos_4b`. Cuatro criterios del Manual
 * (≥2 años · ventas estables · punto de equilibrio · intención real), cada uno `s` | `n` | `-`.
 *
 * NO ES ML Y EL CÓDIGO NO LO DEDUCE: lo tilda Luciano en la Etapa 2 KAIROS. Este endpoint solo
 * persiste lo que él marcó — por eso valida FORMA (4 chars del vocabulario cerrado) y nada más:
 * no hay «criterio derivado», no hay score, no hay valor por defecto que rellene un `-`.
 *
 * Vocabulario CERRADO validado server-side: un valor fuera de {s,n,-} no entra a la hoja, porque
 * después la ficha no sabría qué LED pintar (misma disciplina que `_etapaValida_`).
 *
 * @return {{ok:boolean, id_cliente?:string, encaje_kairos_4b?:string, error?:string}}
 */
function carteraEncajeKairos(idCliente, valor) {
  _soloOwner_('carteraEncajeKairos');
  var id = String(idCliente == null ? '' : idCliente).trim();
  if (!id) return { ok: false, error: 'falta id_cliente' };
  var v = String(valor == null ? '' : valor).trim().toLowerCase();
  if (!/^[sn-]{4}$/.test(v)) {
    return { ok: false, error: 'encaje_kairos_4b inválido: se esperan 4 caracteres de {s,n,-} — recibido ' + JSON.stringify(v) };
  }
  return conLock(function () {
    var sh = getMaestro().getSheetByName('Clientes');
    var fila = leerTabla(sh).filter(function (c) { return String(c.id_cliente) === id; })[0];
    // AISLAMIENTO §3: el id viene del front ⇒ se valida contra el roster REAL antes de escribir.
    if (!fila) return { ok: false, error: 'id_cliente fuera del roster: ' + id };
    var viejo = String(fila.encaje_kairos_4b || '');
    if (viejo === v) return { ok: true, id_cliente: id, encaje_kairos_4b: v, sin_cambio: true };
    _setColumnaCliente_(sh, fila, 'encaje_kairos_4b', v);
    // Queda en Actividad: el encaje decide si un tibio pasa a propuesta. Un criterio que cambió
    // sin rastro de cuándo ni desde qué valor no se puede revisar después.
    try { feed_('Cartera', 'cartera', id, 'Encaje KAIROS: ' + (viejo || '(vacío)') + ' → ' + v); } catch (_f) {}
    return { ok: true, id_cliente: id, encaje_kairos_4b: v, de: viejo };
  });
}
