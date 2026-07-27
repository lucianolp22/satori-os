# ENCARGO CODE — Fixes post-eyeball /dev · 27-jul-2026

Contexto: purga X1-X3 validada en /dev (`selfTest` = **PASA 550 / FALLA 0**, código pusheado, HEAD en origin). El eyeball de Luciano encontró 4 cosas. Ninguna bloquea el promote a /exec; son pulido + features. Orden por impacto. `Edit` no `Write`. `node --check` + harness offline tras cada una. Un commit por fix. `/exec` intocado.

Diagnóstico ya hecho por Cowork (verificado contra el repo) — no lo re-derives, andá al fix.

---

## P0 · Fix 0 — El full-refresh de conectores NO puede borrar todas las filas (bug de datos vivos)

**Cómo salió:** al correr `sincronizarVehemence()` a mano (accidente de automatización) tiró `Exception: No se pueden eliminar todas las filas que no estén inmovilizadas` en `borrarFilasBatch_` (`19_conectores.js:~626`), stack: `sincronizarVehemence`→`sincronizarConectorVentas_`(:594)→`conLock`→`borrarFilasBatch_`(:626, `sh.deleteRows`).

**Causa (verificada):** el full-refresh borra las filas viejas del conector y reescribe. Cuando el conector es dueño de TODAS las filas de `Datos_operativos` (ninguna cargada a mano) y el encabezado está inmovilizado, `deleteRows` intenta borrar todas las filas no-inmovilizadas → Google Sheets lo rechaza atómicamente. **No hubo daño** (el rechazo es atómico: no borra ni escribe nada), pero el refresh FALLA.

**Alcance — las DOS vías:** `sincronizarConectorVentas_` (Vehemence) y `sincronizarConectorOperaciones_` (DAM, MesaQuince, LC Travel) usan el MISMO `borrarFilasBatch_` (`19_conectores.js:602` y el comentario "mismo full-refresh"). O sea: TODO conector falla al refrescar una vez que su `Datos_operativos` es 100% filas del conector. El primer sync (append a hoja vacía) anda; los refrescos siguientes mueren.

**Consecuencia:** Vehemence —"el único conector vivo"— **no está refrescando**. En `sincronizarConectores` el error se traga en `out.errores` (silencioso, `:467`), así que su data quedó congelada en el último append exitoso. Encender DAM/otros hoy = una carga inicial que después nunca actualiza, con error diario silencioso.

**Fix:** que el full-refresh maneje el caso "borrar todas las filas de datos": borrar todas-menos-una y `clearContent()` la última, o usar `clearContents` sobre el rango en vez de `deleteRows`, o append-primero/borrar-viejas-después dejando ≥1 fila. Verificar con un tenant cuyo `Datos_operativos` sea 100% filas del conector (el caso de Vehemence hoy). Assert nuevo: refresh sobre "todas filas del conector" NO tira y deja los datos nuevos.

**Bloquea el encendido productivo de conectores.** Hasta que esto esté, `probarConector` (ensayo en seco, no borra) sí sirve para validar la LECTURA, pero no encender para uso vivo.

---

## P1 · Fix A — Latencia de la voz: cachear `estado` (RÁPIDO, alto impacto)

**Síntoma:** el audio de Sato se traba al pedir el estado. **Causa (verificada):** en `src/08_webapp.js:121` el tool `estado` llama `estadoVigente(id)` **en vivo** (~14 s por el render pesado salud+tareas — medido: `voz-timing tool=estado ms=14108`). El tool `brief` (línea 122) ya usa `briefCacheado_` justamente para evitar eso.

**Fix:** cachear `estado` con el MISMO patrón que el brief. Ya existe la infra: `briefCacheado_` / `calentarBriefCacheSistema_` / `verifBriefCache_` (18_direccion.js). Crear el análogo `estadoCacheado_(id)` (cache corto, p.ej. 5-10 min, invalidable) y que el `case 'estado'` de la voz lo use. La UI (`estadoSistema`/`datosHoy`) puede seguir en vivo o compartir el cache — tu criterio, pero la VOZ tiene que leer del cache. Calentar el cache en `corridaDiaria` junto al brief.

**Validar:** assert nuevo (serie D) de que `estadoCacheado_` devuelve la misma forma que `estadoVigente` y respeta el TTL. Medí el `voz-timing tool=estado` después: tiene que caer de ~14 s a <2 s.

---

## P1 · Fix B — Los Hilos no cargan: desajuste de contrato skill ↔ parser

**Síntoma:** todo cliente muestra "Hilo no cargado", incluso DAM y Vehemence que TIENEN `.md`. **Causa (verificada):** el visor está bien (fail-closed correcto). El `_hilo_sync.sh` parsea solo un vocabulario CERRADO de secciones (`plan/real/desviado/pendiente`, normalizado a-z) con esquema de 8 columnas. Pero la skill `hilo-de-trabajo` escribe el `.md` con secciones **narrativas numeradas**: `## 1. Planificado — baseline…`, `## 2. Plan vs Real — tablero de compromiso`, `## 3. Desvíos y ajustes…`, `## 4. Pendientes (must/should/nice)`. Ninguna matchea el vocabulario del parser → el CSV sale vacío → "Hilo no cargado". Es la lección LISTA-CONTRATO: dos mitades que no hablan el mismo idioma.

