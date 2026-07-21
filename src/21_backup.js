/**
 * 21_backup.js — Backup/snapshot semanal de los DATOS (B3).
 *
 * Qué respalda: copia íntegra del MAESTRO + cada Sheet cliente a una carpeta Drive
 * fechada («Satori OS — Backups/backup_<stamp>»), dentro del mismo Drive de
 * luciano@satoriconsultoria.com. Protege contra: borrado/corrupción de una hoja
 * viva, edición mala, un script que ensucia datos. NO protege contra pérdida total
 * de la cuenta Google (para eso: descarga XLSX periódica — ver RUNBOOK-recuperacion).
 * El CÓDIGO se respalda aparte (git remote privado — ver RUNBOOK-recuperacion).
 *
 * Scope: el snapshot usa Spreadsheet.copy() (scope 'spreadsheets', ya concedido);
 * DriveApp solo toca objetos creados por la app (la carpeta + las copias) → alcanza
 * con 'drive.file'. smokeBackup() lo PRUEBA reversible antes de confiar el trigger
 * (mismo criterio que smokeKill). Si una hoja cliente NO fuera creada por la app, su
 * copia falla AISLADA (try/catch) y se reporta; no tumba el resto del run.
 *
 * Kill switch: backupSemanal() (trigger) respeta la pausa operativa; backupAhora()
 * (corrida manual desde el editor) NO — es acción deliberada de Luciano.
 * Retención: conserva las últimas N carpetas (Config 'backup_retencion_semanas',
 *   def 8); las más viejas → papelera (setTrashed, ya probado bajo drive.file en selfTest).
 * Escala: N+1 copias por corrida (~2-3s c/u). Con <15 clientes entra sobrado en el
 *   límite de 6 min; si la cartera crece mucho, batchear por continuación.
 *
 * Correr desde el editor: instalarTriggerBackup() una vez · smokeBackup() valida
 * scope · backupAhora() backup manual · drillRestore() ensayo de restauración
 * (gate B3) · backupListar() ve qué hay.
 */

var PROP_BACKUP_FOLDER_ID = 'BACKUP_FOLDER_ID';
var BACKUP_ROOT_NOMBRE = 'Satori OS — Backups';
var BACKUP_RETENCION_DEF = 8; // semanas

/** Sello de tiempo ordenable para nombres: 2026-07-05_0400. */
function _stampBackup_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmm');
}

/** Nombre de archivo seguro (sin barras ni control chars). */
function _nombreSeguro_(s) {
  return String(s || '').replace(/[\/\\\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 90);
}

/**
 * Carpeta raíz de backups (get-or-create). Guarda el id en Script Property para no
 * depender de búsqueda por nombre bajo drive.file. Si la guardada está en papelera o
 * no existe, recrea. Devuelve Folder.
 */
function _backupRootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_BACKUP_FOLDER_ID);
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (_e) { /* id muerto → recrear */ }
  }
  var nueva = DriveApp.createFolder(BACKUP_ROOT_NOMBRE);
  props.setProperty(PROP_BACKUP_FOLDER_ID, nueva.getId());
  return nueva;
}

/** Retención en semanas (Config, con default). */
function _retencionSemanas_() {
  var n = Number(getConfig('backup_retencion_semanas') || BACKUP_RETENCION_DEF);
  return (n && n > 0) ? Math.floor(n) : BACKUP_RETENCION_DEF;
}

/**
 * Copia un Spreadsheet (por id) a la carpeta destino con el nombre dado. Usa
 * Spreadsheet.copy (spreadsheets) + moveTo (drive.file sobre archivo propio). Si
 * moveTo falla, deja la copia en la raíz con el nombre fechado (sigue siendo backup,
 * solo sin organizar) y lo marca. Devuelve {ok, id, url, carpeta}.
 */
