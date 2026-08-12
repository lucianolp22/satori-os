/**
 * 32_flota.js — EDIFICIO SATORI · lectores de la FLOTA PROPIA (10-ago-2026)
 *
 * QUÉ ES: los tres endpoints que alimentan el Edificio (la torre de 8 plantas que cuelga DEBAJO
 * del universo de Akasha). Vista de la flota PROPIA de Satori — nuestros agentes y módulos —, no
 * de tenants. Por eso es Bastión verde: acá no se cruza un solo dato de cliente.
 *
 * REGLAS DURAS DE ESTE ARCHIVO (las tres nacieron de verificar el encargo contra el código real):
 *
 *  1. READ-ONLY DE VERDAD. `flotaEstado` se llama en cada entrada al Edificio: no puede escribir
 *     NADA. Por eso NO usa `filaConsumoAgentes_()` (que hace `appendRow` de la fila del mes si
 *     falta) ni `guardPresupuesto_()` (que escribe Properties, crea aviso y manda email al 80%).
 *     El lector puro es `_flotaConsumoRO_()`, acá abajo. Si alguien "simplifica" reemplazándolo
 *     por el helper de 13_agentes.js, rompe el invariante y el assert lo canta.
 *
 *  2. NI UN DATO DE CLIENTE SALE DE ACÁ (CLAUDE.md §AISLAMIENTO, guarda 1 del encargo). Las dos
 *     hojas que se leen tienen columna `id_cliente` — `Actividad` y `Costos_API_consolidado` — y
 *     las dos se agregan DESCARTÁNDOLA. Tampoco viaja `texto` de Actividad: esas celdas llevan
 *     salidas de agentes que sí pueden contener cifras y nombres de tenants. Del feed salen
 *     conteos y timestamps, nada más.
 *
 *  3. NADA INVENTADO. Los 68 del roster del Edificio son mayormente persona-skills que no tienen
 *     runtime: no se les fabrica un verde. Cada ítem viaja con `fuente` ('cola' | 'actividad' |
 *     'ninguna'), y el que no tiene telemetría dice `estado:'b'` (en guardia) con fuente
 *     'ninguna'. El front pinta lo que el server declara.
 */

/**
 * Los módulos runtime que el Edificio muestra como agentes y que NO viven en `AGENTES` (13_agentes.js):
 * son motores del OS con su propio archivo, no runners de tenant. La clave es la del Edificio; el
 * `feed` es el nombre EXACTO con el que ese módulo escribe en la hoja `Actividad` — verificado con
 * `grep -ahoE "feed_\('[^']+'" src/*.js`. `feed:''` = todavía no registra actividad propia: entonces
 * su estado sale 'b'/fuente 'ninguna' y el panel lo dice, en vez de mentir un verde.
 *
 * ⚠ LISTA-CONTRATO (CLAUDE.md): la consume `flotaEstado`, `agenteDetalle` (validación de clave) y
 * el roster estático del módulo `edificio.html`. Agregar un ítem obliga a revisar los tres.
 */
var FLOTA_MODULOS = {
  director:    { nombre: 'Director',    archivo: '14_director.js',   feed: 'Director' },
  salud:       { nombre: 'Salud',       archivo: '16_salud.js',      feed: 'Salud' },
  bandeja:     { nombre: 'Bandeja',     archivo: '17_bandeja.js',    feed: 'Clasificador' },
  cerebro:     { nombre: 'Cerebro',     archivo: '15_cerebro.js',    feed: '' },
  vigilancia:  { nombre: 'Vigilancia',  archivo: '29_vigilancia.js', feed: '' },
  conectores:  { nombre: 'Conectores',  archivo: '19_conectores.js', feed: '' },
  admin:       { nombre: 'Admin propia', archivo: '31_admin.js',     feed: '' },
  sato:        { nombre: 'Sato',        archivo: '26_sato.js',       feed: '' },
  backup:      { nombre: 'Backup',      archivo: '21_backup.js',     feed: 'Backup' },
  forge:       { nombre: 'Forge',       archivo: '28_forge.js',      feed: 'Forge' }
};

/** Cuántas filas del final de `Actividad` mira la telemetría. El feed es cronológico por append. */
var FLOTA_ACTIVIDAD_FILAS = 400;

/**
 * Lector PURO de `Consumo_agentes`. Gemelo de `_filaConsumoCore_` (13_agentes.js) MENOS el
 * `appendRow`: si la fila del mes no existe todavía, devuelve ceros en vez de crearla.
 * @return {{gasto:number, corridas:Object}}
 */
