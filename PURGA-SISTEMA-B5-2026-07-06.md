# PURGA DEL SISTEMA — Satori OS — B5 — 2026-07-06

**Veredicto (chairman):** sistema **sano en producción a la escala actual**. **0 Críticos que fallen hoy.** Hay un racimo de **Altos** de tres tipos: (1) uno que rompe al escalar —el O(n²) del poblado del cerebro—, (2) blindaje de seguridad en profundidad, (3) integridad del reporte de ventas cuando entren datos reales de conector (territorio B8). Panel: 2 auditores adversariales (Seguridad/Bastión + Correctitud/Escala) sobre el código real, con evidencia archivo:línea y confianza. Peer-review y re-severización aplicadas.

**Método:** deep-review paralelo (Task tool, 1 subagente por área) sobre `src/` en prod. Cada hallazgo lleva evidencia real; las sospechas sin evidencia dura van en «Hipótesis».

---

## Hallazgos consolidados (severidad final del chairman)

| # | Área | Sev. final | Hallazgo | Evidencia | Conf. | Bucket |
|---|---|---|---|---|---|---|
| 1 | Escala | **Alto** (latente-crítico) | **O(n²) en `poblarCerebro_`**: cada `upsertNodo/Arista` hace `conLock` (global) + `leerTabla` completo + a veces `nextId` (otro leerTabla). Cerca de ~250 nodos (meta del orbe) puede pegar el muro de 6 min del pase diario; peor multi-tenant por el lock global. Hoy no falla (grafos chicos). | `15_cerebro.js:34-48` (`upsertPorClave_` relee por cada upsert), `14_director.js:86-112`; lock global `07_util.js:130` | 9 | **A — arreglar en B5** |
| 2 | Seguridad | **Alto** | **Prompt-injection sin blindaje en voz→Bandeja→Haiku**: la tool `capturar` (canal autenticado por voz) mete texto crudo al clasificador Haiku SIN `blindarDatos_`/`GUARDIA_INYECCION` (que sí protegen a los agentes). Impacto acotado (mis-clasifica/mis-linkea en la Bandeja personal, que igual se revisa a mano), pero es hueco latente y el fix es mecánico. | `08_webapp.js:70` `capturar(vozStr_(...),'voz')`; `17_bandeja.js:100` INPUT sin system-guard | 8 | **A — arreglar en B5** |
| 3 | Seguridad | **Medio** | **`sanitizarCelda` no cubre `\t`/`\r`/`\n` de control** (solo `= + - @` en pos. 0). Vector primario cubierto por `appendFila`, pero un campo de fuente externa que empiece con tab/CR no se neutraliza. | `07_util.js:119` | 6 | **A — arreglar en B5** |
| 4 | Correctitud | **Medio** | **`nextId` frágil ante ID coaccionado a Date**: si una fila vieja/pegada a mano tiene el ID como fecha, el regex no matchea, subestima `max` → posible ID duplicado. `appendFila` lo mitiga solo en filas nuevas. | `07_util.js:179-191` (regex :185) | 6 | **A — arreglar en B5** |
| 5 | Correctitud | **Bajo** | **`filaConsumoAgentes_` lee-o-crea sin lock** → al cambiar de mes, dos corridas solapadas duplican la fila del mes y subcontabilizan el gasto (el guard de presupuesto lee solo la 1ª). Mitigado por drain secuencial. | `13_agentes.js:49-58` (:56 appendRow sin lock) | 5 | **A — arreglar en B5** (barato) |
| 6 | Seguridad | **Medio-Alto** | **PII a la LLM en la vía Bandeja**: `llamadaClasificador_` no pasa por `anonimizar()` → emails/teléfonos capturados salen en claro al proveedor. + los runners de agentes llaman `llamadaAPI` **sin** `nombres` → datos del tenant con nombres/CUIT/IBAN en claro. | `17_bandeja.js:124-135`; `13_agentes.js:139-142`; `05_costos.js:159` (rama `nombres` casi nunca activa) | 7 | **B — decisión (RGPD → B8)** |
| 7 | Seguridad | **Medio** | **`doPost` no chequea el kill switch salvo para `capturar`**: en PAUSA, las tools de LECTURA (`cliente`/`cerebro`) siguen sirviendo estado/PII de todos los tenants. La doc del kill switch dice "deja consultar el brief" — pero expone más que el brief. | `08_webapp.js:62` (pausa solo corta `capturar`) | 7 | **B — decisión (alcance de la pausa)** |
| 8 | Datos | **Medio-Alto** | **Conector: `status` "refunded/reembolsado" NO se excluye** (regex solo `cancel/pend/anul/borrador/draft`) → una devolución cuenta como venta; `total_ars<0` tampoco se filtra. Contamina AOV/ventas. | `19_conectores.js:120-136` | 7 | **B — B8 (datos reales) + verificar dominio de `status`** |
| 9 | Datos | **Medio** | **Conector: `pos` y `local` colapsan a la misma key** → si una fuente trae ambas convenciones el mismo mes, se suman como un canal → AOV contaminado. | `19_conectores.js:127-136` | 6 | **B — B8 + verificar dato real** |
| 10 | Datos | **Medio** | **Moneda hardcodeada ARS** en el conector, pero el sistema opera EUR/USD; `Datos_operativos` no tiene columna `moneda` → riesgo de sumar peras con manzanas. | `19_conectores.js:145-151`; `01_schema.js:42` | 6 | **B — B8 (agregar `moneda`)** |
| 11 | Correctitud | **Medio** | **`materializarEstado` lee nodos/aristas fuera del lock que puebla** → snapshot puede contar estado intermedio (auto-sana; es derivado). | `14_director.js:43-44`; `15_cerebro.js:140-143` | 7 | **C — documentar (eventual-consistente)** |
| 12 | Escala | **Medio** | **Sync/consolidar/salud-full/backup reabren cada Sheet con `openByUrl` en loop** (~1-3s c/u). Holgado con 5 clientes; a 30-40 se acercan al muro por separado. | `04_sync.js:33`; `05_costos.js:205`; `16_salud.js:45`; `21_backup.js:105-116` | 7 | **C — batch por cursor cuando crezca la cartera** |
| 13 | Correctitud | **Bajo** | `leerTabla` no dedupe headers duplicados/vacíos (la 2ª columna pisa la 1ª en silencio). Schema controlado, pero `agregarColumnasFaltantes_` podría chocar a futuro. | `07_util.js:77-89` | 5 | **C — guard opcional** |
| 14 | Seguridad | **Bajo** | `vozRate_` fail-open si `CacheService` falla (no limita). Requiere secreto válido + degradar Cache. | `08_webapp.js:122` | 6 | **C — aceptado (diseño)** |
| 15 | Correctitud | **Bajo** | Comparación lexicográfica de fechas asume ISO; una celda no-fecha pegada a mano da comparación indefinida (expiración al azar). Cubierto si toda fecha nace de los helpers. | `07_util.js:35-41`; `16_salud.js:84` | 4 | **C — validar formato si se admite entrada manual** |

