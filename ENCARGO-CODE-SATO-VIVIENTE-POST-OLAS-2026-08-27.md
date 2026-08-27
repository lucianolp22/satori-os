# ENCARGO-CODE · SATO VIVIENTE POST-OLAS — cierre integral de pendientes — 27/08/2026

> **Para:** Claude Code, en `~/Documents/Claude/Projects/SatoriOS`.
> **Continuación de:** `ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md` (Bloque A ejecutado) + `PLAN-REMEDIACION-2026-08-27.md` (Olas 0-3).
> **Alcance:** cerrar TODOS los pendientes y cabos abiertos que quedaron gateados por E2 y por la reformulación de F10. Un solo comando, autónomo, con checkpoints propios y prudencia.
> **Confianza planificación:** 8/10 (baja a 7/10 en F6 hasta que Luciano confirme credencial Anthropic).

---

## §0 · REGLAS DEL SESSION (idénticas al encargo Sato Viviente v2)

1. **AUTÓNOMO PERO PRUDENTE.** Escalás a Luciano sólo por gates del §7 o blockers reales.
2. **ESCALERA DE MADURACIÓN** respetada (0→1→2→3).
3. **AISLAMIENTO MULTI-TENANT** es LEY (T1.8).
4. **NUNCA "CIERRE" SIN `bash _inventario_cierre.sh`**. Formato: `CIERRE: incluye X · QUEDA ABIERTO: Y`.
5. **UN COMMIT POR FASE.** Rama `feat/sato-viviente-post-olas`, merge a main sólo cuando la fase entera pasa verificación.
6. **NO REESCRIBAS LO QUE YA FUNCIONA.** Todo lo consolidado en @57 + Olas 0-3 es base intocable.
7. **LECCIÓN +59 — UN SOLO RELOAD DE `agent.py`** al final de todas las fases que lo tocan (F3 + F6 + F7c + F13). No un reload por fase.
8. **PUSH PROACTIVO — DEFAULT OFF NO SE TOCA** (§0.8 del encargo v2). Sigue vigente.
9. **AGENTES INTERNOS:** `Explore`, `Plan`, `code-reviewer`, skills `bastion-satori`, `consejo-asesores`, `purga-de-errores`, `deploy-gas`, `handoff-proyecto`.
10. **HANDOFF FINAL EN `~/Documents/Claude/Handoffs/2026-08/`** (NO en raíz de SatoriOS — CLAUDE.md §10). Formato de nombre: `2026-08-27 - SATO-VIVIENTE-POST-OLAS-CIERRE.md`.

---

## §1 · PRECONDICIONES BLOQUEANTES (verificar en orden, no arrancar sin todas verdes)

**PC-A · Olas 0 + 1 del PLAN-REMEDIACION cerradas.**
- R1 (blindar instalador) · R2 (cerrar hueco RPC) · R2-bis (assert que enumera top-level menos ENDPOINTS_UI) · R3 (asserts sobre lo construido) · R4 (grafo cante cuando falla) · R5 (versionar plist).
- Verificación: `grep -c "plutil -lint" scripts/install-grafo-launchd.sh` ≥1 · `bash scripts/_scan_endpoints.sh` limpio · `node _harness.js` verde con asserts nuevos.

**PC-B · 6 pasos post-E2 verificados (con evidencia, no lectura del HANDOFF).**
1. `selfTestTramo6()` corrido → D48 (15) + D49 (17) todos en verde en `Salud_registro` del MAESTRO.
2. `probarPushTelefono()` → NTFY_TOKEN presente + `Authorization: Bearer` respondió OK.
3. `estadoVigente('CLI-000')`, `('CLI-002')`, `('CLI-003')` OK.
4. **2º reload de `agent.py`** hecho: `ps -o lstart -p $(pgrep -f 'python.*agent.py')` con timestamp POSTERIOR al mtime de `agent.py` Y al del `.pyc` de `brief_hoy`. Sin esta evidencia, `agent.py` NO se toca.
5. Eyeball 30s de voz enunciando "HOY hay que mirar (N)" — Luciano confirma.
6. `push_proactivo_on=true` — Luciano decide y ejecuta.

**PC-C · Credencial Anthropic disponible.**
- `[ -f voz/agent/.env.local ] && grep -q '^ANTHROPIC_API_KEY=' voz/agent/.env.local` → OK.
- Si NO → **FRENAR, escalar a Luciano**. F5-F6 arranca cuando cargue la key.