function _copiarSpreadsheet_(srcId, nombre, carpeta) {
  var copia = SpreadsheetApp.openById(srcId).copy(nombre);
  var enCarpeta = false;
  try {
    DriveApp.getFileById(copia.getId()).moveTo(carpeta);
    enCarpeta = true;
  } catch (_m) { /* degradación: queda en raíz con nombre fechado */ }
  return { ok: true, id: copia.getId(), url: copia.getUrl(), carpeta: enCarpeta };
}

/**
 * Núcleo del backup. Copia MAESTRO + todos los Sheets cliente a una subcarpeta
 * fechada. Aísla fallos por hoja. Aplica retención. Loguea al feed. Devuelve
 * {ok, stamp, folder_url, copiados[], fallidos[], retenidas, purgadas}.
 */
function _ejecutarBackup_() {
  var stamp = _stampBackup_();
  var root = _backupRootFolder_();
  var sub = root.createFolder('backup_' + stamp);
  var copiados = [], fallidos = [];

  // MAESTRO
  try {
    var m = _copiarSpreadsheet_(getMaestro().getId(), 'MAESTRO — ' + stamp, sub);
    copiados.push({ que: 'MAESTRO', url: m.url, carpeta: m.carpeta });
  } catch (e) {
    fallidos.push({ que: 'MAESTRO', error: String((e && e.message) || e) });
  }

  // Cada cliente (TODOS los estados: un backup captura todo lo que exista)
  var clientes = leerTabla(getMaestro().getSheetByName('Clientes'));
  clientes.forEach(function (c) {
    var etiqueta = (c.id_cliente || '?') + ' ' + (c.nombre || '');
    if (!c.url_sheet_cliente) { fallidos.push({ que: etiqueta, error: 'sin url_sheet_cliente' }); return; }
    try {
      var srcId = SpreadsheetApp.openByUrl(c.url_sheet_cliente).getId();
      var nombre = _nombreSeguro_(etiqueta) + ' — ' + stamp;
      var r = _copiarSpreadsheet_(srcId, nombre, sub);
      copiados.push({ que: etiqueta, url: r.url, carpeta: r.carpeta });
    } catch (e) {
      fallidos.push({ que: etiqueta, error: String((e && e.message) || e) });
    }
  });

  // Retención: conservar las últimas N subcarpetas backup_*, papelera al resto.
  var nombres = [];
  var it = root.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var nm = f.getName();
    if (nm.indexOf('backup_') === 0) nombres.push({ nombre: nm, folder: f });
  }
  nombres.sort(function (a, b) { return a.nombre < b.nombre ? 1 : (a.nombre > b.nombre ? -1 : 0); }); // desc: más nuevo primero
  var ret = _retencionSemanas_(), purgadas = 0;
  for (var i = ret; i < nombres.length; i++) {
    try { nombres[i].folder.setTrashed(true); purgadas++; } catch (_t) {}
  }

  var resumen = {
    ok: fallidos.length === 0,
    stamp: stamp,
    folder_url: sub.getUrl(),
    copiados: copiados,
    fallidos: fallidos,
    retenidas: Math.min(ret, nombres.length),
    purgadas: purgadas
  };

  // Telemetría liviana para el CM/estado (última corrida).
  try {
    setConfig('backup_ultimo_ts', ahoraISO());
    setConfig('backup_ultimo_resumen', copiados.length + ' ok / ' + fallidos.length + ' fallo(s) · ' + stamp);
  } catch (_c) {}

  // Feed siempre; Aviso + email SOLO si hubo fallo (no ensuciar "Hoy" cuando va bien).
  try { feed_('Backup', 'backup', '', 'Backup ' + stamp + ': ' + copiados.length + ' copiados, ' + fallidos.length + ' fallidos.'); } catch (_fe) {}
  if (fallidos.length) {
    var det = fallidos.map(function (x) { return x.que + ' (' + x.error + ')'; }).join('; ');
    try { crearAviso({ origen: 'sistema', tipo: 'backup_fallo', mensaje: 'Backup ' + stamp + ' con fallos: ' + det }); } catch (_a) {}
    try { alertaEmail_('Backup con fallos', 'El backup ' + stamp + ' falló en: ' + det, 'backup_' + hoyISO()); } catch (_ea) {}
  }

  // PURGA B3: si moveTo falló, la copia queda suelta en la raíz y la retención
  // (que solo borra carpetas backup_*) NO la limpia → aviso LOUD para no acumular
  // en silencio. Señal de que el scope moveTo/drive.file necesita revisión.
  var sinCarpeta = copiados.filter(function (x) { return x.carpeta === false; });
  if (sinCarpeta.length) {
    resumen.sin_carpeta = sinCarpeta.length;
    try { crearAviso({ origen: 'sistema', tipo: 'backup_degradado', mensaje: 'Backup ' + stamp + ': ' + sinCarpeta.length + ' copia(s) quedaron en la raíz de Drive (moveTo falló). La retención por carpeta NO las limpia; borrarlas a mano y revisar scope.' }); } catch (_sc) {}
  }
  return resumen;
}

