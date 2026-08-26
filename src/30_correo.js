/**
 * 30_correo.js — T7 · CORREO → TRIAJE A BANDEJA (04-ago-2026)
 *
 * Ley: `docs/SPEC-correo-T7.md`, con el dictamen Bastión de 9 cláusulas embebido. Se cumple tal
 * cual, no se reinterpreta. Este archivo es la implementación completa de esa spec.
 *
 * EL PUNTO DE DISEÑO: no existe "el módulo de correo". El correo es otra **fuente** de la Bandeja,
 * igual que la voz o el CM — una fila con `fuente='correo'`. Ni clasificador nuevo, ni bin nuevo,
 * ni hoja de correo: se captura y lo clasifica el `clasificarBandeja` que YA existe.
 *
 * Desvíos de la letra de la spec (21-jul) que la realidad obligó, declarados:
 *  · La spec dice `src/26_correo.js`; 26/27/28/29 se ocuparon después. Va en 30.
 *  · La spec dice asserts D27; `_asertsD27_` ya existe (TC-2). Van en D40.
 *  · La spec cablea "después de `clasificarBandeja`" en `corridaDiaria`: `clasificarBandeja` NO
 *    corre en `corridaDiaria` (tiene su propio trigger opt-in, `instalarTriggerBandeja`). El
 *    efecto buscado —que el correo del día se clasifique recién en la corrida siguiente, sin
 *    mezclarse con el drenaje en curso— se cumple solo. Nada que forzar.
 *
 * Cláusulas y dónde viven:
 *  1 scope mínimo `gmail.readonly` .......... appsscript.json (aserido en el harness, D40h)
 *  2 solo la casilla del owner .............. GmailApp corre como el owner del script; jamás se
 *                                             abre una casilla de cliente (no hay parámetro para eso)
 *  3 `correo_on = false` por default ........ CONFIG_DEFAULTS (01_schema.js)
 *  4 cero escritura sobre Gmail ............. no hay una sola llamada que mute: ni label, ni read,
 *                                             ni archive, ni send. Solo `search` y getters
 *  5 máximo 20 por corrida, solo INBOX ...... CORREO_MAX_POR_CORRIDA + CORREO_QUERY
 *  6 dedupe por id en hoja propia ........... `Correo_visto` (MAESTRO): SOLO el id, ningún contenido
 *  7 anonimización antes de la API .......... `_extractoCorreo_` (PURA): asunto · remitente · 2 líneas
 *  8 costo a `Consumo_agentes` .............. gratis: no llama a la API. La clasificación (y su
 *                                             costo, y su tope) las hace `clasificarBandeja`
 *  9 kill-switch doble ...................... `_correoDebeCorrer_` (PURA): np_pausado Y correo_on
 */

/** Cláusula 5. Tope DURO por corrida: sin override de Config a propósito — subirlo es una decisión
 *  de diseño, no un ajuste de operación. La primera corrida sobre un INBOX de años no puede
 *  disparar miles de clasificaciones ni comerse los 6 minutos de GAS. */
var CORREO_MAX_POR_CORRIDA = 20;

/** Cláusula 5. Solo INBOX, sin chats, ventana de 7 días (nada de backfill histórico por default:
 *  procesar el archivo viejo sería una corrida aparte y explícita, no este camino). */
var CORREO_QUERY = 'in:inbox -in:chats newer_than:7d';

/** Cláusula 7. Cuánto del cuerpo sale del Workspace: dos líneas, y cada una acotada. */
var CORREO_CUERPO_LINEAS = 2;
var CORREO_LINEA_MAX = 200;

/**
 * Prefijo del texto capturado. NO es decorativo: `clasificarBandeja` rutea de forma determinista
 * por prefijos LITERALES en posición 0 (`[RESEARCH]`, `[PREPARAR_REUNION]`). Como todo correo entra
 * con `[CORREO]` en posición 0, un remitente hostil que ponga "[RESEARCH] …" en el asunto NO puede
 * secuestrar ese ruteo: su texto nunca queda en el arranque. Aserido en D40 (D40f2).
 */
var CORREO_PREFIJO = '[CORREO]';

/**
 * PURA — cláusula 9: los dos frenos, decididos SIN tocar Gmail (por eso es aserible con fixtures:
 * "0 llamadas a la API" se prueba sobre la decisión, no espiando a GmailApp).
 * `np_pausado` congela el correo con todo lo demás; `correo_on` lo apaga solo a él.
 * Default cerrado: cualquier cosa que no sea exactamente 'true' deja el correo APAGADO.
 */
