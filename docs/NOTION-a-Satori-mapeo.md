# NOTION → Satori OS — Qué tomar (y qué resistir)

> **Fecha:** 07/07/2026 · **Autor:** Cowork · **Filtro:** `docs/CRITERIO-arquitectura-agentes.md` · **Fit-check:** GAS + Sheets.
> **Método:** 2 frentes de research verificados contra doc oficial (notion.com/help, developers.notion.com, notion.com/pricing, jul-2026) + análisis crítico (HN, ensayos UX/PM, límites oficiales de performance) + verificación del repo (archivo:línea). Confianza X/10 por sección.
> **Hermano de** `TRELLO-a-Satori-mapeo.md`. Leer después de ese.

---

## 0. BLUF — la respuesta honesta

**Notion no es Trello, y este mapeo es corto a propósito.** Trello mapeaba casi 1:1 a tu board de tareas → adoptabas mucho. Notion es un **workspace maximalista**, y Satori **ya es** lo que hace valioso a Notion: una **base relacional** (`Clientes→Proyectos→Tareas`), **multi-vista** (Command Center: kanban + panel + brief), **captura con IA** (`Bandeja`, mejor que la entrada manual de Notion), **log** (`Bitacora`) y **contexto por entidad** (cerebro nodos/aristas + memoria por cliente, más rico que el "cuerpo de página" de Notion).

**Veredicto del research (confianza 8/10):** Notion ofrece **~0% de capacidad nueva y ~15-20% de ergonomía** sobre un ERP-en-Sheets ya hecho. Lo único "duro" que Notion tiene y un spreadsheet no es **fila-es-documento** (cada registro abre a un cuerpo de notas/log editable) — y **eso ya lo tenés para Clientes**: `panelCliente` muestra la `Bitacora` del cliente (`08_webapp.js:293` → `index.html:906`). Falta solo para **Tareas/Proyectos**, y **ya está en el roadmap Trello** (columna `notas`, Fase 3).

**Entonces el valor de este documento no es una lista de features para copiar** — es tres cosas:
1. **Validación externa:** una herramienta maximalista confirma que tu arquitectura (una fuente, muchas vistas, relaciones mínimas) es la correcta. No te falta un modelo de datos; lo tenés.
2. **Un guardrail explícito — el "Notion tax":** el mayor riesgo para Satori no es que le falte Notion, es que **copiar el maximalismo de Notion** (bloques anidados, wikis, relaciones por todos lados, rollups que nadie mira, "organizar en vez de trabajar") sería exactamente el over-engineering que el CRITERIO prohíbe. §5.
3. **Una nota estratégica (no de features):** hacia dónde va Notion en 2026 — plataforma de agentes + MCP + agentes externos (Claude/Cursor) — que *rima* con la dirección de Satori, y abre un posible **conector** futuro (leer un cliente que viva en Notion), no una adopción. §6.

**Neto adoptable:** 1 cosa chica ya encolada (`notas` en Tareas/Proyectos) + 2 reglas de higiene (gate anti-rollup, multi-vista disciplinada) + inputs tipados donde importe. **Todo lo demás: resistir.**

---

## 1. Modelo conceptual de Notion 2026 (condensado, verificado)

Jerarquía: **workspace → teamspace → page → block** ("todo es un bloque", literal). Lo relevante:

