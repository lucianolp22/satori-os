# ENCARGO-CODE — Capacidades Sato "asistente integral" (26-08-2026)

> **Ejecutor:** Claude Code (GAS/clasp + Python runner + launchd). **Cowork** dejó este plano y lo verifica offline; **no promueve**.
> **Fuente/decisiones:** Luciano 26-ago. **Se funde** en `PLAN-SATO-EJECUTOR-2026-08-24.md` (cierra sus 🟡 parciales: health conectores, ejecución hacia afuera).
> **Estado base verificado 26-ago:** `/exec @51`, tree tracked LIMPIO (sin entanglement), VOZ_TOOLS `08_webapp.js:74`, runner `--allowedTools "Read Grep Glob WebSearch WebFetch"`, avisos/brief-push `06_avisos.js` (opt-in OFF), `correoTriaje()` lee Gmail read-only (no expuesto a voz), **sin canal de push a teléfono** (`UrlFetchApp` disponible).

## Decisiones de Luciano (bakeadas)
- **Canal proactivo = push al teléfono + Sato lo dice al abrir la voz (refuerzo).** El push es el primario; el saludo de voz relee pendientes por si el push ya no está vigente.
- Async con lazo cerrado (NO web síncrona en voz). Acciones hacia afuera: bien gateadas, tras cerrar la frontera de inyección.

## Gate transversal (Bastión — NO negociable)
- **P0 frontera de confianza sin sanear** (`objetivos.descripcion → correrDirector → pregunta cruda`; payloads de escritura sin parseo contra vocabulario cerrado, S6). **Bloquea toda la Ola 2.** Mismo gate ya declarado para `codigo_dry`/N2 v2.
- **LISTA-CONTRATO (dura):** cada tool nueva = alta en `VOZ_TOOLS` + `case` en `doPost` + `_soloOwner_` + alta en `ENDPOINTS_UI` (`22_seguridad.js`) + assert D19c, **mismo commit**. `grep -rn "<LISTA>" src/` y clasificar cada consumidor.
- **S5 (LEY):** toda escritura/acción por voz se repite y espera "sí" explícito.
- **Push PII-free:** el push y el saludo NUNCA llevan cifras/datos crudos de cliente — solo el nudge ("2 vencimientos, 1 conector caído — mirá el CM"). El detalle vive en CM/voz. (Coherente con no-PII-pesada de `06_avisos.js`.)

---

## OLA 1 — sin gate (lectura + notificación). Shippable ya.

