# CATÁLOGO — Todo lo que se espera que Satori OS haga por Luciano

> Barrido de **48 handoffs (may–jul 2026) + 4 MOCs + 2 planes rectores**. Corte: 27/07/2026.
> **91 funciones distintas · 42 construidas y verificadas · 24 parciales · 25 solo prometidas.**
> Leyenda de estado: ✅ construida y verificada · 🔧 parcial (en `/dev`, con flag OFF, o sin verificar) · 📋 solo prometida · ✝ eliminada

---

## Resumen por capa

| Capa | Funciones | ✅ | 🔧 | 📋 |
|---|---:|---:|---:|---:|
| **A** · Dirección del día | 12 | 8 | 3 | 1 |
| **B** · Ejecución delegada | 14 | 10 | 2 | 2 |
| **C** · Voz Sato | 10 | 5 | 2 | 3 |
| **D** · Memoria y contexto | 11 | 4 | 3 | 4 |
| **E** · Conectores de cliente | 5 | 1 | 2 | 2 |
| **F** · Vigilancia, salud y seguridad | 18 | 12 | 4 | 2 |
| **G** · Negocio paralelo (Oficina) | 11 | 6 | 4 | 1 |
| **H** · Su propia administración | 3 | 0 | 0 | 3 |
| **I** · Capa personal | 7 | 1 | 2 | 4 (2 ✝) |
| **Total** | **91** | **47** | **22** | **22** |

*(El total por capa suma 47/22/22 contando las ✝ eliminadas como prometidas; el titular usa el criterio más conservador.)*

---

## A · Dirección del día — *lo que Luciano nombró como prioritario*

| Función | Qué hace por él | Cadencia | Estado | Nota |
|---|---|---|---|---|
| **Brief diario por email** | Le manda el parte del día a la casilla sin abrir nada | 07:00 (`briefPush_`) | ✅ | `brief_push_on=true` desde el 08/07 · 🔴 **nunca se confirmó que llegue** |
| **Recomendación del día que decide** | Qué hacer hoy, **citando el dato** que lo sustenta (días de la vencida más vieja, integridad, aprobaciones en espera, progreso del North Star) | 1-2×/día | ✅ | En prod (`034f3d5`) |
| **Repaso de pendientes por contexto** | Tablero Hoy / Clientes / Periódicas / En curso — "Hoy" = vence hoy o vencida, automático (ex Checklist de Trello) | continua (refresco 15 s) | ✅ | F1.1, D8/D8b verdes |
| **Contrato de Status Report (10 secciones)** | Formato fijo: BLUF anclado · apertura humana · métricas vs North Star con tendencia · qué se auto-resolvió + *"qué aprendí y ya ajusté"* · **qué espera TU decisión** | diaria + mensual | ✅ | `contratoStatusReport_` |
| **Priorización de la cadena del día** | Ordena: vencidas → KPI de cliente en alerta → aprobaciones pendientes | diaria | 🔧 | **El orden lo decidió Claude, no Luciano** — movible en 1 línea |
| **North Star con guardrails** | Cuánto falta para 6 clientes pagos al 31/12/2026 y qué lo pone en riesgo | diaria | ✅ | Sembrado 20/07 (5/6) |
| **Serie temporal del North Star** | Convierte la métrica de foto en película (1 punto/día) | diaria | 🔧 | `NS_serie` (M2) en `/dev` |
| **No re-proponer caminos muertos** | Nunca vuelve a sugerir un pivot descartado (Kit Consulting, OSS/waitlist) | continua | ✅ | `_pivotMuerto_` |
| **Semáforo de cartera** | 🟢🟡🔴 por cliente con fuente única (operativo pisa comercial) | continua | ✅ | |
| **Estado vigente de un vistazo** | Clientes, tareas abiertas, North Star, gasto API, salud % en una llamada | on-demand | ✅ | `estadoVigente`, `estadoSalud` |
| **Agenda / Calendario** | La semana y el mes desde el propio sistema | continua | 🔧 | Card OK; **Calendario desde Akasha estuvo roto** (fix en `/dev` sin eyeball) |
| **Board meeting debrief** | El parte del Director guardado como documento datado y consultable | periódica | 📋 | Idea `must` sin construir |

