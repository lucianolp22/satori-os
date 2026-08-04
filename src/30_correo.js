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
