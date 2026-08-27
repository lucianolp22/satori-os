# ENCARGO CODE · CRM PRO — tanda única — 25/08/2026

> **Para Claude Code, en el repo `~/Documents/Claude/Projects/SatoriOS`.**
> Cowork planificó y maquetó; Code ejecuta. Luciano supervisa y aprueba.
> **Decisiones de Luciano que rigen este encargo (25-ago):** todo en UNA tanda (nada a medias) ·
> `correo_on = true` (lectura Gmail habilitada — el ENVÍO/borradores NO entra, es fase aparte
> gateada por Bastión) · semáforo de retención REUSA la señal de vigilancia (no motor nuevo) ·
> español en toda UI y mensajes.
> **Referencia visual OBLIGATORIA:** `MAQUETA-CRM-PRO-v2.html` (raíz del repo) — abrila en el
> navegador y ejecutá los 10 flujos del panel "Prueba integral" ANTES de escribir código. La UI
> final debe reproducir esa maqueta (tokens ya son los del OS). Justificación de cada pieza:
> `PROPUESTA-CRM-PRO-2026-08-25.md` (raíz del repo).

---

## §0 · PRERREQUISITO — verificar la base real (ACTUALIZADO 25-ago tarde)

**La tanda base del CRM ya fue commiteada, certificada (938/0) y PROMOVIDA a `/exec` @51** en una
sesión paralela del 25-ago (memoria [[satori-os]] y [[crm-pipeline]]). Primer paso del encargo:

1. `git status --short` — working tree LIMPIO esperado. Si hay drift, FRENAR y avisar.
2. `git log --oneline -5` — confirmar que el HEAD incluye el CRM base (ancla `CRM 25-ago` en
   `33_cartera.js`) y que `clasp deployments` da @51 (o posterior).
3. ⚠ **Frente abierto que TOCA este encargo:** [[sato-integridad-datos]] — Sato dictó ventas que
   no coinciden con el SGIC y alucinó la procedencia. Antes de propagar campos nuevos del CRM a la
   fuente `cartera` de Sato (aguas abajo §4), leer esa memoria; si la DECISIÓN de fuente de verdad
   sigue pendiente, los campos nuevos entran a `carteraPipeline` pero NO se exponen a Sato hasta
   que Luciano la tome.
4. La tanda Pro se construye encima de @51, en commits propios.

## §1 · ALCANCE de la tanda Pro (lo aprobado — ni más ni menos)

| Pieza | Qué es |
|---|---|
| **M1** | Último contacto auto-sellado + días-sin-contacto en card/ficha + tile "+30 días sin contacto" + línea condicional en el brief |
| **M2** | Timeline Gmail por cliente: captura a staging (confirmación humana, tope 10), threads confirmados LINKEADOS en la solapa Comercial. `correo_on=true` |
| **M3** | Semáforo de retención en cards/ficha de ACTIVOS — render de la señal de vigilancia/SGIC existente (datos del mes · reunión mensual · compromisos). NO score, NO motor nuevo |
| **S4** | Todas las oportunidades del cliente visibles (card: badge de la más relevante · ficha: lista completa de `recurrentes_propios`) |
| **S5** | Motivo de pérdida OBLIGATORIO al mover a `perdido` (+col `motivo_perdido`) |
| **S6** | "Perder + recontactar en 90d": setea `prox_accion`/`prox_accion_fecha` a +90 días — el brief existente lo revive solo |
| **C7** | Dossier de reunión enriquecido: últimos 3 contactos + threads recientes + oportunidades abiertas |
| **C8** | Snapshot mensual de la cartera a `.md` (Cerebro / carpeta del repo) — la data siempre exportable |

**Presupuesto de señal (regla de diseño, de la maqueta):** máx **2 señales visibles por card** —
1 de captación (vencida > fría-30d > último contacto) + 1 de retención (solo activos). El resto
vive en la ficha. Una card con 6 alertas no tiene ninguna.

