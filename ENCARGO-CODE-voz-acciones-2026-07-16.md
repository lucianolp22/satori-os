# ENCARGO CODE — Voz que ACTÚA: North Star + acciones con aprobación + research diferido (16-jul)

> **Origen:** prueba de voz real post-@26 (log completo analizado por Cowork). Sato respondió PERFECTO en
> lectura (ventas por canal exactas vía sgic) pero quedó corta en 4 cosas que Luciano le pidió. Este encargo
> las cierra. **ORDEN: ejecutar DESPUÉS de `ENCARGO-CODE-F2-contrato-status-report-2026-07-16.md`** — la
> parte 2 se apoya en la hoja `Direcciones` que construye F2. Dry-run → `--go`, guardia clasp, node --check,
> py_compile, selfTest, commit + push /dev. Promote SOLO Luciano.

## Los 4 gaps del log (diagnóstico Cowork)

1. **North Star propio inexistente + confusión de tenant.** Preguntado por "mi objetivo propio profesional",
   Sato devolvió el de Vehemence (AOV 120k ARS) como si fuera el de Luciano — dos veces. El objetivo real
   ("6 clientes pagos antes del 31/12/2026") no está registrado en ningún lado del sistema.
2. **Sato no puede ESCRIBIR estructuras.** "Establecé el objetivo" → solo pudo capturar una nota a la Bandeja
   y después admitió que no se refleja en el CM. Luciano quiere: comando de voz → registrado, sin más
   interacción que su confirmación.
3. **Sin visualización del North Star en el CM.**
4. **Sin capacidad de investigar.** "¿Podés investigar en la web?" → "no puedo" seco, sin camino alternativo.

## Parte 1 — North Star propio (dato + prompt) [independiente de F2, puede ir primero]

- **Dónde vive:** `CLI-000` (tenant interno Satori/Oficina, ya existe) hoja `objetivos`. NO crear tenant nuevo;
  la regla "Satori NO es tenant" aplica a aprobaciones-desde-recomendaciones de clientes, no impide que
  CLI-000 tenga objetivos propios. **Verificá el schema real de la hoja `objetivos` antes de escribir** (nunca
  asumir columnas).
- **Seed:** función de editor `sembrarNorthStarSatori_()` idempotente que crea el objetivo:
  *"North Star Satori: 6 clientes pagos"*, meta = 6, deadline = **31/12/2026**, prioridad A, horizonte 12m
  (ajustá a las columnas reales). NOTA para Luciano en el output: el PAQUETE 10-jul sugería 31/10/2026 como
  deadline más agresivo; en voz dictó 31/12/2026 — se siembra 31/12 (lo que él dijo), cambiarlo es 1 celda.
- **Prompt agent.py (2 reglas):** (a) si la pregunta es por el objetivo PROPIO / de Satori / "mi north star"
  → consultar SIEMPRE CLI-000, JAMÁS responder con el objetivo de un cliente; si CLI-000 no tiene registro,
  decirlo tal cual (N4). (b) al citar un objetivo, decir SIEMPRE de quién es ("el de Vehemence" / "el tuyo").

## Parte 2 — Acciones de escritura con aprobación (el corazón) [requiere F2/Direcciones]

Diseño default-deny en dos velocidades:

- **Tool nueva `accion(tipo, payload)` en agent.py** (v1: un solo tipo, `crear_objetivo`) → POST al doPost de
  voz → GAS **NO escribe directo**: crea una **Aprobación P1 tipada** (payload estructurado saneado:
  `{accion:'crear_objetivo', tenant, titulo, meta, deadline}`) que cae en la cola existente del CM con botón.
  Al aprobar Luciano (1 clic), `ejecutarAccionAprobada_()` materializa la fila en `objetivos` del tenant y
  registra en Actividad. Sato confirma hablando: *"Te dejé la aprobación lista en el Centro de Mando — un
  clic y queda registrado"* (NUNCA "ya lo registré" antes del clic — regla N5 intacta).
- **Velocidad 2 (comando de voz puro):** si existe una **Dirección vigente** (hoja de F2) que matchea
  `crear_objetivo` + tenant → auto-aprueba y ejecuta EN EL MISMO TURNO, logueando "por dirección DIR-nnn".
  Sato entonces sí dice "registrado" — con el id creado como evidencia. Luciano decide si siembra esa
  Dirección (recomendado: sí para `crear_objetivo` en CLI-000; NO para tenants de clientes).
- **Confirmación verbal obligatoria** antes de disparar la tool (el patrón "¿Es correcto?" del log ya lo hace
  bien — mantenerlo en el prompt).