function _flotaConsumoRO_() {
  var sh = getMaestro().getSheetByName('Consumo_agentes');
  if (!sh || sh.getLastRow() < 2) return { gasto: 0, corridas: {} };
  var mes = mesISO(), vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === mes) return { gasto: Number(vals[i][1]) || 0, corridas: parsearPayload_(vals[i][2]) };
  }
  return { gasto: 0, corridas: {} };
}

/**
 * Última corrida por NOMBRE de agente, leída del final de `Actividad`.
 * Devuelve `{ '<nombre>': {ts:Date, dias:number, corridas30:number} }`.
 * NO devuelve `texto` ni `id_cliente`: ver regla 2 de la cabecera.
 */
function _flotaTelemetria_() {
  var sh = getMaestro().getSheetByName('Actividad');
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var ix = {}; H.forEach(function (h, i) { ix[h] = i; });
  if (ix.ts == null || ix.agente == null) return out;
  var n = sh.getLastRow(), desde = Math.max(2, n - FLOTA_ACTIVIDAD_FILAS + 1);
  var filas = sh.getRange(desde, 1, n - desde + 1, sh.getLastColumn()).getValues();
  var corte30 = Date.now() - 30 * 864e5;
  filas.forEach(function (f) {
    var nom = String(f[ix.agente] || ''); if (!nom) return;
    var t = aFechaHora_(f[ix.ts]);
    var o = out[nom] || (out[nom] = { ts: null, dias: null, corridas30: 0 });
    if (t) {
      if (t.getTime() >= corte30) o.corridas30++;
      if (!o.ts || t.getTime() > o.ts.getTime()) o.ts = t;
    }
  });
  Object.keys(out).forEach(function (k) {
    var o = out[k];
    o.dias = o.ts ? Math.floor((Date.now() - o.ts.getTime()) / 864e5) : null;
  });
  return out;
}

/**
 * Semáforo del Edificio. Traduce lo que hay (cola + feed + flag `activo`) a los 4 estados que la
 * torre pinta, SIN inventar: 'g' runtime activo · 'b' en guardia · 'y' gateado/con falla ·
 * 'gr' dormido. El orden de las guardas importa: una falla manda sobre un verde viejo.
 */
function _flotaSemaforo_(activo, estadoCola, diasDesdeCorrida) {
  if (!activo) return 'gr';
  if (estadoCola === 'fail') return 'y';
  if (estadoCola === 'work') return 'g';
  if (diasDesdeCorrida != null && diasDesdeCorrida <= 1) return 'g';
  return 'b';
}

/**
 * ENDPOINT 1 — estado vivo de la flota propia. Read-only estricto (regla 1).
 *
 * @return {{runtime:Array, modulos:Array, salud:Object, consumo:Object, ts:string}}
 *   runtime: los runners de `AGENTES` — {clave, nombre, rol, activo, gate, estado, fuente,
 *            ultimaCorrida, diasDesdeCorrida, cupo:{usado,max,ok}}
 *   modulos: los motores de `FLOTA_MODULOS` — mismo shape sin cupo (no consumen cuota de runner).
 *   salud:   `estadoSalud()` (= `correrSalud({dryRun:true})` + integridad) — NUNCA `correrSalud()`
 *            a secas, que autohealea y escribe.
 */
function flotaEstado() {
  _soloOwner_('flotaEstado');   // endpoint client-callable — gate de identidad
  var ss = getMaestro();
  var colaSh = ss.getSheetByName('Cola_tareas');
  var estados = estadosAgentesCola_(colaSh ? leerTabla(colaSh) : []);
  var tele = _flotaTelemetria_();
  var cons = _flotaConsumoRO_();
  var hoy = hoyISO();

  var runtime = Object.keys(AGENTES).map(function (k) {
    var a = agenteEfectivo_(k);                       // TC-9: estado EFECTIVO (override de Agentes_estado)
    var t = tele[a.nombre] || {};
    var usado = cons.corridas[k + ':' + hoy] || 0;
    return {
      clave: k, nombre: a.nombre, rol: a.rol, activo: !!a.activo, gate: !!a.gate,
      estado: _flotaSemaforo_(a.activo, estados[k], t.dias),
      fuente: estados[k] ? 'cola' : (t.ts ? 'actividad' : 'ninguna'),
      ultimaCorrida: t.ts ? aHoraLegible_(t.ts) : '',
      diasDesdeCorrida: (t.dias == null ? null : t.dias),
      cupo: { usado: usado, max: a.maxDia, ok: usado < a.maxDia }
    };
  });

  var modulos = Object.keys(FLOTA_MODULOS).map(function (k) {
    var m = FLOTA_MODULOS[k];
    var t = (m.feed && tele[m.feed]) || {};
    return {
      clave: k, nombre: m.nombre, rol: 'Runtime · ' + m.archivo, activo: true, gate: false,
      estado: _flotaSemaforo_(true, null, t.dias),
      fuente: t.ts ? 'actividad' : 'ninguna',
      ultimaCorrida: t.ts ? aHoraLegible_(t.ts) : '',
      diasDesdeCorrida: (t.dias == null ? null : t.dias)
    };
  });

  return {
    runtime: runtime,
    modulos: modulos,
    salud: estadoSalud(),
    consumo: { gastoUsd: cons.gasto, topeUsd: budgetMensualUSD_(), mes: mesISO() },
    ts: aHoraLegible_(ahoraISO())
  };
}