**Explícitamente FUERA de esta tanda** (rechazado en PROPUESTA §6 o gateado aparte): envío de
mails / borradores desde el OS · tracking de apertura/click (RGPD + señal rota) · scraping
LinkedIn · lead scoring ML · secuencias automáticas · conectores externos (HubSpot/Apify/etc.).

## §2 · LISTA-CONTRATO — schema y funciones

### 2a · Schema (`01_schema.js`) — TODO aditivo AL FINAL, disciplina E1
- `Clientes` += `ultimo_contacto` (ISO yyyy-mm-dd o vacío) · `motivo_perdido` (string).
  ⚠ Actualizar los asserts de cola (D44a2 y equivalentes en `_harness.js`) EN EL MISMO COMMIT.
- Hoja LAZY nueva `correo_cliente`: `['id_thread','id_cliente','asunto','remitente','fecha_ultimo',
  'estado','sello_tenant']` — `estado ∈ {staging, confirmado, descartado}`. PII → fuera de
  `MAESTRO_ORDEN`, patrón `hilo`/`checklist`. Dedupe contra `Correo_visto` (revisar colisión con
  el uso Bandeja de `30_correo` — son destinos distintos, el visto es compartido: documentarlo).

### 2b · Backend
- `33_cartera.js`:
  - `_sellarContacto_(id, fuente)` — privada; escribe `ultimo_contacto=hoy` + `feed_` a Actividad.
    La llaman: `moverEtapaComercial`, `propuestaRegistrar`, `propuestaFirmar`, la ingesta de
    tableros de reunión, y la confirmación de thread (M2). Idempotente por día.
  - `carteraPipeline()` — campos ADITIVOS por card: `ultimo_contacto`, `dias_sin_contacto`
    (server-side, zona horaria del Sheet), `senal_retencion` (solo activos, ver 2c), `ops`
    (todas las oportunidades del cliente, no solo la viva). NO romper la forma existente.
  - `moverEtapaComercial(id, etapa, motivo?)` — param 3 OPCIONAL aditivo: si `etapa==='perdido'`
    y falta `motivo` → `{ok:false, error:'motivo_requerido'}` (el front abre el modal). Con
    motivo → escribe `motivo_perdido` + Actividad.
  - `carteraRecontacto(id, dias)` — S6: setea `prox_accion` ("Recontactar — se perdió por: X")
    + `prox_accion_fecha` (+90d default). `_soloOwner_`.
  - `_carteraLineasBrief_` += línea condicional M1: "N candidatos +30 días sin contacto" (tope 3
    nombrados, mismo patrón vencidas).
  - `carteraSnapshotMd()` — C8: genera `.md` de la cartera (por etapa, con oportunidades y
    motivos); lo deja en Drive/carpeta convenida + retorna el texto. Invocable de trigger mensual.
- `30_correo.js` (M2 — EXTENDER, no reescribir):
  - `correoCandidatosStaging()` — barre threads recientes de remitentes que matcheen el roster
    (por dominio/email conocido), crea filas `estado=staging` en `correo_cliente`. TOPE 10
    pendientes: alcanzado el tope NO captura más y deja aviso. Scope `gmail.readonly` — CERO
    escritura sobre Gmail. Guarda `id_thread`, asunto, remitente, fecha — JAMÁS el cuerpo.
  - `correoConfirmarThread(id_fila, id_cliente)` — pasa a `confirmado` + `_sellarContacto_`
    (M1+M2 se alimentan). Valida `id_cliente` contra roster real (aislamiento §T1.8).
  - `correoDescartarThread(id_fila)` — `descartado`; no reaparece.
  - `fichaCliente`/`datosCliente` propagan los threads confirmados del cliente (link
    `https://mail.google.com/mail/u/0/#inbox/<id_thread>`).
- `29_vigilancia.js` o donde viva la señal (M3 — RENDER, no motor):
  - `_senalRetencion_(id)` — pura sobre datos que YA existen: ¿datos del mes recibidos?
    (operación del conector / SGIC) · ¿reunión mensual hecha o agendada? (Agenda) · ¿compromisos
    al día? (checklist/tareas del cliente). Devuelve `{datos, reunion, comp, nivel}` con
    `nivel ∈ {verde, ambar, rojo}` (0 pendientes=verde, 1=ámbar, 2+=rojo). Si una fuente no está
    disponible → `null` en ese campo y NO cuenta como pendiente (gris honesto, jamás rojo falso).
