# RUNBOOK — Ejecución Capacidades Sato · Ola 1 + Ola 2 (27-ago)

> **Fuente de specs:** `ENCARGO-CODE-CAPACIDADES-SATO-2026-08-26.md`. Este runbook es la **capa de ejecución secuenciada** (etapas + gates). Estado base: `/exec @55`, CERTIFICADO 994/0, GAS==repo, tree tracked limpio.

## Cómo corre esto (reparto de roles)
- **Cowork:** organiza, secuencia, verifica offline, ajusta tras cada reporte de Code. NO promueve.
- **Code (Mac):** ejecuta build GAS/Python, `clasp push` a /dev, itera con `_harness.js`.
- **Luciano (gates, únicos suyos):** (a) `rm -f .git/index.lock`; (b) editor GAS: `selfTestTramo(n)` + `_promote_exec.sh --go`; (c) push 429: ntfy-token o Pushover.
- **Regla de oro por etapa:** node --check → `_harness.js` verde → Luciano corre el tramo en el editor → `clasp push` /dev → eyeball → promote. **Una etapa por vez. Sin verde falso.**
- **LISTA-CONTRATO (toda tool nueva, MISMO commit):** alta en `VOZ_TOOLS` (`08_webapp.js:74`) + `case` en doPost + `_soloOwner_` (si es client-callable) + alta en `ENDPOINTS_UI` + assert D-nuevo. Grep consumidores antes.

---

## E0 — Prep (Luciano · 2 min)
1. `cd <repo> && rm -f .git/index.lock` (lock huérfano de 0 bytes bloquea los commits).
2. Push 429: reintentá `probarPushTelefono()`; si persiste, decidí ntfy-cuenta+token o Pushover (lo implementa E1-bis).

## E1 — Ola 1.1 · Lazo cerrado del encargo  [ungated · Code]
**Objetivo:** el runner marca el encargo `listo`, dispara push, y Sato lo dice al abrir la voz.
**Archivos:** `voz/runner/encargos_runner.py` · `08_webapp.js` (tool `encargos_listos` + rama en `encargosReportar_` que setee `avisado:false` y dispare `_pushTelefono_`) · `22_seguridad.js` (ENDPOINTS_UI) · `09_selftest.js` (asserts D48) · `voz/agent/agent.py` (regla + saludo).
**Detalle:**
- `encargosReportar_` (`08_webapp.js:357`): al recibir estado `listo`, `_encSet_(id,{estado:'listo',avisado:false})` y `_pushTelefono_('Encargo listo', <resumen PII-free>)`. Estado `fallo` NO dispara push de éxito (N5).
- Tool `encargos_listos` (read-only): lee `Encargos` filtrando `estado='listo' && avisado!=true`, devuelve `[{id,resumen}]` y marca `avisado=true`. Alta VOZ_TOOLS + case + `_soloOwner_` + ENDPOINTS_UI + assert.
- `agent.py`: en el greeting del entrypoint y ante "¿algo listo?", llamar `encargos_listos` y enunciarlos una vez.
**Bastión:** read-only; idempotente (`avisado`); push PII-free (resumen, no cifras de cliente).
**Asserts D48:** (a) `listo` setea `avisado=false`; (b) `encargos_listos` marca `avisado` y no re-lista; (c) `fallo` no dispara push; (d) `encargos_listos` en ENDPOINTS_UI.
**Cierre E1:** harness → editor `selfTestTramo(voz)` → clasp push /dev → eyeball → promote.

### E1-bis — Fix push 429 (dentro de E1, `34_push.js`)  [Code]
Rama `ntfy`: si existe Script Property `NTFY_TOKEN`, agregar header `Authorization: 'Bearer '+token` al `UrlFetchApp.fetch`. (Requests autenticadas de ntfy tienen cuota propia → evita el 429 de IP compartida, y cierra el caveat de topic público.) Assert: header presente cuando hay token. Alternativa si Luciano elige Pushover: ya soportado, solo cargar `PUSH_PROVIDER=pushover`+token.

## E2 — Ola 1.2 · Proactividad + health conectores + saludo de voz  [ungated · Code]
**Objetivo:** Sato avisa vencimientos / conectores caídos / pendientes sin que preguntes; push 07:00 + refuerzo por voz.
**Archivos:** `19_conectores.js`/`16_salud.js`/`29_vigilancia.js` (chequeo "conector X sin sync hace N días", umbral Config `conector_max_dias` default 2 → alimenta `candidatas` de `06_avisos.js`) · `06_avisos.js` (`corridaDiaria`: si hay candidatas relevantes → `_pushTelefono_` PII-free; Config `push_proactivo_on`) · `08_webapp.js`/`briefCacheado_` (anti-brief-estático: "qué cambió y requiere acción HOY") · `agent.py` (saludo del entrypoint enuncia pendientes vía brief liviano).
**Contrato:** si sumás a `hallazgos`/`candidatas`, actualizá el assert que los cuenta (precedente E8a-3). 
**Bastión:** push solo al teléfono de Luciano; PII-free; dedupe diario reusado.
**Asserts D49:** conector-stale entra como candidata; push_proactivo_on OFF = no envía; brief ordena por acción.
**Cierre E2:** ídem regla de oro.

