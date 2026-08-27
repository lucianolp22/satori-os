# ENCARGO CODE — BLOQUE A (tanda 2): archivar tareas + fix D8e (purga t1)

> **Para:** Claude Code (Terminal del Mac · `luciano@satoriconsultoria.com`).
> **De:** Cowork. **Fecha:** 07/08/2026. **Depende de:** tanda 1 (`167bcd5`). Idealmente certificás t1+t2 juntas en un solo `clasp push` + `selfTest()`.
> **Loop:** Code construye+verifica → Cowork purga → Luciano aprueba push/promote. No verde sin `selfTest()` en el editor (y ojo: el editor sirve @37 hasta que hagas `clasp push`).

## Alcance (tight — A.3/A.4 quedan para t3)
1. **Fix P1-purga (arranca por acá, es chico):** D8e apunta a `CLI-000`, no a `listaClientes()[0]`.
2. **A.2 · Archivar tareas (manual) + ver archivadas.** Cierra el eyeball #1 + Trello Fase 4 (parte manual).
3. **Auto-archivo (Trello Fase 4) → DIFERIDO a t3**, ver nota al final (necesita `fecha_completada`, que no existe).

## Pre-flight
```
cd ~/Documents/Claude/Projects/SatoriOS
git log --oneline -1          # confirmar 167bcd5 (t1)
node _harness.js              # verde de partida
```
- Recordá: `08_webapp.js` dispara la detección binaria de grep → `grep -a`/`sed`.

---

## TAREA 0 — Fix D8e→CLI-000 (hallazgo Medio de la purga de t1)

**Problema:** en `09_selftest.js` D8e crea `__TEST__ proyecto A1` bajo `listaClientes()[0]`. `[0]` no es determinístico → puede caer sobre un cliente REAL (MesaQuince) y ensuciar su `#tdProy`. **CLI-000 existe** (`08_webapp.js:301`, tenant sistema/Oficina Virtual, `forceId`).

**Parche:** en D8e, reemplazar el target por CLI-000 explícito (y afirmar que existe):
```js
// ── D8e (A.1) — crearProyecto: alta + validación de roster (AISLAMIENTO §3/§9) ──
// Se crea SIEMPRE bajo CLI-000 (tenant sistema), nunca sobre un cliente real: el __TEST__
// no debe ensuciar la lista de proyectos de nadie que facturemos.
var SIS = 'CLI-000';
var hayCli000 = listaClientes().some(function (c) { return String(c.id_cliente) === SIS; });
chk(hayCli000, 'D8e existe el tenant sistema ' + SIS + ' para las altas de prueba');
if (hayCli000) {
  var pr8e = crearProyecto({ id_cliente: SIS, nombre: '__TEST__ proyecto A1', estado: 'activo' });
  chk(/^PRO-\d+$/.test(pr8e.id_proyecto), 'D8e crearProyecto devuelve id (' + pr8e.id_proyecto + ')');
  chk(listaProyectos().some(function (p) { return String(p.id_proyecto) === pr8e.id_proyecto; }), 'D8e el proyecto aparece en listaProyectos');
  var rc8e = ''; try { crearProyecto({ id_cliente: 'CLI-NO-EXISTE-9999', nombre: 'x' }); } catch (e8e) { rc8e = String(e8e && e8e.message); }
  chk(/no encontrado/i.test(rc8e), 'D8e 🔒 crearProyecto rechaza un id_cliente fuera del roster (' + (rc8e || 'no cortó') + ')');
  var rn8e = ''; try { crearProyecto({ id_cliente: SIS, nombre: '   ' }); } catch (e8e2) { rn8e = String(e8e2 && e8e2.message); }
  chk(/falta el nombre/i.test(rn8e), 'D8e crearProyecto exige nombre (' + (rn8e || 'no cortó') + ')');
}
chk(ENDPOINTS_UI.indexOf('crearProyecto') >= 0, 'D8e crearProyecto dado de alta en ENDPOINTS_UI (regla anti-drift)');
```
(La acumulación de `__TEST__` bajo CLI-000 es tolerable — es el tenant sistema, no factura. Cleanup real = t3 junto con la limpieza de `__TEST__` tareas.)

---

## TAREA 1 — A.2 · Archivar tareas (columna booleana, NO estado)

**Decisión de modelo (dura):** archivar = **columna `archivada` booleana**, ORTOGONAL a `estado`. NO reusar `estado='archivada'` — rompería el mapeo de carriles de `tableroTareas` (`TERMINALES_TAREA` no la contiene → caería en 'pendiente') y toca los 3 estados load-bearing que Luciano dejó firmes. Aditivo, `ensureSheet` lo reconcilia (`07_util.js:66`, reconciliación aditiva de headers).

### 1.1 · Schema — `src/01_schema.js`
`Tareas` pasa de 12 a 13 columnas: agregar `'archivada'` **al final** (aditivo; celda vacía = no archivada). Comentario-contrato al lado: "booleana, ortogonal a estado; la filtran tareasActivasOrdenadas + tableroTareas".

