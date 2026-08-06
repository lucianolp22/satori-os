# ENCARGO CODE — BLOQUE 4 · Fase 3: `notas` + panel de edición de Tarea/Proyecto

**Fecha:** 05/08/2026 · **Autor:** Cowork · **Ejecuta:** Claude Code (Terminal del Mac) · **Aprueba el push:** Luciano
**Repo:** `Projects/SatoriOS/` · HEAD base verificado `84dcb9a` · **Ley:** `docs/TRELLO-a-Satori-mapeo.md` §6 (Fase 3) + `docs/NOTION-a-Satori-mapeo.md` §3.
**Deploy destino:** `/exec` @37 (hoy @36).

---

## 0. Estado verificado (05/08) — construí sobre esto, no lo reabras

La **Fase 1 de Trello YA está en prod** (verificado contra código vivo, NO re-hacer):
- Schema `Tareas` con `tipo/etiquetas/recurrencia/orden` (`01_schema.js:18`).
- `parseQuickAdd`/`parseRecurrencia`/`crearTarea`/`crearTareaQuick` (`08_webapp.js:1529-1620`).
- Clon-al-completar recurrencia en `moverTarea` (`08_webapp.js:1648-1675`).
- UI: quick-add `#kadd` con sigilos + chips de tipo (`index.html:1311, 1315-1321`), render `ccKCard` (~4670).

**Esto es la Fase 3, ACOTADA a los 2 ítems del handoff.** Nada de Fase 2 (rollup `%_avance`, plantillas de proceso) ni timeline. Anti-scope-creep innegociable.

## 1. Alcance EXACTO

**DENTRO:**
1. Columna `notas` (fila-es-documento) en `Tareas` **y** `Proyectos`.
2. Panel de **detalle/edición de tarea** en el CM, con **pickers** (proyecto/estado/prioridad/fecha/tipo/recurrencia/etiquetas) + `notas` (textarea). Se abre desde la tarjeta del kanban.
3. `notas` de proyecto editable dentro de `panelCliente`.

**FUERA (no tocar):** el quick-add `#kadd` sigue sin campos (capturar es tonto, a propósito). Los pickers viven en el panel de EDICIÓN, no en el alta. Sin nuevas relaciones, sin rollups (guardrail §7).

## 2. Gate satori-design (registro operativo)

Reusar tokens existentes de `index.html`; **cero tokens nuevos**. El modal a espejar es el de Agenda (`cf*`, `index.html:1340-1352`): `.cm-sel` para selects, `<input type=date/time>`, `.btn`/`.btn-sm`/`.btn-ghost`, chips `c-ok/c-warn/c-danger/c-idle`. Estados 6/6 (hover/focus/active/disabled/loading/empty). `tabular-nums` no aplica (texto). Checklist de salida de `satori-design` antes de cerrar la UI.

---

## 3. Cambios por archivo

### 3.1 `src/01_schema.js` — columnas `notas` (ADITIVO)

`ensureSheet` (`07_util.js:66`) reconcilia headers al FINAL sin reordenar/borrar (verificado `07_util.js:74-83`). Solo agregar la clave al array:

```js
// Proyectos: agregar 'notas' al final
Proyectos: ['id_proyecto', 'id_cliente', 'nombre', 'estado', '%_avance', 'fecha_objetivo', 'proximo_hito', 'fecha_ultimo_movimiento', 'notas'],
// Tareas: agregar 'notas' al final
Tareas: ['id_tarea', 'id_proyecto', 'descripcion', 'prioridad', 'estado', 'fecha_limite', 'fecha_creacion', 'tipo', 'etiquetas', 'recurrencia', 'orden', 'notas'],
```

`notas` NO va en `COLUMNAS_TEXTO` (es texto libre, no un ID). **Requiere correr `setup()` en el MAESTRO vivo** para materializar las 2 columnas (idempotente, aditivo, no pisa datos).

### 3.2 `src/08_webapp.js` — 3 funciones nuevas (espejo de `moverTarea`)

Reusan lo que ya existe: `_soloOwner_`, `getMaestro`, `leerTabla`, `aFechaISO`, `sanitizarCelda`, `conLock`, `feed_`, `clienteDeProyecto`, `ESTADOS_TAREA_UI`, `TAREA_TIPOS`, `TAREA_RECS`. Pegar junto a `moverTarea`.