**PC-D · Ola 2 R6 corrida (baseline latencia).**
- `out/latencia-voz-baseline-2026-08-27.md` existe con mediana + p95 de primer token en gpt-4o-mini.
- Sin esto F6 no tiene contra qué comparar.

**PC-E · Working tree limpio, `/exec = @57`, HEAD en `main`.**

**Interpretación:**
- Todas verdes → arrancás plan completo.
- PC-A/B pendientes → FRENAR, avisar.
- PC-C pendiente → arrancás Bloques B, D, E, G, H (todo menos migración motor). F5-F6 quedan para cuando cargue.
- PC-D pendiente → ejecutás R6 primero, después arrancás.

---

## §2 · CORRECCIONES AL ENCARGO ORIGINAL (por hallazgos de Code en Bloque A)

Estas correcciones **reemplazan** las secciones equivalentes del encargo v2:

**C-1 · Modelo default en F6.** Usar `claude-sonnet-5` como override, NO `claude-sonnet-4-6`. Mismo mínimo de caché (1.024 tok) y más barato ($2/$10 vs $3/$15). Confirmado en `out/audit-tokens-2026-08-27.md`.

**C-2 · Palanca F1↔F3 (mutualmente pagados).** F3 (identity file ~3.300 tok) empuja el bloque estable de Sato-in-GAS sobre el mínimo Haiku (4.096) y por PRIMERA vez el caching TC-10 va a hacer hits reales. Hoy hit-rate 0% en TODOS los módulos porque los prefixes son de 143 tok. **F3 y F1 se pagan mutuamente** — priorizar F3.

**C-3 · F10 reformulado a F10-a únicamente.** El Cerebro es canvas 2D, no Three.js. Bloom/fresnel/InstancedMesh/ACES no aplican sin rewrite mayor (~600 KB Three.js vendorizado, +2h a ~6h base = ~8h). F10-b (rewrite) queda DIFERIDA como decisión de Luciano (recomendación mía por default: NO). F10-a (11 items sin cambio de stack, ~2h) es lo que se ejecuta acá.

**C-4 · Corregir doc en `05_costos.js:50`.** El comentario dice "todo cacheable"; en la práctica los prefixes de 143 tok no llegan al mínimo. Corregir a: "cacheable EN PRINCIPIO — la telemetría cache_intentado dice si el bloque fijo llegó al mínimo del modelo". Un solo commit de doc.

**C-5 · F11 declarado no-op documentado.** No hay otra superficie que aplique freshness + trunks que no sea el Cerebro (ya cubierto por F10-a) o el Orbe v2 (regla +51 lo protege). F11 se cierra con nota en `docs/DECISIONES-DISENO-2026-08-27.md` explicando por qué es no-op.

**C-6 · Cabo de encargo original que quedó abierto:** `docs/DISENO-SATOPATRONES-2026-08-27.md` (diseño diferido F8-F9) NO fue escrito por Code en la sesión anterior. Se escribe en este encargo (F-Diseño-Patrones abajo).

**C-7 · Consolidación reload agent.py.** F3 (identity) + F6/F6' (motor) + F7c (polling) + F13 (checkpoint) tocan `agent.py`. **UN solo `launchctl kickstart` al final del Bloque D**, no uno por fase. Lección +59.

---

## §3 · FASES A EJECUTAR (post-precondiciones)

### Bloque B · Identidad + self-knowledge (post-PC-B)

#### F3 · Identity file editable para Sato-VOZ y Sato-in-GAS [2 h]

Como en encargo v2 §5 Bloque B F3, con estos ajustes:
- El `docs/SATO-IDENTIDAD.md` debe llegar a ≥3.300 tok totales (para empujar Sato-in-GAS sobre 4.096 min Haiku).
- Estructura: §1 Propósito · §2 Personalidad · §3 SOUL S1-S8 · §4 N4-N9 · §5 ESCRITURA vs HABLA · §6 TENANT T1.8 · §7 Anti-injection · §8 Anti-drift.
- `cargar_identidad()` con TTL 60s por mtime + fallback a inline.
- `agent.py`: NO reload todavía (consolidado al final del Bloque D).
- `26_sato.js`: pestaña `_sato_identidad` oculta+protegida en MAESTRO + `_cargarIdentidadSato_()` con cache por Config `_sato_identidad_version`.

