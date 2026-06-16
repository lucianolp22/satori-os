# HANDOFF — Satori OS — 2026-06-15 (v3)

PRÓXIMO PASO: **cerrar E8a** — falta solo (1) `clasp push -f` + commit de los **7 parches de Purga + a4.2** (working tree: `07_util`/`08_webapp`/`14_director`/`15_cerebro`/`index.html`), y (2) correr los **casos 14-21** de aceptación en el editor. a1/a2/a3 + a4.1 **verificados** (Luciano vio el Command Center andando 16-jun); **Purga de cierre HECHA** (0 críticos/0 altos; 7 hallazgos → 7 parches, `node --check` 17/17 verde); **a4.2 orbe-vivo** construido (energía + neuronas ligadas a agentes en `work`, respeta calma/reduced-motion). El gate E2+ está **cerrado** (migración a Workspace + E2-1 resuelto + 6 casos manuales, todo verde). El **backend de 8a está construido y verificado en producción**: **a1** cerebro (`15_cerebro.js`), **a2** Director (`14_director.js`), **a3** Salud (`16_salud.js`) — los tres enganchados en `corridaDiaria` y verdes en `selfTest` (bloques E8a-1/2/3, corridos por Chrome). Falta **a4** (frontend en `index.html`: 4 *must* — Agenda/Salud · Directiva · telemetría · Parte del Director; diseño según la skill **`satori-design`** (reemplaza a `DESIGN.md`) + brief **`E8a4-UI-BRIEF.md`** con la visión de Luciano (integración Sureflow + brain/Z.E.R.O + constelación; **mobile-first**, control desde el teléfono; "orbe vivo" en fase a4.2); **no auto-verificable** por el iframe cross-origin de GAS, lo prueba Luciano) y **a5**. **Pendiente de commit:** a2+a3 (a1 = `8ed875b`). Demo 15-jun: el sistema corrió end-to-end con análisis **real** de Claude (Analista calculó margen 69,4% sobre datos sembrados; Vigía detectó la factura vencida). Diseño v1 propio del cerebro/salud — el doc canónico **CEREBRO** sigue faltando (refina a1; 6 chequeos de a3 inferidos).

**16-jun — a4.1 Command Center VERIFICADO + Purga de cierre E8a + 7 parches + a4.2 orbe-vivo:**
- UI sobre el orbe existente (no rompe «Hoy» Registro A): **tira de telemetría** (integridad% · llamadas · tokens · gasto/tope · errores · salud), **tab Salud** (los 6 chequeos + integridad, vía `estadoSalud()` dryRun), **directiva del Director** (etiqueta "capa de mando" + última directiva del feed), **mobile-first** (breakpoints 880/560 → control desde el teléfono).
- Backend: `08_webapp.js` → `estadoAgentes().telemetria` + `estadoSalud()`; `14_director.js` → la directiva se surface al feed MAESTRO (sin abrir Sheets cliente). Verificado vs schema real (`Costos_API_consolidado`, cola `'fallida'`) + `node --check` verde (índice `<script>` + 17 `.js`).
- **Gate satori-design:** registro **operativo** + orbe como elemento-firma (acento verde `#6cddba`); tokens del overlay existente, ninguno inventado inline. Confianza 8/10.
- **Purga de cierre E8a:** 0 críticos / 0 altos; 7 hallazgos (perf/quota/UX) → **7 parches aplicados**: cache de handles en `abrirCliente`, dedupe de la lectura de cola en `estadoAgentes`, rótulo "consolidado" vs gasto live en la tira, poll de Salud 60s, `conLock` en el rewrite de `materializarEstado`, fail visible de Salud en la UI, comentario del lock global. `node --check` 17/17 + `<script>` verde.
- **a4.2 orbe-vivo (`cmDrawOrb`):** resplandor central + banda de energía + neuronas que titilan, todo ligado a `CM.work` (agentes en `work`); en `modo calma` / `prefers-reduced-motion` el loop pausa (sin movimiento).
- **AREL — pendiente de Luciano:** `clasp push -f` + commit de los 5 archivos del working tree, y correr **casos 14-21** en el editor → con eso **E8a queda cerrada**. (a4.1 ya verificado en pantalla; el iframe cross-origin no es auto-verificable por Chrome.)

