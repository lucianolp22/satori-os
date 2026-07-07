/**
 * 99_tmp_tipos.js — TEMPORAL: puebla tipo/recurrencia en las 23 tareas migradas de Trello
 * (Tareas-v2 F1, 07-jul-2026). Correr tmp_poblarTipos() UNA vez desde el editor, DESPUÉS de
 * setup() (que agrega las columnas nuevas). Idempotente: solo escribe tipo donde está vacío.
 * BORRAR este archivo en el próximo commit (patrón 99_tmp_b2 / 99_tmp_trello).
 * Criterio (confianza 7/10 en ambiguos, corregibles luego): cliente por nombre inequívoco
 * (LC Travel, DAM, M15, Vehemence, EJF, Pipol, Crocante) · 0012-0016 = periódicas con regla
 * real y se limpia el "(recurrente)" del texto · gestiones propias (Hacienda, Holded, SS,
 * Enred, PC) → admin · finanzas personales y LinkedIn → personal.
 */
function tmp_poblarTipos() {
  var MAPA = {
    'TAR-0001': { tipo: 'cliente' },   // reuniones LC Travel
    'TAR-0002': { tipo: 'admin' },     // patinete Hacienda
    'TAR-0003': { tipo: 'cliente' },   // facturas LP a Alex DAM
    'TAR-0004': { tipo: 'personal' },  // finanzas personales
    'TAR-0005': { tipo: 'admin' },     // facturas a Holded
    'TAR-0006': { tipo: 'admin' },     // EECC PC quincenal
    'TAR-0007': { tipo: 'admin' },     // aplazamiento deuda PC/SS
    'TAR-0008': { tipo: 'admin' },     // correo Enred
    'TAR-0009': { tipo: 'cliente' },   // agua M15 (MesaQuince)
    'TAR-0010': { tipo: 'admin' },     // PC siniestro Avanzax
    'TAR-0011': { tipo: 'cliente' },   // EERRs Vehemence
    'TAR-0012': { tipo: 'periodica', rec: '1d', desc: 'REVISAR CORREOS A DIARIO' },
    'TAR-0013': { tipo: 'periodica', rec: '1s', desc: 'REPORTE SEMANAL M15' },
    'TAR-0014': { tipo: 'periodica', rec: '1s', desc: 'PROCESADO DE REGISTROS CONTABLES SEMANAL' },
    'TAR-0015': { tipo: 'periodica', rec: '1s', desc: 'REPORTE SEMANAL VEHEMENCE' },
    'TAR-0016': { tipo: 'periodica', rec: '1s', desc: 'REUNION VEHEMENCE' },
    'TAR-0017': { tipo: 'cliente' },   // proceso clientes nuevos Vehemence
    'TAR-0018': { tipo: 'cliente' },   // proceso clientes nuevos EJF
    'TAR-0019': { tipo: 'cliente' },   // propuesta Pipol Coffee
    'TAR-0020': { tipo: 'cliente' },   // propuesta Crocante
    'TAR-0021': { tipo: 'cliente' },   // visitar Crocante con Dani
    'TAR-0022': { tipo: 'admin' },     // mapear cobros/pagos y lógica
    'TAR-0023': { tipo: 'personal' }   // LinkedIn propio
  };
  var sh = getMaestro().getSheetByName('Tareas');
  if (!sh) throw new Error('Falta la pestaña Tareas.');
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var cId = H.indexOf('id_tarea'), cTip = H.indexOf('tipo'), cRec = H.indexOf('recurrencia'), cDes = H.indexOf('descripcion');
  if (cTip < 0 || cRec < 0) throw new Error('Faltan columnas tipo/recurrencia — correr setup() primero.');
  return conLock(function () {
    var n = sh.getLastRow(); if (n < 2) return { tocadas: 0 };
    var filas = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
    var tocadas = 0;
    for (var i = 0; i < filas.length; i++) {
      var m = MAPA[String(filas[i][cId])];
      if (!m) continue;
      if (String(filas[i][cTip] || '') === '') { sh.getRange(i + 2, cTip + 1).setValue(m.tipo); tocadas++; }
      if (m.rec && String(filas[i][cRec] || '') === '') sh.getRange(i + 2, cRec + 1).setValue(m.rec);
      if (m.desc && String(filas[i][cDes]).indexOf('(recurrente)') >= 0) sh.getRange(i + 2, cDes + 1).setValue(m.desc);
    }
    var res = { tocadas: tocadas };
    Logger.log('tmp_poblarTipos: ' + JSON.stringify(res));
    return res;
  });
}
