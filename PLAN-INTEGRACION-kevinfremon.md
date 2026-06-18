# Plan de integración — sistema de @kevinfremon ("Trillion") → Satori OS

> Fuente: `informe-kevinfremon-sistema.md` + `transcripciones-kevinfremon.md` (59 reels, "Road to $1M ARR"). Cruce exhaustivo contra Satori OS actual + lo ya planeado (caso Jarvis). Para aprobar. 2026-06-16.

## BLUF
Kevin construye **Trillion**, un co-fundador IA voice-first que orquesta sub-agentes sobre su negocio real. **Dato fuerte: sus sub-agentes (Flux, Prism, Scout, Relay, Atlas, Forge, Lift, Spark) SON el roster "laboratorio" de Satori OS** — ya absorbimos su nomenclatura. Cruzando todo: **~60% ya lo tenés igual o mejor** (orquestación, handoff, costos, seguridad, infra 24/7, requirements-doc). Lo genuinamente nuevo y valioso son **4 cosas**, y todas convergen en un producto: la **"capa de dirección"** (contrato de datos + North Star + brief diario) + el **ruteo de modelo por costo**. Y una pieza que **no es del OS sino de tu negocio**: su motor de captación, que ataca tu cuello real (cartera). No copiamos su stack (Python/Postgres/voz); robamos contratos e insights, 100% GAS-nativo.

## 1. Lo que Satori OS YA tiene = o mejor → NO integrar (evitar duplicar)
| Mecanismo de Kevin | Por qué NO se integra |
|---|---|
| **Orquestación / harness** ("operador, no chatbot", smart routing) | Ya: **Director** + **cola durable** + `drenarCola`. Paridad. |
| **handoff.md** (contexto al 25-40%) | Ya: skill **`handoff-proyecto`**. Convergencia = validación. |
| **Token/cost tracking** (usage pill, tabla `api_usage` por modelo) | Ya: **tira de telemetría** (gasto/tope/llamadas/tokens) + `Consumo_agentes` + wrapper de costos + `consolidarCostosMes`. **Mejor que la suya** (per-cliente + consolidado). |
| **Security hardening** (score, auditoría diaria, prompt-injection) | Ya: **Bastión** + **Purga** + Trifecta/Cyber Neo + anonimización + AREL. Ventaja. |
| **Infra 24/7 + cron** (droplet + Postgres) | Ya: **triggers GAS** (`corridaDiaria` 07:00 + `drenarCola` 5min). Ventaja estructural: él reinventa lo que GAS te da gratis. |
| **PRD / "nunca a ciegas" / plan mode** | Ya: requirements-doc (`PRACTICAS-jarvis.md` Fase 0) + ejecución-supervisada. |
| **"Roast my SaaS" / feedback brutal** | Ya: **Purga** + **Consejo** + tu propia regla de honestidad brutal. |
| **Self-aware capabilities map** (auto-update en commit) | Ya, ~cubierto: `ARCHITECTURE.md` + registry `AGENTES`. Auto-generarlo = marginal. |
| **Orbs / activity feed / Cmd+K** | Ya en el Command Center (orbe-vivo, feed Actividad, ⌘K). |
| **Email propio del agente** (Gmail) | El modelo de **aprobación** (Cobrador → gate) es **mejor y más seguro** que darle inbox propio. No integrar. |

## 2. Lo aplicable NUEVO → INTEGRAR
| # | Item | Qué es | Para qué te sirve | Estado | Prioridad | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | **Contrato de datos — `estado-vigente.md`** ("packets of truth") | El ERP exporta un **snapshot markdown** del estado real (KPIs, pendientes, números) que Cowork/Code leen sin que re-expliques nada | El unlock real: **yo (Cowork) decido con tu estado vivo** sin fricción; y es la base del brief y del North Star. Kevin usa Cowork igual que vos | Nuevo (parcial: `estado_actual` existe en Sheet, falta el export MD) | **MUST** | S–M |
| 2 | **Brief operativo diario/semanal** (BLUF, consolidado, push) | Un brief narrativo: números + "qué se movió" + **las 3 cosas de hoy**, enfocado al objetivo. Para vos (cartera) y por cliente | Empezás el día con plan, no reactivo. **Es S2 vendible** (Dirección Administrativa) | Nuevo (parcial: Vigía da brief per-cliente; falta el consolidado y el push) | **MUST** | M |
| 3 | **North Star + "Chief of Staff" por cliente** | Doc con **1 objetivo + guardrails** → una rutina prioriza must/should/nice → "3 cosas hoy" | **Es tu tesis hecha operativa**: "el techo del agente = claridad de su objetivo" = "el techo del negocio = el techo de quien lo lidera". Entregable de consultoría | Nuevo (parcial: `objetivos` existe; falta el framing North Star + la priorización 3-cosas) | **MUST** | M |
| 4 | **Ruteo de modelo por costo/frecuencia** | Cada agente con su modelo: **Haiku** para triaje de alta frecuencia, **Sonnet/Opus** para veredictos | Bajás costo y subís calidad donde importa. Hoy **todos los agentes usan Haiku** por igual | Nuevo (la infra ya acepta `opts.modelo`; falta fijarlo por agente) | **SHOULD** | S |

