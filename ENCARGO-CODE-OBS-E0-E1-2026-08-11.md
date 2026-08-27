# ENCARGO CODE — OBS · E1 (MÓDULO Cartera/Pipeline) · 11/08/2026 · **v2**

> **Changelog v2 (11-ago tarde):** T0 ✅ HECHO por Code (`c72cca3`, criterio cruda-sin-fallback aprobado). Altos de Purga #1/#2 CERRADOS con evidencia (plan §7). **D1 resuelta por Luciano: MÓDULO COMPLETO ya** — derogación consciente de F3 §2.5, registrable en decision log. Fuente de datos = cartera **v2** (16 tibios; Noor→Nook Coffee, Alex Barbershop=DAM).
> **Gate de arranque: CUMPLIDO — `/exec` @41 (11-ago 13:15). T1 HABILITADA.**
>
> **Insumos frescos del cruce read-only de Cowork (export Drive 11-ago ~14:20) — usar, no re-descubrir:**
> - Roster real: CLI-000 OV `activo` · CLI-001 MesaQuince **ya está `potencial`** (solo setear `etapa_comercial=tibio`, no tocar estado ni conector) · CLI-002 Vehemence `activo-piloto` · CLI-003 LCT / CLI-004 DAM / CLI-007 EJF `activo` · CLI-005 SIP `potencial`. **No existe CLI-006** (hueco en la secuencia: no reutilizarlo, `nextId` sigue).
> - **EJF (CLI-007) = UN solo tenant, dos líneas de negocio:** EJF (cartera de inversiones) + Figueras Music (marca DJ progressive). Cargar en notas del roster; NO crear alta aparte.
> - ⚠ **T1.pre — `cerebro_url` no apareció en Config** tras el `setup()` de 13:01 (el export muestra `voz_url`/`oficina_url` ts.net pero no `cerebro_url`). Diagnosticar (¿siembra corrió con HEAD viejo? ¿forEach saltea?) y dejarla sembrada — sin eso el botón 🧠 queda oculto (fail-closed correcto, pero hay que cerrarlo).
> - Avatares en Config: 8 cargados (director/vigía/conciliador/cobrador/analista/abastecedor/bandeja/cerebro, Drive thumbnail w512). Los 8 lab (flux…lift) sin avatar NI arte → E2, no esta tanda.

## T1 · MÓDULO Cartera + pipeline comercial (post-promote)

**Fuente de datos:** `CARTERA-COMERCIAL-SATORI-2026-08-11.md` **v2** (raíz del repo). No inventar estados: la tabla manda. **Primer paso obligatorio (lo pediste vos):** cruzar la tabla v2 contra el roster real del MAESTRO y loguear el diff (existentes/faltantes/discrepancias) ANTES de escribir nada.

**T1.0 — Decision log:** en el seed, `registrarDecision` (alcance sistema): «11-ago: derogación consciente de F3 §2.5 — módulo pipeline se construye sin las 3 corridas manuales, por decisión de Luciano con la regla a la vista. El módulo muestra y registra; NO automatiza seguimiento (eso sigue gateado por aprobaciones + escalera).»

**T1.a — Schema (2 columnas nuevas en el roster del MAESTRO):**
- `etapa_comercial` (texto: `frio|tibio|caliente|activo|en_pausa|perdido`) y `logo_url` (texto, puede quedar vacía → fallback inicial).
- ⚠ **LISTA-CONTRATO ×2:** el roster lo consumen varios módulos. `grep -rn "MAESTRO_ORDEN\|CLIENTE_ORDEN" src/` — clasificar CADA uso (definición / indexOf / acceso con guard). Recordar el precedente `isSheetHidden` (23-jul): agregar columna NO es aditivo si algún consumidor fija forma por índice o largo. Los asserts que cuenten columnas se actualizan a la forma nueva EN EL MISMO COMMIT (derivar de la fuente, no clavar números).
- Migración idempotente: si la columna ya existe, no duplicar (patrón `ensureSheet`).