/** Trigger semanal: respeta la pausa operativa (kill switch). */
function backupSemanal() {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  if (_sistemaPausado_()) { Logger.log('PAUSA: backupSemanal omitida'); return { pausado: true }; }
  try {
    return _ejecutarBackup_();
  } catch (e) {
    var msg = String((e && e.message) || e);
    try { crearAviso({ origen: 'sistema', tipo: 'backup_fallo', mensaje: 'backupSemanal abortó: ' + msg }); } catch (_a) {}
    try { alertaEmail_('Backup abortó', msg, 'backupabort_' + hoyISO()); } catch (_x) {}
    Logger.log('backupSemanal ERROR: ' + msg);
    return { ok: false, error: msg };
  }
}

/** Backup manual desde el editor (deliberado → ignora la pausa). */
function backupAhora() {
  var r = _ejecutarBackup_();
  Logger.log('backupAhora: ' + JSON.stringify(r));
  return r;
}

/** Instala (idempotente) el trigger semanal: domingo 04:00 Europe/Madrid. */
function instalarTriggerBackup() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'backupSemanal'; });
  var out;
  if (existe) {
    out = { ok: true, nota: 'ya existía el trigger backupSemanal' };
  } else {
    ScriptApp.newTrigger('backupSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4).create();
    out = { ok: true, nota: 'trigger backupSemanal creado (domingo 04:00)' };
  }
  Logger.log('instalarTriggerBackup: ' + JSON.stringify(out));
  return out;
}

/** Estado del trigger (verificar sin abrir el panel de Activadores). */
function estadoTriggerBackup() {
  var t = ScriptApp.getProjectTriggers().filter(function (x) { return x.getHandlerFunction() === 'backupSemanal'; });
  var out = { instalado: t.length > 0, cantidad: t.length };
  Logger.log('estadoTriggerBackup: ' + JSON.stringify(out));
  return out;
}

/**
 * smokeBackup — prueba REVERSIBLE de que el scope alcanza (createFolder + copy +
 * moveTo + setTrashed) SIN tocar datos reales ni el contenido real de backups. Crea
 * una hoja throwaway, una subcarpeta __smoke__, la copia dentro, verifica y MANDA
 * TODO a la papelera. Correr desde el editor. pass=false indica qué op falló.
 */
