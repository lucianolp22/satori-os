/**
 * 11_repro.js — Reproducción del vector de formula injection (PURGA #1).
 * TEMPORAL: confirma el hallazgo antes/después del parche. Borrable tras validar.
 *
 * Crea un Sheet temporal, escribe un payload `=1+1` por el camino CRUDO (como
 * appendRow sin sanear) y por el camino SANEADO (appendFila ya parcheado), y
 * reporta para cada uno si la celda quedó como FÓRMULA evaluada o TEXTO literal.
 * Manda el Sheet a la papelera al terminar (reversible).
 */
function reproFormulaInjection() {
  var ss = SpreadsheetApp.create('__REPRO_FI__ ' + ahoraISO());
  var out = [];
  try {
    var sh = ss.getSheets()[0];
    sh.getRange(1, 1).setValue('payload'); // header (appendFila respeta encabezados)
    var payload = '=1+1';

    // (1) Camino CRUDO: así escribía la sync antes del parche (valor directo).
    sh.appendRow([payload]);
    var crudo = sh.getRange(2, 1);
    out.push('CRUDO   → getFormula=' + JSON.stringify(crudo.getFormula()) +
             ' getValue=' + JSON.stringify(crudo.getValue()) +
             (crudo.getFormula() ? '  ⚠️ VECTOR CONFIRMADO (se evaluó como fórmula)' : '  (no se evaluó)'));

    // (2) Camino SANEADO: por appendFila ya parcheado (sanitizarCelda).
    appendFila(sh, { payload: payload });
    var saneado = sh.getRange(3, 1);
    out.push('SANEADO → getFormula=' + JSON.stringify(saneado.getFormula()) +
             ' getValue=' + JSON.stringify(saneado.getValue()) +
             (saneado.getFormula() ? '  ❌ AÚN VULNERABLE' : '  ✅ neutralizado (texto literal)'));
  } finally {
    DriveApp.getFileById(ss.getId()).setTrashed(true);
  }
  var salida = out.join('\n');
  Logger.log(salida);
  return salida;
}
