# Plan de integración — "Jarvis OS" de @_no_hype_ai → Satori OS

> Fuente: `informe-no_hype_ai-sistema-jarvis.md` + `transcripciones-no_hype_ai.md` (19 reels). Para aprobar antes de ejecutar. Fecha: 2026-06-16.

## BLUF
El caso es un **OS agéntico personal idea→ejecución** (capturar idea → clasificar barato → 1 gate humano → equipo de sub-agentes ejecuta y mantiene). **Satori OS ya tiene ~70% de esa arquitectura** construida (cerebro, Director, Salud, 13 agentes, cola+triggers, gate de aprobaciones, Haiku barato vía Bastión, control mobile). Lo genuinamente nuevo y valioso a integrar es **la puerta de entrada**: un **inbox único de captura** + un **clasificador Haiku con confianza** que rutea inputs y te escala cuando duda. Más prácticas gratis (higiene de contexto). **No copiamos el stack (Obsidian/cron/Telegram) — robamos el contrato de datos y el reparto de modelos.**

## Lo que Satori OS YA tiene (no reimportar)
| Mecanismo de Liam | Equivalente en Satori OS (post-E8a) |
|---|---|
| Segundo cerebro (vault Obsidian) | **Cerebro por cliente** (`nodos`/`aristas`/`cerebro_log`/`estado_actual`/`objetivos`) + `Cerebro_index` |
| Clasificador Haiku barato | **Bastión + `llamadaAPI(Haiku)`** (anonimiza + costea); `analizador-video-instagram` ya hace triaje con score |
| Cron cada 15–60 min | **Triggers** `corridaDiaria` (07:00) + `drenarCola` (5 min) + tareas programadas Cowork |
| PM → sub-agentes | **Director** (orquesta, encola por objetivo) + **Equipo Agentes Pro** (on-demand) |
| Mantenimiento / upkeep | **Loop de Salud** (6 chequeos, alerta-no-arregla) |
| Gate humano único | **Aprobaciones** (default-deny) + **ejecución-supervisada (AREL)** |
| Interfaz mobile / Telegram | **Command Center** web app **mobile-first** (control desde el iPhone) |
| Deep-review / crítico | **Consejo** (multi-modelo) + **Purga** (auditoría adversarial) |
| `CLAUDE.md` raíz | `ARCHITECTURE.md` + `HANDOFF.md` + memoria |

**Conclusión:** no hay que reconstruir nada de esto. Liam mismo admite que su ejecución/mantenimiento "craps out" — vos tenés esa capa más sólida.

## Lo aplicable (lo que falta) — para qué te sirve
| # | Item | Qué es | Para qué te sirve | En Satori hoy | Prioridad | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | **Inbox único de captura** | Un solo lugar donde tirás todo (voz-a-texto, link, nota, idea, pendiente, lead) y dispara el procesamiento | Dejás de perder ideas y tareas en mil lados; una sola bandeja mental → estructura | No existe (captura dispersa) | **MUST** | S–M |
| 2 | **Clasificador Haiku con confianza + escalate** | Agente barato que lee cada input y decide el "bin" (proyecto/tarea/idea/referencia/cliente/lead/no-entiendo), con **confianza 1-10**; si duda, te **escala** | El criterio del front-door: rutea solo lo claro, te molesta solo con lo dudoso. El "fusible anti-slop" | Parcial (solo para videos IG) | **MUST** | M |
| 3 | **Separar ideas vs ejecución + índice raíz** | Un "vault" de ideas/backlog separado de lo activo, con un índice maestro | Evita el slop por desorden; sabés qué es idea y qué está en marcha | Parcial (`ARCHITECTURE`/`HANDOFF`, pero no para tus ideas) | **SHOULD** | S |
| 4 | **Requirements doc como contrato de ejecución** | Formalizar el "plan ratificado por vos" como artefacto repetible antes de ejecutar | Un solo punto de decisión tuyo, con contrato claro → menos retrabajo | Casi (lo hacés con `HANDOFF`/`ETAPA-PLAN` + AREL, sin formalizar) | **SHOULD** | S |
| 5 | **PM persistente que MANTIENE** | El patrón "VP del proyecto": no solo construye, sostiene (upgrades, métricas, scraping) | Para Satori **ERP** el mantenimiento del cliente en el tiempo es lo más valioso (retención, S2/S6) | Parcial (Director + Salud, no persistente como interfaz) | **SHOULD** | M–L |
| 6 | **Higiene de contexto en Claude Code** | Status bar de 150k tokens + hook de tokens + `/rename` de sesiones | Mejora **todo** nuestro trabajo de build (menos alucinación, swaps a tiempo). Gratis, hoy | No | **NICE (hoy)** | XS |
| 7 | **SOP "preparar el terreno"** | Limpiar/ordenar + poner índice raíz por cliente ANTES de meter agentes | Pre-requisito multi-tenant: sin árbol limpio, los agentes producen slop | Implícito | **SHOULD** | S |
| 8 | **Capa always-on (daemon) + Hermes/OpenClaw** | Daemon continuo para upkeep/analytics fuera de sesión | Operación 24/7 real sin que dispares vos | No (session-bound) | **NICE — DIFERIR** | L + riesgo |