function smokeBackup() {
  var rep = [];
  var tmp = null, sub = null, copiaId = null;
  try {
    tmp = SpreadsheetApp.create('__BACKUP_SMOKE__ ' + _stampBackup_());
    tmp.getSheets()[0].getRange('A1').setValue('smoke');
    rep.push(['crear hoja throwaway', true]);

    var root = _backupRootFolder_();
    rep.push(['carpeta raiz backups (get/create)', !!root]);

    sub = root.createFolder('__smoke__' + _stampBackup_());
    rep.push(['createFolder', !!sub]);

    var c = _copiarSpreadsheet_(tmp.getId(), '__smoke_copy__', sub);
    copiaId = c.id;
    rep.push(['Spreadsheet.copy', !!c.id]);
    rep.push(['moveTo carpeta (drive.file)', c.carpeta === true]);

    var leido = SpreadsheetApp.openById(c.id).getSheets()[0].getRange('A1').getValue();
    rep.push(['copia legible (A1=smoke)', String(leido) === 'smoke']);
  } catch (e) {
    rep.push(['EXCEPCION', false, String((e && e.message) || e)]);
  } finally {
    try { if (copiaId) DriveApp.getFileById(copiaId).setTrashed(true); } catch (_1) {}
    try { if (sub) sub.setTrashed(true); } catch (_2) {}
    try { if (tmp) DriveApp.getFileById(tmp.getId()).setTrashed(true); } catch (_3) {}
  }
  var pass = rep.every(function (x) { return x[1]; });
  Logger.log('SMOKE BACKUP: ' + (pass ? 'PASS' : 'FAIL') + ' ' + JSON.stringify(rep));
  return { pass: pass, detalle: rep };
}

/**
 * backupListar — visibilidad: subcarpetas de backup (más nueva primero) + cuántos
 * archivos tiene cada una. Correr desde el editor.
 */
function backupListar() {
  var root = _backupRootFolder_();
  var out = [];
  var it = root.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf('backup_') !== 0) continue;
    var n = 0, fi = f.getFiles();
    while (fi.hasNext()) { fi.next(); n++; }
    out.push({ carpeta: f.getName(), archivos: n, url: f.getUrl() });
  }
  out.sort(function (a, b) { return a.carpeta < b.carpeta ? 1 : (a.carpeta > b.carpeta ? -1 : 0); });
  var res = { total: out.length, carpetas: out };
  Logger.log('backupListar: ' + JSON.stringify(res));
  return res;
}

/**
 * drillRestore — ENSAYO DE RESTAURACIÓN (gate B3). Toma la copia del MAESTRO del
 * backup más reciente, la restaura a una hoja nueva «__RESTORE_DRILL__» y verifica
 * que abre y trae las pestañas del MAESTRO. NO toca el sistema vivo. Devuelve la URL
 * para el ojo de Luciano; borrá la hoja del drill después (queda a propósito).
 * Prueba que el backup ES restaurable (no asumido). Correr desde el editor.
 */
function drillRestore() {
  var r = _drillRestore_();
  Logger.log('drillRestore: ' + JSON.stringify(r));
  return r;
}

function _drillRestore_() {
  var root = _backupRootFolder_();
  var mejor = null;
  var it = root.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf('backup_') !== 0) continue;
    if (!mejor || f.getName() > mejor.getName()) mejor = f;
  }
  if (!mejor) return { ok: false, error: 'no hay backups todavia; corre backupAhora() primero' };

  var src = null, fi = mejor.getFiles();
  while (fi.hasNext()) {
    var file = fi.next();
    if (file.getName().indexOf('MAESTRO') === 0) { src = file; break; }
  }
  if (!src) return { ok: false, error: 'la subcarpeta ' + mejor.getName() + ' no tiene copia MAESTRO' };

  var restaurado = SpreadsheetApp.openById(src.getId()).copy('__RESTORE_DRILL__ ' + _stampBackup_());
  var tabs = restaurado.getSheets().map(function (s) { return s.getName(); });
  var esperadas = MAESTRO_ORDEN.length;
  return {
    ok: tabs.length >= esperadas,
    origen: mejor.getName(),
    restore_url: restaurado.getUrl(),
    pestanas: tabs.length,
    esperadas: esperadas,
    nota: 'Abri restore_url y verifica los datos. Despues manda esta hoja a la papelera (es un ensayo).'
  };
}
