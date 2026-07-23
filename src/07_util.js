/**
 * 07_util.js — Helpers compartidos. Sin estado propio; todo deriva del MAESTRO.
 */

var TZ = 'Europe/Madrid';

/** Devuelve el Spreadsheet MAESTRO o lanza si setup() no corrió aún. */
function getMaestro() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_MAESTRO_ID);
  if (!id) throw new Error('MAESTRO no inicializado. Corré setup() una vez.');
  return SpreadsheetApp.openById(id);
}

/** Fecha-hora ISO local (Europe/Madrid), p.ej. 2026-06-10T14:37:02. */
function ahoraISO() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

/** Fecha ISO local YYYY-MM-DD. */
function hoyISO() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/** Mes ISO YYYY-MM. */
function mesISO() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
}

/**
 * Normaliza un valor de fecha leído de Sheets a 'yyyy-MM-dd' para comparar.
 * Sheets auto-convierte strings tipo fecha a objetos Date al leer con
 * getValues(); String(Date) NO es ISO y rompe la comparación lexicográfica.
 * Acepta Date o string; '' si vacío.
 */
function aFechaISO(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return String(v).substring(0, 10);
}

/**
 * Garantiza una pestaña con encabezados. Idempotente: crea si falta,
 * escribe la fila de encabezados solo si está vacía. Devuelve el Sheet.
 */
/**
 * Fecha+hora legible para TODA superficie server-side (brief, logs, informes): dd/MM/yyyy HH:mm.
 * Espejo exacto de `fechaHoraCorta` del cliente (index.html) — mismo formato en las dos capas
 * (decisión Luciano 20-jul). Nunca devolver el Date crudo de Sheets ("Mon Jul 20 2026 … GMT+0200"),
 * que es justo el bug que esto cierra. Si no parsea, devuelve el texto tal cual (jamás inventa).
 */
function fechaHoraCorta_(v) {
  if (v === null || v === undefined || v === '') return '';
  var d = (v instanceof Date) ? v : null;
  if (!d) {
    var s = String(v);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4];
    d = new Date(s);
    if (isNaN(d.getTime())) return s;
  }
  return Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm');
}

function ensureSheet(ss, nombre, headers) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0 && headers && headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f0f0f0');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  } else if (headers && headers.length && sh.getLastColumn() > 0) {
    // Tareas-v2 F1 (07-jul): reconciliación ADITIVA de headers en hojas existentes — agrega al
    // FINAL los que faltan del schema. Nunca reordena, renombra ni borra; los datos no se tocan
    // (leerTabla/appendFila mapean por nombre, así que los consumidores viejos siguen igual).
    var actuales = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var faltan = headers.filter(function (h) { return actuales.indexOf(String(h)) < 0; });
    if (faltan.length) {
      sh.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan]);
      sh.getRange(1, actuales.length + 1, 1, faltan.length).setFontWeight('bold').setBackground('#f0f0f0');
    }
  }
  aplicarFormatoTexto(sh); // IDs/claves como texto plano (evita coerción a fecha; ver COLUMNAS_TEXTO)
  return sh;
}

/**
 * Fija formato texto ('@') en las columnas tipo-ID de una pestaña (según su fila de
 * encabezados real y COLUMNAS_TEXTO). Idempotente. Aplica a toda la columna para que
 * los appendRow futuros hereden el formato y no coaccionen 'APR-0001' a fecha.
 */
function aplicarFormatoTexto(sh) {
  if (sh.getLastColumn() < 1 || sh.getLastRow() < 1) return;
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var max = sh.getMaxRows();
  for (var i = 0; i < hdr.length; i++) {
    if (COLUMNAS_TEXTO.indexOf(String(hdr[i])) >= 0) {
      sh.getRange(1, i + 1, max, 1).setNumberFormat('@');
    }
  }
}

/** Lee una pestaña como array de objetos {header: valor}. Excluye la fila 1. */
function leerTabla(sh) {
  var rng = sh.getDataRange().getValues();
  if (rng.length < 2) return [];
  var headers = rng[0];
  var out = [];
  for (var r = 1; r < rng.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = rng[r][c];
    obj._fila = r + 1;
    out.push(obj);
  }
  return out;
}