- **Bastión:** payload por `limpiarHostilTexto_` + `sanitizarCelda`, tenant SOLO del roster (jamás un id del
  LLM), tipo contra whitelist dura de acciones (`ACCIONES_VOZ`), cap de tamaño, todo bajo `conLock`.
  selfTest: asserts (accion desconocida→rechazo · sin Dirección→crea aprobación y NO escribe · con Dirección
  vigente→escribe y loguea · payload hostil saneado · idempotencia por eco de id).
- **Extensible:** dejar el switch preparado para tipos futuros (`crear_tarea`, `actualizar_objetivo`) pero SIN
  implementarlos en v1 — un tipo probado > cuatro a medias (escalera de maduración, nivel 0→1).

## Parte 3 — North Star visible en el CM [chico]

- `estadoAgentes` suma `north_star` al payload (objetivo activo de CLI-000: texto, meta, avance si es
  computable —clientes activos pagos vs 6—, deadline).
- Card compacta en el CM (registro A, tokens existentes; cerca de Cartera). Si no hay objetivo → card oculta
  (fail-closed, como el botón Oficina).

## Parte 4 — Research diferido (sin darle web al agente de voz) [prompt + convención]

- **Decisión de diseño (Bastión):** NO darle browsing/search API al agente de voz en v1 — contenido web =
  dato hostil directo a un canal que HABLA y ejecuta tools. El camino es DIFERIDO:
- Prompt: cuando Luciano pida investigar algo, Sato NO dice "no puedo" — dice que lo deja encargado al
  equipo y llama `capturar` con prefijo estructurado **`[RESEARCH]`** + el encargo textual.
- GAS: `clasificarBandeja` (o el paso que ya rutea la Bandeja) reconoce el prefijo `[RESEARCH]` y lo marca
  tipo `research` → aparece diferenciado en el CM y en el brief del día siguiente ("1 encargo de research
  pendiente"). La ejecución la hace Cowork en sesión (deep-research-pro) — fuera de alcance de este encargo.
- Prompt honesto: si preguntan "¿podés investigar la web?", responder "yo no directamente; lo encargo al
  equipo y te llega el informe" (capacidad real, sin promesa vacía).

## Parte 5 — STT: vocabulario del dominio (fix "Pigmento") [chico, agent.py]

En el log real el STT transcribió mal un término ("Pigmento" por algo que no era) y Sato construyó respuesta
sobre el error. Dos capas:

- **Deepgram nova-3 keyterm prompting:** pasarle al STT la lista de términos del dominio para que los
  reconozca bien: `Satori, KAIROS, Vehemence, EJF, Elías, SIP, Noor, Fresha, Pipol, Crocante, Oxaca, Sando,
  Couleur, AOV, north star, brief, SGIC, Bandeja, Cerebro, Centro de Mando, retención, tenant` (ajustá la
  lista mirando el roster real + léxico del sistema). **Verificá primero contra el plugin instalado**
  (patrón 13-jul: leer la API de `livekit-plugins-deepgram` en el venv — parámetro `keyterms`/`keywords` del
  STT según versión) — no asumir la firma. Si nova-3 es-419 no soporta keyterm en la versión instalada,
  documentarlo y aplicar solo la capa 2.
- **Prompt (regla anti-fantasma):** si en el pedido aparece un nombre propio que NO matchea ninguna entidad
  conocida (roster de clientes, agentes, sistema), Sato pregunta antes de actuar ("¿dijiste X? No lo tengo
  registrado") en lugar de asumirlo y construir sobre el error. Barato y corta la clase entera de bugs.

## Parte 6 — Self-knowledge [higiene]

Regenerar CAPABILITIES (`_capabilities_gen.sh`) para que el catálogo que Sato consulta incluya `accion`
(qué puede registrar y cómo) y el flujo `[RESEARCH]` — en el log Sato dijo "no encontré documentación sobre
cómo registrar objetivos": esa respuesta debe pasar a ser el camino real.

## Entregable

`_voz_acciones_code.sh` (dry-run/--go) + commit + clasp push /dev + HANDOFF. Recordar en el output: el
agente pega a /exec → tras el promote de esto, `kickstart -k` + prueba de voz: (1) "¿cuál es mi north star?"
→ el propio, (2) "registrá el objetivo X" → aprobación en CM o registro directo si hay Dirección, (3)
"investigame X" → encargo [RESEARCH] visible en la Bandeja, (4) mencionar "Vehemence" y un nombre
inventado → el primero se transcribe exacto, el segundo dispara la repregunta.