function _correoDebeCorrer_(pausado, correoOn) {
  if (pausado) return { correr: false, motivo: 'pausado' };
  if (String(correoOn == null ? '' : correoOn).trim().toLowerCase() !== 'true') {
    return { correr: false, motivo: 'apagado' };
  }
  return { correr: true, motivo: '' };
}

/**
 * PURA — CLÁUSULA 7, el punto más sensible del módulo: acá se decide qué sale del Workspace.
 * Recibe un objeto PLANO (no un GmailMessage) justamente para poder aserirlo con fixtures.
 *
 * Salen TRES cosas y nada más: asunto · remitente · primeras 2 líneas no vacías del cuerpo.
 * Lo que queda adentro: el cuerpo completo, los adjuntos, la cadena de respuestas, los otros
 * destinatarios. Nada de eso hace falta para decidir si un mail es una tarea o un lead, y todo
 * eso viajaría a un tercero. El que no se manda no se puede filtrar.
 *
 * (La PII que sí viaja —el email del remitente— la tokeniza `anonimizar()` en `clasificarBandeja`
 * antes del prompt, y el blindaje anti-inyección lo pone `promptClasificador_` con `blindarDatos_`.
 * O sea: este extracto entra al camino de seguridad que ya existe, no lo esquiva.)
 */
function _extractoCorreo_(msg) {
  msg = msg || {};
  var de = String(msg.de == null ? '' : msg.de).replace(/\s+/g, ' ').trim().slice(0, 160);
  var asunto = String(msg.asunto == null ? '' : msg.asunto).replace(/\s+/g, ' ').trim().slice(0, 200);
  // Líneas NO VACÍAS: un cuerpo que arranca con tres saltos de línea (medio HTML lo hace) daría
  // "primeras 2 líneas" = vacío, y perderíamos justo la señal que se quiso conservar.
  var lineas = String(msg.cuerpo == null ? '' : msg.cuerpo).split('\n')
    .map(function (l) { return l.replace(/\s+/g, ' ').trim(); })
    .filter(function (l) { return !!l; })
    .slice(0, CORREO_CUERPO_LINEAS)
    .map(function (l) { return l.slice(0, CORREO_LINEA_MAX); });
  var primeras2 = lineas.join(' / ');
  var texto = CORREO_PREFIJO + ' de: ' + (de || '(sin remitente)') +
              ' · asunto: ' + (asunto || '(sin asunto)') +
              (primeras2 ? '\n' + primeras2 : '');
  return { id: String(msg.id == null ? '' : msg.id), de: de, asunto: asunto, primeras2: primeras2, texto: texto };
}

/**
 * PURA — lista de remitentes ignorados. La spec la pide "en Config, no en código, desde el día
 * uno" (los newsletters entrarían como `referencia` con confianza media y llenarían la Bandeja).
 * Se siembra VACÍA: mientras nadie la complete, el comportamiento es idéntico a no tenerla.
 * Match por substring sobre el remitente completo, así sirve tanto `newsletter@x.com` como `@x.com`.
 */
function _correoIgnorado_(de, listaCsv) {
  var d = String(de == null ? '' : de).toLowerCase();
  if (!d) return false;
  return String(listaCsv == null ? '' : listaCsv).split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return !!s; })
    .some(function (s) { return d.indexOf(s) >= 0; });
}

/**
 * PURA — qué hacer con UN mensaje, decidido sin tocar Gmail ni el Sheet (cláusula 6 + lista de
 * ignorados). Sacarlo del loop es lo que hace aserible el dedupe con fixtures: "un id ya visto no
 * se vuelve a clasificar" se prueba acá, no espiando llamadas a la API.
 *  · 'saltar'   → ya está en `Correo_visto`: no se toca nada (ni se re-registra)
 *  · 'ignorar'  → remitente en la lista negra: se marca visto SIN capturar (no vuelve mañana)
 *  · 'capturar' → entra a la Bandeja
 */
function _correoDecidirMensaje_(id, vistos, de, listaIgnorados) {
  if (vistos && vistos[String(id)]) return { accion: 'saltar' };
  if (_correoIgnorado_(de, listaIgnorados)) return { accion: 'ignorar' };
  return { accion: 'capturar' };
}