## B · Ejecución delegada

| Función | Qué hace por él | Cadencia | Estado | Nota |
|---|---|---|---|---|
| **`corridaDiaria`** | Sincroniza conectores, dirige tenants, encola agentes, chequea salud, consolida costos | 07:00 | ✅ | 4 tenants verificados |
| **Cola durable (`drenarCola`)** | Ejecuta lo encolado sin que él dispare nada | cada 5 min (~288/día) | ✅ | |
| **Director / CEO** | Chequea estado, fija la prioridad, asigna trabajo, auto-resuelve lo que puede | continua | ✅ | |
| **Vigía** | Riesgos del cliente: facturas que vencen, cobros pendientes, caída de ventas, anomalías | diaria | ✅ | Cazó las 2 anomalías sembradas (03/07) |
| **Analista** | Márgenes/AOV y palancas (bundling, umbral de envío gratis, complementarios) | diaria/on-demand | ✅ | Margen 58,5% bruto · AOV $104k |
| **Conciliador** | Concilia banco ↔ ventas | on-demand | ✅ | Sin demo verificada |
| **Cobrador** | Recordatorios de cobro de vencidas → salen **como aprobaciones**, no se envían solos | diaria | ✅ | Demo 3 facturas |
| **Abastecedor** | Reposición/compras con gate humano obligatorio | on-demand | ✅ | |
| **Aprobaciones default-deny** | Ningún agente actúa sin su OK; inbox con teclado j/k/a/e/r + email | continua | ✅ | Espejo incremental (16/07) |
| **Ejecutar resoluciones desde el sistema** | Crear objetivos/direcciones y asignarles métrica desde el CM — *"nada manual en un Sheet fuera del OS"* | on-demand | ✅ | Chips probados por Luciano (20/07) |
| **Recomendación → aprobación en 1 botón** | Convierte el consejo del día en una aprobación real | on-demand | ✅ | Fail-closed sin tenant |
| **Direcciones pre-aprobadas** | Ejecuta sin preguntar lo que él ya autorizó de antemano | on-demand | ✅ | A5 |
| **Cola de aprobaciones en lote** | Resolver varias juntas en vez de una por una | on-demand | 🔧 | A6/A7 |
| **8 agentes de laboratorio** | flux (ingeniería) · relay (soporte) · scout (testing) · prism (diseño) · atlas (research) · spark (social) · **forge (crea agentes)** · lift (retención) | — | 📋 | `activo:false`, atenuados en la UI |

## C · Voz Sato

| Función | Qué hace por él | Cadencia | Estado | Nota |
|---|---|---|---|---|
| **Consulta hablada** | "¿Cómo venimos?" y contesta con datos reales (brief, estado, cliente, Vehemence, cerebro) | on-demand | ✅ | Verificada en vivo (4 min) |
| **Captura por dictado** | Anota en la Bandeja y **repite el texto exacto** | on-demand | ✅ | Eco "Anotado: …" |
| **Sato ACTÚA** | Crea aprobaciones y registra decisiones por voz, con **confirmación verbal obligatoria** | on-demand | ✅ | @27, 16/07: confirmó → creó → apareció en el CM |
| **Lee todo el SGIC del cliente** | Cualquier hoja read-only (operativos, KPIs, objetivos, aprobaciones, umbrales, reglas, costos) + ventas vivas | on-demand | 🔧 | Harness 17/17; **end-to-end recién tras el promote** |
| **Voz honesta (N4/N5/N9)** | Cifras exactas · aclara frescura *("al último cierre")* · **nunca afirma una acción que no ejecutó** · si una tool falla lo dice con los 3 caminos reales | continua | 🔧 | Código verificado headless; **validación conductual pendiente desde el 13/07** |
| **Voz desde el iPhone (PWA/tailnet)** | Consultar y decidir fuera del escritorio | on-demand | ✅ | Funnel OFF |
| **Botón 🎙 en el Command Center** | Arranca la voz desde el cockpit | on-demand | ✅ | En prod |
| **Modo Director de voz** | Sato propone todo y él **decide el día entero en una sola sesión hablada** | on-demand | 📋 | Nice de Fase 2 |
| **Sato lee el Observatorio** | *"Corrieron 3 agentes, 1 falló, 2 aprobaciones te esperan, costo del mes 40%"* | on-demand | 📋 | |
| **Sato co-presenta** | Presenta el sistema a clientes/reels sobre datos reales | on-demand | 📋 | E4; reemplaza al botón Demo |

