# HANDOFF — Satori OS — 2026-08-13 · Cartera + Avatares EN PROD + las 11 observaciones

> **Al retomar: modo ejecutor.** Esta sesión bajó las 11 observaciones de Luciano, auditó todo contra el repo real, y **dejó el módulo Cartera comercial + alta liviana + 8 avatares del laboratorio + botón Cerebro funcionando en producción (`/exec @43`), verificado por eyeball de Luciano.** Loop: Cowork planifica+audita → Code ejecuta (Terminal Mac) → Luciano aprueba. `clasp run` MUERTO → selfTest lo corre Luciano en el editor.
>
> **NO hay nada bloqueante abierto.** Prod está sano. Lo que sigue son etapas nuevas (E3 en adelante), la principal es **SATORI HQ** (tu Ficha 360 propia), que arranca cuando des tus observaciones a la maqueta v2.
>
> **ADENDA 2 (13-ago, tarde): tanda `eaee70e` E2b+HQv0 COMMITEADA, pendiente de `clasp push` + eyeball /dev + promote.** Contenido: logos del roster en sidebar y Cartera·Semáforo del CM (`cliLogo_` + `listaClientes()+logo_url`), página **Satori HQ** servida por `doGet ?v=hq` (`src/hq.html`, solapa Cartera con `carteraPipeline` REAL, resto maqueta hasta E3) y botón **◉ HQ** en el CM. Verificado: node --check OK · `_verificar_index` OK · arnés 601/0 · render headless 0 pageerrors (sidebar/kanban pintan `img`). ADEMÁS, sin deploy: Config filas 83-88 sembradas con `avatar_cliente_CLI-00X` → **la Ficha 360 ya muestra logos en prod @43**.
>
> **ADENDA 13-ago (tarde, Cowork): E2 resto EJECUTADO.** Los 6 logos cliente están subidos a Drive y cableados en `logo_url` del roster (verificado celda×celda + render del thumbnail). MesaQuince: Luciano confirmó en el chat que la marca es «The Brasa Club» → cableado también. Detalle en §1-obs2 y §3.

---

## §0 · ESTADO VIGENTE (foto)

| Cosa | Estado |
|---|---|
| Prod `/exec` | **@43 SANO** — verificado por Luciano: Akasha carga, «Cartera·Semáforo» lista los 20 clientes, agentes con avatar, salud OK 100%. Re-verificado 13-ago tarde por Cowork: boot con 0 errores de consola. |
| `main` (GitHub) | `41e534d`. Contiene módulo Cartera (`33_cartera.js`), alta liviana (`crearCliente sinSheet`), fix del backup, fix del boot (carteraX). |
| Cartera en el MAESTRO | CLI-008…021 (14 tibios livianos, sin Sheet) + 6 etapas marcadas. `etapa_comercial`+`prox_accion`+`etapa_desde` poblados. |
| **Logos cliente (E2 resto)** | **HECHO 13-ago (Cowork, vía Chrome+conector): los 6.** CLI-001 MesaQuince (confirmado «The Brasa Club») · CLI-002 Vehemence · CLI-003 LC Travel · CLI-004 DAM · CLI-005 SIP · CLI-007 EJF con `logo_url` cargada y verificada celda×celda. |
| Avatares lab | Los 8 cargados en Config (filas 75-82) + `cerebro_url` fila 74 — verificado 13-ago contra la hoja. Cabo: en Edificio/Akasha 3D siguen placeholder ◌ (es encargo del Edificio). |
| Maqueta SATORI HQ | `MAQUETA-SATORI-HQ-v2.html` entregada y re-enviada 13-ago — **espera tus observaciones** antes del port a GAS (E3). |
| Purga / verificación | Purga GO + selfTestTramo5 164/0 + arnés 601/0 + render headless del cliente limpio + eyeball de Luciano. |
| **Hallazgo E6 (13-ago)** | **BRIEF-HOY.md no corrió hoy**: último brief = mar 12/08 05:19. Revisar la tarea programada que lo genera (entra en E6). |

---

## §1 · LO QUE SE HIZO (sesión 11-13 ago + adenda)

**Plan maestro:** `PLAN-OBSERVACIONES-11-SATORI-OS-2026-08-11.md` (repo + Project). Auditoría punto por punto de las 11 observaciones. Decisiones de Luciano: **D1** módulo Cartera completo (derogación consciente de F3 §2.5, registrada) · **D2** reactivar Capa 3 Hilos (E5) · **D3** minería de contactos solo 1er grado.

