# HANDOFF v2 — TheFounderOS (BENNETT OS) · benchmark revisado contra los 2 videos

> Reemplaza al `HANDOFF-FounderOS.md` (v1, 31/07). Motivo: v1 se armó SOLO con el copy público de thefounderos.com. Ahora vi los dos videos que dejaste en `SatoriOS/FOUNDER OS/` y el producto real quedó a la vista. Muchos ítems que v1 marcaba "no verificado / reservado a la cohorte" hoy están VERIFICADOS por captura.
> Generado: 01/08/2026 · Fuente única de esta etapa · Guardar en `_cerebro/areas/founderos-benchmark.md`.

---

## PRÓXIMO PASO (decisión tuya)
Sigue firme: **arrancar Bloque A — Cerebro Visual**, pero con el brief corregido por lo que vi (abajo §6). El video no cambia la prioridad; cambia el *qué* de A: no es solo un visor de grafo, es un **motor de ingesta + destilado** (ver §2). Confirmá "arranca A" o pedí otro bloque.

---

## Qué cambió respecto de v1 (lo que se me pasó por alto y ahora incluyo)

| # | v1 decía | La verdad (verificada en video) | Conf. |
|---|---|---|---|
| 1 | "Matt-Gray-style, genérico" | Es una instancia concreta: **BENNETT OS v3**, del operador **Bennett Spooner** (@bennettx.ai). El reel muestra SU sistema corriendo. | 9/10 |
| 2 | Internals "reservados a la cohorte, no verificado" | El reel **expone la app entera**: org chart de agentes, brain, funnel, finanzas, social, character sheets. Ya no es inferencia. | 9/10 |
| 3 | "Primo **monousuario** de Satori" | Es mono-**operador** pero **multi-negocio**: corre varias marcas bajo un OS (Meridian · Agency Accelerant · Personal Brand · Merysca · Traeko · Bonusblevel), filtrables. Más cerca del multi-tenant de Satori de lo que dije. | 8/10 |
| 4 | Brain = "markdown plano con grafo" | Brain = **OPTIMAL ENGINE**: ingesta (texto·voz·drag·upload) → **markdown + pgvector + bóveda Obsidian** → destilado en folders/clusters/notas. No es solo un grafo: es un motor de conocimiento. | 8/10 |
| 5 | (no figuraba) | **Aparato comercial completo** en el landing: calculadora de costo-de-no-hacer (**US$208.000**), garantía de reversión de riesgo ("si no entrega, no pagás"), muro de testimonios, 2 tiers, countdown de cohorte. Relevante para el sistema de recepción KAIROS. | 9/10 |
| 6 | Agentes = "advisory" | Agentes escritos como **personajes con job description en primera persona** + estado (builtin / in development) + tools MCP explícitas por agente. | 9/10 |

**Audio (actualizado v2.1):** la transcripción del reel la pasaste vos y **confirmó** el análisis visual + agregó 4 cosas que ahora están incorporadas (abajo). Conf. de la narración: ahora 9/10. (Registro del intento fallido: no se pudo transcribir en sesión — whisper/torch, clonar repos y egress a Adobe bloqueados por el sandbox; la app Minutes de tu Mac tiene el pipeline pero le falta el modelo `ggml-small.bin` → `minutes setup --model small` una vez y queda operativa.)

**Lo que sumó la transcripción (v2.1):**
1. **6 departamentos canónicos:** Comunicaciones · Sales · Finanzas · Clientes · Marketing/Growth · Tech.
2. **El brain está construido sobre "GBrain"** (por eso el "Data Agent · G-Brain Analyst"). Lo de markdown+pgvector+Obsidian que leí en el panel es la implementación; GBrain es el motor nombrado.
3. **El conductor/super-agente es un "Hermes harness"** — un agente delegador que comanda a los 37. (Ojo: Satori tenía **Hermes descartado** "solo si VPS multicanal 24/7" — FounderOS lo corre como harness local. Dato, no orden de readoptar.)
4. **Taxonomía SOP + skill-file + autonomía** (lo más jugoso, ver abajo): cada operación de cada departamento tiene un **SOP**, con **skill files descargables**, el agente asociado, y una etiqueta **human-led / human-assisted / fully autonomous**.

**➤ El hallazgo estratégico #1 para Satori:** esa etiqueta *human-led / human-assisted / fully autonomous* por SOP **ES tu escalera de maduración** (nivel 0 manual → 1 skill/SOP → 2 cadena con gates → 3 automatización, doctrina D1 en el CLAUDE.md de SatoriOS). FounderOS ya la tiene **visible y por-SOP**; Satori la tiene como doctrina pero sin la etiqueta visual. Es el puente más limpio entre lo que viste y lo que Satori ya cree. Se integra en Bloque A/D.

---

