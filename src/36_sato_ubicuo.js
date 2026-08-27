/**
 * 36_sato_ubicuo.js — F7 · Sato Ubicuo: el dock persistente del header.
 *
 * QUÉ ES: una superficie MÁS, no un reemplazo. El panel Sato in-page (T4, 25-ago) sigue siendo la
 * superficie de trabajo; esto es el acceso rápido — últimos turnos, un input, tres botones. Y es
 * el ESPEJO de la voz: lo que se habla por LiveKit aparece acá, y lo que se escribe acá lo levanta
 * LiveKit en su próximo poll (Opción A: vía la hoja `charla`, sin canal nuevo).
 *
 * AISLAMIENTO (regla dura 29-jul, es ley):
 *   · Todo endpoint recibe un `id_cliente` EXPLÍCITO. No hay "cliente actual" implícito.
 *   · Se valida contra el roster real (`_satoClienteValido_`) antes de tocar una hoja.
 *   · Cada tenant tiene su hoja `charla`; la de sistema vive en CLI-000. Un turno JAMÁS se escribe
 *     en la hoja de otro cliente.
 *   · Todo lo que entra pasa por `limpiarHostilTexto_` y se corta a 1200 chars.
 *
 * ROLLBACK: Config `sato_ubicuo_on` (default `no`). Con el flag apagado los 4 endpoints devuelven
 * `{ok:false, motivo:'sato_ubicuo_off'}` sin tocar una hoja.
 */

var SATO_UBICUO_MAXCHARS = 1200;   // tope de un mensaje de texto del widget
var SATO_UBICUO_MAXTURNOS = 5;     // lo que muestra el dock (el panel T4 muestra más)

/** ¿Está encendido el dock? Default OFF hasta que Luciano lo mire. PURA salvo por Config. */
function _ubicuoOn_() {
  try { return String(getConfig('sato_ubicuo_on') || 'no').toLowerCase() === 'si'; } catch (e) { return false; }
}

/**
 * Resuelve y VALIDA el tenant de un pedido del widget. Devuelve el id de la hoja `charla` a usar.
 * `''` (o el id de sistema) ⇒ CLI-000. Un id que no está en el roster se RECHAZA con motivo:
 * jamás se ignora en silencio ni se cae al de sistema (§AISLAMIENTO.2 y .3).
 * @return {{ok:boolean, tenant:string, motivo:string}}
 */
function _ubicuoTenant_(idCliente) {
  var id = String(idCliente == null ? '' : idCliente).trim();
  if (!id || id === SATO_TENANT_SISTEMA) return { ok: true, tenant: SATO_TENANT_SISTEMA, motivo: '' };
  if (!_satoClienteValido_(id)) return { ok: false, tenant: '', motivo: 'cliente_inexistente' };
  return { ok: true, tenant: id, motivo: '' };
}

/** Hoja `charla` del tenant, sin crearla si no existe (lectura no materializa nada). */
function _ubicuoCharla_(tenant, crear) {
  var ss;
  try { ss = abrirCliente(tenant).ss; } catch (e) { return null; }
  return _charlaSheet_(ss, !!crear);
}

/**
 * Últimos turnos de la charla de UN tenant, para pintar el dock. READ-ONLY.
 * @param {string} idCliente  '' = sistema (CLI-000)
 * @param {string} tsDesde    ISO opcional: sólo lo posterior (polling incremental)
 */
function charlaCola(idCliente, tsDesde) {
  _soloOwner_('charlaCola');
  if (!_ubicuoOn_()) return { ok: false, motivo: 'sato_ubicuo_off' };
  var t = _ubicuoTenant_(idCliente);
  if (!t.ok) return { ok: false, motivo: t.motivo, pedido: String(idCliente || '') };
  var sh = _ubicuoCharla_(t.tenant, false);
  if (!sh) return { ok: true, tenant: t.tenant, turnos: [] };
  var desde = String(tsDesde || '');
  var filas = leerTabla(sh).filter(function (f) { return !desde || String(f.ts || '') > desde; });
  var ultimos = filas.slice(-SATO_UBICUO_MAXTURNOS).map(function (f) {
    return { ts: String(f.ts || ''), rol: String(f.rol || ''), texto: String(f.texto || ''),
             origen: String(f.modulo || '') };
  });
  // Sello de origen: de qué tenant salieron estos datos (§AISLAMIENTO.4).
  return { ok: true, tenant: t.tenant, turnos: ultimos, tenant_datos: t.tenant };
}

