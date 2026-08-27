# ENCARGO-CODE — Ola 1.2 (E2) · Proactividad + health conectores + saludo de voz

> **Ejecutor:** Code. **Fuente:** `RUNBOOK-CAPACIDADES-SATO-2026-08-27.md` §E2 · `ENCARGO-CODE-CAPACIDADES-SATO-2026-08-26.md` §1.2. **Estado base:** /exec @56, E1 en prod (D48 en vivo pendiente — cerrarlo antes de arrancar E2). **NTFY_TOKEN:** aún NO cargado — el push proactivo quedará cableado y mudo hasta que Luciano lo cargue (esperado en ~3 días, recordatorio programado). Eso NO bloquea E2: el código va igual, se activa solo cuando exista la credencial.

## Cerrar cabos E1 antes de arrancar E2 (paso 0)
1. **Luciano:** `selfTestTramo6()` en el editor (ahora incluye D48 15 asserts vivos) → si verde, cierra la deuda.
2. **Luciano:** eyeball /exec @56 (voz 30s "hola Sato, dame el brief"). Rollback @55 en `_promote_rollback.txt` si algo falla.
3. **Luciano (Mac):** reiniciar el agent.py de LiveKit (`launchctl kickstart -k gui/$UID/com.satori.voz.agent`) para que el saludo con `encargos_listos` entre en vivo.
4. Si D48 falla o el eyeball da error en el path del encargo → rollback + fix antes de tocar E2. **No arrancar E2 sobre una base rota.**

---

## E2.a · Health de conectores (must)
**Objetivo:** detectar "conector X sin sincronizar hace N días" y que alimente `candidatas` / `hallazgos` del brief + push.

**Cambios:**
1. **`src/19_conectores.js` — `sincronizarConectores`** (línea ~470): al cierre de cada conector, `setConfig('conector_'+id+'_ult_sync', hoyISO())`. Al fallar un conector, NO tocar `_ult_sync` (es el propio criterio de stale).
2. **`src/16_salud.js` — `correrSalud`**: agregar chequeo nuevo `conectores_sync`. Umbral `conector_max_dias` (Config, default `2`). Para cada conector con `on=true`, comparar `hoyISO() - conector_<id>_ult_sync` en días; si supera umbral → estado `warn`, si supera 3× umbral → `crit`. Push a `hallazgos`.
3. **LISTA-CONTRATO:** actualizar `correrSalud` asserts existentes (D-existente que cuenta hallazgos) por el chequeo nuevo. Alta assert D49a: chequeo `conectores_sync` presente; D49b: sin `_ult_sync` de conector activo → estado `warn` (default-deny amigable, no `crit`, para que un conector recién configurado no arme escándalo el primer día).

**Bastión:** el timestamp es un dato interno, no PII; escribir en Config es idempotente.

## E2.b · Push proactivo 07:00 (must)
**Objetivo:** cuando `corridaDiaria` termina y hay algo que Luciano deba mirar, mandar UN push PII-free al iPhone.

**Cambios (`src/06_avisos.js`, dentro de `corridaDiaria` línea 262 — al FINAL, después de `calentarEstadoCacheSistema_`):**
```
try { resumen.push_proactivo = pushProactivoDiario_(resumen); }
catch (e) { try { Logger.log('pushProactivoDiario fallo: ' + e.message); } catch (_e) {} }
```

Función nueva `pushProactivoDiario_(resumen)`:
- Gate: `getConfig('push_proactivo_on') !== 'true'` → return `{enviado:false, motivo:'push_proactivo_on=false'}` (default OFF hasta que Luciano lo prenda; espeja el patrón de `brief_push_on`).
- Cuenta señales del `resumen`: `resumen.avisos_nuevos` (vencimientos + tareas estancadas + proyectos sin movimiento), `resumen.salud.crit + salud.warn`, `resumen.vigilancia.criticos`. Recuento breve de encargos `listo && !avisado` (usa `encargosListos_` lectura pura, NO la que marca).
- Si TODO en cero → return `{enviado:false, motivo:'sin señales'}`. NO envía silencio.
- Cuerpo (PII-free): `"Hoy: N avisos, S conectores en warn/crit, K encargos listos. Mirá el CM."` (sin cifras de cliente, sin nombres). Título: `"Satori · brief del día"`.
- Dedupe diario: usa `hoyISO()` en clave de `SCRIPT_CACHE.get('push_diario_'+hoy)`. Si ya salió hoy → return `{enviado:false, motivo:'ya enviado hoy'}`.
- Dispara `_pushTelefono_(titulo, cuerpo)`. Devuelve `{enviado, motivo}`.