/**
 * Entry point. Lee el INBOX del owner, extrae lo mínimo y lo deja como captura de Bandeja.
 * CERO escritura sobre Gmail (cláusula 4): la bandeja de entrada queda exactamente como estaba.
 *
 * Orden deliberado dentro del loop: se CAPTURA primero y recién después se marca el id como visto.
 * Si la corrida muere en el medio, el mail se reprocesa mañana (captura duplicada, visible y
 * borrable) en vez de quedar marcado como visto sin haber entrado nunca. Perder un mail en
 * silencio es peor que capturarlo dos veces.
 *
 * @return {{procesados:number, saltados:number, ignorados:number, motivo?:string, error?:string}}
 */
function correoTriaje() {
  _ctxSistema_();   // entry point de sistema (corridaDiaria/editor) — habilita los endpoints gateados de adentro
  _soloOwner_('correoTriaje');   // top-level ⇒ invocable por RPC ⇒ puerta. DESPUÉS de _ctxSistema_ (X4).

  var decision = _correoDebeCorrer_(_sistemaPausado_(), getConfig('correo_on'));
  if (!decision.correr) return { procesados: 0, saltados: 0, ignorados: 0, motivo: decision.motivo };

  var shVisto = getMaestro().getSheetByName('Correo_visto');
  // Misma línea que `capturar` con Bandeja: la hoja la crea `setup` (está en MAESTRO_ORDEN), no
  // este módulo. Una hoja creada al vuelo por un consumidor es el bug del 23-jul (hojas lazy que
  // los asserts asumen existentes). Si falta, se dice y se corta.
  if (!shVisto) return { procesados: 0, saltados: 0, ignorados: 0, error: 'falta la pestaña Correo_visto (corré setup)' };

  var vistos = {};
  leerTabla(shVisto).forEach(function (f) { vistos[String(f.id_mensaje)] = true; });
  var listaIgnorados = getConfig('correo_remitentes_ignorados');

  var hilos = GmailApp.search(CORREO_QUERY, 0, CORREO_MAX_POR_CORRIDA);   // cláusulas 4 y 5: solo lectura, tope duro
  var procesados = 0, saltados = 0, ignorados = 0, errores = [];

  hilos.forEach(function (hilo) {
    try {
      // El último mensaje del hilo es el accionable, y además acota el trabajo a ≤20 mensajes por
      // corrida (un hilo de 40 respuestas no puede convertirse en 40 clasificaciones).
      var msgs = hilo.getMessages();
      if (!msgs || !msgs.length) return;
      var m = msgs[msgs.length - 1];
      var id = String(m.getId());

      // Se decide ANTES de leer el cuerpo: un mail ya visto o de un remitente ignorado nunca llega
      // a `getPlainBody()`. No es solo velocidad — es leer lo mínimo, que es el espíritu de la
      // cláusula 7 (en régimen, la mayoría de los 20 hilos del día ya van a estar vistos).
      var q = _correoDecidirMensaje_(id, vistos, m.getFrom(), listaIgnorados);   // cláusula 6: dedupe + lista negra
      if (q.accion === 'saltar') { saltados++; return; }
      if (q.accion === 'ignorar') {
        appendFila(shVisto, { id_mensaje: id, ts: ahoraISO(), id_bandeja: '' });   // visto y descartado: no vuelve mañana
        vistos[id] = true; ignorados++; return;
      }

      var ex = _extractoCorreo_({ id: id, de: m.getFrom(), asunto: m.getSubject(), cuerpo: m.getPlainBody() });
      var cap = capturar(ex.texto, 'correo');
      appendFila(shVisto, { id_mensaje: id, ts: ahoraISO(), id_bandeja: cap.id });
      vistos[id] = true; procesados++;
    } catch (e) {
      errores.push(String((e && e.message) || e).slice(0, 120));
    }
  });

  // Lección 27-jul: todo catch que acumula en un array necesita un aviso aguas arriba. Un error
  // tragado es peor que un error ruidoso — sin esto, el correo dejaría de entrar sin que se note.
  if (errores.length) {
    crearAviso({ origen: 'correo', tipo: 'sync_error',
      mensaje: 'Correo: ' + errores.length + ' mensaje(s) fallaron el triaje — ' + errores.slice(0, 3).join(' · ') });
  }

  Logger.log('correoTriaje: ' + JSON.stringify({ procesados: procesados, saltados: saltados, ignorados: ignorados, errores: errores.length }));
  return { procesados: procesados, saltados: saltados, ignorados: ignorados, errores: errores.length };
}


