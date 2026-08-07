/**
 * 06_avisos.js — Avisos internos y trigger diario batched (handoff 1.4).
 *
 * UN solo trigger diario (cuota consumer 90 min/día) que procesa todo en una
 * corrida: corre la sync, detecta vencimientos / tareas estancadas / proyectos
 * sin movimiento > N días, y escribe en la pestaña Avisos del MAESTRO.
 * Los avisos son internos a Luciano → corren solos (AREL: nada externo).
 */

var TRIGGER_AVISOS = 'corridaDiaria';

/** Crea un Aviso en el MAESTRO si no existe ya uno activo igual (dedupe). */
/** Alerta por email (opt-in). Manda a OWNER_EMAIL solo si alertas_email_on=true (Property o Config).
 *  No rompe la corrida si falla. dedupKey: si se pasa, no repite el mismo email el mismo dia. */
function alertaEmail_(asunto, cuerpo, dedupKey) {
  try {
    var props = PropertiesService.getScriptProperties();
    var on = String(props.getProperty('alertas_email_on') || getConfig('alertas_email_on') || 'false') === 'true';
    if (!on) return false;
    var to = props.getProperty('OWNER_EMAIL') || getConfig('owner_email') || '';
    if (!to) return false;
    if (dedupKey) {
      var k = 'ALERTAMAIL_' + dedupKey;
      if (props.getProperty(k) === hoyISO()) return false;
      props.setProperty(k, hoyISO());
    }
    MailApp.sendEmail(to, '[Satori OS] ' + asunto, cuerpo);
    return true;
  } catch (e) { try { Logger.log('alertaEmail_ fallo: ' + e.message); } catch (_e) {} return false; }
}
/** Verificacion manual (editor): manda un email de prueba si alertas_email_on=true. */
function probarAlertaEmail() {
  _soloOwner_('probarAlertaEmail');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var sent = alertaEmail_('Prueba de alerta', 'Si recibis esto, las alertas por email de Satori OS funcionan.', null);
  return { enviado: sent, nota: sent ? 'email enviado a OWNER_EMAIL' : 'alertas_email_on=false o falta OWNER_EMAIL' };
}

/**
 * P2 F3 (07-jul) — Brief-push: manda el briefDiario por email a OWNER_EMAIL.
 * Opt-in PROPIO: `brief_push_on` = 'true' en Config o Script Property (default OFF,
 * regla Bastión 27-jun; independiente de alertas_email_on). Dedupe: 1 por día.
 * AREL: destinatario = SOLO OWNER_EMAIL (nunca terceros).
 */
function briefPush_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var on = String(props.getProperty('brief_push_on') || getConfig('brief_push_on') || 'false') === 'true';
    if (!on) return { enviado: false, motivo: 'brief_push_on=false' };
    var to = props.getProperty('OWNER_EMAIL') || getConfig('owner_email') || '';
    if (!to) return { enviado: false, motivo: 'falta OWNER_EMAIL' };
    var k = 'BRIEFPUSH_ultimo';
    if (props.getProperty(k) === hoyISO()) return { enviado: false, motivo: 'ya enviado hoy' };
    var md = briefDiario();
    MailApp.sendEmail(to, '[Satori OS] Brief diario — ' + hoyISO(), md);
    props.setProperty(k, hoyISO());
    return { enviado: true };
  } catch (e) {
    try { Logger.log('briefPush_ fallo: ' + e.message); } catch (_e) {}
    return { enviado: false, motivo: 'error: ' + e.message };
  }
}

/** Verificacion manual (editor): fuerza un envio del brief-push (ignora el dedupe del dia, respeta opt-in). */
function probarBriefPush() {
  _soloOwner_('probarBriefPush');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  PropertiesService.getScriptProperties().deleteProperty('BRIEFPUSH_ultimo');
  return briefPush_();
}

function crearAviso(a) {
  _soloOwner_('crearAviso');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  return _crearAviso_(a);
}

