/**
 * 29_vigilancia.js — TC-11 · A5 · VIGILANCIA MULTI-SUPERFICIE (04-ago-2026)
 *
 * De vigilar 1 superficie (ventas Vehemence) a N superficies DECLARADAS por cliente.
 * Doctrina D26c (la que mata el verde falso): GRIS = sin datos, y VACÍO JAMÁS ES VERDE.
 * Hoy la mayoría de la cartera queda en gris — eso es lo honesto y lo esperado; el módulo
 * cobra vida a medida que entren conectores y datos reales (B8).
 *
 * Piezas:
 *  · Declaración por cliente (Config, patrón conector_*): `vigilancia_<id>_superficies`
 *    (lista separada por '·'; vacía ⇒ las estándar) + `vigilancia_<id>_fuente_<sup>`
 *    ('sin_fuente' fuerza gris; vacío ⇒ default de VIG_FUENTE_DEFAULT).
 *  · Motor vigilarCliente_(id): corre en corridaDiaria (persiste el resumen compacto en
 *    Config `vigilancia_resumen` para que el brief lo lea SIN abrir Sheets de cliente —
 *    regla SPEC-GAS 14-jul) + on-demand desde la Ficha 360 (endpoint `vigilanciaCliente`,
 *    gateado + alta en ENDPOINTS_UI en este mismo commit, regla anti-drift).
 *  · Juicio PURO _vigJuzgar_ (testeable offline): cada color viaja ANCLADO a su dato
 *    (patrón A2: nunca un color sin su número) y con FRESCURA aplicada — un dato viejo
 *    DEGRADA a gris con nota; jamás se sostiene un verde vencido.
 *
 * AISLAMIENTO (regla dura 29-jul): todo nace anclado a UN id_cliente. El id se valida
 * contra el roster real (§3: el id lo pone el sistema); las lecturas del MAESTRO filtran
 * por ese id; el tenant se abre solo vía abrirCliente(id). Asserts 🔒 en D39.
 */

/**
 * Lista-contrato de superficies estándar.
 * INVARIANTE (aserido en D39, derivado — no clavado a mano): toda superficie de esta lista
 * tiene su fuente default en VIG_FUENTE_DEFAULT. Agregar acá obliga a agregar allá y a
 * darle regla de juicio en _vigJuzgar_ (una superficie sin regla queda en GRIS, nunca verde).
 */
var VIGILANCIA_SUPERFICIES = ['ventas', 'operativos_caja', 'kpis', 'aprobaciones', 'tareas', 'resenas', 'fiscal'];

/**
 * Fuente default por superficie: 'conector'/'hoja' = Sheet del tenant · 'maestro' = espejo
 * del MAESTRO · 'sin_fuente' = nace en gris con nota. Reseñas y fiscal NACEN sin fuente a
 * propósito (prohibido inventarles una en TC-11): entran a mano o con B8.
 */
var VIG_FUENTE_DEFAULT = {
  ventas: 'conector', operativos_caja: 'hoja', kpis: 'hoja',
  aprobaciones: 'maestro', tareas: 'maestro', resenas: 'sin_fuente', fiscal: 'sin_fuente'
};

var VIG_NOTA_SIN_FUENTE = 'sin conector — entra a mano o con B8';

/** PURA — días entre dos fechas ISO (el "hoy" se INYECTA: el juicio es testeable offline).
 *  null si alguna fecha es ilegible (el caller decide qué hacer con la duda — nunca verde). */
