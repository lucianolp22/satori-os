# ENCARGO-CODE · SATO VIVIENTE (v2 · integrado con Ola 1 en flight + CRM Pro Mobile) — 27/08/2026

> **Para:** Claude Code, en el repo `~/Documents/Claude/Projects/SatoriOS`.
> **Cowork planificó** (esta sesión); **Code ejecuta autónomo, con checkpoints propios y prudencia**; Luciano supervisa y aprueba gates.
> **ESTE ES EL ÚNICO ENCARGO A EJECUTAR EN LA SESIÓN.** El `ENCARGO-CODE-CRM-PRO-2026-08-25.md` YA fue ejecutado en @55/@56 (26-ago); NO se re-ejecuta. La única pieza pendiente de él (`§2d.MOBILE`, insertada hoy 27-ago como aditivo) está absorbida acá como **Fase F-CRM-Mobile** del Bloque G.
>
> **Alcance:** integrar los 4 prompts pedagógicos (livingmind, superbrain, subagentcaching, selfknowledge) a Satori OS + Sato Ubicuo (espejo widget↔LiveKit) + Cerebro viviente always-on + memoria transversal de patrones + optimización de tokens Claude Max + módulo CRM Pro Mobile (aditivo al `ENCARGO-CODE-CRM-PRO-2026-08-25.md`).
> **Modo:** AUTÓNOMO en 1 sesión de corrido, con GATES DE ATERRIZAJE por bloque y coordinación de agentes internos.
> **Confianza de la planificación:** 8/10.

---

## §0 · REGLAS DEL SESSION (leé una vez, no las repitas)

1. **AUTÓNOMO PERO PRUDENTE.** Ejecutá el plan de corrido. Escalás a Luciano cuando: (a) un gate obligatorio lo pide (Consejo, Bastión pre-write con dudas), (b) un test falla y el rollback no resuelve, (c) descubrís un supuesto roto que invalida más de 1 fase adelante, o (d) chocás con un cabo pendiente de otra tanda que no te corresponde cerrar.
2. **RESPETÁ LA ESCALERA DE MADURACIÓN** (0 manual → 1 skill → 2 cadena con gates → 3 automatización). No saltes niveles.
3. **AISLAMIENTO MULTI-TENANT ES LEY** (regla dura 29-jul, T1.8). Todo endpoint nuevo pasa por `_soloOwner_`, valida `_satoClienteValido_`, sella origen. Cross-tenant fail-closed con motivo.
4. **NUNCA "CIERRE" SIN `bash _inventario_cierre.sh`**. Formato final obligatorio: `CIERRE: incluye X · QUEDA ABIERTO: Y`.
5. **CHECKPOINTS DE COMMIT.** Un commit por fase. Nunca batches. Cada commit compila y NO rompe `/exec`. Rama `feat/sato-viviente` para todo, merge a `main` sólo cuando la fase entera pasó verificación.
6. **NO REESCRIBAS LO QUE YA FUNCIONA.** Prompt caching TC-10 en `05_costos.js` ya está bien (03-ago). Aislamiento `_satoDatos_` T1.8 ya está bien. Panel Sato in-page (T4, 25-ago) ya está bien. Orbe Persistente v2 fiel al Núcleo (T2, 25-ago) es intocable (regla +51). CRM Pro §2d en prod (@55/@56) ya está bien. Dashboard `web/dashboard.html` existe — se extiende, no se rehace.
7. **LECCIÓN +59 (27-ago tarde) — CADA CAMBIO EN `voz/agent/*.py` = UN RELOAD NUEVO SIN EXCEPCIÓN.** Consolidá todos tus cambios a `agent.py` en la MISMA tanda y hacé UN solo `launchctl kickstart -k gui/$UID/com.satori.voz.agent` al final del bloque. Nunca dejes cambios en `agent.py` sin reload posterior.
8. **PUSH PROACTIVO — DEFAULT OFF NO SE TOCA.** `push_proactivo_on` sólo lo enciende Luciano tras eyeball. Este encargo NO lo enciende.
9. **AGENTES INTERNOS A USAR:** `Explore` (localizar código), `Plan` (arquitectura de F3, F5, F7, F10), `code-reviewer` (adversarial post F6/F7), skills `bastion-satori`, `consejo-asesores`, `purga-de-errores`, `deploy-gas`, `handoff-proyecto`.
10. **HANDOFF FINAL OBLIGATORIO** en `HANDOFF-2026-08-27-SATO-VIVIENTE-CIERRE.md` con `handoff-proyecto`.

---

## §1 · ESTADO REAL DEL REPO AL 27-AGO TARDE (verificado por Cowork; leelo y confirmá)

**Prod y dev (evidencia `git log`, `HANDOFF.md`, memorias `satori-os`, `sato-ejecutor`):**
- `/exec` **@56** (`8ed2150`) = E1 Ola 1.1 (encargos_listos, encargosReportar_ push, saludo voz). Rollback @55 (CRM Pro CERTIFICADO 994/0).
- `/dev` en `b852d0d` = E1 + **E2** (proactividad + health conectores + anti-brief-estático + saludo con pendientes). Verde offline 899/0. **NO promovido.**
- CRM Pro §2d ya en prod desde @55 (backend M1·M2·M3·S4·S5·S6·C7·C8 + frontend). Materialización de columnas hecha por Luciano el 26-ago.
- Sato unificado (T4, 25-ago): panel in-page DENTRO del OS por defecto, voz full-duplex en 📞/ventanita opcional, botones "Sato" ocultos con `display:none`.
- Orbe Persistente v2 (T2, 25-ago) fiel al Núcleo — regla +51 clavada.
- Módulo CRM Pro Mobile con handoff completo del 27-ago (`HANDOFF-2026-08-27-CRM-PRO-MOBILE-modulo-integracion.md`), maqueta `MAQUETA-CRM-PRO-MOBILE-v1.html` en repo, bloque §2d.MOBILE ya insertado en `ENCARGO-CODE-CRM-PRO-2026-08-25.md`.