- **Database = colección de páginas.** Cada **fila ES una página** con cuerpo editable (docs + sub-bloques). Ese es el diferencial duro vs. spreadsheet: dato tipado y documento largo en **el mismo objeto**. *(2026: una database ahora agrupa varios "data sources" — cambio de modelo/API.)*
- **Property types** (el corazón): text, number, select, **multi-select**, **status** (agrupa To-do/Doing/Done), date+reminder, person, checkbox, url, **relation** (puntero real entre filas → 1:N, N:M), **rollup** (agrega una propiedad de las filas relacionadas: count/sum/avg…), **formula** (expresión por fila; "Formulas 2.0" ya alcanza propiedades relacionadas sin rollup), **button**, ID. Límite 500 props/DB.
- **Views sobre una misma fuente:** Table, Board (kanban, con grouping/sub-grouping), Calendar, Timeline (Gantt), Gallery, List, Chart — cada una con **filtros/sorts/grouping guardados por vista**, sin duplicar datos. *Este es "el" patrón de Notion.*
- **Templates:** page templates y **database templates** (fila nueva nace pre-poblada con estructura/sub-ítems); **repeating templates** = recurrencia nativa (diaria/semanal/mensual).
- **Linked DB** (misma fuente, vista filtrada en otro lado) · **synced blocks** (contenido reutilizable, no filas).
- **Automations:** reglas if-then **atadas a UNA database** (no cruzan DBs, no encadenan) + **buttons**. Free = solo buttons.
- **[2026, lo más nuevo] AI/Agents:** Notion Agent personal (multi-paso, memoria, ~20 min/tarea) · **Custom Agents** (autónomos, por trigger/schedule, permisos propios, GA may-2026) · **External Agents** (orquestar **Claude y Cursor** dentro de Notion, jul-2026) · **Notion MCP** + connections (Linear, HubSpot, Stripe, GitHub…). Economía = "Notion credits" ($10/1.000).
- **Ecosistema:** Notion Calendar (ex-Cron), **Notion Mail (se apaga 22-sep-2026** → email pasa a connector de agentes), Sites, Forms. **API REST + webhooks** (puede ser backend/fuente).
- **Pricing 2026:** Free (bloques limitados con 2+ miembros, AI trial, solo buttons) · Plus $10 (automations, unlimited) · Business $20 (AI full: Agent+Meeting Notes+Search) · Enterprise.

**Cambios 2025→2026:** data-sources (API breaking), agentes (personal/custom/external), Notion credits, Mail nació y muere, Place+Map view, Developer Platform+Workers.

**Confianza: 9/10** (doc oficial directa; nº exacto de bloques Free 6/10).

---

## 2. La comparación honesta: qué hace valioso a Notion vs. qué Satori ya tiene

| Patrón que hace valioso a Notion | ¿Satori ya lo tiene? (evidencia) | Net-new real |
|---|---|---|
| **Fila-es-documento** (cada entidad abre a un cuerpo/notas/log) | **Sí para Clientes** — `panelCliente` muestra `Bitacora`/observaciones (`08_webapp.js:293`→`index.html:906`); cerebro+memoria por cliente | **Chico:** falta `notas`/log por **Tarea/Proyecto** (ya en roadmap Trello, Fase 3) |
| **Una fuente, muchas vistas** | **Sí** — kanban + `panelCliente` + brief sobre las mismas hojas | **Ninguno** (es disciplina, ya la aplicás) |
| **Relations** (Cliente→Proyecto→Tarea) | **Sí** — `id_cliente`/`id_proyecto` FK en el schema | **Ninguno** |
| **Rollups** (agregados cruzados) | **Parcial** — `%_avance` (a calcular, Trello Fase 2), conteos en `datosHoy` | **Ninguno nuevo** (Sheets hace rollup con fórmula/GAS trivial) |
| **Database templates** (instanciar proceso) | **Propuesto** — `Plantillas_pasos`+`instanciarProceso` (Trello Fase 2) | **Ninguno** (ya encolado) |
| **Recurrencia** (repeating templates) | **Propuesto** — `recurrencia` tarea + proceso (Trello Fase 1-2) | **Ninguno** |
| **Vista calendario** | **Propuesto** — grilla cliente-side + `Agenda` (Trello Fase 4) | **Ninguno** |
| **Captura sin fricción** | **Sí, mejor** — `Bandeja`+`capturar` con clasificación Haiku | **Ninguno** (Notion no clasifica al capturar) |
| **Formula properties** (campos computados) | **Parcial** — `esVencida`, staleness, avance en GAS | **Chico:** más campos computados donde muevan una decisión (con gate, §5) |
| **Inputs tipados** (select/date-picker/relation-picker) | **Parcial** — chips, drag; falta picker de cliente/estado/fecha en altas | **Chico (ergonomía):** pickers en el alta del CM |

**Lectura:** 8 de 10 patrones ya existen o ya están encolados. El net-new se reduce a **`notas` por Tarea/Proyecto** (ya en roadmap), **más campos computados con gate**, y **pickers tipados** (ergonomía). Nada de esto es Notion-específico; es pulido de lo que ya hay.

**Confianza: 8/10.**

---

## 3. Lo poco adoptable (MoSCoW muy corto)

