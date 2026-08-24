/**
 * 01_schema.js — Definición única de pestañas y columnas (fuente de verdad del modelo).
 * Espejo exacto de ETAPA 0.3 (modelo de datos) y ETAPA 0.2 (aprobaciones).
 * No duplicar estos nombres en otros archivos: importar desde aquí.
 */

// Clave en Script Properties donde vive el ID del Sheet MAESTRO.
var PROP_MAESTRO_ID = 'MAESTRO_ID';

var MAESTRO_NOMBRE = 'Satori OS — MAESTRO';

// ── Pestañas del MAESTRO (0.3) ──────────────────────────────────────────────
var MAESTRO_SHEETS = {
  // E1 (11-ago): +etapa_comercial (pipeline) +logo_url (card de la vista Cartera). Van AL FINAL a
  // propósito — misma regla que `archivada` en Tareas (D8f): agregar al final es aditivo y ningún
  // consumidor viejo se entera, porque TODOS leen por `leerTabla` (mapea por nombre de header) y
  // ninguno accede por índice. `ensureSheet` las reconcilia solo, así que la migración es `setup()`.
  // `etapa_comercial` es ORTOGONAL a `estado`: `estado` es la relación contractual (potencial /
  // activo / …) y `etapa_comercial` es dónde está en el pipeline. MesaQuince es el caso que lo
  // prueba: `estado=activo` con conector ON, `etapa_comercial=tibio` esperando respuesta.
  // T1.e (11-ago tarde): +prox_accion +prox_accion_fecha +etapa_desde. También AL FINAL, mismas
  // reglas. Le dan CASA a lo que el encargo pedía mostrar en la card y que T1 no tenía dónde poner:
  // el «qué ofrecer» vivía prestado en `rubro`, que es rubro real y no una acción comercial.
  // `etapa_desde` la escribe `moverEtapaComercial` en CADA movimiento — de ahí salen los
  // días-en-etapa, que es la única métrica del embudo que se puede derivar sin pedirle nada a nadie.
  // Botón SGIC (17-ago): +url_exec_cliente AL FINAL, mismas reglas aditivas. Es el /exec del
  // sistema PROPIO del cliente (su web app), NO la hoja: `url_sheet_cliente` sigue siendo el
  // Sheet y no se toca. Celda vacía = estado LEGÍTIMO (cliente sin sistema propio) ⇒ los
  // consumidores ocultan el acceso en vez de mostrar un botón muerto.
  Clientes: ['id_cliente', 'nombre', 'rubro', 'estado', 'url_sheet_cliente', 'responsable_lado_cliente', 'fecha_alta', 'etapa_comercial', 'logo_url', 'prox_accion', 'prox_accion_fecha', 'etapa_desde', 'url_exec_cliente'],
  Proyectos: ['id_proyecto', 'id_cliente', 'nombre', 'estado', '%_avance', 'fecha_objetivo', 'proximo_hito', 'fecha_ultimo_movimiento', 'notas'],
  // Tareas-v2 F1 (07-jul): +tipo (cliente|periodica|objetivo|personal|admin) +etiquetas (CSV)
  // +recurrencia (1d|1s|2s|1m) +orden (timeline F3). +notas (F3, 05-ago, fila-es-documento). ensureSheet reconcilia headers ADITIVO.
  // +archivada (A.2, 07-ago): BOOLEANA y ORTOGONAL a `estado` — archivar NO es un estado (reusar
  // `estado='archivada'` rompería el mapeo de carriles de tableroTareas y tocaría los 3 estados
  // load-bearing). Celda vacía = no archivada; se lee con esVerdadero_ (07_util.js).
  // CONTRATO — la filtran los 8 consumidores del predicado "tarea viva": tareasActivasOrdenadas ·
  // tableroTareas · estadoSistema.tareas · el dedupe de clones de moverTarea · _focoPazMetricas_ ·
  // detectarVencimientos · detectarTareasEstancadas · el conteo de cartera de 18_direccion.
  Tareas: ['id_tarea', 'id_proyecto', 'descripcion', 'prioridad', 'estado', 'fecha_limite', 'fecha_creacion', 'tipo', 'etiquetas', 'recurrencia', 'orden', 'notas', 'archivada'],
  Avisos: ['id_aviso', 'origen', 'id_cliente', 'tipo', 'mensaje', 'estado', 'fecha'],
  Bitacora: ['fecha', 'id_cliente', 'observacion', 'etiqueta'],
  // Espejo de pendientes de cada Sheet cliente (solo lectura agregada — 0.3).
  Aprobaciones_agregadas: ['id', 'fecha_creacion', 'id_cliente', 'cliente', 'modulo', 'patron', 'tipo_accion', 'descripcion', 'payload', 'monto', 'confianza_%', 'estado', 'url_sheet_cliente', 'sincronizado_en'],
  Costos_API_consolidado: ['mes', 'id_cliente', 'modulo', 'llamadas', 'tokens', 'USD', 'EUR'],
  Gobernanza: ['id_cliente', 'que_corre_solo', 'que_se_aprueba', 'backup', 'link_documentacion', 'ultima_revision'],
  // ── Etapa 2 (capa Trillion) ──
  // Cola de tareas durable (Cola.gs donante adaptado). El contrato es la cola.
  Cola_tareas: ['id', 'worker', 'tipo', 'payload', 'estado', 'resultado', 'error', 'tomada_por', 'creada_en', 'tomada_en', 'completada_en'],
  // Feed de actividad de agentes → alimenta el activity feed del Centro de Mando.
  Actividad: ['ts', 'agente', 'tipo', 'id_cliente', 'texto', 'tarea_id', 'aprobacion_id'],
  // Cupos diarios por agente + gasto mensual acumulado (presupuesto de agentes).
  Consumo_agentes: ['mes', 'gasto_usd', 'corridas_json'],
  // Etapa 8a — índice AGREGADO del cerebro (sin PII; el grafo vive por tenant). Caso 20.
  Cerebro_index: ['id_cliente', 'nodos', 'aristas', 'ultimo_evento', 'estado_resumen', 'materializado_en'],
  // Fase 1 (Jarvis) — bandeja de captura personal + clasificación Haiku con confianza.
  Bandeja: ['id', 'ts', 'texto', 'fuente', 'bin', 'confianza', 'slug', 'tags', 'resumen', 'id_cliente', 'estado', 'procesado_en'],
  // T7 · correo (04-ago) — dedupe de mails ya triados. Lo natural sería etiquetar el mail en Gmail,
  // pero eso exige `gmail.modify` y la cláusula 1 del dictamen prohíbe cualquier scope de escritura:
  // esta hoja es el precio correcto por pedir solo lectura. Guarda **solo el id**, ningún contenido
  // del correo — el cuerpo, el asunto y el remitente no viven acá ni un renglón.
  Correo_visto: ['id_mensaje', 'ts', 'id_bandeja'],
  // P2 F1 (07-jul) — lazo de resultados: feedback 1-clic sobre briefs/avisos. Append-only.
  Feedback: ['id', 'ts', 'origen_tipo', 'origen_id', 'util', 'nota'],
  // P2 F4 (07-jul) — lazo completo: recomendó → se hizo (si/no) → el KPI se movió (si/no).
  // Trillion-delta B2 (08-jul): +id_cliente — si la recomendación mapea a un cliente, habilita
  // "→ Aprobación" en el CM (crearAprobacion exige tenant; Satori NO es tenant, decisión firme).
  Recomendaciones: ['id', 'fecha', 'texto', 'kpi_objetivo', 'se_hizo', 'kpi_movio', 'estado', 'cerrada_en', 'id_cliente'],
  // Norte v9 §3.5 (07-jul, decisión Luciano: opción A) — agenda semanal SIN scope de Calendar.
  Agenda: ['id', 'fecha', 'hora', 'titulo', 'id_cliente', 'notas', 'estado'],
  // F2 (16-jul) — dieta de Cola_tareas, opción A: mismo schema que Cola_tareas. Las filas
  // TERMINALES (completada/fallida) y viejas se mudan acá para que estadoAgentes/telemetría
  // sigan leyendo una Cola_tareas chica. Es archivo histórico: NADIE lo lee en el poll del CM.
  Cola_archivo: ['id', 'worker', 'tipo', 'payload', 'estado', 'resultado', 'error', 'tomada_por', 'creada_en', 'tomada_en', 'completada_en'],
  // F2 P2.8 (16-jul) — direcciones pre-aprobadas: superficie de AUTO-aprobación, default-deny
  // intacto para todo lo demás. Matcheo EXACTO (tipo_accion + alcance) y vigencia OBLIGATORIA;
  // sin wildcard de tenant. Una dirección vencida o activa=false NO matchea (ver direccionVigente_).
  Direcciones: ['id', 'tipo_accion', 'alcance', 'aprobada_fecha', 'vigencia', 'activa', 'notas'],
  // T3 M2 (21-jul) — serie temporal del North Star de SISTEMA (la consultora). UN punto por día
  // (idempotente por fecha). Le da al brief la TENDENCIA (de foto a película). La DEFINICIÓN del
  // North Star sigue en Config (ns_satori_*); acá vive SOLO la serie de resultados observados.
  NS_serie: ['fecha', 'metrica', 'actual', 'meta'],
  // TC-2 (03-ago) — DECISION LOG. Hasta hoy las decisiones de dirección vivían sueltas: en los
  // pivots del North Star, en un HANDOFF o en la cabeza de Luciano. Acá quedan con su PORQUÉ.
  // ⚠ APPEND-ONLY: una decisión NUNCA se borra ni se edita. Cambiar de opinión = revertirla
  // (estado='revertida' + `revertida_en` + `revertida_porque`), que deja el rastro de que se
  // pensó distinto y cuándo. Una decisión borrada es una lección perdida.
  // `alcance` = 'sistema' o un id_cliente: es lo que permite que Sato lea las decisiones de un
  // tenant sin ver las de otro (aislamiento §2).
  Decisiones: ['id_decision', 'fecha', 'decision', 'porque', 'alcance', 'fuente', 'estado', 'revertida_en', 'revertida_porque'],
  // TC-9 (03-ago) — FORGE: el estado de los agentes vive en DATOS, no en código. El roster de
  // `13_agentes.js` define los DEFAULTS; esta hoja los OVERRIDEA en runtime. Eso ES el hot-reload:
  // encender o apagar un agente deja de ser editar código + clasp push.
  // ⚠ La hoja solo MODULA: un id que no existe en el roster del código se ignora. El código define
  // el universo de agentes; los datos solo dicen en qué estado está cada uno.
  Agentes_estado: ['id_agente', 'activo', 'gate', 'max_dia', 'promovido_en', 'promovido_por', 'notas'],
  // ── E3 SATORI HQ (18-ago) — la ficha 360 PROPIA de Luciano ───────────────────
  // ⚠ BASTIÓN: las dos hojas son PII PERSONAL. Viven en el MAESTRO (tenant CLI-000) y NUNCA en
  // el Sheet de un cliente: el aislamiento §2 corre en las dos direcciones, y la rutina de la
  // mañana de Luciano no es dato de nadie más. Fuera de capturas de demo.
  // LAZY: NO entran en MAESTRO_ORDEN — se crean a demanda (patrón `hilo`/`checklist` del tenant),
  // así un MAESTRO viejo no falla salud por dos hojas que todavía no hicieron falta.
  //
  // `capa` = diaria_manana | diaria_cierre | semanal · `recurrencia` = 1d|1s|2s|1m ·
  // `estado` = pendiente|hecho. `fecha_check` sella CUÁNDO se tildó: sin ella la recurrencia no
  // puede saber si el tilde es de hoy o de la semana pasada (y un check viejo mentiría de verde).
  checklist_propia: ['id_item', 'capa', 'texto', 'recurrencia', 'estado', 'orden', 'fecha_check'],
  // `eje` = profesional | calidad_vida | finanzas | oportunidades · `horizonte` = corto|mediano|largo.
  // `flow_pct` es el avance declarado; `actual`/`meta` el par medible cuando `metrica` existe. Los
  // tres conviven a propósito: hay objetivos que se miden y otros que solo se declaran, y forzar
  // una métrica inventada a los segundos es peor que decir que no la tienen.
  // `sgic_sugiere` lo escribe el Director (18_direccion.js) — es la recomendación, no el hecho.
  objetivos_propios: ['id_obj', 'eje', 'horizonte', 'nombre', 'flow_pct', 'metrica', 'actual', 'meta', 'sgic_sugiere', 'estado'],
  // ⚠ DESVÍO DEL ENCARGO E3, declarado (18-ago): el encargo pedía `hqNumeros()` con «ingresos
  // recurrentes por moneda» y declaró SOLO dos schemas. Pero ese dato NO EXISTE en el sistema —
  // ni en Clientes, ni en Gobernanza, ni en ADMIN (`grep recurrent` = 0 fuentes). Sin esta hoja
  // el único origen posible era el hardcode de la maqueta, o sea la solapa mintiendo con números
  // pintados. Tercera hoja, mismo patrón lazy y misma PII.
  // `moneda` es OBLIGATORIA y no hay total global: dos monedas no se suman (lección B8/purga B5).
  // `estado` = activo | propuesta — una propuesta en curso NO es ingreso: se muestra atenuada.
  recurrentes_propios: ['id_rec', 'id_cliente', 'cliente', 'servicio', 'importe', 'moneda', 'estado', 'notas'],
  // F2 Sato Ejecutor (24-ago): bandeja de encargos (voz -> gate -> runner Claude Code). LAZY, fuera de MAESTRO_ORDEN.
  Encargos: ['id_encargo', 'ts_creacion', 'origen', 'id_cliente', 'tipo', 'repo', 'texto', 'estado', 'id_aprobacion', 'ts_inicio', 'ts_fin', 'resultado_resumen', 'artefactos', 'log_ref', 'decidido_por'],
  Config: ['clave', 'valor']
};

