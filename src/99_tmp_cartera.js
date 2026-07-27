/**
 * 99_tmp_cartera.js — TEMPORAL (patrón 99_tmp: borrar tras correr y verificar). 27-jul-2026.
 *
 * Aplica las decisiones de cartera de Luciano (eyeball 27-jul):
 *   1. Renombres formales: CLI-001 → "MesaQuince" · CLI-004 → "DAM Barbers".
 *      (Vehemence, LC Travel, SIP Coffee Roasters y Oficina Virtual quedan como están.)
 *   2. EJF: alta como cliente nuevo (idempotente por nombre — si ya existe, no duplica).
 *   3. DEMO Bistró Ejemplo (CLI-006): BAJA DEFINITIVA — su Sheet va a la papelera de Drive
 *      (reversible 30 días) y la fila sale del roster. Doble condición id+nombre: si no
 *      matchean LAS DOS, no se toca nada y se avisa.
 *   4. syncMaestro() para que los espejos del MAESTRO reflejen la cartera nueva.
 *
 * Correr UNA vez en el editor: aplicarCartera2707(). Después: recargar /dev y verificar la
 * cartera; borrar este archivo del repo + clasp push (higiene 99_tmp).
 */
function aplicarCartera2707() {
  _soloOwner_('aplicarCartera2707');   // muta el roster: solo el owner desde el editor
  var out = [];
  var ss = getMaestro();
  var sh = ss.getSheetByName('Clientes');
  if (!sh) throw new Error('Falta la hoja Clientes.');

  // ── 1 · Renombres (solo la celda `nombre`; el id y todo lo demás quedan intactos) ──
  var RENOMBRES = { 'CLI-001': 'MesaQuince', 'CLI-004': 'DAM Barbers' };
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colNombre = H.indexOf('nombre') + 1;
  if (colNombre < 1) throw new Error('Clientes sin columna nombre.');
  leerTabla(sh).forEach(function (f) {
    var nuevo = RENOMBRES[String(f.id_cliente)];
    if (nuevo && String(f.nombre) !== nuevo) {
      sh.getRange(f._fila, colNombre).setValue(nuevo);
      out.push(f.id_cliente + ' renombrado: "' + f.nombre + '" → "' + nuevo + '"');
    } else if (nuevo) {
      out.push(f.id_cliente + ' ya se llamaba "' + nuevo + '"');
    }
  });

  // ── 2 · EJF — alta (crearCliente es idempotente por nombre) ──
  // Estado 'activo' = supuesto declarado (EJF tiene sistema Figueras vivo); corregible en 1 celda.
  var r = crearCliente({ nombre: 'EJF', rubro: 'Música', estado: 'activo', responsable_lado_cliente: 'Elías' });
  out.push('EJF: ' + (r.ya_existia ? 'ya existía' : 'CREADO') + ' como ' + r.id_cliente);

  // ── 3 · Baja definitiva de DEMO (CLI-006) ──
  // Releer DESPUÉS del alta de EJF: el append corrió las _fila de nada (append va al final),
  // pero releer elimina toda duda de índices stale.
  var demo = leerTabla(sh).filter(function (f) {
    return String(f.id_cliente) === 'CLI-006' && String(f.nombre).toUpperCase().indexOf('DEMO') >= 0;
  })[0];
  if (!demo) {
    out.push('CLI-006 DEMO: no encontrado con la doble condición (id + nombre con "DEMO") — no se tocó nada');
  } else {
    try {
      var m = String(demo.url_sheet_cliente || '').match(/\/d\/([-\w]+)/);
      if (m) { DriveApp.getFileById(m[1]).setTrashed(true); out.push('Sheet de DEMO → papelera de Drive (reversible 30 días)'); }
      else out.push('DEMO sin url_sheet_cliente — solo se saca la fila del roster');
    } catch (eD) {
      out.push('Sheet de DEMO: no se pudo mover a papelera (' + ((eD && eD.message) || eD) + ') — la fila se saca igual; movelo a mano si hace falta');
    }
    sh.deleteRow(demo._fila);
    out.push('CLI-006 DEMO Bistró Ejemplo: fuera del roster');
  }

  // ── 4 · Espejos del MAESTRO al día (wipe-then-rebuild: sin filas fantasma de DEMO) ──
  try { syncMaestro(); out.push('syncMaestro OK — espejos reconstruidos'); }
  catch (eS) { out.push('syncMaestro falló: ' + ((eS && eS.message) || eS) + ' — correrlo a mano'); }

  Logger.log('aplicarCartera2707:\n  ' + out.join('\n  '));
  return out;
}
