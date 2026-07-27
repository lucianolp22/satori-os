# PLAN DE ACCIÓN INTEGRAL — Satori OS — 18-jul-2026

> **Encargo:** reconciliar TODO lo anotado para implementar (CHECKPOINTS 13-jul A-E · PLAN-MAESTRO 13-jul F0-F7 · delta Trillion · mejoras de casos paralelos · los 4 cabos) en un plan único etapado en las máximas tandas prudentes, y avanzar con todo lo que esté a mi alcance.
> **Método (doctrina viva del CLAUDE.md raíz):** de fondo SIEMPRE Círculo + Equipo Agentes Pro + Bastión · por paso ejecución-supervisada (test AREL) + satori-design (cuando hay UI) · al cierre de cada etapa significativa purga-de-errores · verificar SIEMPRE que algo esté realmente pendiente antes de tocarlo · una etapa por vez, "avanzá" es el gatillo.
> **Roles:** Luciano dirige/decide/aprueba gates · Cowork planifica/verifica/purga · Code ejecuta GAS · Luciano solo acciona lo que exige credencial, aprobación o eyeball.
> **Restricción vigente:** trabajo de **clientes en pausa** (cartera B7, SGICs de clientes, entregables a cliente). Este plan avanza el **motor del OS**; lo que roza cliente queda marcado y estacionado.

---

## §0 · BLUF + hallazgo de la verificación

**Antes de planificar, el Modo Guardia + Bastión verificaron el repo real. Hallazgo que cambia el arranque: la "doctrina F1" que el CHECKPOINTS del 13-jul lista como pendiente YA SE EJECUTÓ el 14-jul y vive en el repo.** El CHECKPOINTS (13-jul) es la foto vieja; el repo (14-17 jul) es la verdad. Reconstruir F1 habría sido el error caro que vos mismo advertiste.

Concretamente, ya está HECHO y verificado en el repo (no re-hacer):
- **D1** Escalera de maduración plantada en `PIPELINE-SatoriOS.md` (líneas 33-44) + `CLAUDE.md` raíz (línea 25). ✓ 14-jul.
- **D2** Tabla de niveles por proceso en `PIPELINE.md` (líneas 45-64) — ✓ hecha, marcada *"PROPUESTA, corregir Luciano"* → lo único abierto de F1 es **tu corrección** (§4).
- **D3** Gap 1 (clasificador) corregido en `PIPELINE.md`. ✓
- **D4** `docs/CRITERIO-arquitectura-agentes.md` actualizado con Hermes×escalera + pre-escaneo de prompt-injection. ✓ 14-jul.
- **D5** `PIPELINE.md` unificado (repo = vigente; consultoría = puntero). ✓
- **North Star enriquecido**: el **template ya existe** (`docs/north-star-TEMPLATE.md`, 14-jul) con métricas+valores+deadline+pivots descartados+re-fijar. Lo que falta NO es diseñarlo (mi ENCARGO de ayer lo daba por diseñar — corregido acá): falta **implementar el template en el lector/estructura** (`18_direccion.js`) y migrar los 2 North Star sembrados.

**Corrección honesta de mis propios entregables:** el `DOCTRINA-escalera-maduracion.md` que escribí ayer **duplica** la escalera que ya vivía en `PIPELINE.md` — queda como material redundante (o refundir). Y mi ENCARGO-Dirección de ayer daba por "diseñar" el North Star enriquecido que **ya estaba diseñado**. Ambos corregidos en este plan.

**Consecuencia para el plan:** el verdadero próximo pendiente NO es doctrina — es **la cola técnica en curso (métrica CM v3 → cerebroNodo) y la Tanda de Lazo/Informes (F2)**. Confianza del estado: **9/10** (repo leído directo: PIPELINE, CLAUDE, CRITERIO, template, HANDOFF vía relevamiento).

---

## §1 · Reconciliación de estado — matriz única

> Cruce de las 3 numeraciones (CHECKPOINTS A-E · PLAN-MAESTRO F0-F7 · Trillion/comparativa) contra el estado REAL del repo. ✅ hecho · 🔧 en cola/parcial · ⛔ pendiente · ⏸️ pausa (cliente) · 🧊 diferido con gatillo · ❌ descartado.