## §1 · Qué es (afinado)
Programa-cohorte (2 semanas / 6 clases, repo que el fundador POSEE, corre sobre Claude Code + MCP, local-first) para que **un operador** convierta su portafolio de negocios en **una empresa de ~37 agentes de IA** gobernada desde un solo OS. Tesis de venta: *"no prompteás IA: le construís un sistema operativo, y te lo llevás para siempre"*. Diferencial emocional: **propiedad + un solo lugar que lo sabe todo** (el brain). Precio US$1.497 (early), 2 tiers, garantía "pagás si entrega".

## §2 · Arquitectura REAL (verificada en el reel)
Jerarquía viva:
- **OPERATOR** (humano: Bennett Spooner)
  - **CONDUCTOR = "Hermes harness"** — super-agente delegador ("AI HEAD"), runtime *builtin* "hasta que llegue la Mac mini" (local-first), tools: `broadcast · openclaw · tmux`. Router/entrada única que comanda a los 37 agentes: "Chat with Conductor — reaches [todos]".
    - **CREWS por departamento** → cada crew tiene **agentes** → cada agente tiene **tools/skills** (builtin o MCP) y estado:
      - **Marketing/Growth Crew:** Social Agent (builtin, Social Media & Content) · Arcade Crea… · Higgsfield · **ManyChat MCP** · Reaction E… · Zernio Pub…
      - **Tech/Knowledge Crew:** Data Agent (*G-Brain Analyst*, builtin) · Stack Monitor (Local Stack Health, builtin) · Notion Sync · **Markdown Auditor** · **Vector Auditor** — tools: Supabase, Zeroentropy(vector), OpenClaw
      - **Finances Crew:** Payments Pulse (Processor Monitor, builtin) · FanBasis · Processor C… — tools: `stripe · paypal · square · shop · fanbasis`
      - **Comms Feed:** Gmail · WhatsApp · Slack unificados
      - + Sales · Product · Operations · Research/Automation · Client Delivery · Clients · Communications
- **~37 agentes** en total ("37 AI Agent Company").
- **Agentes = personajes**: cada uno con descripción en 1ª persona. Ej. real (Markdown Auditor = "knowledge-base janitor"): *"notás links rotos solo cuando algo tira 404 frente a un cliente. Lista links rotos y huérfanos; vos triás. Camina cada archivo, puntúa cada folder, trackea los fixes hasta done. Enforce lo que 'sano' significa y reporta el score."*

### Módulos de la app (sidebar, verificado)
`EVENTS`: Home · Comms · Feed · Workflows · Social · Content · Finances — `AGENTS`: Agents · Tasks · Skills · Org Chart — `INTELLIGENCE`: **Optimal Engine** · Doctor — `SYSTEM`: Connections · Roadmap · Analytics · Reference Vault · Personas.

### Los módulos que importan (detalle real)
- **OPTIMAL ENGINE (el brain), construido sobre GBrain:** grafo radial de nodos clickeables; barra "dump into the brain… (text · voice · drag or upload)"; store markdown + pgvector + bóveda Obsidian; destila en **8 folders / 8 clusters / notas**; cruza todos los dominios del OS. **Va embebido EN VIVO en el hero del landing** ("A live map of everything my businesses know").
- **DEPARTAMENTOS + SOPs (confirmado por audio):** 6 departamentos (Comunicaciones · Sales · Finanzas · Clientes · Marketing/Growth · Tech); al entrar a cada uno hay un **SOP por operación**, conectado a los agentes IA y humanos necesarios, con **skill files descargables** por SOP y la etiqueta de autonomía **human-led / human-assisted / fully autonomous**. Las personas se **precargan al bootear el OS** (bundles de agentes+skills del último año, empaquetados y vendibles).
- **SOCIAL:** agrega la audiencia PROPIA del operador — IG 48.061 · TikTok 9.945 · X 4.196 · YouTube 607 · LinkedIn ~1,x · reach 60.802 · growth +6.335 · eng 5.990 · consistencia de posteo · últimos posts por plataforma.
- **FUNNEL:** CRM del pipeline PROPIO — First Touch → Engaged → Nurtured → Opted In → Converted, con **decay** (rojo a los 21d de silencio, archive a 90d), valor MRR, fuentes reales (After CRM, Meta Ads), contactos reales.
- **FINANCES:** Accounts · Incomes · Expenses · Budget · Subscriptions · Transfers · Debt · **Net Worth**; presupuesto mensual con "verdict".
- **Personas / multi-negocio:** las marcas del operador como folders/personas staffeadas ("Every business ships as a staffed team. Open a folder, meet the roster").

