# PIPELINE.md — El motor idea→ejecución de Satori OS

> **Qué es:** el "sistema operativo" de cómo una idea pasa a proyecto ejecutado y mantenido. Es el **Track B (Método/Motor)** del plan v14. **Insight:** ~70% ya existe como skills sueltas o módulos del producto; el trabajo es **encadenar con estados**, no inventar. **Implementación:** nativa de Claude Code (Agent Skills + Task tool + CLAUDE.md + Scheduled Tasks), sin infra nueva.
> **Versión vigente ÚNICA: esta (raíz del repo `SatoriOS/`).** La copia de la carpeta consultoría es solo un puntero a este archivo (unificado 14-jul-2026, checkpoint D5).

## Estados de un ítem (la máquina)
Cada idea/tarea/proyecto vive en UN estado. La transición tiene un **disparador** explícito.

`Idea` → `Triada` → `Plan propuesto` → `Aprobada` → `Revisada` → `Validada` → `Proyecto activo` → `En ejecución` → `En mantenimiento`

El estado vive en el índice raíz (`CLAUDE.md` / `HANDOFF.md`), no en la cabeza de nadie. **Una fuente de verdad.**

## Las 10 fases

| # | Fase | Hace | Skill / módulo | Estado resultante | Disparador | Gap |
|---|---|---|---|---|---|---|
| 1 | Captura | Idea entra a un buzón único | `17_bandeja.js` (`capturar()`) | Idea | input de Luciano | definir buzón único |
| 2 | **Triage** | ¿proyecto / tarea / idea? | `clasificarBandeja()` (Haiku) | Triada | corre clasificador | **CERRADO 07-jul** (ver gaps) |
| 3 | Frontera cerebro↔máquina | decidir qué hace Cowork vs Code | loop Cowork×Code | (decisión) | al planear | formalizado en `CLAUDE.md` (Loop de trabajo) |
| 4 | Brainstorm→plan | research + plan propuesto | `equipo-agentes-pro` | Plan propuesto | "planeá X" | plantilla "plan propuesto" |
| 5 | Aprobar plan (human-in-the-loop) | Luciano aprueba | `ejecucion-supervisada` (AREL) | Aprobada | "avanzá" + **gate kevin 1** (≥96% confianza, preguntar edge-cases) | ya existe |
| 6 | Deep review paralelo | 1 subagente por fase, en paralelo | `purga` + `consejo` + `equipo` | Revisada | antes de cerrar + **gate kevin 2** (product-risk) | **correrlo ANTES, no solo al final** |
| 7 | Gates go/no-go por etapa | criterio de éxito por fase (TDD) | `puesta-en-marcha` | Validada | por etapa + **gate kevin 3** (code-review senior) | **aplicar por etapa, no solo go-live** |
| 8 | Promote | idea aprobada → proyecto activo | `handoff-proyecto` | Proyecto activo | `/promote` | disparador `/promote` |
| 9 | Ejecución | PM crea sub-agentes ejecutores | `equipo-agentes-pro` | En ejecución | proyecto activo | — |
| 10 | **PM persistente** | mantenimiento + resumen diario | Director/Salud + `briefDiario` | En mantenimiento | **cron nativo** (Scheduled Tasks) | **PM por cliente post-entrega** |

## Los gaps del motor (actualizado 14-jul-2026)
1. ~~Clasificador general (fase 2)~~ — **CERRADO 07-jul, re-verificado contra `src/17_bandeja.js` el 14-jul:** `clasificarBandeja()` ya triaga con bins `proyecto/tarea/idea/referencia/cliente/lead` + confianza 1-10 + `escalate` bajo umbral (`bandeja_umbral_confianza`). No construir de nuevo.
2. **PM persistente por cliente (fase 10)** — ABIERTO (checkpoint D7): el Director + `briefDiario` dan la base; falta el bucle de mantenimiento por cliente sobre cron nativo. Empata con Jarvis F3 y Kevin `DaQoZ9xRBT9`.
3. **Encadenado con estados** — ABIERTO (checkpoint D6): que cada fase escriba su estado en el índice y dispare la siguiente. Es orquestación, no código nuevo.

## Escalera de maduración (doctrina — plantada 14-jul-2026, checkpoint D1)

> **Nada se automatiza sin pressure-test manual.** (@_no_hype_ai `DaiXu6rOEHm` + AREL propio — validación cruzada.)