// Orden de creación de pestañas en el MAESTRO.
// ⚠ INVARIANTE (verificado en TC-2): MAESTRO_ORDEN ⊆ claves de MAESTRO_SHEETS. `correrSalud`
// hace `MAESTRO_SHEETS[n].forEach` por cada nombre de esta lista: un nombre sin definición de
// columnas revienta con `undefined.forEach`. Es el mismo fallo que `CLIENTE_SHEETS_SENSIBLES`
// con las hojas lazy (23-jul). Lo asera D32a1.
var MAESTRO_ORDEN = ['Clientes', 'Proyectos', 'Tareas', 'Avisos', 'Bitacora', 'Aprobaciones_agregadas', 'Costos_API_consolidado', 'Gobernanza', 'Cola_tareas', 'Cola_archivo', 'Actividad', 'Consumo_agentes', 'Cerebro_index', 'Bandeja', 'Correo_visto', 'Feedback', 'Recomendaciones', 'Agenda', 'Direcciones', 'NS_serie', 'Decisiones', 'Agentes_estado', 'Config'];

// ── LISTA-CONTRATO · etapas del pipeline comercial (E1, 11-ago) ─────────────
// El ORDEN es el del embudo y la vista Cartera pinta las columnas en este orden: cambiarlo
// reordena la UI. Agregar una etapa obliga a mirar: `moverEtapaComercial` (valida contra esta
// lista), la vista del CM (una columna por etapa) y el assert que deriva el enum de acá.
// Vacío es un valor LEGÍTIMO y distinto de todos éstos: significa "todavía no clasificado" —
// un cliente viejo que nadie tocó, no un error. Por eso el validador acepta '' explícitamente.
var ETAPAS_COMERCIALES = ['frio', 'tibio', 'caliente', 'activo', 'en_pausa', 'perdido'];
// ⚠ T7 (04-ago): agregar `Correo_visto` acá obliga a correr `setup()` en el MAESTRO vivo — es
// idempotente. Hasta que la hoja exista, `correrSalud` la reporta como faltante, el `selfTest`
// falla el chequeo de pestañas y `drillRestore` (que compara contra MAESTRO_ORDEN.length) da rojo.
// No es un bug: es el contrato haciendo ruido hasta que el Sheet se ponga al día.