## §3 · El landing (MOV, copy verificado)
Hero "Build your own AI operating system and own it forever" (brain embebido) → "You're using AI every day. So why is everything still on you?" → "Introducing The Founder OS. You didn't just prompt AI. You built it an OS." → "Every business ships as a staffed team. Open a folder, meet the roster." → "Real, working tools ship inside it" (**5 flagship**: Creator-OS · CRM-OS · Finance-OS · PM-OS · Second-Brain + **"Plus 15 more: billing, legal, OKRs, team…"** ≈ 20 tools) → "Who this is for" → **"I didn't design a course. I documented my system"** → calculadora costo-de-inacción **US$208.000** (tu tarifa × 20h × 52 sem) → **"The AI family wall"** (testimonios en video) → **"Two ways to own it"** (2 tiers, US$1.497) → countdown de cohorte → garantía **"Show up and build. If it doesn't deliver, you don't pay."** → "Your move."

## §4 · Qué tiene FounderOS que Satori NO — recalibrado
| # | Capacidad | Estado en Satori | Impacto | Conf. |
|---|---|---|---|---|
| 1 | **Optimal Engine**: ingesta (voz/doc) + pgvector + destilado + grafo clickeable | `_cerebro/` tiene ingesta (captura-cerebro) y wikilinks, pero **sin grafo visual ni capa semántica pgvector/destilado** | Alto | 8/10 |
| 2 | **Org chart visual de la flota propia** (Conductor→Crews→Agentes→Tools) | Satori TIENE la flota (Círculo/Consejo/Equipo 75/Bastión/Sato) pero **solo texto, on-demand, sin router único ni vista** | Alto | 8/10 |
| 3 | **Dogfooding: Satori se corre a sí mismo** (Social/Funnel/Finances/Content propios) | Todo apunta a clientes; sin cockpit propio | Alto | 8/10 |
| 4 | **Aparato comercial** (calc. costo-inacción, garantía reversión, family wall, 2 tiers, urgencia) | KAIROS tiene sistema de recepción de 5 etapas pero **sin estas piezas de conversión** | Alto | 9/10 |
| 5 | **Tools productizadas que "shippean"** (5 flagship + 15) | Satori tiene tablero/SGIC/cierre pero **bespoke, no empaquetados/vendibles** | Alto | 7/10 |
| 6 | **Funnel/CRM propio** con decay + MRR | Gestiona CRMs de clientes (Kommo LC Travel); el propio no está | Medio | 7/10 |
| 7 | **Finance personal + net worth** | Fuerte en fiscal de clientes; propio no | Medio | 6/10 |

**Lo que Satori tiene y FounderOS NO (para no sobre-indexar):** aislamiento de tenant + Bastión (FounderOS son todos negocios PROPIOS del operador → no tiene capa de seguridad de datos de terceros), Purga adversarial, Consejo multi-modelo, ejecución supervisada, compliance fiscal ES+AR verificado, árbol de stack con gates legales, y la capa interior/estructura. **Satori es más maduro en gobernanza y en servir a terceros; FounderOS es más maduro en correrse a sí mismo, en la capa semántica del brain y en empaquetar/vender.**

**80/20 (sin cambios de fondo, más afilado):** los 3 gaps que dan el 80% son **#1 Optimal Engine (brain visual + semántico)**, **#3 Dogfooding / Satori HQ** y **#4+#5 Aparato comercial + kits productizados**. Los tres alinean con los valores Satori (el líder es la palanca; estructura y espíritu; transformación no dependencia).