/** Append de una fila respetando el orden de encabezados de la pestaña. */
function appendFila(sh, objeto) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var fila = headers.map(function (h) { return sanitizarCelda(objeto.hasOwnProperty(h) ? objeto[h] : ''); });
  sh.appendRow(fila);
  // E2-1 (causa raíz real): appendRow IGNORA el formato '@' de la columna y coacciona los
  // strings tipo-fecha al colocarlos ('APR-0001' → Date abril-2001), por lo que el id releído
  // no matchea. Por eso a6e641e (que solo formateaba la columna) NO alcanzó. Re-escribir las
  // celdas COLUMNAS_TEXTO de la fila recién creada como texto explícito: setValue sobre una
  // celda '@' SÍ respeta el formato. Solo toca columnas tipo-ID; fechas/montos quedan como
  // están (E1 está verificada con su comportamiento Date/number).
  // Purga M1: appendRow+getLastRow+setValue NO es atómico → para columnas tipo-ID
  // coercibles, llamar appendFila bajo conLock (crearAprobacion/crearCliente ya lo hacen).
  var fila_n = sh.getLastRow();
  for (var i = 0; i < headers.length; i++) {
    if (COLUMNAS_TEXTO.indexOf(String(headers[i])) >= 0) {
      sh.getRange(fila_n, i + 1).setNumberFormat('@').setValue(fila[i]);
    }
  }
}

/**
 * Mitiga formula/CSV injection (PURGA #1). Una celda string que empieza con
 * = + - @ la interpreta Sheets como fórmula al escribirla; un `=...` que cruce
 * de un Sheet cliente al MAESTRO vía sync se evaluaría. Prefijar `'` la deja
 * como texto literal. Solo afecta strings — números/fechas-Date pasan intactos.
 */
function sanitizarCelda(v) {
  // PURGA B5 #3: además de = + - @, neutralizar TAB/CR/LF iniciales (control chars que
  // Sheets/CSV pueden malinterpretar en export/import). Solo afecta strings.
  if (typeof v === 'string' && v.length > 0 && '=+-@\t\r\n'.indexOf(v.charAt(0)) >= 0) {
    return "'" + v;
  }
  return v;
}

/**
 * Ejecuta fn() bajo ScriptLock (PURGA #4). Serializa secciones lee-max-escribe
 * (nextId + appendFila) para que trigger y corrida manual solapados no generen
 * IDs duplicados. No reentrante: lockear en los callers (crearAviso/crearCliente),
 * nunca anidado dentro de nextId.
 * PURGA #7 (E8a): es lock GLOBAL de script → upserts de cerebro de tenants distintos
 * serializan en un único lock. Aceptado en piloto (es seguro); revisar si se paraleliza.
 */
function conLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // 20 s; lanza si no lo consigue (mejor que correr sin lock)
  try { return fn(); }
  finally { lock.releaseLock(); }
}

/**
 * Abre el Sheet de un cliente por id. Devuelve { cli (fila de Clientes), ss }.
 * Punto único para no duplicar el patrón leerTabla+openByUrl en costos/aprobaciones/agentes.
 */
// PURGA #1: cache de handles openByUrl por ejecución. El handle relee el Sheet en cada
// llamada (no cachea celdas) → seguro aun en instancias V8 "warm"; solo evita reabrir.
var _ssClienteCache_ = {};
function abrirCliente(idCliente) {
  var cli = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (f) {
    return f.id_cliente === idCliente;
  })[0];
  if (!cli || !cli.url_sheet_cliente) throw new Error('cliente ' + idCliente + ' sin Sheet');
  var url = cli.url_sheet_cliente;
  if (!_ssClienteCache_[url]) _ssClienteCache_[url] = SpreadsheetApp.openByUrl(url);
  return { cli: cli, ss: _ssClienteCache_[url] };
}

/** Lee un valor de Config por clave (string). '' si no existe. */
function getConfig(clave) {
  var sh = getMaestro().getSheetByName('Config');
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) if (vals[i][0] === clave) return String(vals[i][1]);
  return '';
}