## E3 — Ola 1.3 · Leer correo por voz  [ungated · Code]
**Objetivo:** "3 mails de clientes sin responder: X, Y, Z".
**Archivos:** `08_webapp.js` (tool `correo` read-only sirviendo el triaje de `correoTriaje_` de `30_correo.js`: remitente/asunto/resumen de últimos N, SIN cuerpos con PII; respeta `correo_on`) · `09_selftest.js` (asserts D50) · `agent.py` (regla de uso).
**Contrato:** `correo` = VOZ_TOOLS + case + `_soloOwner_` + ENDPOINTS_UI + assert.
**Bastión:** solo lectura; sin volcar cuerpos por voz; si `correo_on=false`, lo dice.

## E4 — Ola 1.4 · N7 v2 async con lazo + CIERRE OLA 1  [Code + Luciano]
- `agent.py`: N7 v2 — "no navego en vivo; lo encargo y **te aviso cuando esté**" (el aviso real = E1).
- **Purga Ola 1** (skill `purga-de-errores`) sobre 1.1-1.4.
- **Cierre:** editor `selfTestVeredicto` (6+ tramos) → `_promote_exec.sh --go` → `_inventario_cierre.sh` → declaración CIERRE/ABIERTO.

============================ GATE ============================
## E5 — Ola 2.0 · SANEAR LA FRONTERA DE INYECCIÓN  [Code + bastion-satori + purga-de-errores]
**BLOQUEA E6-E7. No se toca ninguna tool de escritura externa antes.**
**Objetivo:** parsear/validar `objetivos.descripcion` + payloads de escritura contra vocabulario cerrado (S6) antes de que toquen prompts de agentes o acciones externas.
**Archivos:** `14_director.js` (`correrDirector`/`GUARDIA_INYECCION`) + puntos de escritura libre.
**Gate obligatorio:** convocar `bastion-satori` (diseño del saneo) y `purga-de-errores` (al cerrar). Es una etapa propia, no un edit al pasar.
**Bonus:** al cerrar E5 se destraban también F2.d `codigo_dry` y N2 v2 (mismo gate).

## E6 — Ola 2.1 · Escribir entregable en el Mac (dropzone)  [Code · post-E5]
`encargos_runner.py`: copiar el entregable final a `~/Documents/Claude/Satori-Entregables/<id>/` (con `id_cliente` si aplica). **El copiado lo hace el runner Python, NO el `claude -p`.** Allowlist de UNA carpeta; sin sobrescribir fuera de su `<id>/`; el scratch del LLM sigue sin `Write`.

## E7 — Ola 2.2 calendario + 2.3 mensaje a cliente + CIERRE OLA 2  [Code · post-E5]
- 2.2: `CalendarApp` (owner). Read ("qué tengo hoy") → write (evento/recordatorio) detrás de S5.
- 2.3: voz redacta borrador → S5 → cae en `11_aprobaciones.js` → Luciano aprueba en CM. Nunca envío directo. Destinatario validado vs roster.
- **Cierre:** Purga Ola 2 + editor + promote + inventario + declaración.

---

## Secuencia para Code (relay de Luciano, etapa por etapa)
E0 (Luciano) → **E1+E1-bis** → E2 → E3 → E4 (cierre Ola 1) → **E5 (Bastión gate)** → E6 → E7 (cierre Ola 2).
Code arranca por E1. Cowork verifica cada reporte y ajusta el runbook antes de la siguiente etapa.

---

## Update 27-ago mañana — E1 en prod, cabos pendientes, E2 encargado

**E1 promovido a /exec @56 (`8ed2150`) con dos gates salteados por decisión de Luciano:** D48 en vivo + eyeball. Sin certificación en vivo del path nuevo (`encargosReportar_` escribe `avisado`). Rollback @55 en `_promote_rollback.txt`.

**Cabos E1 (dueño):**
- [Luciano] `selfTestTramo6()` en editor (D48 15 asserts vivos).
- [Luciano] eyeball /exec @56 (voz 30s).
- [Luciano] reiniciar agent.py: `launchctl kickstart -k gui/$UID/com.satori.voz.agent` (sin esto el saludo con `encargos_listos` no está vivo — clasp no lo despliega).
- [Luciano · ~3 días] `NTFY_TOKEN` en Script Properties. Recordatorio programado 30-ago 10:31 Madrid.

**Ajuste de vocabulario (aprendizaje):** estados terminales del `encargos_runner.py` son `hecho`/`fallido`, no `listo`/`fallo` como decía este runbook. Code fue correctamente al vivo. Actualizado en E2 y en todo lo que sigue.

**E2 listo para ejecutar:** `ENCARGO-CODE-CAPACIDADES-SATO-E2-2026-08-27.md` (repo), con las 5 sub-piezas especificadas (health conectores, push proactivo 07:00, anti-brief-estático, saludo de voz con pendientes, Config keys). Espera cierre de cabos E1 antes de arrancar.

**Regla actualizada:** no promover con gates de selfTest salteados salvo excepción declarada. Cuando se hace, dejarlo escrito ANTES de promover, con qué se compensa (rollback + pendiente). Precedente #55.