**Asserts D49c-e:** OFF no envía · sin señales no envía · dedupe diario funciona. **Sin token NTFY, el push devuelve `enviado:false, motivo:'ntfy HTTP 429/token faltante'` y NO tira la corrida** (el try/catch envuelve).

## E2.c · Anti-brief-estático (should)
**Objetivo:** `briefDiario` responde "qué cambió y requiere acción HOY" en primeras 3 líneas, no un dump.

**Cambios:** `briefDiario()` (buscar en `src/*.js`) — al comienzo del render:
```
## HOY hay que mirar
- <vencimientos que caen hoy o mañana, ordenados por fecha> (o "nada")
- <conectores en warn/crit> (o "conectores OK")
- <encargos listos sin avisar> (o "sin encargos pendientes")
```
Después el brief actual como estaba. Preserva contrato v1 (D2/D2b): la línea `# Brief — Satori` y las secciones existentes no se tocan — solo se inserta el bloque al principio antes de la primera `## `.

**Assert D49f:** `briefDiario()` empieza con `# Brief — Satori\n## HOY hay que mirar\n`.

## E2.d · Saludo de voz con pendientes (must)
**Objetivo:** `agent.py` — en el greeting del entrypoint, después del `encargos_listos` de E1, agregar UN llamado a `brief` (tool ya existe, cacheada) y enunciar el bloque "HOY hay que mirar" si tiene señales.

**Cambios (`voz/agent/agent.py`, en el entrypoint donde vive el greeting):**
- Llamar `brief()` con timeout propio de 10s, fail-open (si tarda, salta y saluda normal).
- Parsear las primeras líneas del bloque "HOY hay que mirar"; si TODO dice "nada"/"OK"/"sin" → NO enunciar (silencio bueno). Si hay algo → enunciarlo en 1 frase corta: "Antes de arrancar: <vencimiento>, <conector>, <encargo>." (respeta las 8 reglas SOUL, formato voz).
- Si el push proactivo del día ya salió, NO duplicar el enunciado (el objetivo del saludo es RE-forzar, no repetir palabra por palabra — leer del brief está bien).

**Asserts (offline, en `agent.py` o test aparte):** parser toma el bloque; si el bloque está "todo OK" → no enuncia; timeout 10s cortado.

## E2.e · Config keys nuevas (LISTA-CONTRATO)
- `push_proactivo_on` (bool, default `false`) — habilita el push 07:00. Documentar en `docs/CONFIG.md` si existe, o comentario en `06_avisos.js`.
- `conector_max_dias` (int, default `2`).
- `conector_<id>_ult_sync` (auto-escrito por conector, no tocar a mano).

## Contrato de cierre E2
1. `node --check` en los archivos tocados.
2. `_harness.js` verde.
3. **Luciano** en editor: `selfTestTramo(6)` — asserts D49a-f verdes contra Sheets reales.
4. `clasp push` /dev → eyeball → **NO promover si D48 sigue sin certificar de E1**.
5. Reiniciar agent.py.
6. Corrida forzada `corridaDiaria()` en editor con `push_proactivo_on=true` para ver que el push salga (si NTFY_TOKEN está cargado) o quede `enviado:false` limpio (si no).
7. Promote /exec. Registro de rollback.
8. Commit propio `[CAPACIDADES-SATO E2]`. Actualizar HANDOFF.md.
9. Purga E2 (skill `purga-de-errores`) — foco: (a) `pushProactivoDiario_` no tira la corrida jamás; (b) sin token NTFY el sistema opera igual; (c) el saludo de voz no cuelga por brief lento; (d) los timestamps de conector son idempotentes.

## Qué NO va en E2
- Nada de Ola 2 (frontera de inyección sin sanear).
- Web síncrona en voz.
- Enviar a terceros (solo OWNER/teléfono de Luciano; PII-free siempre).
- Cambiar el orden de `corridaDiaria` — se AGREGA al final, no se refactoriza.

## Después de E2 (para siguiente relay)
E3 correo por voz (tool `correo` read-only sobre `correoTriaje_`) → E4 cierre Ola 1 + Purga → **E5 GATE (Bastión: sanear frontera de inyección)** → E6/E7 Ola 2.