/** Lee todas las claves de Config que empiezan con `pref` en UNA sola lectura y devuelve
 * un mapa { claveSinPrefijo: valor }. Ej: configPrefijo_('avatar_') → { director: '…', vigia: '' }.
 * Evita N lecturas de la hoja cuando se necesita un grupo de claves (avatares de agentes). */
function configPrefijo_(pref) {
  var sh = getMaestro().getSheetByName('Config');
  var vals = sh.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < vals.length; i++) {
    var k = String(vals[i][0]);
    if (k.indexOf(pref) === 0) out[k.slice(pref.length)] = String(vals[i][1]);
  }
  return out;
}

/** Escribe (upsert) un valor de Config por clave. */
function setConfig(clave, valor) {
  var sh = getMaestro().getSheetByName('Config');
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
  }
  sh.appendRow([clave, valor]);
}

/**
 * Genera el siguiente ID correlativo con prefijo, mirando una columna.
 * Ej: nextId(shClientes, 'id_cliente', 'CLI', 3) → 'CLI-001'.
 */
function nextId(sh, columna, prefijo, ancho) {
  ancho = ancho || 3;
  var filas = leerTabla(sh);
  var max = 0, sucios = 0;
  filas.forEach(function (f) {
    var v = String(f[columna] || '');
    var m = v.match(new RegExp('^' + prefijo + '-(\\d+)'));
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    else if (v !== '') { sucios++; } // ID presente que NO matchea el patrón (coacción a fecha / pegado a mano)
  });
  // PURGA B5 #4: si hay IDs "sucios" (no parseables), el max podría subestimarse → ID duplicado.
  // Piso defensivo = cantidad de filas, SOLO cuando hay sucios (deja el caso limpio idéntico).
  if (sucios > 0 && filas.length > max) max = filas.length;
  var num = String(max + 1);
  while (num.length < ancho) num = '0' + num;
  return prefijo + '-' + num;
}

/**
 * Protege una pestaña (warningOnly opcional). Idempotente.
 * PURGA #7: en protección dura (warningOnly=false) quitamos editores explícitos —
 * hidden NO es control de acceso. Cuando en Etapa 3 se comparta el Sheet con el
 * dueño del negocio, un editor podría des-ocultar y editar Aprobaciones/Costos si
 * no se le retira el permiso de la pestaña. El owner del Sheet sigue pudiendo
 * gestionarla (no se puede auto-excluir), que es justo lo que queremos.
 */
function protegerSheet(sh, warningOnly) {
  var prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  var p = prots.length ? prots[0] : sh.protect();
  p.setDescription('Satori OS — estructura gestionada por el MAESTRO');
  p.setWarningOnly(!!warningOnly);
  if (!warningOnly) {
    try {
      p.removeEditors(p.getEditors());
      if (p.canDomainEdit && p.canDomainEdit()) p.setDomainEdit(false);
    } catch (e) { /* sin editores que quitar o sin dominio: no-op */ }
  }
  return p;
}

// ── T1-B · Cifras SIEMPRE en números (decisión Luciano 17-jul) ──────────────────────────────
//
// El STT transcribe dictados en palabras ("ciento treinta mil pesos") y eso terminó en la
// `descripcion` de un objetivo real. Regla de sistema: al ESCRIBIR datos, las cifras van en
// dígitos con formato es-AR ($130.000). La primera línea de defensa es el prompt de Sato
// (agent.py, normaliza antes de armar el payload); esto es el best-effort SERVER-SIDE:
// determinista, sin LLM, y ACOTADO A PROPÓSITO a montos con multiplicador (mil/millones).
//
// Por qué acotado: sin multiplicador habría que convertir "un"/"una"/"uno", que en castellano
// son artículos ("un objetivo de ventas" → "1 objetivo de ventas"). Exigir mil/millón elimina
// ese falso positivo entero. Si no matchea el patrón conocido, el texto queda TAL CUAL —
// jamás inventa. Los formatters de LECTURA de la voz (A1/A3) no se tocan: se habla natural,
// se escribe en cifras.

/** Palabras-número es-AR (con y sin tilde: el dictado llega de las dos formas). */
var _NUM_PALABRA_ = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, 'dieciséis': 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, 'veintiún': 21, veintidos: 22, 'veintidós': 22,
  veintitres: 23, 'veintitrés': 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, 'veintiséis': 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900
};

