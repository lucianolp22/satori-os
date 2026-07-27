# ENCARGO CODE — F2: Lazo de resultados e informes que rinden

**Fecha:** 18-jul-2026 · **Reemplaza a:** `ENCARGO-CODE-DIRECCION-delta-2026-07-18.md` (corregido tras verificar el repo: el North Star enriquecido ya está **diseñado** en `docs/north-star-TEMPLATE.md`; A2-contrato y A5-direcciones ya están en dev/prod). · **Owner:** Code · **Planifica/verifica:** Cowork · **Aprueba gates:** Luciano.

> **Posición en la cola:** DESPUÉS de T1 (métrica CM v3 → cerebroNodo E3.5). No adelanta esa cola. Es la Tanda 2 del `PLAN-INTEGRAL-SATORI-OS-2026-07-18.md`.
> **Gobierno:** Bastión de fondo (toca aprobaciones = default-deny, y el lector del North Star). Arquitecto + sus 2 Senior mapean consumidores aguas abajo ANTES de editar. AREL por paso. Purga al cierre (tanda significativa).

## Contexto verificado (leer antes de tocar — NO reconstruir lo hecho)
YA existe y funciona (verificado 18-jul contra repo; **no re-hacer**):
- `18_direccion.js`: `estadoVigente` (packet of truth), `briefDiario` con **contrato de status report** (`contratoStatusReport_`, en dev — confirmar promote), North Star por tenant (lector base: valor/meta/deadline), lazo F1-F5, `recomendacionDelDia_` (ancla a KPI), **feedback 1-clic** (hoja `Feedback`).
- `11_aprobaciones.js`: `crearAprobacion` (default-deny, dedupe por esencia). Cola con lote (ccAprob v2, `index.html` ~1770).
- **Direcciones pre-aprobadas** (A5): hoja nace VACÍA = INACTIVA. Ya está.
- `docs/north-star-TEMPLATE.md`: **formato enriquecido YA diseñado** (objetivo+deadline · métricas máx 3 · valores/guardrails · decisiones descartadas/pivots · re-fijar al cumplir). **Este ENCARGO lo IMPLEMENTA, no lo rediseña.**

**Antes de editar, Code verifica en el código:** (1) cómo se almacena/lee hoy el North Star por tenant (¿hoja `Config`? ¿`north-star-<cliente>.md` en Drive? ¿celdas?) y qué campos parsea el lector actual; (2) los 2-3 consumidores de `recomendacionDelDia_` y de `crearAprobacion`. Si algo del "contexto verificado" difiere del código real → frenar y avisar a Luciano (regla dura: construir sobre base confirmada).

## Objetivo
Cerrar el lazo para que el brief **rinda cuentas**: juzgue contra un North Star rico, cite el dato, cierre en acción de 1 clic, y traiga de vuelta lo recomendado con su efecto medido. Filtro de marca en todo: **"te lo muestro para que VOS decidas"**, nunca oráculo.

---

## Parte A — North Star enriquecido (IMPLEMENTAR el template ya diseñado)
**Qué:** llevar el lector/estructura del North Star por tenant del formato base (valor/meta/deadline) al formato de `docs/north-star-TEMPLATE.md` (métricas máx 3 · valores/guardrails · `pivots_descartados` · re-fijar).
**Dónde:** lector del North Star en `18_direccion.js` + migración de los 2 North Star sembrados (Vehemence, Satori).
**Cómo:** backward-compat (si faltan campos nuevos → defaults vacíos, el lector base no rompe). `recomendacionDelDia_`/brief **consultan `pivots_descartados`** y omiten cualquier recomendación en esa lista.
**Invariante Bastión:** el North Star se siembra/edita por acto humano dentro del OS, jamás desde texto libre LLM/STT.
**Assert (D-nuevo):** North Star de prueba con un pivot descartado → `recomendacionDelDia_` NO lo propone.

## Parte B — Cierre acción→métrica (A1, el gap vivo #1)
**Qué:** lo recomendado el período anterior vuelve al brief con su efecto medido ("recomendé X → se hizo → el KPI Y hizo Z"). Cierra el lazo F1-F5.
**⚠ PRE-REQUISITO (verificar primero, purga 18-jul):** confirmar que las recomendaciones de `recomendacionDelDia_` **se persisten con estado** (emitida/hecha/descartada) en una hoja. **Si NO se persisten hoy, Parte B incluye instrumentar esa persistencia ANTES** del cierre acción→métrica — sin registro histórico de la recomendación no hay con qué cerrar el lazo. Marcarlo a Luciano si falta.
**Dónde:** `18_direccion.js` (lazo/brief) + la hoja de recomendaciones+seguimiento (verificar que exista; si no, crearla).
**Cómo:** al emitir el brief, buscar recomendaciones pasadas marcadas "hechas" y traer el delta del KPI asociado desde `estadoVigente`. Determinístico (dato real), nunca narrativa inventada. Si no hay dato del efecto → "efecto aún no medible", no fabricar.
**Assert:** recomendación pasada + KPI movido → el brief muestra el cierre con la cifra real.