/**
 * Sumidero INTERNO de avisos (mismo cuerpo, sin puerta). Existe por un caso concreto y crítico:
 * `vozRechazo_` (08_webapp.js) avisa de un POST NO autorizado, y corre a propósito ANTES de
 * `_ctxSistema_()` — un request sin secreto válido jamás obtiene contexto de sistema (invariante
 * X1/M1a). Con el gate de X4 sobre `crearAviso`, esa llamada tiraba `no_autorizado` dentro del
 * `catch` vacío de `vozRechazo_`: el rechazo seguía devolviendo `unauthorized`, pero **el aviso de
 * intrusión no nacía nunca**. Endurecer la puerta apagaba la alarma, en silencio.
 * Es privada (`_` final ⇒ NO invocable por google.script.run), así que no reabre la superficie RPC
 * que X4 vino a cerrar. Todo camino que NO sea pre-auth debe seguir usando `crearAviso`.
 */
function _crearAviso_(a) {
  var sh = getMaestro().getSheetByName('Avisos');
  return conLock(function () { // PURGA #4: dedupe + nextId + append, atómico
    var activos = leerTabla(sh).filter(function (f) { return String(f.estado) === 'activo'; });
    var dup = activos.filter(function (f) {
      return f.tipo === a.tipo && f.id_cliente === (a.id_cliente || '') && f.mensaje === a.mensaje;
    })[0];
    if (dup) return dup.id_aviso;

    var id = nextId(sh, 'id_aviso', 'AVI', 4);
    appendFila(sh, {
      id_aviso: id,
      origen: a.origen || 'trigger',
      id_cliente: a.id_cliente || '',
      tipo: a.tipo,
      mensaje: a.mensaje,
      estado: 'activo',
      fecha: ahoraISO()
    });
    return id;
  });
}

// ═══ GUARDIÁN FOCO/PAZ (TC-2 · F4b) ═════════════════════════════════════════
//
// Los demás detectores miran el TRABAJO ("esta tarea venció"). Éste mira a LUCIANO: si la carga
// acumulada dejó de ser sostenible. Paz y salud son métricas de resultado de la doctrina Satori,
// no un adorno — un sistema que te ayuda a producir más mientras te quema no está funcionando.
//
// TRES LÍMITES DELIBERADOS:
//  1. SOLO AVISA. Jamás reprograma, cierra ni suelta nada por su cuenta. Decidir qué se suelta es
//     exactamente la clase de decisión que no se delega a un trigger.
//  2. UNA sola cosa a soltar. Un aviso que dice "tenés 9 problemas" agrega peso en vez de sacarlo.
//     Se elige la señal más fuerte y se nombra UN ítem concreto.
//  3. MÁXIMO 1 POR DÍA. Un guardián que canta todos los días se vuelve ruido, y entonces no está
//     el día que importa.

/**
 * Decide si hay sobrecarga y qué soltar. PURA (métricas y umbrales adentro, veredicto afuera):
 * así el juicio se asera sin Sheets ni fechas vivas, que es lo que lo hace testeable de verdad.
 * @param {Object} m {vencidas_A:number, peor_tarea:string, eventos_pico:number, dia_pico:string,
 *                    aprob_estancadas:number}
 * @param {Object} u umbrales ya resueltos {max_vencidas_A, max_eventos_dia, max_aprob_estancadas}
 * @return {{hay:boolean, senales:Array<string>, recomendacion:string, motivo:string}}
 */
function _focoPazEvaluar_(m, u) {
  m = m || {}; u = u || {};
  var senales = [];
  var candidatas = [];   // {peso, motivo, recomendacion}

  var vA = Number(m.vencidas_A || 0), maxA = Number(u.max_vencidas_A || 0);
  if (maxA > 0 && vA > maxA) {
    senales.push(vA + ' tareas [A] vencidas (umbral ' + maxA + ')');
    candidatas.push({
      peso: vA - maxA,
      motivo: 'tareas_A_vencidas',
      recomendacion: m.peor_tarea
        ? ('Soltá o reprogramá UNA: «' + m.peor_tarea + '». Es la más vieja de las [A] vencidas.')
        : 'Soltá o reprogramá UNA de las tareas [A] vencidas.'
    });
  }

  var ev = Number(m.eventos_pico || 0), maxEv = Number(u.max_eventos_dia || 0);
  if (maxEv > 0 && ev > maxEv) {
    senales.push(ev + ' eventos el ' + (m.dia_pico || '(día pico)') + ' (umbral ' + maxEv + ')');
    candidatas.push({
      peso: ev - maxEv,
      motivo: 'agenda_densa',
      recomendacion: 'Mové UNA cosa del ' + (m.dia_pico || 'día más cargado') + ': ese día no entra completo.'
    });
  }

  var ap = Number(m.aprob_estancadas || 0), maxAp = Number(u.max_aprob_estancadas || 0);
  if (maxAp > 0 && ap > maxAp) {
    senales.push(ap + ' aprobaciones sin decidir (umbral ' + maxAp + ')');
    candidatas.push({
      peso: ap - maxAp,
      motivo: 'aprobaciones_estancadas',
      recomendacion: 'Cerrá UNA aprobación pendiente, aunque sea diciendo que no. Decidir libera más que posponer.'
    });
  }

  if (!candidatas.length) return { hay: false, senales: [], recomendacion: '', motivo: '' };
  // La señal más fuerte manda: la que más se pasó de su propio umbral.
  candidatas.sort(function (a, b) { return b.peso - a.peso; });
  return { hay: true, senales: senales, recomendacion: candidatas[0].recomendacion, motivo: candidatas[0].motivo };
}

