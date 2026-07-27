# ENCARGO CODE — CADENA INTEGRAL (todo lo que queda del plan) — 21-jul-2026

**Mandato de Luciano (21-jul):** basta de cuenta gotas — construir en UNA corrida encadenada todo lo pendiente del PLAN INTEGRAL, sin frenar entre módulos a pedir aprobación. Los gates humanos se comprimen en UNA revisión conjunta final en /dev. Marco: `PLAN-INTEGRAL-SATORI-OS-v3-2026-07-21.md` (leelo primero; tiene estados verificados y decisiones cerradas — no re-verificar lo que ahí dice verificado, no reabrir lo cerrado).

## AUTORIZACIONES (switches — Luciano los confirma en el prompt de arranque)

- **A1 despausa parcial** (conectores read-only + Hilo; T5/T6 siguen pausados): default **SÍ**
- **A2 correo T7** (agrega scope Gmail read-only a appsscript.json → obligará re-aceptar permisos en el gate final): default **NO** → si NO: construir SOLO el doc de spec+dictamen Bastión, cero código ni manifest
- **A3 leer carpetas de otros proyectos del Mac** (DAM, LC Travel, EJF, Vehemence, MesaQuince, Oficina Virtual) SOLO para extraer DB IDs y esquemas de sus SGICs: default **SÍ**
- **A4 pestañas nuevas** en MAESTRO y Sheets de clientes (`hilo`, las que pidan los módulos): default **SÍ**
- **A5 cadena de commits + push a /dev y GitHub sin frenar**; /exec INTOCADO: **SÍ** (dado por Luciano)
- **A6 T4 admin propia FUERA** (entra cuando Luciano suba facturas): **SÍ**

## REGLAS DURAS DE LA CADENA (no negociables)

1. Un commit por fase (`CADENA Fx: resumen`) + push /dev al cierre de fase. Guardia de drift ANTES de cada push.
2. **Lo riesgoso nace OFF:** cada conector nuevo `conector_<CLI>_on=false` en Config; correo `correo_on=false`; render pesado detrás de pref. La cadena construye, la revisión enciende.
3. `node --check` + harness offline (vm, stubs GAS) por fase. Asserts nuevos en series D21+ — el selfTest se corre UNA vez al final (editor, Luciano).
4. Mock JAMÁS · fail-closed · cifras en números · frontera de confianza intacta (valores nunca desde texto libre del LLM) · endpoint nuevo → `_soloOwner_` + alta en `ENDPOINTS_UI` en el MISMO commit · read-only sobre SGICs de clientes (allowlist de hojas; nunca config/PII).
5. Fase bloqueada → documentar en `REPORTE-CADENA-2026-07-21.md` y SEGUIR. La cadena no muere por un cabo.
6. Al final: HANDOFF.md espejo vivo + REPORTE-CADENA con: hecho/saltado/bloqueado por fase · qué flags están OFF y cómo encenderlos · guion de eyeball para la revisión conjunta (pantalla por pantalla) · lista exacta de lo que valida Luciano.
7. Verificar contra el código antes de construir CADA fase (la lección que evitó 3 reconstrucciones). Si algo del plan ya existe parcial, extender, no duplicar.

## F0 · PREFLIGHT
Drift repo↔GAS verde · working tree limpio · `node --check` de los 22 .js · leer plan v3 + este encargo entero antes de tocar nada.

## F1 · T3 MOTOR PROFUNDO (M3-M5)

**M3 — D8 memoria caliente/fría (cerebro).** Hot = `estado_actual` + eventos recientes (definir corte, p.ej. 30 días o últimos N eventos). Cold = `cerebro_log` viejo COMPRIMIDO: un job (en `corridaDiaria`, fail-silencioso) resume eventos > corte en filas-resumen por período (append, no borra el crudo: archivarlo a hoja `cerebro_log_archivo` como Cola_archivo) y `materializarEstado`/lectores consumen hot + resúmenes. Objetivo medible: `estadoVigenteCliente_` y el Director no degradan con 10× eventos. Asserts D21: el resumen conserva conteos · el crudo archivado no se pierde · lectores no cambian su contrato.

**M4 — evals + piso determinístico.** Golden-set versionado en el repo (`docs/evals/*.json` o hoja `Evals`): casos entrada→salida esperada para (a) clasificador Bandeja, (b) recomendación del día (candidatas/pivots), (c) parser quick-add, (d) normalizador de cifras. `correrEvals()` (editor/manual, 0 API para los determinísticos; los de LLM = estructura del output, no el texto exacto). Piso determinístico = los casos que NO pueden depender del modelo corren en selfTest como serie D22. Empezá con ≥20 casos reales sacados de los flujos existentes.