- **SHOULD (ya encolado):** `notas`/log por **Tarea y Proyecto** (cierra "fila-es-documento" para las 2 entidades que faltan). → es la columna `notas` de la **Fase 3 del roadmap Trello**; Notion sube su prioridad de Could a Should porque es el único delta duro real.
- **SHOULD (regla de higiene, no feature):**
  - **Gate anti-rollup / anti-campo-computado:** antes de agregar cualquier métrica/rollup, *"¿qué haría distinto según este número?"*. Sin respuesta concreta → no se agrega. (El corpus crítico de Notion es unánime: las métricas que nadie mira distraen.)
  - **Multi-vista disciplinada:** toda vista nueva = filtro/orden/render sobre la **misma** hoja, **jamás** una copia del dato. (Ya lo hacés; formalizarlo como regla en `CLAUDE.md`/DESIGN.)
- **COULD (ergonomía):** inputs tipados en el alta del CM donde importe (picker de cliente, select de estado, date-picker de `fecha_limite`). Barato, GAS-compatible, reduce errores de tipeo.
- **COULD (el único patrón concreto que Notion suma):** **formulario de intake → `Bandeja`/lead.** Notion Forms escribe directo a una database; el equivalente en tu stack es nativo (Google Form → Sheet, o un form HtmlService → `doPost`). Encaja con tu recepción comercial (KAIROS Etapa 1 — contacto inicial): un formulario público de contacto que crea un `lead` en `Bandeja` sin cargar a mano. **⚠ Bastión** si va por `doPost` (ingress nuevo, fail-closed); un Google Form nativo evita el endpoint. Gatillo: cuando quieras captar prospectos sin tipear.
- **WON'T (resistir — es el 95% de Notion):** bloques/páginas anidadas · wiki/second-brain/PARA · relations más allá de la espina Cliente→Proyecto→Tarea · rollups anticipatorios · proliferación de tablas/DBs · automations-builder · Notion **como herramienta** o **como backend** de Satori (pagarías el "Notion tax" + migrar off Sheets, a cambio de capacidades que ya tenés).

**Confianza: 8/10.**

---

## 4. Convergencia con el roadmap Trello (lo importante)

Notion **no abre fases nuevas**: valida las que ya definiste y sube la prioridad de una columna.

| Patrón Notion | Ya vive en el roadmap Trello |
|---|---|
| Database templates + repeating | Fase 2 — `Plantillas_pasos` + `instanciarProceso` |
| Relations + rollups | esquema actual + `%_avance` calculado (Fase 2) |
| Una fuente, muchas vistas | principio §4 del doc Trello (context = columna + vista) |
| Vista calendario | Fase 4 (grilla + `Agenda`) |
| Fila-es-documento (`notas`) | Fase 3 (`notas` en el panel de detalle) — **Notion lo sube a Should** |
| Status property (estados agrupados) | `estado` + carriles (ya) |

**Implicación operativa:** no hay un "roadmap Notion" separado. Hay **un ajuste al roadmap Trello**: promover `notas` (Tarea/Proyecto) de Could→Should, y adoptar 2 reglas de higiene (gate anti-rollup, multi-vista disciplinada). Fin.

**Confianza: 9/10.**

---

## 5. Pre-mortem — el "Notion tax" es el guardrail (la parte que importa)

*Dentro de 6 meses, ¿por qué Satori se volvió lento de usar y de mantener?* Cada fila = una crítica documentada de Notion → el guardrail para Satori.

| Trampa de Notion (evidencia) | Cómo se manifestaría en Satori | Guardrail |
|---|---|---|
| **"Construir el sistema antes de usarlo"** — cada DB/template es trabajo previo | Sobre-diseñar Tareas con 10 campos "por si acaso" | Agregar estructura **solo ante fricción experimentada**, no anticipada |
| **Organizar en vez de trabajar** (mini-dopamina de configurar) | Pulir el CM/campos en vez de asesorar clientes | El sistema baja el techo del líder, no lo sube (lente Satori) |
| **Fricción por-acción compuesta** (6 campos por tarea) | Alta de tarea que pide llenar 6 cosas | Quick-add con 1 campo + sigilos (Trello Fase 1); el resto opcional |
| **Rollups/métricas que nadie mira** | Dashboards de números decorativos | Gate: *"¿cambia una decisión?"* (§3) |
| **Relations por sí mismas** ("conectar todo → nada usable") | Agregar Tarea↔Meta↔Área↔Valores | 0-2 relaciones bastan; la espina Cliente→Proyecto→Tarea es el límite |
| **Bloques anidados / wiki / PARA** | Convertir el cerebro por cliente en un PARA personal | El cerebro tiene propósito (IA); no es un knowledge-base para navegar a mano |
| **Techo de performance** (Notion se degrada ~5k filas) | — | Sheets aguanta más y Satori es single-tenant chico; no es riesgo hoy, pero **no** metas todo en una hoja gigante |
| **Automatización opaca** (cadenas que fallan en silencio) | Triggers GAS mágicos e inauditables | Reglas hardcodeadas, legibles, logueadas en `Actividad` (ya lo hacés) |

