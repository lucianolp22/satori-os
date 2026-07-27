# ENCARGO CODE — Delta de Dirección (North Star enriquecido + juicio anclado + botón crear-aprobación)

**Fecha:** 18-jul-2026 · **Origen:** REPASO-INTEGRAL 17-jul §4.2 (delta Trillion #2/#3/#4, los tres S sin gatillo) · **Owner ejecución:** Code · **Planifica:** Cowork · **Supervisa/aprueba:** Luciano.

> **Posición en la cola (NO saltar):** este encargo va **después** de la cola vigente (verificar /exec post-promote → métrica CM v3 → cerebroNodo E3.5). Son 3 mejoras chicas de la Capa de Dirección; se pueden intercalar como quick-wins entre las otras, pero no las adelantan. Nada acá bloquea la operación actual.

## Contexto (leer antes de tocar — regla "contexto primero")
La Capa de Dirección vive en `src/18_direccion.js`: `estadoVigente` (packet of truth), `briefDiario` (contrato de status report de 10 secciones), North Star por tenant (`northStarSatori_` y lector por tenant), lazo de resultados F1-F5, `recomendacionDelDia_` (ya ancla la recomendación a un KPI). Las aprobaciones viven en `src/11_aprobaciones.js`: `crearAprobacion` (default-deny, dedupe por esencia). Los asserts corren en `selfTestF2()` / `_asertsF2_` (serie D). **Antes de editar, Code confirma la ruta exacta de almacenamiento del North Star (hoja `Config` vs hoja propia vs `docs/north-star-TEMPLATE`) y el wiring real de `recomendacionDelDia_` → render del brief.** No asumir; verificar en el repo.

## Objetivo
Completar la Capa de Dirección para que el brief **rinda cuentas**: (A) juzgue contra un North Star más rico, (B) cite el dato del cliente en cada juicio, (C) permita cerrar el lazo recomendación→acción con 1 clic. Filtro de marca innegociable en los 3: **"te lo muestro para que VOS decidas", nunca "lo manejo por vos".**

---

## Parte A — North Star por tenant enriquecido

**Qué:** extender la estructura del North Star de `{valor, meta, deadline}` a:
- `valores[]` — principios/guardrails del tenant.
- `metricas[]` — varias, cada una `{nombre, objetivo, unidad}` (hoy hay 1 sola).
- `metas` — objetivos 12/24/36 meses (alineado a KAIROS Fase 3).
- `deadline` — ya existe.
- ⭐ `pivots_descartados[]` — decisiones/caminos muertos que **ni el agente ni el humano deben re-proponer** (patrón Kevin "audit pivots dead, stay focused").

**Dónde:** estructura/hoja del North Star + lector por tenant en `18_direccion.js` + `docs/north-star-TEMPLATE`.

**Cómo:**
- Backward-compat duro: si faltan los campos nuevos, defaults vacíos; el lector actual no se rompe.
- El brief y `recomendacionDelDia_` **consultan `pivots_descartados`** y omiten cualquier recomendación que caiga en esa lista.

**Invariante Bastión:** el North Star se siembra/edita por **acto humano** dentro del OS (celda/endpoint gateado), jamás desde texto libre de LLM/STT.

**Assert (D-nuevo):** con un North Star de prueba que tenga un pivot en `pivots_descartados`, `recomendacionDelDia_` NO propone ese pivot.

---

## Parte B — Juicio anclado en KPIs del cliente

**Qué:** que cada juicio/recomendación del brief **cite el dato concreto** que lo motiva ("3 de tus últimos 5 X mostraron Y → conviene Z"), con tono de espejo honesto, no de oráculo.

**Dónde:** `recomendacionDelDia_` + la sección de juicio del render de `briefDiario` en `18_direccion.js`.

**Cómo:**
- La cifra/evidencia sale del `estadoVigente`/KPIs **ya cargados** en ese turno (determinístico, nunca inventada).
- **Regla anti-alucinación (dura):** si no hay dato que respalde el juicio, el juicio no se emite o se marca explícito "sin datos suficientes para juzgar". Alinea con N4 (todo número sale de un tool de ese turno; si falla, se dice).

**Assert (D-nuevo):** brief de prueba con KPIs conocidos → el texto del juicio contiene la cifra real. Sin KPIs → no fabrica número (emite el marcador de "sin datos").

---

## Parte C — Botón "→ Crear aprobación" desde la recomendación del brief

**Qué:** en la fila de la recomendación del brief (CM y/o Muelle de Decisiones de Akasha), un botón que **crea una aprobación** a partir de esa recomendación, que entra a la cola con despacho en lote (ccAprob v2). "Briefs que deciden, no que informan."

**Dónde:** `crearAprobacion` (`11_aprobaciones.js`) como destino + `recomendacionDelDia_` como origen + el render de la recomendación (CM) + endpoint de acción.

**Cómo:**
- Reusa el par existente: `recomendacionDelDia_` (contenido estructurado) → `crearAprobacion` (default-deny).
- **Fail-closed + dedupe por esencia:** si ya existe una aprobación pendiente equivalente a esa recomendación, NO se crea duplicado.
- La aprobación nace **pendiente**, jamás auto-aprobada.

**Invariante Bastión:** la creación es un **acto humano dentro del OS** (click); el contenido viene de la recomendación **estructurada**, no de texto libre del LLM; default-deny intacto; dedupe evita spam de cola.

**Assert (D-nuevo):** click simulado sobre una recomendación → se crea exactamente 1 aprobación pendiente. Segundo click sobre la misma → 0 nuevas (dedupe). Ninguna nace aprobada.

---

## Reglas duras (Bastión + convención Satori)
- Tocar SOLO `src/18_direccion.js`, `src/11_aprobaciones.js` y el HTML/JS del CM donde va el botón. Nada más.
- **Edit, nunca Write** sobre archivos existentes. Cambiar solo lo necesario; no "limpiar" alrededor.
- **NO tocar** tokens, ScriptProperties, DB, scriptId, deployments.
- **git write solo Mac/Code.** No pisar archivos que Cowork edite en paralelo (diagnóstico en paralelo, escritura en serie).
- Verificar con `node --check` / harness antes de dar por hecho. Probar en `/dev`, promover a `/exec` solo tras eyeball de Luciano.
- Pensamiento paralelo previo: identificar 2-3 consumidores aguas abajo de `recomendacionDelDia_` / `crearAprobacion` / el lector del North Star y avisar si el cambio los rompe ANTES de ejecutar.

## Gate de salida
`selfTestF2()` verde con los 3 asserts nuevos (Code asigna el rango D, p.ej. D18a-c) + eyeball de Luciano: un brief real que **cite el dato** en su juicio y que la recomendación se **cierre en una aprobación de 1 clic** (y que un North Star con pivot descartado no lo re-proponga).

## Fuera de alcance (no hacer acá)
A1 vigilancia multi-superficie (bloqueado hasta B8/datos reales) · A5 roadmap público · A6 agente de retención · nada de voz (C1/C2 van por su carril). Este encargo son SOLO las 3 piezas de arriba.
