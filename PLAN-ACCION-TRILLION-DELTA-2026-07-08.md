# PLAN DE ACCIÓN — Delta Trillion → Satori OS — 08/07/2026

> **Fuente:** `HANDOFF-Trillion-integracion-2026-07-08.md` (13 ítems, 0 must) **cruzado contra el repo REAL post-v11/F1/F1.1** (el handoff se verificó contra el repo de la mañana del 08-jul y no vio las 3 tandas de anoche: commits `5838677`, `5e81d27` y F1.1).
> **Regla de Luciano aplicada:** nada que ya implementamos de otra manera se reemplaza — se marca ⚠ CONFLICTO/SOLAPE y se decide antes.

## BLUF

De los 13 ítems: **1 ya está cerrado** (B4 ⌘K existe — falso gap), **1 está medio hecho** (C1: estados de voz texto+color ya viven en voz.html; falta solo el aro del orbe), **2 deben ENSAMBLARSE sobre el lazo F4-F5 construido anoche y no construirse aparte** (A2 tono + B2 botones — el brief YA cierra en 1 acción vía `recomendacionDelDia_`), y **9 quedan como estaban** (2 should reales + 7 nice/gatillo). Ningún must — coincide con el handoff: nada en ruta crítica.

**Recomendación (igual que el handoff, ajustada):** Tanda 1 = **(A) Voz-fluidez** — C2 completo + el DELTA de C1 (solo el aro). Es el único cuello real y lo más barato.

**Quick-win tuyo (1 minuto, decisión, no dev):** `brief_push_on=true` en Script Properties → el brief te llega por email cada mañana. Ya construido, OFF por diseño. ¿Lo querés ON?

## Cruce ítem × estado real (post-tandas de anoche)

| # | Ítem Trillion | Estado REAL hoy | Veredicto |
|---|---|---|---|
| C2 | Progreso en chatlog (13s voz) | No existe. Sigue en backlog nuestro ("progreso chatlog 13s") | ✅ **Hacer — Tanda 1** |
| C1 | Estados voz-turno en orbe | ⚠ **MEDIO HECHO** (07-jul, `c7c7077`): `setSato` ya muestra escucha/pensando/habla con texto+color en `voz.html` vía `lk.agent.state`. **NO rehacer.** Delta real = solo el ARO visual sobre el orbe 3D (ya estaba en nuestro backlog "próx. toque UI") | ⚠ **Hacer SOLO el delta — Tanda 1** |
| A2 | Tono anclado del brief | ⚠ **SOLAPE con F2+F4** (anoche): el brief ya tiene contrato de estructura (F2) y YA cierra en 1 acción (F4 `recomendacionDelDia_` + lazo con 2 juicios en el CM). Lo ÚNICO nuevo = juicios anclados en KPIs del cliente ("3 de tus últimos 5 churns citaron precio…"). **No tocar la recomendación del día: extenderla, no reemplazarla** | ⚠ **Hacer solo "juicio anclado" — Tanda 2, sobre F4** |
| B2 | Botones que CREAN aprobación desde el brief | ⚠ **SOLAPE PARCIAL con F5**: el CM ya resuelve aprobaciones existentes 1-clic + lote (`ccAprob` v2). Lo nuevo = CREAR aprobación desde una acción sugerida. Diseño correcto: botón "→ Aprobación" EN la fila de la recomendación del día (reusa F4+`crearAprobacion`), no un sistema paralelo | ⚠ **Hacer como extensión de F4/F5 — Tanda 2** |
| A1 | Vigilancia multi-superficie + semáforo | ⚠ El semáforo por cliente YA existe básico (`ccCartera` con estados reales, v11). Lo multi-superficie **depende de B8 (datos reales)** — decisión firme: al final | 🔒 **Gatillo B8 — no adelantar** |
| B4 | ⌘K palette | ✅ **YA EXISTE** (verificado norte v9 contra CM vivo: era falso cabo del plan) | ❌ **Cerrado — no hacer** |
| A4 | Roster identidad | Roster real con barras construido anoche (v11). El ángulo público → B7 build-in-public | ❌ Dev cerrado; resto es marketing (B7) |
| A5 | Roadmap público + upvoting | No existe. Nice, vendible como feature a cliente | Nice — backlog |
| A6 | Lift/retención de TU cartera | No existe. Nice (rutina en `16_salud.js`: cliente que se enfría) | Nice — backlog (bonito para B7 cartera) |
| B7T | Promover 8 lab + hot-reload | Decisión firme previa: **diferido, gatillo Forge data-defined** | 🔒 Gatillo (sin cambio) |
| B8T | Prompt-caching en `llamadaAPI` | Decisión firme previa (retrofit 29-jun): **gatillo = telemetría con prefijo repetido**; hoy $0.15/mes — marginal | 🔒 Gatillo (sin cambio) |
| C3 | Re-inyección de persona por turno | No verificado en `voz/agent/agent.py` — chequear ANTES de listar como trabajo | Nice — verificar primero |
| C4 | Streaming TTS por oración | LiveKit agents + ElevenLabs suelen hacerlo NATIVO; latencia dominante = overhead GAS (13s, opción C diferida) → ganancia probable marginal | Nice — verificar primero (probable ya-hecho) |