**Steelman de "adoptar Notion":** un no-programador sin dev necesita Notion para armar vistas/relaciones sin código. **Contra:** vos tenés agente + Code que construyen vistas a demanda, y una base relacional ya montada — el beneficio de Notion (vistas sin código) es justo el que menos te aplica, y el costo (el tax + techo + migrar off Sheets) es real. Va a **Won't**, con gatillo documentado: *reabrir solo si Satori dejara de tener quien construya vistas a medida.*

**Confianza: 8/10.**

---

## 6. Nota estratégica (no es adopción de features)

Notion 2026 dejó de ser "docs+DB" y se volvió **plataforma de agentes**: Custom Agents autónomos por trigger/schedule con permisos propios, **Notion MCP**, connections (Linear/HubSpot/Stripe/GitHub…) y **agentes externos (Claude, Cursor) orquestados dentro de Notion**. Esto **no es para copiar** — es para leer dos cosas:

1. **Valida la dirección de Satori** (agentes con permisos acotados, MCP, voz, kill-switch). El mercado va hacia donde ya apuntás; no es humo.
2. **Abre un conector futuro, no una adopción.** Notion expone **API REST + webhooks + MCP**. Si algún día un cliente vive su operación en Notion, Satori podría **leerlo como fuente** (igual que el conector Vehemence de `19_conectores.js`), sin adoptar nada de Notion internamente. → **Gatillo:** un cliente real con datos en Notion. Hasta entonces, **descartar** Notion-as-backend y Notion-as-tool.

**Confianza: 7/10** (el espacio de agentes se mueve rápido; revalidar si el gatillo aparece).

---

## 7. Confianza por sección + fuentes

| Sección | Conf | Nota |
|---|---|---|
| 1 · Modelo Notion 2026 | 9/10 | doc oficial |
| 2 · Comparación honesta | 8/10 | evidencia repo + research |
| 3 · Adoptable | 8/10 | veredicto fundado |
| 4 · Convergencia Trello | 9/10 | contra el propio roadmap |
| 5 · Pre-mortem / tax | 8/10 | consenso crítico fuerte |
| 6 · Nota estratégica | 7/10 | espacio en movimiento |

**Fuentes (verificadas):**
- Notion oficial: [Database properties](https://www.notion.com/help/database-properties) · [Relations & rollups](https://www.notion.com/help/relations-and-rollups) · [Views](https://www.notion.com/help/views-filters-and-sorts) · [Database templates](https://www.notion.com/help/database-templates) · [Automations](https://www.notion.com/help/database-automations) · [Agents](https://www.notion.com/product/agents) · [Release 3.6 (External Agents)](https://www.notion.com/releases/2026-07-01) · [API](https://developers.notion.com/reference/intro) · [Pricing](https://www.notion.com/pricing) · [Performance limits](https://www.notion.com/help/optimize-database-load-times-and-performance)
- Crítica/análisis: [HN — Notion vs Excel](https://news.ycombinator.com/item?id=39030667) · [The Notion Relations Trap](https://medium.com/@R.H_Rizvi/the-notion-relations-trap-why-connecting-everything-makes-nothing-usable-6d3dfdf416e7) · [Second Brain productivity trap](https://maketecheasier.com/second-brain-productivity-trap/) · [Why I stopped using Notion (UX review)](https://uxplanet.org/why-i-stopped-using-notion-an-honest-ux-review-ebf03e268a01) · [Notion vs Google Sheets 2026](https://sync2sheets.com/blog/notion-vs-google-sheets/)

---

*Próximo paso: ninguno construible nuevo. La única acción es **promover `notas` (Tarea/Proyecto) de Could→Should** en el roadmap Trello y anotar las 2 reglas de higiene. Si querés, lo integro al doc Trello y lo dejo como una sola fuente. Y como con Trello: si me pasás un recording de tu Notion real, aterrizo esto a tu uso concreto.*
