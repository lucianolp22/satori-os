# RUNBOOK — Sesión de Puesta en Marcha · Satori OS

> **ESTADO: 📋 PREPARADO, NO EJECUTADO.** 27/07/2026. Nada de este runbook se corrió: no se tocó `/dev`, `/exec`, `clasp`, GAS, Config ni el Cerebro.
> **Motivo declarado:** hay otra conversación trabajando sobre el código. La regla nacida del incidente del 22/07 aplica: *"un solo canal sobre el código por vez — dos manos sin coordinación = así se pierden trabajos"*.
> Objetivo de la sesión: **romper el deadlock de los 9 gates y dejar el OS corriendo el día de Luciano.**
> Duración estimada: **~3 h concentradas + 5 días hábiles de observación.**

---

## Reglas de la sesión (invariantes del proyecto)

1. **Un solo canal sobre el código.** Antes de arrancar, cerrar o congelar la otra conversación. Sin esto, no se arranca.
2. **Solo Luciano promueve a `/exec`.** No delegable.
3. **`clasp run` está bloqueado** → `selfTest()` se corre a mano en el editor GAS.
4. **Gate de STOP con salida esperada.** Cada paso declara qué tiene que devolver. Si no coincide → se detiene la cadena, no se improvisa. *(Contramedida verificada: salvó `health-check.js` + `healthdash.html` de ser borrados por un `clasp push`.)*
5. **Verificar antes de construir.** Si un paso ya está hecho, se salta y se anota — no se rehace. *(F2 estaba construido desde el 08/07 y un encargo del 18/07 lo mandaba a rehacer.)*
6. **La cadena construye, la revisión enciende.** Los conectores nacen OFF por diseño: se prenden de a uno, comparando totales contra la fuente.

---

## FASE 0 · Precondiciones — 15 min · ⛔ bloqueante

| # | Acción | Salida esperada | Si falla |
|---|---|---|---|
| **P1** | Confirmar que ninguna otra conversación/canal está operando sobre el repo o el GAS | Canal único confirmado | **ABORTAR.** Reprogramar |
| **P2** | `git status` + `git log -1` en el repo del OS · diff GAS↔repo | Working tree limpio · HEAD = `d8bbcbc` (o el que corresponda) · **sin drift GAS↔repo** | Si hay drift: `clasp pull --versionNumber N` y merge **antes** de cualquier push *(incidente V22, 22/07)* |
| **P3** | Verificar el último backup semanal a Drive (dom 04:00) y que `drillRestore` siga válido | Backup presente y datado ≤7 días | Correr backup manual antes de seguir |
| **P4** | 🔴 **Verificar los `id_cliente` de los 7 tenants contra sus Sheets** — la purga del 23/07 halló **CLI-004 DAM apuntando a la DB de MesaQuince y CLI-005 SIP a la DB de DAM** | Cada tenant apunta a su propia Sheet | **ABORTAR la Fase 3.** Encender conectores con tenants cruzados escribe datos de un cliente en la base de otro |

> **P4 es el más importante de todo el runbook.** Es el único paso donde un error no se ve y no se revierte solo.

---

## FASE 1 · Verificación en `/dev` — 45-60 min · sin efectos en producción

| # | Gate | Acción | Salida esperada | Si falla |
|---|---|---|---|---|
| **1.1** | **G9a · ¿Llega el brief?** | Abrir la casilla de `owner_email` y buscar los mails del brief desde el **08/07** | ≥1 mail del brief recibido | 🔴 **Hallazgo mayor.** El canal de entrega está roto y todo el go-live es decorativo. Corregir *antes* de seguir (revisar `briefPush_`, `owner_email`, spam, cuota de `MailApp`) |
| **1.2** | **G1 · selfTest** | En el editor GAS, correr `selfTest()` contra MAESTRO real (D1→D27) | **Verde, sin asserts parchados.** La corrida del 24/07 cerró con 2 parchados: se busca una corrida limpia post-`d8bbcbc` | **STOP.** No se promueve. La cadena espera |
| **1.3** | **G1b · selfTestF2** | Correr `selfTestF2()` | Verde | STOP |
| **1.4** | **G2 · Eyeball guiado, 8 pasos** en `/dev` | (a) Panel de **Salud** legible · (b) **Hilo** en el CM · (c) **Hilo** en Akasha (estación de cliente) · (d) **`cerebroNodo`** — tocar una luz y ver el dato · (e) **mapa neural** · (f) **voz** desde el CM · (g) **brief** en pantalla · (h) **Calendario abierto desde Akasha** (estuvo roto; fix en `/dev` sin eyeball) | Cada uno renderiza y muestra datos reales, no placeholders | Anotar el defecto, seguir con los demás. **Ningún defecto visual bloquea el promote salvo (a), (b) o (g)** |
| **1.5** | **G5 · Decidir `cerebro_map`** | Abrir el mapa neural en el iPhone y mirar los fps | ≥30 fps sostenidos | Dejar el flag **OFF** y seguir. No bloquea |