## Estado vigente
Satori OS = gestión multi-tenant sobre **GAS + Google Sheets** (un proyecto MAESTRO opera N Sheets cliente). **E1** en uso real. **E2+** (capa Trillion: aprobaciones, costos+Bastión, cola durable, registry 13 agentes —5 activos/8 lab—, Centro de Mando) construida y auditada.

**15-jun — migración a Workspace HECHA + E2-1 RESUELTO:**
- El OS migró de `llopriore@gmail.com` (personal, bloqueada por Advanced Protection) a **`luciano@satoriconsultoria.com`** (Workspace, C1 reusando la cuenta admin/principal). Vía clasp. `bootstrap()` autorizó directo como dueño → **Fase 3 (trust Admin) no fue necesaria** (diferible a multi-usuario).
- **E2-1 (causa raíz real):** `appendRow` ignora el formato `'@'` de la columna y coacciona los strings tipo-fecha (`'APR-0001'` → Date abril-2001) → el id releído no matchea. El fix previo `a6e641e` (solo formateaba la columna) no alcanzaba. **Fix:** `appendFila` (07_util.js) re-escribe las celdas `COLUMNAS_TEXTO` de la fila como texto explícito (`setValue` sobre celda `'@'`). Diagnosticado con `debugE21` (instrumentación, no teoría).
- **`selfTest()` cierra en "— TODO OK —"** (E2-1 + todos los casos E2 automáticos verdes).

**Gate E2+: aún NO cerrado.** Falta: manuales (E2-3/5/8/9/11/13) + neutralizar el sistema viejo (corre triggers en paralelo).

Modo de trabajo activo: Círculo + Equipo Agentes Pro + Bastión de fondo; ejecución-supervisada (AREL) y diseño Satori constantes; purga-de-errores en cada cierre de etapa.

### Verificado
- [15-jun] `clasp login` OK como `luciano@satoriconsultoria.com` (cliente google-provided default → el org NO bloquea clasp).
- [15-jun] Proyecto nuevo creado + `clasp push -f` (16 files); manifest correcto (Code restauró `appsscript.json` que `clasp create` había pisado con el default).
- [15-jun] `bootstrap()` OK: MAESTRO nuevo + 5 clientes + triggers + 1ª sync (0 pendientes/errores).
- [15-jun] `debugE21` confirmó la coerción: `id="2001-03-31T22:00:00.000Z"` en vez de `"APR-0001"`; `APR-CTRL` (no parece fecha) sobrevive → prueba que `appendRow` ignora el `'@'`.
- [15-jun] Fix `appendFila` aplicado → `node --check` OK → `selfTest()` **verde completo**.

### No verificado
- Casos manuales E2-3/5/8/9/11/13 (email real, API fallida, concurrencia, Cobrador, cupo, UI Centro de Mando) — **pendientes**.
- Que los triggers del proyecto viejo se hayan apagado (Purga M2 — pendiente de acción).
- Toda Etapa 8 (8a y 8b): nada construido.
- Si los otros 4 proyectos GAS (clientes) necesitan migrar también (mismo patrón APP/Workspace).

## Pendiente
**Must (ruta crítica — cerrar gate E2+):**
1. **Purga M2 — neutralizar el viejo:** en `llopriore@gmail.com`, proyecto `1Magy…`: borrar triggers (`corridaDiaria` + `drenarCola`) + revocar `CLAUDE_API_KEY` vieja (solo tras confirmar key nueva en el proyecto nuevo). Sheets viejos = backup hasta gate verde.
2. **Casos manuales E2-3/5/8/9/11/13** en el proyecto nuevo (editor/UI).
3. **Declarar gate E2+ cerrado** → trashear proyecto + 6 Sheets viejos.