function _vigDias_(desdeISO, hastaISO) {
  var a = aFechaISO(desdeISO), b = aFechaISO(hastaISO);
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/** PURA — umbrales de vigilancia con default PRUDENTE. Recibe el mapa configPrefijo_('vig_')
 *  (una sola lectura de Config para las 4 claves). Vacío/no-numérico ⇒ default, no NaN. */
function _vigUmbrales_(cfg) {
  cfg = cfg || {};
  function num(k, d) {
    if (cfg[k] === '' || cfg[k] == null) return d;
    var v = Number(cfg[k]);
    return isNaN(v) ? d : v;
  }
  return {
    frescura_dias: num('frescura_dias', 10),
    ambar_caida_pct: num('ambar_caida_pct', 10),
    rojo_caida_pct: num('rojo_caida_pct', 30),
    aprob_dias: num('aprob_dias', 7)
  };
}

/**
 * PURA — EL JUICIO: una superficie observada → { superficie, color, dato, nota, fecha_dato }.
 * Colores: verde / ambar / rojo / gris. Reglas deterministas:
 *  · sin observación, sin filas o sin fuente ⇒ GRIS (D26c: vacío jamás verde).
 *  · dato más viejo que vig_frescura_dias ⇒ DEGRADA a gris con nota (conserva el ancla).
 *  · ventas: caída % entre los dos últimos meses CERRADOS (el mes en curso es parcial y
 *    compararlo fabricaría una caída falsa) — ≥rojo_caida_pct rojo, ≥ambar_caida_pct ámbar.
 *  · operativos_caja: mes de referencia (el del último dato) en negativo ⇒ rojo.
 *  · kpis: alerta no vacía ⇒ rojo · valor bajo el objetivo ⇒ ámbar.
 *  · aprobaciones: estancada > vig_aprob_dias ⇒ rojo · pendientes ⇒ ámbar · 0 REAL ⇒ verde
 *    (un cero leído del espejo es dato, no vacío; sin lectura ⇒ gris).
 *  · tareas: vencidas ⇒ rojo · nada en marcha ⇒ ámbar · sin proyectos cargados ⇒ gris.
 *  · superficie sin regla declarada ⇒ gris (fail-honest, nunca verde por defecto).
 * TODO juicio sale con su dato ancla (patrón A2), aunque el dato sea "sin datos".
 */
function _vigJuzgar_(sup, obs, umb, hoy) {
  var r = { superficie: sup, color: 'gris', dato: 'sin datos', nota: '', fecha_dato: '' };
  if (!obs || obs.fuente === 'sin_fuente') { r.nota = VIG_NOTA_SIN_FUENTE; return r; }
  if (obs.sin_acceso) { r.nota = 'Sheet del cliente inaccesible'; return r; }

  function esViejo(fechaISO) {
    var d = _vigDias_(fechaISO, hoy);
    return (d == null) || d > umb.frescura_dias;
  }

  if (sup === 'ventas') {
    var meses = obs.meses || [];
    if (!meses.length) { r.nota = 'sin ventas del conector todavía'; return r; }
    var ult = meses[meses.length - 1];
    r.dato = 'ventas ' + ult.mes + ' = ' + ult.total;
    r.fecha_dato = obs.ultima_fecha || '';
    if (esViejo(obs.ultima_fecha)) { r.nota = 'dato viejo (último ' + (obs.ultima_fecha || 'sin fecha') + ')'; return r; }
    var mesActual = String(hoy || '').slice(0, 7);
    var cerrados = meses.filter(function (m) { return String(m.mes) < mesActual; });
    if (cerrados.length >= 2) {
      var a = cerrados[cerrados.length - 2], b = cerrados[cerrados.length - 1];
      if (Number(a.total) > 0) {
        var caida = (a.total - b.total) / a.total * 100;
        if (caida >= umb.rojo_caida_pct) { r.color = 'rojo'; r.nota = 'caída ' + Math.round(caida) + '% vs ' + a.mes; return r; }
        if (caida >= umb.ambar_caida_pct) { r.color = 'ambar'; r.nota = 'caída ' + Math.round(caida) + '% vs ' + a.mes; return r; }
      }
      r.color = 'verde'; return r;
    }
    r.color = 'verde'; r.nota = 'sin dos meses cerrados para comparar'; return r;
  }

  if (sup === 'operativos_caja') {
    if (!obs.filas) { r.nota = 'sin movimientos manuales cargados'; return r; }
    r.dato = 'mes ' + obs.mes + ' = ' + obs.total_mes;
    r.fecha_dato = obs.ultima_fecha || '';
    if (esViejo(obs.ultima_fecha)) { r.nota = 'dato viejo (último ' + (obs.ultima_fecha || 'sin fecha') + ')'; return r; }
    if (Number(obs.total_mes) < 0) { r.color = 'rojo'; r.nota = 'el mes de referencia da negativo'; return r; }
    r.color = 'verde'; return r;
  }

  if (sup === 'kpis') {
    if (!obs.kpi) { r.nota = 'sin KPIs cargados'; return r; }
    r.dato = obs.kpi + ' = ' + obs.valor + (obs.objetivo != null ? ' (objetivo ' + obs.objetivo + ')' : '');
    r.fecha_dato = obs.fecha || '';
    if (esViejo(obs.fecha)) { r.nota = 'dato viejo (último ' + (obs.fecha || 'sin fecha') + ')'; return r; }
    if (obs.alerta) { r.color = 'rojo'; r.nota = obs.alerta; return r; }
    if (obs.objetivo != null && Number(obs.valor) < Number(obs.objetivo)) { r.color = 'ambar'; r.nota = 'por debajo del objetivo'; return r; }
    r.color = 'verde'; return r;
  }

  if (sup === 'aprobaciones') {
    if (obs.pendientes == null) { r.nota = 'sin lectura del espejo de aprobaciones'; return r; }
    r.dato = obs.pendientes + ' aprobación(es) pendiente(s)';
    if (obs.mas_vieja_dias != null && obs.mas_vieja_dias > umb.aprob_dias) {
      r.color = 'rojo'; r.nota = 'la más vieja lleva ' + obs.mas_vieja_dias + ' día(s)'; return r;
    }
    if (obs.pendientes > 0) { r.color = 'ambar'; return r; }
    r.color = 'verde'; return r;   // 0 REAL leído del espejo: es dato, no vacío
  }

  if (sup === 'tareas') {
    if (obs.proyectos == null) { r.nota = 'sin lectura del MAESTRO'; return r; }
    if (!obs.proyectos) { r.dato = 'sin proyectos cargados'; return r; }   // gris: nunca verde por vacío
    r.dato = (obs.abiertas || 0) + ' abierta(s) · ' + (obs.vencidas || 0) + ' vencida(s)';
    if (obs.vencidas > 0) { r.color = 'rojo'; r.nota = obs.peor ? 'vencida: ' + obs.peor : ''; return r; }
    if (!obs.abiertas) { r.color = 'ambar'; r.nota = 'nada en marcha para este cliente'; return r; }
    r.color = 'verde'; return r;
  }

  r.nota = 'superficie sin regla de juicio — queda en gris';
  return r;
}

/**
 * I/O — observaciones CRUDAS de un cliente para el juicio. SOLO lectura; nada se escribe.
 * Tenant: una única apertura vía abrirCliente(id) (si falla, las superficies del tenant
 * salen con sin_acceso=true y el juicio lo dice — no un gris que parezca "sin datos").
 * MAESTRO: filas SIEMPRE filtradas por id_cliente (aislamiento §1).
 */
function _vigObservar_(idCliente, sups, fuentes) {
  var obs = {};
  var hoy = hoyISO();
  var quiereTenant = sups.filter(function (s) {
    var f = fuentes[s] || '';
    return f !== 'sin_fuente' && (VIG_FUENTE_DEFAULT[s] === 'conector' || VIG_FUENTE_DEFAULT[s] === 'hoja');
  }).length > 0;
  var cs = null;
  if (quiereTenant) { try { cs = abrirCliente(idCliente).ss; } catch (e) { cs = null; } }
  function hojaT(n) { if (!cs) return null; var sh = cs.getSheetByName(n); return sh ? leerTabla(sh) : null; }

  var op = null;
  if (sups.indexOf('ventas') >= 0 || sups.indexOf('operativos_caja') >= 0) op = hojaT('Datos_operativos');

  if (sups.indexOf('ventas') >= 0 && fuentes.ventas !== 'sin_fuente') {
    if (quiereTenant && !cs) obs.ventas = { sin_acceso: true };
    else {
      // mismo criterio que _numeroConectorCliente_ (25_hilo.js): lo del conector lleva 'SGIC' en fuente
      var vent = (op || []).filter(function (f) { return String(f.fuente || '').indexOf('SGIC') >= 0; });
      var porMes = {}, maxF = '';
      vent.forEach(function (f) {
        var fe = aFechaISO(f.fecha) || '';
        if (!fe) return;
        var m = fe.slice(0, 7);
        porMes[m] = (porMes[m] || 0) + (Number(f.valor) || 0);
        if (fe > maxF) maxF = fe;
      });
      obs.ventas = {
        meses: Object.keys(porMes).sort().map(function (m) { return { mes: m, total: Math.round(porMes[m]) }; }),
        ultima_fecha: maxF
      };
    }
  }

  if (sups.indexOf('operativos_caja') >= 0 && fuentes.operativos_caja !== 'sin_fuente') {
    if (quiereTenant && !cs) obs.operativos_caja = { sin_acceso: true };
    else {
      var caja = (op || []).filter(function (f) { return String(f.fuente || '').indexOf('SGIC') < 0; });
      var maxC = '';
      caja.forEach(function (f) { var fe = aFechaISO(f.fecha) || ''; if (fe > maxC) maxC = fe; });
      var mesC = maxC ? maxC.slice(0, 7) : '';
      var tot = 0;
      caja.forEach(function (f) {
        var fe = aFechaISO(f.fecha) || '';
        if (fe && fe.slice(0, 7) === mesC) tot += (Number(f.valor) || 0);
      });
      obs.operativos_caja = { filas: caja.length, mes: mesC, total_mes: Math.round(tot), ultima_fecha: maxC };
    }
  }

  if (sups.indexOf('kpis') >= 0 && fuentes.kpis !== 'sin_fuente') {
    if (quiereTenant && !cs) obs.kpis = { sin_acceso: true };
    else {
      var kp = hojaT('KPIs');
      var ultK = null;
      (kp || []).forEach(function (k) {
        var fe = aFechaISO(k.fecha) || '';
        if (!ultK || fe >= (ultK.fecha || '')) {
          ultK = {
            kpi: String(k.kpi || ''), valor: Number(k.valor),
            objetivo: (k.objetivo === '' || k.objetivo == null) ? null : Number(k.objetivo),
            alerta: String(k.alerta || ''), fecha: fe
          };
        }
      });
      obs.kpis = ultK || {};
    }
  }

  if (sups.indexOf('aprobaciones') >= 0 && fuentes.aprobaciones !== 'sin_fuente') {
    try {
      var pend = leerTabla(getMaestro().getSheetByName('Aprobaciones_agregadas'))
        .filter(function (a) { return String(a.id_cliente) === String(idCliente); });
      var masVieja = null;
      pend.forEach(function (a) {
        var d = _vigDias_(a.fecha_creacion, hoy);
        if (d != null && (masVieja == null || d > masVieja)) masVieja = d;
      });
      obs.aprobaciones = { pendientes: pend.length, mas_vieja_dias: masVieja };
    } catch (e) { obs.aprobaciones = {}; }   // sin lectura ⇒ el juicio da gris, no un 0 verde falso
  }

  if (sups.indexOf('tareas') >= 0 && fuentes.tareas !== 'sin_fuente') {
    try {
      var proys = leerTabla(getMaestro().getSheetByName('Proyectos'))
        .filter(function (p) { return String(p.id_cliente) === String(idCliente); });
      var ids = {};
      proys.forEach(function (p) { ids[p.id_proyecto] = true; });
      var ts = tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas')))
        .filter(function (t) { return ids[t.id_proyecto]; });
      var venc = ts.filter(function (t) { return esVencida(t.fecha_limite, t.estado); });
      obs.tareas = {
        proyectos: proys.length, abiertas: ts.length, vencidas: venc.length,
        peor: venc.length ? String(venc[0].descripcion || '').slice(0, 60) : ''
      };
    } catch (e) { obs.tareas = {}; }
  }

  return obs;
}

/**
 * Motor por cliente: declaración de Config → observar → juzgar. Read-only.
 * @return {{id_cliente:string, fecha:string, superficies:Array}}
 */
function vigilarCliente_(idCliente) {
  var id = String(idCliente || '').trim();
  var cfg = configPrefijo_('vigilancia_' + id + '_');   // 1 lectura de Config para todo el bloque del cliente
  var umb = _vigUmbrales_(configPrefijo_('vig_'));
  var sups = String(cfg.superficies || '').split('·')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return !!s; });
  if (!sups.length) sups = VIGILANCIA_SUPERFICIES.slice();
  var fuentes = {};
  sups.forEach(function (s) { fuentes[s] = String(cfg['fuente_' + s] || VIG_FUENTE_DEFAULT[s] || 'sin_fuente'); });
  var hoy = hoyISO();
  var obs = _vigObservar_(id, sups, fuentes);
  var superficies = sups.map(function (s) {
    var o = (fuentes[s] === 'sin_fuente') ? { fuente: 'sin_fuente' } : obs[s];
    return _vigJuzgar_(s, o, umb, hoy);
  });
  return { id_cliente: id, fecha: hoy, superficies: superficies };
}