// ── Pestañas de cada Sheet CLIENTE (0.3 + esquema de Aprobaciones de 0.2) ────
var CLIENTE_SHEETS = {
  // B8 · Bucket B #10 (purga B5, cerrado 21-jul): +`moneda`. El conector lee SGIC en ARS mientras el
  // sistema consolida en EUR/USD; sin la columna, sumar dos filas de distinta moneda daba un número
  // que parecía válido. Va AL FINAL: la reconciliación de ensureSheet es aditiva y los tenants
  // viejos no rompen (fila sin moneda = moneda desconocida, que es la verdad de lo ya cargado).
  Datos_operativos: ['fecha', 'concepto', 'valor', 'fuente', 'notas', 'moneda'],
  KPIs: ['fecha', 'kpi', 'valor', 'objetivo', 'alerta'],
  // Esquema completo de 0.2 (append-only).
  Aprobaciones: ['id', 'fecha_creacion', 'cliente', 'modulo', 'patron', 'tipo_accion', 'descripcion', 'payload', 'monto', 'confianza_%', 'estado', 'decidido_por', 'fecha_decision', 'resultado_ejecucion', 'notas'],
  Excepciones: ['id', 'fecha', 'modulo', 'contexto', 'payload', 'estado', 'resolucion', 'regla_creada'],
  // P2: cliente implícito (es el Sheet del cliente). Sin fila → default deny.
  Umbrales: ['tipo_accion', 'umbral_EUR', 'aprobador'],
  // TC-10 (03-ago): +cache_write/+cache_read desde `usage` de la respuesta. Van AL FINAL —
  // la reconciliación de ensureSheet es aditiva y los tenants viejos no rompen (celda vacía =
  // llamada anterior al caching, que es la verdad de lo ya registrado).
  // ⚠ `tokens_in` es el remanente NO cacheado: el prompt total es tokens_in + write + read.
  Costos_API: ['timestamp', 'modulo', 'endpoint', 'tokens_in', 'tokens_out', 'USD', 'cache_write', 'cache_read'],
  // Per Auditor 0.2: nacen como "propuesta", se activan vía P1.
  Reglas: ['id_regla', 'origen', 'condicion', 'accion', 'estado'],
  // ── Etapa 8a — Cerebro (grafo de memoria) por tenant. Sensibles (ocultas+protegidas). ──
  nodos: ['id_nodo', 'dimension', 'tipo', 'etiqueta', 'atributos', 'relevancia', 'cobertura', 'estado', 'fuente', 'actualizado_en'],
  aristas: ['id_arista', 'origen', 'destino', 'relacion', 'tipo', 'peso', 'atributos', 'actualizado_en'],
  cerebro_log: ['ts', 'evento', 'id_nodo', 'id_arista', 'origen', 'detalle'],
  // T3 M3 (21-jul) — memoria caliente/fría (D8). `cerebro_log` queda como memoria CALIENTE
  // (últimos `cerebro_corte_dias`); lo viejo se MUEVE crudo acá (mismo schema, como Cola_archivo:
  // no se pierde nada) y se resume en `cerebro_resumen`. Ver 15_cerebro.js · comprimirMemoriaFria.
  cerebro_log_archivo: ['ts', 'evento', 'id_nodo', 'id_arista', 'origen', 'detalle'],
  // Filas-resumen por período (YYYY-MM) de lo archivado: conservan el CONTEO por tipo de evento
  // para que los lectores (materializarEstado) no vean caer el total al comprimir.
  cerebro_resumen: ['periodo', 'eventos', 'tipos', 'desde', 'hasta', 'comprimido_en'],
  estado_actual: ['seccion', 'clave', 'valor', 'materializado_en'],
  // TC-W1 (21-jul) — HILO DE TRABAJO. Espejo en DATOS del `.md` que es la fuente de verdad
  // (`_cerebro/HILO - <Cliente>.md`). GAS no puede leer el Mac: el espejo lo sube `_hilo_sync.sh`.
  // `seccion` ∈ plan|real|desviado|pendiente (vocabulario CERRADO — hiloCliente descarta lo demás).
  hilo: ['seccion', 'item', 'detalle', 'estado', 'evidencia', 'fecha', 'prioridad', 'dueno'],
  // T1.2 (28-jul) — CHECKLIST de la Ficha 360. LAZY como `hilo` (no está en CLIENTE_ORDEN; la
  // crean checklistMarcar/checklistAgregar a demanda, oculta+protegida). Dos orígenes:
  //  · manual  ítems que Luciano crea desde la ficha (nacen 'pendiente', se tildan a 'hecho')
  //  · hilo    tilde de un pendiente del Hilo: se REGISTRA acá como 'hecho' con la clave del ítem
  //            (el pendiente vive en el espejo del Hilo; esta fila lo oculta de la vista y deja
  //            el rastro organizado por fecha — lo tildado queda registrado, no se pierde).
  checklist: ['id', 'item', 'detalle', 'origen', 'estado', 'creado_en', 'tildado_en'],
  // T1.4 (28-jul) — CHARLA con Sato (transcripción completa, memoria persistente del chat de la
  // Ficha 360). LAZY como checklist/hilo; sensible (contenido de trabajo con el cliente).
  // `tenant_datos` (T1.8, 29-jul): sello de origen — de qué cliente(s) salieron los datos que
  // alimentaron ese turno. Aditivo al final (reconciliación de ensureSheet); en modo ficha vale
  // SIEMPRE el id del propio cliente: es la evidencia de que no se mezcló información.
  charla: ['ts', 'rol', 'texto', 'modulo', 'tenant_datos'],
  // North Star enriquecido (20-jul): las 3 últimas son NUEVAS y se agregan al final por la
  // reconciliación ADITIVA de ensureSheet (no reordena ni borra; los tenants viejos no rompen).
  //  · metricas_extra      hasta 2 métricas más, separadas por '·'
  //  · valores             guardrails: qué NO se hace aunque acerque al objetivo, separados por '·'
  //  · pivots_descartados  caminos ya descartados ('fecha·qué·porqué', uno por línea). Solo-consulta:
  //                        recomendacionDelDia_ NO re-propone lo que está acá.
  objetivos: ['id_objetivo', 'horizonte', 'descripcion', 'metrica', 'valor_objetivo', 'estado', 'prioridad', 'fecha_objetivo',
              'metricas_extra', 'valores', 'pivots_descartados']
};