/**
 * ENDPOINT 2 — ficha de UN agente/módulo de la flota, para el dashboard que abre la torre.
 *
 * AISLAMIENTO (guarda 1 del encargo): el costo del mes se agrega POR MÓDULO sumando todas las
 * filas del mes de `Costos_API_consolidado` y DESCARTANDO `id_cliente`. No sale un nombre de
 * cliente, un id ni una cifra atribuible a un tenant: sale cuánto gastó ESTE agente en total.
 * Del feed salen conteos y fechas, nunca `texto`.
 *
 * La clave se valida contra el roster REAL (`AGENTES` + `FLOTA_MODULOS`). Una clave desconocida
 * corta con error: no se adivina ni se devuelve un objeto vacío que el front lea como "sin datos".
 * Las persona-skills (Círculo, Consejo, Equipo Pro, Bastión) NO tienen entrada acá — no tienen
 * runtime; el módulo del Edificio les muestra su ficha estática del roster y no llama a este
 * endpoint.
 *
 * @param {string} clave  clave de `AGENTES` o de `FLOTA_MODULOS`
 * @return {{clave,nombre,rol,tipo,activo,gate,corridas30d,ultimaCorrida,cupo,costoMes,salud}}
 */
function agenteDetalle(clave) {
  _soloOwner_('agenteDetalle');   // endpoint client-callable — gate de identidad
  var k = String(clave || '');
  var esRunner = Object.prototype.hasOwnProperty.call(AGENTES, k);
  var esModulo = Object.prototype.hasOwnProperty.call(FLOTA_MODULOS, k);
  if (!esRunner && !esModulo) throw new Error('agente desconocido: ' + k);

  var base = esRunner ? agenteEfectivo_(k) : null;
  var mod  = esModulo ? FLOTA_MODULOS[k] : null;
  var nombreFeed = esRunner ? base.nombre : mod.feed;
  var t = (nombreFeed && _flotaTelemetria_()[nombreFeed]) || {};

  // Costo del mes de ESTE módulo, agregado sobre todos los tenants (sin exponer ninguno).
  var costo = { llamadas: 0, tokens: 0, usd: 0, eur: 0, mes: mesISO() };
  var shC = getMaestro().getSheetByName('Costos_API_consolidado');
  if (shC) {
    leerTabla(shC).forEach(function (f) {
      if (String(f.mes) !== costo.mes || String(f.modulo) !== k) return;
      costo.llamadas += Number(f.llamadas) || 0;
      costo.tokens   += Number(f.tokens)   || 0;
      costo.usd      += Number(f.USD)      || 0;
      costo.eur      += Number(f.EUR)      || 0;
    });
  }

  var out = {
    clave: k,
    nombre: esRunner ? base.nombre : mod.nombre,
    rol: esRunner ? base.rol : ('Runtime · ' + mod.archivo),
    tipo: esRunner ? 'runner' : 'modulo',
    activo: esRunner ? !!base.activo : true,
    gate: esRunner ? !!base.gate : false,
    corridas30d: t.corridas30 || 0,
    ultimaCorrida: t.ts ? aHoraLegible_(t.ts) : '',
    diasDesdeCorrida: (t.dias == null ? null : t.dias),
    costoMes: costo,
    // Procedencia explícita (CLAUDE.md §7 del aislamiento): de qué hoja y de qué ventana salió cada
    // número, para que el panel lo pueda mostrar en vez de que el lector lo suponga.
    fuentes: {
      corridas: 'Actividad · últimas ' + FLOTA_ACTIVIDAD_FILAS + ' filas · ventana 30 días',
      costo: 'Costos_API_consolidado · mes ' + costo.mes + ' · agregado de todos los módulos, sin id_cliente',
      cupo: esRunner ? 'Consumo_agentes · ' + mesISO() : ''
    }
  };
  if (esRunner) {
    var cons = _flotaConsumoRO_();
    var usado = cons.corridas[k + ':' + hoyISO()] || 0;
    out.cupo = { usado: usado, max: base.maxDia, ok: usado < base.maxDia };
  }
  return out;
}

