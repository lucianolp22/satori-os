# PLAN — SATO EJECUTOR · Satori OS con alcance operativo Trillion · 24-ago-2026

> **Pedido de Luciano:** "Quiero que Sato pase a ejecutar (no solo capturar), tal como Trillion para
> Kevin Fremon. Operar Satori OS como Kevin opera Trillion." Fuente: mapa interactivo Trillion
> (17-ago, 8vo contacto, corpus completo) + memoria [[kevinfremon-analisis]] + código vigente del OS.

## BLUF

**No se replica Trillion — se le da a Satori OS la capacidad que le falta: EJECUCIÓN.** El veredicto
del 17-ago sigue vigente en lo estructural (el 90% ya está cubierto, varias cosas mejor: Bastión,
handoff, cerebro, forge, voz). El único eje donde Trillion es objetivamente superior en el uso diario
es que **Kevin le pide cosas y Trillion las HACE** (manda emails, decide, dispara agentes, crea
piezas), mientras Sato hoy **lee + captura + 1 acción gateada** (`crear_objetivo`). Este plan cierra
ese eje en 3 niveles sobre lo ya construido, sin cambiar de arquitectura, sin Supabase/DigitalOcean/
Three.js, y con Bastión como gate en cada nivel.

## 1 · Mapa de paridad (Trillion ↔ Satori OS hoy)

| Pieza Trillion | Satori OS hoy | Veredicto |
|---|---|---|
| Orquestador Claude por voz | Agente LiveKit (`agent.py`) + doPost GAS + Sato en Ficha 360 | ✅ cubierto |
| Cerebro (Living Mind, Supabase) | `15_cerebro` + hojas por tenant + Akasha + `_cerebro/` (hot/cold) | ✅ cubierto |
| Sub-agents (Lift, Design…) | Roster `13_agentes` + Director + skills (satori-design, etc.) | ✅ cubierto |
| Forge (agent-factory) | `28_forge.js` | ✅ cubierto |
| Board of Directors | Skill `consejo-asesores` (multi-modelo; falta modo persona) | 🟡 parcial (nice) |
| Handoff WWWHH | `handoff-proyecto` (más rico, sin campos estructurados) | 🟡 parcial (should) |
| Connection health monitor | `16_salud` (integridad interna; SIN ping a conectores externos) | 🟡 parcial (should) |
| Acceso iPhone (Tailscale) | PWA-C: plano + andamiaje LISTOS sin ejecutar (`HANDOFF-PWA-C.md`) | 🟡 parcial |
| Seguridad | Bastión (anti-injection + gates + scan) — MÁS profundo que Trillion | ✅ superior |
| **Tools que EJECUTAN por voz** | **Solo `capturar` + `crear_objetivo` (aprobación). El resto: lectura.** | 🔴 **EL GAP** |
| Trillion ejecuta en la máquina | **No existe puente voz → Mac/Code** | 🔴 **EL GAP** |

## 2 · El gap de ejecución — 3 niveles

### N1 — La voz ejecuta DENTRO del OS (esfuerzo S-M · must · primera etapa)
Exponer a `VOZ_TOOLS` acciones que **ya existen como endpoints gateados de la UI**, con el
confirmation-pattern S5 (repetir en voz alta + esperar el "sí") y default-deny:
- `decidir_aprobacion` → reusa `resolverAprobacionUI` (el patrón ya está probado: `oficina_decidir`
  hace exactamente esto contra la OV desde el 14-jul).
- `disparar_agente` → reusa `dispararAgenteUI` (encola, no ejecuta directo — el gate queda).
- `crear_tarea` / `marcar_recomendacion` → reusa endpoints del CM.
- Escalera `ACCIONES_VOZ` ya existe (`CAMPOS_ACCION`, whitelist server-side): se amplía peldaño a
  peldaño, nunca de golpe.

**⚠ Frontera de confianza (HANDOFF 16-jul, no negociable):** la cadena
`objetivos.descripcion → correrDirector → pregunta CRUDA al LLM` + `GUARDIA_INYECCION` que bendice
la pregunta sigue SIN sanear. Prerequisito para cualquier ampliación que escriba campos que un
agente luego lea como instrucción: sanear la `pregunta` y de-privilegiarla en `GUARDIA_INYECCION`
(diseño anotado para Etapa 3 — blast radius: todos los agentes). N1 se limita a acciones cuyo
payload NO entra a prompts de agentes (decidir/disparar/tarea) hasta pagar ese prerequisito.

### N2 — El puente al Mac: la voz ENCARGA y Code EJECUTA (esfuerzo M-L · must · el salto Trillion)
Lo que pediste en la prueba de voz ("pasale el encargo a Cowork y ejecutalo") se construye así,
con el patrón cola + runner que el OS ya usa (`12_cola` + launchd, como la OV y la voz):

1. **Hoja `Encargos` en el MAESTRO** (lazy, patrón `checklist`): la tool de voz `encargar`
   registra {texto, repo_destino, tipo, estado:pendiente_aprobacion}. Sato repite y pide el "sí".
