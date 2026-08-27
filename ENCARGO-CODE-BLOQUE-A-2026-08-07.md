# ENCARGO CODE — BLOQUE A (tanda 1): A.0/P1 fix recurrencia + A.1 crearProyecto

> **Para:** Claude Code (ejecuta en la Terminal del Mac · cuenta `luciano@satoriconsultoria.com`).
> **De:** Cowork (planificó + asserts). **Fecha:** 07/08/2026. **Base confirmada:** HEAD `af4484f`, `/exec @37`, `main` sincronizado con origin, harness 500/0, editor 837/0. `index.lock` ya limpio.
> **Loop:** Code construye + verifica → Cowork purga → Luciano aprueba push/promote. **No pushear sin verde real** (harness offline + `selfTest()` en el editor). Un timeout NO es verde.

## Alcance de esta tanda (SOLO esto — el resto de BLOQUE A va aparte)

1. **A.0 / P1** — corregir que la recurrencia NO se clona al completar una tarea desde el **panel** (`guardarTarea`). Hoy `guardarTarea` whitelistea `estado` y NO clona; `moverTarea` (kanban) sí clona. Fix: **sacar `estado` del whitelist de `guardarTarea` y del panel** → el estado se cambia SOLO por el kanban, que clona. Es el hallazgo P1 (Medio, 9/10) de la purga BLOQUE 4 y el punto A.0 del handoff. **Un solo cambio, aplicado una vez.**
2. **A.1** — crear `crearProyecto()` (hoy NO existe: grep vacío, `Proyectos` sin altas posibles) + mini-alta en el panel. Desbloquea la espina Cliente→Proyecto→Tarea.

## Pre-flight (Code, antes de tocar nada)

```
cd ~/Documents/Claude/Projects/SatoriOS
git fetch && git log --oneline -1          # confirmar HEAD af4484f
git pull --ff-only                          # traer lo remoto si hubiera
node --check src/08_webapp.js && node _harness.js   # verde de partida
```
- Confirmá el schema real de `Proyectos` en `src/01_schema.js:15` = `['id_proyecto','id_cliente','nombre','estado','%_avance','fecha_objetivo','proximo_hito','fecha_ultimo_movimiento','notas']`.
- Verificá si existe un `ESTADOS_PROYECTO` (grep). **Si NO existe, NO lo inventes con constraint** que rompa filas viejas: default `'activo'` y aceptá el valor entrante tal cual (o una lista chica declarada como comentario-contrato).
- ⚠ **`src/08_webapp.js` dispara la detección binaria de `grep`** (un byte fuera de UTF-8): usá `grep -a` o `sed`/`node` para leerlo. Opcional (higiene, NO bloqueante): localizar y limpiar el byte con `LC_ALL=C grep -an '[^ -~]' src/08_webapp.js` acotado a líneas de comentario, sin tocar código. No es parte del alcance certificable.

---

## TAREA 1 — A.0 / P1 · sacar `estado` del panel y de `guardarTarea`

**Regla LISTA-CONTRATO / FORMA-DE-RETORNO (dura):** antes de tocar, grepear TODOS los consumidores:
```
grep -an "guardarTarea" src/*.js src/index.html      # confirmar quién manda 'estado'
```
Consumidores confirmados por Cowork: (a) el panel (`index.html tdGuardar`, manda `estado`), (b) `selfTest` D8c (NO manda `estado`). Nadie más. Sacar `estado` NO rompe D8c.

### 1.1 · Server — `src/08_webapp.js`, función `guardarTarea` (≈línea 1700)
Eliminar la rama de `estado` del whitelist. Hoy dice:
```js
if (c.estado !== undefined) { var e = String(c.estado).toLowerCase(); if (ESTADOS_TAREA_UI.indexOf(e) >= 0) w.estado = e; }
```
→ **borrar esa línea entera.** `guardarTarea` deja de poder escribir `estado`. (No tocar `moverTarea`, que es el único camino a `estado` y ya clona bien.)

### 1.2 · UI — `src/index.html`
- **Línea 1416:** quitar el `<select id="tdEstado">` editable. **Recomendado (evita regresión de UX):** reemplazarlo por un badge **read-only** que muestre el estado actual (el usuario lo VE pero lo cambia arrastrando en el kanban). Mínimo aceptable: quitarlo del todo.
- **Línea ≈4831:** sacar `'tdEstado'` del array de ids `['tdDesc','tdProy','tdEstado',…]`.
- **`TD_CAMPOS`:** sacar `'estado'` de esa lista (es la whitelist cliente que arma `campos`).
- **`tdGuardar` (≈4898):** borrar la línea `estado:document.getElementById('tdEstado').value,` del objeto `v`.
- **`tdEstados_` (≈4850) + su llamada en el open (≈4874 `tdEstados_(t.estado)`):** eliminar la función y la llamada (si dejás el badge read-only, reemplazá la llamada por pintar el badge con `t.estado`).