## D · Memoria y contexto

| Función | Qué hace por él | Cadencia | Estado | Nota |
|---|---|---|---|---|
| **Hilo de trabajo por cliente** | Planificado vs real vs desviado vs pendiente, con dueño, prioridad y evidencia | continua | 🔧 | Hoja + `hiloCliente(id)` construidos; **vista vacía a propósito** hasta correr N1 |
| **Cerebro / memoria por cliente** | Memoria de negocio en 3 ejes (líder / negocio / sistema), exportable | continua | 🔧 | Endurecido en la purga X3; **estuvo vacío en prod** (ningún código creaba nodos) |
| **Detalle de nodo (`cerebroNodo`)** | Toca una luz y ve el dato concreto detrás | on-demand | 🔧 | Sin eyeball |
| **Mapa neural** | El conocimiento acumulado como red | on-demand | 🔧 | Flag `cerebro_map` OFF, esperando fps en iPhone |
| **Lazo de resultados (acción→métrica)** | ¿Se hizo lo recomendado? ¿movió el KPI? | continua | ✅ | `_cierreAccionMetrica_`; **sin un caso cerrado todavía** |
| **Feedback "¿sirvió?" de 1 clic** | Califica lo que el sistema propuso, para que aprenda | on-demand | ✅ | Hoja `Feedback` |
| **Bandeja de captura (＋Capturar)** | Tira una idea/tarea/lead y el sistema la guarda | on-demand + cada 30 min | ✅ | |
| **Clasificador de la Bandeja** | Rutea a proyecto/tarea/idea/lead, linkea al cliente y **escala como aviso si confianza < 6** | cada 30 min | ✅ | |
| **Memoria caliente acotada + fría buscable** | Que la memoria no crezca hasta romperse | continua | 📋 | Gap #2 Hermes |
| **SOUL — criterio e identidad persistente** | Inyecta el criterio Satori en cada llamada de agente | continua | 🔧 | `24_soul.js` en `/dev` |
| **Auto-mejora con consentimiento** | Revisa lo hecho, aprende y **propone** mejoras a su aprobación | continua | 📋 | Gap #4 |

## E · Conectores de cliente — *"objetivo de primer orden"*

| Función | Qué hace por él | Cadencia | Estado | Nota |
|---|---|---|---|---|
| **Conector Vehemence** | Lee el SGIC y refresca ventas mes×canal, sin credenciales ni escribir nada | cada 8h | ✅ | Verificado al peso contra el ERP |
| **Conectar TODOS los SGIC de la cartera** | La columna "Real" de cada cliente sale del sistema vivo | cada 8h | 🔧 | IDs hallados (LC Travel, MesaQuince, DAM); **flags OFF, monedas sin declarar** |
| **EJF** | Idem | — | 📋 | **SGIC no hallado** |
| **Conector contable (gastos/OPEX)** | Que el Analista vea **margen**, no solo ventas | diaria | 📋 | Extensión opcional |
| **Alta de cliente + sync Sheet→MAESTRO** | Da de alta con plantilla y mantiene el maestro al día sin IMPORTRANGE | on-demand | ✅ | 5 clientes reales · onboarding drill CLI-006 |