| # Observación | Estado al cierre |
|---|---|
| 1 · Pipelines | **Módulo Cartera comercial EN PROD** (kanban por etapa + próxima acción + días-en-etapa + panel Semáforo). Pipelines de ideas/objetivos → E3 (Ficha HQ). |
| 2 · Avatares + logos | 8 avatares lab **generados + cargados en prod**. Logos cliente: **6 de 6 CARGADOS 13-ago** (`logo_url` verificada celda×celda + thumbnail renderizando; MesaQuince confirmado por Luciano). Falta: logos de los tibios nuevos cuando existan + eyeball de la vista Cartera. |
| 3 · Registro por cliente infalible | Resuelto (tenant_datos + D30). Falta **Capa 3** (cierre→Hilo automático) = **E5**. |
| 4 · Ficha 360 propia | Maqueta **SATORI HQ v2** entregada (re-enviada 13-ago) → tu observación → port GAS (**E3**). |
| 5 · Checklist personal | Diseñado en la maqueta (solapa Checklist). Se construye con E3. |
| 6 · Objetivos del OS | Los 4 ejes en la maqueta (solapa Objetivos + dashboard). E3. |
| 7 · Cartera comercial | `CARTERA-COMERCIAL-SATORI-2026-08-11.md` v2 + **cargada en el OS**. ✅ |
| 8 · Dashboard de objetivos | Diseñado (flow + «SGIC sugiere»). Se construye con E3. |
| 9 · Fichas 360 cliente (solapas + orbe ×3) | **E4**, pendiente. |
| 10 · Cerebro/Memoria | Botón 🧠 → patrón Config + `cerebro_url` sembrada (verificado en Config fila 74). Falta verificar BRIEF-HOY (¡hoy NO corrió!) + runbook 3-capas = **E6**. |
| 11 · Validar hilos | Herramientas existen; la pasada de validación = **E5**. |

## §2 · INCIDENTE DEL PROMOTE (cerrado — vale como lección)

El promote a @42 rompió el arranque de la app (Hoy/CM/clientes en "Cargando..." infinito). **Causa:** en la vista Cartera nueva, `index.html:2519` hacía `document.getElementById('carteraX').addEventListener(...)` a nivel top del script, pero el botón `#carteraX` vive en el markup **línea 7822** (después del script). Al ejecutarse durante el parseo, el elemento aún no existía → `null` → TypeError top-level → **cortaba el resto del arranque**.

**Diagnóstico (Cowork):** Ejecuciones del editor = todas «Completada» (server sano) → descarté servidor. Render headless del `index.html` con `google.script.run` simulado → `pageerror at index.html:2519`. **Fix:** diferir el listener a `DOMContentLoaded` (una línea). Verificado por render (boot limpio) → promovido **@43** → eyeball de Luciano OK.

**Por qué no se atrapó antes** (deuda de proceso, ya en CLAUDE.md/memoria): `_verificar_index` mira sintaxis, no orden del DOM; el selfTest es server-side; y **la Purga dio GO sin renderizar el `index.html` modificado**. **Regla nueva (+37):** toda tanda que toque `index.html` pasa por render headless real + eyeball en `/dev` ANTES del promote. **+38:** la captura de pantalla de Cowork sale en blanco con apps GAS que usan canvas WebGL (Akasha) — no es que esté rota; se verifica por consola (red activa + 0 errores) o con un screenshot del propio Luciano.

## §3 · LO QUE QUEDA (etapas, con dueño)

- **E2 resto — logos cliente: ✅ HECHO 13-ago, los 6** (MesaQuince confirmado y cableado). Queda: logos de los tibios nuevos (CLI-008…021) cuando existan + eyeball de Luciano de la vista Cartera con logos.
- **E3 — SATORI HQ (el build grande):** observás `MAQUETA-SATORI-HQ-v2.html` (re-enviada al chat 13-ago) → Cowork ajusta → encargo de port a GAS (schema `checklist_propia`/`objetivos_propios` + solapas Hoy/Checklist/Objetivos/Números/Cartera + dashboard de objetivos con flow + «SGIC sugiere»).
- **E4 — Fichas 360 cliente:** solapas + orbe individual ×3 + más puntos de dato.
- **E5 — Hilos vivos:** validación 100% (`hiloCliente` por cliente) + Capa 3 (cierre de sesión → Hilo automático, D2).
- **E6 — Cerebro/Memoria:** verificar BRIEF-HOY diario (**hallazgo 13-ago: no corrió hoy — último 12/08 05:19; revisar la tarea programada**) + runbook de las 3 capas de memoria + confirmar botón 🧠 en el CM (código y Config verificados; falta eyeball). 
- **E7 — Minería de contactos:** misión Equipo Agentes Pro, solo 1er grado, gate Bastión (D3).
- **Perf:** con 21 clientes la carga del server se puso lenta (datosHoy 8.6s, salud 16.6s). Mirar a futuro (no bloquea).
- **Frentes 05-ago vivos:** F4a facturas 2026 · Lift vía Forge · Notion/Trello F3 · deuda menor.

## §4 · PUNTEROS

