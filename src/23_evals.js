/**
 * 23_evals.js — Golden-set + runner de evals (T3 · MÓDULO M · M4, 21-jul-2026).
 *
 * Qué resuelve: hasta hoy la única red era `selfTest`, que verifica que el sistema NO REVIENTE.
 * No había nada que verificara que sigue DECIDIENDO BIEN. Un cambio en `parseQuickAdd` o en el
 * normalizador de cifras pasa selfTest en verde y aun así rompe la captura por voz en silencio.
 *
 * Diseño (2 pisos, deliberado):
 *
 *   PISO DETERMINÍSTICO (familias `quick_add`, `cifras`, `pivot`, `clasificador_parse`)
 *     Entrada → salida EXACTA. No depende de ningún modelo, no gasta un centavo de API y por eso
 *     puede correr dentro de `selfTest` como tanda **D22**. Si un caso de acá se pone rojo, es una
 *     regresión de producto, no ruido del LLM.
 *
 *   PISO LLM (familia `clasificador_llm`)
 *     El clasificador de Bandeja SÍ depende de Haiku. Aserir el texto exacto de su salida sería
 *     aserir el modelo, no el sistema: cambia el modelo y el eval miente. Por eso acá se asera
 *     ESTRUCTURA y RANGO (bin dentro del vocabulario, confianza 1-10, campos presentes), no el
 *     contenido. Corre SOLO bajo pedido explícito (`correrEvals({conApi:true})`) porque gasta.
 *
 * Dónde vive el golden-set: en ESTE archivo, como constante. Es la única forma de que esté
 * versionado en el repo Y disponible en runtime — GAS no puede leer `docs/evals/*.json` del Mac,
 * y una hoja `Evals` habría puesto la fuente de verdad fuera del control de versiones (editable
 * a mano, sin diff, sin revisión). Ver `docs/evals/README.md`.
 *
 * Regla al agregar casos: sacalos de flujos REALES (capturas de voz que pasaron, objetivos
 * cargados de verdad, pivots escritos por Luciano). Un golden-set inventado asera la imaginación
 * de quien lo escribió, no el sistema.
 */

// Familias que NO tocan la API: son las que entran a selfTest (D22).
var EVALS_FAMILIAS_DET = ['quick_add', 'cifras', 'pivot', 'clasificador_parse'];

/**
 * Golden-set versionado. Cada caso: {id, familia, entrada, esperado, nota?}.
 * `entrada`/`esperado` son datos planos (JSON-able) — nunca funciones: un caso tiene que poder
 * leerse y discutirse sin ejecutar nada.
 */