**M5 — verificación ≥2 dominios (score ≠ verificado).** En recomendaciones/hallazgos que citan un dato: campo `verificacion` = dominios que lo respaldan (p.ej. KPI + Datos_operativos; o conector + hoja local). Con 1 dominio → se muestra como "1 fuente" (honesto), jamás "verificado". Cablear donde ya se anclan datos (`D9 A2/A3`): el ancla existente es dominio 1; buscar el 2º si existe barato, sin inventar. Asserts D23: 1 fuente ≠ verificado · 2 fuentes coincidentes → verificado · 2 fuentes en conflicto → conflicto explícito (surfacea, no promedia).

## F2 · T3 CABEZA + RENDER (H)

**H1 — SOUL.md (D11).** `docs/SOUL.md`: identidad operativa del OS (qué es Sato, tono, invariantes de conducta: mock jamás, cifras en números, honestidad de fuentes, default-deny, confirmación verbal para escrituras por voz). El prompt de la voz (agent.py) y el clasificador lo REFERENCIAN (no duplicar texto: extraer las 5-8 reglas comunes a una constante compartida en GAS `SOUL_REGLAS` y que agent.py tenga su espejo con comentario de sync). No tocar la personalidad ya validada de la voz: consolidarla, no reescribirla.

**H2 — panel de Salud humano.** El panel E8a4 (index.html:567) muestra el estado crudo. Delta: vista humana — 7 chequeos con nombre en llano, estado, detalle de UN renglón, y "qué hacer" por hallazgo (texto fijo por tipo, no LLM). Semáforo global arriba. Sin librerías nuevas, mismo registro visual del CM (satori-design).

**H3 — cerebroNodo E3.5 (cola T1).** Endpoint `cerebroNodo(idCliente, idNodo)` (gated + `ENDPOINTS_UI`) que devuelve el detalle de UN nodo (props + aristas + últimos eventos del log que lo tocan). El grafo del Cerebro en el CM ya promete esto (index.html:3606). UI: click en nodo → panel lateral con el detalle. Bastión: el bulk sigue anónimo; el detalle solo para el owner.

**H4 — neural map render.** Capa de render del grafo (nodos+aristas del tenant) DENTRO de Akasha (2D descartado). Reusar el THREE r128 único y el patrón de estaciones existente: al entrar al Espacio de un cliente, toggle "Cerebro" que dibuja nodos como puntos orbitales agrupados por dimensión (sistema/negocio) y aristas como líneas tenues. Presupuesto de perf: no bajar de 30fps iPhone (patrón E3.7: crear bajo demanda, destruir al salir). Detrás de pref `orbe_calidad` existente o flag nuevo OFF si el fps no da.

## F3 · TC-W3 CONECTORES GENERALIZADOS (el 80/20 de la cartera)

Base verificada: `sincronizarConectorVentas_(idCliente, srcId, sheetName, fuente)` YA es genérica (19_conectores.js:51); Vehemence es un wrapper de 1 línea.

1. **Mapa por Config:** filas `conector_<CLI-00X>_db` (ID del Sheet-DB del SGIC), `conector_<CLI-00X>_tipo` (adapter), `conector_<CLI-00X>_on` (**false por default**). `sincronizarConectores()` itera el mapa y saltea los OFF.
2. **Extraer IDs y esquemas (A3):** leé los repos/CLAUDE.md/configs de los proyectos DAM, LC Travel, EJF, MesaQuince, Oficina Virtual en el Mac para identificar el Spreadsheet-DB de cada SGIC y sus hojas de datos operativos. Documentá cada ID hallado + de qué archivo salió en el REPORTE (Luciano lo valida en la revisión). Si un ID no aparece con certeza → dejá la fila de Config vacía y documentá; NO adivinar.
3. **Adapters por esquema:** cada SGIC tiene su forma (DAM 13 pestañas, LC Travel Libro, EJF Cartera…). Un adapter por tipo mapea su hoja de operaciones al contrato del conector (fecha/concepto/valor/fuente/notas o el de ventas). Superficies nuevas (ocupación, tesorería) SOLO si el esquema origen las da gratis; si no, ventas/operaciones primero y el resto documentado.
4. **Bastión:** read-only estricto (nunca escribir en el SGIC del cliente) · allowlist de hojas por adapter · sanitizado de celdas (patrón D13f) · cap de filas (`CONECTOR_AVISO_FILAS`) · sin credenciales (mismo Workspace).
5. Asserts D24 (con fixtures, sin abrir Sheets reales): adapter mapea esquema→contrato · conector OFF no corre · celda hostil sanitizada.