## §5 · Steelman / Pre-mortem (actualizado)
**A favor:** el reel prueba que el patrón "carpetas + Claude Code + MCP + brain visual + flota de agentes + aparato comercial" es vendible y ya monetiza. Satori tiene ~70% del andamiaje; falta la cara visible del brain, la capa semántica, y la vuelta sobre sí mismo.
**Pre-mortem:** (1) **Dispersión** — 7 gaps a la vez roba paz (valor #8); mitigar con MoSCoW y un bloque por vez. (2) **Copiar taxonomía ajena** (PARA) rompe el MOC/INBOX que ya funciona; adoptar el *visor y la capa semántica*, no la taxonomía. (3) **Sobre-automatizar** flota sobre datos de cliente sin Bastión/Purga = errores en piloto automático; los workspaces programados arrancan SOLO sobre datos propios. (4) **Productizar antes de estabilizar** replica deuda; kit recién sobre lo repetido ≥2 veces.
**2º orden:** si Satori se corre como corre a sus clientes, gana el mejor caso de venta (dogfooding) — pero expone que hoy no lo hace. Encuadrarlo como dogfooding, no como vergüenza operativa.

## §6 · Roadmap (MoSCoW + T-shirt) — brief de A corregido
**MUST**
- **A · Optimal Engine de Satori** (antes "Cerebro Visual"). T-shirt **M→L**. No es solo visor: (a) grafo HTML que lee el markdown de `_cerebro/` (MOC + `[[wikilinks]]` + frontmatter) como nodos clickeables — esto es la M; (b) opcional fase 2: capa semántica (embeddings/pgvector) + destilado en clusters como el "distilled notes" de FounderOS — esto lleva a L. Empezar por (a): estático, satori-design registro operativo, sin datos de cliente → Bastión verde. **Arranque recomendado.**
- **B · Satori HQ (dogfooding).** T-shirt **L**. Cockpit propio: **funnel propio = el sistema de recepción KAIROS hecho tablero** (First Touch→…→Cliente, con los 11 candidatos), hilos de clientes activos agregados, finanzas propias + net worth, feed del Cerebro, social/content propio. Stack lo decide `stack-satori` (probable Supabase).

**SHOULD**
- **C · Aparato comercial KAIROS.** T-shirt **S-M**. Portar del landing de FounderOS a la Etapa 4 (Propuesta de Valor) de KAIROS: **calculadora de costo-de-no-hacer**, **garantía de reversión de riesgo**, prueba social. Cero stack nuevo; es contenido + un HTML.
- **D · Vista de la flota Satori (org chart).** T-shirt **M**. Renderizar Círculo/Consejo/Equipo/Bastión/Sato como org chart visual con tools por agente. Ata con A.
- **E · Workspaces programados.** T-shirt **S-M**. Digests advisory → tareas programadas (create_trigger), solo datos propios al inicio.

**NICE**
- **F · Satori Kits** (productización): tablero/SGIC/cierre → kits reutilizables/vendibles, recién sobre lo repetido ≥2 veces. **G · Finance personal + net worth.** **H · Empaquetado portable** (Satori OS vX versionado).

## §7 · Seguridad (Bastión) — veredicto
- El `mcp_token` del link sigue siendo token de **funnel de marketing** (no MCP): no da acceso a nada más que la landing, pero **te identifica** — no lo pegues público.
- **No conectar ningún "MCP" de FounderOS**: no expone endpoint MCP real ni está en el registro de conectores. Si aparece, pasa por Bastión (autor, scopes, qué toca) antes — protocolo cadena de suministro.
- Dato: FounderOS **usa OpenClaw** (tmux/broadcast). Satori lo tenía **descartado ("rojo")** — no es razón para readoptarlo; solo registrar que el vecino lo corre local-first.
- Regla de roadmap: **ningún workspace programado toca datos de cliente** hasta Purga + Bastión. Bloques A/C/D/G = datos propios → verdes. B/F tocan datos de cliente → gate obligatorio.

## Artefactos
| Artefacto | Puntero |
|---|---|
| Este handoff | `HANDOFF-FounderOS-v2.md` (reemplaza v1) |
| Dashboard | `satori-vs-founderos-v2.html` |
| Fuente | 2 videos en `SatoriOS/FOUNDER OS/` (GRABACIÓN REEL FOUNDER.MP4 = app real @bennettx.ai · GRABACIÓN FOUNDER OS.mov = landing thefounderos.com) |

## Desvíos / límites de esta etapa
- **Audio: transcrito (v2.1)** — lo pasaste vos y confirmó todo + sumó 4 puntos (GBrain, Hermes harness, 6 deptos, taxonomía SOP/autonomía). El intento automático falló por bloqueos del sandbox; para futuros audios, instalá el modelo de Minutes una vez (`minutes setup --model small`).
- Análisis 100% sobre las capturas de tus 2 videos + el copy público. No hubo acceso a la app en vivo (requiere pago/cohorte).

## Apéndice — Decisiones y descartes (heredado + nuevo)
- **Descartado:** adoptar PARA como taxonomía del Cerebro (el MOC/INBOX ya funciona; se adopta el visor + la capa semántica, no la taxonomía).
- **Descartado:** perseguir los 7 gaps (dispersión / costo en paz).
- **Nuevo:** no readoptar OpenClaw por el solo hecho de que FounderOS lo use.

## Changelog
- **v2.1 (01/08/2026):** transcripción del audio (la pasó Luciano) confirma el análisis y suma: 6 deptos canónicos, brain sobre **GBrain**, conductor = **Hermes harness**, y la taxonomía **SOP + skill-file + autonomía (human-led/assisted/autonomous)** que mapea 1:1 con la **escalera de maduración** de Satori. Narración a conf. 9/10.
- **v2 (01/08/2026):** re-análisis con los 2 videos. Corrige identidad (Bennett Spooner), arquitectura real (Operator→Conductor→Crews→Agentes→Tools, local-first), brain como Optimal Engine (pgvector+Obsidian+destilado), multi-negocio, y suma el aparato comercial. Afina el roadmap (brief de A, agrega C y D).
- v1 (31/07/2026): benchmark inicial solo con copy público.
