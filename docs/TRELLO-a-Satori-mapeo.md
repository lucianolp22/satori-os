# TRELLO → Satori OS — Integración completa de la sección Tareas → Sistema Operativo Personal

> **Fecha:** 07/07/2026 · **Autor:** Cowork · **Filtro:** `docs/CRITERIO-arquitectura-agentes.md` · **Fit-check:** todo corre en HtmlService + Sheets (GAS vanilla).
> **Método:** 2 olas de research multi-fuente (5 frentes) verificadas contra doc oficial Atlassian jul-2026 + **análisis del screen-recording de tu board real "Lp 2026"** + verificación del repo (archivo:línea). Confianza X/10 por sección.
> **Reemplaza** a la v1 (mapeo plano de features). Esta versión parte de tu sistema operativo real, no de una lista de tareas suelta.

---

## 0. BLUF — la realización

Tu board **"Lp 2026" no es una lista de tareas: es tu sistema operativo personal**, hecho a mano en Trello. Y acá está lo importante: **Satori OS ya fue diseñado para ser exactamente eso.** Tenés las tablas (`Clientes → Proyectos → Tareas`, `Bandeja`, `objetivos`, `Agenda`), el panel de cliente (`panelCliente`), el brief "3 cosas", la captura con IA (`Bandeja`) y el kanban. **Lo que falta no es construir features de Trello: es (a) reconectar lo que ya existe y (b) sumar 4 primitivas.** La migración del 03-jul aplastó tu sistema en 23 tarjetas planas y perdió la mitad de la información.

**Qué te mostró el video que la migración perdió:**
1. Tu board tiene **dos dimensiones**, no una. `estado` (EN CURSO / REALIZADAS) **×** `contexto` (CLIENTES / PERIÓDICAS / OBJETIVOS / BUZÓN) **×** un foco diario (CHECKLIST DEL DÍA). La migración volcó todo a `estado` y borró el contexto.
2. Tenés **dos tipos de tarjeta**: tarjetas-**cliente** (EJF, Vehemence, LC Travel…) con un **checklist "TIMELINE" adentro** = el proceso de entrega de ese cliente; y tarjetas-**tarea** sueltas.
3. Usás **recurrencia** (el selector "Periódico" en Fechas), **etiquetas** de color, **descripción rich-text**, **comentarios/actividad**, y las superficies nuevas **Bandeja de entrada (Inbox) + Planificador (Planner)**.

**La tesis (con evidencia dura, §2):** ese checklist "TIMELINE" **no es una entidad nueva** — son **filas de `Tareas` colgando de un `Proyecto`**, una fila por paso, con `orden` para la secuencia. En Trello el checklist es simple pero invisible; en Satori una fila ya es "la tarjeta por paso" (con fecha, estado, filtrable) **sin** el desorden visual. La tensión de Trello se disuelve sola.

**Veredicto de integración:** no clonar Trello. **Restaurar tu modelo** en 4 fases, reusando 90% de lo que ya hay. Fase 1 (dimensión de contexto + alta + recurrencia de tarea) te devuelve el board que tenías. Fases 2-4 (procesos recurrentes, timeline de cliente, flujo Inbox→Hoy) te dan **más** de lo que Trello te daba, y te dejan **retirar el board de Trello**.

**Tus dos corazonadas, cerradas:** recurrencia = **validada dos veces** (Trello la volvió núcleo gratis en 2026 *y* la usás en PERIÓDICAS). Checklists = **validada y reencuadrada**: no como blob de texto dentro de una tarjeta, sino como **Tareas-timeline de un Proyecto** (es más potente y ya tenés el esquema). Confianza global: **8.5/10.**

---

## 1. Tu sistema operativo real (leído del video)

Board **"Lp 2026"**, 7 listas que codifican 3 cosas a la vez:

| Lista (Trello) | Qué es en realidad | Dimensión |
|---|---|---|
| **CLIENTES** (EJF, Vehemence, LC Travel, DAM, MesaQuince, SIP) | Cartera activa — cada tarjeta = un cliente, con checklist **TIMELINE** = su proceso de entrega | Entidad (cliente + proyecto) |
| **CHECKLIST DEL DÍA** | Las cosas concretas de hoy | Foco (vista "hoy") |
| **PERIÓDICAS** (revisar correos, reporte M15, reunión Vehemence, procesado contable) | Obligaciones recurrentes | Recurrencia |
| **BUZÓN A REALIZAR** | Captura sin procesar (propuestas Pipol/Crocante, mapear cobros, LinkedIn) | Inbox |
| **EN CURSO** | Trabajo activo | Estado |
| **REALIZADAS** (26) | Cerrado | Estado |
| **OBJETIVOS** (convertir EJF, definir Vehemence, cerrar LC Travel, nuevos clientes) | Metas de negocio/desarrollo | Objetivo |

**Card-detail de un cliente (EJF), verificado en el video:** Descripción (rich-text) · **Etiquetas** de color · **Fechas** (inicio + vencimiento + **Periódico/recurrencia** + recordatorio) · **Checklist "TIMELINE"** (Esperando data de X → Procesar info de Y → Consultar saldo → Generar dashboard, con barra de %) · **Miembros** · **Comentarios y Actividad** · **Power-Ups · Automatizaciones**. Barra inferior: **Bandeja de entrada · Planificador · Tablero · Cambiar de tablero**.

**Confianza: 9/10** (leído directo del recording).

---

## 2. La tesis: tu Trello YA es Satori OS

Cada pieza de tu board tiene su casa en el esquema que ya corre. Verificado contra el repo:

| Pieza de tu Trello | Ya existe en Satori (evidencia) | Estado |
|---|---|---|
| Lista **CLIENTES** (tarjeta=cliente) | pestaña `Clientes` (`01_schema.js:14`) + **`panelCliente`** = "ficha, proyectos con % avance, próximos pasos" (`08_webapp.js:262`) | ✅ existe, desconectado del board |
| **TIMELINE** dentro de la tarjeta-cliente | pestaña `Proyectos` (`id_proyecto,id_cliente,nombre,estado,%_avance,proximo_hito`, `01_schema.js:15`) 1—N `Tareas` | ✅ esquema listo, sin poblar |
| **PERIÓDICAS** | hoy: texto "(recurrente)" en `descripcion` (TAR-0012..0016) | ⚠️ sin motor |
| **BUZÓN A REALIZAR** | pestaña `Bandeja` + `capturar()` con clasificación Haiku + confianza (`17_bandeja.js:17`) | ✅ existe, mejor que Trello |
| **EN CURSO / REALIZADAS** | `estado` + kanban 3 carriles + `moverTarea` (`08_webapp.js:526`) | ✅ existe |
| **CHECKLIST DEL DÍA** | brief "Las 3 cosas de hoy" (`briefDiario`) + `vistaHoy`/`datosHoy` | ✅ existe, a potenciar |
| **OBJETIVOS** | `objetivos` (per-cliente, `01_schema.js:63`) + North Star | ✅ parcial (falta capa personal) |
| **Fechas + recordatorio** | `fecha_limite` + `detectarVencimientos` + `corridaDiaria` 07:00 | ✅ existe |
| **Periódico (recurrencia)** | — | ❌ no existe |
| **Etiquetas** | solo prioridad A/B/C (label de color) | ⚠️ 1 dimensión |
| **Comentarios/Actividad** | feed `Actividad` global + `moverTarea` loguea | ✅ suficiente para solo |
| **Planner (Planificador)** | pestaña `Agenda` + `agendaSemana()` (07-jul, sin scope Calendar) | ✅ base lista |

**Conclusión:** 9 de 12 piezas ya existen. Faltan **3 primitivas** (recurrencia, contexto/etiqueta, alta rápida) y **1 tabla** (plantillas de proceso). El resto es **cablear y mostrar**.