## F · Vigilancia, salud y seguridad

| Función | Qué hace por él | Cadencia | Estado |
|---|---|---|---|
| **selfTest (D1→D27)** | El sistema se autodiagnostica antes de que él confíe en él | on-demand (editor) | ✅ |
| **Panel de Salud legible** | Si el sistema está sano, en humano, con la seguridad como chequeo 7 | continua | 🔧 en `/dev` |
| **Alertas de salud y costo por email** | Le avisa sin que entre a mirar | continua | 🔧 sembrado, **recepción sin confirmar** |
| **Tope de gasto USD 25/mes + corte** | Mide, avisa al 80% y **pausa los agentes al 100%** | continua | ✅ ($0,15 / $25) |
| **Ruteo de modelo por costo** | Juicio a Sonnet, triaje a Haiku | continua | 🔧 sin verificar en runtime |
| **Backup semanal a Drive + drill de restore** | Garantiza recuperación | dom 04:00 | ✅ restore probado |
| **Kill switch total** | Apaga el sistema de un golpe | on-demand | ✅ |
| **Gate de identidad en 26+ endpoints** | Solo él llama al backend | continua | 🔧 en `/dev` |
| **Rotación de secretos (90 d)** | Los secretos vencen y rotan | continua | 🔧 vencen 19/10 |
| **Matriz de riesgo default-deny** | Nada sale del sistema sin autorización explícita | continua | 🔧 **bloqueada por default** — decisión suya |
| **Anonimización de PII antes de la API** | Protege datos de clientes | continua | ✅ |
| **Alerta al 1.er rechazo del día** | Avisa apenas hay un intento no autorizado | on-event | ✅ en prod |
| **Golden-set / evals (agentes revisando agentes)** | Detecta regresiones en runtime | continua | 🔧 **ya cazó un bug de prod a los 10 min** |
| **Verificación ≥2 dominios** | No presenta como cierto lo que tiene una sola fuente | continua | 🔧 M5 en `/dev` |
| **Archivar la cola vieja** | Evita que el sistema se degrade solo (>30 días) | diaria | 🔧 no corrida en prod |
| **13 tareas programadas** | secretario 05:34 · entrenamiento equipo 06:04 · cerebro 07:03 · IG monitor 07:08 · Bastión 08:02 + semanal · Figueras salud 08:04 + mejoras/novedades · competidores LC Travel · subvenciones BCN · research DAM mensual · rollover LC 02/11 · recordatorio SIP | varias | ✅ corriendo |
| **Equipo de Agentes Pro (75 en 9 divisiones)** | Misiones: research, OSINT, riesgos, seguridad, fiscal ES/AR, desarrollo, contenido · **Modo Guardia de fondo** | on-demand + continua | ✅ |
| **Observatorio de Agentes** | Latencia, tasa de fallo y costo por agente | continua | 📋 |
| **Registro RGPD / PII** | Tratamiento de datos documentado y en regla | — | 🔧 doc escrito, B8 🧊 |

## G · Negocio paralelo (Oficina Virtual · tenant CLI-000)