- **Docs de la sesión (repo + Project `claude/`):** `PLAN-OBSERVACIONES-11-…` · `CARTERA-COMERCIAL-SATORI-2026-08-11.md` (v2) · `ENCARGO-CODE-OBS-E0-E1-…` · `ADENDA-ENCARGO-T1e-AVATARES-…` · este handoff · `MAQUETA-SATORI-HQ-v2.html`.
- **Módulo nuevo:** `src/33_cartera.js`. Endpoints en `ENDPOINTS_UI`: `carteraPipeline`, `moverEtapaComercial`, `seedCartera2026_08_11`(+Aplicar), `seedAvataresLab`(+Pisar).
- **Avatares lab:** `Avatares Satori/avatares-lab/` (8 PNG+SVG). En Drive: carpeta `1gR0lAHmP68Tk69mGfiZzods7C3es58cq` (owner luciano@, pública). URLs cargadas en Config filas 75-82 (+`cerebro_url` fila 74).
- **Logos cliente (nuevo 13-ago):** Drive `Avatares/clientes/` = carpeta `14BoFgYrzIzdfo3QrpjGK3tVmhWtqkaT9`. IDs: Vehemence `1U0bPWXCB291_Lc3JLt88g4w4-0fRNNrY` · LC Travel `1KrPBc0KkbUuDvOEoew_eN7EoEtXmH6Ry` · DAM `1v3CqNSn2oD9TdxhpL52A1WtorHAlblKJ` · SIP `1ds8zi7Muvl6jU7QMR0Icz2vHeCTCCNdZ` · EJF `1YrEt6gmff7iDAHt3DKb-iG-uejtNDBCh` · MesaQuince `1QIJvODQybfmrGMxeZ0XQS_b0xRNZCvx2`. Patrón URL: `https://drive.google.com/thumbnail?id=<ID>&sz=w512` en columna I (`logo_url`) de `Clientes`.
- **Commits:** `c72cca3` (botón 🧠) → `863ea8d` (T1.e+cartera+avatares) → `41e534d` (fix boot + promote @43).
- **Deploy:** `clasp push` → `selfTest()`/tramos en editor → `git push` → `bash _promote_exec.sh` (dry) → `--go`. **Regla nueva: si tocó `index.html`, render + eyeball en `/dev` ANTES del `--go`.** Verificar prod con `clasp deployments`, no con `_promote_rollback.txt`.

## §5 · CLAVES

MAESTRO `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` · scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` · `/exec` @43 deployment `AKfycbxZJL4E…phLm` · `/dev` `AKfycbzT5Qkt…` · voz `xcAUMhbpNX2WRGsuhjFy` · ts.net `lucianos-macbook-pro.tail4115b8.ts.net` · grafo `127.0.0.1:8788` · secretos vencen 2026-10-19 · editor **luciano@satoriconsultoria.com** · conector Drive de Cowork **llopriore@** (con acceso owner relogueado).

## §6 · LECCIONES NUEVAS (para CLAUDE.md)

- **+34** SVG: gradiente `objectBoundingBox` no pinta líneas verticales/horizontales (bbox cero) → `gradientUnits="userSpaceOnUse"`.
- **+35** `drive.file` NO ve archivos subidos a mano por el usuario — solo los que la app creó/abrió (P2 · BK-1 · BK-2 · avatares). Declarar el límite + dar el camino alterno; Cowork resuelve el ID vía su conector Drive si el usuario comparte la carpeta.
- **+36** Cowork puede escribir el MAESTRO vía claude-in-chrome cuando el navegador está logueado como owner. Name box para la celda exacta; verificar celda×celda. Solo data no sensible (Config/arte); NO data de clientes a ciegas.
- **+37** UI nueva (`index.html`) → render headless Playwright + eyeball en `/dev` ANTES del promote. La Purga debe RENDERIZAR, no solo auditar lógica. Bug clásico: `getElementById().addEventListener` top-level sobre un elemento que está más abajo en el DOM que el `<script>` → null → mata el boot.
- **+38** La captura de claude-in-chrome sale BLANCA en apps GAS con canvas WebGL (Akasha) — no significa que esté rota; verificar por consola (Net BUSY/IDLE + 0 errores) o pedir screenshot a Luciano.
- **+39 (13-ago)** Cowork SÍ puede subir archivos del Mac a Drive sin transcribir bytes: `file_upload` de claude-in-chrome acepta las rutas STAGEADAS (`/mnt/user-data/uploads/...`) sobre un `<input type=file>` inyectado por JS, y un `drop` sintético (`DataTransfer` + `DragEvent` sobre `document`) dispara la subida nativa de Drive. Transcribir base64 largo a mano en el conector = corrupción casi segura (falló con 4KB); NO repetirlo.
- **+41 (13-ago)** Escritura multi-celda en Sheets vía Chrome: tipeo con Tab/Enter se DESINCRONIZA con el autoguardado (celdas corridas). Método confiable: `navigator.clipboard.writeText(texto_con_tabs_y_newlines)` + seleccionar la celda ancla + `cmd+v` — un solo paste atómico, luego verificar por gviz.
- **+40 (13-ago)** Para LEER hojas del MAESTRO sin API: `fetch` del export `gviz/tq?tqx=out:csv&sheet=X&range=A1:L25` desde un tab de docs.google.com logueado (via javascript_tool). Verificación celda×celda barata antes/después de escribir. El `/exec` con multilogin exige la URL de dominio `script.google.com/a/macros/satoriconsultoria.com/...`.

*Generado por Cowork · 2026-08-13 (actualizado misma fecha, tarde) · prod @43 verificado. Al retomar: E3 (SATORI HQ) es el próximo frente grande — arranca con tus observaciones a la maqueta v2.*
