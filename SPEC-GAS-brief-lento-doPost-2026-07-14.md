# SPEC (server GAS) — `doPost` `brief` tarda ≥30s · hallazgo del encargo voz-colgada · 14/07/2026

> **Estado:** hallazgo abierto, NO implementado. El encargo de voz (agent.py) sólo blindó el
> **cliente** (timeout duro 25s + fallback hablable). La causa RAÍZ es server-side y vive acá.
> Regla dura del encargo: si el diagnóstico apunta al `doPost` GAS, FRENAR y dejar spec aparte.

## Evidencia (log del agente, job `AJ_ffLarVEYuxBW`, 14-jul 08:22–08:24)
- `brief` #1 arranca 08:22:35 → falla 08:23:05 con `HTTPSConnectionPool(host='script.google.com'): Read timed out (read timeout=30)`. **GAS tardó los 30s enteros en devolver el body.**
- El usuario, sin respuesta a los ~18s, habla ("Sato"); LiveKit cancela la speech pero el thread HTTP bloqueado no se puede matar, y dispara un `brief` nuevo. Se encadenaron **4 llamadas** `brief` (08:22:35, 08:22:58, 08:23:23, 08:23:50), cada una colgada ~25-30s → ninguna llegó a hablarse (el `ToolError` caía en una speech ya cancelada).

## Qué NO es la causa (verificado en código, read-only)
- `briefDiario` / `briefDiarioSistema_` (`src/18_direccion.js:148,155`) es **lectura pura**: NO llama `conLock`. Lee `Tareas` y `Bandeja` con `leerTabla`.
- `conLock` (`src/07_util.js:145`) = `LockService.getScriptLock().waitLock(20000)` (20s). Lo toman `drenarCola` (cada 5 min, `src/12_cola.js:51`), `sincronizarConectores` (8h) y las escrituras.
- ⇒ **Como `brief` nunca pide el lock, un lock tomado NO lo bloquea directamente.** La hipótesis "lock explica el cuelgue" del pedido #4 **no se sostiene** para la ruta de lectura. Descartada con evidencia de código.

## Causa probable (a confirmar con instrumentación en GAS)
Latencia de ejecución server-side de GAS sobre la ruta de lectura del `brief`:
- overhead conocido del `doPost` (~13s baseline, HANDOFF) + contención de `SpreadsheetApp` cuando otra ejecución concurrente (p.ej. `drenarCola`/su `flush`) está tocando el MAESTRO, o cold container / scheduling de GAS.
- No se puede afirmar el desglose sin timestamps DENTRO del `doPost`.

## Propuesta (NO implementar sin OK de Luciano)
1. **Instrumentar** el `doPost` (`src/08_webapp.js`, dispatch `case 'brief'`): `Date.now()` antes/después de `briefDiario()` y loguear el delta → medir el tiempo REAL de server y separar overhead de doPost vs render del brief. (Barato, reversible, da el número que falta.)
2. **Cache corto del brief** para la voz: `CacheService` (script cache) con TTL ~60-120s sobre el render de `briefDiarioSistema_()`. La voz leería un snapshot instantáneo; se acepta frescura de 1-2 min (coherente con T2: los números son del último cierre, no live). Elimina el cuelgue percibido sin tocar la lógica de negocio.
3. **Opcional:** `brief` express para voz (subset BLUF) si el render completo es el costo dominante.

## Enganches
- Cliente ya mitigado: `voz/agent/agent.py` `_llamar_backend` (timeout 25s → `_MSG_BACKEND_TIMEOUT`), harness `voz/agent/test_timeout_backend.py`. Aunque se arregle el server, el tope del cliente queda como red de seguridad.

---

## ADDENDUM 14-jul ~10:40 (Cowork — panel de Ejecuciones de Apps Script, read-only)
Mediciones reales que faltaban (sin instrumentar nada todavia):
- **Los 4 `brief` del incidente 08:22-08:24 COMPLETARON server-side:** 31.082s / 24.035s / 24.39s / 26.454s, estado Completada (sin error GAS). El server tarda 24-31s de verdad; solo el #1 supero el read-timeout de 30s del cliente. Es LATENCIA, no crash.
- **El push `oficina_sync` de 10:26:49 (sync-cm rechazado):** doPost v25, **45.853s → Error "El motor de JavaScript ha notificado un error inesperado. Codigo de error: INTERNAL"** — error de PLATAFORMA Google, no del codigo propio. El fail-open del cliente OV funciono como fue disenado. `oficina_sync` es idempotente (reemplazo por fuente) → reintentar es seguro.
- **HALLAZGO MAYOR — tormenta de polling del CM:** con el CM abierto, `estadoAgentes` corre cada 5s y cada llamada tarda **5-7s** (duty cycle ~100%: termina una y ya sale la otra), mas `estadoSalud` 9.2-9.9s cada 60s, `datosHoy` 4-7s cada 30s, `agendaRango`/`recomendacionesAbiertas` ~1.5s. Un CM abierto = ejecuciones GAS casi CONTINUAS → contencion de SpreadsheetApp sobre cualquier doPost concurrente (brief de voz, oficina_sync). Los incidentes de hoy ocurrieron ambos con el CM abierto en paralelo.
- `drenarCola` (cada 5 min): 2-8s, Completada siempre → NO es el problema. Hipotesis del lock ya descartada por codigo.