- `08_webapp.js`: dossier (C7) suma últimos 3 contactos + threads + oportunidades.

### 2c · Seguridad (Bastión — innegociable)
- TODO endpoint client-callable nuevo: `_soloOwner_` + alta en `ENDPOINTS_UI` **en el mismo
  commit**. Candidatos: `carteraRecontacto`, `correoCandidatosStaging`, `correoConfirmarThread`,
  `correoDescartarThread`, `carteraSnapshotMd`.
- Aislamiento: toda fila de `correo_cliente` lleva `sello_tenant`; un thread jamás se muestra en
  la ficha de otro cliente; el `id_cliente` de la confirmación se valida contra el roster.
- Gmail: `gmail.readonly` exclusivamente. Si cualquier cambio pidiera un scope nuevo → FRENAR y
  avisar (no auto-consentir).
- Funciones del desplegable: sin argumentos, sin guión bajo final.

### 2d · Frontend (`index.html`) — reproducir la maqueta v2
- Tiles: 5 (retenciones · recurrente/mes por moneda · vencidas · sin próximo paso · +30d sin
  contacto).
- Card: presupuesto de señal (máx 2) · badge de oportunidad (propuesta con monto atenuado /
  firmada con monto) · semáforo retención en activos con tooltip de detalle.
- Modal motivo de pérdida con 3 salidas: Cancelar / Perder / Perder+recontacto 90d.
- Solapa Comercial: bloque "Registrar contacto (hoy)" · lista de oportunidades completa ·
  timeline de threads con link a Gmail · encaje KAIROS tildable (escribe `encaje_kairos_4b`).
- Vista/panel "Correo → CRM" (staging): puede vivir como sección del panel Cartera o pantalla
  propia — criterio de Code, respetando stacking context (lección z-index: paneles a nivel body).
- Móvil: orden por urgencia (vencida > fría > resto) + señales M1/M3 en la card (la maqueta ③).
- Réplica en las DOS superficies donde aplique (lección +44: Command Center Y Akasha).

### 2d.MOBILE · Frontend móvil (iPhone) — reproducir `MAQUETA-CRM-PRO-MOBILE-v1.html`

> **Añadido 27-ago tras el `HANDOFF-2026-08-27-CRM-PRO-MOBILE-modulo-integracion.md`.** Módulo ADITIVO al §2d ya en prod (@56). Se aplica en la tanda del `ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md` como Fase F-CRM-Mobile — no re-abre el CRM base ya certificado. Referencia visual `MAQUETA-CRM-PRO-MOBILE-v1.html` (raíz). Aprobado por Luciano 26-ago tras la maqueta funcional + convivencia con escritorio. Confianza 9/10 en no-interferencia (10º punto es eyeball en `/exec` post-construcción).

**Regla dura de no-interferencia (Confianza 9/10, validada 27-ago):**
1. **TODO lo móvil dentro de un único `@media (max-width:640px)`** en `src/index.html`. Ni una regla mobile toca las clases base fuera del media query.
2. **Mismo DOM, no se borra nada.** El teléfono esconde/reordena con CSS (`display`, `order`, `position`), nunca quita nodos.
3. **Mejora progresiva.** Tab bar y bottom-sheet existen sólo bajo el breakpoint (`display:none` por defecto, `display:flex` dentro del `@media`). El orbe, la Akasha y el kanban existen sólo por encima.

