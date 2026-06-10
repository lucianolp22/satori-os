/**
 * 10_bootstrap.js — Arranque real de Etapa 1 en UNA corrida (autoriza una vez).
 *
 * Orden de trabajo del handoff (pasos 2→4→7→5). Idempotente: se puede re-correr.
 * Luciano lo ejecuta una vez desde el editor (dispara el consentimiento OAuth) y
 * con eso queda el MAESTRO armado, los clientes reales cargados, el trigger
 * diario instalado y la primera sync hecha.
 */
function bootstrap() {
  var out = {};
  out.setup = setup();                       // paso 2: MAESTRO + pestañas + Config
  out.clientes = cargaInicialClientes();     // paso 4: clientes reales
  out.trigger = instalarTriggers();          // paso 7: único trigger diario
  out.sync = syncMaestro();                  // paso 5: primera agregación
  out.estado = estadoSistema();
  Logger.log(JSON.stringify(out.estado, null, 2));
  Logger.log('MAESTRO: ' + out.setup.url);
  return out;
}
