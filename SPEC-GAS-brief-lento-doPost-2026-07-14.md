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
