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
  Clientes: ['id_cliente', 'nombre', 'rubro', 'estado', 'url_sheet_cliente', 'responsable_lado_cliente', 'fecha_alta'],
  Proyectos: ['id_proyecto', 'id_cliente', 'nombre', 'estado', '%_avance', 'fecha_objetivo', 'proximo_hito', 'fecha_ultimo_movimiento'],
  // Tareas-v2 F1 (07-jul): +tipo (cliente|periodica|objetivo|personal|admin) +etiquetas (CSV)
  // +recurrencia (1d|1s|2s|1m) +orden (timeline F3). ensureSheet reconcilia headers ADITIVO.
  Tareas: ['id_tarea', 'id_proyecto', 'descripcion', 'prioridad', 'estado', 'fecha_limite', 'fecha_creacion', 'tipo', 'etiquetas', 'recurrencia', 'orden'],
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
  Config: ['clave', 'valor']
};

// Orden de creación de pestañas en el MAESTRO.
var MAESTRO_ORDEN = ['Clientes', 'Proyectos', 'Tareas', 'Avisos', 'Bitacora', 'Aprobaciones_agregadas', 'Costos_API_consolidado', 'Gobernanza', 'Cola_tareas', 'Cola_archivo', 'Actividad', 'Consumo_agentes', 'Cerebro_index', 'Bandeja', 'Feedback', 'Recomendaciones', 'Agenda', 'Direcciones', 'NS_serie', 'Config'];

// ── Pestañas de cada Sheet CLIENTE (0.3 + esquema de Aprobaciones de 0.2) ────
var CLIENTE_SHEETS = {
  Datos_operativos: ['fecha', 'concepto', 'valor', 'fuente', 'notas'],
  KPIs: ['fecha', 'kpi', 'valor', 'objetivo', 'alerta'],
  // Esquema completo de 0.2 (append-only).
  Aprobaciones: ['id', 'fecha_creacion', 'cliente', 'modulo', 'patron', 'tipo_accion', 'descripcion', 'payload', 'monto', 'confianza_%', 'estado', 'decidido_por', 'fecha_decision', 'resultado_ejecucion', 'notas'],
  Excepciones: ['id', 'fecha', 'modulo', 'contexto', 'payload', 'estado', 'resolucion', 'regla_creada'],
  // P2: cliente implícito (es el Sheet del cliente). Sin fila → default deny.
  Umbrales: ['tipo_accion', 'umbral_EUR', 'aprobador'],
  Costos_API: ['timestamp', 'modulo', 'endpoint', 'tokens_in', 'tokens_out', 'USD'],
  // Per Auditor 0.2: nacen como "propuesta", se activan vía P1.
  Reglas: ['id_regla', 'origen', 'condicion', 'accion', 'estado'],
  // ── Etapa 8a — Cerebro (grafo de memoria) por tenant. Sensibles (ocultas+protegidas). ──
  nodos: ['id_nodo', 'dimension', 'tipo', 'etiqueta', 'atributos', 'relevancia', 'cobertura', 'estado', 'fuente', 'actualizado_en'],
  aristas: ['id_arista', 'origen', 'destino', 'relacion', 'tipo', 'peso', 'atributos', 'actualizado_en'],
  cerebro_log: ['ts', 'evento', 'id_nodo', 'id_arista', 'origen', 'detalle'],
  estado_actual: ['seccion', 'clave', 'valor', 'materializado_en'],
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
var CLIENTE_SHEETS_SENSIBLES = ['Aprobaciones', 'Costos_API', 'Reglas', 'Umbrales', 'Excepciones', 'nodos', 'aristas', 'cerebro_log', 'estado_actual', 'objetivos'];

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
  ['voz_url', 'http://127.0.0.1:8787'],
  ['oficina_url', 'http://127.0.0.1:8420'],
  // E1.1 — slots de avatar por agente (arte IA cargado como DATO, sin tocar código). Vacío => el CM
  // cae al placeholder con inicial + color de acento. Clave = 'avatar_' + clave del agente.
  ['avatar_director', ''],
  ['avatar_vigia', ''],
  ['avatar_conciliador', ''],
  ['avatar_cobrador', ''],
  ['avatar_analista', ''],
  ['avatar_abastecedor', '']
];
// PURGA #11/#12: 'cursor_sync' era decorativo (se escribía, nunca se leía) → removido.
// 'timezone' se quitó del seed: la fuente de verdad de la zona es TZ en 07_util.js;
// dejarlo en Config invitaba a creer que se podía cambiar desde la hoja. 'tipo_cambio_usd_eur'
// SÍ se usa ahora (consolidación de costos USD→EUR en 05_costos.js).

// Columnas que DEBEN guardarse como texto plano (formato '@'): IDs y claves que
// Sheets coaccionaría a fecha/número si la celda queda en formato Automatic.
// Caso real: 'APR-0001' → Sheets lo lee como abril 0001 (Date), el id releído no matchea.
// NO incluir fechas ni montos: E1 está verificada con su comportamiento (Date/number) actual.
var COLUMNAS_TEXTO = ['id', 'id_cliente', 'id_proyecto', 'id_tarea', 'id_regla', 'tarea_id', 'aprobacion_id', 'mes', 'worker', 'id_nodo', 'id_arista', 'id_objetivo'];

// Estados válidos (referencia; no se valida duro en Etapa 1).
var ESTADOS_CLIENTE = ['activo', 'activo-piloto', 'potencial', 'pausado'];
var ESTADOS_APROBACION = ['pendiente', 'aprobada', 'editada', 'rechazada', 'expirada'];