/* ══════════ CRM PRO · M2 (26-ago-2026) — TIMELINE DE CORREO POR CLIENTE ══════════
 * EXTIENDE este módulo, no lo reescribe: mismas 9 cláusulas Bastión, mismo `gmail.readonly`,
 * misma casilla del owner, CERO escritura sobre Gmail (solo `search` + getters).
 *
 * FLUJO: barrido → `staging` → CONFIRMACIÓN HUMANA → `confirmado` (y recién ahí sella contacto).
 * Nada entra al CRM por adivinanza del sistema: el match remitente→cliente es una PROPUESTA.
 *
 * DEDUPE — decisión pedida por §4 del encargo, resuelta y documentada: **por destino, NO común**.
 *  · `Correo_visto` dedupea por `id_mensaje` para la captura a Bandeja (T7).
 *  · `correo_cliente` dedupea por `id_thread` para el timeline del CRM.
 *  Son claves distintas (mensaje vs. hilo) y propósitos distintos. Compartirlas haría que capturar
 *  un mail a Bandeja SUPRIMA en silencio su candidato de CRM (y al revés) — un feature apagando al
 *  otro sin que nadie lo note. Por eso M2 NO lee ni escribe `Correo_visto`.
 *
 * DE DÓNDE SALE EL MATCH (el encargo decía "roster por dominio/email conocido" sin fijar la fuente;
 * `Clientes` no tiene columna de email ni de dominio). Dos orígenes, ambos declarativos:
 *  · Config `correo_<id_cliente>_dominios` — lista separada por '·' o ',' (dominios o emails
 *    completos). Misma convención que `vigilancia_<id>_*` y `conector_*`.
 *  · `responsable_lado_cliente` del roster, SOLO si contiene '@' (es un email).
 * Sin nada declarado no hay match: el barrido devuelve 0 candidatos y lo DICE. Jamás se adivina
 * por parecido de nombre — un match falso metería el correo de un cliente en la ficha de otro,
 * que es exactamente lo que prohíbe AISLAMIENTO §1.
 */

/** Tope DURO de filas en `staging` sin resolver. Alcanzado, el barrido NO captura más: una bandeja
 *  de entrada con 300 pendientes no se revisa nunca, y el que decide es Luciano, no el barrido. */
var CORREO_CRM_MAX_STAGING = 10;
/** Ventana del barrido. `in:inbox` (cláusula 5: solo INBOX) y 30 días: más atrás es arqueología. */
var CORREO_CRM_QUERY = 'in:inbox newer_than:30d';
/** Tope de hilos LEÍDOS por corrida (distinto del tope de staging): acota el costo de la API. */
var CORREO_CRM_MAX_SCAN = 50;

/** PURA — normaliza un remitente ("Nombre <a@b.com>" | "a@b.com") a su email en minúsculas. */
function _correoEmail_(remitente) {
  var s = String(remitente || '').trim();
  var m = s.match(/<([^>]+)>/);
  return String(m ? m[1] : s).trim().toLowerCase();
}

/**
 * PURA — índice email/dominio → id_cliente. `cfgPorCliente` es {id: 'dominios declarados'} y
 * `roster` las filas de Clientes. Un mismo dominio declarado por DOS clientes se descarta de
 * ambos (ambiguo): antes de arriesgar mezclar tenants, se prefiere no proponer nada (AISLAMIENTO §1).
 */
function _correoIndiceRoster_(roster, cfgPorCliente) {
  var idx = {}, choque = {};
  function poner(clave, id) {
    var k = String(clave || '').trim().toLowerCase().replace(/^@/, '');
    if (!k || k.indexOf('.') < 0) return;              // ni vacío ni basura sin punto
    if (idx[k] && idx[k] !== id) { choque[k] = true; return; }
    idx[k] = id;
  }
  (roster || []).forEach(function (c) {
    var id = String(c.id_cliente || '');
    if (!id || id === 'CLI-000') return;
    String((cfgPorCliente || {})[id] || '').split(/[·,;]/).forEach(function (d) { poner(d, id); });
    var resp = String(c.responsable_lado_cliente || '');
    if (resp.indexOf('@') >= 0) poner(_correoEmail_(resp), id);
  });
  Object.keys(choque).forEach(function (k) { delete idx[k]; });
  return idx;
}

