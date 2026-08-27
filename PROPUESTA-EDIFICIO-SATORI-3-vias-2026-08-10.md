# EDIFICIO SATORI — las 3 mejores vías de integración en Satori OS
**Fecha:** 10/08/2026 · **Autor:** Cowork (Círculo + Equipo Pro D2/D4/D7/D8 + Bastión en guardia) · **Estado:** propuesta para decisión de Luciano

---

## BLUF

Las 3 vías son **etapas del mismo camino**, no alternativas excluyentes: **(1) el Edificio como nueva superficie visual del OS con datos reales y agentes bajo demanda (costo API ~0, T-shirt M-L, arrancar YA)** → **(2) el "pulso vivo": corridas programadas por piso sobre los rieles de presupuesto que el OS ya tiene (≈ $3-8 USD/mes, T-shirt M)** → **(3) HQ 24/7 en dominio propio con PWA real y worker en la nube (XL, gates Bastión + Consejo, NO ahora)**. Recomendación: aprobar 1, planificar 2, diferir 3 con gatillo. Confianza 8/10.

**⚠ Diferencia detectada con tu recuerdo (antes de avanzar, como pediste):** "lo de Hermes" NO era un servicio para mantener agentes 24/7 en la nube. Es **Hermes Agent de Nous Research**, un harness self-hosted que investigamos a fondo el **29-jun** (`Handoffs/2026-06/2026-06-29 - deep-research-hermes-gap-satori-os.md`). Las decisiones cerradas de esa sesión: Hermes = **competidor indirecto, no modelo a copiar**; sus 5 ideas valiosas (#1-#5: memoria caliente/fría, security-scan, auto-mejora con consentimiento, SOUL, auto-skills) quedaron **gateadas a Etapa 8+**; y el **daemon always-on está en la lista de DESCARTADOS "NO re-proponer"** (REPASO 17-jul §P8), con el VPS/nube 24/7 gateado a "voz fuera del Mac / multi-cliente". La Opción 3 de este informe es la forma correcta de reabrir eso SI algún día se justifica — no lo reabro por mi cuenta.

---

## 1 · Qué se analizó (fuentes leídas, no supuestas)

| Fuente | Qué aporta |
|---|---|
| **Post IG "I turned Claude into a startup"** (8 slides) | La metáfora del edificio por pisos con laterales despejados + un dashboard tipo "command center" por área (CEO, Marketing, Sales, Support, Finance, Engineering, Operations) con KPIs arriba, feed de actividad, semáforo "AI AGENT ACTIVE" y flujo de 3-5 pasos al pie. |
| **Video "MUESTRA DE NUEVA FORMA DE OFICINA"** (reel @ajsahni.ai, 78s, 20 frames extraídos y leídos) | La versión **isométrica 3D**: plateas flotantes por departamento, agentes como personajes en escritorios con etiqueta (TECH SUPPORT, BILLING, PROSPECTOR, INVOICING…), **chips de conectores por departamento** (Xero, PandaDoc, Stripe, RevenueCat, Perplexity, Gmail, Jira, Meta Ads, Canva, Beehiiv…), panel lateral por área con contador de agentes + RECENT ACTIVITY con estados WORKING, **triángulos de alerta** sobre agentes con problemas, chat con cada agente, y una **nebulosa/grafo central** conectando las plantas. Es un funnel de registración ("Comment Agents"), mismo trend que FounderOS. |
| **Flota Satori (`FLOTA.html`, adjuntaste el HTML)** | Los 68 nodos reales: Sato (1) · Agentes del OS (9: 7 vivos + Lift y 8 runners lab diferidos) · Círculo (20: 5 núcleo + 13 banco + 2 agregados) · Consejo (6) · Equipo Pro (25 especialistas × células de 3 = 75) · Bastión (7). Verificado contra el archivo: 1+9+20+6+25+7 = **68 tarjetas** ✓. |
| **Satori OS actual** | Prod `/exec @37` (GAS + Sheets, multi-tenant). Ya tiene: CM, **Akasha (vista 3D con three.js r128 YA embebido en el repo)**, Ficha 360, kanban, Sato voz, y — clave para esto — **los rieles de presupuesto de agentes ya construidos**: `Costos_API` por cliente/módulo, `guardPresupuesto_` fail-closed, cola `encolarAgente`, avisos 80/95/100%, `api_budget_mensual_usd` (hoy 25 USD global), modelo por rol vía Config. |
| **Benchmark FounderOS v2** (`SatoriOS/FOUNDER OS/HANDOFF-FounderOS-v2.md`, 01-ago) | Este patrón YA está estudiado: org chart de flota (Bloque D → **hecho**, es FLOTA.html), brain visual (Bloque A → **hecho en v1**, GRAFO.html + grafo-en-Despacho vivo), workspaces programados (Bloque E → pendiente), Satori HQ dogfooding (Bloque B → gated). **El post IG y el video son la 3ª y 4ª instancia del mismo trend que ya benchmarkeamos. No se rehace el estudio; se construye sobre él.** |
| **Deep research Hermes** (29-jun) | Ver BLUF. Siempre-on descartado; lazo con aprobación sí (Etapa 8+). |

**Lectura estratégica (D4 + Círculo):** lo nuevo que piden el post y el video **no es capacidad de agentes** (eso Satori lo tiene más gobernado que ambos referentes) sino **superficie visual**: la organización *visible*, navegable y con sensación de vida. El 80/20: **el 80% del efecto lo da el edificio + dashboards con datos reales; el costo de tokens de "correr todo constantemente" compra solo el 20% restante** (la sensación de actividad), y hay forma de lograr esa sensación sin quemar tokens (ver Opción 1).

**Realidad de la flota (el dato que ordena todo el análisis):** de los 68, solo los **7-9 agentes runtime del OS** consumen API cuando corren (y ya corren 24/7 vía triggers de GAS — el trigger es gratis; se paga solo la llamada IA puntual, con tope fail-closed). Los otros ~59 (Círculo, Consejo, Equipo Pro, Bastión) son **personas-skill que viven en Cowork**: piensan cuando se los convoca en sesión, no tienen runtime propio. "Correrlos constantemente" en la nube significaría inventarles un runtime que hoy no existe, para producir análisis sin ground truth — exactamente el modo "confiado en lo incorrecto" que descartamos al estudiar Hermes. El edificio puede mostrarlos **en guardia** (estado real: última misión, división, célula) con total honestidad y costo cero.

---

## 2 · Las 3 vías

### Opción 1 — EDIFICIO SATORI: la torre como nueva superficie del OS (datos reales, agentes bajo demanda)

**Qué es.** Una vista nueva del Satori OS: la **torre isométrica con laterales despejados**, un piso espacioso por área de Satori A&C, los 68 agentes distribuidos en sus plantas como puestos de trabajo. Click en un piso → la planta se abre (como el video); click en un agente → **su dashboard individual** replicando la estructura del post IG (header del área, KPIs arriba, misión + tools + célula A1/A2, feed de actividad, semáforo). Los datos son **reales donde existen** (hojas `Actividad`, `Consumo_agentes`, `Costos_API`, `Salud`, feed del Director, colas y aprobaciones) y **roster + estado de guardia** donde no. El grafo/nebulosa central = el Cerebro (GRAFO ya existe con la estética del CM — continuidad directa).

**Cómo (D7 — arquitectura, sin codear todavía):**
- **Vanilla GAS-compatible** (regla 1 de satori-design). Dos caminos de render, a decidir en el encargo: (a) **isométrico CSS/SVG** (transform 2.5D, liviano, estilo del video) o (b) reusar **three.js r128 que ya está en el repo** por Akasha (torre 3D real, estilo slide 1 del post). Recomiendo (a) para v1: menos deuda, corre en iPhone, y Akasha ya cubre el "wow 3D".
- **Datos:** un `FLOTA.json` (el roster del HTML que adjuntaste, ya completo) + endpoints read-only existentes (`ENDPOINTS_UI`) para actividad/costos/salud. Cero schema nuevo obligatorio; a lo sumo una hoja `Flota` si queremos editar el roster desde Sheets.
- **Dashboards por agente:** un solo componente-panel parametrizado (patrón del `#tdboard` de BLOQUE 4), no 68 pantallas. Runtime agents muestran corridas reales; personas-skill muestran misión, tools, célula y últimas intervenciones registradas.
- **Diseño (gate satori-design, declarado):** registro **operativo** (quien lo usa sos vos, no un visitante), densidad regular, dark, tokens de `tokens-base.md` — jade `#4FB89C` + gold `#D4A857` en continuidad con FLOTA/GRAFO/CM. Un acento dominante; los colores por cuerpo ya definidos en FLOTA.html se mantienen. Nada del naranja/negro del post: se toma la **estructura**, no la piel (la piel es de Satori).

**Pros:** costo API **≈ $0** · todo el valor visual del post y el video · construye sobre B.D (FLOTA) y B.A (GRAFO) ya certificados · sin cambio de postura de seguridad (misma Web App DOMAIN) · Bastión verde (datos propios, read-only) · apta para heredar la técnica de capa móvil aditiva (la vista nueva trae su propio bloque `@media`, patrón v1-v3).
**Contras:** los agentes no "hacen" nada nuevo — el edificio muestra, no ejecuta · sin corridas programadas nuevas, el feed de los pisos no-runtime se mueve poco.
**T-shirt:** M-L (2 encargos a Code: torre+pisos · panel-agente+wiring de datos).

### Opción 2 — ORGANIZACIÓN VIVA: el edificio + pulso programado por piso (consumo moderado, fail-closed)

**Qué es.** La misma torre, pero cada piso late: **corridas programadas** que producen actividad real y alimentan los feeds. Es exactamente el **Bloque E del roadmap FounderOS (workspaces programados)** aplicado al edificio, sobre rieles que ya existen:
- **Piso Dirección:** el Director ya corre diario (brief, North Star). Se muestra, no se construye.
- **Piso Finanzas & Fiscal:** corrida semanal del Admin propia + resumen por jurisdicción (ya existe `31_admin.js`; se agenda y se expone).
- **Piso Research / Comercial / etc.:** 1 misión programada por semana por división activa del Equipo Pro (vía `create_trigger` de Cowork — Routines en la nube, NO cron local — o `encolarAgente` en GAS según el caso), con entregable a la Bandeja y actividad al feed del piso.
- **Todo pasa por los rieles existentes:** `encolarAgente` → `guardPresupuesto_` fail-closed → `Costos_API` → avisos 80/95/100%. Presupuesto **por partida/piso** (el diseño de partidas ya está escrito en el encargo Esquema v5). Modelo default **Haiku 4.5**, Sonnet solo para análisis pesados puntuales.

**Números (verificados hoy contra pricing vigente — fuente al pie):**
- Haiku 4.5: **$1 in / $5 out por millón de tokens**. Corrida típica (~4k in / 0,8k out) ≈ **$0,008**.
- Sonnet 5: $2/$10 (promo hasta 31-ago; estándar $3/$15). Corrida de análisis (~8k in / 1,5k out) ≈ **$0,03**.
- **Escenario "pulso" recomendado:** ~10 corridas Haiku/día + ~2 Sonnet/día ≈ **$0,14/día ≈ $4-5/mes**. Con margen y semanas cargadas: **$3-8/mes**. Entra holgado en el tope de $25 ya configurado. Batch API (−50%) aplicable a todo lo programado no-urgente.
- **El contraejemplo que responde tu pregunta literal:** correr los 68 "constantemente" (cada 5 min, 24/7) ≈ 68 × 288 corridas/día × $0,008 ≈ **$150+/día**. Ese modelo queda descartado por absurdo — y por diseño: actividad sin encargo real = ruido sin ground truth.

**Pros:** el edificio queda VIVO de verdad (feeds reales, semáforos que cambian, alertas tipo el triángulo del video) · costo moderado y **con techo duro ya construido** · reusa Bloque E pendiente del roadmap (dos pájaros) · escalera natural hacia el Esquema de Agentes por Cliente (diseño cerrado 25-jul, construcción no iniciada) cuando toque.
**Contras:** requiere decidir qué corridas aportan valor real (no actividad decorativa — la Silla Vacía vigila esto) · cada corrida nueva es contenido a supervisar en Bandeja/aprobaciones · misiones sobre datos de cliente = gate Bastión + Purga (al inicio, **solo datos propios**, guardrail firme del §7 FounderOS).
**T-shirt:** M (los rieles existen; es agendar, exponer y presupuestar por piso).

### Opción 3 — SATORI HQ 24/7: dominio propio + PWA real + worker en la nube (la vía "Hermes-like", con gates)

**Qué es.** La versión completa del video: la torre como **app propia** (PWA real con ícono/fullscreen/push — Opción C del análisis PWA del 08-ago), shell en dominio propio (Netlify/CF, patrón Taller ya desplegado el 03-ago) llamando a GAS como API, un **worker con cron en la nube** para lo que deba correr sin tu Mac, y chat-por-agente en cada piso (como el video). Es también la puerta a Satori HQ (Bloque B, dogfooding) y al Esquema por Cliente con portal.

**Pros:** app de verdad, 24/7 real sin depender del Mac, push, distribución, chat contextual por agente.
**Contras (pesados):** cambia la **postura de seguridad** del MAESTRO (DOMAIN → Anyone+token; el token es credencial: rotación, jamás en claro — Bastión CRÍTICO a diseñar antes) · refactor grande (`google.script.run` → fetch API JSON) · **choca con dos decisiones vigentes** (daemon always-on descartado; VPS/nube 24/7 con gatillo propio) — reabrirlas es decisión de Consejo, no default · costo de obra XL para ganancia mayormente de forma mientras 1 y 2 no estén exprimidos.
**T-shirt:** XL. **Gatillo para reabrir:** multi-cliente real usando el OS / voz fuera del Mac / Bloque B aprobado — o decisión explícita tuya en Consejo.

---

## 3 · Comparativa y veredicto

| Opción | Valor que entrega | Costo API/mes | Obra | Seguridad | Veredicto |
|---|---|---|---|---|---|
| **1 · Edificio (superficie)** | 80% del efecto visual del post+video, dashboards por agente con datos reales | ~$0 | M-L | Verde (Bastión) | **Aprobar y arrancar YA** |
| **2 · Pulso programado** | Organización viva: feeds, semáforos, misiones semanales | $3-8 (techo $25 ya vigente) | M | Verde con guardrail (solo datos propios al inicio) | **Planificar como etapa 2** (= Bloque E) |
| **3 · HQ 24/7 nube** | App real, push, chat por agente, sin Mac | $5-15 + infra ~0 (CF free) | XL | **Gate Bastión + Consejo** (cambia postura MAESTRO) | **Diferir con gatillo** |

**Camino recomendado: 1 → 2 → (gatillo) → 3.** La 1 y la 2 son compatibles con TODO lo vigente (roadmap FounderOS bloques D/A/E, decisiones de seguridad, rieles de presupuesto) y no reabren nada descartado. La 3 queda documentada y con gatillo claro, no muerta.

**Pre-mortem (por qué podría fracasar):** (a) *dispersión* — el edificio compite por foco con re-push v3, BLOQUE A t3 y F4a facturas; mitigación: es UN encargo a Code por vez, después del re-push pendiente. (b) *Edificio decorativo* — si en 3 meses nadie lo abre, fue arte; mitigación: entra como vista del CM que ya usás a diario, no como página aparte. (c) *actividad-teatro en la Opción 2* — corridas que nadie lee; mitigación: cada corrida programada nace con destinatario (Bandeja/brief) y se poda a los 30 días si no se consume.

> 🔵 **La Silla Vacía** — El edificio es para VOS (y como demo de venta es oro: "así trabaja mi organización"). Pero ojo al orden: la cartera real hoy son 3 clientes pagando ~€1.322/mes y el Bloque C comercial sigue pendiente por decisión tuya. Un piso "Comercial" vivo (Rainmaker + los 11 candidatos KAIROS) convertiría este juguete en pipeline. Considerá que la primera misión programada de la Opción 2 sea comercial.

---

## 4 · Mapeo de pisos (propuesta — los 68 presentes, cero afuera)

Mapeo **funcional** (como el post IG: pisos = áreas del negocio), con el cuerpo de origen como etiqueta transversal:

| Piso | Área Satori A&C | Quiénes (origen) |
|---|---|---|
| P8 · Penthouse | **Dirección** (4) | Sato (interfaz) · Director (runtime) · D1 Jefe de Gabinete + Archivista Mayor |
| P7 | **Consejería** (25) | Círculo (19 — el Rainmaker baja al P6) + Consejo de Asesores (6) — sala de consejo con mesa, no escritorios |
| P6 | **Comercial & Marketing** (4) | Rainmaker (cross-asignado del Círculo) · D8 Redactor/Diseñador/Analista de Contenido · funnel KAIROS (11 candidatos como pipeline del piso, datos no agentes) |
| P5 | **Finanzas & Fiscal** (4) | D6 Analista Financiero/Fiscal ES-AR/Controller · Admin propia (runtime) — Fiscalistas AR/ES del Círculo con cross-tag |
| P4 | **Research & Inteligencia** (6) | D2 (3) + D3 (3) |
| P3 | **Desarrollo & Automatización** (10) | D7 (3) + runtime del OS: Salud, Bandeja, Cerebro, Vigilancia, Conectores (5) + Lift y 8 runners lab con placa "⚠ diferido" (2 puestos), como en FLOTA |
| P2 | **Operaciones & Procesos** (5) | D4 Análisis de Proyectos (3) + D9 (2) |
| P1 · Planta baja | **Seguridad** (10) | Bastión (7) + D5 (3) — lobby con control de accesos, literal |
| Núcleo central | **Cerebro** | La nebulosa/grafo (GRAFO.html) atravesando la torre, como en el video |

(Suma verificada: 4+25+4+4+6+10+5+10 = **68** — todas las tarjetas de FLOTA presentes, sin duplicar al Rainmaker. Los 11 candidatos KAIROS entran como datos del pipeline del P6, no como agentes.)

Los conectores por piso (como el video): P5 → Sheets/gestoría; P6 → IG/monitor; P3 → GAS/clasp/GitHub; P8 → Voz/CM. Solo se muestran los que EXISTEN — nada de logos decorativos de servicios no conectados.

---

## 5 · Reparto de ejecución (ejecución supervisada)

**Cowork (yo) puede hacer ya, sin tocar producción:** maqueta navegable del edificio (v0 estática con el roster real de FLOTA) · `FLOTA.json` · el plano/encargo completo para Code con asserts y casos de render · el diseño de las corridas de la Opción 2 con su presupuesto por partida.
**Claude Code (encargo, cuando apruebes):** integrar la vista al `index.html` del OS (patrón capa aditiva, como la UI móvil) · wiring a `ENDPOINTS_UI` read-only · asserts + selfTest · commit/clasp push → tu eyeball en `/dev` → promote.
**Vos (solo aprobación/seguridad):** (1) elegir la vía (o confirmar el camino 1→2→gatillo→3) · (2) aprobar el mapeo de pisos §4 · (3) en su momento, aprobar el push/promote como siempre. Nada más — no hay pasos manuales tuyos en la construcción.

**Nota de agenda (no bloqueante pero primero):** sigue pendiente el **re-push de UI-móvil v3 → promote @38** (Code) — conviene cerrarlo antes de abrir este frente para no apilar dos working trees.

---

## 6 · Fuentes y verificación

- Pricing API verificado hoy contra la **fuente oficial** [platform.claude.com/docs — Pricing](https://platform.claude.com/docs/en/about-claude/pricing): Haiku 4.5 **$1/$5** · Sonnet 5 **$2/$10 hasta 31-ago-2026, $3/$15 desde 01-sep** (cifras cruzadas además con [BenchLM](https://benchlm.ai/anthropic/api-pricing): Batch −50%, cache hits 10%). Cifras de consumo = estimaciones propias sobre corridas típicas del OS; el techo real lo pone `guardPresupuesto_`, no la estimación. Confianza en el orden de magnitud: 8/10. **Ojo 2º orden:** desde septiembre Sonnet sube 50% — otro motivo para default Haiku en lo programado.
- Hermes: deep research propio 29-jun (fuentes primarias Nous Research + GitHub). Decisiones citadas textuales del handoff.
- FounderOS: benchmark v2 propio (01-ago) sobre los 2 videos.
- Video oficina: 20 frames extraídos con ffmpeg del MP4 en tu Downloads + transcripción que pasaste.
- Estado del OS: memoria del proyecto + HANDOFF 07-ago + repo `SatoriOS/src/` listado en vivo (los nombres de funciones/hojas de los rieles se re-verifican a nivel código al armar el encargo — conf 8/10, misma reserva que el handoff Esquema v5).

*Panel de observadores: sin hallazgos críticos. [Estratega de límites] · leve: este frente entra en cola detrás del re-push v3; no abrir dos frentes de UI en paralelo.*