```js
/**
 * Edita campos de UNA tarea desde el panel de detalle del CM. Espejo de moverTarea:
 *  (1) whitelist de campos editables; ignora cualquier otro (no rompe si llega basura);
 *  (2) valida cada valor; escribe SOLO las columnas presentes (nunca borra el resto);
 *  (3) `notas` pasa por sanitizarCelda (antifórmula) + truncado; loguea en Actividad.
 * AREL: interno + reversible = avanzar (sin gate). _soloOwner_ como el resto de endpoints CM.
 */
function guardarTarea(idTarea, campos) {
  _soloOwner_('guardarTarea');
  idTarea = String(idTarea || '').trim();
  if (!idTarea) throw new Error('guardarTarea: falta id_tarea');
  var c = campos || {};
  var sh = getMaestro().getSheetByName('Tareas');
  if (!sh) throw new Error('No existe la pestaña Tareas');
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  if (H.indexOf('id_tarea') < 0) throw new Error('Schema Tareas sin id_tarea');
  var w = {};
  if (c.descripcion !== undefined) { var d = String(c.descripcion).trim(); if (d) w.descripcion = d.slice(0, 300); }
  if (c.prioridad !== undefined)   { var p = String(c.prioridad).toUpperCase(); if (['A','B','C'].indexOf(p) >= 0) w.prioridad = p; }
  if (c.estado !== undefined)      { var e = String(c.estado).toLowerCase(); if (ESTADOS_TAREA_UI.indexOf(e) >= 0) w.estado = e; }
  if (c.tipo !== undefined)        { var tp = String(c.tipo).toLowerCase(); if (TAREA_TIPOS.indexOf(tp) >= 0 || tp === '') w.tipo = tp; }
  if (c.recurrencia !== undefined) { var r = String(c.recurrencia).toLowerCase(); if (TAREA_RECS.indexOf(r) >= 0 || r === '') w.recurrencia = r; }
  if (c.fecha_limite !== undefined) w.fecha_limite = aFechaISO(c.fecha_limite) || '';
  if (c.id_proyecto !== undefined)  w.id_proyecto = String(c.id_proyecto || '');
  if (c.etiquetas !== undefined) {
    var ets = c.etiquetas; if (typeof ets === 'string') ets = ets.split(',');
    w.etiquetas = ets.map(function (x){ return String(x).trim().toLowerCase(); }).filter(String).slice(0, 6).join(',');
  }
  if (c.notas !== undefined) w.notas = sanitizarCelda(String(c.notas)).slice(0, 4000); // fila-es-documento
  var claves = Object.keys(w);
  if (!claves.length) return { id_tarea: idTarea, sin_cambio: true };
  return conLock(function () {
    var n = sh.getLastRow(); if (n < 2) throw new Error('Sin tareas');
    var filas = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
    var cId = H.indexOf('id_tarea'), fila = -1;
    for (var i = 0; i < filas.length; i++) if (String(filas[i][cId]) === idTarea) { fila = i + 2; break; }
    if (fila < 0) throw new Error('Tarea no encontrada: ' + idTarea);
    claves.forEach(function (k) { var col = H.indexOf(k); if (col >= 0) sh.getRange(fila, col + 1).setValue(w[k]); });
    var idProy = H.indexOf('id_proyecto') >= 0 ? filas[fila - 2][H.indexOf('id_proyecto')] : '';
    try { feed_('Director', 'accion', clienteDeProyecto(idProy), 'Tarea ' + idTarea + ' editada (' + claves.join(',') + ') desde el panel CM', idTarea, ''); } catch (e) {}
    return { id_tarea: idTarea, guardado: claves };
  });
}

/** Devuelve la fila completa de UNA tarea (para poblar el panel de detalle). _soloOwner_. */
function detalleTarea(idTarea) {
  _soloOwner_('detalleTarea');
  idTarea = String(idTarea || '').trim();
  var sh = getMaestro().getSheetByName('Tareas');
  if (!sh) throw new Error('No existe la pestaña Tareas');
  var t = leerTabla(sh).filter(function (f) { return String(f.id_tarea) === idTarea; })[0];
  if (!t) throw new Error('Tarea no encontrada: ' + idTarea);
  return {
    id_tarea: t.id_tarea, id_proyecto: t.id_proyecto || '', descripcion: t.descripcion || '',
    prioridad: t.prioridad || 'B', estado: String(t.estado || '').toLowerCase(),
    fecha_limite: aFechaISO(t.fecha_limite) || '', tipo: String(t.tipo || '').toLowerCase(),
    etiquetas: String(t.etiquetas || ''), recurrencia: String(t.recurrencia || '').toLowerCase(),
    notas: String(t.notas || '')
  };
}

/** Setea la nota (fila-es-documento) de un Proyecto. Espejo mínimo de guardarTarea. _soloOwner_. */
function guardarNotaProyecto(idProyecto, notas) {
  _soloOwner_('guardarNotaProyecto');
  idProyecto = String(idProyecto || '').trim();
  if (!idProyecto) throw new Error('falta id_proyecto');
  var sh = getMaestro().getSheetByName('Proyectos');
  if (!sh) throw new Error('No existe la pestaña Proyectos');
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var cId = H.indexOf('id_proyecto'), cN = H.indexOf('notas');
  if (cId < 0) throw new Error('Schema Proyectos sin id_proyecto');
  if (cN < 0) throw new Error('Falta la columna notas en Proyectos — correr setup()');
  return conLock(function () {
    var n = sh.getLastRow(); if (n < 2) throw new Error('Sin proyectos');
    var filas = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < filas.length; i++) if (String(filas[i][cId]) === idProyecto) {
      sh.getRange(i + 2, cN + 1).setValue(sanitizarCelda(String(notas)).slice(0, 4000));
      try { feed_('Director', 'accion', clienteDeProyecto(idProyecto), 'Nota de proyecto ' + idProyecto + ' actualizada', '', ''); } catch (e) {}
      return { id_proyecto: idProyecto, ok: true };
    }
    throw new Error('Proyecto no encontrado: ' + idProyecto);
  });
}
```