/**
 * Endpoint de la Ficha 360 (on-demand). Client-callable ⇒ gate _soloOwner_ + alta en
 * ENDPOINTS_UI en ESTE commit (regla anti-drift). AISLAMIENTO §3: el id se valida contra el
 * roster real del MAESTRO — un id inventado o fuera del roster NO se consulta.
 */
function vigilanciaCliente(idCliente) {
  _soloOwner_('vigilanciaCliente');
  var id = String(idCliente || '').trim();
  if (!id) return { ok: false, error: 'sin id de cliente' };
  var existe = leerTabla(getMaestro().getSheetByName('Clientes'))
    .filter(function (c) { return String(c.id_cliente) === id; }).length > 0;
  if (!existe) return { ok: false, error: 'cliente fuera del roster' };
  var v = vigilarCliente_(id);
  return { ok: true, id_cliente: v.id_cliente, fecha: v.fecha, superficies: v.superficies };
}

/**
 * Corre dentro de corridaDiaria: evalúa la cartera ACTIVA y persiste el resumen compacto en
 * Config `vigilancia_resumen` (el brief lo lee de ahí sin abrir ningún Sheet de cliente).
 * Fail-safe POR CLIENTE: un tenant roto queda como {id, error} en el resumen — se surfacea
 * en el brief ('⚠ sin acceso'), no se traga (lección 27-jul: error tragado > error ruidoso).
 */