2. **Gate default-deny**: el encargo queda como Aprobación en el CM (o auto si hay Dirección
   pre-aprobada vigente con vencimiento — mismo riel que `crear_objetivo`).
3. **Runner local en el Mac** (launchd cada N min, patrón `voz_watchdog`): pollea encargos
   aprobados vía doPost (secreto DEDICADO tipo `oficina_sync`, least-privilege), ejecuta cada uno
   con **Claude Code headless** (`claude -p "<encargo>"`) dentro del repo whitelisteado
   (`Projects/SatoriOS`, etc.), y reporta resultado + log a la hoja.
4. **Cierre del lazo**: Sato informa por voz/CM "el encargo #N terminó: <resumen>", con evidencia
   (commit/archivo), jamás promesa (N5).

**Bastión gate obligatorio antes de encender N2** (ejecución arbitraria en tu Mac = superficie
máxima): whitelist de repos y tipos de encargo · sin `--dangerously-skip-permissions` en v1 (el
runner corre con permisos acotados y deja diffs sin push para tu revisión) · kill-switch #7 lo
frena · log completo por encargo · secretos nunca en la hoja.

### N3 — Acceso ubicuo (esfuerzo M · should)
- **PWA-C** (ya planificada, Fase 0 Bastión pendiente): Satori OS + voz desde el iPhone.
- **Tailscale** (patrón Trillion, gratis): `serve_voz` hoy es loopback; con tailnet, "Hablar con
  Sato" desde el iPhone fuera de casa sin exponer nada público. Alternativa/complemento a PWA-C.

## 3 · Adopciones puntuales del mapa Trillion (confirmadas del informe 17-ago)

| # | Qué | Dónde | Prioridad | Esfuerzo |
|---|---|---|---|---|
| 1 | Regla anti-brief-estático (chequeo semestral de valor percibido + opinion slot) | doctrina + `morning`/brief | **must** | 30min |
| 2 | WWWHH estructurado en handoffs (why/what/where/heads_up/how_sure; <70 ⇒ rebota) | `handoff-proyecto` + encargos Code | should | 1-2h |
| 3 | Connection health: ping por conector externo (Anthropic, ElevenLabs, Deepgram, LiveKit, conectores SGIC) + aviso al fallar — el error más caro de Kevin (semanas ciego) | `16_salud` + `29_vigilancia` | should | 3-4h |
| 4 | Modo "board" persona-driven en `consejo-asesores` (N personas con doctrine[], mismo modelo, síntesis) | skill | nice | 2-3h |

## 4 · Roadmap

| Fase | Contenido | Tamaño | Gate |
|---|---|---|---|
| **F1** | N1 (3 tools de acción en voz) + adopción #1 y #2 | **M** | Bastión (whitelist + S5) + harness + selfTest + promote |
| **F2** | N2 puente Encargos → runner Code (v1: dry-run, diffs sin push) | **L** | **Bastión completo + Purga** antes de encender |
| **F3** | N3: Tailscale para la voz + retomar PWA-C Fase 0 | **M** | Bastión (superficie de red) |
| **F4** | Adopciones #3 y #4 + N2 v2 (push automático con Dirección) | **M** | Purga |

## 5 · Pre-mortem (si esto fracasa, fue por…)

1. **Inyección → ejecución**: un texto hostil (Sheet de cliente, STT erróneo) termina como encargo
   ejecutado en tu Mac. Mitigación: default-deny + confirmación verbal + whitelist + prerequisito
   GUARDIA_INYECCION antes de ampliar payloads.
2. **El gate humano se vuelve cuello de botella** (efecto 2º orden: si todo pide tu clic, volvés a
   ser el sistema). Mitigación: Direcciones pre-aprobadas con vencimiento (riel ya existente) para
   los tipos de encargo de bajo riesgo, revisión semanal.
3. **Fatiga de rutinas** (el error ⭐⭐ de Kevin): rutinas nuevas sin chequeo de valor → ruido.
   Mitigación: adopción #1 desde el día 1.
4. **Costo GAS/API por cliente**: N1/N2 suman cómputo. Vigilar `Costos_API` + tope (`presupuesto_usd_total`).

## 6 · Qué NO se hace (explícito)

Supabase/Postgres (descartado 27-jul) · DigitalOcean (GAS+Mac ya cubren) · Three.js (DESIGN.md manda
SVG) · replicar los 25 prompts (mapeados: 17 cubiertos, 6 contra-arquitectura) · board con nombres
reales como servicio a clientes sin rebranding (riesgo legal de impersonation, nota del propio mapa).

## Próximo paso

Cerrar el runbook del Problema B (en curso) → **arrancar F1 en la próxima sesión**: encargo
Cowork→Code con las 3 tools de N1 + spec de la hoja `Encargos` (para que F2 nazca con el esquema
correcto desde F1).

*Cowork · 24-ago-2026. Fuentes: mapa Trillion 17-ago (adjunto de Luciano) · [[kevinfremon-analisis]] ·
HANDOFF 16-jul (frontera de confianza) · código vigente src/ + voz/.*
