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
 * Scope (REESCRITO en BK-1 y BK-2, 04-ago): TODO Drive va por el SERVICIO AVANZADO v3 bajo
 * 'drive.file', la copia INCLUIDA (files.copy con name+parents: nace dentro de la carpeta y nace
 * administrable). `Spreadsheet.copy` quedó PROHIBIDO acá: bajo drive.file la Drive API no ve el
 * archivo que produce — ese fue BK-2, con 8 moves fallando con «File not found». El resto: crear carpeta
 * (files.create + mimeType folder), mover (files.update con addParents/removeParents), listar
 * (files.list, que bajo drive.file solo ve lo que la app creó) y papelera (_trashArchivo_).
 * ⚠ NO usar DriveApp acá: exige 'drive'/'drive.readonly', que este proyecto NO declara. Ese fue
 * exactamente el bug — el 03-jul (2e014f0) el manifiesto se recortó y nadie migró este archivo:
 * los backups quedaron MUERTOS un mes, tapados por catch mudos. Lo asera D43.
 * smokeBackup() lo PRUEBA reversible antes de confiar el trigger
 * (mismo criterio que smokeKill). Si una hoja cliente NO fuera creada por la app, su
 * copia falla AISLADA (try/catch) y se reporta; no tumba el resto del run.
 *
 * Kill switch: backupSemanal() (trigger) respeta la pausa operativa; backupAhora()
 * (corrida manual desde el editor) NO — es acción deliberada de Luciano.
 * Retención: conserva las últimas N carpetas (Config 'backup_retencion_semanas',
 *   def 8); las más viejas → papelera vía _trashArchivo_. Lo que NO se pudo purgar se avisa.
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
    var meta = _driveGet_(id, 'id,trashed');
    if (meta.ok && !meta.trashed) return { ok: true, id: String(id), url: _driveUrlCarpeta_(id), creada: false };
    // id muerto o en papelera → se recrea, pero se DICE por qué (antes esto era un catch mudo)
  }
  var nueva = _driveCrearCarpeta_(BACKUP_ROOT_NOMBRE, null);
  if (!nueva.ok) return { ok: false, error: 'no pude crear la carpeta raíz de backups: ' + nueva.error };
  props.setProperty(PROP_BACKUP_FOLDER_ID, nueva.id);
  return { ok: true, id: nueva.id, url: _driveUrlCarpeta_(nueva.id), creada: true };
}

/** Retención en semanas (Config, con default). */
function _retencionSemanas_() {
  var n = Number(getConfig('backup_retencion_semanas') || BACKUP_RETENCION_DEF);
  return (n && n > 0) ? Math.floor(n) : BACKUP_RETENCION_DEF;
}

/**
 * Copia un Spreadsheet (por id) DENTRO de la carpeta destino, en UN solo call de la Drive API.
 *
 * BK-2 (04-ago, hallazgo de `backupAhora` 14:15): la versión de BK-1 hacía `Spreadsheet.copy()` y
 * después `_driveMover_`, y **los 8 moves fallaron con «File not found»** en `files.get` sobre las
 * copias recién creadas. La evidencia del mismo día lo explica: bajo `drive.file` la Drive API SÍ
 * ve los archivos nacidos de `SpreadsheetApp.create` (la papelera de los tramos funcionó sobre los
 * tenants `__TEST__`) pero NO los nacidos de `Spreadsheet.copy`. El permiso por-archivo sigue al
 * creador, y a ojos de la Drive API `Spreadsheet.copy` no es una creación suya.
 *
 * Por eso ahora se copia YA adentro con `Drive.Files.copy` (acepta `drive.file`; el recurso admite
 * `name` y `parents`): la copia nace en la carpeta correcta y nace administrable. Un solo call,
 * cero move posterior, cero ventana en la que el archivo exista pero sea inmanejable.
 *
 * @return {{ok:boolean, id?:string, url?:string, carpeta:boolean, error_mover:string}}
 */