function vigilanciaCorrida_() {
  var activos = ['activo', 'activo-piloto'];
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
    return activos.indexOf(String(c.estado).toLowerCase()) >= 0;
  });
  var res = { fecha: hoyISO(), clientes: [] };
  var conteo = { verde: 0, ambar: 0, rojo: 0, gris: 0, errores: 0 };
  clientes.forEach(function (c) {
    try {
      var v = vigilarCliente_(c.id_cliente);
      res.clientes.push({
        id: v.id_cliente,
        s: v.superficies.map(function (s) {
          conteo[s.color] = (conteo[s.color] || 0) + 1;
          return { sup: s.superficie, color: s.color, dato: String(s.dato || '').slice(0, 60), nota: String(s.nota || '').slice(0, 60) };
        })
      });
    } catch (e) {
      conteo.errores++;
      res.clientes.push({ id: String(c.id_cliente), error: String((e && e.message) || e).slice(0, 80) });
    }
  });
  setConfig('vigilancia_resumen', JSON.stringify(res));
  return { clientes: res.clientes.length, verdes: conteo.verde, ambar: conteo.ambar, rojos: conteo.rojo, grises: conteo.gris, errores: conteo.errores };
}

/** Lee el resumen persistido por la última corrida. Fail-safe: sin corrida o JSON roto ⇒ null
 *  (el brief lo DICE con texto honesto — jamás inventa un estado). */