**Verificación:** cambio 1 palabra en el `.md` → siguiente turno de `satoChat` in-GAS lo refleja sin restart. (Sato-VOZ se verifica post reload consolidado.)

**Gate Bastión:** `.md` en git, `_sato_identidad` protegida.

---

#### F4 · CAPABILITIES.md extendido + drift-checker [1.5 h]

Como en encargo v2 §5 F4:
- Extender `_capabilities_gen.sh` con AUTO blocks: identidad-slim (300 tok) · SOUL S1-S8 · tools-voz · tools-in-gas · endpoints-vivos · actividad-14d.
- Crear `scripts/_drift_checker.sh` (soft default, `--strict` para CI, allowlist `docs/.drift-allowlist.txt`).
- Wire al `_hooks/pre-push` soft.

**Verificación:** renombrar temporalmente `sanitizarCelda` → `--strict` falla; restaurar → pasa.

---

### Bloque C · Migración motor (post-PC-C + F5 Consejo)

#### F5 · Consejo migración motor con datos reales [1 h · GATE OBLIGATORIO]

Actualizado con los hallazgos de Bloque A:
- Costo YA no es preocupación (Sato-VOZ Haiku 2,1% del tope, muy bajo).
- La verdadera pregunta ahora es: **¿migrar es prudente con E1+E2 recién promovidos, y con latencia baseline de R6?**
- Modelo default a debatir: **Sonnet 5 con caché sale 5× más barato que Haiku sin caché** ($0,20/M read vs $1,00/M read). Con F3 empujando el bloque estable sobre el mínimo, el caching va a funcionar. → Considerar Sonnet 5 default en lugar de Haiku.

**Pasos:**
1. Invocar `consejo-asesores` con: F0 (out/audit-tokens), F1 (out/audit hit-rate 0%), R6 (out/latencia-voz-baseline), estado @57 estable, F3 identity ya cargando.
2. Preguntas:
   - ¿Migrar el motor a Claude?
   - ¿Sonnet 5 default o Haiku 4.5 default?
   - ¿Latencia proyectada aceptable vs baseline R6?
3. Salida: `out/consejo-migracion-2026-08-27.md` con acta + confianza colectiva X/10.

**Escalar si:** confianza <6/10 o empate.

---

#### F6 · Migrar Sato-VOZ a Claude + two-block [3 h · SOLO si F5=GO]

Como en encargo v2 F6, con ajustes:
- `SATO_VOZ_MODELO` default = lo que decida F5 (Sonnet 5 o Haiku 4.5).
- Verificar plugin `livekit.plugins.anthropic` antes de escribir código. Si no existe → probar LiteLLM como bridge o escalar.
- Sumar dep en `voz/agent/requirements.txt` pineada.
- Envelope two-block con `cache_control: {type: ephemeral}` en el bloque estable.
- Log `usage.cache_read_input_tokens` + latencia primer token a `out/voz-tokens.jsonl`.
- Flag env `SATO_VOZ_MOTOR=openai|anthropic` (default openai hasta verificado).

**Verificación (con Luciano):**
- 5 turnos reales por voz.
- **Latencia primer token ≤ p95 de R6** (no ≤900ms fijo — es contra el baseline REAL).
- `cache_read > 0` desde el 2do turno.
- S1-S8, N4-N9, E1 saludo con `encargos_listos`, E2 bloque HOY — TODO preservado.

**Rollback:** flag env + `launchctl kickstart` (parte del reload consolidado).

**Gate Bastión:** key en `.env.local` (nunca git). Rotación planificada.

**Purga post-F6:** `purga-de-errores`.

---

#### F6' · Two-block sobre OpenAI [1.5 h · SOLO si F5=NO-GO o DIFERIR]

Como en encargo v2 F6'. Confirmar `usage.prompt_tokens_details.cached_tokens > 0` en respuesta OpenAI.

---

### Bloque D · Sato Ubicuo (dock global)

#### F7 · Widget SatoUbicuo espejo bidireccional [4 h]

Como en encargo v2 §5 Bloque D F7. Sin cambios estructurales.

Notas de coexistencia (recordatorio):
- Widget SatoUbicuo es dock en header, NO reemplaza al panel Sato in-page T4.
- Z-index: widget colapsado 30, expandido 40, tab bar mobile 35, scrim 45, sheet 46, modal 48.
- **Se oculta en mobile** (mobile ya tiene su pestaña Sato en F-CRM-Mobile).
- `PropertiesService.getUserProperties()` para estado colapsado (NO localStorage).