**Ground truth para diseñar el mapeo** (miralos, son la fuente): `~/Documents/Claude/_cerebro/HILO - DAM Barber Shop.md` (1 tabla) y `HILO - Vehemence.md` (5 tablas). Fijate las columnas REALES del tablero §2 antes de mapear.

**Fix (en el parser `_hilo_sync.sh`, NO en el visor ni en `hiloCliente`/`espejarHiloCSV` — el esquema de 8 columnas de la hoja se mantiene):**
- Enseñarle al parser la estructura real de la skill: reconocer `## N. <Titulo>` (número + narrativa), y mapear por raíz: `Planificado→plan`, `Plan vs Real→` (partir el tablero en filas `real` con su `estado`), `Desvíos…→desviado`, `Pendientes→pendiente`.
- El tablero §2 "Plan vs Real" es la fuente principal de filas `plan`/`real`; §4 Pendientes → filas `pendiente`; §3 → `desviado`.
- Mantené la frontera de confianza: sección que no matchea NINGUNA raíz conocida → se ignora y se avisa (no se adivina). Mantené el espejo exacto de `HILO_SECCIONES` documentado en el header del script y en `src/25_hilo.js`.

**Validar:** corré `_hilo_sync.sh CLI-004 "<ruta DAM.md>" --print` y `CLI-002 "<ruta Vehemence.md>" --print` → el CSV tiene que salir con filas reales (no vacío), columnas `seccion,item,detalle,estado,evidencia,fecha,prioridad,dueno`. Pegá el CSV en la devolución para que Cowork lo audite a ojo antes de espejar.

> Nota: la SUBIDA (`espejarHiloCSV`) la corre Luciano en el editor o Cowork — vos dejás el parser arreglado + los CSV generados. No necesitás clasp run.

---

## P2 · Fix C — Sato "armá la reunión": tool de captura + handoff a Cowork

**Pedido de Luciano:** que al decirle a Sato "armá la reunión de LC Travel", repase el Hilo + contexto y le **entregue un documento** de la próxima reunión. **Realidad (verificada):** `voz/agent/agent.py` expone ~11 `@function_tool` que solo LEEN (estado, sgic, brief…); ninguno arma un documento. Y generar la reunión desde el Hilo es trabajo generativo = de Cowork, no del backend liviano de la voz.

**Arquitectura (encaja con el loop "Cowork construye entregables"):** Sato **captura la intención**, no genera el doc.
- **Code (esto):** nuevo `@function_tool` en `agent.py` — p.ej. `preparar_reunion(id_cliente)` — que llama `_llamar_backend("capturar", {tipo:"preparar_reunion", idCliente})`. En el backend, rutear ese `capturar` a la Bandeja/Cola con `tipo=preparar_reunion` + el id. Sato responde "Anotado, te preparo la reunión de LC Travel y te la dejo en el Centro de Mando" — honesto, no promete generar en el momento.
- **Cowork (Luciano + yo, aparte):** una tarea programada que vigila esos pedidos, corre `hilo-de-trabajo` + `tablero-de-reunion`, deja el doc en Drive y avisa. Esa parte NO es tuya.

**Depende de Fix B:** la reunión se arma leyendo el Hilo; sin el Hilo cargando, no hay de dónde. B antes que C.

**Validar:** assert de que `preparar_reunion` encola en Bandeja con `tipo=preparar_reunion` + idCliente, y que un id inexistente falla cerrado (no inventa tenant).

---

## P2 · Fix D — Calendario funcional (frontend)

**Estado:** el backend ya tiene la base — `agendarEvento(fecha,hora,titulo,idCliente,notas)`, `agendaSemana()`, `agendaRango(desde,hasta)` (18_direccion.js). Falta el **frontend**: la sección Calendario de verdad (alta de eventos/recordatorios/compromisos, vista mensual navegable, edición), cableada a esos endpoints.

**Fix:** construir la sección Calendario en `index.html` con `satori-design` (leé `~/Documents/Claude Code/DESIGN.md` primero — **no está en la raíz del repo** — y declará el registro A/B/C antes de escribir UI), output vanilla GAS-compatible (sin frameworks que no corran en GAS Web App). Cablear a los endpoints existentes vía `google.script.run` (agregar los que falten a `ENDPOINTS_UI` con `_soloOwner_` si exponés alguno nuevo — regla anti-drift). Si falta un endpoint (p.ej. borrar/editar evento), lo agregás gated.

**Validar:** alta de un evento se ve en la vista mensual y persiste en `Agenda`; `agendaRango` inválido sigue fail-closed.

---

## Cierre
Devolvé con el diff por fix + el CSV de Fix B. Prioridad: A y B primero (hacen que el sistema se sienta roto), después C y D. Nada a `/exec`. Si algún fix toca `ENDPOINTS_UI` o gates, sumá el assert de cobertura (D19c) como en la purga.
