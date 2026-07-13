# Criterio Satori de arquitectura de agentes — 1 página

> Consolidado 06-jul-2026 desde 8+ casos analizados (kevinfremon/Trillion, lukebuildsai, @_no_hype_ai/Jarvis, Hermes/Nous, Zoey OS, Pulse/KRONOS, @_andrea_audisio_, @vision.cero). Regla del INDEX cumplida. **Uso:** antes de adoptar cualquier patrón de un caso externo, pasarlo por este filtro. Actualizar solo cuando un caso nuevo aporte un patrón que no esté acá.

## El filtro (3 preguntas, en orden)
1. **¿Resuelve un problema que Satori TIENE hoy** (operador solo, cartera acotada, GAS+Sheets) **o uno que el creador del caso tiene** (SaaS, equipo, escala)? Si es de él → humo para nosotros, aunque sea real para él.
2. **¿Mueve un KPI del negocio** (ingresos, tiempo devuelto, error evitado) **o solo mejora la sensación de sistema?** Cinemática/demo-driven → humo.
3. **¿Se sostiene con la capacidad actual** (mantenimiento, costo, foco)? Si demanda más de lo que libera → mal calibrado (lente Satori: el sistema baja el techo del líder, no lo sube).

## Adoptado (ya en prod — NO re-proponer)
CAPABILITIES.md autogenerado · telemetría api_usage + tope · estado-vigente/packets of truth · North Star por tenant · handoff.md como fuente de verdad · backup+runbook · memoria jerárquica por cliente (CLAUDE.md por cliente) · voz+PWA · orbe/neural-map 3D · hardening (Bastión) · ruteo de modelo por costo · kill switch · context rot: sesión fresca ~80% + compressed handoff · correr los primeros pasos A MANO antes de soltar al agente (= AREL) · auto-plan del agente antes de ejecutar (CLAUDE.md raíz) · escalera de maduración 0-manual→1-skill/SOP→2-cadena→3-automatización con gates y desescalada (doctrina 14-jul, detalle y niveles vigentes en `PIPELINE-SatoriOS.md`).

## Humo confirmado (cerrado — no rediscutir)
Stack WS-custom de voz · UI cinemática como fin · MRR/waitlist como métrica propia · iMessage · daemon always-on / OpenClaw · Hermes en el core · neural-map 2D · wake word · "inyectar reseñas" (ilegal UE, Omnibus) · números de facturación de los creadores como evidencia (sesgo comercial: venden el curso/template, no el resultado).

## Gaps vivos (lo único abierto — con destino)
| # | Patrón | Origen | Destino |
|---|---|---|---|
| 1 | Lazo de resultados (recomendó→se hizo→KPI se movió) | hueco propio; ningún caso lo tiene | P2 |
| 2 | Contrato de status report fijo (métrica → auto-resuelto → espera decisión → recomendación) | Luke R3 | P2 |
| 3 | Brief-push (el brief llega solo; hábito > feature) | Kevin #034 | P2 |
| 4 | Drift-checker CAPABILITIES pre-push | Trillion self-aware | HECHO 06-jul (`_hooks/pre-push`) |
| 5 | Clasificador con confianza + escalate X/10 | @_no_hype_ai | **CERRADO 07-jul: ya existía** (`17_bandeja.js`, umbral+escalate) |
| 6 | Cola de aprobaciones con despacho en lote | Luke | **CERRADO — verificado 14-jul: ya existía desde P2 F5 (07-jul): vista inbox + checkbox por fila + aprobar/rechazar lote en `index.html`** |
| 7 | Bucle de contenido autoalimentado (el sistema documenta → borrador de post) | Luke (Ava) + Kevin | P1 solo si va build-in-public |
| 8 | Test gates runtime / agentes revisando agentes (Director sobre salidas) | @_no_hype_ai | gatillo: agentes lab→prod |
| 9 | Mesa async (Telegram) | Luke + plan propio | gatillo: Bastión + arranque B7 |

## Reglas de adopción
- **Patrón antes que herramienta:** se adopta el principio (p.ej. "confirmación verbal antes de escribir"), no el stack del creador.
- **Un caso nuevo se analiza SOLO si** promete cubrir un gap vivo de la tabla o un problema nuevo real. Análisis tri-modal profundo: de a 1, on-demand.
- **Sesgo comercial se declara siempre** (qué vende el creador) antes de pesar sus claims.
- **Composición Hermes × escalera (14-jul, checkpoint D4):** auto-skills / auto-mejora (Hermes #1/#4/#5) SOLO como borrador gateado — el sistema propone el SOP tras una tarea multi-paso, entra a la cola de aprobación y sube por los gates de la escalera. Jamás se auto-promueve.
- **Pre-escaneo de prompt-injection (14-jul):** antes de adoptar cualquier markdown/skill/prompt/repo de terceros (incluidos creadores estudiados), el plan de implementación EMPIEZA por búsqueda explícita de inyección maliciosa (instrucciones ocultas, exfiltración, llamadas a URLs). Con hallazgo → no se adopta y se registra. Sin excepción por "fuente confiable".
- **Todo lo adoptado entra por el loop normal** (plan → AREL → verificación → purga), nunca por copy-paste del caso.
