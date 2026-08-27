# ACTUALIZACIÓN 07-ago (sesión Cowork · continuación) — leer ANTES del handoff de abajo

> Reconciliado contra código real (no contra el handoff). Deltas de esta sesión:
> - **Promote/push YA HECHOS:** HEAD `af4484f`, `main` sincronizado con origin, **`/exec @37` CONFIRMADO** por `clasp deployments`. El BLOQUE 0 de abajo quedó stale en "ahead 3 / sin pushear" → ignorar esa parte.
> - **BLOQUE B.A (grafo del Cerebro / la "M") YA ESTABA CONSTRUIDO:** `_cerebro/_scripts/grafo.py` → `_cerebro/GRAFO.html` (generado por Claude Code, vigente al 06-ago, 749 nodos, clickeable). **NO reconstruir.** Pendiente real de B.A: render-check + alinear a tokens satori-design (hoy paleta hardcodeada #12110f/#d4a857) + la capa semántica "L" (fase 2 aparte).
> - **BLOQUE B.D HECHO:** `_cerebro/FLOTA.html` (org chart de la flota; Equipo Pro completo 25 esp + A1/A2; Sato + agentes del OS; Consejo; Bastión/Círculo a nivel-rol marcados "enriquecer" sin inventar). Verificado por render (43 tarjetas, 0 errores JS) + purga cerrada (1 Medio + 2 Bajos corregidos). También publicado como artifact de Cowork.
> - **BLOQUE A LISTO PARA CODE:** `ENCARGO-CODE-BLOQUE-A-2026-08-07.md` (repo raíz). A.0/P1 (sacar `estado` del whitelist de `guardarTarea` y del panel → la recurrencia solo se completa por el kanban) + A.1 `crearProyecto` (clonado de `crearTarea`, `_soloOwner_`+ENDPOINTS_UI+validación roster) + asserts D8d/D8e con 🔒 aislamiento. Base confirmada sólida (bug P1 real 9/10; `crearProyecto` ausente confirmado). Falta: Code lo ejecuta en la Terminal + push/promote con aprobación de Luciano.
> - **Higiene:** `src/08_webapp.js` dispara detección binaria de `grep` (byte no-UTF8) → leer con `grep -a`/`sed`. Limpieza opcional, no bloquea.

---

# HANDOFF — Satori OS — 2026-08-07 · post BLOQUE 4 (para conversación NUEVA)

> **Cómo retomar (modo ejecutor, no re-explicar el proyecto):** BLOQUE 4 (notas + panel de edición de tarea) quedó **CERTIFICADO 837/0 y promovido a `/exec @37`**. Esta sesión abre DOS frentes que Luciano decidió el 07-ago: **(A) completar el tablero de Tareas** (features de Trello/Notion que faltan + los pedidos del eyeball) y **(B) aplicar TODO el roadmap Founder OS A/B/D/E/F/G/H**. Ir directo al bloque que toque. Loop de siempre: Cowork planifica+asserts → Claude Code ejecuta (clasp vive en la Terminal del Mac, NO en el puente de Cowork) → Cowork audita+purga → Luciano aprueba push/promote.

## BLOQUE 0 · Estado congelado (verificado 07-ago)
- **Repo:** HEAD `b9ec803` · `main` **ahead 3** de `origin` (BLOQUE 4 + 2 fixes NO pusheados a GitHub — el promote los pushea; GitHub es backup off-Mac, no bloquea).
- **Prod:** `/exec @37` (tras correr el promote de esta sesión). Verificar con `clasp deployments`, NUNCA con `_promote_rollback.txt`.
- **Cert editor:** 837/0 (5 tramos). **Harness offline:** 500/0.
- **BLOQUE 4 entregado:** `notas` en `Tareas`+`Proyectos` · `guardarTarea`/`detalleTarea`/`guardarNotaProyecto`/`listaProyectos` (gateadas, en `ENDPOINTS_UI`) · panel `#tdboard` (overlay kscrim+kboard) con botón ⋯ en cada card · nota de proyecto en la Ficha 360 (`f360NotaProy_`) · asserts `D8c` · `CLAUDE.md` +2 reglas (anti-rollup, multi-vista).
- **Clientes:** MesaQuince (CLI-001) = `potencial` · `correo_on` = TRUE (la 1ª tanda de correo la dispara `correoTriaje()` o la corrida diaria).
- ⚠ **`clasp` NO está en el puente de Cowork** (solo en la Terminal nativa del Mac). Todo `clasp push`/`clasp deploy`/promote va por la Terminal. `git` en el puente choca con `.git/index.lock` (`rm -f` primero).

---

## BLOQUE A · Tablero de Tareas — completar Trello/Notion + eyeball

Ley: `docs/TRELLO-a-Satori-mapeo.md` §6 (Fases 1-4) + `docs/NOTION-a-Satori-mapeo.md` §3. Estado real verificado contra código 07-ago:

### A.0 · DEUDA #1 de la purga (Medio — arrancar por acá, es chico)
**`guardarTarea` no clona la recurrencia al pasar una tarea a `hecha` desde el panel.** La lógica clon-al-completar vive SOLO en `moverTarea` (kanban); el picker de estado del panel escribe `estado` directo → una tarea recurrente completada por el panel **no renace** (silencioso). Ningún test lo cubre.
- **Parche recomendado:** sacar `estado` del whitelist de `guardarTarea` **y** del panel (`#tdEstado` + `tdEstados_` en `index.html`) → el estado se cambia solo en el kanban, que sí clona. Alternativa: delegar el cambio de estado a `moverTarea` desde `guardarTarea` (ojo: no anidar locks; `moverTarea` no usa `conLock`).
- **Assert nuevo:** tarea recurrente + estado→`hecha` por `guardarTarea` ⇒ renace 1 clon (o guardarTarea rechaza estado). Workaround hasta el fix: completar recurrentes arrastrando en el kanban.

### A.1 · crearProyecto (PRIORITARIO — desbloquea todo lo de proyecto)
Hoy **no existe `crearProyecto` en ningún lado** (grep vacío) y la hoja `Proyectos` tiene 0 filas → el picker del panel sale vacío y las notas de proyecto no tienen dónde. Sin esto, la espina Cliente→Proyecto→Tarea no se puebla.
- **GAS** (`08_webapp.js`): `crearProyecto({id_cliente, nombre, estado, fecha_objetivo, proximo_hito})` → `nextId(Proyectos,'id_proyecto','PRO',4)` + `appendFila`; `_soloOwner_` + alta en `ENDPOINTS_UI`; valida `id_cliente` contra el roster (AISLAMIENTO §3, como hace `guardarTarea` con id_proyecto).
- **UI:** en el `#tdProy` del panel, opción "＋ nuevo proyecto" que abre un mini-alta (nombre + cliente) → `crearProyecto` → refresca el picker y selecciona el nuevo. satori-design registro operativo, tokens existentes.
- **Assert:** crearProyecto devuelve id, valida cliente inexistente (rechazo), aparece en `listaProyectos`.

### A.2 · Archivar tareas + ver archivadas (eyeball #1 + Trello Fase 4 "auto-archivo")
- **Schema:** `Tareas +archivada` (aditivo) — o reusar un estado/flag. Evaluá cuál rompe menos (leé los consumidores de `estado`/`Tareas` primero).
- **Manual:** botón "Archivar" en la card/panel → marca `archivada=true` (sale de las 3 columnas). Botón "Archivadas" en el tablero → vista filtrada de archivadas (read-only + des-archivar).
- **Auto:** en `corridaDiaria`, auto-archivar `hecha` > N días (N en Config). Máx ruido cero.
- **Assert:** archivar saca de las columnas vivas; la vista archivadas las lista; des-archivar las devuelve; auto-archivo respeta el N.

### A.3 · Trello FASE 2 (Should) — recurrencia de proceso + % real (FALTA COMPLETA)
- **Schema:** pestaña nueva `Plantillas_pasos` (`id_plantilla, tipo_proceso, orden, paso, offset_dias, esperando_de`) · `Proyectos +tipo_proceso +periodo` · `Clientes +recurrencia`.
- **GAS:** `instanciarProceso(id_cliente, tipo_proceso, periodo)` → crea `Proyecto`-ciclo + explota N `Tareas` desde la plantilla (**`setValues` en lote**, no `appendRow` en loop) · gancho mensual en `corridaDiaria` para `Clientes.recurrencia='mensual'` · `avanceProyecto(id_proyecto)` = hechas/total (**rollup en GAS**, NO `COUNTIF` en la hoja — la hoja es máquina-gestionada).
- **UI:** `%_avance` calculado en `panelCliente`; badge de período en el proyecto.

### A.4 · Trello FASE 3 restante (Should)
- `Tareas +esperando_de` (quién traba: vos/cliente/tercero) + editable en el panel.
- Vista **CLIENTES/TIMELINE** en el board: cada cliente con su Proyecto activo + `%_avance` + próximo paso (reusa `panelCliente`/`f360Plan_`). El "TIMELINE" del Trello = las `Tareas` de un `Proyecto` ordenadas por `orden`.

### A.5 · Trello FASE 4 restante (Could) + Notion COULD
- **Bridge Bandeja→crearTarea:** ítem de `Bandeja` con `bin=tarea` + confianza alta → `crearTarea` (reusa la clasificación Haiku, NO un 2º clasificador).
- **Auto-hoy:** verificar si el brief ya auto-lee "vence hoy" (parcial); si no, cerrarlo (sin scope Calendar, decisión 07-jul).
- **Formulario intake → Bandeja/lead** (Notion COULD, converge con recepción KAIROS Etapa 1): Google Form → Sheet (preferido) o HtmlService `doPost`. ⚠ **Bastión si va por `doPost`** (ingress nuevo, secreto-en-body fail-closed).
- **Captura email-alias:** ⚠ Bastión, diferir (preferir poll de etiqueta Gmail antes que `doPost` público).

### Descartado por Luciano (07-ago) — NO construir
- **Columnas custom / crear-editar-reordenar columnas del tablero.** Los 3 estados (`pendiente/en_curso/hecha`) son load-bearing (recurrencia clona en 'hecha', vigilancia/brief leen esos estados). Queda como está.
- **Notion WON'T** (§3): bloques anidados, wikis, PARA, rollups anticipatorios, relaciones más allá de la espina, Notion-as-tool/backend.

---

## BLOQUE B · Founder OS (Bennett OS) — aplicar TODO A/B/D/E/F/G/H

Luciano decidió el 07-ago: **aplicar todo el roadmap** (menos el comercial Bloque C, que queda pendiente). Ley: `FOUNDER OS/HANDOFF-FounderOS-v2.md` (benchmark completo sobre los 2 videos, MoSCoW). Ya validado que la escalera de maduración (human-led/assisted/autonomous) = doctrina D1 de Satori (no re-construir eso).

**Orden recomendado (un bloque por vez — el pre-mortem marca DISPERSIÓN como el riesgo #1; MoSCoW, no los 7 juntos):**

- **A · Optimal Engine (brain visual + semántico)** — *ARRANQUE.* T-shirt M→L. (a) grafo HTML que lee el markdown de `_cerebro/` (MOC + `[[wikilinks]]` + frontmatter) como nodos clickeables — **la M, empezar por acá**: estático, `satori-design` registro operativo, **sin datos de cliente → Bastión verde**. (b) fase 2: capa semántica (embeddings/pgvector) + destilado en clusters — la L. **NO copiar la taxonomía PARA** de FounderOS: se adopta el visor + la capa semántica, no la taxonomía (el MOC/INBOX ya funciona).
- **D · Org chart de la flota** — T-shirt M. Renderizar Círculo/Consejo/Equipo 75/Bastión/Sato como org chart visual con tools por agente. Ata con A (mismo motor visual). Datos propios → Bastión verde.
- **E · Workspaces programados** — T-shirt S-M. Digests advisory → tareas programadas (`create_trigger` del MCP de scheduled tasks, NO `CronCreate` local). **Solo datos propios al inicio.**
- **B · Satori HQ (dogfooding)** — T-shirt L. Cockpit propio: funnel propio = **recepción KAIROS hecha tablero** (First Touch→Engaged→Nurtured→Opted In→Cliente, con los 11 candidatos del Bloque 6 KAIROS) + hilos de clientes activos agregados + finanzas propias + net worth + feed del Cerebro + social propio. Stack lo decide `stack-satori` (probable Supabase). ⚠ **Toca datos de cliente → gate Bastión + Purga obligatorio.**
- **F · Satori Kits (productización)** — Nice. tablero/SGIC/cierre → kits reutilizables/vendibles, **recién sobre lo repetido ≥2 veces** (no productizar antes de estabilizar). ⚠ datos de cliente → gate.
- **G · Finance personal + net worth** — Nice. Datos propios → Bastión verde.
- **H · Empaquetado portable** — Nice. Satori OS vX versionado.

**Guardrails Bastión (del §7 del handoff FounderOS, innegociables):**
- Ningún workspace programado toca datos de cliente hasta Purga + Bastión. A/D/E(inicio)/G = datos propios (verdes); B/F = datos de cliente (gate).
- **No readoptar OpenClaw** por el solo hecho de que FounderOS lo use (Satori lo tenía descartado "rojo").
- **No conectar ningún "MCP" de FounderOS** (no expone endpoint real; si aparece, pasa por Bastión — cadena de suministro). El `mcp_token` del link es token de **marketing**, no MCP — no pegarlo público.

---

## BLOQUE P · Purga BLOQUE 4 — fixes a aplicar (consolidado)

Auditoría adversarial de cierre sobre el diff de BLOQUE 4 (panel de tarea + notas). **Veredicto: sin Críticos ni Altos.** 1 Medio + 3 Bajos, todos con parche propuesto. **Ninguno bloqueó el promote a `/exec @37`** (se decidió promover con estos como deuda registrada). Aplicarlos como tanda de higiene al abrir el frente del tablero (BLOQUE A) — el #1 conviene junto con A.0 (es el mismo hallazgo).

| # | Sev | Confianza | Hallazgo | Evidencia | Parche propuesto |
|---|-----|-----------|----------|-----------|------------------|
| P1 | **Medio** | 9/10 | `guardarTarea` no clona la recurrencia al pasar a `hecha` desde el panel (la lógica clon-al-completar vive SOLO en `moverTarea`). Recurrente completada por el picker del panel **no renace**, silencioso. | `08_webapp.js` `guardarTarea` (whitelist incluye `estado`, no clona) vs `moverTarea` (clona en 'hecha'). Ningún assert lo cubre. | Sacar `estado` del whitelist de `guardarTarea` **y** del panel (`#tdEstado`/`tdEstados_` en `index.html`): el estado se cambia solo en el kanban, que sí clona. Alt: delegar a `moverTarea` (ojo locks: `moverTarea` no usa `conLock`). **Es idéntico a A.0** — aplicar una vez. |
| P2 | Bajo | 7/10 | Performance: `listaProyectos` se llama en cada apertura de panel y `detalleTarea` hace `leerTabla` completa por cada open. Con `Tareas` grande, O(n) por click. | `08_webapp.js` `detalleTarea` → `leerTabla(Tareas)` sin índice; `listaProyectos` sin cache en el open del panel. | No prematuro: dejar como deuda hasta que `Tareas` pase ~200 filas. Cuando pese: buscar la fila por id con `getRange` puntual en vez de `leerTabla` entera; cachear `listaProyectos` en el cliente entre aperturas. |
| P3 | Bajo | 8/10 | `etiquetas` no dedup: guardar dos veces la misma etiqueta la duplica en el string. | `guardarTarea` escribe `campos.etiquetas` tal cual, sin normalizar. | Split por coma → trim → `Set` → join antes de escribir. Trivial, en `guardarTarea` (server, no confiar en el cliente). |
| P4 | Bajo | 6/10 | Log de `estado` genérico: el registro en Actividad no distingue cambio-por-panel de cambio-por-kanban, dificulta auditar el origen de un estado. | `guardarTarea` loguea el cambio sin marcar canal. | Sumar el canal (`panel`/`kanban`) al detalle del log en Actividad. Cosmético; solo si molesta al auditar. |

**Hipótesis a verificar (no confirmadas, separadas):** ninguna quedó abierta — la purga cerró con evidencia en los 4.

**Remediación:** solo P1 justifica acción cercana (Medio, y desbloquea la coherencia de recurrencia). P2/P3/P4 son higiene opcional. **Regla de cierre de purga:** un hallazgo no se cierra por "se corrigió" sino por evidencia (assert nuevo verde o smoke en el sistema real). Al aplicar P1, sumar el assert de A.0 (recurrente + estado→`hecha` por `guardarTarea` ⇒ renace 1 clon, o `guardarTarea` rechaza `estado`).

---

## Punteros
- Repo `Projects/SatoriOS/` · commits `4360ffd` (BLOQUE 4) → `ace6372` (fix D8c) → `b9ec803` (fix D43d4).
- Docs: `docs/TRELLO-a-Satori-mapeo.md` · `docs/NOTION-a-Satori-mapeo.md` · `FOUNDER OS/HANDOFF-FounderOS-v2.md` + `satori-vs-founderos-v2.html` · `docs/CRITERIO-arquitectura-agentes.md` · `PLAN-F3-COMERCIAL-2026-08-03.md` (Bloque C comercial, pendiente).
- Encargos de esta cadena: `ENCARGO-CODE-BLOQUE4-notas-panel-tarea-2026-08-05.md` · `ENCARGO-CODE-BLOQUE4-UI-2026-08-05.md`.
- **CLAVES:** MAESTRO Sheet `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` · scriptId GAS `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` · `/exec` deploy `AKfycbxZJL4E…` (@37) · `/dev` `AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I` · carpeta backups `1XPY7NoXKGFQRVgCMW9n6-nllXF-eExox` · voz `xcAUMhbpNX2WRGsuhjFy` · secretos vencen 2026-10-19.
- **Deploy:** `bash _promote_exec.sh` (dry-run) → `--go`. Editor GAS = cuenta **luciano@satoriconsultoria.com** (NO llopriore@gmail.com). Funciones del desplegable = sin argumentos.

## Diferidos con gatillo (NO tocar sin que el gatillo ocurra)
- **Bloque C comercial** (calculadora costo-inacción + garantía + muro de testimonios → KAIROS Etapa 4) — pendiente por decisión de Luciano (07-ago).
- **BLOQUE 5.1:** `_drillRestore_` sigue con `Spreadsheet.copy` (invisible bajo `drive.file`) → migrar a `Drive.Files.copy` como BK-2. Higiene, no bloquea.
- **BLOQUE 5.2:** poda de `Correo_visto` > 14d (load-bearing, NO remover la hoja).
- **Lift (agente retención):** decidido runner v1 + gate:true, pero NO tiene runner construido (`RUNNERS.lift` no existe). Frente aparte.
- **D9/D10:** aprobados para construir en forma GATED (draft→default-deny→OK→escalera), nunca auto-promoción. Frente aparte.
- **OWNER_TOKEN Vehemence:** rotado, pendiente de confirmar (Script Properties + marcador `?k=`).
- **Cabecera `HANDOFF.md` del repo:** stale ("CÓDIGO COMPLETO, CERTIFICACIÓN PENDIENTE") → actualizar con `_inventario_cierre.sh` (BLOQUE 5.3).

*Handoff generado por Cowork 07/08/2026 tras certificar y promover BLOQUE 4. Retomar en conversación NUEVA, modo ejecutor desde el primer mensaje.*