**Should:**
- **Etapa 8a** (cerebro → director → salud → UI Command Center → casos 14-21), `ETAPA-8-PLAN.md`. Purga al cierre.
- Definir si los otros 4 proyectos GAS migran a Workspace.
- Deuda Purga: M1 (atomicidad appendFila bajo lock — documentado), M3 (batch del re-write para perf en sync grande), B3 (cross-ref del manejo de coerción en ARCHITECTURE).

**Nice:**
- **Etapa 8b** (entrenamiento agentes), `INTEGRACION-ENTRENAMIENTO-AGENTES.md`.
- Subir el usuario-OS a un `os@satoriconsultoria.com` dedicado antes de escalar (mínimo privilegio; hoy corre como admin = concesión de piloto).

## Artefactos
| Tipo | Nombre | Ruta / ID / URL |
|---|---|---|
| Repo | SatoriOS | `~/Documents/Claude/Projects/SatoriOS` |
| Handoff (este) | HANDOFF.md | repo root |
| Índice repo | ARCHITECTURE.md | repo root |
| Runbook migración (resuelto) | MIGRACION-WORKSPACE.md | repo root |
| Plan Etapa 8 | ETAPA-8-PLAN.md | repo root |
| Fix E2-1 | `appendFila` re-write texto | `src/07_util.js` |
| Diagnóstico | `debugE21()` | `src/09_selftest.js` |
| **Proyecto GAS NUEVO** | "Satori OS — MAESTRO" | `luciano@satoriconsultoria.com`; scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` (en `.clasp.json`, gitignored) |
| MAESTRO nuevo (Sheet) | Satori OS — MAESTRO | `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` |
| Proyecto GAS VIEJO (a neutralizar) | "Satori OS - MAESTRO" | `llopriore@gmail.com`; script `1Magy…`; scriptId en `.clasp.json.personal.bak` |
| Secretos | `MAESTRO_ID`, `CLAUDE_API_KEY` | Script Properties del proyecto nuevo (key rotada) |

## Desvíos del plan original
- **APP** (no previsto) forzó la migración a Workspace; resuelto con C1 reusando la cuenta admin.
- **E2-1** no era coerción-de-id-pura sino que `appendRow` ignora el `'@'`; el fix `a6e641e` fue insuficiente → fix real en `appendFila`.
- `clasp create` **pisa `appsscript.json`** con el default (pierde scopes) → restaurar con `git checkout` antes de `push` (aplica a los otros 4 proyectos si migran).
- **Fase 3 (trust Admin) resultó innecesaria** para operación owner-only.

---

## Apéndice histórico

### Decisiones (no rediscutir)
- **Opción C / C1** reusando `luciano@satoriconsultoria.com` (admin) como identidad de servicio del piloto. Mitigación: deploy MYSELF, trust solo ese client ID, no sumar scopes, mover a `os@` dedicado antes de escalar.
- **Rotar** la `CLAUDE_API_KEY` en la migración (no copiar la vieja).
- Fase 1 = no-op: cero data hand-loaded (roster + Config se regeneran del código; Sheets cliente vacíos). Cowork lo verificó leyendo los 6 Sheets vía conector Drive sobre `llopriore@gmail.com`.
- Roster 13 agentes (5 activos + 8 lab); tope API USD 25/mes; ejecutor = Claude Code, Cowork audita.

### Imprevistos y resolución
- [15-jun] El "fix raíz" `a6e641e` no resolvió E2-1 → **lección: instrumentar (`debugE21`) antes de teorizar.** Confirmado: `appendRow` coacciona pese al `'@'` de columna → fix per-celda en `appendFila`.
- [15-jun] Purga de cierre E2-1 (panel código+datos): 0 críticos. Altos/Medios → M2 (viejo corriendo en paralelo), A1 (manuales pendientes), M1 (atomicidad), M3 (perf), B1/B2 (commit+gitignore, resueltos).

### Changelog del handoff
- [15-jun] **v2:** migración a Workspace cerrada + E2-1 resuelto (fix `appendFila`) + `selfTest` verde + Purga de cierre. Gate E2+ pendiente solo de manuales + neutralizar el viejo.
- [15-jun] v1: descubierto bloqueo APP, decidida migración; E2-1 sin diagnosticar.