/**
 * ENDPOINT 3 — sirve el módulo 3D del Edificio (`edificio.html`) como texto, para que el front lo
 * inyecte la PRIMERA vez que se desciende del orbe.
 *
 * POR QUÉ ASÍ Y NO INLINE: `index.html` ya pesa ~960KB y el módulo suma ~300KB (los avatares
 * base64 son 240KB de eso). Inlinearlo le cobraría ese peso a CADA carga del Centro de Mando,
 * entres o no al Edificio — justo el TTFP que afinó E3.7 con las dos olas. Sirviéndolo por acá,
 * el boot diario no cambia y el costo se paga una vez, cuando bajás.
 *
 * NO templatiza (mismo motivo que `doGet`: `createTemplateFromFile` escanearía 300KB de base64
 * buscando scriptlets). `getContent()` devuelve el archivo crudo.
 */
function moduloEdificio() {
  _soloOwner_('moduloEdificio');   // endpoint client-callable — gate de identidad
  return HtmlService.createHtmlOutputFromFile('edificio').getContent();
}

// ═══ E2 (11-ago) · AVATARES DEL LABORATORIO ═════════════════════════════════
//
// Los 8 del lab tenían arte aprobado y ningún slot: `estadoAgentes` arma `avatar_url` para toda
// clave de `AGENTES` leyendo Config `avatar_<clave>`, y esas 8 claves no existían. Ahora existen
// (CONFIG_DEFAULTS) y esto las llena desde Drive, sin que nadie copie un id a mano.
//
// ⚠ LO QUE ESTA FUNCIÓN NO PUEDE HACER, y por qué se dice en vez de fallar mudo: el manifiesto
// declara `drive.file` (mínimo privilegio, dictamen Bastión) y bajo ese scope `files.list` ve
// SOLO lo que ESTA app creó o abrió. Un PNG arrastrado a mano desde la web de Drive NO entra en
// ese universo. O sea: si Luciano sube los avatares a mano, la búsqueda devuelve VACÍO — no un
// error, vacío — y el reporte tiene que decir exactamente eso, con el camino alterno, en vez de
// dejar un «0 encontrados» que se lee como «los archivos no están». Es la 4ª vez que este scope
// muerde (P2 papelera · BK-1 backups · BK-2 copias): acá se documenta ANTES del incidente.
// El camino que SIEMPRE funciona: pegar la URL a mano en las 8 claves de la hoja Config.

/** Los 8 del laboratorio, DERIVADOS del roster (no una lista paralela que se desincroniza). */
function _avataresLabClaves_() {
  return Object.keys(AGENTES).filter(function (k) { return AGENTES[k].activo === false; });
}

/** URL de miniatura pública de Drive. Requiere que el archivo sea legible por enlace. */
function _avatarUrlDrive_(id) {
  return 'https://drive.google.com/thumbnail?id=' + String(id || '') + '&sz=w512';
}

/**
 * ONE-SHOT — carga las 8 claves `avatar_<lab>` de Config buscando `avatar_<clave>.png` en Drive.
 *
 * Sin argumentos y sin `_` final: sale en el desplegable del editor (regla dura 04-ago).
 * IDEMPOTENTE: una clave que YA tiene valor no se pisa (correrla dos veces no cambia nada). Para
 * reemplazar arte viejo está `seedAvataresLabPisar()` — wrapper aparte, no un flag, porque el
 * desplegable corre sin argumentos y un `seed(pisar)` recibiría `undefined` (incidente
 * `selfTestTramo(n)`, 04-ago).
 *
 * Busca primero DENTRO de la carpeta `avatares_folder_id` (Config) si está declarada, y si no,
 * por nombre en todo lo alcanzable. Reporta clave por clave: cargada / ya tenía / no encontrada.
 */
function seedAvataresLab() {
  _soloOwner_('seedAvataresLab');
  return _seedAvataresLab_(false);
}