### 1.0 · Canal de push al teléfono (NUEVO — habilita 1.2) — must · S
- **Nuevo `src/34_push.js`:** `function _pushTelefono_(titulo, cuerpo){...}` — POST vía `UrlFetchApp` a **Pushover** (recomendado: privado/confiable) o **ntfy** (topic privado). Provider y credencial en **Script Properties** (`PUSH_PROVIDER`, `PUSHOVER_TOKEN`, `PUSHOVER_USER` ó `NTFY_TOPIC`), NUNCA en repo. `muteInactive=false` (no-op silencioso) si falta credencial — no rompe nada.
- Bastión: un solo destino (el teléfono de Luciano); cuerpo PII-free; `try/catch` que no tumba la corrida diaria.
- **DEPENDENCIA HUMANA (Luciano):** crear el token Pushover (app https://pushover.net, ~2 min, US$5 one-time) **o** elegir topic ntfy, y cargarlo en Script Properties. Sin esto el push queda no-op (todo lo demás corre igual).
- Edge: rate-limit del provider (Pushover 10k/mes, holgado); fallo de red → log + sigue.

### 1.1 · Lazo cerrado del encargo (#2) — must · S
- `voz/runner/encargos_runner.py`: al cerrar y escribir `resultado.md`, `encargos_reportar` con estado `listo` + `avisado=false` + resumen 1 línea. Fallido → estado `fallo` (N5), no `listo`.
- Al reportar `listo`: disparar `_pushTelefono_("Encargo listo", resumen)` (server-side vía un endpoint, o el runner llama un doPost `encargo_push`). Preferir que GAS lo dispare al recibir el reporte (centraliza el canal).
- **Tool voz nueva `encargos_listos`** (read-only): lista `listo && !avisado`, marca `avisado`. Alta VOZ_TOOLS + case + `_soloOwner_` + ENDPOINTS_UI + assert.
- `agent.py`: regla — al abrir sesión o ante "¿algo listo?", llamar `encargos_listos` y decirlos una vez.
- Edge: ya hay `.pending_reports.jsonl` (reporte perdido) + idempotencia (`resultado.md` existe). No re-avisar.

### 1.2 · Proactividad real + health conectores (#3 · cierra 🟡 del plan) — must · S/M
- **Health conectores:** `19_conectores.js`/`16_salud.js`/`29_vigilancia.js` — agregar chequeo "conector X sin sincronizar hace N días (umbral Config `conector_max_dias`, default 2)" → alimenta `candidatas` de `06_avisos.js`. **LISTA-CONTRATO:** si sumás a los `hallazgos` de `correrSalud`, actualizá el assert que cuenta (precedente E8a-3).
- **Push proactivo:** `corridaDiaria` (07:00) — tras computar `candidatas`, si hay relevantes, `_pushTelefono_(resumen PII-free)`. Reusar dedupe diario. Controlado por Config `push_proactivo_on` (default OFF hasta que Luciano cargue token).
- **Anti-brief-estático (Trillion/F4):** `brief`/`briefCacheado_` responde "qué cambió y qué requiere acción HOY" (vencimientos + salud + aprobaciones + encargos listos), ordenado por acción, no dump. Regla de 30 min si tarda.
- **Sato lo dice al abrir la voz:** `agent.py` entrypoint/greeting — antes del saludo, un `brief` liviano de pendientes; si hay, los enuncia ("Antes de arrancar: 2 vencimientos y 1 conector caído"). Refuerzo del push.
- Bastión: envío solo a OWNER/teléfono de Luciano; PII-free.

### 1.3 · Leer correo por voz (#4) — should · S
- **Tool voz `correo`** (read-only): sirve el triaje ya computado por `correoTriaje()` (remitente/asunto/resumen de últimos N; **sin cuerpos con PII**). Alta VOZ_TOOLS + case + `_soloOwner_` + ENDPOINTS_UI + assert. Respeta `correo_on` (si OFF, lo dice).
- `agent.py`: regla de uso ("3 mails de clientes sin responder: …").

### 1.4 · Async con lazo (#5) — should · S
- Formalizar N7 v2 en `agent.py`: "no navego en vivo; lo encargo y **te aviso cuando esté**" (el aviso real = 1.1). Sin web síncrona.

**Cierre Ola 1:** `node --check` + `_harness.js` + `python3 _verificar_index.py` → correr `selfTestTramo(n)` en editor GAS (los asserts nuevos NO los cubre el arnés offline — barrido estático D1-D20 obligatorio) → promote `/exec` → Purga → `_inventario_cierre.sh` → declaración "CIERRE incluye … / QUEDA ABIERTO …".

---

## OLA 2 — GATEADA (escribir/actuar hacia afuera). Bloqueada por 2.0.

### 2.0 · Sanear la frontera de confianza (P0) — must antes de 2.1-2.3
Parseo/validación de `objetivos.descripcion` + payloads de escritura contra vocabulario cerrado (S6) antes de que toquen prompts de agentes o acciones externas. Purga obligatoria.

### 2.1 · Escribir entregable en el Mac (#1) — must · M
- `encargos_runner.py`: copiar el entregable final a **dropzone único** `~/Documents/Claude/Satori-Entregables/<id>/` (con `id_cliente` en el nombre si aplica). El copiado lo hace el **runner Python, NO el `claude -p`** (el modelo no elige ruta). Allowlist de UNA carpeta; sin sobrescribir fuera de su `<id>/`; sigue sin `Write` en el scratch del LLM.
- Edge: permisos macOS, disco, colisión `<id>`.

### 2.2 · Agenda/calendario (#6) — should · M
`CalendarApp` (owner). Read primero ("qué tengo hoy/semana"); write (evento/recordatorio) detrás de S5 + gate. Solo calendario del owner.

### 2.3 · Redactar/mandar mensaje a cliente (#7) — should · M
Voz redacta borrador → S5 → cae en `11_aprobaciones.js` → Luciano aprueba desde CM. Nunca envío directo por voz. Destinatario validado contra roster.

**Cierre Ola 2:** ídem Ola 1 + gate Bastión formal (skill `bastion-satori`) por ser tools de escritura/acción externa.

---

## Orden de ejecución (Code)
1. **1.0** (`34_push.js` + Script Properties) ← requiere token de Luciano para go-live; código va igual.
2. **1.1** (lazo cerrado) → prueba con un ENC real.
3. **1.2** (health + push proactivo + anti-brief + saludo voz).
4. **1.3** (correo por voz). **1.4** (regla N7 v2).
5. Cierre Ola 1 (editor GAS + promote + Purga + inventario).
6. **2.0** sanear frontera → recién ahí **2.1/2.2/2.3**.

## Qué NO se hace
Web search síncrona en voz · tools de razonamiento a gpt-4o-mini (es router → escala al runner) · nada descartado (Supabase/DO/Three.js, daemon always-on, replicar 25 prompts Trillion, board nombres reales).

---

## Corrección 26-ago (post-Code) — §1.0 test path

**Error del encargo original:** especifiqué probar `_pushTelefono_(...)` desde el desplegable. Imposible:
helper privado (guión bajo, el editor no lo lista) + pide 2 args. Misma clase que `sgicConsulta_` /
`selfTestF2_` / `selfTestTramo(n)` (regla dura CLAUDE.md). El helper privado está BIEN; faltaba el wrapper.

**Fix (hecho por Code, endosado):**
- `_pushTelefono_(titulo, cuerpo)` queda privado (lo llaman corridaDiaria / encargos server-side).
- **`probarPushTelefono()`** — wrapper SIN args, con `_soloOwner_`, alta en `ENDPOINTS_UI` en el mismo cambio.
  Devuelve diagnóstico (provider presente, qué credencial falta) — reporta PRESENCIA de cada credencial,
  NUNCA su valor (un token en el Registro de ejecuciones = token filtrado). Harness 794/0.

**Pendiente al commitear (Code):**
- Commit PROPIO `[CAPACIDADES-SATO 1.0]` — `34_push.js` + wrapper. **NO** foldear en el commit de CRM PRO
  (mantener los dos encargos desenredados; es la disciplina que Code protegió anoche).
- Alta de `34_push.js` en la lista MODULOS del arnés + 3 asserts: (a) cuerpo del push PII-free,
  (b) el token/credencial no se loguea, (c) el fallo del push no tumba la corrida diaria.

**Orden de deploy (endosado, greenlight de Luciano):**
1. `bash _promote_exec.sh --go`  → SGIC @55 desde el /dev limpio de ahora.
2. `npx clasp push`              → recién después (arrastra CRM PRO + push al teléfono a /dev).

**Dependencia humana:** Luciano carga en Script Properties del MAESTRO `PUSH_PROVIDER=ntfy` +
`NTFY_TOPIC=<su topic>` (él mismo — el topic de ntfy es la llave de acceso, no se pega en el chat).

---

## CIERRE 27-ago (01:44) — Ola 1.0 en prod; 1.1-1.4 y Ola 2 abiertos

**CIERRE incluye:**
- **@55 en prod, GAS==repo (39 archivos/0 diff), CERTIFICADO 994/0** (6 tramos; tramo 6 D46-D47 corrido EN VIVO contra Sheets).
- `setup()` materializó `ultimo_contacto` + `motivo_perdido` → mover a `perdido` y "Registrar contacto (hoy)" operativos.
- CRM PRO + integridad SGIC + **canal de push (código `34_push.js` + wrapper `probarPushTelefono()`)** en prod. Asserts (12) + alta MODULOS: `8b5def5`.
- Script Properties cargadas por Luciano: `PUSH_PROVIDER=ntfy` + `NTFY_TOPIC` presentes.

**QUEDA ABIERTO (dónde vive cada cabo):**
1. **Push send falla — `ntfy HTTP 429`** (rate-limit). Config OK, envío bloqueado. Hipótesis (conf 7/10): ntfy.sh throttlea la IP compartida de Google en el tier anónimo. Fix: retry en unos min → si persiste, ntfy **cuenta+token** (header `Authorization: Bearer ${NTFY_TOKEN}` en la rama ntfy de `34_push.js` + Script Property; cierra también el caveat de topic público) **o** Pushover (US$4,99, token-auth, sin problema de IP). → cabo en `34_push.js`.
2. **Ola 1 · 1.1-1.4 SIN construir** — lazo cerrado del encargo, proactividad+health conectores+saludo de voz, correo por voz, N7 v2. → spec en este ENCARGO §1.1-1.4.
3. **Ola 2 gateada por 2.0** (sanear frontera de inyección) — escribir archivos/calendario/mensajes. → §2.
4. **Higiene git (deuda cosmética):** `34_push.js`+wrapper quedaron en `e98d5fa` mezclados con CRM PRO; anotado en el commit, historia pusheada NO reescrita.

**Rollback:** @54 (`_promote_rollback.txt`).
**Pre-existentes (inventario, NO de esta sesión):** RGPD DPA sin verificar · EJF SGIC no hallado · `importarConocimientoEntrenamiento()` spec sin implementar.