/**
 * Escribe un turno de TEXTO del widget en la charla del tenant, marcado como pendiente para que
 * LiveKit lo levante. NO llama al modelo: sólo encola.
 */
function charlaEnviarTexto(idCliente, texto) {
  _soloOwner_('charlaEnviarTexto');
  if (!_ubicuoOn_()) return { ok: false, motivo: 'sato_ubicuo_off' };
  var t = _ubicuoTenant_(idCliente);
  if (!t.ok) return { ok: false, motivo: t.motivo, pedido: String(idCliente || '') };
  var limpio = limpiarHostilTexto_(String(texto == null ? '' : texto), SATO_UBICUO_MAXCHARS);
  // El marcador de control se neutraliza SIEMPRE: un `<<<`/`>>>` dentro de un dato no puede
  // hacerse pasar por marcador del sistema (§7 anti-injection de la identidad).
  limpio = limpio.replace(/<<</g, '‹‹‹').replace(/>>>/g, '›››');
  if (!limpio) return { ok: false, motivo: 'texto_vacio' };
  var sh = _ubicuoCharla_(t.tenant, true);
  if (!sh) return { ok: false, motivo: 'tenant_no_accesible' };
  var ts = ahoraISO();
  conLock(function () {
    appendFila(sh, { ts: ts, rol: 'user', texto: limpio, modulo: 'texto', tenant_datos: t.tenant });
  });
  return { ok: true, tenant: t.tenant, ts: ts, chars: limpio.length };
}

/**
 * Lo que el widget escribió y LiveKit todavía no procesó. Lo consume el poll de `agent.py`.
 * Marca los devueltos como vistos EN LA MISMA PASADA, bajo lock: se entregan UNA vez.
 */
function charlaPendientes(idCliente) {
  _soloOwner_('charlaPendientes');
  if (!_ubicuoOn_()) return { ok: false, motivo: 'sato_ubicuo_off' };
  var t = _ubicuoTenant_(idCliente);
  if (!t.ok) return { ok: false, motivo: t.motivo, pedido: String(idCliente || '') };
  var sh = _ubicuoCharla_(t.tenant, false);
  if (!sh) return { ok: true, tenant: t.tenant, pendientes: [] };
  var out = [];
  conLock(function () {
    var filas = leerTabla(sh);
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var colMod = hdr.indexOf('modulo') + 1;
    for (var i = 0; i < filas.length; i++) {
      if (String(filas[i].modulo || '') !== 'texto') continue;
      out.push({ ts: String(filas[i].ts || ''), texto: String(filas[i].texto || '') });
      if (colMod > 0) sh.getRange(i + 2, colMod).setValue('texto_visto');   // entregado UNA vez
    }
  });
  return { ok: true, tenant: t.tenant, pendientes: out, tenant_datos: t.tenant };
}

/**
 * Persiste un turno de LiveKit en la charla del tenant, para que el widget lo espeje.
 * `origen` queda sellado como `voz` (el del widget queda `texto`): así se distingue de dónde vino
 * cada turno sin mirar timestamps.
 */
function guardarTurnoCharla(idCliente, rol, texto) {
  _soloOwner_('guardarTurnoCharla');
  if (!_ubicuoOn_()) return { ok: false, motivo: 'sato_ubicuo_off' };
  var t = _ubicuoTenant_(idCliente);
  if (!t.ok) return { ok: false, motivo: t.motivo, pedido: String(idCliente || '') };
  var r = String(rol || '').toLowerCase();
  if (r !== 'user' && r !== 'assistant') return { ok: false, motivo: 'rol_invalido' };  // vocabulario CERRADO (S6)
  var limpio = limpiarHostilTexto_(String(texto == null ? '' : texto), SATO_UBICUO_MAXCHARS)
    .replace(/<<</g, '‹‹‹').replace(/>>>/g, '›››');
  if (!limpio) return { ok: false, motivo: 'texto_vacio' };
  var sh = _ubicuoCharla_(t.tenant, true);
  if (!sh) return { ok: false, motivo: 'tenant_no_accesible' };
  var ts = ahoraISO();
  conLock(function () {
    appendFila(sh, { ts: ts, rol: r, texto: limpio, modulo: 'voz', tenant_datos: t.tenant });
  });
  return { ok: true, tenant: t.tenant, ts: ts };
}
