# PAQUETE-CODE-B5 — Remediación de la purga del sistema — 2026-07-06

**BLUF:** Cowork aplicó y validó offline las **6 correcciones** de la purga B5 (Bucket A + kill switch total) en 7 archivos `src/`. Falta: **(1) Code** pushea (`bash _b5_code.sh`), **(2) Luciano** corre `selfTest()` en el editor (gate — deben dar TODO OK los 100+ chequeos) y **promueve una versión nueva al deployment de VOZ** para que el fix #7 tome efecto. Bucket B (PII + integridad conector) **diferido a B8** con riesgo documentado.

> Decisiones de Luciano ya tomadas: Bucket A = los 6; #7 kill switch = **congelar todo en pausa**; PII/conector = **B8**. No re-preguntar.

---

## Los 6 fixes aplicados (todos con `node --check` OK, comportamiento preservado en el caso limpio)

| # | Archivo(s) | Qué cambió | Por qué / seguridad del cambio |
|---|---|---|---|
| 1 | `15_cerebro.js` + `14_director.js` | `upsertPorClave_/upsertNodo/upsertArista` aceptan un `snap` **opcional** (leerTabla pre-cargado). `poblarCerebro_` lo captura UNA vez y lo pasa → rompe el O(n²) (antes releía toda la tabla por cada nodo). El snap se mantiene consistente dentro del lote (clave repetida → actualiza, no duplica). | Los demás callers (selfTest, actualizarCerebroIndex_, cargarObjetivo) NO pasan `snap` → comportamiento **idéntico**. Solo cambia el poblado del Director. |
| 2 | `17_bandeja.js` | El clasificador Haiku ahora **blinda el INPUT** con `blindarDatos_('INPUT_BANDEJA', …)` + `system: GUARDIA_INYECCION` en el payload — el mismo patrón anti-prompt-injection que ya usan los agentes. | Reusa constantes globales de `13_agentes.js`. No cambia la clasificación de texto legítimo; resiste inyección por voz. |
| 3 | `07_util.js` | `sanitizarCelda` neutraliza también `\t`/`\r`/`\n` iniciales (antes solo `= + - @`). | Solo afecta strings que empiezan con esos control-chars (raros/maliciosos). |
| 4 | `07_util.js` | `nextId` cuenta IDs "sucios" (no parseables por coacción a fecha/pegado a mano) y aplica un **piso = nº de filas SOLO cuando hay sucios** → evita ID duplicado. | Caso limpio (sin sucios) = numeración **idéntica** → selfTest intacto. |
| 5 | `13_agentes.js` | `filaConsumoAgentes_`/`registrarConsumoAgente_` ahora bajo `conLock` (núcleo `_filaConsumoCore_` sin lock) → sin fila de mes duplicada ni gasto subcontabilizado bajo concurrencia. | Ningún caller tiene un lock abierto → sin anidamiento (verificado). |
| 7 | `08_webapp.js` + doc `20_killswitch.js` | En PAUSA, `doPost` rechaza **todas** las tools de voz (lecturas cliente/cerebro incluidas), no solo `capturar`. | Decisión Luciano (máxima contención). |

**Bucket B — DIFERIDO a B8 (riesgo documentado):** #6 PII a la LLM (Bandeja + agentes sin `nombres`), #8 refunds/negativos del conector, #9 canal pos/local, #10 moneda ARS. Hoy corre con datos sembrados/demo → riesgo aceptado del piloto. Detalle en `PURGA-SISTEMA-B5-2026-07-06.md`.

**Bucket C — deuda documentada (gatillo):** materializarEstado eventual-consistente, escala sync/backup O(clientes), leerTabla headers dup, vozRate_ fail-open, comparación de fechas manual.

---

## Nota de despliegue (importante para el #7)

- **Triggers (HEAD):** `corridaDiaria`/`correrDirector` (#1), `clasificarBandeja` (#2), agentes vía `drenarCola` (#5), y `nextId`/`sanitizarCelda` (#3/#4) corren el código **HEAD** → toman efecto con el `clasp push`, sin promover versión.
- **#7 (doPost de voz):** el endpoint de voz sirve la **versión desplegada** (deployment "cualquiera"), NO HEAD → el fix del kill switch **no toma efecto hasta promover una versión nueva a ESE deployment**. No urgente (solo actúa en pausa), pero necesario para que el #7 sea real.
- **UI (@15):** los cambios no alteran la UI; promoverla es opcional (mantener prod en sync).

---

## Pasos

**1 — Code (terminal Mac):**
```
cd ~/Documents/Claude/Projects/SatoriOS && bash _b5_code.sh
```
Revisar `GUARDIA: OK` + `secret-scan: limpio`, y luego:
```
cd ~/Documents/Claude/Projects/SatoriOS && bash _b5_code.sh --go
```
Hace: `node --check` de los 7 · guardia (solo esos 7 deben diferir) · commit · `clasp push` · intento de `git push` a GitHub.

**2 — Luciano (editor Apps Script) — GATE:**
- Correr **`selfTest()`** → debe dar **TODO OK** (los chequeos E8a del cerebro validan el fix #1 en vivo; F1/C validan Bandeja y costos). Si algo falla, PARAR y avisar.
- (Para #7) Promover una **versión nueva al deployment de VOZ** (el "cualquiera"). Si preferís, lo dejamos para el próximo toque de voz — anotado.

**Rollback:** todo es un commit → `git revert`. El `clasp push` se revierte pusheando el estado anterior (la guardia + git lo permiten). Prod `@15` (UI) no se toca; el deployment de voz solo cambia si promovés.

---

## Gate de salida B5

- [x] CAPABILITIES.md autogenerado ✅
- [x] Purga adversarial corrida + consolidada ✅ (0 críticos-hoy)
- [x] Bucket A (6 fixes) aplicado + validado offline ✅
- [ ] `selfTest()` TODO OK tras el push (gate de Luciano)
- [ ] #7 activo en el deployment de voz (promoción de versión)
- [x] Bucket B diferido a B8 con riesgo documentado ✅

Con el selfTest verde + el push, **B5 = CERRADA**. Siguiente: **B6 (motor)** — re-verificar primero qué de B6 ya está verde en el selfTest (telemetría, estadoVigente, North Star, brief) antes de replanificar.