var CLIENTE_ORDEN = ['Datos_operativos', 'KPIs', 'Aprobaciones', 'Excepciones', 'Umbrales', 'Costos_API', 'Reglas', 'nodos', 'aristas', 'cerebro_log', 'estado_actual', 'objetivos'];

// Pestañas sensibles del Sheet cliente: ocultas + protegidas (Auditor 0.3 #1).
// Si en Etapa 3 el dueño del negocio abre su Sheet, no ve interna de gestión.
// ⚠ INVARIANTE ROTO A PROPÓSITO (23-jul) — LEER ANTES DE CONSUMIR ESTA LISTA:
// hasta la cadena, `CLIENTE_SHEETS_SENSIBLES` era **subconjunto de `CLIENTE_ORDEN`**, así que
// `getSheetByName(n)` sobre un cliente sano nunca daba null. **Ya no.** Las 4 últimas
// (`cerebro_log_archivo`, `cerebro_resumen`, `hilo`, `checklist`) son LAZY: no las crea `crearCliente`,
// las crean `repararCerebro` / `comprimirMemoriaFria` / `repararHilo` / `espejarHilo` /
// `checklistMarcar` / `checklistAgregar` a demanda (siempre ocultas+protegidas). En un cliente
// recién creado NO EXISTEN.
//
// ⇒ **Todo consumidor que abra estas hojas necesita null-guard.** El `selfTest` reventó con
// `TypeError: null.isSheetHidden` justo por esto (incidente 23-jul); `securityScan_` sobrevivió
// porque ya lo tenía. Regla de lista-contrato en CLAUDE.md.
var CLIENTE_SHEETS_SENSIBLES = ['Aprobaciones', 'Costos_API', 'Reglas', 'Umbrales', 'Excepciones', 'nodos', 'aristas', 'cerebro_log', 'cerebro_log_archivo', 'cerebro_resumen', 'estado_actual', 'objetivos', 'hilo', 'checklist', 'charla'];