- **Nivel 0 — MANUAL:** se hace a mano con guion. *Gate de subida:* salió bien ≥2 veces reales.
- **Nivel 1 — SKILL/SOP:** el paso probado se escribe (input → pasos → criterio de éxito). *Gate:* corrió ≥3 veces sin corrección material.
- **Nivel 2 — CADENA:** skills encadenadas con estados (este PIPELINE); humano aprueba en los gates.
- **Nivel 3 — AUTOMATIZACIÓN:** trigger/cron la corre sola; default-deny en escrituras; test gates en runtime cuando haya agentes lab→prod (el Director revisa salidas contra slop).
- **Desescalada:** si un nivel 3 falla 2 veces seguidas → baja a nivel 2 hasta re-probar. Si una skill requiere corrección material → vuelve a manual.
- **Regla de oro:** el nivel de cada proceso se ANOTA (en su SOP/skill y en la tabla de abajo). **Proceso sin nivel declarado = nivel 0.**
- **Composición con Hermes (auto-skills):** el sistema puede PROPONER un SOP/skill tras una tarea multi-paso, pero solo como **borrador gateado** (cola de aprobación → sube por los gates de esta escalera). Jamás se auto-promueve. (Checkpoint D9, diseño; D4 criterio.)

## Niveles vigentes por proceso (checkpoint D2 — PROPUESTA 14-jul, corregir Luciano)

| Proceso vivo | Nivel | Evidencia del gate |
|---|---|---|
| corridaDiaria (brief + salud + costos + sync) 07:00 | 3 | trigger en prod desde jun; default-deny en escrituras |
| drenarCola (cada 5 min) | 3 | trigger en prod |
| sincronizarConectores (cada 8 h, Vehemence) | 3 | trigger instalado 13-jul (E1.2/T3) |
| backupSemanal (dom 04:00) + restore | 3 | drillRestore probado 06-jul |
| brief-push email (~07:00) | 3 | activo; llegada estable en verificación |
| Ciclo diario Oficina Virtual (launchd 07:00) + push sync-cm al CM | 3 | corrida real 13-jul + sync en vivo 14-jul; primer push automático en verificación |
| Observatorio OV (KeepAlive) | 3 | kill→revive verificado 13-jul |
| IG monitor (diario, USD 0) | 3 | 4 corridas consecutivas OK |
| Voz Sato (consultas + capturar + oficina_decidir) | 2 | cadena con gate conversacional obligatorio (confirmación antes de decidir); no sube a 3 por diseño |
| Aprobaciones / default-deny | 2 | gate humano POR DISEÑO — no sube |
| selfTest + promote /exec | 1 | scripts `_promote_exec.sh` + selfTest; humano dispara |
| Handoff de proyecto | 1 | skill corrida en cada cierre |
| Cierre mensual LC Travel | 1 | skill; corre con documentos del mes |
| Tablero de Reunión | 1 | chasis v1.0 verificado; smoke real pendiente → no sube |
| Informe Mensual KAIROS | 0 | manual; A2 (contrato de status report) lo lleva a 1 |
| Pipeline comercial B7 (mensajes, seguimiento) | 0 | manual con guiones (PAQUETE-EJECUCION); B1 lo instrumenta |

## Implementación nativa (el "cómo", validado §8 del UNIFICADO)
- **Cada fase = una Agent Skill** (progressive disclosure: ~100 tokens de metadata al inicio, cuerpo solo al activarse → muchas sin penalizar contexto). Se encadenan naturalmente.
- **Deep review (fase 6) = Task tool**: N subagentes en un solo mensaje, 1 por fase, **Haiku** en los chequeos mecánicos (10x cobertura, bajo costo); un master sintetiza.
- **Estado del pipeline = `CLAUDE.md` / `HANDOFF.md`** (sobrevive `/clear`, cierre y reinicio; walk-up).
- **Fase 10 (PM persistente) = Scheduled Tasks / Routines** (cron sin servidor; catch-up de corridas perdidas). **Hermes fuera del core; OpenClaw descartado** (Bastión).
- **Gates (5/6/7) = los 3 prompts de kevinfremon** + opción de hooks de Claude Code.
- **Anti-context-rot:** compressed handoff + sesión fresca al ~80% de contexto (no esperar al auto-compact).

## Estado de validación
- **Verificado:** las 6 skills citadas existen (catálogo de skills): `purga-de-errores`, `consejo-asesores`, `equipo-agentes-pro`, `ejecucion-supervisada`, `puesta-en-marcha`, `handoff-proyecto`. Módulos `17_bandeja`/`14_director`/`briefDiario` existen (HANDOFF). Gap 1 re-verificado cerrado (14-jul).
- **Pendiente (Code, contra el repo):** confirmar que cada skill *cubre* su fase (no solo que existe) + definir los disparadores `/promote` y el formato de estado en `CLAUDE.md`. Confianza del mapeo: **7/10**.
- **Anti-scope-creep (Ejecutor):** este motor mejora *cómo se construye*; NO frena el producto. Se opera en paralelo, no antes de terminar el sistema.
