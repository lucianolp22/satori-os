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
  Tareas: ['id_tarea', 'id_proyecto', 'descripcion', 'prioridad', 'estado', 'fecha_limite', 'fecha_creacion'],
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
  Config: ['clave', 'valor']
};

// Orden de creación de pestañas en el MAESTRO.
var MAESTRO_ORDEN = ['Clientes', 'Proyectos', 'Tareas', 'Avisos', 'Bitacora', 'Aprobaciones_agregadas', 'Costos_API_consolidado', 'Gobernanza', 'Cola_tareas', 'Actividad', 'Consumo_agentes', 'Cerebro_index', 'Config'];

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
  nodos: ['id_nodo', 'tipo', 'etiqueta', 'atributos', 'estado', 'actualizado_en'],
  aristas: ['id_arista', 'origen', 'destino', 'tipo', 'peso', 'atributos', 'actualizado_en'],
  cerebro_log: ['ts', 'evento', 'id_nodo', 'id_arista', 'origen', 'detalle'],
  estado_actual: ['seccion', 'clave', 'valor', 'materializado_en'],
  objetivos: ['id_objetivo', 'horizonte', 'descripcion', 'metrica', 'valor_objetivo', 'estado', 'prioridad', 'fecha_objetivo']
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
  ['api_budget_mensual_usd', '25']
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
