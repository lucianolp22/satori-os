# ENCARGO CODE — T3 · MÓDULO M (motor) — 2026-07-21

**Contexto:** Módulo S CERRADO (selfTest verde en editor — E8a-3 ahora cuenta 7 chequeos, D19 corrió; secretos sembrados 2026-10-19; eyeball OK). Purga de S corrida por Cowork: 0 críticos/altos, 3 findings — los 2 de seguridad se cierran en **M1** de este encargo. Arranca el Módulo M del plan T3.

**Este encargo cubre M1 + M2** (tight, verificable en un ciclo). **M3-M5 quedan como roadmap al pie** — Cowork los especifica en un encargo aparte cuando M1+M2 cierren. NO arrancar M3-M5 ni el Módulo H.

**Reglas vigentes:** git write solo vos · trabajar contra /dev, NO tocar /exec · verificar contra el código antes de construir · `clasp run` bloqueado ⇒ los asserts se corren en el editor (Luciano) · siembra de riesgo y gates D19 verdes: NO re-flaggear · comandos a Luciano limpios (sin `#` inline ni paréntesis).

---

## M1 — Hardening de seguridad (cierra la purga de S). Empezar por acá; push propio.

**M1a — `_ctxSistema_()` deja de ser un bypass auto-declarado (purga #1, Medio).**
Hoy (`22_seguridad.js:33`) `_ctxSistema_()` setea `SATORI_CTX_SISTEMA = true` sin verificar nada. Los 7 entry points de sistema (corridaDiaria, drenarCola, correrDirector×2, clasificarBandeja, sincronizarConectores, backupSemanal) lo llaman en su 1ª línea. No es explotable hoy (doGet gatea la página, sin página no hay bridge de google.script.run), pero es defensa-en-profundidad frágil.

Fix: `_ctxSistema_()` solo concede contexto de sistema si la ejecución NO tiene un usuario distinto del owner:
```
function _ctxSistema_() {
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (_e) { who = ''; }
  var owner = '';
  try { owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || ''; } catch (_p) {}
  // Trigger real = sin usuario activo (email ''); ejecución del owner en editor = email===owner.
  // Un usuario REAL no-owner que llegara a invocar un entry point de sistema por RPC NO obtiene
  // el flag → los _soloOwner_ de adentro lo cortan. No rompe voz (doPost = sin usuario activo)
  // ni triggers (corren como el owner que los instaló, o sin usuario).
  if (who === '' || who === owner) { SATORI_CTX_SISTEMA = true; return true; }
  try { Logger.log('_ctxSistema_ NEGADO: who=' + who); } catch (_l) {}
  return false;
}
```
**Verificá el supuesto antes de confiar:** en ESTE deployment, bajo un trigger instalado, `Session.getActiveUser().getEmail()` devuelve `''` o el owner (nunca un tercero) — dejalo escrito en un comentario y, si podés, agregá un assert D19 que compruebe que con email='' y con email=owner el flag se setea, y con email=otro NO. doPost ya llama `_ctxSistema_()` DESPUÉS de validar el secreto: un POST externo no trae usuario activo → email '' → sigue funcionando. Confirmá que voz y un trigger siguen andando en el eyeball.

**M1b — `_nuevoSecreto_` con fuente fuerte (purga #2, Bajo).**
`22_seguridad.js:178-183` usa `Math.random()` — no es CSPRNG. Para un módulo de seguridad, reemplazalo por `Utilities.getUuid()` concatenado (2-3 veces, sacando los guiones) o `Utilities.computeHmacSha256Signature(Utilities.getUuid()+Utilities.getUuid(), Utilities.getUuid())` → base64/hex, recortado a ≥40 chars. Sin dependencias externas. No cambia la interfaz de `rotarSecreto*`.

**M1c — regla anti-drift de ENDPOINTS_UI (purga #3, Bajo).** Ya la anotaste; confirmá que está en el CLAUDE.md del repo: "endpoint client-callable nuevo → alta en `ENDPOINTS_UI` en el MISMO commit".

Cierre M1: assert(s) D19 nuevos para el hardening · node --check · guardia drift · `clasp push` a /dev · commit. **Checkpoint sugerido:** avisá y frená acá para que Luciano corra `selfTest()` y confirme que voz+triggers siguen vivos, ANTES de M2. (Si preferís seguir a M2 en la misma sesión, dejalo dicho y que el selfTest cubra ambos.)

---

## M2 — D6 encadenado con estados (de foto a película)

**El gap, dicho por el propio sistema:** el brief imprime *"Tendencia: sin serie histórica del North Star (no se registra por período) — es foto, no película."* `recomendacionDelDia_` (`18_direccion.js:1102`) ya elige bien y saltea pivots muertos, y el cerebro tiene `estado_actual` (snapshot) + log append-only, pero **nadie registra el North Star por período**, así que no hay tendencia real.

**M2a — serie temporal del North Star.** Al correr `corridaDiaria` (o donde calcule el NS de sistema), persistir UN datapoint diario: `{fecha, metrica, actual, meta}` — idempotente por fecha (un solo punto por día; re-correr el mismo día actualiza, no duplica). Elegí el soporte más liviano que YA exista y no rompa lectores: preferí el `cerebro_log` append-only o una hoja/serie dedicada; **NO** metas esto en `Config ns_satori_*` (ahí vive la definición, no la serie). Dejá escrito por qué elegiste ese soporte.

**M2b — la Tendencia del brief lee la serie.** Cablear la sección "Tendencia" del brief (contrato v1, `briefDiario`) para que, con ≥2 datapoints, muestre el delta real (subió/bajó/estable + variación) en vez del texto de "sin serie". Con <2 puntos, mantené el texto honesto actual (no inventar tendencia — respetá el assert D14e "sin 2 puntos NO hay tendencia").

**M2c — no romper lo verde.** El North Star sembrado no se pisa (ya hay guard "North Star ya sembrado, no se pisa"); esto AGREGA una serie, no toca la definición. Verificá que `northStarSatori_` y los asserts D3/D18 siguen pasando.

Cierre M2: asserts nuevos (serie idempotente por fecha · tendencia con 2 puntos da delta · con 1 punto NO inventa) · node --check · drift · push /dev · commit · actualizar HANDOFF.md con el estado de M1+M2 y las 2 líneas de lo que Luciano eyeballea en /dev (brief muestra tendencia tras 2 días, o sembrá 2 puntos de prueba para verlo en el acto).

---

## Roadmap M3-M5 (NO ejecutar — encargo aparte cuando M1+M2 cierren)
- **M3 · D8 memoria caliente/fría:** el cerebro no tiene tiering. Hot = reciente/estado_actual (lectura rápida); cold = log viejo resumido/archivado. Definir política de corte y resumen antes de tocar código.
- **M4 · evals + piso determinístico:** no hay golden-set. Armar evals para las piezas con LLM (clasificador Bandeja, recomendación, voz) con un piso determinístico que no dependa del modelo.
- **M5 · verificación ≥2 dominios (score ≠ verificado):** un hallazgo/recomendación no queda "verificado" hasta confirmarse por 2 lentes independientes. Definir qué dominios y dónde se aplica.

**NO hacer:** M3-M5 · Módulo H · tocar /exec · re-sembrar objetivos de tenants (pausa clientes) · re-flaggear gates verdes.