// T3 M3 / TC-W1 — DECISIÓN EXPLÍCITA: `cerebro_log_archivo`, `cerebro_resumen` y `hilo` NO entran en CLIENTE_ORDEN.
// CLIENTE_ORDEN es el contrato que `correrSalud({full:true})` exige COMPLETO (falta ⇒ chequeo `crit`
// ⇒ email de alerta) y que `selfTest` asera sobre el cliente de prueba. Meterlas ahí abriría una
// ventana roja entre el `clasp push` y el primer `repararCerebro()`/`corridaDiaria`, por una hoja
// que es HIGIENE, no contrato. Se crean solas: `repararCerebro()` (van en CEREBRO_SHEETS) y
// `comprimirMemoriaFria()` las asegura con ensureSheet antes de escribir.
//
// `hilo` va por el mismo camino y por una razón propia: un cliente SIN Hilo cargado es un estado
// LEGÍTIMO (la skill hilo-de-trabajo es nivel 1, se corre a mano). Exigir la hoja en el contrato de
// Salud pondría en `crit` a toda la cartera por no haber corrido todavía una skill manual.
// `hiloCliente()` responde `{sin_hilo:true}` y `repararHilo()` la crea cuando se quiera.

// ── Config por defecto del MAESTRO (clave · valor) ──────────────────────────
var CONFIG_DEFAULTS = [
  ['tipo_cambio_usd_eur', '0.92'],
  ['umbral_confianza_default_%', '80'],
  ['expiracion_aprobaciones_dias', '7'],
  ['dias_estancamiento_proyecto', '7'],
  ['dias_estancamiento_tarea', '7'],
  ['ultima_sync_ok', ''],
  ['ultima_sync_intento', ''],
  ['ultima_sync_estado', ''],
  ['ultima_corrida_avisos', ''],
  ['version_modelo', '0.3'],
  // Etapa 2 — presupuesto de agentes (Trillion). El tope mensual USD también
  // puede vivir en Script Properties (API_BUDGET_MENSUAL_USD); Config es el default.
  ['api_budget_mensual_usd', '25'],
  // Fase 1 (Jarvis) — confianza < umbral en la Bandeja → escala como aviso.
  ['bandeja_umbral_confianza', '6'],
  // T3 M3 (21-jul) — corte memoria caliente/fría del cerebro. Eventos de `cerebro_log` con más
  // de N días se MUEVEN a `cerebro_log_archivo` (crudo, no se pierde) y se resumen por mes en
  // `cerebro_resumen`. 30 días = el horizonte que el Director y el brief miran de verdad.
  ['cerebro_corte_dias', '30'],
  // E1.1 (12-jul) — URLs de servicios locales que el CM abre. voz_url: orbe de voz (default Mac);
  // cambiala a la URL ts.net para operar la voz del CM desde el iPhone sin tocar código. oficina_url:
  // Observatorio de la Oficina Virtual (loopback, solo Mac por dictamen Bastión). VACÍA => el CM oculta
  // el botón (exponerla a la tailnet es decisión D4 de Luciano, no default).
  // T3-S3 — matriz de riesgo (22_seguridad.js). Editable a mano desde la hoja Config.
  // Estos valores son la SIEMBRA CONSERVADORA; el default de código (RIESGO_SIEMBRA) es el
  // mismo, así que borrar una fila no abre nada. Un valor no reconocido = bloquear.
  ['riesgo_leer_tenant', 'permitir'],
  ['riesgo_escribir_tenant', 'aprobar'],
  ['riesgo_ejecutar_agente', 'permitir'],
  ['riesgo_accion_externa', 'bloquear'],
  ['riesgo_tocar_config', 'bloquear'],
  ['riesgo_tocar_secretos', 'bloquear'],
  // H4 (T3, 21-jul) — mapa neural del Cerebro dentro del Espacio de Akasha. 'off' | 'on'.
  // Default OFF: es render 3D extra y el piso de 30fps en iPhone lo valida Luciano a ojo.
  ['cerebro_map', 'off'],
  ['voz_url', 'http://127.0.0.1:8787'],
  ['oficina_url', 'http://127.0.0.1:8420'],
  // E0 (11-ago) — Cerebro (mapa de notas, loopback). Mismo criterio que `oficina_url`: el CM lo
  // manda CRUDO y el botón nace oculto, así que vaciar esta clave APAGA el botón. Estaba
  // hardcodeado en index.html y en la PWA del iPhone era un botón muerto: 127.0.0.1 no existe
  // fuera del Mac. Cambiala a la URL ts.net para que abra desde el teléfono.
  ['cerebro_url', 'http://127.0.0.1:8788/'],
  // E1.1 — slots de avatar por agente (arte IA cargado como DATO, sin tocar código). Vacío => el CM
  // cae al placeholder con inicial + color de acento. Clave = 'avatar_' + clave del agente.
  ['avatar_director', ''],
  ['avatar_vigia', ''],
  ['avatar_conciliador', ''],
  ['avatar_cobrador', ''],
  ['avatar_analista', ''],
  ['avatar_abastecedor', ''],
  // E2 (11-ago tarde) — los 8 del LABORATORIO. Tienen slot igual que los activos: `estadoAgentes`
  // arma `avatar_url` para TODA clave de `AGENTES`, y el anillo exterior del CM (`cmOrbit2`) y los
  // chips móviles ya los pintan con `agAvatar`. Sin la clave en Config quedaban con la inicial.
  // Las carga `seedAvataresLab()` desde Drive (32_flota.js); vacías => placeholder, sin hueco roto.
  ['avatar_flux', ''],
  ['avatar_relay', ''],
  ['avatar_scout', ''],
  ['avatar_prism', ''],
  ['avatar_atlas', ''],
  ['avatar_spark', ''],
  ['avatar_forge', ''],
  ['avatar_lift', ''],
  // Carpeta de Drive donde viven los PNG de avatares. Vacía => `seedAvataresLab` busca por nombre
  // en todo lo alcanzable. NO empieza con `avatar_`, así que no la levanta configPrefijo_('avatar_').
  ['avatares_folder_id', ''],
  // TC-2 (03-ago) — GUARDIÁN FOCO/PAZ. Umbrales de sobrecarga, editables sin tocar código.
  // Defaults DELIBERADAMENTE prudentes: el guardián avisa cuando la carga es objetivamente
  // rara, no cuando el día está ocupado. Un guardián que canta todos los días se ignora a la
  // semana, y entonces no sirve para el día que de verdad importa.
  ['fp_max_vencidas_A', '3'],        // tareas de prioridad A ya vencidas
  ['fp_max_eventos_dia', '5'],       // eventos de Agenda en un mismo día de los próximos 7
  ['fp_max_aprob_estancadas', '5'],  // aprobaciones pendientes sin decidir
  ['fp_dias_aprob_estancada', '7'],  // desde cuántos días una pendiente cuenta como estancada
  // TC-3 (03-ago) — PM persistente: cada cuántos días se re-analiza un objetivo QUIETO. Sin
  // esto, un objetivo sin cambios no volvería a mirarse nunca; con esto, el seguimiento respira.
  ['pm_dias_refresco', '7'],
  // TC-9 · Forge. `aprobar` y no `permitir`: promover un agente le da permiso de gastar API y de
  // escribir propuestas sobre datos de clientes — es exactamente la clase de cosa que no se
  // automatiza. Apagar, en cambio, es libre (ver demoverAgente).
  ['riesgo_promover_agente', 'aprobar'],
  // TC-11 (04-ago) · A5 vigilancia multi-superficie — umbrales PRUDENTES (29_vigilancia.js).
  // La declaración por cliente NO va acá: vigilancia_<id>_superficies / _fuente_<sup>
  // (patrón conector_*, se cargan a mano en la hoja Config cuando el cliente lo amerita).
  ['vig_frescura_dias', '10'],       // dato más viejo que N días ⇒ el semáforo DEGRADA a gris
  ['vig_ambar_caida_pct', '10'],     // caída % de ventas (meses cerrados) que pinta ámbar
  ['vig_rojo_caida_pct', '30'],      // caída % de ventas (meses cerrados) que pinta rojo
  ['vig_aprob_dias', '7'],           // aprobación pendiente más vieja que N días ⇒ rojo
  // T7 · correo (04-ago) — cláusula 3 del dictamen Bastión: el código se despliega APAGADO y lo
  // enciende un humano después de mirarlo, igual que los conectores de F3. Cualquier valor que no
  // sea exactamente 'true' deja el correo apagado (_correoDebeCorrer_, 30_correo.js).
  ['correo_on', 'false'],
  // Lista de remitentes a descartar sin clasificar (CSV, match por substring: 'newsletter@x.com'
  // o '@x.com'). Nace VACÍA: hasta que alguien la complete se comporta como si no existiera.
  ['correo_remitentes_ignorados', '']
];
// PURGA #11/#12: 'cursor_sync' era decorativo (se escribía, nunca se leía) → removido.
// 'timezone' se quitó del seed: la fuente de verdad de la zona es TZ en 07_util.js;
// dejarlo en Config invitaba a creer que se podía cambiar desde la hoja. 'tipo_cambio_usd_eur'
// SÍ se usa ahora (consolidación de costos USD→EUR en 05_costos.js).

