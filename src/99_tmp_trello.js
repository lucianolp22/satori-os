/**
 * 99_tmp_trello.js — TEMPORAL: importa el board Trello "Lp 2026" a la pestaña Tareas (07-jul-2026).
 * Correr tmp_importTrello() UNA vez desde el editor. Idempotente: dedupe por id_tarea (re-correr no duplica).
 * BORRAR este archivo en el proximo commit (patron 99_tmp_b2). Origen: PDF del board, 23 tareas
 * (10 checklist-A + 1 en_curso + 5 periodicas + 7 buzon-B; REALIZADAS historicas y OBJETIVOS excluidos por decision).
 */
function tmp_importTrello() {
  var TAREAS = [
    { id_tarea: 'TAR-0001', id_proyecto: '', descripcion: 'ARMAR REUNIONES LC TRAVEL', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0002', id_proyecto: '', descripcion: 'Registrar Patinete en Hacienda web', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0003', id_proyecto: '', descripcion: 'AVERIGUAR POR POSIBILIDAD DE HACER FACTURAS LP A ALEX DAM', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0004', id_proyecto: '', descripcion: 'Armar Finanzas personales', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0005', id_proyecto: '', descripcion: 'PASAR FACTURAS A HOLDED + VOLCAR PAGOS', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0006', id_proyecto: '', descripcion: 'EECC PC QUINCENAL', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0007', id_proyecto: '', descripcion: 'SOLICITAR APLAZAMIENTO DE DEUDA PERSONAL PC CON SS', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0008', id_proyecto: '', descripcion: 'ENVIAR CORREO A ENRED. CHEQUEAR SITUACION CON ELLOS', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0009', id_proyecto: '', descripcion: 'AVERIGUAR POR SERVICIO DE AGUA DE M15. REGULARIZAR SALDO DEUDOR EN PLAN', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0010', id_proyecto: '', descripcion: 'COMUNICAR A PC SOBRE DESISTIR CON EL SINIESTRO DE AVANZAX SOBRE INFINE', prioridad: 'A', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0011', id_proyecto: '', descripcion: 'Armar EERRs, Calendario y Pto de Eq. de Vehemence', prioridad: 'A', estado: 'en_curso', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0012', id_proyecto: '', descripcion: 'REVISAR CORREOS A DIARIO (recurrente)', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0013', id_proyecto: '', descripcion: 'REPORTE SEMANAL M15 (recurrente)', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0014', id_proyecto: '', descripcion: 'PROCESADO DE REGISTROS CONTABLES SEMANAL (recurrente)', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0015', id_proyecto: '', descripcion: 'REPORTE SEMANAL VEHEMENCE (recurrente)', prioridad: 'B', estado: 'hecha', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0016', id_proyecto: '', descripcion: 'REUNION VEHEMENCE (recurrente)', prioridad: 'B', estado: 'hecha', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0017', id_proyecto: '', descripcion: 'Comenzar el proceso de Clientes nuevos con Vehemence', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0018', id_proyecto: '', descripcion: 'Comenzar el proceso de Clientes nuevos con EJF', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0019', id_proyecto: '', descripcion: 'Armar Propuesta para Pipol Coffee', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0020', id_proyecto: '', descripcion: 'Armar Propuesta para Crocante', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0021', id_proyecto: '', descripcion: 'COORDINAR CON DANI Y VISITAR CROCANTE', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0022', id_proyecto: '', descripcion: 'Mapear con precision que cobra cada uno, que paga cada uno y cual es la logica detras', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' },
    { id_tarea: 'TAR-0023', id_proyecto: '', descripcion: 'Actualizar LinkedIn propio', prioridad: 'B', estado: 'pendiente', fecha_limite: '', fecha_creacion: '2026-07-07' }
  ];
  var sh = getMaestro().getSheetByName('Tareas');
  if (!sh) throw new Error('Falta la pestaña Tareas.');
  return conLock(function () {
    var existentes = {};
    leerTabla(sh).forEach(function (f) { existentes[String(f.id_tarea)] = true; });
    var nuevas = 0, saltadas = 0;
    TAREAS.forEach(function (t) {
      if (existentes[t.id_tarea]) { saltadas++; return; }
      appendFila(sh, t);
      nuevas++;
    });
    var res = { nuevas: nuevas, saltadas: saltadas, total_en_hoja: leerTabla(sh).length };
    Logger.log('tmp_importTrello: ' + JSON.stringify(res));
    return res;
  });
}