Además: en el objeto que arma las tarjetas del kanban (~`08_webapp.js:1506-1508`) agregar `notas` al payload de la tarea para no pedir `detalleTarea` de más — **opcional** (el panel puede llamar `detalleTarea` al abrir, que es lo más limpio; elegí uno y sé consistente).

### 3.3 `src/index.html` — panel de detalle + notas de proyecto

**A. Panel de edición de tarea** (modal, espejo del `cf` de Agenda). Markup con clases existentes:

```html
<!-- Modal de detalle/edición de tarea (espejo de #cfModal). Tokens existentes. -->
<div id="tdModal" class="cm-modal" hidden aria-modal="true" role="dialog" aria-label="Detalle de tarea">
  <form id="tdForm" class="cm-card">
    <div class="cm-modal-h"><span id="tdId" class="chip c-idle">TAR-…</span><button type="button" class="btn btn-ghost btn-sm" id="tdCerrar">Cerrar</button></div>
    <label>Descripción<input type="text" id="tdDesc" maxlength="300" required></label>
    <div class="cm-row">
      <label>Proyecto<select id="tdProy" class="cm-sel"><option value="">— sin proyecto —</option></select></label>
      <label>Estado<select id="tdEstado" class="cm-sel"></select></label>
    </div>
    <div class="cm-row">
      <label>Prioridad<select id="tdPrio" class="cm-sel"><option>A</option><option>B</option><option>C</option></select></label>
      <label>Vence<input type="date" id="tdFecha"></label>
      <label>Recurrencia<select id="tdRec" class="cm-sel"><option value="">—</option><option value="1d">cada día</option><option value="1s">cada semana</option><option value="2s">cada quincena</option><option value="1m">cada mes</option></select></label>
    </div>
    <div class="cm-row">
      <label>Tipo<select id="tdTipo" class="cm-sel"><option value="">—</option><option>cliente</option><option>periodica</option><option>objetivo</option><option>personal</option><option>admin</option></select></label>
      <label>Etiquetas<input type="text" id="tdEtq" placeholder="a, b (máx 6)"></label>
    </div>
    <label>Notas<textarea id="tdNotas" rows="5" maxlength="4000" placeholder="Log / contexto de la tarea…"></textarea></label>
    <div class="cm-modal-f"><button type="submit" class="btn btn-sm" id="tdGuardar">Guardar cambios</button></div>
  </form>
</div>
```

Poblar `#tdEstado` desde `ESTADOS_TAREA_UI` y `#tdProy` desde la lista de proyectos ya cargada (o `panelCliente`/una lista liviana). JS de apertura/guardado (patrón `google.script.run` idéntico al quick-add):

```js
function abrirTarea(idTarea){
  if(!EN_GAS){ cmToast('Detalle disponible solo en GAS'); return; }
  google.script.run.withSuccessHandler(function(t){
    tdFill(t); document.getElementById('tdModal').hidden=false;
  }).withFailureHandler(function(e){ cmToast('No se pudo abrir: '+((e&&e.message)||'error')); }).detalleTarea(idTarea);
}
function tdFill(t){ /* set .value de cada campo desde t; #tdId.textContent=t.id_tarea; guardar t.id_tarea en dataset */ }
document.getElementById('tdForm').addEventListener('submit',function(ev){
  ev.preventDefault();
  var id=/*dataset*/, campos={ descripcion:tdDesc.value, id_proyecto:tdProy.value, estado:tdEstado.value,
    prioridad:tdPrio.value, fecha_limite:tdFecha.value, recurrencia:tdRec.value, tipo:tdTipo.value,
    etiquetas:tdEtq.value, notas:tdNotas.value };
  tdGuardar.disabled=true;
  google.script.run.withSuccessHandler(function(){ tdGuardar.disabled=false; document.getElementById('tdModal').hidden=true; cmToast('Tarea guardada'); ccKanbanLoad(); })
    .withFailureHandler(function(e){ tdGuardar.disabled=false; cmToast('No se guardó: '+((e&&e.message)||'error')); }).guardarTarea(id,campos);
});
```