### Doctrina / Motor (CHECKPOINTS D + PIPELINE)
| ID | Qué | Estado real | Fuente |
|---|---|---|---|
| D1 | Escalera de maduración plantada | ✅ 14-jul | PIPELINE L33-44 + CLAUDE L25 |
| D2 | Niveles por proceso | ✅ propuesto — **falta tu corrección** | PIPELINE L45-64 |
| D3 | Corregir gap 1 clasificador | ✅ 14-jul | PIPELINE L29 |
| D4 | CRITERIO + Hermes×escalera + anti-injection | ✅ 14-jul | CRITERIO L33-34 |
| D5 | Unificar PIPELINE | ✅ 14-jul | PIPELINE L4 |
| D6 | Encadenado con estados | ⛔ P/gap 3 PIPELINE | CRITERIO/PIPELINE |
| D7 | PM persistente por cliente | ⛔/⏸️ (roza cliente) | PIPELINE gap 2 |
| D8 | Memoria caliente/fría + security-scan | ⛔ verificado FALTA 14-jul | CHECKPOINTS D8 |
| D9 | Auto-skills como borrador gateado | ⛔ (diseño en CRITERIO; sin build) | CRITERIO L33 |
| D10/D11 | Self-improving loop / SOUL.md | 🧊 Etapa 8+ | CHECKPOINTS |
| D12 | Test gates runtime (agentes revisando) | 🧊 gatillo lab→prod | CRITERIO gap 8 |

### Lazo e informes (CHECKPOINTS A + Trillion)
| ID | Qué | Estado real | Fuente |
|---|---|---|---|
> **CORREGIDO 18-jul (verificación contra `18_direccion.js`, ver `ADENDA-F2`):** F2 estaba casi entero construido desde el 08-jul. Las filas de abajo se rectifican de ⛔ a ✅.

| A2-contrato | Contrato de status report (10 secc.) | ✅ código `contratoStatusReport_` L250 — confirmar promote | 18_direccion.js |
| feedback | "¿sirvió?" 1-clic | ✅ `registrarFeedback` L939 | 18_direccion.js |
| A5 | Direcciones pre-aprobadas | ✅ infra prod (inactiva hasta sembrar) | 11_aprobaciones.js:47 |
| A6/A7 | Cola lote / alertas que llegan | ✅ verificado 14-jul | CHECKPOINTS |
| A1 | Cierre acción→métrica | ✅ `_cierreAccionMetrica_` L318 + hoja Recomendaciones — **corregido: NO era gap** | 18_direccion.js |
| A2-juicio | Juicio anclado en el dato | ✅ `recomendacionDelDia_` L692 (Trillion-delta A2, 08-jul) | 18_direccion.js |
| B2 | Botón "crear aprobación" desde brief | ✅ `aprobacionDesdeRecomendacion` L852 (B2, 08-jul) | 18_direccion.js |
| A3 | Refinamientos (insumos/instrumentación/contrapeso/apertura) | ✅ contrato + `_contrapeso_` L298 | 18_direccion.js |
| North Star enriquecido | métricas múltiples + pivots en el lector | 🔧 template ✅ / lector aún single-metric ⛔ — **única pieza F2 pendiente** (+ decisión de storage) | 18_direccion.js:586 |
| A4 | Tono anclado al Informe Mensual KAIROS | ⏸️ pausa (entregable a cliente) | ADENDA-F2 |

### Voz / UX (CHECKPOINTS E + Trillion C + cabos)
| ID | Qué | Estado real | Fuente |
|---|---|---|---|
| C3/C4 | Re-inyección persona / streaming TTS | ✅ verificado 08-jul (C3 no aplica, C4 nativo) | CHECKPOINTS E1 |
| ⌘K / usage pill | — | ✅ prod | HANDOFF |
| C1 | Aro de estado sobre el orbe 3D | ⛔ P (carril voz) | comparativa C1 |
| C2 | Progreso en chatlog (~13s) | ⛔ P (carril voz) | comparativa C2 |
| N2 (cabo) | Exponer CAPABILITIES a la voz en runtime | ⛔ P — **se me había pasado** | REPASO 10-jul §4.4 |
| N5 (cabo) | Aprobaciones en la superficie de agentes | 🔧 parcial (Muelle Akasha) | REPASO 10-jul |
| E2/⌘K | — | ✅ | CHECKPOINTS |

### Cola técnica en curso (HANDOFF) + AKASHA
| Ítem | Estado real |
|---|---|
| AKASHA E3.7 (Oficina Universo 3D) | ✅ **CONFIRMADO EN VIVO 20-jul** (eyeball de Luciano en `/exec`: universo + semáforo con los 7 reales + brief + telemetría $0.62/25). Nota: `AK_T` no es accesible desde la consola de nivel superior porque vive dentro del iframe del CM — NO es falla |
| Métrica CM v3 (A whitelist+asignarMetricaUI+chips · B cifras · C tenant encolarAgente) | 🔧 **en construcción por Code** — verificación contra el repo completa (mapa en scratchpad + ADENDA-T1; asserts renumerados D17j+) | 
| cerebroNodo E3.5 | ⛔ en cola |
| Limpieza test CLI-007/8/9 + `OFICINA_SYNC_SECRET` real | ✅ 20-jul: el semáforo muestra los 7 reales (sin `__TEST__`) · secret YA estaba configurado (Luciano) · residual Errores=1 → Parte D del encargo northstar-reset |