### Propuesta ampliada (sigue sin implementar; requiere OK de Luciano)
4. **Cache server-side de `estadoAgentes`** (CacheService 15-30s + invalidacion al escribir/accionar, cuidando el reflejo-inmediato de aprobaciones) y/o **bajar el polling del CM de 5s → 15s**. Probablemente la palanca #1: hoy `estadoAgentes` consume ~60-84s de computo GAS por minuto con el CM abierto.
5. Medir con la instrumentacion del punto 1 ANTES y DESPUES para confirmar el efecto sobre la latencia del `brief`.

## PROPUESTA APARTE — dieta de `Cola_tareas` (NO implementar; encargo separado con OK de Luciano)
**Hallazgo (14-jul, al ejecutar la dieta del feed):** el read pesado de "857 filas enteras con celdas gigantes" que se atribuía a Actividad es en realidad **`leerTabla(Cola_tareas)`** en `estadoAgentes` (`src/08_webapp.js:475`). `leerTabla` hace `getDataRange().getValues()` = lee la hoja ENTERA; la cola **no se poda ni archiva** (no hay código de archivado) → crece sin techo, y cada `estadoAgentes` (polling del CM) la lee completa, con la columna `payload` (JSON grande por fila). `feedReciente_` en cambio YA lee solo las últimas N (desde 12-jun). Ya mitigado en parte: polling 5s→15s baja la frecuencia ~3×.

**Por qué NO se toca ahora (cambia números visibles):** la misma lectura completa alimenta 3 cosas que dependen de TODA la historia de la cola:
1. **Último estado por agente** (`estadosAgentesCola_`): "la última fila de cada agente gana". Si acotamos a las últimas K filas, un agente cuya última tarea quedó fuera de la ventana mostraría `idle` aunque su verdadero último estado fuera `fail`/`ok`.
2. **Conteo de errores** (`telemetriaMaestro_`: `cola.filter(estado==='fallida').length`): acotar a K subcontaría los `fallida` viejos → la tira del CM mostraría menos errores de los reales (riesgo de ocultar un problema).
3. **Actividad de HOY por agente** (barra "Hoy"): esta SÍ es segura de acotar (las filas de hoy están al final, append-only), siempre que K > volumen diario.

**Diseño propuesto (a decidir en el encargo):**
- **Opción A — archivar la cola:** mover filas `completada`/`fallida` con >N días a una hoja `Cola_archivo` (bajo `conLock`, en `corridaDiaria`). `estadoAgentes` lee la cola viva (chica); el último-estado y el conteo de errores se computan sobre viva+resumen del archivo (un agregado precomputado, no relectura completa). Preserva semántica; agrega un job de mantenimiento.
- **Opción B — leer solo columnas necesarias con ventana + agregados persistidos:** `estadoAgentes` lee las últimas K filas para "hoy" + un agregado de `último-estado-por-agente` y `errores-del-mes` mantenido incrementalmente (o recomputado 1×/día en `corridaDiaria`, no en cada poll). Evita el archivado pero requiere un store de agregados.
- **Descartado — acotar a K a secas:** rompe (1) y (2) arriba; no hacerlo sin los agregados.
- **Verificación exigida en el encargo:** conteo de errores y último-estado-por-agente IDÉNTICOS antes/después sobre una cola real (o snapshot), no solo "anda más rápido".

### Nota UX menor (opcional, mismo batch)
La fila `Negocio paralelo pausado: no` en Datos_operativos se presta a mislectura (el concepto contiene la palabra "pausado"). Sugerencia: concepto `Negocio paralelo` + valor `activo`/`pausado` (1 linea en 08_webapp.js:157). Ademas, quien lea esa hoja por gviz debe saber: la columna valor se tipa numerica y las celdas de TEXTO vuelven null — leer por UI o castear.