**Confianza: 9/10.**

---

## 3. Modelo conceptual de Trello 2026 (verificado, condensado)

Jerarquía `Workspace → Board → List → Card → (Checklist → ítem)`. Lo esencial y lo nuevo:

- **La List ES el estado** (mover = cambiar estado sin escribir). **Label** = único atributo que se ve/filtra sin abrir la card (30 colores, N por card, alcance board). **Card** = nombre + descripción Markdown + labels + members + start/due/**due-time** + checklists (N, con barra de %) + adjuntos + comments/activity.
- **Recurrencia nativa gratis (2026, nuevo):** al marcar done, la due date salta a la próxima cadencia y la card se des-marca. *Una instancia viva.* (antes requería Butler)
- **Inbox (nuevo 2026):** captura personal capture-first (email-alias `inbox@app.trello.com`, voz, Slack) con **fricción asimétrica** — capturar es tonto y sin campos; **organizar** (mover a lista) es un acto aparte. Gratis; la IA que parsea la captura = pago.
- **Planner (nuevo 2026):** time-blocking — arrastrás cards a franjas del calendario (Google/Outlook) = "Focus Time"; auto-muestra las cards que **vencen hoy**. Ver = gratis; **arrastrar = pago**.
- **Automatización (Butler):** reglas a nivel lista/board; free = 250 corridas/mes.
- **Pago:** vistas Calendar/Timeline/Table/Dashboard/Map (Premium), advanced checklists (fecha/asignado por ítem), card mirroring, Planner-drag, saved searches.

**Confianza: 9/10.**

---

## 4. Arquitectura de la integración (los principios)

Cinco decisiones de diseño que hacen esto robusto y no un clon:

1. **Contexto = columna + vista, nunca tabla ni carril nuevo.** Tus 7 listas no son 7 tablas. `estado` sigue siendo el carril (pendiente/en_curso/hecha). El contexto (cliente/periódica/objetivo/buzón/personal) vive en **una columna `tipo`** (+ `id_proyecto` para lo de cliente). "En curso", "Realizadas", "Checklist del día" son **vistas filtradas**, no datos que mantenés a mano. *(Anti-patrón evitado: list→table, y el "Checklist del día" que muere stale.)*

2. **El TIMELINE explota a filas de Tareas, no vive como texto.** El checklist de una tarjeta-cliente = N filas de `Tareas` colgando de un `Proyecto`, con `orden` = la secuencia. Ganás fecha/estado/filtro por paso sin sprawl. *(Anti-patrón evitado: CSV-en-celda / jaywalking.)*

3. **Dos niveles de recurrencia.** (a) **Tarea suelta** que renace al completarse (revisar correos, LinkedIn). (b) **Proceso entero** que se regenera por período (el cierre mensual de M15 = un `Proyecto`-ciclo nuevo + sus tareas explotadas desde una plantilla). Distinto motor, misma idea: template → instancia, una viva por vez, nunca pre-generar. *(Anti-patrón evitado: basura de ocurrencias futuras.)*

4. **`%_avance` se calcula, no se carga a mano.** Hoy `Proyectos.%_avance` es una columna manual (`08_webapp.js:276` la lee tal cual). Pasa a **rollup calculado en GAS** = tareas hechas / total del proyecto. *(Se calcula en GAS, NO con fórmula `COUNTIF` en la hoja: la hoja es máquina-gestionada y `appendRow`/`setValues` pisaría la fórmula.)*

5. **Flujo diario Capture → Organize → Tackle, con lo que ya tenés.** `Bandeja` = Inbox (captura tonta) → triage (único lugar donde se enriquece) → `crearTarea`. "Hoy" = auto-lee lo que **vence hoy** (no lo elegís a mano) + adyacencia de la `Agenda` existente. *(Se adopta el modelo mental del Planner; se descarta el time-blocking arrastrable — humo para operador solo.)*

**Confianza: 8/10.**

---

## 5. Tabla de mapeo (función Trello → Satori)

Veredicto: **Adoptar** (traer patrón) · **Adaptar** (versión propia) · **Descartar** (humo para solo).

| # | Función Trello | ¿Existe en Satori? | Equivalente GAS+Sheets | Esf. | Veredicto — porqué |
|---|---|---|---|---|---|
| 1 | Lists = estado + drag | **SÍ** (`moverTarea`) | hecho | — | Adoptado |
| 2 | Cards / tareas | **SÍ** (`Tareas`) | hecho | — | Adoptado |
| 3 | **Alta rápida de card** | **NO** (solo mover) | `crearTarea` + quick-add con sigilos | M | **Adaptar (Must)** — sin esto no es un board |
| 4 | **Contexto (listas semánticas)** | **NO** (aplastado en estado) | columna `tipo` + `id_proyecto` + chips/vistas | M | **Adoptar (Must)** — recupera lo que la migración perdió |
| 5 | **Labels** | Parcial (solo prioridad) | columna `etiquetas` CSV + chips | S | Adaptar (Should) |
| 6 | **Recurrencia de tarea** | **NO** (texto) | `recurrencia` + parser + clon-al-completar | M | **Adoptar (Must)** — validada 2× |
| 7 | **Tarjeta-cliente + TIMELINE** | **Backend SÍ** (`panelCliente`+`Proyectos`) | poblar `id_proyecto`; timeline = Tareas ordenadas | M | **Adoptar (Should alto)** — el corazón de tu operación |
| 8 | **Checklist en card** | **NO** (como blob) | filas de `Tareas` (paso=fila); micro-pasos = `notas` | S* | **Adaptar (Should)** — reencuadrado a filas, no blob |
| 9 | **% avance del proyecto** | Manual | rollup en GAS (`avanceProyecto`) | S | Adaptar (Should) |
| 10 | **Recurrencia de PROCESO** | **NO** | `Plantillas_pasos` + `instanciarProceso` mensual | M | **Adoptar (Should)** — el cierre mensual por cliente |
| 11 | **Inbox / captura** | **SÍ, mejor** (`Bandeja` + Haiku) | bridge Bandeja→`crearTarea` | S | **Adaptar (Should)** — reusar, no duplicar |
| 12 | Captura por email-alias | **NO** | `doPost` alias → fila en `Bandeja` | S-M | Adaptar (Could) |
| 13 | **Planner / "hoy"** | Parcial (brief + `Agenda`) | auto-surface "vence hoy" + adyacencia Agenda | S | **Adaptar (Should)** — sin drag |
| 14 | Filtro / búsqueda | **NO** | chips cliente-side sobre filas cargadas | S | Adaptar (Should) |
| 15 | Archivado / higiene | **NO** (`hecha` acumula) | auto-ocultar `hecha` > N días en corridaDiaria | S | Adaptar (Should) |
| 16 | Descripción rich / notas | Parcial (`descripcion`=título) | columna `notas` en panel de detalle | S | Adaptar (Could) |
| 17 | Fechas + recordatorio | **SÍ** | hecho (`fecha_limite`+avisos+corridaDiaria) | — | Adoptado |
| 18 | Automatización (Butler) | **Motor SÍ** (corridaDiaria/cola) | reglas puntuales, NO constructor | S | Adoptar patrón / Descartar UI |
| 19 | Planner drag (time-blocking) | — | — | — | **Descartar** — mucha obra, ROI marginal para solo |
| 20 | Card mirroring | — | `FILTER`/vista | — | **Descartar** — es sincronización de espejos |
| 21 | Vistas Timeline/Dashboard/Map | Tabla parcial | — | — | **Descartar** — reporting de equipo |
| 22 | Members / votos / comentarios multi | **NO** | — | — | **Descartar** — coordinación de equipo |
| 23 | Multi-board | **NO** (1 board) | filtro por `tipo`/cliente | — | **Descartar** — fragmenta la atención de un solo |
| 24 | Card templates | **NO** | la recurrencia de proceso lo cubre | — | Descartar |

`S*` = S una vez que existe el panel de detalle (Fase 3).

**Confianza: 8/10.**

---

## 6. Roadmap por fases (MoSCoW → 4 fases construibles)

Cada fase deja el sistema usable y verificable (selfTest verde) antes de la siguiente. Coherente con el loop AREL: plan → primeros pasos supervisados → verificar → purga.

### FASE 1 — Devolver el board (Must) · esfuerzo M
**Objetivo:** que el board vuelva a tener contexto y puedas dar de alta y recurrir tareas. Con esto ya reemplazás el uso diario del Trello plano.

- **Schema** (`01_schema.js` → `Tareas`, aditivo): `+tipo` (cliente|periodica|objetivo|personal|admin), `+etiquetas` (CSV), `+recurrencia` (`1s`/`+1m`/''), `+orden` (int).
- **GAS:** `crearTarea(payload)` (reusa `nextId` `07_util.js:181`, `conLock`, `feed_`); `parseQuickAdd(str)` **pura** (sigilos `!A`/`#etiqueta`/`@cliente`/fecha/`cada semana`); `parseRecurrencia(rec,base)` **pura**; hook de recurrencia en `moverTarea` (clona 1 fila **solo al completar** `hecha`, **no** al `cancelada`).
- **UI** (`index.html`, vanilla): input quick-add arriba del kanban; **chips de filtro por `tipo`/cliente** (recupera CLIENTES/PERIÓDICAS/OBJETIVOS/BUZÓN como vistas sobre los 3 carriles); chip `↻` recurrencia + chip etiqueta en `ccKCard`.
- **Datos:** poblar `tipo` en las 23 tareas migradas (script one-shot, como `99_tmp_trello.js`).
- **selfTest:** asserts de `parseQuickAdd`, `parseRecurrencia`, `crearTarea`, clon-al-completar (recurrente→1 fila; no-recurrente→0; cancelada→0).

### FASE 2 — Recurrencia de proceso + % real (Should) · esfuerzo M
**Objetivo:** el cierre mensual de cada cliente se regenera solo; el avance se calcula.

- **Schema:** nueva pestaña `Plantillas_pasos` (`id_plantilla, tipo_proceso, orden, paso, offset_dias, esperando_de`); `Proyectos +tipo_proceso +periodo`; `Clientes +recurrencia`.
- **GAS:** `instanciarProceso(id_cliente, tipo_proceso, periodo)` → crea `Proyecto`-ciclo + explota N `Tareas` desde la plantilla (**`setValues` en lote**, no `appendRow` en loop); gancho mensual en `corridaDiaria` para clientes con `recurrencia='mensual'`; `avanceProyecto(id_proyecto)` = hechas/total (rollup en GAS).
- **UI:** `%_avance` calculado en `panelCliente`; badge de período en el proyecto.
- **selfTest:** instanciar plantilla → N tareas con fechas correctas; rollup de avance.

### FASE 3 — Tarjeta-cliente con TIMELINE (Should) · esfuerzo M-L
**Objetivo:** el board-CRM — abrir un cliente y ver/operar su timeline de entrega.

- **UI:** panel de detalle al clickear una card (hoy solo se mueve) → descripción/`notas`, `etiquetas`, `fecha_limite`, `recurrencia`, `esperando_de`, editar + `guardarTarea`. Vista **CLIENTES**: cada cliente con su Proyecto activo + `%_avance` + próximo paso (reusa `panelCliente`).
- **GAS:** `guardarTarea(id, campos)` (whitelist, espejo de `moverTarea`); `+esperando_de` en `Tareas` (quién traba: vos/cliente/tercero).
- **selfTest:** guardar campos; timeline ordenado por `orden`.

### FASE 4 — Flujo diario Inbox→Hoy (Could) · esfuerzo S-M
**Objetivo:** cerrar el loop Capture→Organize→Tackle.

- **Bridge:** ítem de `Bandeja` bin=`tarea` + confianza alta → `crearTarea` (reusa la clasificación; **no** un 2º clasificador).
- **Hoy:** el brief **auto-lee lo que vence hoy** (no lo elegís) + adyacencia de la `Agenda` existente (sin scope Calendar — respeta la decisión 07-jul).
- **Could:** captura por email-alias; auto-archivo de `hecha` > N días. **⚠ Seguridad (Bastión):** un email-alias es un **ingress nuevo** — preferir un *poll* de una etiqueta de Gmail (lectura, sin endpoint abierto) antes que un `doPost` público; si va `doPost`, secreto-en-body fail-closed + whitelist, igual que la voz. Pasa por Bastión antes de construirse.

**MoSCoW:** Must = Fase 1. Should = Fases 2-3 + auto-hoy. Could = Fase 4 (email-alias, archivado). **Won't** = Planner-drag, card mirroring, vistas Premium, members, constructor Butler, multi-board (§7).

**Fit-check GAS (todas las fases):** ✅ `google.script.run` + funciones puras + Sheets; cero deps externas. Reusa `leerTabla, nextId, conLock, feed_, aFechaISO, hoyISO, clienteDeProyecto, ESTADOS_TAREA_UI, TERMINALES_TAREA, panelCliente, agendaSemana`.

**⚠ Downstream (pensamiento paralelo — antes de tocar):**
1. **Columnas nuevas → `setup()` + assert de schema de `selfTest` (`09_selftest.js:58`) deben sincronizarse en el MISMO commit** o `setup`/`selfTest` fallan. `leerTabla` mapea por header, así que los consumidores viejos ignoran las columnas nuevas — safe.
2. **`%_avance` manual → calculado:** `panelCliente` (`08_webapp.js:276`) hoy lee `p['%_avance']`; debe pasar a llamar `avanceProyecto()`. Revisar cualquier brief que muestre avance.
3. **Hook de recurrencia en `moverTarea`:** guarda cancel-vs-complete (no clonar en `cancelada`); no clonar en no-op (`moverTarea` ya corta `sin_cambio`).
4. **`instanciarProceso`:** escribir en lote (`setValues`) dentro de `conLock`; no `appendRow` por fila (perf + carrera).

**Confianza: 8/10.**

---

## 7. Pre-mortem — qué NO copiar (y por qué fallaría)

*Dentro de 3 meses, ¿por qué Tareas se volvió un dolor?*

1. **Se clonó el Planner arrastrable.** Semanas construyendo time-blocking + sync GCal 2-way para un beneficio que el brief "3 cosas" ya da. Es la feature más vistosa y la menos necesaria para uno. → **Won't**; "hoy = vence hoy + adyacencia Agenda en lectura" gana en valor/esfuerzo.
2. **El TIMELINE quedó como texto** (CSV en una celda de Proyectos) → murió el % avance, el filtro y la fecha por paso. → filas de `Tareas`, siempre.
3. **Recurrencia mal modelada** — se pre-generaron ocurrencias futuras (basura Notion) o se confundió intervalo-fijo (`+`) con relativo-al-completar. → una instancia viva, cubierto por tests.
4. **Se sobre-normalizó para 6-11 clientes** — tablas-lookup para enums triviales, estados por todos lados. → dropdown + `tipo` + `esperando_de`; 3-4 tablas + `Plantillas_pasos`; denormalizar solo con evidencia.
5. **"Checklist del día" se mantuvo a mano** → stale (tu propia doctrina: "CAPABILITIES no se edita a mano, muere stale"). → es una query por fecha.
6. **Constructor de reglas tipo Butler** → mantenimiento infinito para automatizar un sistema de una persona. → reglas hardcodeadas en `corridaDiaria`, sin UI.
7. **Multi-board "por cliente"** → atención fragmentada, contra el "todo de un vistazo". → un board + filtro por `tipo`/cliente. **Gatillo documentado** para reabrir members/multi-board = aparece un asistente/equipo (coherente con CRITERIO: se adopta cuando el problema es tuyo, no del creador del caso).
8. **Alta que compite con la Bandeja** → dos inboxes que divergen. → bridge que reusa `crearTarea` + la clasificación; frontera clara (Bandeja=difuso a triar; quick-add=ya sé que es tarea).
9. **Cabos stale del área** (confirmados por inventario, no míos): comentario `index.html:616`/`~1444` ("mock… se cablea") y `99_tmp_trello.js` (importador "borrar tras correr") siguen en `src/`. → limpiar en el commit de Fase 1.

**Steelman de "adoptar más Trello":** con cartera creciente y un asistente futuro, multi-board + members + Planner tendrían sentido. **Contra:** hoy sos operador solo; el filtro da la misma vista sin el costo, y el gatillo (equipo) está documentado. Construir para el equipo que no tenés es el impuesto que hunde un ERP de una persona.

**Confianza: 8/10.**

---

## 8. Confianza por sección + fuentes

| Sección | Conf | Nota |
|---|---|---|
| 1 · Sistema real (video) | 9/10 | leído del recording |
| 2 · Tesis "ya es Satori" | 9/10 | evidencia repo (archivo:línea) |
| 3 · Trello 2026 | 9/10 | doc oficial |
| 4 · Arquitectura | 8/10 | síntesis + CRITERIO |
| 5 · Mapeo | 8/10 | veredictos fundados |
| 6 · Roadmap/spec | 8/10 | diseño firme; ejecución la valida Code+selfTest |
| 7 · Pre-mortem | 8/10 | consenso + anti-patrones DB |

**Fuentes (2 olas verificadas):**
- Trello oficial: [Inbox](https://support.atlassian.com/trello/docs/trello-inbox/) · [Planner](https://support.atlassian.com/trello/docs/trello-planner/) · [El nuevo Trello (GA)](https://www.atlassian.com/blog/announcements/new-trello-is-here) · [Dates/recurrencia](https://support.atlassian.com/trello/docs/adding-dates-to-cards/) · [Automation quotas](https://support.atlassian.com/trello/docs/butler-quotas-and-limits/) · [Pricing](https://trello.com/pricing)
- UX/PM: NN/G [Drag-and-Drop](https://www.nngroup.com/articles/drag-drop/) · [Personal Kanban 101 (HN)](https://news.ycombinator.com/item?id=20374479) · Benson [Why Limit WIP](https://kanbantool.com/kanban-library/books/why-limit-wip-we-are-drowning-in-work) · Brictson [Complex tasks in Trello](https://mattbrictson.com/blog/trello-themes-and-checklists)
- CRM/proceso/modelado: Atlassian [Trello for CRM](https://www.atlassian.com/blog/trello/ultimate-trello-for-crm-workflow-breakdown) · Butler [Managing Processes](https://medium.com/@butlerfortrello/managing-processes-with-trello-857a7f58c9f) · [Checklist vs separate cards](https://community.atlassian.com/forums/Trello-questions/Advice-wanted-One-card-with-a-checklist-vs-separate-cards/qaq-p/1746502) · Bytebase [DB design patterns](https://www.bytebase.com/blog/database-design-patterns/)
- Patrones livianos: todo.txt [rec:](https://swiftodoapp.com/todotxt-syntax/recurrence/) · Todoist [every/every!](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV) · McCleery [Kanban indexing](https://nickmccleery.com/posts/08-kanban-indexing/) · Things [Today/Upcoming](https://culturedcode.com/things/support/articles/4001304/)

---

*Próximo paso operativo: si aprobás el roadmap, la **Fase 1** es un `_tareas_code.sh` para Claude Code (schema + `crearTarea` + `parseQuickAdd` + recurrencia + chips + poblar `tipo`), con `selfTest()` como gate antes de declarar hecho. Las fases 2-4 quedan encoladas y se disparan con "avanzá".*