## F4 · TC-W1/W2/W4 HILO END-TO-END (oscuro hasta N1)

**W1 — contrato:** pestaña `hilo` en el Sheet de cada cliente (schema: `seccion` [plan|real|desviado|pendiente], `item`, `detalle`, `estado`, `evidencia`, `fecha`, `prioridad`, `dueno`) + `hiloCliente(idCliente)` (gated, `ENDPOINTS_UI`, fail-closed: sin hoja/vacía → `{sin_hilo:true}`). Espejo: script local `_hilo_sync.sh <CLI-00X> <ruta-al-HILO.md>` que parsea el md de `_cerebro/` (frontmatter + tabla) y escribe la hoja vía clasp/Apps Script API… si eso es frágil, alternativa válida: el espejo lo hace Cowork con su acceso a Sheets — entonces `_hilo_sync.sh` puede ser un parser md→CSV que deja el CSV listo y documentado. Elegí la vía más simple que funcione HOY y documentala.

**W2 — estación en el Espacio:** extender panel3 (Espacio de Cliente) de Akasha con la vista del Hilo: 4 secciones (Plan/Real/Desviado/Pendiente), semáforo del Hilo arriba, "Real" enriquecido con el numérico del conector si está ON. Sin Hilo cargado → estado vacío honesto ("Hilo no cargado — correr la skill hilo-de-trabajo"). **Absorbe** `panel cliente` del CM y F3: el panel viejo del CM redirige/embebe la misma vista (una sola fuente de render); no dejar 2 vistas vivas.

**W4 — lazo con Dirección:** `contratoStatusReport_` toma la foto del Hilo (si existe) como sección; `recomendacionDelDia_` puede citar pendientes del Hilo como candidata (respetando pivots muertos). Informe Mensual queda ⏸ (cliente).

Asserts D25: parser md→filas (fixture) · `hiloCliente` fail-closed · absorción (el panel viejo no renderiza su versión propia).

## F5 · T7 CORREO (SOLO si A2=SÍ; si NO → escribir `docs/SPEC-correo-T7.md` con todo esto y frenar acá)

Dictamen Bastión (embebido, cumplirlo tal cual): scope MÍNIMO `gmail.readonly` · solo `luciano@` · `correo_on=false` default · sin envío, sin marcar leído, sin borrar · máx N=20 por corrida, solo INBOX no procesados (label `Satori_procesado` vía… marcar labels requiere `gmail.modify` — si solo readonly, dedupe por id en hoja `Correo_visto`) · triaje al clasificador de Bandeja EXISTENTE (anonimizar: sin cuerpos completos a la API — asunto + remitente + primeras 2 líneas) · costo a Consumo_agentes · kill-switch respeta `np_pausado` y `correo_on` · asserts D26 con fixtures (parser, dedupe, anonimización), cero Gmail real en tests.

## F6 · B8-CÓDIGO + CIERRE

1. **PII Bucket B:** anonimización en capturas de Bandeja que mencionen clientes (patrón E2-6 existente) — aplicar donde la purga B5 lo dejó anotado (#6, #8-#10) con riesgo documentado si algo queda.
2. **`docs/RGPD-registro-tratamiento.md` (borrador):** qué datos de qué clientes viven en qué Sheets, base de legitimación, retención, derechos — borrador honesto para revisar con asesor; marcar "BORRADOR — no es dictamen legal".
3. **REPORTE-CADENA-2026-07-21.md:** por fase hecho/saltado/bloqueado · flags OFF y cómo encenderlos · IDs de SGIC hallados y su origen · guion de eyeball pantalla-por-pantalla para la revisión conjunta · pendientes exactos de Luciano (selfTest, N1 Hilos DAM+Vehemence, validación al peso por conector, decisión A2 si quedó NO).
4. HANDOFF.md espejo vivo + push final. **NO tocar /exec. NO correr puesta-en-marcha** (eso es de la revisión conjunta).

## AL TERMINAR
Mensaje final con: commits por fase · qué quedó OFF · el guion de revisión. La purga integral la corre Cowork sobre el REPORTE + diffs antes de la sesión de revisión con Luciano.