**Segundo orden (verificado):** el kanban (`moverTarea`) sigue siendo el único que cambia estado y clona; el panel edita contenido. Los 3 estados load-bearing quedan intactos. `detalleTarea` puede seguir devolviendo `estado` (inofensivo; alimenta el badge).

> Alternativa NO recomendada (más compleja, la dejo documentada): mantener el picker y delegar el cambio de estado a `moverTarea` desde `guardarTarea`. Ojo locks: `moverTarea` no usa `conLock`, así que llamarlo fuera del `conLock` de `guardarTarea`. Se descarta por “solución mínima”.

---

## TAREA 2 — A.1 · `crearProyecto()` + alta + mini-alta UI

### 2.1 · Server — `src/08_webapp.js` (pegar junto a `crearTarea`, ≈1592, mismo patrón)
```js
/**
 * Alta de un Proyecto desde el CM. Espejo de crearTarea.
 * AISLAMIENTO §3: id_cliente SIEMPRE validado contra el roster real (nunca se adivina).
 * AREL: interno + reversible = avanzar (sin gate). _soloOwner_ + alta en ENDPOINTS_UI (mismo commit).
 */
function crearProyecto(payload) {
  _soloOwner_('crearProyecto');
  var p = payload || {};
  var nombre = String(p.nombre || '').trim();
  if (!nombre) throw new Error('crearProyecto: falta el nombre.');
  var idCli = String(p.id_cliente || '').trim();
  if (!idCli || !listaClientes().some(function (c) { return String(c.id_cliente) === idCli; })) {
    throw new Error('Cliente no encontrado: ' + idCli);   // roster real, corta ruidoso
  }
  var sh = getMaestro().getSheetByName('Proyectos');
  if (!sh) throw new Error('Falta la pestaña Proyectos — correr setup().');
  var estado = String(p.estado || 'activo').toLowerCase();   // alinear con ESTADOS_PROYECTO si existe
  var fObj = aFechaISO(p.fecha_objetivo) || '';
  var hito = String(p.proximo_hito || '').slice(0, 200);
  return conLock(function () {
    var id = nextId(sh, 'id_proyecto', 'PRO', 4);
    appendFila(sh, {
      id_proyecto: id, id_cliente: idCli, nombre: nombre.slice(0, 120), estado: estado,
      '%_avance': 0, fecha_objetivo: fObj, proximo_hito: hito,
      fecha_ultimo_movimiento: hoyISO(), notas: ''
    });
    try { feed_('Director', 'accion', idCli, 'Proyecto creado: ' + id + ' · ' + nombre.slice(0, 80), '', ''); } catch (e) {}
    return { id_proyecto: id, id_cliente: idCli, nombre: nombre, estado: estado };
  });
}
```
Notas de contrato: `nextId`=`src/07_util.js:384`, `appendFila`=`src/07_util.js:121`, `listaClientes`=`src/08_webapp.js:727`, `feed_`=`src/13_agentes.js:34`. `appendFila` matchea por nombre de columna → respetar los headers del schema exactamente (incluida `'%_avance'`).

### 2.2 · Alta en `ENDPOINTS_UI` — `src/22_seguridad.js` (≈línea 153, sección 08_webapp.js, MISMO commit)
Agregar `'crearProyecto'` junto a `'detalleTarea','guardarTarea','guardarNotaProyecto','listaProyectos'`. (Regla anti-drift: endpoint client-callable nuevo → alta en el mismo commit; el assert D19c/securityScan lo audita pero no lo adivina.)

### 2.3 · UI mini-alta — `src/index.html`, dentro de `tdProyectos_` (≈4835) y el `#tdProy`
- Agregar al final del `<select id="tdProy">` una opción `＋ nuevo proyecto…` con `value="__nuevo__"`.
- `onchange` de `#tdProy`: si `value==='__nuevo__'` → revelar un mini-form inline `#tdNuevoProy` con: `<input>` nombre + `<select>` cliente (poblado con `listaClientes`, mostrando `id_cliente · nombre` — AISLAMIENTO §6) + botón **Crear**. `Cancelar` revierte `#tdProy` al valor previo.
- **Crear** → `google.script.run…crearProyecto({nombre, id_cliente})` → onSuccess: re-poblar `tdProyectos_` (resetear `TD.proysOK=false`), seleccionar el `id_proyecto` nuevo, ocultar el mini-form. onFailure: mostrar el error con `tdErr_`.
- satori-design: reusar los tokens/estilos ya presentes en el panel (`.kboard`/labels), CERO primitivas nuevas.

---

