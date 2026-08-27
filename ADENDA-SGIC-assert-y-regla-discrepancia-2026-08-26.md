# ADENDA · SGIC — assert live + regla de discrepancia — 26/08/2026

> **Para Code.** Cierra el cabo #2 del hilo de hoy: el path SGIC (UrlFetch + Script Properties +
> Cache) no tiene assert en el selfTest. **Bundlealo con los D46 de CRM Pro: una sola pasada de
> certificación en vivo, no dos viajes al editor.** Contexto: la corrección de integridad de Sato
> (Vehemence lee el SGIC oficial) FUNCIONA en vivo — verificado por Luciano contra su dashboard,
> los 3 montos coinciden exactos. Falta blindarla con test + tapar el residuo que quedó a la vista.

## §1 · El residuo detectado en el eyeball (regla a reforzar en `26_sato.js`)

**Contexto que corrige mi primer diagnóstico** (leí `sato-integridad-datos.md`): el eyeball del
26-ago PRUEBA que el redeploy del /exec del SGIC se completó — Sato reportó online = 18.748.107,
que matchea el dashboard (neto, `EERR_Compute`). El conector crudo muestra 1.240.536 más ≈ 19,99M
(bruto, con envío/recargos). Ese "pendiente operativo" de la memoria queda **RESUELTO**.

**Pero:** la regla "reportar DÓNDE está el desfase, NO por qué" ya existe y se aplica bien a la
línea de aviso TEMPLADA server-side (el primer turno de Sato la respetó: "muestra 1.240.536 más").
El agujero es la pregunta de SEGUIMIENTO libre: Luciano preguntó "¿a qué corresponde esa
diferencia?" y ahí Sato —fuera del template, en texto libre— **inventó una causa Y ERRÓ**: dijo
"sincronización pendiente de DB_VENTAS". La causa real está documentada en el propio sistema y NO
es esa: **el conector crudo es BRUTO (incluye envío + recargos, ~$1,22M/mes) y el SGIC es NETO
(`subtotal − discount`)** — es exactamente la diferencia `Calc_KPIs` vs `EERR_Compute`.

**Fix (dos partes):**
1. **Alimentar la causa real al contexto de Sato.** El desfase por canal ya es estructural y
   conocido: el resumen (`_sgicVozResumen_` y el equivalente in-GAS) debe pasarle a Sato que la
   diferencia con el conector corresponde a **envío + recargos que el conector incluye y el SGIC
   no** — para que, preguntado, dé la respuesta CORRECTA en vez de adivinar.
2. **Reforzar la regla dura** (system de Sato, `26_sato.js`), que hoy solo blinda la línea
   templada — extenderla al texto libre:
   > Ante una diferencia entre SGIC oficial y conector crudo, la causa conocida es que el conector
   > es BRUTO (envío + recargos) y el SGIC NETO. Si te preguntan por qué difieren, es ESO.
   > **Jamás inventes otra causa** ("sincronización pendiente", etc.). Si en algún caso no tenés el
   > motivo en el contexto, decí "no tengo la causa exacta, hay que reconciliar" — nunca la adivines.

## §2 · Assert `D47 · SGIC integridad` (en `09_selftest.js` + parte pura en `_harness.js`)

**Partir en dos, patrón D28/D30 (la parte con red solo bajo `opts.completo`):**

### 2a · OFFLINE — con fixture (harness + selfTest sin red)
Usar un payload KPI FALSO (no llamar al endpoint), y asertar la LÓGICA PURA:
1. **Guardia de año:** dado `hoy='2026-08-25'`, el período de la consulta se deriva de `hoy`
   (agosto 2026), NUNCA de un hardcode ni de lo que "cree" el LLM (2023). Alimentar un `hoy`
   distinto y verificar que el período cambia con él.
2. **Fuente nombrada:** el armador del `resumen`, con el payload fixture, produce un texto que
   referencia la cifra OFICIAL como primaria y contiene "Según el SGIC" — y NO rotula "el SGIC"
   sobre un número que salió del conector crudo.
3. **Math de `diferencia_vs_panel`:** con SGIC_online = 18.748.107 y conector = 19.988.643,
   la diferencia computada = 1.240.536, con la dirección/label correctos ("el conector marca N más").
4. **Framing de discrepancia (del §1):** si el texto de la diferencia se arma server-side, asertar
   que usa marco NEUTRO (no "se debe a que"). Si la explicación causal es puramente del LLM,
   asertar la PRESENCIA de la regla del §1 en el string de reglas de `26_sato.js` (assert de que
   la instrucción existe) — el resto es eyeball, no test mecánico.

### 2b · LIVE — solo `opts.completo`
5. **Gate de config:** Script Properties `VEHEMENCE_SGIC_URL` + `VEHEMENCE_SGIC_TOKEN` presentes →
   ok. Si faltan → asertar DEGRADACIÓN con motivo nombrado (NO caer al conector crudo en silencio
   como si fuera oficial). El token JAMÁS se loguea.
6. **Endpoint sano:** `sgicKpisOficial_()` devuelve objeto estructurado (no `{error}`) y se mide la
   latencia. **CLAVE — no dejar que la uptime de Vehemence gatee el selfTest de Satori:** si el
   endpoint externo no responde, reportarlo como **dependencia externa caída (soft/skip con
   motivo)**, NO como rojo duro que bloquea un deploy no relacionado. Warn si latencia > 30.000 ms.

**Por qué el split:** el harness offline no puede ejercitar UrlFetch/Properties/Cache (por eso el
gap). La parte pura sí se testea offline con fixture; la parte de red va bajo `opts.completo` para
que la cert de 5 tramos no dependa de un endpoint de tercero.

## §3 · Cabo de higiene

`diagSatoVentasVivo()` está marcado "se remueve al cerrar" en su propio comentario. Va al
inventario de cierre — no queda vivo en prod. (Ya fichado por Code.)

## §4 · AOV — cabo abierto declarado (no lo cierres en silencio)

El diagnóstico original de integridad incluía el **AOV mezclado online+local vs objetivo online**.
El eyeball de hoy verificó VENTAS + procedencia, NO el AOV. El SGIC ya separa el ticket online
($100.257) del mix (78/22), así que la fuente lo distingue — pero **falta verificar que Sato
reporte el AOV correcto** (online contra objetivo online, sin mezclar el local). Queda ABIERTO:
un assert análogo al D47 para AOV, o al menos un eyeball dedicado. Decláralo, no lo asumas resuelto.

---
*Cowork · 26/08/2026. Bundle con la cert D46 de CRM Pro. Secuencia acordada del frente: lock →
commit/push → promote @55 (SGIC a prod, saca a Sato de mentir en @54) → CRM Pro → @56.*
