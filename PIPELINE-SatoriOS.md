# PIPELINE.md — El motor idea→ejecución de Satori OS

> **Qué es:** el "sistema operativo" de cómo una idea pasa a proyecto ejecutado y mantenido. Es el **Track B (Método/Motor)** del plan v14. **Insight:** ~70% ya existe como skills sueltas o módulos del producto; el trabajo es **encadenar con estados**, no inventar. **Implementación:** nativa de Claude Code (Agent Skills + Task tool + CLAUDE.md + Scheduled Tasks), sin infra nueva.
> **Destino:** copiar a la raíz del repo `SatoriOS/` (lo armó Cowork desde el HANDOFF-UNIFICADO; Code valida la cobertura fase→skill contra el repo real).

## Estados de un ítem (la máquina)
Cada idea/tarea/proyecto vive en UN estado. La transición tiene un **disparador** explícito.

`Idea` → `Triada` → `Plan propuesto` → `Aprobada` → `Revisada` → `Validada` → `Proyecto activo` → `En ejecución` → `En mantenimiento`

El estado vive en el índice raíz (`CLAUDE.md` / `HANDOFF.md`), no en la cabeza de nadie. **Una fuente de verdad.**

## Las 10 fases

| # | Fase | Hace | Skill / módulo | Estado resultante | Disparador | Gap |
|---|---|---|---|---|---|---|
| 1 | Captura | Idea entra a un buzón único | `17_bandeja.js` (`capturar()`) | Idea | input de Luciano | definir buzón único |
| 2 | **Triage** | ¿proyecto / tarea / idea? | `clasificarBandeja()` (Haiku) | Triada | corre clasificador | **generalizar el clasificador** |
| 3 | Frontera cerebro↔máquina | decidir qué hace Cowork vs Code | loop Cowork×Code | (decisión) | al planear | formalizar en `CLAUDE.md` |
| 4 | Brainstorm→plan | research + plan propuesto | `equipo-agentes-pro` | Plan propuesto | "planeá X" | plantilla "plan propuesto" |
| 5 | Aprobar plan (human-in-the-loop) | Luciano aprueba | `ejecucion-supervisada` (AREL) | Aprobada | "avanzá" + **gate kevin 1** (≥96% confianza, preguntar edge-cases) | ya existe |
| 6 | Deep review paralelo | 1 subagente por fase, en paralelo | `purga` + `consejo` + `equipo` | Revisada | antes de cerrar + **gate kevin 2** (product-risk) | **correrlo ANTES, no solo al final** |
| 7 | Gates go/no-go por etapa | criterio de éxito por fase (TDD) | `puesta-en-marcha` | Validada | por etapa + **gate kevin 3** (code-review senior) | **aplicar por etapa, no solo go-live** |
| 8 | Promote | idea aprobada → proyecto activo | `handoff-proyecto` | Proyecto activo | `/promote` | disparador `/promote` |
| 9 | Ejecución | PM crea sub-agentes ejecutores | `equipo-agentes-pro` | En ejecución | proyecto activo | — |
| 10 | **PM persistente** | mantenimiento + resumen diario | Director/Salud + `briefDiario` | En mantenimiento | **cron nativo** (Scheduled Tasks) | **PM por cliente post-entrega** |

## Los 3 gaps a cerrar (lo único nuevo)
1. **Clasificador general (fase 2):** hoy `clasificarBandeja` triaga la capa personal; generalizarlo a proyecto/tarea/idea con destino. Empata con **Jarvis F2**.
2. **PM persistente por cliente (fase 10):** un "Jarvis" que mantiene cada cliente post-entrega y manda resumen matinal (UX de referencia: andrea_audisio). El Director + `briefDiario` ya dan la base; falta el bucle por cliente sobre **cron nativo**. Empata con **Jarvis F3**.
3. **Encadenado con estados:** que cada fase escriba el estado en el índice y dispare la siguiente. Es orquestación, no código nuevo.

## Implementación nativa (el "cómo", validado §8 del UNIFICADO)
- **Cada fase = una Agent Skill** (progressive disclosure: ~100 tokens de metadata al inicio, cuerpo solo al activarse → muchas sin penalizar contexto). Se encadenan naturalmente.
- **Deep review (fase 6) = Task tool**: N subagentes en un solo mensaje, 1 por fase, **Haiku** en los chequeos mecánicos (10x cobertura, bajo costo); un master sintetiza.
- **Estado del pipeline = `CLAUDE.md` / `HANDOFF.md`** (sobrevive `/clear`, cierre y reinicio; walk-up).
- **Fase 10 (PM persistente) = Scheduled Tasks / Routines** (cron sin servidor; catch-up de corridas perdidas). **Hermes fuera del core; OpenClaw descartado** (Bastión).
- **Gates (5/6/7) = los 3 prompts de kevinfremon** + opción de hooks de Claude Code.
- **Anti-context-rot:** compressed handoff + sesión fresca al ~80% de contexto (no esperar al auto-compact).

## Estado de validación
- **Verificado:** las 6 skills citadas existen (catálogo de skills): `purga-de-errores`, `consejo-asesores`, `equipo-agentes-pro`, `ejecucion-supervisada`, `puesta-en-marcha`, `handoff-proyecto`. Módulos `17_bandeja`/`14_director`/`briefDiario` existen (HANDOFF).
- **Pendiente (Code, contra el repo):** confirmar que cada skill *cubre* su fase (no solo que existe) + definir los disparadores `/promote` y el formato de estado en `CLAUDE.md`. Confianza del mapeo: **7/10**.
- **Anti-scope-creep (Ejecutor):** este motor mejora *cómo se construye*; NO frena el producto. Se opera en paralelo, no antes de terminar el sistema.
