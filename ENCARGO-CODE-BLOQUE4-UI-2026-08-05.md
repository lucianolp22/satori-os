# ENCARGO CODE — BLOQUE 4 · UI (panel de tarea + notas de proyecto)

**Fecha:** 05/08/2026 · **Autor:** Cowork · **Ejecuta:** Claude Code · **Aprueba deploy:** Luciano
**Supersede** la sección UI del encargo original (`ENCARGO-CODE-BLOQUE4-notas-panel-tarea-2026-08-05.md`), que tenía dos errores: usaba un `.cm-modal` inexistente y la ruta `docs/CLAUDE.md` (es raíz). Corregido acá contra el código vivo.

## ✅ BACKEND YA HECHO (Cowork, 05-ago, harness 500/0) — NO rehacer

Committed al repo (working tree, sin push todavía). Verificá con `git diff` antes de tocar:
- `01_schema.js`: `+notas` en `Tareas` y `Proyectos` (aditivo; `ensureSheet` reconcilia). LISTA-CONTRATO verificada: todos los consumidores leen por `leerTabla` (nombre), ninguno por posición.
- `08_webapp.js`: `guardarTarea(idTarea, campos)`, `detalleTarea(idTarea)`, `guardarNotaProyecto(idProyecto, notas)` — todas `_soloOwner_`, espejo de `moverTarea` (whitelist, escribe solo columnas presentes, `sanitizarCelda` en notas, log en Actividad).
- `22_seguridad.js`: `ENDPOINTS_UI += 'detalleTarea', 'guardarTarea', 'guardarNotaProyecto'`.
- `09_selftest.js`: bloque `D8c` (4 asserts) — corre en el editor (tramo 1), no en el harness.
- `CLAUDE.md` (raíz): sección "Tareas / board — reglas de datos" (gate anti-rollup + multi-vista).

**El harness offline sigue 500/0** (los +4 asserts D8c son del selfTest del editor, no del harness).

## LO QUE FALTA — la UI en `src/index.html` (vanilla, tokens existentes)

**Patrón REAL (verificado, NO inventar):** los modales de esta app son overlays **`kscrim` + `kboard`** (mirá `#calscrim`/`#calboard` con `#calForm` en ~1330, y `#fichascrim`/`#fichaboard` en ~1360). Se abren/cierran agregando/quitando clases y mostrando el scrim (mirá `calFormAbrir`/`calFormCerrar` ~4540-4554 y `fichaAbrir`/`fichaCerrar` ~3412-3420). Reusar ese patrón, `.khead`, `.cm-sel`, `.btn`/`.btn-sm`/`.btn-ghost`, chips.

### A. Panel de detalle/edición de tarea (nuevo overlay hermano)
1. **Markup** (al lado de `#calboard`): `<div class="kscrim" id="tdscrim"></div>` + `<div class="kboard tdboard" id="tdboard" role="dialog" aria-modal="true" aria-label="Detalle de tarea">` con `.khead` (id + botón cerrar) y un `<form id="tdForm">`:
   - descripción `<input maxlength=300 required>`, proyecto `<select id="tdProy" class="cm-sel">` (poblar desde la lista de proyectos/clientes ya cargada), estado `<select>` (opciones = `ESTADOS_TAREA_UI`), prioridad `<select>` A/B/C, vence `<input type=date>`, tipo `<select>` (cliente/periodica/objetivo/personal/admin/''), etiquetas `<input>`, **notas `<textarea rows=5 maxlength=4000>`**, botón "Guardar cambios".
2. **JS** (espejo de `calFormAbrir`):
   - `tdAbrir(idTarea)`: `google.script.run.withSuccessHandler(t=>{ poblar campos desde t; guardar t.id_tarea en dataset; mostrar overlay (clase 'open' + scrim, como calFormAbrir) }).withFailureHandler(...).detalleTarea(idTarea)`.
   - submit `#tdForm`: arma `campos={descripcion,id_proyecto,estado,prioridad,fecha_limite,tipo,etiquetas,notas}` → `google.script.run.withSuccessHandler(()=>{ cerrar; cmToast('Tarea guardada'); ccKanbanLoad(); }).guardarTarea(id,campos)`. Deshabilitar el botón mientras guarda.
   - cerrar: botón + click en scrim → quitar 'open'.
3. **Abrir desde la tarjeta** (`ccKCard`, ~4670): agregar UNA afordancia dedicada (ej. botón `⋯` en una esquina) con `ev.stopPropagation()` → `tdAbrir(t.id_tarea)`. **NO** poner el click en el cuerpo de la card: colisiona con `dragstart` del kanban.
4. **CSS**: `.tdboard` reusando el estilo de `.calboard`/`.fichaboard`; `.kcard-open` botón fantasma chico (`--color-text-subtle`→hover `--color-text`), focus visible ≥2px, target ≥24px.

### B. Notas de proyecto en la Ficha 360
- La ficha arma sus proyectos vía `datosCliente`/`fichaCliente` y los pinta con `tablaProyectos(d.proyectos)` (la llama `fichaCargar_` ~3495). Por cada proyecto: agregar un `<textarea>` + botón "Guardar nota" → `google.script.run.guardarNotaProyecto(p.id_proyecto, valor)`. Reusar `.f360-chk-add` como base visual.
- **⚠ Verificar en el server:** el objeto `d.proyectos` debe traer `notas`. Buscá dónde se arma (probable `datosCliente`/`fichaCliente` en `08_webapp.js`): si mapea columnas explícitas, sumá `notas: p.notas||''` al map. Si ya pasa la fila entera, `notas` viaja solo (schema ya lo tiene).

## satori-design (gate)
Registro **operativo**. Cero tokens nuevos: reusar `.kboard/.khead/.cm-sel/.btn/.chip/--color-*/--radius-*`. Los 6 estados por control. Focus visible ≥2px contraste 3:1. Correr el **checklist de salida** de `satori-design` antes de cerrar.

## Verificación (en orden, innegociable)
1. `node --check src/08_webapp.js` (si tocaste el server para las notas de proyecto).
2. `node _harness.js` → **debe seguir 500/0**.
3. `python3 _verificar_index.py` (integridad de index.html).
4. `/dev`: abrir una tarjeta → editar campos + notas → guardar → recargar; nota de proyecto en la ficha.

## Deploy — lo dispara/aprueba Luciano
1. **`setup()`** en el editor (materializa las columnas `notas` en `Tareas` y `Proyectos`, aditivo idempotente). **Sin esto, `guardarNotaProyecto` tira error claro y `notas` de tarea no persiste.**
2. **`selfTest()`** + tramos 2-5 + `selfTestVeredicto()` → verde (ahora con los 4 asserts D8c).
3. Diff repo↔GAS (guardia) → **`clasp push`** → promote `/exec` @37.

## AREL
Build reversible → Code acciona hasta el `clasp push`. `setup()` (escribe estructura en el MAESTRO vivo) + `clasp push` + promote los aprueba/dispara **Luciano**. Al cerrar: Cowork corre la **purga-de-errores** sobre el diff y actualiza `HANDOFF.md` (BLOQUE 5.3) sumando "F3 tareas: notas + panel de edición".