**Cabos abiertos de otras sesiones (con dueño explícito) — NO SON TUYOS para cerrar, pero SÍ para AGUARDAR:**
1. `[Luciano]` verificar `NTFY_TOKEN` en Script Properties (D48a3 reporta 401).
2. `[Luciano · Mac]` **2do reload de `agent.py`** (`launchctl kickstart -k gui/$UID/com.satori.voz.agent`).
3. `[Luciano]` eyeball voz 30s en /dev y /exec @56 (dice "hola Sato, dame el brief" → debe enunciar bloque "HOY hay que mirar (N)").
4. `[Code · post-eyeball verde]` promote E2 a `/exec @57` con `_promote_exec.sh --go`.
5. `[Luciano · post-promote]` `setConfig('push_proactivo_on', 'true')` — decisión consciente. Sin esto E2 corre INERTE.
6. `[Code · después]` E3 correo por voz (encargo pendiente).
7. **Ola 2 (E4-E7) BLOQUEADA por E5 GATE Bastión** (sanear frontera `objetivos.descripcion → correrDirector → LLM crudo`, 16-jul, no negociable).

---

## §2 · DECISIONES YA CERRADAS (no re-abrir en esta tanda)

| Decisión | Valor |
|---|---|
| Sato el Asociado | Sato-VOZ (LiveKit, orbe 📞) es el motor único; el panel in-page del OS es superficie de operación |
| Chat Sato del OS | Se EXTIENDE con **widget SatoUbicuo** — dock persistente en header, NO reemplaza al panel in-page T4 (coexisten) |
| Espejo widget ↔ LiveKit | **Opción A** — vía hoja `charla` con polling suave (1.5-2 s) |
| Widget SatoUbicuo — posición | Panel fijo desplegable en header, colapsable, **NO se superpone con tab bar mobile ni con orbe ni con panel Sato in-page** — z-index escalonado |
| Motor Sato-VOZ | Migrar a Claude Haiku 4.5 / Sonnet 4.6 — **CONDICIONADO a F0 (≤+15%) + F5 Consejo GO + E2 promovido + push proactivo verificado** |
| Tope aborto Claude Max | +15% consumo semanal proyectado |
| Memoria per-cliente | Sostenida (hoja `charla` por tenant, `_satoDatos_` sella origen) |
| Memoria transversal `SatoPatrones` | **DIFERIDA** — Ola 2, requiere E5 gate Bastión previo. NO se ejecuta en esta tanda |
| Cerebro viviente | Launchd permanente + verificar función-agentes + subir TODAS las mejoras plausibles de livingmind |
| Livingmind aplica a | **`GRAFO.html`/Cerebro únicamente**. NUNCA al Orbe Persistente v2 ni al orbe del CM (regla +51) |
| Dashboard tokens | Ya existe (`web/dashboard.html` · USD 649,54 al 18-ago) — se EXTIENDE |
| CRM Pro Mobile | Fase nueva F-CRM-Mobile — bloque §2d.MOBILE ya insertado en `ENCARGO-CODE-CRM-PRO-2026-08-25.md` |

---

## §3 · MAPA DE ARCHIVOS RELEVANTES (verificado hoy con `find`/`git log`)

```
SatoriOS/
├── src/
│   ├── 05_costos.js          # llamadaAPI · _systemBloques_ · caching TC-10 (349L)
│   ├── 15_cerebro.js         # upsertNodo/Arista · dimensionDeTipo_ · leerEstado (590L)
│   ├── 24_soul.js            # SOUL S1-S8
│   ├── 26_sato.js            # Sato-in-GAS · SATO_FUENTES · _satoDatos_ · satoChat · satoCierreSesion (701L)
│   ├── 08_webapp.js          # doPost · VOZ_TOOLS · encargos_listos endpoint · doPost cases
│   ├── 30_correo.js          # M2 correo → CRM
│   ├── 33_cartera.js         # CRM Pro §2d (M1-C8) · _sellarContacto_ · carteraPipeline
│   ├── 34_push.js            # canal push (ntfy · rama Bearer NTFY_TOKEN)
│   └── 29_vigilancia.js      # _senalRetencion_ · pushProactivoDiario_ (E2 /dev)
├── voz/
│   ├── agent/
│   │   ├── agent.py          # 832L · SatoriVoz(Agent) · INSTRUCCIONES ~180L inline · @function_tool
│   │   ├── brief_hoy.py      # E2.d parser bloque HOY
│   │   ├── gas_voz_client.py # Bearer + secreto + 302
│   │   └── requirements.txt
│   ├── launchagents/         # plists launchd voz
│   └── runner/               # F2 Sato Ejecutor
├── web/
│   └── dashboard.html        # Fuente A · SVG/CSS vanilla · 55 sesiones
├── scripts/
│   ├── gen_dashboard.py
│   ├── run_diario.py
│   └── _capabilities_gen.sh
├── _cerebro/_scripts/
│   └── grafo_server.py       # 127.0.0.1:8788 · launchd caído (verificado hoy)
├── CAPABILITIES.md           # 16KB · autogenerado
├── CLAUDE.md                 # doctrina AREL
├── HANDOFF.md                # espejo vivo (196KB)
├── ENCARGO-CODE-CRM-PRO-2026-08-25.md          # §2d.MOBILE ya insertado (27-ago)
├── HANDOFF-2026-08-27-CRM-PRO-MOBILE-modulo-integracion.md
├── MAQUETA-CRM-PRO-MOBILE-v1.html              # 65KB · referencia visual
└── docs/                     # crear si no existe (SATO-IDENTIDAD.md, .drift-allowlist.txt)
```

**Endpoints nuevos ya vivos (no crear duplicados):** `encargosListos`, `encargosReportar_`, `_sellarUltSync_`, `pushProactivoDiario_`, `probarPushTelefono`, `_sellarContacto_`, `carteraRecontacto`, `correoConfirmarThread`, `correoDescartarThread`, `correoCandidatosStaging`, `carteraSnapshotMd`.