/** Umbral de Config con default de código (mismo criterio que la matriz de riesgo: Config sobre-escribe). */
function _focoPazUmbrales_() {
  function n_(clave, def) {
    var v = '';
    try { v = String(getConfig(clave) || '').trim(); } catch (_e) { v = ''; }
    var x = parseInt(v, 10);
    return isFinite(x) && x > 0 ? x : def;
  }
  return {
    max_vencidas_A: n_('fp_max_vencidas_A', 3),
    max_eventos_dia: n_('fp_max_eventos_dia', 5),
    max_aprob_estancadas: n_('fp_max_aprob_estancadas', 5),
    dias_aprob_estancada: n_('fp_dias_aprob_estancada', 7)
  };
}

/** Lee las métricas de carga de lo que YA existe (Tareas, Agenda, Aprobaciones_agregadas). */
function _focoPazMetricas_(u) {
  var ss = getMaestro();
  var hoy = hoyISO();
  var m = { vencidas_A: 0, peor_tarea: '', eventos_pico: 0, dia_pico: '', aprob_estancadas: 0 };

  var peorFecha = '';
  leerTabla(ss.getSheetByName('Tareas')).forEach(function (t) {
    if (esVerdadero_(t.archivada)) return;   // A.2: lo archivado no pesa en el foco/paz
    if (String(t.prioridad).toUpperCase() !== 'A') return;
    if (['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) >= 0) return;
    var fl = aFechaISO(t.fecha_limite);
    if (!fl || fl >= hoy) return;
    m.vencidas_A++;
    if (!peorFecha || fl < peorFecha) { peorFecha = fl; m.peor_tarea = String(t.descripcion || t.id_tarea || ''); }
  });

  // Densidad: el día MÁS cargado de los próximos 7 (incluido hoy). Un día con 8 cosas duele
  // aunque la semana promedie bien — por eso el pico y no el promedio.
  var porDia = {};
  var limite = _isoMasDias_(7);
  leerTabla(ss.getSheetByName('Agenda')).forEach(function (e) {
    if (String(e.estado || '').toLowerCase() === 'cancelado') return;
    var f = aFechaISO(e.fecha);
    if (!f || f < hoy || f > limite) return;
    porDia[f] = (porDia[f] || 0) + 1;
    if (porDia[f] > m.eventos_pico) { m.eventos_pico = porDia[f]; m.dia_pico = f; }
  });

  var corte = _isoMasDias_(-Math.abs(u.dias_aprob_estancada));
  leerTabla(ss.getSheetByName('Aprobaciones_agregadas')).forEach(function (a) {
    if (String(a.estado || '').toLowerCase() !== 'pendiente') return;
    var fc = aFechaISO(a.fecha_creacion);
    if (fc && fc <= corte) m.aprob_estancadas++;
  });

  return m;
}

var PROP_FOCOPAZ_ULTIMO = 'FOCOPAZ_ultimo';

/**
 * Guardián foco/paz: corre dentro de `corridaDiaria`. Devuelve el parte para el resumen.
 * Fail-silencioso por diseño: si la lectura falla, la corrida sigue. Un guardián de la paz que
 * tumba la corrida diaria sería una ironía cara.
 */
function guardianFocoPaz_() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(PROP_FOCOPAZ_ULTIMO) === hoyISO()) return { aviso: false, motivo: 'ya avisó hoy' };
    var u = _focoPazUmbrales_();
    var v = _focoPazEvaluar_(_focoPazMetricas_(u), u);
    if (!v.hay) return { aviso: false, motivo: 'sin señal' };
    // `crearAviso` (el endpoint con puerta), NO el sumidero interno: acá corremos dentro de
    // `corridaDiaria`, que ya declaró contexto de sistema. `_crearAviso_` es SOLO para el camino
    // pre-auth de `vozRechazo_` — usarlo por comodidad iría carcomiendo el gate de X4.
    crearAviso({
      origen: 'trigger',
      tipo: 'foco_paz',
      mensaje: 'Carga alta: ' + v.senales.join(' · ') + '. ' + v.recomendacion
    });
    props.setProperty(PROP_FOCOPAZ_ULTIMO, hoyISO());
    return { aviso: true, motivo: v.motivo, senales: v.senales };
  } catch (e) {
    try { Logger.log('guardianFocoPaz_ fallo: ' + e.message); } catch (_e) {}
    return { aviso: false, motivo: 'error: ' + e.message };
  }
}

