# PURGA · CRM Pro (commit e98d5fa) — 26/08/2026

> Panel adversarial convocado por Luciano como gate sustituto del selfTest en vivo (que hoy no
> corre) antes de promover a /exec. Auditoría sobre código REAL leído del repo, no sobre el
> resumen de Code. **Regla del panel: NO aplico cambios — detecto y propongo; vos decidís.**

**Perfiles convocados:** Aislamiento/Seguridad (§T1.8 + OWASP) · Correctitud y edge-cases
(escrituras, delete, locks) · Performance/escala · UI/estados (E-c, D26c) · Contratos/scope.

## Veredicto (1 línea)

**El código de CRM Pro está limpio: 0 Críticos · 0 Altos.** El núcleo (escrituras con aislamiento,
locks no-reentrantes, validación server-side, semáforo gris, endpoints gateados) está bien hecho.
Lo que hay: **2 Medios** (un scope bleed y el promote sin cert en vivo) + **1 hipótesis a verificar**
en el path del SGIC + menores. Se puede promover con un eyeball en /dev previo.

## Lo que audité y pasó (para que sepas qué SÍ miré)

- **Aislamiento §T1.8:** ✅ toda escritura valida el `id_cliente` contra el roster REAL antes de
  tocar la hoja — `carteraEncajeKairos`, `correoConfirmarThread` (además sella `sello_tenant=idc`),
  `_sellarContacto_`. El id lo pone el sistema, no el modelo. Sin fugas cross-tenant.
- **Locks:** ✅ `conLock` no es reentrante y el código lo respeta — `_sellarContacto_` acepta
  `ctx {sh,fila}` para no re-lockear cuando el llamador ya tiene el lock, y sella FUERA del lock en
  `propuestaRegistrar/Firmar/correoConfirmar`. Sin doble-unlock.
- **Validación:** ✅ `carteraEncajeKairos` exige `/^[sn-]{4}$/`; estados y enums se validan server-side.
- **Semáforo M3 (D26c "vacío jamás verde"):** ✅ correcto — `evaluables===0 → gris`, y distingue
  `null` (no evaluable) de `false` (pendiente): "ausencia de compromisos no es al día, es que no
  sabemos". El desvío que Code declaró está BIEN implementado.
- **Performance:** ✅ `carteraPipeline` computa el contexto de vigilancia UNA vez (`_retCtx`) y lo
  reusa por card — no re-consulta Sheets por cliente.
- **Enum al front (E-c):** ✅ grep en `index.html` da CERO literales `frio/tibio/caliente` — el
  juicio viaja computado del backend, la regla se respetó.
- **Endpoints:** ✅ los 11 nuevos gateados con `_soloOwner_` + de alta en `ENDPOINTS_UI` en el mismo commit.
- **Corrección SGIC (mi adenda §1):** ✅ implementada — `causa_diferencia` viaja como campo
  (`08_webapp.js:522`, bruto-vs-neto) y la regla en `26_sato.js:378` prohíbe inventar la causa con
  las palabras exactas del bug ("sincronización pendiente... ya pasó y era FALSO").

## Tabla de hallazgos (por severidad)

