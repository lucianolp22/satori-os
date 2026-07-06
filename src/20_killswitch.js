/**
 * 20_killswitch.js — Kill switch unificado (riel Bastión #7).
 * Un solo interruptor congela la actividad autónoma + TODO el canal de voz:
 *   automatizaciones (corridaDiaria, drenarCola, chequeoLivianoDirector, clasificarBandeja)
 *   y el doPost de voz: en pausa rechaza TODAS las tools, lecturas incluidas (B5 #7).
 * Modo elegido: PAUSA OPERATIVA — congela lo autónomo, las escrituras y las consultas por voz;
 * solo se informa la pausa. Estado: Script Property SISTEMA_PAUSADO ('1' = pausado). Default = ACTIVO.
 * Fail-safe: si la lectura fallara, NO pausa (un glitch no frena la operación).
 * Control: pausarSistema() / reanudarSistema() desde el editor de Apps Script (Ejecutar).
 * El proyecto es standalone (no bound a la hoja) -> no hay menu onOpen; el control de
 * un boton en el dashboard va como paso siguiente.
 * IMPORTANTE: si en el futuro se agrega un trigger/automatizacion nueva, sumarle el guard
 *   if (_sistemaPausado_()) return ...;  al inicio (no hay enforcement central).
 */
var PROP_SISTEMA_PAUSADO = 'SISTEMA_PAUSADO';

function _sistemaPausado_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(PROP_SISTEMA_PAUSADO) === '1';
  } catch (_e) { return false; }
}

function pausarSistema() {
  PropertiesService.getScriptProperties().setProperty(PROP_SISTEMA_PAUSADO, '1');
  try { Logger.log('KILL SWITCH: PAUSADO ' + ahoraISO()); } catch (_e) {}
  try {
    crearAviso({ origen: 'sistema', tipo: 'sistema_pausado',
      mensaje: 'Pausa operativa ACTIVADA: automatizaciones y escrituras congeladas (la consulta por voz sigue). Reanuda con reanudarSistema().' });
  } catch (_a) {}
  return { ok: true, estado: 'pausado' };
}

function reanudarSistema() {
  PropertiesService.getScriptProperties().setProperty(PROP_SISTEMA_PAUSADO, '0');
  try { Logger.log('KILL SWITCH: REANUDADO ' + ahoraISO()); } catch (_e) {}
  try {
    crearAviso({ origen: 'sistema', tipo: 'sistema_reanudado',
      mensaje: 'Pausa operativa desactivada: sistema operativo de nuevo.' });
  } catch (_a) {}
  return { ok: true, estado: 'activo' };
}

function estadoPausa() { return { pausado: _sistemaPausado_() }; }

/**
 * smokeKill — verificación del kill switch (correr desde el editor de Apps Script).
 * SIN guión bajo final a propósito: así aparece en el selector "Ejecutar".
 * Setea la property directo (sin escribir Avisos), verifica el helper + un guard
 * liviano (chequeoLivianoDirector, 0 API) y RESTAURA el estado previo. Sin efectos.
 */
function smokeKill() {
  var props = PropertiesService.getScriptProperties();
  var antes = props.getProperty(PROP_SISTEMA_PAUSADO);
  var rep = [];
  props.setProperty(PROP_SISTEMA_PAUSADO, '1');
  rep.push(['_sistemaPausado_ true', _sistemaPausado_() === true]);
  rep.push(['guard no-op chequeoLivianoDirector', !!((chequeoLivianoDirector() || {}).pausado)]);
  props.setProperty(PROP_SISTEMA_PAUSADO, '0');
  rep.push(['_sistemaPausado_ false', _sistemaPausado_() === false]);
  if (antes == null) props.deleteProperty(PROP_SISTEMA_PAUSADO); else props.setProperty(PROP_SISTEMA_PAUSADO, antes);
  var pass = rep.every(function (x) { return x[1]; });
  Logger.log('SMOKE KILL: ' + (pass ? 'PASS' : 'FAIL') + ' ' + JSON.stringify(rep));
  return { pass: pass, detalle: rep };
}