**80/20:** los items **1 + 2 + 3 juntos = la "Capa de Dirección"**, que es **un producto Satori claro** ("co-piloto operativo IA") y evolución natural de S2→S4. El #4 es una mejora técnica rápida, suelta.

## 3. Diferir (nice / riesgo / no-core) → en backlog, NO ahora
| Item | Por qué se difiere |
|---|---|
| **Voz** (Deepgram STT + ElevenLabs TTS + wake word) | Gran lift + costo (ElevenLabs ~$99/mo); no core. El Command Center mobile ya te da control. Producto futuro, no MVP. |
| **Forge: agentes que crean agentes / self-improving** | Meta y riesgoso; los 8 lab están parkeados a propósito. Futuro (E8b). |
| **Neural map 3D del cerebro** | El **orbe-vivo (a4.2)** ya da el "cerebro vivo". Un 3D pesa en el iframe de GAS. Eye-candy, no prioridad. |
| **Routine manager UI** (panel para editar rutinas de agentes) | Hoy las rutinas son triggers; un panel de edición es comodidad, bajo valor ahora. |
| **Prompt caching** | La arquitectura de Satori no reusa un system-prompt grande (cada prompt se arma con los datos). El ahorro sería marginal. |
| **Pantalla de notificaciones móvil dedicada** | El feed **Actividad** + avisos ya cubren. Minor. |
| **Cloud↔local, latencia de voz, personalidad, Spotify, Bitcoin** | N/A (GAS no tiene split local/cloud; sin voz) o irrelevante para tu negocio. |

## 4. Fuera de scope del OS — pero negocio real (KAIROS)
| Item | Qué es | Veredicto |
|---|---|---|
| **Motor build-in-public** | Reel/post diario enseñando un módulo + "prompt included" como lead magnet + waitlist + responde cada DM | **No es código de Satori OS, es estrategia de contenido/captación.** Ataca tu cuello REAL (cartera). El propio análisis lo marca como lo de mayor leverage no-técnico. Lo trato aparte como iniciativa KAIROS si querés. |
| **Loop de feedback de cliente** (roadmap público + upvoting + responder cada email) | Forma de escuchar al cliente | Feature de **servicio** (S2/S6 retención), no del OS core. Backlog de servicio. |

## 5. Plan de ejecución (fusionado con el roadmap Jarvis — sin duplicar)
**Ya hecho:** Fase 0 (prácticas) + Fase 1 (Bandeja + clasificador) — *Fase 1 construida, pendiente tu push/test.*

- **Fase D — "Capa de Dirección"** (los 3 must de kevinfremon, juntos = el producto):
  1. **`estado-vigente.md`** — función GAS que exporta el snapshot MD del MAESTRO/cliente (KPIs + pendientes + números). Empezamos por **Satori mismo** (dogfood) y por 1 cliente piloto.
  2. **North Star por cliente** — plantilla `north-star-<cliente>` (sobre `objetivos`) + rutina "3 cosas hoy".
  3. **Brief diario** — función que lee `estado-vigente.md` + North Star → BLUF → lo deja en un Doc/aviso/email.
- **Quick win (cuando quieras):** ruteo de modelo por agente (#4) — fijar `modelo` por RUNNER.
- **Fase 2 (Jarvis, ya planeada):** separar ideas/ejecución + **índice raíz jerárquico** — acá entra el matiz de Kevin (jerarquía por importancia, token-optimizado). **No duplicar:** el "_index.md por tenant" de Kevin = esta fase; lo construimos una vez.
- **Fase 3 (Jarvis):** PM persistente que mantiene.
- **Backlog/diferido:** lo de la sección 3. **KAIROS (negocio):** build-in-public.

**Roles:** Cowork diseña + skill + verifica/purga · Code porta a GAS · vos definís North Star + aprobás.

## 6. Lo no-obvio (el insight, no la herramienta)
- El verdadero unlock de Kevin **no es Python/Postgres**: es el **contrato de datos** (estado vivo → markdown → IA decide). Eso es 100% GAS/Sheets-nativo y te lo llevás hoy.
- Su mejor hallazgo **es tu tesis**: un agente sin North Star reacciona; con North Star, ejecuta alineado. Kevin llegó solo a "el techo del agente es la claridad de su objetivo". Hacelo explícito en Satori.
- Él gana por **distribución**, no por tecnología. Para vos armando cartera, su **sistema de contenido vale más que su harness**.

## 7. Aprobación
**Recomiendo:** aprobar la **Fase D (Capa de Dirección)** como próximo bloque grande + el **quick win #4** suelto. Lo de la sección 1 NO se toca (ya lo tenés). Lo de la 3 queda en backlog. La 4 (build-in-public) la abrimos como tema de negocio aparte cuando quieras.

¿Aprobás Fase D + #4 así? ¿Y querés que el `estado-vigente.md` arranque dogfooded en Satori o directo en un cliente?