function _copiarSpreadsheet_(srcId, nombre, carpetaId) {
  var c = _driveCopiar_(srcId, nombre, carpetaId);
  if (!c.ok) throw new Error('no pude copiar: ' + c.error);   // FUERTE: el llamador lo registra en `fallidos`
  // `carpeta` se VERIFICA contra los parents que devolvió la API, no se asume por el ok.
  var dentro = !carpetaId || (c.parents || []).indexOf(String(carpetaId)) >= 0;
  return { ok: true, id: c.id, url: _driveUrlSheet_(c.id), carpeta: dentro,
           error_mover: dentro ? '' : 'la copia no quedó en la carpeta pedida (parents: ' + (c.parents || []).join(',') + ')' };
}

/**
 * Núcleo del backup. Copia MAESTRO + todos los Sheets cliente a una subcarpeta
 * fechada. Aísla fallos por hoja. Aplica retención. Loguea al feed. Devuelve
 * {ok, stamp, folder_url, copiados[], fallidos[], retenidas, purgadas}.
 */
function _ejecutarBackup_() {
  var stamp = _stampBackup_();
  var root = _backupRootFolder_();
  // BK-1: sin carpeta raíz no hay backup. Antes esto reventaba adentro y el error moría en el
  // catch del llamador; ahora corta acá y lo DICE — un backup que no ocurrió tiene que gritar.
  if (!root.ok) {
    var errRoot = { ok: false, stamp: stamp, error: root.error, copiados: [], fallidos: [{ que: 'carpeta raíz', error: root.error }] };
    try { crearAviso({ origen: 'sistema', tipo: 'backup_fallo', mensaje: 'Backup ' + stamp + ' ABORTADO: ' + root.error }); } catch (_ar) {}
    try { alertaEmail_('Backup ABORTADO', 'No se pudo abrir ni crear la carpeta de backups: ' + root.error, 'backup_' + hoyISO()); } catch (_er) {}
    return errRoot;
  }
  var subC = _driveCrearCarpeta_('backup_' + stamp, root.id);
  if (!subC.ok) {
    try { crearAviso({ origen: 'sistema', tipo: 'backup_fallo', mensaje: 'Backup ' + stamp + ' ABORTADO (subcarpeta): ' + subC.error }); } catch (_as) {}
    return { ok: false, stamp: stamp, error: subC.error, copiados: [], fallidos: [{ que: 'subcarpeta', error: subC.error }] };
  }
  var sub = subC.id;
  var copiados = [], fallidos = [];

  // MAESTRO
  try {
    var m = _copiarSpreadsheet_(getMaestro().getId(), 'MAESTRO — ' + stamp, sub);
    copiados.push({ que: 'MAESTRO', url: m.url, carpeta: m.carpeta, error_mover: m.error_mover });
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
      copiados.push({ que: etiqueta, url: r.url, carpeta: r.carpeta, error_mover: r.error_mover });
    } catch (e) {
      fallidos.push({ que: etiqueta, error: String((e && e.message) || e) });
    }
  });

  // Retención: conservar las últimas N subcarpetas backup_*, papelera al resto.
  var lst = _driveListarHijos_(root.id, true);
  var nombres = (lst.items || []).filter(function (f) { return String(f.name).indexOf('backup_') === 0; })
    .map(function (f) { return { nombre: f.name, id: f.id }; });
  nombres.sort(function (a, b) { return a.nombre < b.nombre ? 1 : (a.nombre > b.nombre ? -1 : 0); }); // desc: más nuevo primero
  var ret = _retencionSemanas_(), purgadas = 0, fallosRetencion = [];
  if (!lst.ok) fallosRetencion.push('no pude listar la carpeta raíz: ' + lst.error);
  for (var i = ret; i < nombres.length; i++) {
    var t = _trashArchivo_(nombres[i].id);
    if (t.ok) purgadas++;
    else fallosRetencion.push(nombres[i].nombre + ': ' + t.error);   // antes: catch mudo ⇒ se acumulaba sin que nadie supiera
  }

  var resumen = {
    ok: fallidos.length === 0,
    stamp: stamp,
    folder_url: _driveUrlCarpeta_(sub),
    copiados: copiados,
    fallidos: fallidos,
    retenidas: Math.min(ret, nombres.length),
    purgadas: purgadas,
    fallos_retencion: fallosRetencion
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
    resumen.detalle_sin_carpeta = sinCarpeta.map(function (x) { return x.que + ': ' + (x.error_mover || 'sin motivo'); });
    try { crearAviso({ origen: 'sistema', tipo: 'backup_degradado', mensaje: 'Backup ' + stamp + ': ' + sinCarpeta.length + ' copia(s) quedaron en la raíz de Drive (el move falló: ' + (sinCarpeta[0].error_mover || '?') + '). La retención por carpeta NO las limpia; borrarlas a mano.' }); } catch (_sc) {}
  }
  // BK-1: la retención que no pudo purgar también se surfacea — si no, las carpetas viejas se
  // acumulan en silencio hasta que alguien mira el Drive a mano.
  if (fallosRetencion.length) {
    try { crearAviso({ origen: 'sistema', tipo: 'backup_degradado', mensaje: 'Backup ' + stamp + ': la retención no pudo purgar ' + fallosRetencion.length + ' carpeta(s) — ' + fallosRetencion.slice(0, 3).join(' · ') }); } catch (_fr) {}
  }
  return resumen;
}

