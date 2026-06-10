# Flujo: wrapper de costos (STUB — se completa en Etapa 2)

**Qué hace.** `llamadaAPI(idCliente, modulo, opciones)` (`05_costos.js`) es el único punto
por el que debe pasar TODA `UrlFetch` del sistema (handoff 1.6). Hace el fetch real
(`muteHttpExceptions`) y loguea SIEMPRE una fila en Costos_API del Sheet del cliente —
incluidas las llamadas fallidas (marca `[status]`/`[ERR]` en endpoint). Devuelve
`{ok, status, body, error}`.

**Estado Etapa 1.** Esqueleto funcional. Loguea timestamp, módulo, endpoint y lo que reciba
en `opciones` (tokens_in/out, usd); todavía NO estima tokens ni convierte a USD/€ — eso es
Etapa 2 (junto con el agregado mensual en Costos_API_consolidado del MAESTRO).

**Trigger.** Ninguno propio: se llama desde cada flujo que use APIs externas.

**Dependencias.** MAESTRO + Sheet del cliente con pestaña Costos_API. `07_util`.
Permisos: external_request (UrlFetch) + Sheets. API keys → Script Properties, nunca en código.

**Recuperación ante fallo.**
- El fetch nunca tira excepción no controlada (mute + try/catch). Si el LOGUEO falla, se
  registra en Logger pero la llamada igual devuelve su resultado (no se pierde la respuesta).
- Si un cliente no tiene Sheet/pestaña Costos_API, `logCostoCliente` lanza y queda en Logger;
  revisar que el cliente esté bien dado de alta.
