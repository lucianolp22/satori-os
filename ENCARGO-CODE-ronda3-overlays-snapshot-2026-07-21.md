# ENCARGO CODE — Ronda 3 overlays (CON instrumentación) + snapshot Despacho + HANDOFF repo — 21-jul-2026

**Contexto verificado por Cowork (21-jul, contra repo y hojas — no re-verificar):**
- **PROMOTE a /exec HECHO** hoy 08:18 por Luciano: commit `5f8846e` creado y pusheado (main == origin/main ⇒ el deploy del paso 4/5 pasó). Rollback anotado en `_promote_rollback.txt` (@30). Eyeball de /exec pendiente de Luciano; reinicio del agente de voz pendiente.
- **Fila test "Objetivo de prueba" (OBJ-0001) de CLI-001 YA BORRADA** por Cowork vía navegador (hoja `objetivos` del sheet CLI-001 quedó solo con header, verificado). NO figura más como pendiente.
- **Hipótesis del delay del Despacho post-voz CONFIRMADA contra el código:** `cmSnapGuardar`/`cmSnapLeer` usan **sessionStorage** (`src/index.html:1832-1833`) — muere al navegar a voz.html y volver. Akasha usa **localStorage** con TTL 10 min (`ak_snap_v1`, `src/index.html:4511-4525`) y por eso vuelve instantáneo. Ya no es hipótesis: es diagnóstico.
- Cowork intentó el experimento de overlays vía Claude in Chrome: **el sandbox de GAS es opaco** (ni screenshot, ni texto, ni árbol de accesibilidad ven dentro del iframe). Por eso esta ronda va SÍ o SÍ con instrumentación (regla de la casa: a la 2ª ronda fallida no se adivina más).

**Reglas vigentes:** git write solo vos (Mac/Code) · trabajar SIEMPRE contra /dev, NO tocar /exec (el próximo promote lo decide Luciano) · verificar contra el código antes de construir · gates D17/D18 verdes 2× el 20-jul: NO re-flaggear · comandos a Luciano limpios (sin `#` inline ni paréntesis).

## Tarea A — Overlays Tablero/Calendario abiertos DESDE Akasha (3 rondas fallidas → instrumentar ANTES de fijar)

Síntoma: desde el Despacho andan; desde Akasha se abren rotos (el cosmos 3D se ve detrás / el overlay no cubre). Fixes previos: E3.14 scrim opaco, E3.15 `ak-modal` → `#akasha{display:none}` + reruta `atril-board`→`cmBoardOpen`. Ninguno pegó.

**A1. Instrumentación primero (no tocar CSS todavía):**
- En `akModal_` (o como se llame el handler que aplica `ak-modal`): log con marca única, p.ej. `console.log('[AK-OVL]', puerta, document.getElementById('centro').className, getComputedStyle(document.getElementById('akasha')).display, (function(){var gl=document.querySelector('#akasha canvas, canvas'); return gl ? (document.getElementById('akasha').contains(gl) ? 'canvas-DENTRO' : 'canvas-FUERA') : 'sin-canvas';})())` + un toast breve en pantalla (Luciano no abre consola por defecto).
- Cablear el log en **TODAS las puertas de apertura** desde Akasha, con nombre de puerta: (1) botón Calendario, (2) botón Tablero, (3) **"Abrir tablero →" del panel TAREAS derecho**, (4) **click en día del mini-calendario**. Sospecha fuerte del handoff: hay puertas sin pasar por el handler ruteado.

**A2. Árbol de lectura (del handoff 20-jul, aplicarlo con los logs en mano):**
- Sin `ak-modal` en className ⇒ esa puerta no dispara el handler → cablearla a la ruta única de apertura.
- Con `ak-modal` y `display:none` pero el universo visible ⇒ **el canvas 3D vive FUERA de `#akasha`** (el engine lo apendea a body) → el CSS debe ocultar también el canvas: `#centro.ak-modal canvas` o el id real (#gl).
- Con display ≠ none ⇒ CSS pisado por otra regla → resolver especificidad.

**A3. Fix dirigido según lectura + dejar la instrumentación detrás de un flag** (p.ej. `AK_DEBUG_OVL=false` por defecto) para no repetir la saga del panel AK-DEBUG.

## Tarea B — Snapshot del Despacho a localStorage (fix del delay post-voz)

- `cmSnapGuardar`/`cmSnapLeer` (`src/index.html:1832-1833`): cambiar `sessionStorage` → `localStorage`, conservando el contrato `{t, d}` y el parámetro `maxMin` (TTL) tal como está. Mismo patrón que `ak_snap_v1`.
- Revisar los llamadores de `cmSnapGuardar` por si alguno asumía vida-de-pestaña (buscar todas las claves usadas). Si alguna clave guarda algo sensible de sesión, decirlo antes de migrarla.
- Verificación: flujo Despacho → voz.html → volver: el repintado debe ser instantáneo como en Akasha (eyeball final de Luciano en /dev).

## Tarea C — HANDOFF.md del repo (stale al 17-jul)

Actualizarlo para que refleje: cierre 20-jul (fuente: `HANDOFF-2026-07-20-CIERRE-T1-NS-UI.md`), promote a /exec hecho 21-jul 08:18 (`5f8846e`), fila test borrada, y lo que hagas en A y B. El HANDOFF-2026-07-20 del repo queda como histórico; el HANDOFF.md vuelve a ser espejo vivo.

## Cierre de la ronda

1. `clasp push` a HEAD (/dev) + selfTest completo VERDE (una corrida; no re-flaggear gates).
2. Commit(s) con mensaje claro + push a GitHub.
3. Dejar en 2 líneas al final de HANDOFF.md qué debe eyeballear Luciano en /dev: overlays por las 4 puertas + retorno de voz al Despacho sin delay.

**NO hacer:** tocar /exec · re-sembrar objetivos de tenants (pausa clientes) · arrancar T3 (eso viene después de la purga de cierre de tanda).