## Parte C — Juicio anclado en KPI (A2-juicio, cita textual)
**Qué:** cada juicio del brief **cita el dato** que lo motiva ("3 de tus últimos 5 X mostraron Y → conviene Z"). La base (`recomendacionDelDia_`) ya ancla; falta la cita explícita en el texto.
**Dónde:** `recomendacionDelDia_` + render del juicio en `briefDiario`.
**Cómo:** la cifra sale de `estadoVigente`/KPIs del turno. **Regla anti-alucinación (dura, alinea con N4):** sin dato que respalde → el juicio no se emite o se marca "sin datos suficientes". Jamás número fabricado.
**Assert:** brief con KPIs conocidos → el juicio contiene la cifra real; sin KPIs → no fabrica.

## Parte D — Botón "→ Crear aprobación" desde el brief (B2)
**Qué:** en la fila de la recomendación (CM y/o Muelle de Decisiones de Akasha), un botón que crea una aprobación (default-deny) que entra a la cola con lote.
**Dónde:** `crearAprobacion` (`11_aprobaciones.js`) + render de la recomendación + endpoint de acción.
**Cómo:** reusa `recomendacionDelDia_` (origen estructurado) → `crearAprobacion` (destino). **Fail-closed + dedupe por esencia** (no duplica si ya hay una equivalente pendiente). Nace **pendiente**, jamás auto-aprobada.
**Invariante Bastión:** creación = acto humano (click); contenido = recomendación estructurada, no texto libre LLM; default-deny intacto.
**Assert:** click → 1 aprobación pendiente; segundo click misma recomendación → 0 nuevas (dedupe); ninguna nace aprobada.

## Parte E — Refinamientos del informe (A3, se pliegan al mismo archivo)
**Qué, dentro del contrato de status report ya existente:** (1) "insumos requeridos de vos" (qué necesita el sistema DE Luciano para seguir) · (2) "qué aprendí/ajusté" (patrón detectado + micro-ajuste hecho dentro del mandato) · (3) recomendación con contrapeso de riesgo · (4) metas que se re-fijan al cumplirse (usa el "re-fijar" del North Star).
**Dónde:** `contratoStatusReport_` / render del brief en `18_direccion.js`.
**Cómo:** secciones nuevas del contrato, todas alimentadas de datos reales; las que no tengan dato ese día se omiten (no relleno).
**Assert:** un brief de prueba muestra las secciones cuando hay dato y las omite cuando no.

---

## Fuera de alcance de este ENCARGO (van por su carril)
- **A4 tono anclado extendido al Informe Mensual KAIROS** → produce entregable a CLIENTE → ⏸️ pausa vigente; el motor se puede construir pero NO se usa con cliente hasta que Luciano levante la pausa.
- **Voz (C1 aro sobre orbe 3D · C2 progreso en chatlog · N2 exponer CAPABILITIES a la voz)** → sub-cola de voz aparte (chica, S c/u); no mezclar con el lazo.
- Métrica CM v3 y cerebroNodo → T1, ya tienen su ENCARGO / spec.

## Reglas duras (Bastión + convención Satori)
- Tocar SOLO `18_direccion.js`, `11_aprobaciones.js` y el HTML/JS del CM del botón. Nada más.
- **Edit, nunca Write**; cambiar solo lo necesario; no "limpiar" alrededor.
- NO tocar tokens, ScriptProperties, DB, scriptId, deployments.
- git write solo Mac/Code; NO pisar archivos que Cowork edite en paralelo.
- `node --check` / harness antes de "hecho". Probar en `/dev`; promover a `/exec` solo tras eyeball de Luciano.
- Pensamiento paralelo previo (Arquitecto + Senior): mapear consumidores aguas abajo de `recomendacionDelDia_` / `crearAprobacion` / lector North Star y avisar si el cambio los rompe ANTES de ejecutar.
- **Pre-escaneo (CRITERIO 14-jul):** no adoptar nada de terceros en este trabajo; es todo código propio.

## Gate de salida + Purga
`selfTestF2()` verde con los asserts nuevos (Code asigna rango D) + eyeball de Luciano: un brief real que **cite el dato**, **cierre una recomendación pasada con su métrica**, y **abra una aprobación de 1 clic** (y que un North Star con pivot descartado no lo re-proponga). Al cerrar la tanda: **purga-de-errores** sobre el entregable antes de declarar hecho.