**Claves:** MAESTRO `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` · scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` · `/exec` @56 · voz `xcAUMhbpNX2WRGsuhjFy` · repo `github.com/lucianolp22/satori-os`.

---

## §4 · GATES DE PRE-ARRANQUE (bloqueantes; verificar en orden)

**PC-0. Working tree limpio.** `git status --short` → limpio. Si hay drift, FRENAR y avisar.

**PC-1. Estado Ola 1 conocido.**
- `git log --oneline -3` → confirmar HEAD.
- `clasp deployments` → confirmar `/exec @56`.
- `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8788/` → si NO 200, el Cerebro está caído (esperado — se resuelve en F2a).

**PC-2. Cabos abiertos de E2 — no son tuyos, pero determinan qué podés ejecutar.**
Leé `HANDOFF.md` (cabecera) y las memorias `satori-os` + `sato-ejecutor`. Verificá:
- ¿`selfTestTramo6()` fue corrido por Luciano contra Sheets? (D48+D49 verdes en vivo)
- ¿NTFY_TOKEN resuelto?
- ¿2do reload de `agent.py` hecho?
- ¿E2 promovido a `/exec @57`?
- ¿`push_proactivo_on=true` encendido?

**Interpretación de resultados y ruta:**
- **Si TODOS verdes** → arrancás bloques A/B/C/D/E en el orden normal.
- **Si algo de E2 pendiente** → arrancás sólo bloques A (F0/F1/F2) — que NO tocan `agent.py` ni GAS de módulos E2 — y esperás. Los bloques B/C/D/E (que tocan `agent.py`) quedan gateados hasta que Luciano confirme cierre de E2.
- **Si `/exec ≠ @56` o rama distinta a main** → FRENAR y avisar.

**PC-3. Consistencia con encargos vecinos.**
- `ENCARGO-CODE-CRM-PRO-2026-08-25.md` tiene §2d.MOBILE insertado (verificar por grep).
- No hay conflictos abiertos en git.

---

## §5 · FASES ORGANIZADAS EN BLOQUES

### Bloque A · Independiente del estado E2 (arranca siempre)

#### F0 · Auditoría consumo Claude Max [30 min · BLOQUEANTE para F5-F6]

**Objetivo:** cuantificar consumo actual + proyección impacto F6.

**Pasos:**
1. Leer `web/dashboard.html` y `out/consolidado.csv` para totales (baseline USD 649,54 al 18-ago).
2. Extraer del último mes: sesiones Sato-VOZ (buscar en `~/Library/Logs/` o los logs propios de `agent.py`), turnos/sesión, tokens promedio.
3. Estimar tokens Sato-VOZ actual (gpt-4o-mini) y proyectar migración a Haiku 4.5 con caching efectivo (min 4096 tokens del prefix estable).
4. Comparar contra baseline semanal Claude Max.
5. Escribir `out/audit-tokens-2026-08-27.md` con: (a) baseline actual, (b) proyección con Haiku, (c) proyección con Sonnet, (d) veredicto GO / NO-GO / GO-CONDICIONAL (Haiku sí, Sonnet no).

**Veredicto:** proyección >+15% → **F5+F6 abortados, se ejecuta F6' (two-block sobre gpt-4o-mini)**.

**Verificación:** archivo existe, 4 secciones, veredicto numérico.

**Escalar si:** logs Sato-VOZ vacíos → pedir estimación manual a Luciano.

---

#### F1 · Baseline hit-rate caching Sato-in-GAS y agentes [30 min]

**Objetivo:** confirmar que TC-10 caching (03-ago) funciona en vivo.

**Pasos:**
1. Para CLI-000, CLI-002, CLI-003, LC Travel, DAM: leer `Costos_API` últimos 7 días.
2. Calcular por módulo (`sato_ficha`, `analista`, `conciliador`, `vigia`, `cobrador`, `abastecedor`, `clasificador`, `direccion`, `sato_voz`): `cache_read / (input + cache_write + cache_read)`.
3. Flag módulos con `cache_intentado=true` y hit-rate <30% (silent invalidator).
4. Anexar tabla al `out/audit-tokens-2026-08-27.md` § "hit-rate por módulo".

**Escalar si:** algún módulo con `cache_intentado=true` y hit-rate <5% → invalidator sistémico, 15 min de investigación y reporte.

---

#### F2 · Cerebro viviente [3 h · independiente de Ola 1]

##### F2a · Launchd permanente (45 min)
1. `Explore` en `voz/launchagents/` para patrón usado.
2. Crear `voz/launchagents/com.satori.grafo-server.plist`: `Label=com.satori.grafo-server` · `Program=/usr/bin/python3` + path a `_cerebro/_scripts/grafo_server.py` · `KeepAlive=true` · `RunAtLoad=true` · `StandardOutPath`/`StandardErrorPath` bajo `~/Library/Logs/satori-grafo-server.{out,err}.log` · `WorkingDirectory` correcto.
3. Instalador `scripts/install-grafo-launchd.sh` idempotente (`launchctl bootstrap` con fallback a `bootout && bootstrap`), no pisa hooks ajenos, `--force` explícito.
4. Ejecutar. `curl` → 200. `kill -9` → resucita en <5 s.

**Rollback:** `launchctl bootout gui/$(id -u)/com.satori.grafo-server`.

##### F2b · Función-agentes viva (45 min)
1. Por tenant (CLI-000, CLI-002, CLI-003, LC Travel, DAM): llamar `estadoVigente(id)` (RPC test), contar `nodos`/`aristas`/`cerebro_log`, verificar evento último día.
2. Simular consulta Sato: `_satoDatos_('CLI-002', 'cerebro', '', '', false)` → devuelve `estado_actual` de Vehemence sin error.
3. Escribir `out/cerebro-salud-2026-08-27.md` con tabla y warnings.

**Escalar si:** tenant sin eventos > 7 días → Director dormido.

##### F2c · Inventario livingmind aplicable (1.5 h)
1. `Explore` `grafo_server.py` + `GRAFO.html` — identificar stack (probablemente Python + HTML+JS servidos).
2. Cotejar contra las técnicas del livingmind (starfield, bloom, fresnel glow, InstancedMesh, freshness decay, trunks, Bezier arcs, force-directed precomputado, membrana, golden-angle, ambient firing, camera drift, hover raycasting, search, deep links, FPS governor, fail visibly). Veredicto `{APLICABLE | ADAPTABLE | NO APLICA}` con motivo 1 línea.
3. `out/livingmind-inventario-2026-08-27.md` priorizado por impacto/esfuerzo.

---

### Bloque B · Post-E2 promovido (o post-PC-2 con Luciano OK)

#### F3 · Identity file editable para Sato-VOZ y Sato-in-GAS [2 h]

**Gate previo:** PC-2 verde (E2 promovido y 2do reload hecho). Si no: SALTAR a F4, dejar F3 documentado como pendiente en `out/pendientes-post-E2.md`.

**Objetivo:** sacar personalidad de `agent.py` e `_satoContexto_` a docs editables recargables.

**Pasos:**
1. Crear `docs/SATO-IDENTIDAD.md` con secciones:
   - §1 Propósito primario (extraído de `INSTRUCCIONES` de `agent.py` líneas 89-108 + system de `satoChat`).
   - §2 Personalidad y voz (rioplatense, voseo, aplomo).
   - §3 Invariantes SOUL (importar textual `SOUL_REGLAS` de `agent.py` y `src/24_soul.js` — regla espejo).
   - §4 Reglas N4-N9 (una por sección).
   - §5 Reglas ESCRITURA vs HABLA (A1, A3, A4, T1-B).
   - §6 Reglas TENANT (T1.8).
   - §7 Anti-injection.
   - §8 Anti-drift (checkpoint F13).
2. `agent.py`:
   - `cargar_identidad()` con TTL 60s por mtime; path relativo robusto.
   - `SatoriVoz.__init__` llama `cargar_identidad()` + `_FECHA_HOY` (fresco) → `instructions=`.
   - Fallback a `INSTRUCCIONES` inline si el `.md` no carga (nunca romper).
3. `26_sato.js`:
   - Pestaña `_sato_identidad` en MAESTRO (oculta+protegida como `charla`).
   - `_cargarIdentidadSato_()` con cache por Config `_sato_identidad_version`.
   - `satoChat` construye `system` = identidad cargada + reglas específicas de tenant.

**Verificación:** cambio 1 palabra en el `.md` → siguiente turno de voz lo refleja SIN restart de `agent.py` (releído por mtime).

**⚠ LECCIÓN +59:** al final de todo el bloque B, UN solo reload de `agent.py`. Si tocás `agent.py` en F3, F6, F7, F13 → un único `launchctl kickstart` al cierre del bloque C.

**Gate Bastión:** `.md` en git, tracked, permisos correctos. `_sato_identidad` oculta+protegida.

---

#### F4 · CAPABILITIES.md extendido + drift-checker [1.5 h]

1. Extender `scripts/_capabilities_gen.sh` con AUTO blocks:
   - `identidad-slim` (300 tok resumen de secciones 1-3 del `docs/SATO-IDENTIDAD.md`)
   - `invariantes-SOUL` (S1-S8 desde `24_soul.js`)
   - `tools-voz` (enumera `@function_tool` de `agent.py`)
   - `tools-in-gas` (keys de `SATO_FUENTES` de `26_sato.js`)
   - `endpoints-vivos` (grep de `_soloOwner_` sobre `src/*.js`)
   - `actividad-14d` (`git log --oneline --since='14 days ago'`)
2. Crear `scripts/_drift_checker.sh`:
   - Extrae referencias a rutas + funciones + agentes en secciones narrativas de `CAPABILITIES.md` + `docs/SATO-IDENTIDAD.md`.
   - Verifica existencia en el código (`grep -q` + `git ls-files`).
   - Soft por default (`exit 0` con warnings); `--strict` para CI.
   - Allowlist `docs/.drift-allowlist.txt`.
3. Wire al `_hooks/pre-push` soft.

**Verificación:** renombrar temporalmente `sanitizarCelda` → `--strict` falla; restaurar → pasa.

---

### Bloque C · Migración motor (gate Consejo)

#### F5 · Consejo migración motor + costo Claude Max [1 h · GATE OBLIGATORIO para F6]

**Precondición:** F0 con veredicto + F1 con hit-rate + PC-2 verde.

**Pasos:**
1. Invocar `consejo-asesores` con contexto de F0, F1 y el hecho de que E1 está en @56 y E2 recién promovido.
2. Preguntas:
   - ¿Migrar Sato-VOZ a Claude Haiku 4.5 default / Sonnet 4.6 override?
   - ¿Aceptar el delta de tokens proyectado ≤+15%?
   - ¿Es prudente migrar el motor CON E1+E2 recién promovidos, o esperar 1 semana de estabilidad?
3. Steelman a favor + en contra + pre-mortem + confianza X/10 por asesor.
4. Salida: `out/consejo-migracion-2026-08-27.md` con acta.
5. Veredicto: GO / NO-GO / GO-CONDICIONAL / DIFERIR-1-SEMANA.

**Escalar si:** empate o confianza colectiva < 6/10.

---

#### F6 · Migrar Sato-VOZ a Claude + two-block [3 h · SOLO si F5=GO]

1. Verificar disponibilidad plugin `livekit.plugins.anthropic`. Si no existe → ESCALAR a Luciano (opción: usar `openai` SDK con base URL Anthropic vía LiteLLM). Documentar decisión.
2. Sumar dep en `voz/agent/requirements.txt` con versión pineada.
3. Refactor `entrypoint()` en `agent.py`:
   - `llm=anthropic.LLM(model=os.environ.get("SATO_VOZ_MODELO", "claude-haiku-4-5-20251001"))`.
   - Envelope `system=[{type:"text", text:<identidad>, cache_control:{type:"ephemeral"}}, {type:"text", text:<bloque_fresco>}]`.
   - Identidad = `cargar_identidad()` (F3).
   - Bloque fresco = `_FECHA_HOY` + `_instrucciones_saludo()` (que ya usa `encargos_listos` — respetar).
4. Flag env `SATO_VOZ_MOTOR = openai | anthropic` (default `openai`; flip a `anthropic` post verificación).
5. Preservar Deepgram STT, ElevenLabs TTS, Silero VAD.
6. Log `usage.cache_read_input_tokens` a `out/voz-tokens.jsonl`.

**Verificación (con Luciano):**
- 5 turnos reales por voz.
- Latencia primer token ≤ 900 ms (3 mediciones).
- `cache_read` > 0 desde 2do turno.
- S1-S8, N4-N9, E1 saludo con `encargos_listos`, E2 bloque HOY (si E2 activo) — TODO preservado.

**Rollback:** flag `SATO_VOZ_MOTOR=openai` + `launchctl kickstart`. Rama `feat/sato-viviente` — `git revert` disponible.

**Gate Bastión:** key Anthropic en `.env.local` (nunca en git). Rotación planificada.

**Purga adversarial post-F6:** `purga-de-errores` contra los cambios.

---

#### F6' · Two-block sobre OpenAI [1.5 h · SOLO si F5=NO-GO o DIFERIR]

1. Reordenar `INSTRUCCIONES` en `agent.py`: identidad estable (≥1024 tok) primero, `_FECHA_HOY` y contexto después.
2. Confirmar `usage.prompt_tokens_details.cached_tokens > 0` en respuesta OpenAI.
3. Log a `out/voz-tokens-openai.jsonl`.

---

### Bloque D · Sato Ubicuo (dock global)

#### F7 · Widget SatoUbicuo espejo bidireccional [4 h]

**Precondición:** `Plan` (subagente) diseña arquitectura → `out/plan-sato-ubicuo-2026-08-27.md`. Dos revisiones adversariales con `code-reviewer`.

**⚠ COEXISTENCIA CON T4 (25-ago):** el panel Sato in-page ya vive en el OS (dentro de CM, Ficha 360, Núcleo — abierto al tocar el orbe). Este widget SatoUbicuo NO reemplaza al panel — es un **dock persistente en el header**, siempre visible pero mucho más compacto (últimos 3-5 turnos + input + botones rápidos + link a "abrir panel completo"). Coexisten: el widget es acceso rápido; el panel es superficie de trabajo.

**Pasos:**

##### F7a · Backend GAS (1 h)
En archivo nuevo `27_sato_ubicuo.js` (o subsección de `26_sato.js` si es más limpio):
- `charlaCola_(idCliente, tsDesde)` — read-only, `_soloOwner_`, aislamiento estricto.
- `charlaEnviarTexto_(idCliente, texto)` — write con `origen=texto`, `pendiente=1`, `limpiarHostilTexto_(texto, 1200)`, sanitiza `<<<>>>`.
- `charlaPendientes_(idCliente)` — read para LiveKit; devuelve pendientes; LiveKit los marca procesados.
- Alta en `ENDPOINTS_UI` en el MISMO commit. Cases en `doPost`.

##### F7b · Frontend widget (2 h)
- Componente HTML/CSS/JS en `src/index.html` bundle.
- **Posición:** panel fijo top-right del header. **Z-INDEX estricto para no colisionar:**
  - Widget colapsado (chip): z-index 30 (bajo notificaciones).
  - Widget expandido: z-index 40 (encima de tab bar mobile 35, bajo scrim 45).
  - No entra al `@media (max-width:640px)` como tab bar — el widget se OCULTA en mobile (mobile ya tiene su pestaña Sato dedicada, T4+Mobile).
- Toggle colapsar/expandir con estado en `PropertiesService.getUserProperties()` (NO localStorage — regla del handoff mobile).
- Últimos 5 turnos + auto-scroll.
- Input texto + botón enviar + botones rápidos: `[brief]`, `[aprobaciones]`, `[cerrar sesión]`.
- Botón "abrir panel" que dispara el mismo mecanismo T4 (tocar orbe).
- **Contexto por ubicación:**
  - Ficha 360 de CLI-XXX → widget muestra "Sato · <cliente>", `id_cliente=CLI-XXX`.
  - CM → "Sato · Sistema", `id_cliente=""`.
  - Otras vistas → `id_cliente=""` (sistema).
- Polling con `google.script.run` cada 2s (backoff 5s si sin cambios; pausa si documento oculto).

##### F7c · Frontend LiveKit polling (45 min)
- Task async en `agent.py` que hace polling a `/charlaPendientes` cada 1s.
- Inyecta pendiente como transcripción STT.
- Marca procesado tras responder.

##### F7d · Sync bidireccional (15 min)
- Cada turno LiveKit persiste en `charla` del tenant vía tool GAS `guardarTurnoCharla_`.
- Sello: `origen=voz` para LiveKit, `origen=texto` para widget.

**Verificación:**
1. Hablo "hola Sato" → aparece en widget ≤3s con texto exacto.
2. Escribo en widget → Sato responde voz + texto vuelve.
3. Cierro LiveKit → widget muestra "voz desconectada"; historial accesible.
4. Widget de CLI-002 pide datos de CLI-003 → rechazo con motivo.
5. Colapso + recargo → estado persistido.
6. **NO colisiona:** tomar screenshot desktop + mobile → sin superposición con orbe, panel Sato in-page, tab bar mobile, notificaciones.

**Rollback:** flag Config `sato_ubicuo_on` (default `off` hasta verificado); endpoints deshabilitados si `off`.

**⚠ LECCIÓN +59:** cambios en `agent.py` (F7c) → un solo reload al cierre del bloque C+D.

**Gate Bastión CRÍTICO:** `charlaEnviarTexto_` NO puede saltar tenant, NO admite >1200 chars, sanitiza `<<<>>>`. Cross-tenant rejection tests.

**Purga adversarial post-F7:** `purga-de-errores` con foco cross-tenant, XSS y colisión visual.

---

### Bloque E · Cerebro visual + orbe + drift (paralelizable)

#### F10 · Cerebro visual · aplicar livingmind [6 h]

**Precondición:** F2c inventario aprobado — usar SOLO items APLICABLE sin ambigüedad.

**Bloques ordenados por impacto/esfuerzo, un commit por bloque:**

- **10-A (visual base):** Bloom, starfield, fog exp2, membrana fresnel (`abs(dot)` corregido), ACESFilmicToneMapping, `setPixelRatio(min(dpr,2))`.
- **10-B (nodos):** reverse-fresnel glow, `InstancedMesh` por dimensión (lider/negocio/sistema), `aPhase` FNV-1a, `aFreshness` = `0.5^(edad_dias/30)` piso 0.15.
- **10-C (aristas y flow):** Bezier arcs, `LineSegments` merged por kind, shimmer similitud, comet flow en 3 trunks de mayor relevancia.
- **10-D (interacción):** force-directed precomputado (150 iters, seed determinista), golden-angle spherical distribution para clusters, camera drift ambiental, hover raycasting + edge highlight, search substring + fly-to, deep links `#node=`, FPS governor (degrada bloom → pulses), stats line con counts reales.
- **10-E (assert startup):** "no dibujar lo que no está en la fuente de verdad" — región sin datos = leyenda "sin datos", nunca scaffold inventado.

**Verificación:** <2s con 500 nodos · nodos de hoy visiblemente más brillantes que junio · FPS≥30 con throttle 4x · server apagado → "cerebro no disponible" no black page.

**Rollback:** rama `feat/cerebro-livingmind`; `git revert` por bloque.

---

#### F11 · Aplicar decay + trunks a UI existente [30 min · REDUCIDO por regla +51]

**⚠ NO SE TOCA EL ORBE PERSISTENTE V2 NI EL ORBE DEL CM (regla +51).** Los "grains" del orbe son identidad visual clavada.

**Sí aplica a:**
- Mapa de cartera (si existe visualización): freshness por `dias_sin_contacto` sobre las cards. Ya hay señales visuales en CRM Pro §2d (`ultimo_contacto`, semáforo M3) — verificar que NO dupliquen.
- Grafo Akasha: si tiene halos, aplicar decay ahí.

**Si al hacer F11 detectás que la única superficie relevante es el Cerebro (ya cubierto por F10)** → declarar F11 como no-op documentado y pasar.

---

#### F12 · Regla "nunca renderizar lo que no está en la fuente de verdad" [30 min]

1. Editar `.claude/skills/satori-design/SKILL.md` (o equivalente) con la regla como principio nuevo.
2. Ejemplos: bug `null.isSheetHidden` (23-jul), lección +51 (maqueta ≠ identidad visual).
3. Testing: invocación trivial del skill.

---

#### F13 · Personality checkpoint contra drift [1.5 h]

**Precondición gate:** post-F3 (identity file) + PC-2 verde.

1. En `agent.py`: contar turnos por sesión (variable local del `AgentSession`).
2. Config `sato_checkpoint_turno` default 15.
3. Cuando N turnos → inyectar UNA vez en bloque fresco del siguiente turno:
   ```
   [CHECKPOINT DE VOZ]: antes de responder, chequeá tu draft contra
   (a) rioplatense sin hedge, (b) breve para voz, (c) invariantes S1-S8.
   ```
4. Decae; no en cada turno posterior.

**Verificación:** conversación 20 turnos con vs sin checkpoint.

**Rollback:** flag `sato_checkpoint_on = no`.

**⚠ LECCIÓN +59:** consolidar con reload del cierre bloque C+D.

---

### Bloque F · SatoPatrones (DIFERIDO)

#### F8-F9 · SatoPatrones — memoria transversal [DIFERIDA a POST-E5 gate Bastión]

**Motivo del diferimiento:** la Ola 2 completa está bloqueada por `[[sato-ejecutor]] · E5 GATE Bastión` (sanear frontera de inyección `objetivos.descripcion → correrDirector → LLM crudo`, 16-jul). Memoria transversal introduce una nueva superficie de inyección (patrones consultados desde el prompt) — no puede caer antes de que la frontera de origen esté saneada.

**Qué hace este encargo con F8-F9:**
- **NO ejecuta.** No crea la hoja `SatoPatrones`. No modifica `_satoDatos_`. No suma `patron` a `SATO_TIPOS_ITEM`.
- **Sí deja diseño listo** en `docs/DISENO-SATOPATRONES-2026-08-27.md`:
  - Schema aprobado: `id_patron | fecha | rubro | situacion_tipo | tecnica | resultado | tags | confianza (1-10) | fuente_sesion`.
  - Regla anti-PII: ningún campo con `CLI-XXX`, email, teléfono, cifra > 100.
  - Casos de test.
  - Gate: E5 saneado.
- **Sí abre item en `sato-ejecutor` backlog** post-E5: "F8-F9 SatoPatrones — diseño en `docs/DISENO-SATOPATRONES-2026-08-27.md`".

---

### Bloque G · CRM Pro Mobile

> **NOTA CRÍTICA — NO re-ejecutar el CRM Pro base.** El `ENCARGO-CODE-CRM-PRO-2026-08-25.md` fue promovido a `/exec @55` el 26-ago (selfTest CERTIFICADO 994/0). Ese trabajo YA está en prod. La única pieza pendiente es el bloque `§2d.MOBILE` (insertado en el encargo CRM Pro el 27-ago como aditivo). Esta Fase F-CRM-Mobile ES ese trabajo pendiente — no hay un segundo encargo separado que correr.

#### F-CRM-Mobile · Portar `MAQUETA-CRM-PRO-MOBILE-v1.html` a `src/index.html` [4 h]

**Precondición:** bloque §2d.MOBILE ya insertado en `ENCARGO-CODE-CRM-PRO-2026-08-25.md` (verificado). CRM Pro §2d ya en prod (@55/@56).

**Pasos:**
1. **Regla dura de no-interferencia:** TODO móvil dentro de un único `@media (max-width:640px)` en `src/index.html`. Ni una regla mobile toca clases base fuera. Mismo DOM, no borrar nodos, mejora progresiva.
2. Piezas a portar (ver §2d.MOBILE del encargo CRM Pro y `MAQUETA-CRM-PRO-MOBILE-v1.html` como fuente de verdad visual):
   - Tab bar inferior 4 botones (Hoy · Cartera · Sato · HQ) con `safe-area-inset-bottom`, z-index 35.
   - Vista Hoy (`#vHoy`): tiles + urgentes.
   - Vista Cartera (`#vCartera`): funcbar + atajos + chips + lista vertical (kanban → lista).
   - Vista Sato (`#vSato`): panel in-page T4 con envoltorio móvil. **Orbe hero = Orbe Persistente v2 REAL reusado vía CSS dentro del `@media`, NO nuevo** (regla +51).
   - Vista HQ (`#vHq`): `hqNumeros` + retenciones + semáforo M3.
   - Ficha 360 como bottom-sheet (`.f360` con `transform:translateY` dentro del `@media`).
   - Vista Correo→CRM (`.sheetC`) desde atajo.
3. Anti-patrones: NO archivo aparte · NO `navigator.userAgent` · NO tocar orbe/CM/kanban fuera del `@media` · NO micrófono embebido (dispara ruta 📞) · NO `localStorage` (usar `PropertiesService.getUserProperties()`) · NO copiar status-bar simulado del marco.
4. Assert nuevo (opcional): grep en `src/index.html` de exactamente **un** `@media (max-width:640px)` y ninguna regla mobile fuera.

**Verificación:**
- Playwright headless 393×852 sobre `/dev`: recorrer 4 pestañas, buscar "Vehe", abrir Ficha desde 1ª card, registrar contacto, cerrar, filtrar Vencidas, abrir Correo→CRM, confirmar 1 thread.
- **Escritorio `/dev` a 1440×900 queda idéntico al @56** — screenshot diff = 0 fuera del área nueva.
- Eyeball iPhone real (Luciano post-deploy).

**Rollback:** `git revert` del commit del `@media`.

**Gate Bastión:** ningún nuevo endpoint. Reutilización total del backend CRM Pro ya en prod.

---

### Bloque H · Cierre

#### F14 · Cierre + optimización tokens generalizada + HANDOFF [2 h]

1. `bash _inventario_cierre.sh`. Cabo abierto → NO cerrar.
2. Escribir `RUNBOOK-OPTIMIZACION-TOKENS-CLAUDE-MAX.md` con 5 palancas:
   - (a) Prompt caching aplicado (F6/F6').
   - (b) Ruteo por modelo (Haiku default, Sonnet solo veredicto).
   - (c) `max_tokens` sobredimensionados (identificar en F1).
   - (d) Anti-Read redundante (regla CLAUDE.md).
   - (e) Cache TTL más largo si Anthropic soporta en Max.
3. Extender `web/dashboard.html`:
   - Panel "Sato-VOZ" (tokens post F6/F6').
   - Panel "Sato Ubicuo" (turnos por tenant, texto vs voz).
   - Semáforo Claude Max (rojo si Δ > +15%).
4. Actualizar memorias de proyecto: `sato-integridad-datos`, `satori-os`, `sato-ejecutor`, `crm-pipeline`.
5. Regenerar `CAPABILITIES.md` (via `_capabilities_gen.sh`).
6. `HANDOFF-2026-08-27-SATO-VIVIENTE-CIERRE.md` cumpliendo skill `handoff-proyecto`:
   ```
   CIERRE: incluye [lista real de F cerradas]
   QUEDA ABIERTO: [lista real de F pendientes/diferidas + cabos]
   ```
7. Actualizar `HANDOFF.md` maestro con cross-reference a los 2 handoffs (Sato Viviente + CRM Pro Mobile).

---

## §6 · COORDINACIÓN DE AGENTES INTERNOS

| Fase | Explore | Plan | code-reviewer | consejo-asesores | bastion-satori | purga-de-errores | handoff-proyecto |
|---|---|---|---|---|---|---|---|
| PC-0..3 | ✓ | | | | | | |
| F0 | ✓ | | | | | | |
| F1 | ✓ | | | | | | |
| F2a | ✓ | | | | ✓ pre | | |
| F2b | ✓ | | | | | | |
| F2c | ✓ | ✓ | | | | | |
| F3 | | ✓ | | | ✓ pre | | |
| F4 | ✓ | | | | | | |
| F5 | | | | ✓ | | | |
| F6 | | ✓ | ✓ | | ✓ pre | ✓ post | |
| F6' | | | ✓ | | | | |
| F7 | ✓ | ✓ | ✓✓ | | ✓ pre (crítico) | ✓ post | |
| F10 | ✓ | ✓ | ✓ por bloque | | | | |
| F11 | | | ✓ | | | | |
| F12 | | | | | | | |
| F13 | | | ✓ | | | | |
| F-CRM-Mobile | ✓ | | ✓ | | | ✓ post | |
| F14 | | | | | | ✓ obligatoria | ✓ |

---

## §7 · GATES BASTIÓN CONSOLIDADOS

Checklist obligatorio antes de merge de cada fase con gate:
- [ ] `_soloOwner_` en todo endpoint nuevo.
- [ ] Aislamiento tenant (`_satoClienteValido_`) en toda escritura.
- [ ] Sanitización `limpiarHostilTexto_` en toda entrada de texto libre.
- [ ] Marcador `<<<>>>` neutralizado en textos.
- [ ] Secretos: `.env.local` + `PropertiesService`, jamás en git o Sheets.
- [ ] Fail-closed: nunca "OK" en silencio si algo falló.
- [ ] Cross-tenant en widget SatoUbicuo bloqueado con motivo visible.
- [ ] Cache prefix SIN fecha, SIN UUID, SIN id de sesión (regla TC-10).
- [ ] `SatoPatrones` NO ejecutado (bloqueado por E5).
- [ ] `push_proactivo_on` NO se toca (default OFF).
- [ ] `agent.py` con reload al final del bloque (lección +59).

---

## §8 · CRITERIOS DE ESCALADO A LUCIANO

Parás y avisás si:
1. PC-1 muestra deriva del repo respecto a lo esperado (@56, main).
2. PC-2 detecta cabos abiertos de E2 no resueltos → arrancás sólo Bloque A y esperás.
3. F0 no permite proyectar (logs vacíos).
4. F1 detecta hit-rate < 5% con `cache_intentado=true` (invalidator sistémico).
5. F5 Consejo empate o confianza < 6/10.
6. F6 requiere plugin `anthropic` no disponible → decidir LiteLLM u otra ruta.
7. F7 latencia real polling > 5s → Opción B (Tailscale HTTP directo).
8. F10 stack del `grafo_server.py` no soporta técnica de livingmind planificada (rewrite mayor).
9. F-CRM-Mobile: `MAQUETA-CRM-PRO-MOBILE-v1.html` referencia visual entra en conflicto con estado real del `src/index.html` post-@56 (ej. IDs diferentes, funciones renombradas).
10. Cabo abierto en F14 que no podés cerrar en <30 min.

Formato de escalado: (a) resumen 5 líneas, (b) qué probaste, (c) 2-3 alternativas ranqueadas, (d) recomendación con confianza X/10.

---

## §9 · ORDEN DE EJECUCIÓN Y PARALELISMO

**Serial obligatorio con gates:**
```
PC-0..3 → F0 → F1 → F2a
            ↓
         [Bloque A independiente listo]
            ↓
       ¿PC-2 verde? ─── NO → esperar Luciano, cerrar sesión con handoff parcial
            ↓ SÍ
       F3 → F4
            ↓
         F5 → { F6 GO   → F7 → F13 → RELOAD agent.py
                F6 NO-GO → F6' → F7 → F13 → RELOAD agent.py }
            ↓
       [Bloque E paralelo] F10 → F11 → F12  (independiente de agent.py)
            ↓
       F-CRM-Mobile (paralelo con Bloque E)
            ↓
       F14 cierre
```

**F8-F9 NO se ejecutan** — solo diseño documentado.

Si Code tiene bandwidth para paralelizar (rama por bloque), aprovechar en Bloque E + F-CRM-Mobile.

---

## §10 · TOPES DUROS

- **Tiempo total:** 25-28h. Si en 32h no hay cierre → PARAR y handoff parcial.
- **Output tokens Claude Max:** > 200k → PARAR y avisar.
- **Nuevos endpoints:** máximo 6 (`charlaCola_`, `charlaEnviarTexto_`, `charlaPendientes_`, `guardarTurnoCharla_`, + 2 slots libres si son estrictamente necesarios).
- **Nuevas hojas:** máximo 2 (`_sato_identidad` en MAESTRO; NO se crea `SatoPatrones`).
- **Nuevas deps Python:** máximo 1 (plugin anthropic si F6=GO).
- **Cosas prohibidas:** promover `/exec` (eso es de Luciano), encender `push_proactivo_on`, tocar Orbe Persistente v2, tocar CRM Pro §2d ya en prod, ejecutar F8-F9, tocar frontera `objetivos.descripcion → correrDirector` (E5 gate).

---

## §11 · FORMATO DEL REPORTE FINAL

Un solo mensaje a Luciano con:
1. **Línea 1:** `CIERRE: incluye X · QUEDA ABIERTO: Y`.
2. **§ Ejecución** (≤12 líneas): fases GO/NO-GO, escalados, gates aterrizados.
3. **§ Números** (tabla): consumo pre/post caching, latencia voz pre/post, cache hit-rate por módulo, nodos cerebro por tenant, tabbar mobile OK sí/no.
4. **§ Nuevas capacidades** (bullets 1 línea).
5. **§ Deuda técnica y diferidos** (SatoPatrones, F11 si no-op, cabos).
6. **§ Cabos de otras sesiones respetados** (E2 promote, NTFY, 2do reload, `push_proactivo_on`).
7. **Handoff:** link al `HANDOFF-2026-08-27-SATO-VIVIENTE-CIERRE.md`.
8. **Confianza global final:** X/10.

---

## §12 · ANEXO — LO QUE NO SE TOCA

- Arquitectura de `_systemBloques_(fijo, vivo, modelo)` en `05_costos.js`.
- `_satoDatos_` T1.8 aislamiento.
- `MODELOS_POR_MODULO` ruteo por costo.
- Agentes lab congelados hasta Forge (`vigia`, `conciliador`, `cobrador`, `analista`, `abastecedor`, `clasificador`, `direccion`).
- `SOUL_REGLAS` textuales (S1-S8) — sólo espejar en `docs/SATO-IDENTIDAD.md`.
- Regla dura 29-jul de aislamiento (LEY).
- Dashboard base `web/dashboard.html` (se extiende).
- **Panel Sato in-page T4 (25-ago)** — Sato Ubicuo es dock adicional, NO reemplaza.
- **Orbe Persistente v2 (T2, 25-ago) + orbe del CM** — identidad visual clavada (regla +51). Livingmind aplica al Cerebro únicamente.
- **CRM Pro §2d en prod (@55/@56)** — F-CRM-Mobile es aditivo.
- **E2 en flight** — no promover, no encender push, no interrumpir cabos con dueño Luciano.
- **Frontera de inyección `objetivos.descripcion → correrDirector`** — E5 gate Bastión.
- `pushProactivoDiario_` estructura (E2 vivo en /dev).

---

**FIN DEL ENCARGO v2.** Confianza planificación: 8/10.

Los 3 puntos que quedan como riesgo controlable con datos, no con más análisis:
- (a) plugin `anthropic` para LiveKit disponibilidad real (F6).
- (b) latencia real del polling en Opción A (F7).
- (c) proyección real de tokens Claude Max con datos de Sato-VOZ post-E2 (F0).

---
*Cowork · 27/08/2026 · integrado con Ola 1 en flight (E1@56 + E2/dev) + CRM Pro Mobile handoff + memorias [[satori-os]] [[sato-ejecutor]] [[crm-pipeline]] [[sato-integridad-datos]] al día. Bloque §2d.MOBILE insertado en `ENCARGO-CODE-CRM-PRO-2026-08-25.md` en la misma sesión.*