---

## Confirmaciones (no son hallazgos — el auditor validó que están BIEN)

- **Auth del secreto de voz** (`vozAuth_`/`ctEq_`): fail-closed + comparación en tiempo constante por digests SHA-256. Sólido.
- **Default-deny de aprobaciones**: tipo no registrado → P1; monto sin umbral → P1; el silencio expira, nunca aprueba.
- **Gate DOMAIN de `doGet`**: fail-closed + match exacto con `OWNER_EMAIL` (no solo dominio). Bien resuelto.
- **Cola** (`12_cola.js`): claim atómico correcto (marca 'tomada' + flush dentro del lock).
- **Deuda M1 (atomicidad)**: los escritores con **ID correlativo** (`crearAprobacion/crearCliente/crearAviso/encolar/capturar/upsertPorClave_`) **ya lockean**. Los appends sin lock usan `ts`/`mes`/UUID (no correlativo) → M1 clásico NO aplica. **Deuda principal cubierta** (residuo = #5, Bajo).
- **Sin hardcodeo ni logueo de secretos**: todo en Script Properties; los `Logger.log` de error son genéricos.
- **Fecha "03 vs 06"**: NO es bug. El header usa `ahoraISO()` (real); "03" era `ultima_sync_ok` persistido (última corrida de sync). Timezone `Europe/Madrid` explícito en todos los helpers.

## Hipótesis a verificar (sin evidencia dura — no cuentan como error)
- **H1** — `pos`+`local` mezclados: verificar `SELECT DISTINCT channel` sobre la DB real de cada cliente antes de confiar en el AOV.
- **H2** — dominio real de `status` del conector: confirmar qué valores hay (¿refunded? ¿fraud?) para cerrar #8.
- **H3** — `desanonimizar` por `split/join`: si un dato contuviera el literal de un token del mapa, podría corromperse. Baja probabilidad.
- **H4** — scope `drive.file` vs `openById` del conector externo: funciona hoy (share manual); verificar que no exija scope mayor si cambia el share.

---

## Gate de salida B5

- [x] **CAPABILITIES.md autogenerado** (`_capabilities_gen.sh`, re-generable) ✅
- [ ] **0 Críticos / 0 Altos** — para cerrarlo: aplicar Bucket A (#1,2,3,4,5) + decidir Bucket B (#6,7,8,9,10 → mayoría se difiere a B8 con riesgo documentado).

**Recomendación del chairman:** Bucket A a Code ahora (soundness del sistema). Bucket B: #7 (alcance de la pausa) es una decisión rápida de Luciano; #6/#8/#9/#10 son integridad-de-datos-reales y RGPD → su lugar natural es **B8** (datos+RGPD+go-live), documentados como riesgo aceptado del piloto hasta entonces. Bucket C: documentar como deuda con gatillo (escala/entrada-manual).

*La Purga detecta y propone; NO aplica. Luciano valida qué se remedia ahora.*