**Piezas a portar** (fidelidad visual y de comportamiento a `MAQUETA-CRM-PRO-MOBILE-v1.html`):
- **Tab bar inferior** (`.tabbar`) — 4 botones: Hoy · Cartera · Sato · HQ. `position:fixed;bottom:0` con `safe-area-inset-bottom`, min-height 52px, tokens `--_terra-300` para activo. Sólo visible ≤640px.
- **Vista Hoy** (`#vHoy`) — foco de la semana (F3), 4 tiles KPI, urgentes por `orden_urgencia`. Fuente: `_carteraLineasBrief_`.
- **Vista Cartera** (`#vCartera`) — reordena lo existente: header + `.funcbar` (search sobre `carteraPipeline` + botón "+ Nuevo") + `.atajos` (Foco · Vencidas · Fríos +30d · Correo→CRM) + `.chips` (etapa+contador) + `.filtro-act` (banner con `×`) + lista vertical (`.cartera-cols{display:block}` dentro del media). Kanban base intacto fuera.
- **Vista Sato** (`#vSato`) — chat in-page ya existente (T4) con envoltorio móvil (`padding-top:56px`+`env(safe-area-inset-top)` por isla dinámica). **Orbe hero = el Orbe Persistente v2 REAL del CM reusado vía CSS dentro del `@media`, NO un orbe nuevo** (regla +51). Botón 🎙 dispara la ruta 📞 (voz full-duplex en la ventanita/PWA — T4 ratificado).
- **Vista HQ** (`#vHq`) — reusa `hqNumeros`: 4 tiles + retenciones con semáforo M3.
- **Ficha 360 como bottom-sheet** — mismo `.f360` cambia `top`/`transform` dentro del `@media`: sube desde abajo con `border-top-left-radius/right-radius`, handle superior, `max-height:92%`, scroll interno. Solapas → chips horizontales scrolleables.
- **Vista Correo→CRM móvil** — hoja `.sheetC` invocada desde el atajo (no ocupa slot del tabbar). Reusa `renderStg()`/`correoCandidatosStaging` del §2b.

**Componentes de UI nuevos** (aditivos al DOM, ocultos en escritorio con `display:none` fuera del media): `nav.tabbar`, `header.appbar`, `.funcbar`, `.atajos`, `.chips`, `.filtro-act`, `.hoy-foco`+`.hoy-tiles`, `.sato-hero`+`.bubble`+`.sug`+`.sato-in`, `.hq-tiles`+`.hq-line`.

**Reglas de comportamiento (móvil):**
- Orden de la Cartera: **vencida > fría (+30d) > resto**, luego por `dias_sin_contacto` desc. Función pura, sin backend.
- Búsqueda: filtra por `nombre` o `id_cliente` en cliente (ya viene todo cargado).
- Atajos: foco→`.foco` · venc→`esVencida` · frio→`esFrio` · correo→abre `.sheetC`.
- Presupuesto de señal: máx 2 badges (1 captación + 1 retención) — regla v2.
- Tap targets ≥44×44 CSS (WCAG 2.5.8), focus ring 2px, cero animación decorativa, `prefers-reduced-motion` respetado.
- `100dvh` (no `100vh`) en el shell fullscreen; `safe-area-inset` en tabbar y sheet.
- z-index dentro del `@media`: tabbar 35, scrim 45, sheet 46, modal 48.

**Anti-patrones a evitar:**
- NO crear un archivo aparte para móvil.
- NO condicionar por `navigator.userAgent`; sólo `@media`.
- NO tocar el CSS del orbe / CM / kanban fuera del `@media`.
- NO abrir el micrófono embebido en Sato móvil (iframe GAS lo bloquea; usa 📞).
- NO usar `localStorage` para persistir la pestaña móvil activa (regla de la maqueta: memoria en RAM). Si se persiste, `PropertiesService.getUserProperties()`.
- NO copiar el `status-bar` simulado del marco de la maqueta (es del framing, no del OS).


## §3 · VERIFICACIÓN (sin esto no hay "hecho")