// Columnas que DEBEN guardarse como texto plano (formato '@'): IDs y claves que
// Sheets coaccionaría a fecha/número si la celda queda en formato Automatic.
// Caso real: 'APR-0001' → Sheets lo lee como abril 0001 (Date), el id releído no matchea.
// NO incluir fechas ni montos: E1 está verificada con su comportamiento (Date/number) actual.
// purga X3 #14: +`periodo` — es la CLAVE DE FUSIÓN de `cerebro_resumen` (upsertPorClave_). Un
// período '2026-01' sin formato '@' lo coacciona Sheets a fecha, la clave deja de matchear con la
// string que trae el plan de compresión, y cada corrida crea una fila nueva del mismo período en
// vez de fusionar: el resumen se duplica y los conteos dejan de cerrar.
// ⚠ INVARIANTE (aserido y DERIVADO en D42): toda columna `id` / `id_*` de MAESTRO_SHEETS,
// CLIENTE_SHEETS y ADMIN_SHEETS tiene que estar acá, más las claves de negocio que se usan para
// casar filas (`numero`, `numero_factura`). Si falta una, Sheets la TIPA en el round-trip
// getValues/setValues y el id deja de matchear consigo mismo.
// INCIDENTE 04-ago que obligó a escribir esto: `id_decision` no estaba ⇒ Sheets leyó **DEC-0001
// como "1 de diciembre de 2001"** (DEC = December) y D32e/f/f3/f4 cayeron en cascada al no poder
// matchear por id. Los prefijos que coinciden con un mes (DEC, MAR, ENE…) son la trampa: el resto
// (APR, AVI, TAR) sobrevivía por casualidad, no por diseño.
var COLUMNAS_TEXTO = ['id', 'id_cliente', 'id_proyecto', 'id_tarea', 'id_regla', 'tarea_id', 'aprobacion_id', 'mes', 'worker', 'id_nodo', 'id_arista', 'id_objetivo', 'periodo',
  // 04-ago: las que faltaban de las hojas nuevas (TC-2 Decisiones · TC-6 Correo_visto · TC-9
  // Agentes_estado · TC-7 ADMIN) + `id_aviso`, que nunca mordió sólo porque AVI no es un mes.
  'id_decision', 'id_aviso', 'id_agente', 'id_mensaje', 'id_bandeja', 'numero', 'numero_factura',
  // E3 HQ (18-ago): los ids de las hojas propias. `CHK-0001`/`OBJ-0001`/`REC-0001` no son
  // coercibles a fecha, pero el precedente `id_objetivo` dice que se declaran igual — el día
  // que un id cambie de prefijo, nadie se acuerda de venir a agregarlo.
  // F2 (24-ago): ids de la bandeja de encargos.
  'id_item', 'id_obj', 'id_rec', 'id_encargo', 'id_aprobacion'];

// Estados válidos (referencia; no se valida duro en Etapa 1).
var ESTADOS_CLIENTE = ['activo', 'activo-piloto', 'potencial', 'pausado'];
var ESTADOS_APROBACION = ['pendiente', 'aprobada', 'editada', 'rechazada', 'expirada'];