**Verificación:** los 6 puntos del encargo v2 F7. Screenshot desktop + mobile sin superposición.

**Rollback:** flag Config `sato_ubicuo_on`.

**Gate Bastión CRÍTICO:** `charlaEnviarTexto_` cross-tenant rejection tests.

**Purga adversarial post-F7.**

---

### Reload consolidado agent.py (final Bloque D)

Un solo `launchctl kickstart -k gui/$UID/com.satori.voz.agent` que trae:
- F3 identity file loader
- F6 motor Claude (o F6' two-block OpenAI)
- F7c polling `/charlaPendientes`
- F13 checkpoint anti-drift

Verificar con `ps -o lstart` que el proceso arrancó DESPUÉS del último mtime de `agent.py`. Voz reactiva en <10s.

---

### Bloque E · Cerebro + drift + regla de diseño (paralelizable)

#### F10-a · Livingmind sin cambio de stack [2 h]

Ejecutar los 11 items marcados APLICABLE sin cambio de stack en `out/livingmind-inventario-2026-08-27.md` §3. Ejemplos: freshness decay visual sobre colores de nodos, tooltip mejorado, hover highlight, deep links `#node=`, search substring, stats line con counts reales, assert "no dibujar lo que no está en la fuente de verdad" al startup, fail visibly si server cae. NO tocar el motor de render (canvas 2D queda).

**Verificación:** nodos tocados hoy visiblemente más brillantes que junio, sin caída de perf.

---

#### F11 · No-op documentado [15 min]

Escribir en `docs/DECISIONES-DISENO-2026-08-27.md`:
> "F11 no aplica: la única superficie con freshness+trunks es el Cerebro (F10-a). Orbe v2 y orbe CM están protegidos por regla +51. No hay tercera superficie. F11 cerrada como no-op."

---

#### F12 · Regla "nunca renderizar lo que no está en la fuente de verdad" [30 min]

Como en encargo v2 §5 F12. Editar skill `satori-design`, ejemplos con bug null.isSheetHidden + lección +51.

---

#### F13 · Personality checkpoint contra drift [1.5 h]

Como en encargo v2 §5 F13. Config `sato_checkpoint_turno=15`, inyección UNA vez decae. Va consolidado en el reload del Bloque D.

**Verificación:** conversación 20 turnos con vs sin checkpoint.

---

### Bloque F · SatoPatrones diseño (cabo de encargo original)

#### F-Diseño-Patrones · `docs/DISENO-SATOPATRONES-2026-08-27.md` [45 min]

Cabo declarado por Code en Bloque A. Escribir el doc con:
- **Schema aprobado**: `id_patron | fecha | rubro | situacion_tipo | tecnica | resultado | tags | confianza (1-10) | fuente_sesion`.
- **Regla anti-PII**: ningún campo con `CLI-XXX`, email, teléfono, cifra > 100. Assert al escribir.
- **Casos de test**: 3 patrones ejemplo anonimizados de conciliación IVA, retención cliente frío, apertura local nuevo.
- **Gate**: E5 saneado (frontera de inyección `objetivos.descripcion → correrDirector`). NO se ejecuta hasta que E5 pase.
- **Ubicación**: hoja global en MAESTRO, NO por tenant. Consulta vía `@@DATOS fuente=patrones tags=X@@` desde cualquier tenant.
- **Referencia cruzada**: link a `[[sato-ejecutor]]` backlog Ola 2 (E4-E7).

**Verificación:** doc existe, tiene las 5 secciones, casos de test con anti-PII validado en texto.

---

### Bloque G · CRM Pro Mobile

#### F-CRM-Mobile · Portar `MAQUETA-CRM-PRO-MOBILE-v1.html` a `src/index.html` [4 h]

Como en encargo v2 §5 Bloque G. Sin cambios estructurales.

Precondición extra de esta tanda: **R12 del PLAN-REMEDIACION Ola 3** (assert de contención del `@media (max-width:640px)`) DEBE haber corrido antes.

Regla dura de no-interferencia mantenida. Anti-patrones mantenidos. Verificación Playwright 393×852 + escritorio 1440×900 idéntico + eyeball iPhone real.

---

### Bloque H · Cierre

#### F-Doc · Corregir doc en `05_costos.js:50` [10 min]

C-4 arriba. Un commit de doc.

#### F14 · Cierre + optimización tokens + HANDOFF [2 h]

Como en encargo v2 §5 Bloque H F14, con estos ajustes:
- `_inventario_cierre.sh` obligatorio.
- `RUNBOOK-OPTIMIZACION-TOKENS-CLAUDE-MAX.md` con las 5 palancas + la palanca no obvia (Sonnet 5 con caché < Haiku sin caché).
- Extender `web/dashboard.html` (Projects/MEDIDOR TOKENS, no SatoriOS) con paneles Sato-VOZ + Sato Ubicuo + semáforo Claude Max.
- Actualizar memorias: `sato-integridad-datos`, `satori-os`, `sato-ejecutor`, `crm-pipeline`, y nueva o extendida `sato-viviente-cierre` si el volumen lo pide.
- Regenerar `CAPABILITIES.md` (via `_capabilities_gen.sh` extendido).
- HANDOFF en **`~/Documents/Claude/Handoffs/2026-08/2026-08-27 - SATO-VIVIENTE-POST-OLAS-CIERRE.md`** — CLAUDE.md §10.
- Actualizar `HANDOFF.md` maestro con cross-reference a los 3 handoffs de la jornada (Sato Viviente Bloque A, CRM Pro Mobile handoff, este de cierre).

---

## §4 · COORDINACIÓN DE AGENTES INTERNOS

| Fase | Explore | Plan | code-reviewer | consejo-asesores | bastion-satori | purga-de-errores | handoff-proyecto |
|---|---|---|---|---|---|---|---|
| PC-A..E | ✓ | | | | | | |
| F3 | | ✓ | | | ✓ pre | | |
| F4 | ✓ | | | | | | |
| F5 | | | | ✓ | | | |
| F6 | | ✓ | ✓ | | ✓ pre | ✓ post | |
| F6' | | | ✓ | | | | |
| F7 | ✓ | ✓ | ✓✓ | | ✓ pre (crítico) | ✓ post | |
| Reload | | | | | | | |
| F10-a | ✓ | | ✓ | | | | |
| F11 | | | | | | | |
| F12 | | | | | | | |
| F13 | | | ✓ | | | | |
| F-Diseño-Patrones | | ✓ | | | ✓ pre | | |
| F-CRM-Mobile | ✓ | | ✓ | | | ✓ post | |
| F-Doc | ✓ | | | | | | |
| F14 | | | | | | ✓ obligatoria | ✓ |

---

## §5 · GATES BASTIÓN CONSOLIDADOS

Antes de merge de cada fase con gate:
- [ ] `_soloOwner_` en todo endpoint nuevo.
- [ ] Aislamiento tenant en toda escritura.
- [ ] Sanitización `limpiarHostilTexto_` en entradas de texto libre.
- [ ] Marcador `<<<>>>` neutralizado.
- [ ] Secretos en `.env.local` / `PropertiesService`, jamás en git.
- [ ] Fail-closed nunca "OK" en silencio.
- [ ] Cache prefix SIN fecha/UUID/id-sesión.
- [ ] `SatoPatrones` NO ejecutado (solo diseño).
- [ ] `push_proactivo_on` NO se toca.
- [ ] `agent.py` con UN solo reload al final del Bloque D.
- [ ] R12 (assert @media) corrido antes de F-CRM-Mobile.

---

## §6 · CRITERIOS DE ESCALADO A LUCIANO

Parás y avisás si:
1. PC-A/B/C/D/E cualquiera pendiente → arrancás sólo lo que se puede o FRENAR.
2. F5 Consejo confianza < 6/10 o empate.
3. Plugin `anthropic` para LiveKit no disponible ni por LiteLLM.
4. Latencia post-F6 > +50% vs baseline R6 (independiente del ≤900ms nominal).
5. F7 latencia polling > 5s → Opción B (Tailscale HTTP directo).
6. F-Diseño-Patrones detecta que E5 gate Bastión ya se resolvió (podríamos ejecutar F8-F9 REAL, no solo diseño) — escalar decisión.
7. Cabo abierto en F14 no resoluble en <30 min.

Formato: (a) resumen 5 líneas, (b) qué probaste, (c) 2-3 alternativas ranqueadas, (d) recomendación con confianza X/10.

---

## §7 · ORDEN DE EJECUCIÓN Y PARALELISMO

```
PC-A..E → { F3 → F4 }              (Bloque B, dep en PC-B)
              ↓
         F5 → { F6 GO | F6' NO-GO }  (dep en PC-C + PC-D)
              ↓
         F7                          (dep en F3)
              ↓
       RELOAD agent.py consolidado   (F3 + F6/F6' + F7c + F13)
              ↓
       [Bloque E paralelo] F10-a → F11 → F12 → F13   (F13 va en reload)
              ↓
       [Bloque F paralelo] F-Diseño-Patrones          (paralelo con Bloque E)
              ↓
       [Bloque G] F-CRM-Mobile        (dep en R12 de Ola 3)
              ↓
       [Bloque H] F-Doc → F14 cierre
```

**Ruta corta si PC-C falla (sin credencial Anthropic):** F3 → F4 → F7 (sin migración motor) → reload → Bloque E → Bloque F → Bloque G → F-Doc → F14. F5-F6 queda como cabo con dueño Luciano.

---

## §8 · TOPES DUROS

- **Tiempo total:** 22-25 h. Si en 30 h no hay cierre → PARAR y handoff parcial.
- **Output tokens Claude Max:** > 200k → PARAR y avisar.
- **Nuevos endpoints:** máximo 4 (widget SatoUbicuo).
- **Nuevas hojas:** máximo 1 (`_sato_identidad`; SatoPatrones NO se ejecuta).
- **Nuevas deps Python:** máximo 2 (plugin anthropic + LiteLLM si hace falta).
- **Prohibido:** promover `/exec`, encender `push_proactivo_on`, tocar Orbe v2, tocar CRM Pro §2d ya en prod (@57), ejecutar F8-F9 (solo diseño), tocar frontera E5, escribir handoffs en raíz de SatoriOS.

---

## §9 · FORMATO DEL REPORTE FINAL

Un mensaje con:
1. **Línea 1:** `CIERRE: incluye X · QUEDA ABIERTO: Y`.
2. **§ Ejecución** (≤12 líneas).
3. **§ Números**: latencia voz pre/post, cache hit-rate por módulo pre/post F3+F6, tokens estimados semanales post-migración, nodos Cerebro por tenant, tabbar mobile OK.
4. **§ Nuevas capacidades** (bullets 1 línea).
5. **§ Deuda técnica y diferidos** (F10-b decisión pendiente, F8-F9 gateada por E5).
6. **§ Cabos de otras sesiones respetados**.
7. **Handoff:** link a `~/Documents/Claude/Handoffs/2026-08/2026-08-27 - SATO-VIVIENTE-POST-OLAS-CIERRE.md`.
8. **Confianza global final:** X/10.

---

## §10 · ANEXO — LO QUE NO SE TOCA

- Arquitectura `_systemBloques_` en `05_costos.js` (fuera del fix de doc F-Doc).
- `_satoDatos_` T1.8 aislamiento.
- Ruteo por costo `MODELOS_POR_MODULO`.
- Agentes lab congelados hasta Forge.
- `SOUL_REGLAS` textual (solo espejo en `docs/SATO-IDENTIDAD.md`).
- Regla dura 29-jul aislamiento.
- Dashboard `web/dashboard.html` (Projects/MEDIDOR TOKENS) — se extiende, no se rehace.
- Panel Sato in-page T4 (25-ago).
- Orbe Persistente v2 + orbe CM — regla +51.
- CRM Pro §2d en prod (@55/@56/@57).
- Frontera `objetivos.descripcion → correrDirector` — E5 gate Bastión.
- `pushProactivoDiario_` estructura.
- Todo lo consolidado por Olas 0-3 del PLAN-REMEDIACION.

---

**FIN DEL ENCARGO POST-OLAS.** Confianza planificación: 8/10 (7/10 hasta que PC-C se confirme).

Los 2 riesgos controlables con datos:
- (a) Plugin `anthropic` para LiveKit disponible o LiteLLM bridge — se resuelve verificando en F6.
- (b) Latencia post-migración vs baseline R6 — se resuelve midiendo.

---
*Cowork · 27/08/2026 · continuación de ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md (Bloque A ejecutado) + PLAN-REMEDIACION-2026-08-27.md (Olas 0-3). Cierra los pendientes de F3, F4, F5, F6/F6', F7, F10-a, F11, F12, F13, F-Diseño-Patrones, F-CRM-Mobile, F-Doc, F14.*