/** PURA — resuelve un remitente contra el índice: primero el email exacto, después su dominio.
 *  Sin match ⇒ '' (no se propone nada). */
function _correoClienteDeRemitente_(remitente, idx) {
  var mail = _correoEmail_(remitente);
  if (!mail) return '';
  if (idx[mail]) return idx[mail];
  var dom = mail.split('@')[1] || '';
  return idx[dom] || '';
}

/** La hoja lazy de M2. La crea a demanda (no está en MAESTRO_ORDEN: `setup()` no la materializa). */
function _correoClienteHoja_() {
  return ensureSheet(getMaestro(), 'correo_cliente', MAESTRO_SHEETS.correo_cliente);
}

/**
 * M2 — barrido de candidatos a `staging`. Read-only sobre Gmail; escribe SOLO en `correo_cliente`.
 * Kill-switch doble reusado (`_correoDebeCorrer_`): `np_pausado` Y `correo_on`.
 * JAMÁS guarda el CUERPO: id_thread, asunto, remitente y fecha. Nada más.
 */
function correoCandidatosStaging() {
  _soloOwner_('correoCandidatosStaging');
  var decision = _correoDebeCorrer_(_sistemaPausado_(), getConfig('correo_on'));
  if (!decision.correr) return { capturados: 0, motivo: decision.motivo };

  var ss = getMaestro();
  var sh = _correoClienteHoja_();
  var filas = leerTabla(sh);
  var yaHilo = {}, pendientes = 0;
  filas.forEach(function (f) {
    yaHilo[String(f.id_thread)] = true;
    if (String(f.estado) === 'staging') pendientes++;
  });
  // Tope de staging: se corta ANTES de tocar la API (no se gasta cuota para tirar el resultado).
  if (pendientes >= CORREO_CRM_MAX_STAGING) {
    return { capturados: 0, pendientes: pendientes, tope: CORREO_CRM_MAX_STAGING,
             aviso: 'Hay ' + pendientes + ' candidatos sin resolver (tope ' + CORREO_CRM_MAX_STAGING +
                    '). Confirmá o descartá los pendientes antes de barrer de nuevo.' };
  }

  var roster = leerTabla(ss.getSheetByName('Clientes'));
  var cfg = {};
  roster.forEach(function (c) {
    var id = String(c.id_cliente || '');
    if (id) cfg[id] = getConfig('correo_' + id + '_dominios') || '';
  });
  var idx = _correoIndiceRoster_(roster, cfg);
  if (!Object.keys(idx).length) {
    return { capturados: 0, pendientes: pendientes,
             aviso: 'Ningún cliente tiene dominios/emails declarados. Cargá `correo_<id_cliente>_dominios` ' +
                    'en Config (o poné el email en `responsable_lado_cliente`) — sin eso no hay match posible.' };
  }

  var hilos = GmailApp.search(CORREO_CRM_QUERY, 0, CORREO_CRM_MAX_SCAN);   // solo lectura
  var capturados = 0, sinMatch = 0;
  for (var i = 0; i < hilos.length; i++) {
    if (pendientes >= CORREO_CRM_MAX_STAGING) break;                       // el tope manda dentro del loop
    var th = hilos[i];
    var idTh = String(th.getId());
    if (yaHilo[idTh]) continue;                                            // dedupe por hilo (ver cabecera)
    var msgs = th.getMessages();
    var primero = msgs[0];
    var quien = primero ? primero.getFrom() : '';
    var idc = _correoClienteDeRemitente_(quien, idx);
    if (!idc) { sinMatch++; continue; }
    appendFila(sh, {
      id_thread: idTh,
      id_cliente: idc,
      asunto: limpiarHostilTexto_(String(th.getFirstMessageSubject() || ''), 150),
      remitente: limpiarHostilTexto_(_correoEmail_(quien), 120),
      fecha_ultimo: aFechaISO(th.getLastMessageDate()) || hoyISO(),
      estado: 'staging',
      sello_tenant: idc                                                     // evidencia de aislamiento
    });
    yaHilo[idTh] = true;
    capturados++; pendientes++;
  }
  return { capturados: capturados, pendientes: pendientes, escaneados: hilos.length,
           sin_match: sinMatch, tope: CORREO_CRM_MAX_STAGING };
}

