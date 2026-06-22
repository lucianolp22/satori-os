# DEPLOY — doPost tool-backend de Voz (handoff para Claude Code)

**Estado:** código **ESCRITO + verificado offline** por Cowork (`node --check` + harness `vm` que corre el `doPost` real: 14/14). Falta el paso **prod** (push + deployment dedicado + tests live) = **ALTO impacto** → lo ejecuta Code con OK de Luciano. Fork de marca confirmado: **(b) OpenAI Realtime**.

## Qué cambió (working tree, sin commitear)
- `src/08_webapp.js`: + `doPost(e)` + helpers (`vozOut_`,`vozAuth_`,`ctEq_`,`vozStr_`,`vozLog_`) + `VOZ_TOOLS`; `doGet()` → `doGet(e)` **endurecido** (gate por `Session.getActiveUser().getEmail()` + `OWNER_EMAIL`).
- `src/09_selftest.js`: + bloque Voz (auth / whitelist / bad_json / estado).

## Contrato (agente LiveKit → doPost)
POST JSON: `{ "secret":"<VOZ_TOOL_SECRET>", "tool":"...", "args":{...} }`
tools: `estado`(idCliente?) · `brief`(idCliente?) · `vehemence` · `cliente`(idCliente) · `cerebro`(idCliente) · `capturar`(texto)
respuesta: `{ ok:true, tool, data }` | `{ ok:false, error }`

## Parches Purga aplicados (verificados offline 9/9 — node --check + harness vm)
#1 log de diagnóstico de lockout en `doGet` · #2 voz `coral` · #3 rate-limit 30/min (`vozRate_`) · #4 `doGet` **fail-closed** (exige `OWNER_EMAIL`) · #5 `idCliente` validado contra roster (`cliente_desconocido`) · #6 `ctEq_` por digest SHA-256 (no filtra largo) · #7 log a hoja `Voz_log` (autocreada).
⚠ **Por #4: `OWNER_EMAIL` es OBLIGATORIO y va ANTES del push** — si no, `/dev` queda en "No autorizado" para todos (incluido vos) hasta setearlo.

## Runbook (orden ESTRICTO; cada paso marcado)
0. **[bajo]** Si `git commit` falla por lock: `rm -f .git/index.lock .git/HEAD.lock` (el sandbox no puede; Code sí).
1. **[bajo]** `git diff src/08_webapp.js src/09_selftest.js` · `node --check src/08_webapp.js src/09_selftest.js`.
2. **[ALTO · Luciano · ANTES del push]** Script Properties (editor → Configuración del proyecto → Propiedades del script):
   - `OWNER_EMAIL` = `luciano@satoriconsultoria.com` ← **obligatorio** (doGet fail-closed por #4)
   - `VOZ_TOOL_SECRET` = token aleatorio ≥32 chars (`openssl rand -hex 24`). **Guardalo** → va al agente LiveKit.
3. **[ALTO · aprobar]** `clasp push`. ⚠ Actualiza HEAD → el `/dev` de la UI toma el `doGet` nuevo YA.
4. **[ALTO · TEST LOCKOUT antes de seguir]** Abrí la UI (la URL que usás hoy) logueado como Luciano:
   - Carga la shell → OK, seguí.
   - "No autorizado" → **LOCKOUT**: revertí `git checkout src/08_webapp.js && clasp push` y avisá a Cowork (plan B: `doPost` en un proyecto GAS aparte, sin tocar `doGet`).
5. **[bajo]** En el editor correr `selfTest()` → asserts "Voz …" verdes + "— TODO OK —".
6. **[ALTO · aprobar]** Crear **deployment NUEVO**: Implementar → Nueva implementación → App web → Ejecutar como: **yo** → Quién accede: **Cualquiera** → Implementar. Copiar la URL `/exec`. **NO editar la implementación de la UI.**
7. **[bajo]** Tests live (curl) ↓.
8. Pasar la URL `/exec` a Cowork (para Purga + el paso del agente LiveKit).

## Tests live (curl)
```bash
URL='https://script.google.com/macros/s/AKfy…/exec'; SEC='<VOZ_TOOL_SECRET>'
curl -sSL -X POST "$URL" -H 'Content-Type: application/json' -d "{\"secret\":\"$SEC\",\"tool\":\"brief\"}"   # → {ok:true,...}
curl -sSL -X POST "$URL" -H 'Content-Type: application/json' -d '{"secret":"malo","tool":"brief"}'           # → unauthorized
curl -sSL "$URL"                                                                                              # → HTML "No autorizado"
```

## Bastión (notas vivas)
- 🔑 **Guardián de Accesos** — `VOZ_TOOL_SECRET`/`OWNER_EMAIL` en Script Properties, nunca en el repo. Si el secreto se filtra → rotarlo ahí.
- 🗄️ **Custodio (para el paso del AGENTE, no el doPost)** — `cliente`/`cerebro`/`vehemence` devuelven cifras de cliente → el TTS del vendor las vocaliza. Mitigación blueprint §5: la voz responde de alto nivel, el detalle a pantalla. Decidir antes de prod.
- ⚔️ **Adversario** — rate-limit/anti-replay NO va en v1 (el secreto es el control; piloto personal). Upgrade medio si se abre a cliente: `CacheService` por ventana + HMAC+timestamp.
- Least-privilege: este canal NO expone aprobaciones/email/borrados. Mantenerlo así.

## Sincronización repo ↔ GAS ↔ deployments (por qué `/exec` mostraba viejo)
- `/dev` = **HEAD** del proyecto (siempre lo último guardado). `/exec` = **versión CONGELADA** → no se actualiza solo; hay que republicar.
- 3 capas a alinear: **repo (git = fuente de verdad)** → `clasp push -f` → **GAS HEAD (`/dev`)** → **publicar versión** → **`/exec`**.
- **Antes del push del doPost:** `clasp pull` en un check y `git diff` — si sale limpio, GAS HEAD no tiene ediciones de editor fuera del repo y el push es seguro. (Hoy el repo ya tiene el orbe en `src/index.html`, HEAD `87cf0d5` → seguro.)
- `clasp push -f` actualiza **HEAD/`/dev`**; **NO toca `/exec`**. Para refrescar `/exec`: editor → Implementar → Gestionar implementaciones → ese deployment → editar (lápiz) → **Versión: Nueva** → Implementar. **No cambiar "Quién tiene acceso".** Hacerlo SOLO tras pasar el test de lockout del `doGet` (paso 4).
- El doPost va en un deployment **NUEVO "Cualquiera"** — no es `/exec` ni la UI.
