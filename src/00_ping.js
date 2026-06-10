/**
 * Ping de verificación de infraestructura clasp.
 * Si esta función aparece en el editor de Apps Script, el push funcionó.
 */
function ping() {
  return 'Satori OS MAESTRO · clasp OK · ' + new Date().toISOString();
}