/**
 * Corrida diaria batched. Idempotente (dedupe de avisos activos).
 * Orden: sync primero (refresca pendientes) → luego detectores.
 */
function corridaDiaria() {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  _soloOwner_('corridaDiaria');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta. Va DESPUÉS de _ctxSistema_: antes rompería el trigger.
  if (_sistemaPausado_()) { Logger.log('PAUSA: corridaDiaria omitida'); return { pausado: true }; }
  var resumen = { sync: null, conectores: null, avisos_nuevos: 0, expiradas: 0, vigias_encoladas: 0, memoria: null, director: null, salud: null, costos: null, foco_paz: null, vigilancia: null, correo: null, admin: null };
  invalidarMapaPC(); // PURGA #6: mapa proyecto→cliente fresco al arrancar la corrida
  // PURGA #16: expirar ANTES de sincronizar, así el espejo del MAESTRO no muestra
  // como "pendiente" una aprobación que ya quedó "expirada" en el Sheet cliente.
  resumen.expiradas = expirarAprobaciones();
  try { resumen.sync = syncMaestro(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Sync falló: ' + e.message }); }

  // Conectores: traen la operación real de cada cliente a su Datos_operativos ANTES del análisis.
  try { resumen.conectores = sincronizarConectores(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Conectores fallaron: ' + e.message }); }

  resumen.avisos_nuevos += detectarVencimientos();
  resumen.avisos_nuevos += detectarTareasEstancadas();
  resumen.avisos_nuevos += detectarProyectosSinMovimiento();

  // ETAPA 2: encolar Vigía para cada cliente activo (la cola es el contrato; el
  // worker drenarCola la corre). Los detectores internos se conservan tal cual.
  try { resumen.vigias_encoladas = encolarVigiaClientesActivos(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Encolar vigías falló: ' + e.message }); }

  // T3 M3 (21-jul): memoria caliente/fría del cerebro. Va ANTES del Director para que el pase
  // dirigido lea ya el `cerebro_log` chico. Fail-silenciosa: comprimir es HIGIENE, jamás rompe
  // la corrida (si falla, el log sigue entero y todo funciona igual, solo más lento).
  try { resumen.memoria = comprimirMemoriaFriaTodos_(); }
  catch (e) { try { Logger.log('comprimirMemoriaFria fallo: ' + e.message); } catch (_e) {} }

  // ETAPA 8a: el Director materializa el cerebro de cada tenant y encola la capa
  // dirigida por objetivos. 0 API (solo decide+encola; los agentes gatean/cupean).
  try { resumen.director = correrDirector(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Director falló: ' + e.message }); }

  // ETAPA 8a: loop de salud (6 chequeos, 0 API, alerta-no-arregla). Liviano en el pase
  // diario (schema solo MAESTRO); correrSalud({full:true}) abre clientes on-demand.
  try { resumen.salud = correrSalud(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Salud falló: ' + e.message }); }

  // TC-11 · A5: vigilancia multi-superficie de la cartera activa. Va DESPUÉS del sync y la
  // salud (juzga datos ya refrescados) y persiste el resumen en Config para que el brief lo
  // lea SIN abrir Sheets de cliente (regla SPEC-GAS 14-jul). Fail-safe por cliente adentro;
  // si el motor entero falla, aviso ruidoso (un error tragado es peor que un error ruidoso).
  try { resumen.vigilancia = vigilanciaCorrida_(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Vigilancia falló: ' + e.message }); }

  // ETAPA 2: consolidar costos del mes al MAESTRO (USD/EUR + alerta de presupuesto).
  try { resumen.costos = consolidarCostosMes(); }
  catch (e) { crearAviso({ tipo: 'sync_error', mensaje: 'Consolidar costos falló: ' + e.message }); }

  // P2 F4: registrar la recomendación del día (lazo de resultados; dedupe por texto abierto).
  try { resumen.recomendacion = registrarRecomendacionDelDia(); }
  catch (e) { try { Logger.log('registrarRecomendacionDelDia fallo: ' + e.message); } catch (_e) {} }

  // T3 M2 (21-jul): registrar el North Star de sistema del día → serie temporal (NS_serie) que
  // alimenta la Tendencia del brief (de foto a película). Idempotente por fecha; fail-silenciosa:
  // registrar la serie es higiene, jamás rompe la corrida diaria.
  try { resumen.norte_serie = registrarNorteDelDia_(); }
  catch (e) { try { Logger.log('registrarNorteDelDia_ fallo: ' + e.message); } catch (_e) {} }

  // P2 F3: brief-push (opt-in brief_push_on, default OFF; solo OWNER_EMAIL; dedupe diario).
  try { resumen.brief_push = briefPush_(); }
  catch (e) { try { Logger.log('brief_push fallo: ' + e.message); } catch (_e) {} }

  // SPEC-GAS 14-jul: calentar el cache del brief de SISTEMA con el render fresco de esta corrida (TTL 6h)
  // → la consulta de voz de la mañana es HIT instantáneo (sin el render frío que colgaba el doPost).
  try { calentarBriefCacheSistema_(); }
  catch (e) { try { Logger.log('calentarBriefCache fallo: ' + e.message); } catch (_e) {} }

  // Fix A 27-jul: ídem para el ESTADO (tool `estado` de la voz, medido ~14s en frío).
  try { calentarEstadoCacheSistema_(); }
  catch (e) { try { Logger.log('calentarEstadoCache fallo: ' + e.message); } catch (_e) {} }

  // 16-jul: dieta de Cola_tareas al FINAL de la corrida (después del warm del brief) — mueve las
  // filas terminales viejas a Cola_archivo para que el poll del CM (15s) y el doPost de voz sigan
  // leyendo una hoja chica. Falla-silenciosa: archivar es higiene, jamás rompe la corrida diaria.
  try { resumen.cola_archivada = archivarColaVieja_(); }
  catch (e) { try { Logger.log('archivarColaVieja_ falló: ' + e.message); } catch (_e) {} }

  // TC-2 · guardián foco/paz. Va al FINAL a propósito: mira la carga que queda DESPUÉS de que la
  // corrida expiró, sincronizó y archivó, no la de antes de limpiar. Solo avisa, máx. 1 por día.
  try { resumen.foco_paz = guardianFocoPaz_(); }
  catch (e) { try { Logger.log('guardianFocoPaz_ falló: ' + e.message); } catch (_e) {} }

  // T7 · correo → Bandeja (30_correo.js). Nace APAGADO (`correo_on=false`): mientras nadie lo
  // encienda, esto devuelve {motivo:'apagado'} sin tocar Gmail. Va al FINAL porque solo CAPTURA:
  // `clasificarBandeja` no corre en esta corrida (tiene su propio trigger opt-in), así que el
  // correo del día se clasifica después y nunca se mezcla con el drenaje en curso.
  try { resumen.correo = correoTriaje(); }
  catch (e) { crearAviso({ origen: 'correo', tipo: 'sync_error', mensaje: 'Correo falló: ' + e.message }); }

  // TC-7 · F4a: refresca el resumen de administración para que el brief lo cite sin abrir el Sheet
  // ADMIN. Si todavía no existe (F4a espera las facturas 2026), devuelve sin_datos y el brief lo dice.
  try { resumen.admin = adminRefrescarResumen_(); }
  catch (e) { try { Logger.log('adminRefrescarResumen_ falló: ' + e.message); } catch (_e) {} }

  setConfig('ultima_corrida_avisos', ahoraISO());
  Logger.log('corridaDiaria: ' + JSON.stringify(resumen));
  return resumen;
}

/** Encola una corrida de Vigía por cada cliente activo. Devuelve cuántas encoló. */
function encolarVigiaClientesActivos() {
  _soloOwner_('encolarVigiaClientesActivos');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var activos = ['activo', 'activo-piloto'];
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes')).filter(function (c) {
    return activos.indexOf(String(c.estado).toLowerCase()) >= 0;
  });
  clientes.forEach(function (c) { encolarAgente(c.id_cliente, 'vigia', {}); });
  return clientes.length;
}

/** Tareas con fecha_límite pasada y estado no terminal → aviso. */
function detectarVencimientos() {
  _soloOwner_('detectarVencimientos');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var sh = getMaestro().getSheetByName('Tareas');
  var hoy = hoyISO();
  var n = 0;
  leerTabla(sh).forEach(function (t) {
    if (esVerdadero_(t.archivada)) return;   // A.2: archivar es decir "esto ya no me interpela"
    var term = ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) >= 0;
    var fl = aFechaISO(t.fecha_limite);
    if (!term && fl && fl < hoy) {
      crearAviso({
        id_cliente: clienteDeProyecto(t.id_proyecto),
        tipo: 'tarea_vencida',
        mensaje: 'Tarea vencida (' + fl + '): ' + t.descripcion + ' [' + t.id_tarea + ']'
      });
      n++;
    }
  });
  return n;
}

/**
 * Tareas creadas hace > N días sin pasar a estado terminal.
 *
 * 16-jul — AGRUPADO: 18 avisos individuales saturaban la bandeja y el resumen por email. Con
 * MÁS de ESTANCADAS_MAX estancadas emite UN aviso resumen (citando las 3 más viejas) en vez de N;
 * con ESTANCADAS_MAX o menos siguen individuales (con pocas, el detalle es útil, no ruido).
 * El dedupe por mensaje de crearAviso hace de baseline: mientras el conteo y las 3 más viejas no
 * cambien, la corrida diaria reusa el aviso existente en lugar de acumular uno nuevo por día.
 * Los individuales que quedaron de corridas viejas se resuelven en esta misma corrida (abajo).
 */
var ESTANCADAS_MAX = 3;

function detectarTareasEstancadas() {
  _soloOwner_('detectarTareasEstancadas');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var dias = parseInt(getConfig('dias_estancamiento_tarea') || '7', 10);
  var sh = getMaestro().getSheetByName('Tareas');
  var limite = hace(dias);
  var estancadas = leerTabla(sh).filter(function (t) {
    if (esVerdadero_(t.archivada)) return false;   // A.2: una archivada no puede estar "estancada"
    var term = ['hecha', 'cancelada', 'completada'].indexOf(String(t.estado).toLowerCase()) >= 0;
    var activa = ['en_curso', 'pendiente', 'en curso', ''].indexOf(String(t.estado).toLowerCase()) >= 0;
    var fc = aFechaISO(t.fecha_creacion);
    return !term && activa && fc && fc < limite;
  });
  if (!estancadas.length) return 0;

  if (estancadas.length <= ESTANCADAS_MAX) {          // pocas → detalle individual (como siempre)
    estancadas.forEach(function (t) {
      crearAviso({
        id_cliente: clienteDeProyecto(t.id_proyecto),
        tipo: 'tarea_estancada',
        mensaje: 'Tarea estancada > ' + dias + 'd: ' + t.descripcion + ' [' + t.id_tarea + ']'
      });
    });
    return estancadas.length;
  }

  // Muchas → 1 resumen. Las 3 más viejas POR FECHA DE CREACIÓN (no por orden de hoja).
  var viejas = estancadas.slice().sort(function (a, b) {
    return String(aFechaISO(a.fecha_creacion)) < String(aFechaISO(b.fecha_creacion)) ? -1 : 1;
  }).slice(0, 3);
  var msg = estancadas.length + ' tareas estancadas > ' + dias + 'd (las 3 más viejas: ' +
            viejas.map(function (t) { return String(t.id_tarea); }).join(', ') + ')';
  // Baseline ANTES de crear: se resuelve TODO aviso tarea_estancada activo que no sea exactamente este
  // resumen. Cubre dos cosas: (a) los individuales de la versión vieja ('Tarea estancada > …'), y
  // (b) — el punto fino — los RESÚMENES de corridas anteriores. El dedupe de crearAviso es por mensaje
  // EXACTO y el mensaje lleva el conteo: sin esto, cada día que cambia el número nace un resumen nuevo
  // y el viejo queda activo → se acumula 1 aviso/día, justo el ruido que este cambio venía a matar
  // (misma trampa que cazó la purga del 08-jul con las recomendaciones: dedupear por texto exacto un
  // texto que muta). Resolver ANTES de crear, y por !== msg, mantiene el invariante "exactamente 1
  // resumen activo" sin churn: si el conteo no cambió, crearAviso reusa el mismo aviso y no toca nada.
  resolverAvisosDonde_(function (f) {
    return String(f.tipo) === 'tarea_estancada' && String(f.mensaje) !== msg;
  });
  crearAviso({ id_cliente: '', tipo: 'tarea_estancada', mensaje: msg }); // de sistema: cruza clientes
  return 1;
}

/** Marca 'resuelto' los avisos activos que matchean pred. Devuelve cuántos. (No borra: append-only.) */
function resolverAvisosDonde_(pred) {
  var sh = getMaestro().getSheetByName('Avisos');
  return conLock(function () {
    var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var cEstado = H.indexOf('estado') + 1;
    if (cEstado < 1) return 0;
    var n = 0;
    leerTabla(sh).forEach(function (f) {
      if (String(f.estado) !== 'activo' || !pred(f)) return;
      sh.getRange(f._fila, cEstado).setValue('resuelto');
      n++;
    });
    return n;
  });
}

/** Proyectos sin movimiento > N días (fecha_ultimo_movimiento). */
function detectarProyectosSinMovimiento() {
  _soloOwner_('detectarProyectosSinMovimiento');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var dias = parseInt(getConfig('dias_estancamiento_proyecto') || '7', 10);
  var sh = getMaestro().getSheetByName('Proyectos');
  var limite = hace(dias);
  var n = 0;
  leerTabla(sh).forEach(function (p) {
    var term = ['cerrado', 'entregado', 'cancelado'].indexOf(String(p.estado).toLowerCase()) >= 0;
    var mov = aFechaISO(p.fecha_ultimo_movimiento);
    if (!term && mov && mov < limite) {
      crearAviso({
        id_cliente: p.id_cliente,
        tipo: 'proyecto_sin_movimiento',
        mensaje: 'Proyecto sin movimiento > ' + dias + 'd: ' + p.nombre + ' [' + p.id_proyecto + ']'
      });
      n++;
    }
  });
  return n;
}

/**
 * Aprobaciones pendientes > N días → marcar "expirada" en el Sheet del cliente
 * (el silencio NUNCA aprueba — 0.2) y avisar. Append-only: se EDITA el estado de
 * la fila pendiente, no se borra.
 */
function expirarAprobaciones(soloCliente) {
  _soloOwner_('expirarAprobaciones');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var dias = parseInt(getConfig('expiracion_aprobaciones_dias') || '7', 10);
  var limite = hace(dias);
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes'));
  var n = 0;
  clientes.forEach(function (cli) {
    if (!cli.url_sheet_cliente) return;
    if (soloCliente && cli.id_cliente !== soloCliente) return; // selfTest acota a su cliente
    try {
      var sh = SpreadsheetApp.openByUrl(cli.url_sheet_cliente).getSheetByName('Aprobaciones');
      if (!sh || sh.getLastRow() < 2) return;
      // PURGA #5: una sola lectura + una sola escritura por cliente (antes: 3-4
      // setValue por fila vencida, N+1). Leemos toda la pestaña, mutamos en memoria
      // las filas pendientes vencidas y volcamos el bloque de datos de una vez.
      var matriz = sh.getDataRange().getValues();
      var headers = matriz[0];
      var iEstado = headers.indexOf('estado');
      var iDecision = headers.indexOf('fecha_decision');
      var iNotas = headers.indexOf('notas');
      var iAutor = headers.indexOf('decidido_por');
      var iFc = headers.indexOf('fecha_creacion');
      var iId = headers.indexOf('id');
      var iDesc = headers.indexOf('descripcion');
      var cambiada = false;
      var avisos = [];
      for (var r = 1; r < matriz.length; r++) {
        if (String(matriz[r][iEstado]).toLowerCase() === 'pendiente' &&
            aFechaISO(matriz[r][iFc]) && aFechaISO(matriz[r][iFc]) < limite) {
          matriz[r][iEstado] = 'expirada';
          if (iDecision >= 0) matriz[r][iDecision] = hoyISO();
          if (iNotas >= 0) matriz[r][iNotas] = 'Expirada por silencio > ' + dias + 'd';
          // PURGA #13: autor no humano de la decisión, para trazabilidad.
          if (iAutor >= 0) matriz[r][iAutor] = 'sistema (expiración)';
          avisos.push({ id: matriz[r][iId], desc: matriz[r][iDesc] });
          cambiada = true;
          n++;
        }
      }
      if (cambiada) {
        sh.getRange(1, 1, matriz.length, headers.length).setValues(matriz);
        avisos.forEach(function (a) {
          crearAviso({
            id_cliente: cli.id_cliente,
            tipo: 'aprobacion_expirada',
            mensaje: 'Aprobación expirada sin decisión: ' + a.desc + ' [' + a.id + ']'
          });
        });
      }
    } catch (e) {
      crearAviso({ tipo: 'sync_error', mensaje: 'Expirar aprobaciones falló en ' + cli.id_cliente + ': ' + e.message });
    }
  });
  return n;
}

// ── helpers locales ─────────────────────────────────────────────────────────

/** Fecha ISO de hace N días (YYYY-MM-DD). */
function hace(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/**
 * PURGA #6: mapa id_proyecto → id_cliente construido UNA vez por ejecución.
 * Antes clienteDeProyecto releía Proyectos entera por cada tarea (datosHoy hasta
 * 25×). El cache vive en el runtime de la ejecución (GAS arranca limpio en cada
 * corrida), así que no hay riesgo de staleness entre ejecuciones. invalidarMapaPC()
 * por si algún flujo escribe Proyectos y vuelve a leer en la misma corrida.
 */
var _mapaPC = null;
function mapaProyectoCliente() {
  _soloOwner_('mapaProyectoCliente');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  if (_mapaPC) return _mapaPC;
  _mapaPC = {};
  leerTabla(getMaestro().getSheetByName('Proyectos')).forEach(function (p) {
    _mapaPC[p.id_proyecto] = p.id_cliente;
  });
  return _mapaPC;
}
function invalidarMapaPC() {
  _soloOwner_('invalidarMapaPC');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  _mapaPC = null;
}

/** id_cliente al que pertenece un id_proyecto (vía mapa memoizado). */
function clienteDeProyecto(idProyecto) {
  _soloOwner_('clienteDeProyecto');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  return mapaProyectoCliente()[idProyecto] || '';
}

/**
 * Instala (idempotente) el único trigger diario. Corré a mano una vez.
 * Cuota consumer: un solo trigger batched, no uno por flujo (0.4).
 */
function instalarTriggers() {
  _soloOwner_('instalarTriggers');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  // E1.2 T3: + sincronizarConectores cada 8h (frescura intradía de ventas de clientes, decisión a de
  // Vehemence). SOLO el sync de conectores — el brief y los avisos siguen 1×/día en corridaDiaria.
  // sincronizarConectores es seguro suelto: solo sincroniza (conLock), no manda emails ni avisos.
  var deseados = [TRIGGER_AVISOS, 'drenarCola', 'sincronizarConectores']; // reset = anti-duplicado
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (deseados.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(TRIGGER_AVISOS).timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('drenarCola').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('sincronizarConectores').timeBased().everyHours(8).create();
  Logger.log('Triggers instalados: "' + TRIGGER_AVISOS + '" (07:00) + "drenarCola" (cada 5 min) + "sincronizarConectores" (cada 8h).');
  return true;
}