## ASSERTS (en `src/09_selftest.js`, TRAMO 1 = `selfTest`, justo tras el bloque D8c ≈línea 329, antes de D9)

Derivar de las fuentes, no clavar conteos. `selfTestVeredicto()` cuenta dinámico → sumar checks solo eleva el total (837→837+k), no hay total hardcodeado que bumpear (confirmar con grep `=== 837` / `length ===` en asserts de conteo).

```js
// ── D8d (A.0/P1) — la recurrencia SOLO se completa por el kanban; el panel NO ──
var t8d = crearTarea({ descripcion: '__TEST__ A0 recurrente panel', prioridad: 'B', tipo: 'personal', recurrencia: '1s' });
var est8d = detalleTarea(t8d.id_tarea).estado;                 // 'pendiente'
var filasAntes = leerTabla(getMaestro().getSheetByName('Tareas')).length;
guardarTarea(t8d.id_tarea, { estado: 'hecha', prioridad: 'A' }); // manda estado + un campo válido
var d8d = detalleTarea(t8d.id_tarea);
chk(d8d.estado === est8d, 'D8d guardarTarea IGNORA estado (no whitelisteado): el panel no completa (' + d8d.estado + ')');
chk(d8d.prioridad === 'A', 'D8d guardarTarea sí aplica el resto del form aunque venga estado');
chk(leerTabla(getMaestro().getSheetByName('Tareas')).length === filasAntes, 'D8d recurrente NO renace por el panel');
var mv8d = moverTarea(t8d.id_tarea, 'hecha');
chk(!!mv8d.renace, 'D8d la MISMA recurrente completada por KANBAN sí renace (' + mv8d.renace + ')');

// ── D8e (A.1) — crearProyecto: alta + validación de roster + aparición ──
var cli8e = listaClientes()[0];
if (cli8e) {
  var pr8e = crearProyecto({ id_cliente: cli8e.id_cliente, nombre: '__TEST__ proyecto A1', estado: 'activo' });
  chk(/^PRO-\d+$/.test(pr8e.id_proyecto), 'D8e crearProyecto devuelve id (' + pr8e.id_proyecto + ')');
  chk(listaProyectos().some(function (p) { return p.id_proyecto === pr8e.id_proyecto; }), 'D8e el proyecto aparece en listaProyectos');
  var rc8e = '';
  try { crearProyecto({ id_cliente: 'CLI-NO-EXISTE-9999', nombre: 'x' }); } catch (e8e) { rc8e = String(e8e && e8e.message); }
  chk(/no encontrado/i.test(rc8e), 'D8e 🔒 crearProyecto rechaza id_cliente fuera del roster (' + (rc8e || 'no cortó') + ')');
  chk(ENDPOINTS_UI.indexOf('crearProyecto') >= 0, 'D8e crearProyecto en ENDPOINTS_UI (anti-drift)');
} else {
  chk(true, 'D8e sin clientes en el roster — alta no ejercitada (revisar)');
}
```
Nota: los `__TEST__` se acumulan en `Tareas`/`Proyectos` como ya lo hace D8 (patrón existente). Si molesta, limpieza aparte — NO en esta tanda.

## Verificación (orden fijo, nada de "listo" sin evidencia)
1. `node --check src/08_webapp.js` (y los que toques) + `node _harness.js` → 500/0 (o el nuevo total, 0 fallos).
2. `python3 _verificar_index.py` (index.html íntegro).
3. Editor GAS: correr **`selfTest()`** (TRAMO 1, donde viven D8d/D8e) → 0 fallos; idealmente `selfTestVeredicto()`.
4. Diff repo↔GAS antes de push. `git add` por lista (NO `-A`). Commit con los 3 cambios (guardarTarea/panel · crearProyecto+ENDPOINTS_UI · asserts) — o dos commits (A.0 / A.1), a tu criterio.
5. **Luciano aprueba** push + `bash _promote_exec.sh` (dry-run) → `--go`. Verificar `/exec` con `clasp deployments` (no con rollback.txt).

## Gate Bastión (esta tanda)
- `crearProyecto` = endpoint client-callable nuevo → `_soloOwner_` ✓ + `ENDPOINTS_UI` ✓ (ambos en el mismo commit).
- AISLAMIENTO §3/§9: `id_cliente` validado contra `listaClientes()`; assert 🔒 de rechazo incluido (D8e).
- Sin secretos, sin datos sensibles nuevos, sin ingress nuevo. Verde.

## Purga de cierre (Cowork, después de que Code cierre)
Cowork corre `purga-de-errores` sobre el diff antes de dar la tanda por cerrada: render del panel sin el picker, que `moverTarea` siga clonando, que el mini-alta no deje elegir cliente inexistente, y que P1 quede **cerrado por evidencia** (D8d verde en el editor), no por "se corrigió".