| # | Eje | Perfil | Hallazgo | Evidencia | Sev | Conf | Parche propuesto |
|---|---|---|---|---|---|---|---|
| 1 | Pres | Contratos/scope | **Scope bleed:** `34_push.js` (canal de push al teléfono, frente "Capacidades Sato" 26-ago) entró en los commits de CRM Pro y va a /exec con la tanda. No es del encargo CRM Pro. | `src/34_push.js` (nuevo, +101); su propio comment: "ladrillo base del ENCARGO-CODE-CAPACIDADES-SATO"; en `ENDPOINTS_UI` como `probarPushTelefono` | **Medio** (proceso) · Bajo (runtime) | 9 | Runtime ≈ 0: `_pushTelefono_` es fail-open no-op sin `PUSH_PROVIDER` (que no cargaste) · PII-free · gateado. Decisión tuya: **(a)** lo dejás viajar inerte y se certifica cuando corra su frente, o **(b)** revert de `34_push.js` para no mezclar frentes (regla V22). Recomiendo (a) por costo, pero que quede DICHO, no colado. |
| 2 | Fut | QA/Correctitud | **Promote sin cert en vivo:** el harness (833/0) cubre lógica + contratos + aislamiento, pero las escrituras REALES al MAESTRO, el `GmailApp.search` y el snapshot a Drive NUNCA se ejecutaron. Primer run = producción. | `09_selftest.js` tramo 6 escrito pero no corrido; Code lo declara | **Medio** | 8 | No es un bug: es verificación faltante. Gate proporcional sin editor: **`clasp push` a /dev → abrir el CRM en el navegador /dev y clickear una vez** (abrir card→ficha, tocar encaje, ver el semáforo) — render=eyeball, caza boot-breakers. Recién ahí `--go`. |
| 3 | Pres | Correctitud | `borrarFilasDonde` (helper de limpieza) solo se usa en `09_selftest.js` (test), no en paths de prod. Code lo tocó (log `undefined`, `deleteRow` crudo, guarda P0 anti-100%). | `grep deleteRow`: solo `09_selftest.js:586..936` | Bajo | 8 | Sin acción para el promote (no corre en prod salvo selfTest). Verificar cuando corras la cert. |
| 4 | Pres | Aislamiento | Campos nuevos expuestos a la fuente `cartera` de Sato (`ultimo_contacto`, `dias_sin_contacto`, `motivo_perdido`) — se sanitizan con `limpiarHostilTexto_`/`aFechaISO` en el read, pero no confirmé que pasen por `anonimizar()`. | `08_webapp.js:1334-1336` | Bajo | 6 | Son datos comerciales TUYOS (no PII de cliente), riesgo bajo. Confirmar en la cert que la fuente `cartera` pasa por `anonimizar()` antes del prompt. |

## Hipótesis a verificar (no confirmado — separado)

**H1 · Doble explicación del delta en `08_webapp.js`.** Hay DOS causas distintas para "el conector
muestra más" en el mismo archivo: línea **489** lo atribuye a *sincronización* ("delta = ventas aún
no sincronizadas, no un error" — comparación conector-vivo vs panel-snapshot, misma fuente distinto
momento) y línea **522** lo atribuye a *bruto-vs-neto* (`causa_diferencia`, SGIC-oficial vs
conector-crudo). **Probablemente son DOS deltas legítimos y distintos** (uno intra-DB_VENTAS por
timing, otro SGIC-vs-crudo por envío/recargos). Pero si ambos pueden llegar al contexto de Sato,
hay riesgo de que atribuya la causa equivocada al delta equivocado — justo el tipo de confusión que
esta saga viene arreglando. **Confianza de que sea un bug real: 3/10; de que valga verificar: 7/10.**
Verificación: en el editor, con Vehemence, confirmar qué delta reporta Sato y que la causa que da
matchea SU comparación (el de la captura de hoy era SGIC-vs-crudo = bruto-neto ✓). 1 pregunta.

## Peer-review interno

- ¿#1 es Alto? No — inerte sin credenciales, gateado, PII-free. Medio por disciplina de scope, no por daño.
- ¿#2 es Crítico? No — el código está limpio y hay rollback (@54). Es riesgo de I/O no ejercitada, mitigable con el eyeball /dev. Medio.
- ¿H1 es hallazgo o hipótesis? Hipótesis: no tengo evidencia de contaminación, solo dos comentarios que conviven. Va separado, como manda la regla anti-inflado.

## Remediación (Críticos/Altos)

**Ninguno.** No hay Críticos ni Altos que parchear antes de promover. Los 2 Medios se cubren con
decisiones/procedimiento, no con código: (#1) declarás si `34_push` viaja o se revierte; (#2) hacés
el eyeball /dev antes del `--go`.

## Próximo paso (1 línea)

`clasp push` a /dev → eyeball del CRM en el navegador /dev (2 min) → si carga limpio, `--go` a /exec;
y decidí si `34_push.js` viaja inerte o lo revertís.

---
*Purga · Cowork · 26/08/2026 · sobre commit e98d5fa (harness 833/0). Sin Críticos ni Altos. Deuda
declarada: cert en vivo (tramo 6) · AOV · `diagSatoVentasVivo` a remover · H1 a verificar.*