**T1.b — Seed de datos (una corrida, idempotente):**
- Función editor `seedCartera2026_08_11()` — **sin argumentos, sin `_` final** (regla del desplegable), con `_soloOwner_`.
- Marca `etapa_comercial` de los existentes (CLI-001 MesaQuince→`tibio` ⚠ SIN tocar su conector; CLI-002/003/004/007→`activo`; CLI-005 SIP→`tibio`) y da de alta los tibios nuevos que NO existan como `potencial` vía `crearCliente` (dry-run primero: log de qué haría). JAMÁS pisar filas existentes.

**T1.c — MÓDULO Cartera en el CM (D1: completo, no solo vista):**
- Sección «Cartera» propia desde el CM: **kanban por etapa** (`frio → tibio → caliente → activo → en_pausa → perdido`), card = nombre + logo (`logo_url` con fallback inicial, patrón avatar E1.1) + servicio a ofrecer + **próxima acción + fecha** + días-en-etapa.
- **Campos de seguimiento en el roster** (mismas reglas lista-contrato de T1.a): `prox_accion` (texto) · `prox_accion_fecha` (ISO) · `etapa_desde` (ISO, la setea el mover).
- **Historial de etapa append-only:** hoja `Cartera_log` en el MAESTRO (`fecha | id_cliente | de | a | nota`) — se escribe en cada movimiento; jamás se edita ni borra (patrón bitácora). Alta en `MAESTRO_SHEETS` (lista-contrato).
- Mover de etapa = endpoint gateado `_soloOwner_` + alta en `ENDPOINTS_UI` (`22_seguridad.js`) **en el mismo commit** (anti-drift, assert D19c). Valida id vs roster y etapa vs enum; escribe celda + `etapa_desde` + fila de log.
- **Señal pasiva (no automatización):** el brief diario suma 1 línea si hay `prox_accion_fecha` vencida (patrón `_vigLineasBrief_`). NADA más automático — el seguimiento activo queda gateado por aprobaciones + escalera (condición de la derogación D1).
- ⚠ Regla overlay (01-ago): si el panel se monta a nivel `<body>`, z-index >300 + tokens de tema propios.
- Registro satori-design: **operativo** (datos densos), no marca.

**T1.d — Asserts nuevos (selfTest + harness):**
- Roster: columnas nuevas presentes y `etapa_comercial` de un cliente test ∈ enum válido.
- Endpoint mover-etapa: rechaza id fuera del roster (aislamiento, regla 3) y etapa fuera del enum; mover escribe fila en `Cartera_log` y `Cartera_log` NUNCA decrece (append-only).
- `seedCartera2026_08_11` corrida 2× no duplica (idempotencia).
- Derivar conteos de la fuente (`*_ORDEN.map`), no números clavados.

**Verificación (nunca «listo» sin evidencia):** `node _harness.js` 0 fallos → `_verificar_index.py` → diff repo↔GAS → `clasp push` → selfTest tramos en editor (Luciano) → eyeball de la vista (Luciano) → Purga de cierre de E1.

**T1.b bis — Seed cartera v2:** tibios nuevos a dar de alta como `potencial` si no existen: Pol Train · Pipol Coffee · Nook Coffee · Alejandro Bono Seguros · Tech Log · Galgo · Maravillas Piedras y Minerales · Activarte Barcelona · Crocante · Constructora Tullio CBA · Raro Coffee · Café Sando · Couleur Café · Oxaca Badalona. MesaQuince→`tibio` (sin tocar conector) · SIP→`tibio` · CLI-002/003/004/007→`activo`. EJF: dejar nota `Figueras Music` en el campo notas (¿tenant aparte? lo decide Luciano después — NO crear alta nueva).

**Fuera de alcance de esta tanda (NO hacer):** avatares/logos en Akasha/Edificio (E2) · Ficha propia (E3) · solapas Ficha 360 (E4) · Capa 3 Hilos (E5, reactivada por D2 — es la tanda siguiente). Una etapa por vez.