/** Igual, pero PISA las claves que ya tienen valor. Para reemplazar arte, no para el alta. */
function seedAvataresLabPisar() {
  _soloOwner_('seedAvataresLabPisar');
  return _seedAvataresLab_(true);
}

/** Cuerpo compartido de los dos wrappers: el que pisa no puede divergir del que no. */
function _seedAvataresLab_(pisar) {
  var claves = _avataresLabClaves_();
  var actuales = configPrefijo_('avatar_');
  var carpeta = getConfig('avatares_folder_id');
  var out = { modo: pisar ? 'PISAR' : 'IDEMPOTENTE', carpeta: carpeta || '(sin avatares_folder_id — búsqueda global)',
              cargadas: [], ya_tenian: [], no_encontradas: [], ambiguas: [], errores: [] };

  // Una sola lectura de la carpeta para las 8 (en vez de 8 búsquedas). Si la carpeta no se puede
  // leer se DICE y se cae a la búsqueda por nombre — degradar en silencio es cómo se pierde el motivo.
  var enCarpeta = {};
  if (carpeta) {
    var hijos = _driveListarHijos_(carpeta, false);
    if (!hijos.ok) out.errores.push('no pude leer avatares_folder_id: ' + hijos.error);
    else hijos.items.forEach(function (f) { (enCarpeta[String(f.name)] = enCarpeta[String(f.name)] || []).push(f.id); });
  }

  claves.forEach(function (k) {
    if (!pisar && String(actuales[k] || '').trim()) { out.ya_tenian.push(k); return; }
    var archivo = 'avatar_' + k + '.png';
    var ids = enCarpeta[archivo] || [];
    if (!ids.length) {
      var b = _driveBuscarPorNombre_(archivo);
      if (!b.ok) { out.errores.push(k + ': ' + b.error); return; }
      ids = b.items.map(function (f) { return f.id; });
    }
    if (!ids.length) { out.no_encontradas.push(archivo); return; }
    // Dos archivos con el mismo nombre: NO se elige uno al azar. Se dice y se deja sin cargar —
    // el arte equivocado en el agente equivocado es peor que el placeholder.
    if (ids.length > 1) { out.ambiguas.push(archivo + ' (' + ids.length + ' copias en Drive — resolvé cuál y pegá la URL a mano)'); return; }
    try { setConfig('avatar_' + k, _avatarUrlDrive_(ids[0])); out.cargadas.push(k); }
    catch (x) { out.errores.push(k + ': ' + ((x && x.message) || x)); }
  });

  var res = 'seedAvataresLab [' + out.modo + '] · carpeta: ' + out.carpeta + '\n' +
    '  cargadas: ' + (out.cargadas.length ? out.cargadas.join(', ') : 'ninguna') + '\n' +
    '  ya tenían valor (no se pisan): ' + (out.ya_tenian.length ? out.ya_tenian.join(', ') : 'ninguna') + '\n' +
    '  NO encontradas en Drive: ' + (out.no_encontradas.length ? out.no_encontradas.join(', ') : 'ninguna') + '\n' +
    '  ambiguas: ' + (out.ambiguas.length ? out.ambiguas.join(' · ') : 'ninguna') + '\n' +
    '  errores: ' + (out.errores.length ? out.errores.join(' · ') : 'ninguno');
  // El aviso de scope solo aparece cuando ES la explicación probable — no como ruido permanente.
  if (out.no_encontradas.length) {
    res += '\n  ⚠ OJO: bajo `drive.file` esta app ve SOLO los archivos que ella creó o abrió. Si los' +
           '\n    PNG los subiste a mano desde la web de Drive, NO los puede encontrar aunque estén ahí.' +
           '\n    Camino que siempre funciona: compartí cada PNG "cualquiera con el enlace" y pegá' +
           '\n    https://drive.google.com/thumbnail?id=<ID>&sz=w512 en la clave avatar_<agente> de Config.';
  }
  // La miniatura de Drive solo carga si el archivo es legible por enlace. Se recuerda SIEMPRE que
  // se cargó algo: una URL bien formada sobre un archivo privado da un cuadro roto, no un error.
  if (out.cargadas.length) {
    res += '\n  ⚠ Verificá que esos archivos estén compartidos como "cualquiera con el enlace":' +
           '\n    la miniatura de un archivo privado no carga y el CM cae al placeholder.';
  }
  Logger.log(res);
  out.resumen = res;
  return out;
}