**80/20:** los items **1 + 2** (inbox + clasificador con confianza) son el 20% que da el 80%: convierten tu ecosistema de skills en un OS con **entrada, criterio y memoria**. Lo demás es refinamiento o diferible.

**Riesgo marcado (#8):** el daemon always-on es el deseo de Liam pero también su miedo ("get hacked"). En Satori **pasa por Bastión** antes que nada. Diferir hasta tener 1+2 andando.

## Decisión clave (fork) — necesito tu definición
¿Dónde vive el inbox+clasificador?
- **A) Capa personal tuya** — capturás TUS ideas/tareas/leads (sobre clientes, Satori, vida). Dogfood. *(Recomendado primero.)*
- **B) Por cliente** — cada cliente tiene su bandeja de inputs que se clasifican a su cerebro/objetivos/tareas. Extiende el ERP.
- **C) Ambas** — dogfood en A, después producto en B.

Recomiendo **A primero** (es el mejor piloto y la mejor demo; sin riesgo de cliente), y B como evolución.

## Plan de ejecución (fases)
**Fase 0 — gratis, hoy (no necesita aprobación de alcance):**
- Higiene de contexto en Claude Code (#6) · SOP "preparar terreno" (#7) · adoptar el requirements-doc como práctica (#4). Cero código nuevo en Satori OS.

**Fase 1 — el 80/20 (inbox + clasificador), dogfooded en Satori (A):**
1. **Contrato de datos (1 página, lo definís vos conmigo):** taxonomía de bins, umbral de confianza que escala, dónde cae el input, cómo te escala, tu único checkpoint.
2. **Skill clasificadora** (Cowork la diseña, reusa la lógica de `analizador-video-instagram` + `llamadaAPI` Haiku).
3. **Porte a GAS** (Claude Code): pestaña/carpeta `_inbox` + trigger que dispara el clasificador + escritura de `destino`+`confianza`+`slug`+tags + `escalate` → aviso en el Command Center (o Telegram si lo querés).
4. **Verificar + Purga** antes de cerrar.

**Fase 2 — orden:** separar ideas/ejecución + índice raíz (#3).

**Fase 3 — profundidad:** PM persistente que mantiene (#5), sobre Director/Equipo/Salud.

**Backlog / diferido:** daemon always-on (#8) tras Bastión · empaquetar como **servicio** (ver abajo).

**Roles:** Cowork diseña/planifica + skill + verifica/purga · Code porta a GAS · vos definís el contrato de datos y aprobás.

## Ángulo de negocio (bonus, no urgente)
Todo esto es **empaquetable como servicio KAIROS**: *"te instalo tu segundo cerebro operativo + pipeline idea→ejecución con un solo punto de decisión tuyo."* Entregable nítido para dueños saturados de ideas/tareas. Encaja con la tesis Satori (bajar el ruido mental del líder a una estructura que sostiene). **Dogfooding primero** (Fase 1) = piloto + demo. Validar: cuánto aguanta el ruteo por confianza sin que corrijas, y la seguridad de cualquier capa always-on.

## Qué apruebo / qué necesito
**Recomendación:** aprobar **Fase 0 (ya) + Fase 1 (el 80/20)**. El resto queda en backlog priorizado.
**Para arrancar Fase 1 necesito de vos:** (a) el fork A/B/C, (b) la taxonomía de bins ajustada a tu mundo, (c) el umbral de confianza para escalar, (d) cómo querés que te escale (Command Center / Telegram), (e) tu único checkpoint.

¿Aprobás Fase 0 + Fase 1 así, o ajustás el alcance?