---

## FASE 2 · Promote — 15 min · punto de no retorno controlado

**Precondición: 1.2, 1.3 verdes y 1.4 (a)(b)(g) OK.**

| # | Acción | Salida esperada |
|---|---|---|
| **2.1** | Promote de `/dev` → `/exec` (script de promoción de B0.5) | Nueva versión en `/exec`, número anotado |
| **2.2** | Reiniciar el agente de voz (`ks_voz_reinicio_agente.sh`) | Agente arriba; la voz pega al `doPost` de `/exec` |
| **2.3** | Verificar `/exec` vivo: abrir el CM, ver Salud y Hoy | Carga con datos reales |
| **2.4** | Correr `AK_T.tabla()` en `/exec` — **los segundos reales nunca se midieron** | Boot ≤3 s (criterio declarado) | 
| **2.5** | Rollback disponible: anotar la versión anterior de `/exec` para revertir en 1 comando | Número anotado antes de 2.1 |

---

## FASE 3 · Encender las fuentes de datos — 45 min · uno por uno

**Precondición: P4 verde.**

| # | Gate | Acción | Salida esperada |
|---|---|---|---|
| **3.1** | **G8 · Triggers** | En el editor: `instalarTriggers()` / `bootstrap()` — **NO `setup()`** | Trigger `sincronizarConectores` cada 8h instalado. *(Arrastrado desde el 13/07)* |
| **3.2** | **G3a · Monedas** | Declarar en Config la moneda de **LC Travel (ARS)**, **MesaQuince (EUR)**, **DAM (EUR)** — *no se adivinan* | 3 monedas declaradas. Sin esto los consolidados multi-conector no suman |
| **3.3** | **G3b · Sembrar** | `sembrarConectoresHallados()` | Conectores de LC Travel / MesaQuince / DAM registrados, **flags OFF** |
| **3.4** | **G3c · Probar** | `probarConector(id)` por cliente | Lectura OK, sin escritura |
| **3.5** | **G3d · Comparar** | Comparar el total leído contra la fuente (el SGIC del cliente) — **este paso es de Luciano, no del sistema** | Coincidencia al peso, o delta explicado |
| **3.6** | **G3e · Encender** | `encenderConector(id)` **solo si 3.5 coincidió** | Flag ON. Repetir 3.4→3.6 por cliente |
| **3.7** | **G7 · Oficina Virtual** | Script Property `OFICINA_SYNC_SECRET` con el valor real + `GAS_SYNC_URL` → URL de `/exec` + `oficina_url` en Config | Push del tenant CLI-000 sin 404 *(arrastrado desde el 13-14/07)* |
| — | **EJF** | Queda fuera: **su SGIC no fue hallado** | Anotar como pendiente, no bloquea |

**Meta de la fase: ≥3 SGIC alimentando la columna "Real" solos.**

---

## FASE 4 · Poblar el Hilo — 30 min

> **Atajo disponible:** los HILO de **DAM (21/07)**, **LC Travel (23/07)** y **Vehemence** ya existen como `.md` en el Cerebro. La skill N1 no arranca de cero: sincroniza lo que ya está escrito.