**A3 (biblioteca prompts lead-magnet):** fuera del repo — B7 build-in-public ✓ (coincide con el handoff).

## Tandas propuestas

**TANDA 1 — Voz-fluidez (recomendada · esfuerzo S · 0 API):**
1. C2: estados de progreso en el chatlog del CM/voz durante el turno (texto por etapa real — "consultando Sheets… armando brief…" — no barra falsa). Anchor: cliente de voz + chatlog; el estado del turno ya lo emite `lk.agent.state` (reusar la maquinaria de `setSato`).
2. C1-delta: aro de estado sobre el orbe 3D (color por escucha/pensando/habla — la data ya está en `setSato`, es solo CSS/render).
- Criterio de hecho: en una consulta real de voz se ven ≥2 estados antes de la respuesta y el orbe cambia visiblemente.

**TANDA 2 — Brief-que-decide (esfuerzo S+M · ensambla sobre F4/F5, no reemplaza):**
1. A2-delta: regla de "juicio anclado" en `briefDiario*` — cada juicio cita el KPI/dato del cliente y cierra con la acción (la acción YA la pone F4). Media página de spec + aplicación al armado del texto. ⚠ Marca: espejo honesto, no oráculo.
2. B2-delta: botón "→ Crear aprobación" en la fila de la recomendación del día (CM) → `crearAprobacion` con payload de la recomendación → entra al default-deny + lote F5 existentes.
- Criterio de hecho: un brief real emite juicio anclado en KPI y su recomendación se convierte en aprobación con 1 clic.

**TANDA 3 — Con gatillo/verificación (no ahora):**
- A1 multi-superficie → **gatillo B8** (go-live datos reales). A5/A6 → nice, cuando B7 cartera lo pida. C3/C4 → 30 min de verificación en `voz/agent/` antes de decidir (probable ya-hecho C4). B7T/B8T → gatillos firmes sin cambio.

## Decisiones de Luciano (pregunta cerrada)
1. **¿Tanda 1 (voz), Tanda 2 (brief) o ambas en orden?** (Recomendado: 1 → 2.)
2. **¿`brief_push_on=true` ya?** (1 Script Property, reversible.)
3. Los ⚠ de arriba: ¿confirmás el criterio "extender, no reemplazar" para A2/B2 sobre el lazo F4-F5?

---
*Generado por Cowork 08-jul tras cruzar el handoff contra el repo post-`5e81d27`+F1.1. Fuentes: HANDOFF-Trillion (120 líneas), HANDOFF.md vigente, CAPABILITIES, código verificado en sesión.*
