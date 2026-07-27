# PLAN INTEGRAL SATORI OS — v3 · 21-jul-2026 (MODO CADENA)

> **Supersede la tabla de tandas del PLAN-INTEGRAL-2026-07-18** (ese doc queda como fuente de los descartados, doctrina y detalle histórico). Cambios v3: (1) estados al día 21-jul; (2) **integra el handoff "Hilo de trabajo × Akasha × conectar SGICs"** (sesión DAM 21-jul) como tanda **TC**; (3) **decisión de Luciano 21-jul: MODO CADENA** — todo lo que queda se construye en una sola corrida encadenada de Code, con gates humanos comprimidos en UNA revisión conjunta final en /dev, y recién después promote.

## §1 · Estados al 21-jul (verificado contra repo)

- **T0, T1 (métrica), T2 (North Star enriquecido):** CERRADOS. Cola de T1 pendiente: **cerebroNodo E3.5** (solo existe como referencia futura en index.html:3606) → entra en la cadena (fase H).
- **T3 · Módulo S:** CERRADO (selfTest verde 21-jul, secretos vencen 2026-10-19, purga 0 críticos).
- **T3 · Módulo M:** M1+M2 CONSTRUIDOS y pusheados a /dev (commits `1a2f504`+`a6c6f9e`); sus gates de editor se comprimen al gate final de la cadena. M3-M5 → cadena.
- **Conectores:** `sincronizarConectorVentas_(id, srcId, sheet, fuente)` YA es genérica; solo Vehemence cableada (`VEHEMENCE_DB_ID`, 19_conectores.js:22-32). Generalizar = mapa por Config + adapters por SGIC.
- **Akasha:** Espacios de Cliente YA existen (panel3 "Espacio de Cliente", `entrar al Espacio`, historial E5). La estación del Hilo EXTIENDE eso.
- **Prod /exec:** promovido 21-jul 08:18 (`5f8846e`). Desde entonces todo va a /dev; /exec intocado hasta la revisión final.

## §2 · Integración del handoff Hilo × Akasha × SGICs (decisiones cerradas — no se reabren)

1. Fuente de verdad del Hilo = `_cerebro/HILO - <Cliente>.md`; toda vista es downstream.
2. El Hilo es la ÚNICA vista de cliente: **absorbe** `panel cliente` (flujo-webapp) y F3 tarjeta-cliente.
3. **Conectar todos los SGICs = objetivo de primer orden** (el 80/20: sin "Real" por cliente, el Hilo queda hueco fuera de Vehemence). Encaja con el pendiente A1 multi-superficie (Trillion).
4. El prompt maestro del Hilo corre as-is; la skill es N1 (correr a mano en ≥2 clientes antes de que la vista muestre datos).
5. **Respuestas v3 a las preguntas abiertas del handoff (decisión delegada a Cowork, 21-jul):**
   - Contrato `.md→DATA` = **hoja `hilo` en el Sheet del cliente + endpoint GAS `hiloCliente(id)`** (gated `_soloOwner_`). El `.md` sigue siendo la fuente; un paso de espejo (script local `_hilo_sync.sh`, corre Cowork/Code al actualizar un Hilo) lo sube a la hoja. GAS no puede leer el Mac: el espejo es el puente. Fail-closed: sin hoja/sin filas → "sin Hilo cargado", mock jamás.
   - Estación de cliente = **extender el Espacio de Cliente existente** (panel3) con la vista Plan/Real/Desviado/Pendiente. Cero motores nuevos, un solo THREE r128.
   - Orden = **entra en la cadena** (despausa PARCIAL del frente cliente SOLO para conectores read-only + Hilo; T5/T6 comercial y profundo siguen pausados).

## §3 · La cadena (orden de fases, con dependencia y riesgo)

| Fase | Contenido | Salida |
|---|---|---|
| **F0** | Preflight: drift repo↔GAS · estado limpio · leer este plan | gate técnico de arranque |
| **F1** | T3-M3 memoria hot/cold (D8) · M4 evals+piso determinístico · M5 verificación ≥2 dominios | motor profundo cerrado |
| **F2** | T3-H: SOUL.md (D11) · panel de Salud humano (delta sobre E8a4) · **cerebroNodo E3.5** (cola T1) · neural map render (capa en Akasha 3D; 2D descartado) | cabeza + render |
| **F3** | TC-W3: conectores generalizados — mapa `conector_*` en Config · `sincronizarCliente_(id)` · adapters por SGIC (arrancar DAM) · **cada conector nuevo nace OFF** (`conector_X_on=false`) hasta validarse al peso en la revisión | cartera conectable |
| **F4** | TC-W1 contrato Hilo (hoja+endpoint+espejo) · TC-W2 estación en el Espacio (absorbe panel cliente+F3) · TC-W4 lazo Dirección (status report = foto del Hilo) | Hilo end-to-end (oscuro hasta N1) |
| **F5** | T7 correo (SOLO si A2 autorizada): Gmail read-only → triaje a Bandeja; dictamen Bastión embebido en el encargo | correo triado o spec listo |
| **F6** | B8-código: PII Bucket B (anonimización Bandeja) · borrador `docs/RGPD-registro-tratamiento.md` · REPORTE-CADENA + HANDOFF | cierre de cadena |

**Fuera de la cadena (imposibles de encadenar, con porqué):** **T4 admin propia** (necesita las facturas reales de Luciano — entra cuando las suba) · **validación al peso de cada SGIC conectado** (regla SOP: conector por cliente es desarrollo con validación contra fuente — por eso nacen OFF y se encienden uno a uno en la revisión) · **selfTest de editor + eyeball + puesta-en-marcha + promote** (gates humanos, comprimidos en la revisión conjunta final).

## §4 · Reglas del modo cadena (mitigan el riesgo de batchear)

1. Un commit por fase (`CADENA Fx: …`), push a /dev al cierre de cada fase — si algo rompe, se bisecta por fase.
2. Todo lo riesgoso nace **detrás de flag OFF** (conectores nuevos, correo, render pesado). La cadena construye; la revisión enciende.
3. `node --check` + harness offline + guardia de drift en CADA fase. Ningún "hecho" sin verificación offline.
4. selfTest: la cadena AGREGA asserts (series D21+) pero el run es UNO solo, al final, en el editor (clasp run sigue bloqueado).
5. /exec intocado. Rollback = git por fase + `_promote_rollback.txt` vigente.
6. Si una fase se bloquea, se documenta en REPORTE-CADENA y se SIGUE con la siguiente (no se muere la cadena por un cabo).
7. Purga integral de Cowork sobre toda la cadena ANTES de la revisión conjunta.

## §5 · Gate final (una sola sesión de Luciano)

(1) `selfTest()` en editor (todas las series nuevas) → (2) eyeball /dev guiado por el REPORTE-CADENA (CM, Akasha, Espacios/Hilo, panel Salud, voz, tendencia) → (3) correr los 2 primeros Hilos (N1: DAM + Vehemence) y encender sus conectores tras validar al peso → (4) ajustes → (5) re-verificación → (6) promote a /exec + reinicio agente voz.