### Trillion — distribución / vigilancia (comparativa A) → PAUSA (cliente) o gatillo
| ID | Qué | Estado |
|---|---|---|
| A1 | Panel vigilancia multi-superficie | ⏸️/🧊 bloqueado B8 (datos reales) |
| A3/A4 | Playbooks lead-magnet / roster público | ⏸️ B7 (cliente/captación) |
| A5 | Roadmap público + upvoting | 🧊 gatillo B7 |
| A6 | Lift retención de tu cartera | ⏸️ post-B8 |
| Forge B7d / caching B8d / B10 | 🧊 gatillo firme | 
| superpowers.md (cabo) | 🧊 = D10 self-improving, Etapa 8+ (confirmado diferido) |

### Tu administración (PLAN-MAESTRO F4a) + mejoras P4 casos paralelos
| Ítem | Estado |
|---|---|
| Facturación/cobros KAIROS propios · compras/gastos · fiscal ES calendario (C1/C5) | ⛔ no existe (necesita TUS datos) |
| Verificación ≥2 dominios (score≠verificado) · gate matriz de riesgo · credencial con vencimiento (doPost) · evals+piso · panel salud humano · neural map render | ⛔ P (sistema, a mi alcance especificar) |

### Descartados (❌ no reabrir)
Vista "Rutinas"/routine manager (WON'T) · daemon always-on/OpenClaw · stack Python · self-approval · waitlist OSS · inyectar reseñas · Bloom orbe · neural-map 2D · wake word · Kit Consulting · RLS Postgres.

---

## §2 · El plan, etapado en tandas (máximas prudentes)

> Regla: una tanda por vez, "avanzá" abre la siguiente. Cada tanda cierra con **verificar → purga → tu observación → consolidar + handoff**. Lo que toca cliente = ⏸️ hasta que levantes la pausa. Las tandas se ordenan por dependencia y por "no-cliente primero".

| Tanda | Contenido | Quién | ¿Toca cliente? | Gate de salida + Purga |
|---|---|---|---|---|
| **T0 · Cierre de base — CERRADO 20-jul** | ✅ promote AKASHA confirmado en vivo · ✅ D2 firmada (PIPELINE actualizado) · ✅ secret ya configurado · ✅ 7 reales en el semáforo. CIERRE incluye eso · QUEDA ABIERTO: Errores=1 (fantasma → Parte D del encargo northstar-reset, en T1+) | — | No | cumplido |
| **T1 · Cola técnica en curso** | Métrica CM v3 (A+B+C, ENCARGO listo) → cerebroNodo E3.5 | Code (Cowork verifica) | No | métrica desde CM andando + D17 verde · **Purga T1** |
| **T2 · Lazo e informes que rinden (F2)** | North Star enriquecido *(implementar el template)* · A1 cierre acción→métrica · A2 juicio anclado (cita el dato) · B2 botón crear-aprobación · A3 refinamientos · N2 CAPABILITIES a la voz · C1/C2 voz | Cowork spec (ENCARGO F2 §3) + Code | No (A4/Informe Mensual = ⏸️, se construye motor, no se usa con cliente) | un brief real cita el dato + cierra en aprobación 1-clic · **Purga T2 (significativa)** |
| **T3 · Motor profundo + seguridad (F7 + P4 no-cliente)** | D6 encadenado con estados · D8 memoria caliente/fría + security-scan · credencial con vencimiento (doPost secret) · gate por matriz de riesgo · verificación ≥2 dominios · evals+piso determinístico · SOUL.md (D11) · panel de Salud humano · neural map render | Cowork spec + Code (Bastión lidera seguridad) | No | selfTest+purga por módulo · **Purga T3** |
| **T4 · Tu administración (F4a)** | facturación/cobros KAIROS · gastos · fiscal ES calendario | Cowork+Code · **necesita tus facturas 2026** | No (es TU admin) pero fiscal → verificación AEAT | trimestre simulado cuadra vs tu gestor · **Purga T4** |
| **T5 · Multi-cliente profundo (F5)** ⏸️ | revisor SGIC por cliente · ficha cliente · Lift retención · actividad inter-agentes · D7 PM persistente | — | **Sí → PAUSA** | (al levantar pausa) |
| **T6 · Comercial / distribución (F3, B7)** ⏸️ | build-in-public · pipeline comercial · A3/A4 munición · playbooks | — | **Sí → PAUSA** | (al levantar pausa) |
| **T7 · Correo (F6)** | Gmail lectura luciano@ con triaje a Bandeja | Code · **Bastión primero (pleno)** | No (tu correo) | pleno Bastión aprobado ANTES de código · **Purga T7** |
| **B8 · FINAL** 🧊 | datos reales · A1 vigilancia multi-superficie · Bucket B purga (PII/conector) · RGPD · puesta-en-marcha | todos | Sí | veredicto Go del panel `puesta-en-marcha` |
| **Diferidos** 🧊 | VPS 24/7 · latencia voz C · Forge lab→prod · prompt-caching · Telegram · os@ · D10/D12 | — | — | su gatillo, no una fecha |

**80/20 del plan:** T0 (minutos) + T1 (en curso) + **T2 (el lazo que rinde)** son el núcleo no-cliente que convierte el OS de "asistente que opina" en "sistema que rinde cuentas". T3 es profundidad valiosa sin urgencia. T4 es lo que más te devuelve de tu lista original pero necesita tus datos. T5-T6 esperan a que levantes la pausa de clientes.

---

## §3 · Reparto de ejecución (AREL aplicado)

**Lo que avanzo YO ahora (bajo impacto, pasa AREL — accionado en este turno):**
- Este plan integral reconciliado (reemplaza al PLAN-MAESTRO como norte de integración; el PLAN-MAESTRO queda como su versión previa).
- **ENCARGO-CODE-F2-lazo-informes-2026-07-18.md** — plano corregido y verificado para Code (referencia el template existente, marca lo ya hecho, spec solo lo pendiente). Reemplaza al ENCARGO-Dirección de ayer.
- Propuesta de la tabla de niveles D2 actualizada al 18-jul (§4) para tu firma.

**Lo que va a Code (bash abajo, revisado 3×):** correr la cola T1 (métrica v3 ya tiene ENCARGO) y luego T2 desde el ENCARGO F2. Code ejecuta en tu Mac; git write es de Code/tuyo.

**Lo mínimo tuyo (con instrucción qué/por qué/cómo/dónde en el chat):** (1) confirmar el promote de AKASHA en `/exec`; (2) firmar la tabla de niveles D2; (3) setear `OFICINA_SYNC_SECRET` real; (4) lanzar Code en el repo con el bash. Nada de esto es cliente.

---

## §4 · Tabla de niveles D2 — propuesta actualizada al 18-jul (para tu firma)

> La del `PIPELINE.md` está marcada "corregir Luciano". La actualizo con lo movido desde el 14-jul (AKASHA, contrato status report). Revisá y corregí; con tu OK, Code la fija en `PIPELINE.md`.

Cambios propuestos vs la del 14-jul:
- **Informe Mensual KAIROS**: 0 → **1** (el contrato de status report `contratoStatusReport_` está en dev; al promoverse, sube a 1).
- **AKASHA / Oficina Universo 3D**: agregar como proceso vivo, **nivel 2** (cadena con eyeball obligatorio de Luciano antes de promover; no sube a 3 por diseño).
- **Métrica desde el CM**: agregar, **nivel 0→1** cuando la v3 cierre (hoy la celda es manual).
- Resto de la tabla: sin cambios (verificado que sigue vigente).

---

## §5 · Pre-mortem + lecturas de las capas + confianza

**Pre-mortem (por qué este plan podría fallar):**
- (a) **Reconstruir lo ya hecho.** Ya casi pasó con F1. Mitigación: este plan marca el estado REAL verificado; cada tanda RE-verifica antes de tocar (regla dura).
- (b) **"Máximas tandas" se lee como "todo junto"** y se rompe la regla de una-etapa-por-vez. Mitigación: las tandas agrupan lo *paralelizable sin dependencia*; entre tandas hay gate + purga. T2 no arranca con T1 abierta.
- (c) **T2 toca `18_direccion.js` y `11_aprobaciones.js`** — módulos con consumidores aguas abajo. Mitigación (Arquitecto + sus Senior): el ENCARGO F2 obliga a Code a mapear 2-3 consumidores de `recomendacionDelDia_`/`crearAprobacion`/lector North Star ANTES de editar.
- (d) **La pausa de clientes tapa un vencimiento real** (ver Círculo abajo).

**Supuestos (máx 3):** (1) el promote de AKASHA corrió el 17-jul 20:28 y quedó estable — 7/10, se confirma en T0. (2) el HANDOFF del repo refleja el código (no hubo dev sin actualizarlo) — 8/10. (3) A2-contrato y A5-direcciones están en dev/prod según el relevamiento — 8/10, Code confirma al abrir T2.

**Confianza global:** estado 9/10 · reconciliación 9/10 · plan/tandas 8/10.

---

*Plan maestro de integración vigente al 18-jul. Reemplaza al PLAN-MAESTRO 13-jul como norte de integración (lo extiende con estado verificado). Fuente de verdad del código: `SatoriOS/HANDOFF.md`. Gobierno: Círculo + Equipo + Bastión de fondo; AREL por paso; purga por cierre de tanda.*