var EVALS_GOLDEN = [
  // ── quick_add (parseQuickAdd, 08_webapp.js) — el parser del quick-add del tablero y de la voz.
  // `hoy` fijo para que el caso sea determinístico también en las fechas relativas.
  { id: 'QA-01', familia: 'quick_add', nota: 'caso base: sin sigilos, todo default',
    entrada: { str: 'Llamar al contador', hoy: '2026-07-21' },
    esperado: { descripcion: 'Llamar al contador', prioridad: 'B', tipo: 'personal', fecha_limite: '', recurrencia: '', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-02', familia: 'quick_add', nota: 'prioridad !a + fecha relativa "hoy"',
    entrada: { str: 'Cerrar la propuesta !a hoy', hoy: '2026-07-21' },
    esperado: { descripcion: 'Cerrar la propuesta', prioridad: 'A', tipo: 'personal', fecha_limite: '2026-07-21', recurrencia: '', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-03', familia: 'quick_add', nota: '"mañana" con ñ',
    entrada: { str: 'Revisar el brief mañana', hoy: '2026-07-21' },
    esperado: { descripcion: 'Revisar el brief', prioridad: 'B', tipo: 'personal', fecha_limite: '2026-07-22', recurrencia: '', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-04', familia: 'quick_add', nota: '@cliente ⇒ tipo cliente (aunque no exista el tenant)',
    entrada: { str: 'Pedir facturas @vehemence', hoy: '2026-07-21' },
    esperado: { descripcion: 'Pedir facturas', prioridad: 'B', tipo: 'cliente', fecha_limite: '', recurrencia: '', etiquetas: '', cliente_txt: 'vehemence' } },
  { id: 'QA-05', familia: 'quick_add', nota: 'recurrencia ⇒ tipo periodica',
    entrada: { str: 'Backup manual cada semana', hoy: '2026-07-21' },
    esperado: { descripcion: 'Backup manual', prioridad: 'B', tipo: 'periodica', fecha_limite: '', recurrencia: '1s', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-06', familia: 'quick_add', nota: 'etiquetas múltiples + tipo explícito ^admin gana sobre el inferido',
    entrada: { str: 'Pagar monotributo #impuestos #ar ^admin', hoy: '2026-07-21' },
    esperado: { descripcion: 'Pagar monotributo', prioridad: 'B', tipo: 'admin', fecha_limite: '', recurrencia: '', etiquetas: 'impuestos,ar', cliente_txt: '' } },
  { id: 'QA-07', familia: 'quick_add', nota: 'fecha dd/mm futura del mismo año',
    entrada: { str: 'Presentar informe 30/9', hoy: '2026-07-21' },
    esperado: { descripcion: 'Presentar informe', prioridad: 'B', tipo: 'personal', fecha_limite: '2026-09-30', recurrencia: '', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-08', familia: 'quick_add', nota: 'fecha dd/mm YA PASADA ⇒ rueda al año próximo (no agenda en el pasado)',
    entrada: { str: 'Renovar dominio 3/2', hoy: '2026-07-21' },
    esperado: { descripcion: 'Renovar dominio', prioridad: 'B', tipo: 'personal', fecha_limite: '2027-02-03', recurrencia: '', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-09', familia: 'quick_add', nota: 'string vacío ⇒ estructura completa con descripcion vacía (no revienta)',
    entrada: { str: '   ', hoy: '2026-07-21' },
    esperado: { descripcion: '', prioridad: 'B', tipo: '', fecha_limite: '', recurrencia: '', etiquetas: '', cliente_txt: '' } },
  { id: 'QA-10', familia: 'quick_add', nota: 'combo real de voz: cliente + prioridad + límite',
    entrada: { str: 'Mandar el reporte @dam !a mañana', hoy: '2026-07-21' },
    esperado: { descripcion: 'Mandar el reporte', prioridad: 'A', tipo: 'cliente', fecha_limite: '2026-07-22', recurrencia: '', etiquetas: '', cliente_txt: 'dam' } },

  // ── cifras (normalizarCifrasTexto_, 07_util.js) — montos dictados por voz → números es-AR.
  { id: 'CF-01', familia: 'cifras', nota: 'caso canónico del handoff de voz',
    entrada: { texto: 'Alcanzar un ticket promedio de ciento treinta mil pesos' },
    esperado: { texto: 'Alcanzar un ticket promedio de $130.000' } },
  { id: 'CF-02', familia: 'cifras', nota: 'sin multiplicador ⇒ intacto (fuera del alcance acotado)',
    entrada: { texto: 'un objetivo de ventas' },
    esperado: { texto: 'un objetivo de ventas' } },
  { id: 'CF-03', familia: 'cifras', nota: 'millones; "de pesos" NO es el sufijo de moneda (solo "…pesos" pegado al número) ⇒ sale sin $',
    entrada: { texto: 'facturar dos millones de pesos' },
    esperado: { texto: 'facturar 2.000.000 de pesos' } },
  { id: 'CF-04', familia: 'cifras', nota: 'sin "pesos" ⇒ número sin símbolo de moneda',
    entrada: { texto: 'llegar a cincuenta mil unidades' },
    esperado: { texto: 'llegar a 50.000 unidades' } },
  { id: 'CF-05', familia: 'cifras', nota: 'texto sin números ⇒ intacto',
    entrada: { texto: 'revisar la propuesta con el cliente' },
    esperado: { texto: 'revisar la propuesta con el cliente' } },
  { id: 'CF-06', familia: 'cifras', nota: 'vacío ⇒ vacío (no revienta)',
    entrada: { texto: '' },
    esperado: { texto: '' } },
  { id: 'CF-07', familia: 'cifras', nota: 'enlace "y" dentro del número',
    entrada: { texto: 'un tope de treinta y cinco mil pesos' },
    esperado: { texto: 'un tope de $35.000' } },
  { id: 'CF-08', familia: 'cifras', nota: 'REGRESIÓN (bug hallado por este golden-set, 21-jul): "dosis" empieza con "dos" — sin \\b se comía el prefijo y devolvía 80.002 + "is"',
    entrada: { texto: 'vender ochenta mil dosis' },
    esperado: { texto: 'vender 80.000 dosis' } },
  { id: 'CF-09', familia: 'cifras', nota: 'REGRESIÓN gemela: "unidades" empieza con "un"',
    entrada: { texto: 'entregar dos mil unidades' },
    esperado: { texto: 'entregar 2.000 unidades' } },

  // ── pivot (_pivotMuerto_, 18_direccion.js) — no re-proponer un camino ya descartado.
  { id: 'PV-01', familia: 'pivot', nota: 'match por substring normalizado (sin tildes)',
    entrada: { texto: 'Abrir una oficina física en Palermo', pivots: [{ fecha: '2026-05-01', que: 'oficina fisica', porque: 'costo fijo' }] },
    esperado: { muerto: true, que: 'oficina fisica' } },
  { id: 'PV-02', familia: 'pivot', nota: 'sin coincidencia ⇒ la rec sobrevive',
    entrada: { texto: 'Cerrar la vencida más vieja', pivots: [{ fecha: '2026-05-01', que: 'oficina fisica', porque: 'costo fijo' }] },
    esperado: { muerto: false } },
  { id: 'PV-03', familia: 'pivot', nota: 'sigla corta (<4 chars) se IGNORA a propósito: silenciaría recs legítimas',
    entrada: { texto: 'Revisar la campaña de ads del cliente', pivots: [{ fecha: '2026-05-01', que: 'ads', porque: 'no convertía' }] },
    esperado: { muerto: false } },
  { id: 'PV-04', familia: 'pivot', nota: 'lista de pivots vacía ⇒ nunca mata nada',
    entrada: { texto: 'Cualquier recomendación', pivots: [] },
    esperado: { muerto: false } },
  { id: 'PV-05', familia: 'pivot', nota: 'case-insensitive',
    entrada: { texto: 'Contratar un COMMUNITY MANAGER externo', pivots: [{ fecha: '2026-06-01', que: 'community manager', porque: 'no movió la aguja' }] },
    esperado: { muerto: true, que: 'community manager' } },

  // ── clasificador_parse (parseClasificacion_, 17_bandeja.js) — la frontera de confianza:
  // el LLM propone TEXTO, y este parser decide qué de eso entra al sistema como DATO.
  { id: 'CP-01', familia: 'clasificador_parse', nota: 'JSON limpio pasa tal cual',
    entrada: { texto: '{"bin":"tarea","confianza":8,"slug":"llamar-contador","tags":"admin","resumen":"Llamar al contador","id_cliente":""}' },
    esperado: { bin: 'tarea', confianza: 8, slug: 'llamar-contador', id_cliente: '' } },
  { id: 'CP-02', familia: 'clasificador_parse', nota: 'JSON envuelto en prosa/markdown ⇒ se extrae el bloque',
    entrada: { texto: 'Claro, acá va:\n```json\n{"bin":"idea","confianza":5,"slug":"x","tags":"","resumen":"r","id_cliente":""}\n```' },
    esperado: { bin: 'idea', confianza: 5, slug: 'x', id_cliente: '' } },
  { id: 'CP-03', familia: 'clasificador_parse', nota: 'bin inventado por el modelo ⇒ escalate (no se acepta vocabulario nuevo)',
    entrada: { texto: '{"bin":"urgentisimo","confianza":9,"slug":"s","tags":"","resumen":"r","id_cliente":""}' },
    esperado: { bin: 'escalate', confianza: 9, slug: 's', id_cliente: '' } },
  { id: 'CP-04', familia: 'clasificador_parse', nota: 'confianza fuera de rango ⇒ CLAMP a 10 (jamás 99)',
    entrada: { texto: '{"bin":"tarea","confianza":99,"slug":"s","tags":"","resumen":"r","id_cliente":""}' },
    esperado: { bin: 'tarea', confianza: 10, slug: 's', id_cliente: '' } },
  { id: 'CP-05', familia: 'clasificador_parse', nota: 'confianza no numérica ⇒ 1 (la mínima, no la máxima: fail-closed)',
    entrada: { texto: '{"bin":"tarea","confianza":"mucha","slug":"s","tags":"","resumen":"r","id_cliente":""}' },
    esperado: { bin: 'tarea', confianza: 1, slug: 's', id_cliente: '' } },
  { id: 'CP-06', familia: 'clasificador_parse', nota: 'respuesta sin JSON ⇒ null (el caller escala, no adivina)',
    entrada: { texto: 'No entendí el input, ¿podés reformular?' },
    esperado: null },
  { id: 'CP-07', familia: 'clasificador_parse', nota: 'JSON roto ⇒ null',
    entrada: { texto: '{"bin":"tarea", "confianza":' },
    esperado: null },
  { id: 'CP-08', familia: 'clasificador_parse', nota: 'campos ausentes ⇒ defaults vacíos, sin undefined suelto',
    entrada: { texto: '{"bin":"lead","confianza":7}' },
    esperado: { bin: 'lead', confianza: 7, slug: '', id_cliente: '' } },

  // ── clasificador_llm — SOLO con conApi:true. Se asera ESTRUCTURA, nunca el texto del modelo.
  { id: 'CL-01', familia: 'clasificador_llm', nota: 'una tarea evidente debería salir accionable y con confianza usable',
    entrada: { texto: 'Llamar mañana al contador para cerrar el monotributo' }, esperado: { estructura: true } },
  { id: 'CL-02', familia: 'clasificador_llm', nota: 'input incomprensible: lo importante es que la ESTRUCTURA aguante',
    entrada: { texto: 'asdkjh qwe zzz' }, esperado: { estructura: true } }
];

// ── Ejecutores por familia (deterministas) ──────────────────────────────────
//
// Cada uno devuelve el objeto OBSERVADO con exactamente las claves que el caso declara en
// `esperado`. Comparar solo las claves declaradas (y no el objeto entero) es deliberado: así
// agregar un campo nuevo a una salida no pone en rojo 20 casos que no hablaban de ese campo.

/** Ejecuta un caso determinístico. @return {{ok:boolean, obtenido:*, detalle:string}} */
function _correrEvalDet_(caso) {
  var obtenido;
  try {
    obtenido = _evalEjecutar_(caso);
  } catch (e) {
    return { ok: false, obtenido: null, detalle: 'EXCEPCIÓN: ' + ((e && e.message) || e) };
  }
  return _evalComparar_(caso.esperado, obtenido);
}

/** Despacha el caso a la función real del sistema (0 API en todas estas familias). */
function _evalEjecutar_(caso) {
  var e = caso.entrada || {};
  switch (caso.familia) {
    case 'quick_add': {
      var q = parseQuickAdd(e.str, e.hoy);
      return {
        descripcion: q.descripcion, prioridad: q.prioridad, tipo: q.tipo,
        fecha_limite: q.fecha_limite, recurrencia: q.recurrencia,
        etiquetas: (q.etiquetas || []).join(','), cliente_txt: q.cliente_txt
      };
    }
    case 'cifras':
      return { texto: normalizarCifrasTexto_(e.texto) };
    case 'pivot': {
      var m = _pivotMuerto_({ texto: e.texto }, e.pivots || []);
      return m ? { muerto: true, que: m.que } : { muerto: false };
    }
    case 'clasificador_parse':
      return parseClasificacion_(e.texto);
    default:
      throw new Error('familia sin ejecutor determinístico: ' + caso.familia);
  }
}

/**
 * Compara SOLO las claves declaradas en `esperado`. `esperado === null` exige `obtenido === null`
 * (el caso "el parser rechaza"). Comparación por String() para no pelear con 8 vs '8' en celdas.
 * @return {{ok:boolean, obtenido:*, detalle:string}}
 */
function _evalComparar_(esperado, obtenido) {
  if (esperado === null) {
    return { ok: obtenido === null, obtenido: obtenido, detalle: obtenido === null ? '' : 'esperaba null y volvió ' + JSON.stringify(obtenido) };
  }
  if (obtenido === null || obtenido === undefined) {
    return { ok: false, obtenido: obtenido, detalle: 'esperaba un objeto y volvió ' + String(obtenido) };
  }
  var difs = [];
  Object.keys(esperado).forEach(function (k) {
    var exp = String(esperado[k]), got = String(obtenido[k]);
    if (exp !== got) difs.push(k + ': esperaba "' + exp + '", obtuvo "' + got + '"');
  });
  return { ok: !difs.length, obtenido: obtenido, detalle: difs.join(' · ') };
}

/**
 * Valida la ESTRUCTURA de una clasificación (piso LLM). No mira el contenido: qué bin eligió el
 * modelo es criterio, no contrato. Lo que sí es contrato: que salga del vocabulario cerrado y con
 * la confianza en rango — o sea, que la frontera de confianza haya hecho su trabajo.
 */
function _evalEstructuraClasificacion_(c) {
  if (!c) return { ok: false, detalle: 'el clasificador no devolvió nada parseable' };
  var difs = [];
  if (BANDEJA_BINS.indexOf(String(c.bin)) < 0) difs.push('bin fuera del vocabulario: ' + c.bin);
  var n = Number(c.confianza);
  if (isNaN(n) || n < 1 || n > 10) difs.push('confianza fuera de 1-10: ' + c.confianza);
  ['slug', 'tags', 'resumen', 'id_cliente'].forEach(function (k) {
    if (typeof c[k] !== 'string') difs.push(k + ' no es string');
  });
  return { ok: !difs.length, detalle: difs.join(' · ') };
}

/**
 * Corre el golden-set. Determinísticos SIEMPRE (0 API); la familia LLM solo con `conApi:true`.
 * Pensado para correr a mano desde el editor. `selfTest` corre el piso determinístico como D22
 * (ver `_asertsD22_`), así que un rojo acá nunca depende de acordarse de correr esto.
 *
 * @param {Object} [opts] { conApi?:boolean, familia?:string (filtra a una sola) }
 * @return {{total:number, ok:number, fallos:Array, por_familia:Object, api:boolean}}
 */
function correrEvals(opts) {
  opts = opts || {};
  var casos = EVALS_GOLDEN.filter(function (c) {
    if (opts.familia && c.familia !== opts.familia) return false;
    if (EVALS_FAMILIAS_DET.indexOf(c.familia) >= 0) return true;
    return !!opts.conApi;   // familias LLM: opt-in explícito (gastan)
  });

  var res = { total: 0, ok: 0, fallos: [], por_familia: {}, api: !!opts.conApi };
  casos.forEach(function (c) {
    var r;
    if (EVALS_FAMILIAS_DET.indexOf(c.familia) >= 0) {
      r = _correrEvalDet_(c);
    } else {
      // Piso LLM: una llamada real al clasificador; se asera su forma, no su opinión.
      var api = llamadaClasificador_(promptClasificador_(c.entrada.texto, []), 400);
      r = api.ok ? _evalEstructuraClasificacion_(parseClasificacion_(api.texto))
                 : { ok: false, detalle: 'la API falló: ' + (api.error || '?') };
    }
    res.total++;
    var f = res.por_familia[c.familia] || (res.por_familia[c.familia] = { total: 0, ok: 0 });
    f.total++;
    if (r.ok) { res.ok++; f.ok++; }
    else res.fallos.push({ id: c.id, familia: c.familia, nota: c.nota || '', detalle: r.detalle });
  });

  Logger.log('correrEvals: ' + res.ok + '/' + res.total + ' OK' + (res.api ? ' (incl. familia LLM)' : ' (solo determinísticos)') +
             (res.fallos.length ? '\nFALLOS:\n' + res.fallos.map(function (x) { return '  ❌ ' + x.id + ' [' + x.familia + '] ' + x.detalle; }).join('\n') : ''));
  return res;
}

/** No-arg del editor: corre TODO, incluida la familia LLM (gasta API). */
function correrEvalsConApi() { return correrEvals({ conApi: true }); }
