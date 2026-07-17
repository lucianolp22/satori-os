# ENCARGO CODE — AKASHA E3.4: boot rápido (carga inicial mínima) — 17/07/2026
**Origen:** pedido de Luciano 17-jul: "optimizar la velocidad de carga inicial para esperar la menor cantidad de segundos posible". Contexto: E3.3 (Akasha-home, Cowork) hace que el OS abra DIRECTO en la Oficina; el boot del CM ya corre en paralelo debajo. Medido en video (SEGUNDA PRUEBA, /dev): ~15-20s hasta interactivo. **Orden: correr E3.4 ANTES del ENCARGO métrica v3** (ambos tocan index.html y 08_webapp.js; en serie, sin rebase). Decisión final del orden: Luciano.

## El problema (medido)
Hoy el boot dispara ~8 llamadas google.script.run del CM (refrescarCentro/refrescarSalud/ccHoy + boot) MÁS ~6 de Akasha (`pedir()` de agentes/hoy/salud/recs/agenda/clientes) + la segunda ola de cerebros. Cada round-trip GAS cuesta 0.5-2s; hay solape directo (estadoAgentes, datosHoy, salud se piden DOS veces). Nota: parte de la lentitud del video es /dev (recompila HEAD en cada carga) — medir SIEMPRE en /exec para juzgar.

## Construir
1. **Endpoint agregador `bootUnico()`** (08_webapp.js, wrapper público si hace falta): UNA ejecución server que devuelva `{ agentes, hoy, salud, recs, agenda, clientes }` REUSANDO las funciones existentes tal cual (estadoAgentes, datosHoy, estadoSalud, recomendacionesAbiertas, agendaSemana, la lista de clientes que ya usa Akasha). **try/catch POR SECCIÓN**: la clave que falle viaja `null` y las demás viven — jamás todo-o-nada (paridad con el fail-closed por fuente que Akasha ya tiene en el cliente). Cero lógica nueva, cero frontera nueva, cero scopes nuevos.
2. **Akasha `cargar()`**: de N `pedir()` paralelos a UNA llamada a `bootUnico()`, manteniendo el shape `r.agentes.ok/v` del adaptador (mapear null→{ok:false}). La segunda ola de cerebros queda EXACTAMENTE como está (streaming async, timeout 12s).
3. **El CM reusa el payload**: el primer paint del cockpit (ccHoy/ccEstado/salud/feed) se alimenta del MISMO bootUnico (compartir el resultado vía una promesa/caché en memoria de página), y los timers de refresh (5s/30s/60s) siguen llamando a sus funciones como hoy. No romper `cmRestaurarSnapshot` ni `ccLimpiarManiquies`.
4. **Medición antes/después** (console.time, en /exec desktop): (a) load→umbral Akasha interactivo, (b) load→escena 3D poblada, (c) load→cerebros 7/7. Criterio de cierre: (a) < 5s y (b) < 8s en /exec; si no se llega, reportar el desglose y dónde quedó el cuello.
5. **NO CacheService en v1** (riesgo de datos viejos = anti-Bastión). Si Code cree que hace falta, proponerlo aparte con TTL y justificación — no implementarlo de una.
6. **Assert D17h** en `_asertsF2_`: `bootUnico()` devuelve las 6 claves; simulando el fallo de una sección (p.ej. hoja renombrada en fixture o stub), esa clave viene null y las otras 5 viven.

## Gates
`node --check` por archivo tocado · selfTestF2 verde (con D17h) · selfTest completo UNA vez · eyeball de Luciano en /dev (cronómetro en mano) · promoción SOLO Luciano.