function _vigResumenCacheado_() {
  try {
    var s = getConfig('vigilancia_resumen');
    if (!s) return null;
    var o = JSON.parse(s);
    return (o && o.clientes && o.clientes.length) ? o : null;
  } catch (e) { return null; }
}

/**
 * PURA — render del resumen para el brief de sistema (sección métricas).
 * «- Vigilancia CLI-002: ventas ✅ · caja ⬜ sin datos · …». El dato ancla acompaña SOLO a
 * rojo/ámbar (lo accionable); verde va limpio y gris dice «sin datos». Resumen de otro día ⇒
 * se declara la fecha (frescura visible). Sin resumen ⇒ una línea honesta.
 */
function _vigLineasBrief_(res, hoy) {
  if (!res || !res.clientes || !res.clientes.length) {
    return ['- Vigilancia: sin corrida todavía — se evalúa en la corridaDiaria.'];
  }
  var ICO = { verde: '✅', ambar: '🟡', rojo: '🔴', gris: '⬜' };
  var NOM = { ventas: 'ventas', operativos_caja: 'caja', kpis: 'KPIs', aprobaciones: 'aprob', tareas: 'tareas', resenas: 'reseñas', fiscal: 'fiscal' };
  var stale = (res.fecha && hoy && res.fecha !== hoy) ? ' (del ' + res.fecha + ')' : '';
  return res.clientes.slice(0, 6).map(function (c) {
    if (c.error) return '- Vigilancia ' + c.id + stale + ': ⚠ sin acceso (' + c.error + ')';
    var partes = (c.s || []).map(function (s) {
      var extra = '';
      if (s.color === 'gris') extra = ' sin datos';
      else if (s.color === 'rojo' || s.color === 'ambar') extra = s.dato ? ' ' + s.dato : '';
      return (NOM[s.sup] || s.sup) + ' ' + (ICO[s.color] || '·') + extra;
    });
    return '- Vigilancia ' + c.id + stale + ': ' + partes.join(' · ');
  });
}