**B. Abrir el panel desde la tarjeta SIN romper el drag.** En `ccKCard` agregar una afordancia dedicada (evita el conflicto click-vs-drag):

```js
// dentro de ccKCard, antes del return:
var open=el('button','kcard-open','⋯'); open.title='Detalle';
open.addEventListener('click',function(ev){ ev.stopPropagation(); abrirTarea(t.id_tarea); });
c.appendChild(open);
```
CSS `.kcard-open`: botón fantasma chico, esquina, `--color-text-subtle` → hover `--color-text`, focus visible ≥2px. NO poner el click en el cuerpo de la tarjeta (colisiona con `dragstart`).

**C. Notas de proyecto en `panelCliente`.** Donde se renderiza cada proyecto, agregar un textarea + botón "Guardar nota" → `guardarNotaProyecto(id_proyecto, valor)` (mismo patrón `google.script.run`). Reusar `.f360-chk-add` como base visual.

### 3.4 `src/09_selftest.js` — asserts (bloque D8, tras la línea ~311)

```js
// ── D8b Tareas-v2 F3 — notas + edición (guardarTarea/detalleTarea) ──
var t8c = crearTarea({ descripcion: '__TEST__ F3 edicion', prioridad: 'C', tipo: 'personal' });
guardarTarea(t8c.id_tarea, { prioridad: 'A', notas: '=HYPERLINK("x")', etiquetas: 'a,b,a', descripcion: '  ', bicho: 'x' });
var det = detalleTarea(t8c.id_tarea);
chk(det.prioridad === 'A', 'D8b guardarTarea escribe campo whitelisted (prioridad)');
chk(det.notas.charAt(0) !== '=', 'D8b notas sanitizada (antifórmula)');
chk(det.descripcion === '__TEST__ F3 edicion', 'D8b descripción vacía NO pisa el valor previo');
chk(det.etiquetas === 'a,b', 'D8b etiquetas normalizadas + dedup-por-orden (a,b)');
```
`limpiarTodoTest` barre los `__TEST__` por origen. **El total del harness sube de 500 a 504** (declararlo en el HANDOFF).

### 3.5 `docs/CLAUDE.md` — 2 reglas duras (guardrails del handoff, no opcionales)

```md
- **Gate anti-rollup / anti-campo-computado.** Antes de agregar CUALQUIER métrica, rollup o relación nueva: "¿qué haría distinto según este número?". Sin respuesta concreta → no se agrega. La espina Cliente→Proyecto→Tarea (0-2 relaciones) es el límite. (Notion tax, NOTION-a-Satori-mapeo §5.)
- **Multi-vista disciplinada.** Toda vista/filtro nueva = filtro/orden/render sobre la MISMA hoja, jamás una copia del dato.
```

---

## 4. Downstream (pensamiento paralelo — antes de tocar)

Todo lo que lee `Tareas`/`Proyectos` mapea por NOMBRE (`leerTabla`/`appendFila`), así que agregar `notas` al final es no-disruptivo (verificado en el comentario aditivo de `ensureSheet`, `07_util.js:75-77`). Revisados: `moverTarea` (lee header con `H.indexOf` → OK), `crearTarea` (appendFila por claves → `notas` nace vacía → OK), `panelCliente` (map de proyectos → additivo), `correrSalud`/`MAESTRO_SHEETS[n].forEach` (misma def de hoja → OK), vigilancia/CSV (columna extra ignorada). **Riesgo de regresión: bajo.** Confianza 8/10.

## 5. Verificación (innegociable, en orden) y deploy

1. `node --check` sobre `08_webapp.js`, `01_schema.js`, `09_selftest.js`.
2. Harness offline (`node _harness.js`): debe pasar **504/0** (500 previos + 4 D8b). Si baja de 504 o hay ❌ → NO seguir.
3. En el editor GAS: `setup()` (materializa `notas` en Tareas y Proyectos, aditivo) → `selfTest()` + tramos 2-5 + `selfTestVeredicto()` verde.
4. Prueba manual en `/dev`: abrir tarjeta → editar → guardar → recargar; nota de proyecto en la ficha.
5. **`clasp push` + promote a `/exec` @37** — lo aprueba Luciano (AREL alto: deploy).
6. Cowork corre la **purga-de-errores** sobre el diff antes de declarar cierre.

## 6. AREL

Build reversible → Cowork/Code accionan hasta el `clasp push`. El push + el `setup()` en el MAESTRO vivo (escribe estructura real) los **aprueba/dispara Luciano**. La UI pasa el checklist de salida de `satori-design`.

---
*Handoff parcial: al cerrar, actualizar `HANDOFF.md` (BLOQUE 5.3) sumando "F3 tareas: notas + panel de edición · harness 504/0".*
