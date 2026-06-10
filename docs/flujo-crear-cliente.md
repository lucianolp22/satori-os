# Flujo: crear cliente

**Qué hace.** `crearCliente({nombre, rubro, estado, responsable_lado_cliente})`
(`03_cliente.js`) genera el Sheet del cliente con TODAS las pestañas estándar de 0.3
de una (Datos_operativos, KPIs, Aprobaciones, Excepciones, Umbrales, Costos_API,
Reglas), oculta y protege las sensibles (Aprobaciones, Costos_API, Reglas, Umbrales,
Excepciones — Auditor 0.3 #1), asigna `CLI-00N` y registra la fila en Clientes del
MAESTRO con la URL. Idempotente por nombre (no duplica). `cargaInicialClientes()`
da de alta los 5 clientes reales.

**Trigger.** Manual / `bootstrap()`. Sin trigger temporal.

**Dependencias.** MAESTRO ya inicializado (`setup()`). `07_util` (nextId, ensureSheet,
protegerSheet, appendFila). Permisos: Sheets + Drive.

**Recuperación ante fallo.**
- Si el alta falla a mitad (Sheet creado pero sin fila en Clientes): re-correr
  `crearCliente()` con el mismo nombre crea OTRO Sheet (la idempotencia mira Clientes,
  no Drive). Antes de re-correr, registrar a mano la fila en Clientes apuntando al Sheet
  ya creado, o mandar el Sheet huérfano a la papelera.
- Para cambiar estado/rubro de un cliente existente: editar la fila en Clientes a mano.
- Las pestañas sensibles quedan ocultas; mostrarlas desde el menú del Sheet si hace falta.