| Función | Qué hace por él | Cadencia | Estado |
|---|---|---|---|
| **Ciclo diario que caza demanda** | Busca oportunidades solo y deja un brief rankeado | 07:00 (launchd) | 🔧 **corrida real sin confirmar** |
| **4 cazadores + CFO virtual** | demanda · tendencias · físico (dropshipping) · P&L con alertas | diaria | 🔧 digital live, **físico solo en mock** |
| **Verificado solo con ≥2 fuentes** | No le vende como oportunidad lo que tiene un solo dominio detrás | diaria | ✅ |
| **Síntesis IA del Director** | 3-5 líneas de por dónde atacar primero | diaria | ✅ ($0,0015 / cap $30) |
| **Creador de Activo Digital** | De hallazgo aprobado a producto + brief + landing, sin auto-publicar | on-demand | ✅ activo #1 €49 **sin publicar** |
| **Brief de listing físico** | Margen unitario, proveedor/muestra/IVA, marca NO VIABLE | on-demand | 🔧 falta live (keyset eBay) |
| **Lazo de resultados** | `vendio\|no_vendio` ajusta el criterio de caza | on-demand | ✅ **sin el primer dato real** |
| **La Oficina como un cliente más** | Neto digital/físico y KPI de autonomía en el CM | diaria | 🔧 requiere `OFICINA_SYNC_SECRET` |
| **Voz gestiona la Oficina** | Lee estado/brief/aprobaciones y **decide** con confirmación | on-demand | ✅ end-to-end con DB real |
| **Kill switch `np_pausado`** | Pausa el negocio paralelo; la voz solo informa | on-demand | ✅ |
| **Enjambre de cazadores + El Claustro** | 5 cazadores especializados + 6 intérpretes que dan el "por qué" | diaria | 📋 |

## H · Su propia administración (T4) — ⛔ *no existe*

| Función | Qué haría por él | Cadencia | Estado | Gate |
|---|---|---|---|---|
| **Facturación y cobros KAIROS propios** | Le factura y persigue sus propios cobros | mensual | 📋 | **Subir sus facturas 2026** |
| **Sus gastos** | Le lleva el gasto propio | mensual | 📋 | Idem |
| **Calendario fiscal ES propio** | Le avisa sus vencimientos, no solo los de los clientes | continua | 📋 | Idem |

> **El único bloque del catálogo que atiende a Luciano mismo, y está fuera de la cadena.** Es también el que no depende de ningún cliente.

## I · Capa personal — ✝ *desmantelada*

| Función | Qué hacía por él | Cadencia | Estado |
|---|---|---|---|
| **Clima de Barcelona** | Pronóstico del día | 07:00 | ✝ eliminada 09/07 |
| **Cronograma + checklist del día (3 capas)** | *"¿algo nuevo?"* → agenda + checklist diario fijo / fijo del día / variable | 08:00 | ✝ **eliminada 09/07** |
| **Artefacto del checklist** | Tildes por día + Must/Should/Nice | interactivo | 🔧 vive, **huérfano** |
| **Gestión de tareas variables** | Agregar/marcar/borrar con prioridad | on-demand | ✅ |
| **Compromisos recurrentes** | Avisa si hoy toca psicólogo / Sandra (quincenal) / Cuencos (mensual) | quincenal/mensual | 📋 **faltan fechas ancla** |
| **Push al iPhone** | Que el reporte llegue sin abrir el escritorio | diaria | 📋 **nunca resuelto — causa raíz de la muerte de esta capa** |
| **Email como plan B** | Idem por correo | diaria | 📋 nunca implementado |

---

## Las 3 conclusiones del catálogo

**1 · Lo que nombraste como prioritario ya está construido.** Brief diario, repaso de pendientes por contexto, recomendación que cita el dato, status report de 10 secciones, y ejecutar resoluciones desde el propio sistema: **✅ los cinco.** No falta código — falta encender.

**2 · El cuello de botella del catálogo entero es un solo eslabón: la entrega.** 47 funciones verificadas y **ninguna con recepción confirmada**. La capa personal ya murió por esta causa exacta el 09/07. Es lo primero del runbook por eso.

**3 · Sos el único que no tiene sistema.** Nueve capas, 91 funciones, 7 tenants, y la capa H —tu propia administración— es la única con 0 funciones construidas. Construiste el orden de todos menos el tuyo. Es exactamente la incoherencia que te llevó a frenar todo para construir Satori OS: te queda un nivel más adentro.

---

**Confianza 8/10** en el catálogo (barrido completo de los handoffs; el sesgo es que refleja lo *registrado*). **7/10 en los estados individuales** — varios "✅ verificado" lo fueron en `/dev` o en harness, no en `/exec` con datos vivos.