### 1.2 · Server — `src/08_webapp.js`
- **Filtro central `tareasActivasOrdenadas` (1051):** excluir archivadas → `.filter(function(t){ return !esVerdadero_(t.archivada); })` al inicio (definí `esVerdadero_` o reusá el coercion que ya uses para booleanos de celda — `true`/`'TRUE'`/`'si'`). Esto cubre `datosHoy` (686), `datosCliente.proximos` (809).
- **`tableroTareas` (1546):** NO usa el filtro central → agregar el mismo `.filter(!archivada)` sobre `leerTabla(Tareas)` antes del map de carriles.
- **Conteo `datosHoy` (661):** `tareas: leerTabla(Tareas).length` infla con archivadas → contar `!archivada`.
- **Avisos (`06_avisos.js` 196/378/411):** revisar cada uno — un aviso de "tarea vencida" NO debe disparar sobre una archivada. Agregar el filtro donde corresponda (grepear los 3 y clasificar; regla LISTA-CONTRATO).
- **Endpoints nuevos (los 3, `_soloOwner_` + alta en `ENDPOINTS_UI` en el MISMO commit):**
  - `archivarTarea(idTarea)` → set `archivada=true` (patrón de `guardarTarea`: getSheet, buscar fila, setValue de la columna archivada, `feed_` log). Idempotente.
  - `desarchivarTarea(idTarea)` → set `archivada=false`.
  - `tareasArchivadas()` → `leerTabla(Tareas).filter(archivada).map(...)` (read-only, mismas columnas que detalleTarea, para la vista).

### 1.3 · UI — `src/index.html`
- **Botón "Archivar" en el panel de tarea (`#tdboard`)**, en la fila de acciones (junto a Guardar/Cancelar): `archivarTarea(TD.id)` → onSuccess: `ccKanbanLoad()` + toast "Tarea archivada" + `tdCerrar()`. Confirm inline (no `confirm()` nativo — rompe la extensión).
- **Entrada "Archivadas" en la cabecera del tablero** (donde vive el quick-add): abre un overlay (patrón `kscrim+kboard`, cero primitivas nuevas) que lista `tareasArchivadas()` read-only, cada una con botón "Desarchivar" → `desarchivarTarea` → refresca la lista + `ccKanbanLoad()`. satori-design registro operativo, tokens existentes.

### 1.4 · Assert — `src/09_selftest.js` (TRAMO 1, tras D8e)
```js
// ── D8f (A.2) — archivar saca de las vivas y aparece en archivadas; desarchivar revierte ──
var t8f = crearTarea({ descripcion: '__TEST__ A2 archivar', prioridad: 'C', tipo: 'personal' });
var vivasAntes = tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas'))).some(function(t){return String(t.id_tarea)===t8f.id_tarea;});
chk(vivasAntes, 'D8f la tarea nace viva (en tareasActivasOrdenadas)');
archivarTarea(t8f.id_tarea);
var vivasDesp = tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas'))).some(function(t){return String(t.id_tarea)===t8f.id_tarea;});
chk(!vivasDesp, 'D8f archivada NO está en las vivas');
chk(tareasArchivadas().some(function(t){return String(t.id_tarea)===t8f.id_tarea;}), 'D8f archivada aparece en tareasArchivadas');
chk(tableroTareas().every(function(t){return String(t.id_tarea)!==t8f.id_tarea;}), 'D8f archivada NO está en el kanban');
desarchivarTarea(t8f.id_tarea);
chk(tareasActivasOrdenadas(leerTabla(getMaestro().getSheetByName('Tareas'))).some(function(t){return String(t.id_tarea)===t8f.id_tarea;}), 'D8f desarchivar la devuelve a las vivas');
['archivarTarea','desarchivarTarea','tareasArchivadas'].forEach(function(fn){ chk(ENDPOINTS_UI.indexOf(fn)>=0, 'D8f '+fn+' en ENDPOINTS_UI'); });
```

---

## Verificación (orden fijo)
1. `node --check` en los .js tocados + `node _harness.js` (0 fallos).
2. `python3 _verificar_index.py`.
3. `bash _capabilities_gen.sh` (van a subir los endpoints — que el hook no aborte el push).
4. **`clasp push`** (repo→GAS) → `selfTest()` en el editor (D8d/D8e/D8f) → 0 fallos → `git add` por lista + commit → **Luciano aprueba** `git push` + `_promote_exec.sh`.

## Gate Bastión
- 3 endpoints nuevos client-callable → `_soloOwner_` + `ENDPOINTS_UI` (mismo commit). `archivarTarea`/`desarchivarTarea` mutan una tarea del owner (no cruzan tenant; la tarea ya trae su `id_proyecto`→cliente). Sin ingress nuevo, sin secretos. Verde.

## Diferido a t3 (con motivo)
- **Auto-archivo `hecha` > N días:** requiere saber CUÁNDO se completó. `Tareas` no tiene `fecha_completada`. Camino t3: agregar `fecha_completada` (aditivo) + setearla en `moverTarea` al pasar a terminal (toca la FORMA de moverTarea → grepear asserts que fijan su retorno) + gancho `archivarHechasViejas_()` en `corridaDiaria` con N en `Config`. No meterlo acá: sin la fecha, "N días" es adivinar.
- **A.3** (recurrencia de proceso: `Plantillas_pasos`, `instanciarProceso`, `avanceProyecto`) y **A.4** (`esperando_de`, vista CLIENTES/TIMELINE) — tandas propias.

## Purga de cierre (Cowork)
Al cerrar Code, Cowork purga el diff: que archivar realmente saque de las 3 columnas + de avisos, que desarchivar revierta, que `tableroTareas` y `tareasActivasOrdenadas` filtren igual (no drift entre los dos caminos), y P1/A.2 cerrados por evidencia (D8f verde en el editor).