0. **Eyeball móvil (nuevo, 27-ago):** abrir `/dev` desde el iPhone real de Luciano (o DevTools iPhone 14 Pro 393×852): recorrer las 4 pestañas (Hoy/Cartera/Sato/HQ) + búsqueda + un atajo (ej. Vencidas) + abrir/cerrar Ficha-hoja + confirmar 1 thread de correo. Sin esto no hay "hecho" en móvil.
1. **Offline:** `node _harness.js` en verde con asserts nuevos: sello idempotente de contacto ·
   `dias_sin_contacto` server-side · rechazo de perdido sin motivo · recontacto setea fecha+acción ·
   tope 10 de staging · thread confirmado sella contacto · aislamiento: thread de A no aparece en
   ficha de B (🔒) · señal retención con fuente ausente = null, no rojo · forma de retorno de
   `carteraPipeline` retro-compatible. `python3 _verificar_index.py` OK. `node --check` de módulos.
2. **En vivo (editor GAS):** `setup()` (materializa columnas y hoja lazy) → `selfTest` 5 tramos →
   `selfTestVeredicto` CERTIFICADO → `limpiarTodoTest` (LECCIÓN +45). Asserts D46 nuevos para los
   endpoints CRM Pro que tocan Sheets (salda también la deuda D45-live declarada en la purga de la
   tanda base — LECCIÓN +46: el harness offline no ejercita Sheets).
3. **Eyeball `/dev`** (guion): tiles+foco → card activa con semáforo → ficha: registrar contacto →
   staging: confirmar 1 thread real → ver el link en la timeline → perder un frío con motivo +
   recontacto → verificar la línea nueva del brief. Con Luciano delante.
4. **Promote:** SOLO Luciano (`bash _promote_exec.sh --go`). Actualizar HANDOFF.md del repo A MANO
   en el cierre (LECCIÓN +47: el script no lo toca).

## §4 · RIESGOS AGUAS ABAJO (pensamiento paralelo — vigilar al codear)

- Asserts D44a2/cola de `Clientes` — 2 columnas nuevas los rompen si no se actualizan juntos.
- `Correo_visto` compartido entre uso Bandeja (T7) y uso CRM (M2) — decidir y documentar si el
  dedupe es común o por destino.
- `carteraPipeline` la consumen la vista Cartera Y el front móvil Y (vía fuente `cartera`)
  Sato — campos aditivos sí, cambios de forma no. `anonimizar()` debe cubrir los campos nuevos.
- D19c cuenta endpoints — sube con cada alta en `ENDPOINTS_UI`.
- **Móvil (27-ago):** (a) stacking del orbe y del panel Sato in-page vs la nueva tab bar (`z-index`: tabbar 35, scrim 45, sheet 46, modal 48); (b) `safe-area-inset` en el iPhone con isla dinámica (`padding-top:56px+env(safe-area-inset-top)` en `.appbar`; `padding-bottom:22px+env(safe-area-inset-bottom)` en `.tabbar`); (c) doble scroll (body vs `.scroll` de la Ficha-hoja: bloquear `overflow:hidden` en `body` al abrir sheet via `.sheet-open`).
- - `_senalRetencion_` no debe duplicar la corrida de vigilancia (leer su resultado cacheado, no
  re-consultar Sheets de cliente por card — cuidar el tiempo de `carteraPipeline`).

## §5 · DATOS QUE CARGA LUCIANO (no bloquean el código)

- Monedas: CLI-002 ARS · CLI-003 ARS · CLI-004 EUR (columna de Config/Clientes según convención).
- `encaje_kairos_4b` de los 4-5 tibios maduros (desde la UI nueva o el Sheet).
- URLs `url_exec_cliente` de DAM/LC/Vehemence (cabo arrastrado del 18-ago).

## §6 · CIERRE DEL ENCARGO

`bash _inventario_cierre.sh` + formato **CIERRE: incluye X · QUEDA ABIERTO: Y** + HANDOFF.md del
repo actualizado en el mismo paso. Purga de Cowork sobre la tanda antes del promote. Jamás
«cerrado» sin barrido de cabos.

---
*Cowork · 25/08/2026 · aprobado por Luciano (tanda única, correo_on ON, semáforo reusa vigilancia).
Referencias en el repo: MAQUETA-CRM-PRO-v2.html · PROPUESTA-CRM-PRO-2026-08-25.md ·
MAQUETA-CRM-PIPELINE-v1.html (base ya implementada).*