| # | Acción | Salida esperada |
|---|---|---|
| **4.1** | Correr la skill `hilo-de-trabajo` sobre **DAM** y **Vehemence** (N1, manual — lo pide la escalera de maduración) | Hilos actualizados |
| **4.2** | `_hilo_sync.sh` | Hoja `hilo` poblada |
| **4.3** | `repararCerebro()` + `repararHilo()` | Sin nodos huérfanos |
| **4.4** | Verificar `hiloCliente(id)` en el CM y en la estación de Akasha | La vista deja de estar vacía para ≥2 clientes |

---

## FASE 5 · Validaciones conductuales — 20 min + 5 días

Lo que ningún test automático cubre.

| # | Acción | Salida esperada |
|---|---|---|
| **5.1** | **Prueba de voz en vivo** (pendiente desde el 13/07): N5 frescura *("al último cierre")* · **N9** *(la tool que falla se dice, jamás un canal inventado)* · A1 cifras exactas en números · T1/T2 · E2 confirmación obligatoria antes de actuar | Sato cumple las 5. Si inventa un canal o afirma una acción no ejecutada → 🔴 crítico |
| **5.2** | **Observación de 5 días hábiles** (§definición de terminado): brief recibido 5/5 · pendientes armados al abrir · decisiones ejecutadas desde el sistema · ≥2 SGIC alimentando "Real" · alertas de salud y costo llegando | 5/5 en las cinco líneas |

---

## FASE 6 · Cierre — 30 min

| # | Acción |
|---|---|
| **6.1** | `purga-de-errores` sobre la puesta en marcha (auditoría adversarial de cierre) |
| **6.2** | Handoff según `00-HANDOFF-ESTANDAR.md` + actualizar `MOC - Satori OS.md` + la fila de `CEREBRO.md` |
| **6.3** | **Rotar los secretos en claro** hallados el 23/07 (docs de Vehemence/DAM). Los del OS vencen el 19/10 |
| **6.4** | Crear el remoto git de `oficina-virtual` — **backup off-Mac = 0** desde el 14/07 |

---

## Decisiones tuyas que la sesión necesita (3)

| Decisión | Default hoy | Impacto si no se decide |
|---|---|---|
| **¿El email externo aprobado sale?** (`riesgo_accion_externa`) | Bloqueado | El Cobrador propone pero nada sale. Es coherente dejarlo bloqueado hasta post-go-live |
| **Monedas de los 3 clientes** (3.2) | Sin declarar | Los consolidados no suman por unidad |
| **`cerebro_map` ON/OFF** (1.5) | OFF | Ninguno — es cosmético |

## Fuera de esta sesión (a propósito)

AKASHA E4 · "Sato co-presenta" · correo T7 *(A2 scope Gmail = NO; requiere Bastión pleno antes)* · los 8 agentes de laboratorio · **T4 tu administración** *(único gate: subir tus facturas 2026 — debería ser la sesión siguiente)* · vertical físico de la Oficina en live · B8/RGPD.

---

## Pre-mortem: la sesión fracasó

**Causa 1 — el brief no llegaba (1.1).** Se promovió todo, quedó impecable, y el sistema siguió sin poder dirigir el día porque su única salida al humano estaba muerta. Ya pasó: mató las dos rutinas personales el 09/07.

**Causa 2 — P4.** Se encendieron conectores con tenants cruzados y datos de DAM entraron a la base de MesaQuince. Silencioso, y con datos de clientes reales adentro.

**Causa 3 — la otra conversación.** Un `clasp push -f` pisó trabajo hecho en paralelo. Ya pasó el 22/07 con la V22 de DAM.

**Causa 4 — se convirtió en sesión de construcción.** Apareció un defecto en el eyeball, se abrió a arreglarlo, y las fases 3-5 nunca se corrieron. El sistema quedó otra vez a 9 gates de distancia, con gates nuevos.

**Mitigación de la 4:** un defecto hallado en el eyeball **se anota, no se arregla** — salvo que bloquee (a), (b) o (g). La sesión es de encendido, no de mejora.

---

**Confianza 8/10** en el orden y las precondiciones (salen del registro de tus handoffs). **6/10 en los nombres exactos de funciones y scripts** — `sembrarConectoresHallados()`, `encenderConector()`, `_hilo_sync.sh`, `ks_voz_reinicio_agente.sh`, el script de promoción: los tomé de los handoffs, no del código. **Verificarlos contra el repo al arrancar la Fase 0.**