/** Multiplicadores. Al menos UNO tiene que aparecer para que el run se convierta (ver docstring). */
var _NUM_MULTIPLICADOR_ = { mil: 1000, millon: 1000000, 'millón': 1000000, millones: 1000000 };

/**
 * Quita tildes/diéresis para comparar texto escrito por humanos ("oficina física" vs "oficina
 * fisica"). NO usa String.normalize: el runtime V8 de GAS la tiene, pero el set es acotado y
 * explícito, que es lo que hace falta acá. Lo consume _pivotMuerto_ (18_direccion.js).
 */
function _sinTildes_(s) {
  return String(s == null ? '' : s)
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
}

/** Separador de miles es-AR: 130000 → "130.000". */
function _fmtMiles_(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Valor de un run de palabras-número, o null si el run no tiene ninguna. */
function _valorPalabras_(tokens) {
  var total = 0, actual = 0, hubo = false;
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (_NUM_PALABRA_.hasOwnProperty(t)) { actual += _NUM_PALABRA_[t]; hubo = true; }
    else if (_NUM_MULTIPLICADOR_.hasOwnProperty(t)) {
      actual = (actual || 1) * _NUM_MULTIPLICADOR_[t];
      total += actual; actual = 0; hubo = true;
    }
    // 'y' es enlace ("treinta y cinco"): no aporta valor.
  }
  return hubo ? (total + actual) : null;
}

/**
 * Convierte montos dictados en palabras a cifras es-AR. Solo toca runs que incluyan un
 * multiplicador (mil/millón/millones); todo lo demás queda intacto.
 *   "Alcanzar un ticket promedio de ciento treinta mil pesos" → "… de $130.000"
 *   "un objetivo de ventas"                                   → sin cambios (no hay multiplicador)
 * @param {string} texto
 * @return {string}
 */
function normalizarCifrasTexto_(texto) {
  var t = String(texto == null ? '' : texto);
  if (!t) return t;
  // Alternación ordenada por largo DESC: así "millones" gana sobre "mil" y "ciento" sobre "cien".
  var palabras = Object.keys(_NUM_PALABRA_).concat(Object.keys(_NUM_MULTIPLICADOR_)).concat(['y'])
    .sort(function (a, b) { return b.length - a.length; });
  var alt = palabras.join('|');
  // BUG encontrado por el golden-set M4 (caso CF-04, 21-jul): sin `\b` la alternación matchea el
  // PREFIJO de una palabra común. "cincuenta mil unidades" comía el "un" de "unidades" y devolvía
  // "50.001idades" — una cifra inventada Y la palabra mutilada, en un texto que ya iba a la hoja.
  // Ninguna clave de las tablas empieza ni termina en carácter acentuado, así que `\b` (ASCII) las
  // delimita bien a todas. Regla que deja el caso: los sufijos NO se validan por buena voluntad.
  var tok = '\\b(?:' + alt + ')\\b';
  var re = new RegExp(tok + '(?:\\s+' + tok + ')*(?:\\s+pesos?\\b)?', 'gi');
  return t.replace(re, function (match) {
    var toks = match.toLowerCase().split(/\s+/).filter(String);
    // ¿Termina en "pesos"/"peso"? → es un monto: sale con $.
    var moneda = false;
    if (toks.length && (toks[toks.length - 1] === 'pesos' || toks[toks.length - 1] === 'peso')) {
      moneda = true; toks.pop();
    }
    // "y" colgando al final ("… mil y pico") no es parte del número: se devuelve tal cual.
    var cola = '';
    while (toks.length && toks[toks.length - 1] === 'y') { toks.pop(); cola = ' y' + cola; }
    var tieneMult = toks.some(function (x) { return _NUM_MULTIPLICADOR_.hasOwnProperty(x); });
    if (!tieneMult) return match;                       // fuera del alcance acotado → intacto
    var v = _valorPalabras_(toks);
    if (v === null || !isFinite(v) || v <= 0) return match;
    return (moneda ? '$' : '') + _fmtMiles_(v) + cola;
  });
}