/**
 * M2 — CONFIRMACIÓN HUMANA. Pasa un hilo de `staging` a `confirmado` y sella el contacto (M1).
 * `idFila` es el **id_thread** (clave natural y estable de la hoja): un número de fila no es una
 * clave — se corre si alguien inserta arriba, y confirmaría el hilo equivocado.
 * AISLAMIENTO §3: el `id_cliente` viene del front ⇒ se valida contra el roster REAL. Un id
 * inventado no se escribe.
 */
function correoConfirmarThread(idFila, idCliente) {
  _soloOwner_('correoConfirmarThread');
  var idTh = String(idFila == null ? '' : idFila).trim();
  var idc = String(idCliente == null ? '' : idCliente).trim();
  if (!idTh) return { ok: false, error: 'falta id_thread' };
  if (!idc) return { ok: false, error: 'falta id_cliente' };
  var res = conLock(function () {
    var sh = _correoClienteHoja_();
    var fila = leerTabla(sh).filter(function (f) { return String(f.id_thread) === idTh; })[0];
    if (!fila) return { ok: false, error: 'id_thread fuera de correo_cliente: ' + idTh };
    var enRoster = leerTabla(getMaestro().getSheetByName('Clientes'))
                     .filter(function (c) { return String(c.id_cliente) === idc; })[0];
    if (!enRoster) return { ok: false, error: 'id_cliente fuera del roster: ' + idc };
    _setColumnasCliente_(sh, fila, { estado: 'confirmado', id_cliente: idc, sello_tenant: idc });
    try { feed_('Correo', 'cartera', idc, 'Hilo de correo confirmado: ' + String(fila.asunto || '').slice(0, 80)); } catch (_f) {}
    return { ok: true, id_thread: idTh, id_cliente: idc };
  });
  // Sello FUERA del lock (`conLock` no es reentrante). Confirmar un hilo ES un contacto: es la
  // pata que une M2 con M1 — el timeline de correo alimenta los días-sin-contacto de la card.
  if (res && res.ok) { try { _sellarContacto_(idc, 'correo'); } catch (_s) {} }
  return res;
}

/** M2 — descarte. El hilo queda `descartado` y NO vuelve a aparecer (el barrido dedupea por
 *  `id_thread` sobre TODA la hoja, no solo sobre los `staging`). */
function correoDescartarThread(idFila) {
  _soloOwner_('correoDescartarThread');
  var idTh = String(idFila == null ? '' : idFila).trim();
  if (!idTh) return { ok: false, error: 'falta id_thread' };
  return conLock(function () {
    var sh = _correoClienteHoja_();
    var fila = leerTabla(sh).filter(function (f) { return String(f.id_thread) === idTh; })[0];
    if (!fila) return { ok: false, error: 'id_thread fuera de correo_cliente: ' + idTh };
    _setColumnasCliente_(sh, fila, { estado: 'descartado' });
    return { ok: true, id_thread: idTh };
  });
}

/**
 * M2 — hilos CONFIRMADOS de UN cliente, para la solapa Comercial y el dossier (C7).
 * AISLAMIENTO: filtra por `id_cliente` Y por `sello_tenant` — la doble condición es la que hace
 * que un hilo de A no pueda aparecer en la ficha de B ni por una fila mal escrita a mano.
 * Devuelve `[]` si la hoja no existe todavía (lazy): ausencia no es error.
 */
function correoHilosDeCliente_(idCliente, limite) {
  var idc = String(idCliente == null ? '' : idCliente).trim();
  if (!idc) return [];
  var sh = getMaestro().getSheetByName('correo_cliente');
  if (!sh) return [];
  var top = Number(limite) > 0 ? Number(limite) : 5;
  return leerTabla(sh).filter(function (f) {
    return String(f.estado) === 'confirmado' &&
           String(f.id_cliente) === idc && String(f.sello_tenant) === idc;
  }).sort(function (a, b) {
    return String(aFechaISO(b.fecha_ultimo) || '') < String(aFechaISO(a.fecha_ultimo) || '') ? -1 : 1;
  }).slice(0, top).map(function (f) {
    return { id_thread: String(f.id_thread), asunto: String(f.asunto || ''),
             remitente: String(f.remitente || ''), fecha: aFechaISO(f.fecha_ultimo) || '',
             url: 'https://mail.google.com/mail/u/0/#inbox/' + String(f.id_thread) };
  });
}