/** Trigger semanal: respeta la pausa operativa (kill switch). */
function backupSemanal() {
  _ctxSistema_();   // T3-S1: entry point de sistema (trigger/editor) — habilita los endpoints gateados que reusa aguas adentro
  _soloOwner_('backupSemanal');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta. Va DESPUÉS de _ctxSistema_: antes rompería el trigger.
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
  _soloOwner_('backupAhora');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var r = _ejecutarBackup_();
  Logger.log('backupAhora: ' + JSON.stringify(r));
  return r;
}

/** Instala (idempotente) el trigger semanal: domingo 04:00 Europe/Madrid. */
function instalarTriggerBackup() {
  _soloOwner_('instalarTriggerBackup');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
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
  _soloOwner_('estadoTriggerBackup');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
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
  _soloOwner_('smokeBackup');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var rep = [];
  var tmp = null, sub = null, copiaId = null;
  try {
    tmp = SpreadsheetApp.create('__BACKUP_SMOKE__ ' + _stampBackup_());
    tmp.getSheets()[0].getRange('A1').setValue('smoke');
    rep.push(['crear hoja throwaway', true]);

    var root = _backupRootFolder_();
    rep.push(['carpeta raiz backups (get/create)', root.ok === true, root.ok ? '' : root.error]);
    if (!root.ok) throw new Error('sin carpeta raíz: ' + root.error);

    var subC = _driveCrearCarpeta_('__smoke__' + _stampBackup_(), root.id);
    sub = subC.ok ? subC.id : null;
    rep.push(['Drive.Files.create carpeta (drive.file)', subC.ok === true, subC.ok ? '' : subC.error]);
    if (!subC.ok) throw new Error('sin subcarpeta: ' + subC.error);

    var c = _copiarSpreadsheet_(tmp.getId(), '__smoke_copy__', sub);
    copiaId = c.id;
    rep.push(['Drive.Files.copy', !!c.id]);
    rep.push(['copia NACE en la carpeta (Drive.Files.copy + parents)', c.carpeta === true, c.error_mover || '']);

    var leido = SpreadsheetApp.openById(c.id).getSheets()[0].getRange('A1').getValue();
    rep.push(['copia legible (A1=smoke)', String(leido) === 'smoke']);
  } catch (e) {
    rep.push(['EXCEPCION', false, String((e && e.message) || e)]);
  } finally {
    // Fix P2 (04-ago): por `_trashArchivo_` (servicio avanzado de Drive, scope `drive.file`).
    // Con DriveApp esto fallaba siempre y el smoke dejaba su propia basura en Drive.
    if (copiaId) { var _t1 = _trashArchivo_(copiaId); if (!_t1.ok) rep.push(['LIMPIEZA copia', false, _t1.error]); }
    if (sub) { var _t2 = _trashArchivo_(sub); if (!_t2.ok) rep.push(['LIMPIEZA subcarpeta', false, _t2.error]); }
    if (tmp) { var _t3 = _trashArchivo_(tmp.getId()); if (!_t3.ok) rep.push(['LIMPIEZA tmp', false, _t3.error]); }
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
  _soloOwner_('backupListar');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var root = _backupRootFolder_();
  if (!root.ok) {
    // BK-1: acá reventaba (crash del 04-ago 13:20:58). Ahora devuelve el motivo en vez de tirar.
    var errL = { total: 0, carpetas: [], error: root.error };
    Logger.log('backupListar: ' + JSON.stringify(errL));
    return errL;
  }
  var out = [], errores = [];
  var lst = _driveListarHijos_(root.id, true);
  if (!lst.ok) errores.push('listar raíz: ' + lst.error);
  (lst.items || []).forEach(function (f) {
    if (String(f.name).indexOf('backup_') !== 0) return;
    var hijos = _driveListarHijos_(f.id, false);
    if (!hijos.ok) errores.push('listar ' + f.name + ': ' + hijos.error);
    out.push({ carpeta: f.name, archivos: (hijos.items || []).length, url: _driveUrlCarpeta_(f.id) });
  });
  out.sort(function (a, b) { return a.carpeta < b.carpeta ? 1 : (a.carpeta > b.carpeta ? -1 : 0); });
  // BK-2: bajo `drive.file` la Drive API solo ve lo que la app creó o abrió. Las copias anteriores
  // a BK-2 nacieron de `Spreadsheet.copy` y son INVISIBLES para este listado aunque existan en el
  // Drive. El conteo NO es "lo que hay": es "lo que la app puede administrar". Decirlo importa —
  // un 0 acá no prueba que no haya archivos, prueba que no hay archivos gestionables.
  var res = { total: out.length, carpetas: out, errores: errores,
              alcance: 'solo archivos gestionables por la app (drive.file): las copias anteriores a BK-2 pueden existir en Drive y no aparecer acá' };
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
  _soloOwner_('drillRestore');   // X4 (03-ago): top-level ⇒ invocable por RPC ⇒ puerta.
  var r = _drillRestore_();
  Logger.log('drillRestore: ' + JSON.stringify(r));
  return r;
}

function _drillRestore_() {
  var root = _backupRootFolder_();
  if (!root.ok) return { ok: false, error: 'sin carpeta de backups: ' + root.error };
  var lst = _driveListarHijos_(root.id, true);
  if (!lst.ok) return { ok: false, error: 'no pude listar la carpeta de backups: ' + lst.error };
  var mejor = null;
  (lst.items || []).forEach(function (f) {
    if (String(f.name).indexOf('backup_') !== 0) return;
    if (!mejor || f.name > mejor.name) mejor = f;   // el stamp es ordenable: el mayor es el más nuevo
  });
  if (!mejor) return { ok: false, error: 'no hay backups todavia; corre backupAhora() primero' };

  var hijos = _driveListarHijos_(mejor.id, false);
  if (!hijos.ok) return { ok: false, error: 'no pude listar ' + mejor.name + ': ' + hijos.error };
  var src = (hijos.items || []).filter(function (f) { return String(f.name).indexOf('MAESTRO') === 0; })[0];
  if (!src) return { ok: false, error: 'la subcarpeta ' + mejor.name + ' no tiene copia MAESTRO' };

  var restaurado = SpreadsheetApp.openById(src.id).copy('__RESTORE_DRILL__ ' + _stampBackup_());
  var tabs = restaurado.getSheets().map(function (s) { return s.getName(); });
  var esperadas = MAESTRO_ORDEN.length;
  return {
    ok: tabs.length >= esperadas,
    origen: mejor.name,
    restore_url: restaurado.getUrl(),
    pestanas: tabs.length,
    esperadas: esperadas,
    nota: 'Abri restore_url y verifica los datos. Despues manda esta hoja a la papelera (es un ensayo).'
  };
}
