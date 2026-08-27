# HANDOFF · CRM PRO — Módulo MÓVIL (iPhone) — 27/08/2026

DEPLOY-PENDIENTE: no — es maqueta de decisión, NO tocó código de prod.
PRÓXIMO PASO: en la conversación donde se arma el ENCARGO grande de Satori OS, PEGAR el bloque `§2d.MOBILE` de este handoff (Anexo A) dentro del `ENCARGO-CODE-CRM-PRO-2026-08-25.md` a continuación del `§2d · Frontend`. Sin re-abrir maqueta ni re-decidir arquitectura: la dirección está aprobada (26-ago, en esta sesión) y la referencia visual es `MAQUETA-CRM-PRO-MOBILE-v1.html` en la raíz del repo.

## Estado vigente

Módulo MÓVIL del CRM Pro: re-adaptación INTEGRAL para iPhone de la maqueta v2 (ya aprobada). Registro **OPERATIVO (A)**, breakpoint único **≤640px**, misma `src/index.html` — nada de PWA aparte ni branch, nada de tocar el escritorio (≥641px). Aprobado por Luciano en la sesión del 26-ago tras ver la maqueta funcional y la explicación de convivencia. Confianza **9/10** en no-interferencia (el 10º punto es el eyeball humano en `/exec` post-construcción). No hay código escrito todavía — este handoff es la puerta para que el ENCARGO grande absorba el módulo sin re-litigar.

Piezas del móvil, todas dentro del mismo `@media (max-width:640px)` de `src/index.html`:
- Tab bar inferior de 4 (Hoy · Cartera · Sato · HQ) — nueva.
- Barra de funciones (búsqueda + botón "+ Nuevo") + fila de atajos (Foco · Vencidas · Fríos +30d · Correo→CRM) — nueva.
- Cartera: kanban → lista vertical ordenada por urgencia (ya en prod desde @55; el módulo lo extiende con búsqueda/atajos/chips).
- Ficha 360: modal centrado → hoja (bottom-sheet) — reordenamiento CSS del `.f360` existente.
- Vista Correo→CRM: sección → hoja invocada desde el atajo.
- Sato: chat + brief embebido; la voz full-duplex sigue en 📞/PWA (iframe bloquea micrófono — decisión ya documentada).

### Verificado
- [27-ago-2026] Maqueta HTML integral construida y probada — evidencia: Playwright a 393px y a 1120px, 0 errores JS, 8 screenshots inspeccionados (Cartera, Ficha-hoja, Sato corregido, Hoy, Convivencia, iPhone-full, filtro Vencidas, HQ). Purga adversarial encontró un bug (pestaña Sato tapada por status bar) y se corrigió en la misma sesión.
- [27-ago-2026] La maqueta está guardada en el repo del proyecto — evidencia: `device_commit_files` OK a `~/Documents/Claude/Projects/SatoriOS/MAQUETA-CRM-PRO-MOBILE-v1.html` (55 KB).
- [27-ago-2026] Regla de no-interferencia con el escritorio validada por diseño y por Playwright — evidencia: mismo HTML renderiza kanban a 1120px y lista+tabbar+sheet a 393px, sin duplicar DOM ni tocar clases base fuera del `@media`.
- [pre-existente, @55] La prod ya reordena la lista por urgencia bajo 640px (vencida > fría > resto) — evidencia: memoria `[[satori-os]]` + `[[crm-pipeline]]`.

### No verificado
- Cómo se ve el módulo móvil sobre `src/index.html` real (la maqueta usa tokens copiados del `:root` de prod, pero no se probó en el DOM real — puede haber colisiones de z-index, del stacking del CM, del orbe, o del panel de Cartera).
- Que el `@media (max-width:640px)` propuesto no rompa el kanban HORIZONTAL de escritorio (la maqueta lo prueba en un HTML aislado — falta el mismo test dentro del index real).
- Comportamiento en Safari iOS real (Playwright usa Chromium; hay que probar tap targets, safe-area-inset, `100dvh` vs `100vh`, y el behavior del bottom sheet con la barra inferior del navegador).
- Que Sato responda embebido en el móvil sin abrir la ventana (regla T4: cero ventanas por defecto — hoy Sato in-page ya cumple).
- El atajo "Correo→CRM" contra el endpoint real de M2 (aún no existe: es parte del ENCARGO grande).

## Pendiente

**Must (para el ENCARGO grande absorba el módulo):**
- Insertar el bloque `§2d.MOBILE` (Anexo A) en `ENCARGO-CODE-CRM-PRO-2026-08-25.md` justo debajo del actual `§2d · Frontend`. No reescribir el resto del encargo: es aditivo.
- Actualizar la línea del móvil ya presente en `§2d` ("orden por urgencia (vencida > fría > resto) + señales M1/M3 en la card (la maqueta ③)") con un puntero al Anexo A.
- Sumar a `§3 · VERIFICACIÓN` el paso `Eyeball móvil`: abrir `/dev` desde el iPhone real de Luciano (o DevTools iPhone 14 Pro 393×852), recorrer las 4 pestañas + búsqueda + un atajo + abrir/cerrar Ficha + confirmar 1 thread de correo. Sin esto, no hay "hecho" en móvil.
- Sumar a `§4 · RIESGOS AGUAS ABAJO`: (a) el stacking del orbe y del panel Sato in-page vs la nueva tab bar (`z-index`); (b) safe-area-inset en el iPhone con isla dinámica; (c) doble scroll (body vs `.scroll` de la Ficha-hoja).

**Should:**
- Cross-reference desde `HANDOFF.md` maestro del repo (una línea en su sección viva): "Módulo móvil CRM Pro: ver `HANDOFF-2026-08-27-CRM-PRO-MOBILE-modulo-integracion.md` + `MAQUETA-CRM-PRO-MOBILE-v1.html`."
- Que Code, al implementar, agregue una regla `@media (max-width:480px)` para el status-bar simulado NO se aplique (es del marco de la maqueta, no del OS) — sólo relevante si Code copia CSS de la maqueta sin filtrar.

**Nice:**
- Extender `_verificar_index.py` con un check simple: "existe un único bloque `@media (max-width:640px)` y no hay reglas mobile fuera de él" — evita futura fuga de estilos.
- Probar la maqueta como PWA-C (fase 0 de `[[pwa-c]]`) para adelantar el fix definitivo de la voz full-duplex — no es parte del ENCARGO, es el eslabón siguiente.

## Artefactos

| Tipo | Nombre | Ruta / ID / URL |
|---|---|---|
| Maqueta funcional | CRM Pro móvil v1 | `~/Documents/Claude/Projects/SatoriOS/MAQUETA-CRM-PRO-MOBILE-v1.html` |
| Maqueta base aprobada (v2 escritorio) | CRM Pro v2 | `~/Documents/Claude/Projects/SatoriOS/MAQUETA-CRM-PRO-v2.html` |
| Encargo destino | ENCARGO grande CRM Pro | `~/Documents/Claude/Projects/SatoriOS/ENCARGO-CODE-CRM-PRO-2026-08-25.md` |
| Propuesta justificatoria | Propuesta CRM Pro | `~/Documents/Claude/Projects/SatoriOS/PROPUESTA-CRM-PRO-2026-08-25.md` |
| Purga adversarial base | Purga CRM Pro | `~/Documents/Claude/Projects/SatoriOS/PURGA-CRM-PRO-2026-08-26.md` |
| Handoff maestro del proyecto | HANDOFF vivo | `~/Documents/Claude/Projects/SatoriOS/HANDOFF.md` |
| Archivo objetivo de código | index.html del OS | `~/Documents/Claude/Projects/SatoriOS/src/index.html` |
| Deployment prod referencia | `/exec` @55 | (memoria `[[satori-os]]`) |
| Este documento | Handoff módulo móvil | `~/Documents/Claude/Projects/SatoriOS/HANDOFF-2026-08-27-CRM-PRO-MOBILE-modulo-integracion.md` |

## Desvíos del plan original

- El plan (línea única en `§2d` del encargo del 25-ago): "Móvil: orden por urgencia (vencida > fría > resto) + señales M1/M3 en la card (la maqueta ③)". El desvío es en **alcance**, no en **decisión**: la re-adaptación resulta ser INTEGRAL, no sólo la Cartera. La maqueta ③ mostraba una única pantalla; el módulo real incluye barra de funciones + atajos + 4 pestañas + Ficha-hoja + Correo→CRM móvil. Justificación: el móvil sin las 4 pestañas navegables ni la Ficha adaptada es un CRM Pro parcial (Luciano no puede operar el ciclo completo desde el iPhone).
- No hay desvío arquitectónico: sigue siendo el mismo `src/index.html`, mismos tokens, mismo backend. Todo lo nuevo del módulo vive dentro del `@media (max-width:640px)` + adiciones aditivas al DOM (tab bar oculta en escritorio con `display:none` fuera del media query).

---

## Anexo A · Bloque `§2d.MOBILE` — insertar tal cual en el ENCARGO grande

### §2d.MOBILE · Frontend móvil (iPhone) — reproducir `MAQUETA-CRM-PRO-MOBILE-v1.html`

**Regla dura de no-interferencia (Confianza 9/10, validada 27-ago):**
1. **TODO lo móvil dentro de un único `@media (max-width:640px)`** en `src/index.html`. Ni una regla mobile toca las clases base fuera del media query. Si algo tiene que verse distinto en el teléfono, se sobreescribe adentro; jamás afuera.
2. **Mismo DOM, no se borra nada.** El teléfono esconde/reordena con CSS (`display`, `order`, `position`), nunca quita nodos. El escritorio sigue con todas sus piezas.
3. **Mejora progresiva.** Tab bar y bottom-sheet existen sólo bajo el breakpoint (`display:none` por defecto, `display:flex` dentro del `@media`). El orbe, la Akasha y el kanban existen sólo por encima (o son mostrados con transformaciones dentro del media, si conviene).

**Piezas a portar** (fidelidad visual y de comportamiento a la maqueta v1):

- **Tab bar inferior** (`.tabbar`) — 4 botones: Hoy · Cartera · Sato · HQ. `position:fixed;bottom:0` con safe-area-inset-bottom, min-height 52px, tokens `--_terra-300` para activo. Sólo visible ≤640px. Al tocar, muestra/oculta las 4 vistas: `#vHoy`, `#vCartera`, `#vSato`, `#vHq`.
- **Vista Hoy** (nueva sección `#vHoy`) — foco de la semana aceptable (regla F3), 4 tiles KPI, lista de urgentes ordenados por `orden_urgencia`. Reusa `_carteraLineasBrief_` como fuente.
- **Vista Cartera** (`#vCartera`) — reordena las piezas ya existentes: header, barra de funciones (búsqueda con `input[type=search]` sobre `carteraPipeline`, botón "+ Nuevo"), atajos (4 tarjetas con contador), chips de etapa, banner de filtro activo, lista vertical (`.cartera-cols{display:block}` dentro del media), cards con presupuesto de señal máx 2. Sin tocar el kanban base (`.cartera-cols` fuera del media sigue `flex`).
- **Vista Sato** (`#vSato`) — chat in-page ya existente (T4), aquí sólo se le da envoltorio móvil (padding-top 56px por la isla dinámica, **orbe hero = el Orbe Persistente v2 REAL del CM reusado vía CSS dentro del `@media`, NO un orbe nuevo**; el círculo naranja de la maqueta es placeholder), sugerencias, input + mic. El botón 🎙 no intenta capturar audio embebido: dispara la ruta 📞 (voz full-duplex vive en la ventanita/PWA — decisión T4 ratificada).
- **Vista HQ** (`#vHq`) — reusa `hqNumeros`: 4 tiles + líneas de retenciones activas con el semáforo M3 reusado.
- **Ficha 360 como bottom-sheet** — SOLO en móvil: el mismo `.f360` existente cambia `top`/`transform` dentro del `@media` para subir desde abajo con `border-top-left-radius/right-radius`, handle superior, `max-height:92%`, scroll interno. Solapas se vuelven chips horizontales scrolleables.
- **Vista Correo→CRM móvil** — hoja invocada desde el atajo (`.sheetC`), no ocupa slot del tabbar. Reusa `renderStg()`/`correoCandidatosStaging` del §2b.

**Componentes de UI nuevos** (aditivos al DOM, ocultos en escritorio con `display:none` fuera del media):
- `nav.tabbar` (4 botones con `data-t="Hoy|Cartera|Sato|Hq"`)
- `header.appbar` (dentro de cada vista móvil)
- `.funcbar` (search + botón nuevo) — Cartera
- `.atajos` (4 tarjetas horizontales scrolleables) — Cartera
- `.chips` (etapa con contador) — Cartera
- `.filtro-act` (banner de filtro activo con `×` para limpiar) — Cartera
- `.hoy-foco` + `.hoy-tiles` — Hoy
- `.sato-hero` + `.bubble` + `.sug` + `.sato-in` — Sato
- `.hq-tiles` + `.hq-line` — HQ

**Reglas de comportamiento (móvil):**
- Orden de la Cartera: **vencida > fría (+30d sin contacto) > resto**, luego por `dias_sin_contacto` desc. Función pura, sin tocar backend.
- Búsqueda: filtra por `nombre` o `id_cliente` en cliente (ya viene todo cargado en `carteraPipeline`).
- Atajos: (foco → filtra `.foco`) · (venc → filtra `esVencida`) · (frio → filtra `esFrio`) · (correo → abre `.sheetC`).
- Presupuesto de señal en card: máx 2 badges visibles (1 de captación + 1 de retención). Regla ya en v2.
- Tap targets ≥44×44 CSS (WCAG 2.5.8), focus ring 2px, cero animación decorativa, `prefers-reduced-motion` respetado.
- `100dvh` (no `100vh`) en el shell si es fullscreen; safe-area-inset en tabbar y sheet.

**Anti-patrones a evitar** (purga preventiva):
- NO crear un archivo aparte para móvil.
- NO condicionar por `navigator.userAgent`; sólo `@media`.
- NO tocar el CSS del orbe / CM / kanban fuera del `@media`.
- NO abrir el micrófono embebido en Sato móvil (iframe GAS lo bloquea; usa 📞).
- NO usar `localStorage` para persistir la pestaña móvil activa (regla de la maqueta: memoria en RAM). Si se persiste, PropertiesService.getUserProperties() por usuario.

**Verificación específica** (agregar a §3 del ENCARGO):
- Playwright headless a 393×852 sobre `/dev` con eyeball manual: recorrer las 4 pestañas, buscar "Vehe", abrir Ficha desde la primera card, registrar contacto, cerrar hoja, filtrar por atajo Vencidas, abrir Correo→CRM y confirmar 1 thread.
- Chequear que **el escritorio (`/dev` a 1440×900) queda idéntico** al @55: comparar screenshot del CM y de la Cartera antes/después del deploy. Diff visual = 0 fuera del área nueva.
- Assert nuevo (opcional pero recomendado): grep en `src/index.html` de que hay exactamente **un** `@media (max-width:640px)` en el bloque `<style>` y ninguna regla mobile fuera de él.

## Anexo B · Riesgos aguas abajo (sumar a §4 del ENCARGO)

- **Stacking del orbe / panel Sato in-page vs la nueva tab bar.** Hoy el orbe tiene `z-index` alto y la voz vive en un panel in-page. La tab bar es `position:fixed;bottom:0` y necesita `z-index` mayor que las secciones pero menor que scrims/modales. Definir la escala en el `@media`: tab bar 35, scrim 45, sheet 46, modal 48.
- **Safe-area-inset (isla dinámica y barra inferior de iOS).** Padding-top 56px+env(safe-area-inset-top) en `.appbar`; padding-bottom 22px+env(safe-area-inset-bottom) en `.tabbar`.
- **Doble scroll.** El `.f360` como sheet tiene scroll interno; el body no debe scrollear detrás. Bloquear `overflow:hidden` en `body` al abrir sheet (`.sheet-open` en `body`).
- **100vh vs 100dvh.** Preferir `100dvh` para el shell móvil; fallback `100vh` con `@supports`.
- **Colisión con `[[sato-integridad-datos]]`.** Los atajos móviles NO deben propagar campos nuevos a la fuente `cartera` de Sato hasta que Luciano tome la decisión pendiente. Igual regla que §4 base del encargo.

## Anexo C · Estructura CSS mínima del `@media` (guía)

```css
/* fuera del @media: escritorio SIN CAMBIOS. Reglas nuevas SÓLO adentro. */
.tabbar,.sheetC,.appbar,.funcbar,.atajos,.chips,.filtro-act,.hoy-foco,.hoy-tiles,
.sato-hero,.bubble,.sug-row,.sato-in,.hq-tiles,.hq-line{display:none}

@media (max-width:640px){
  /* shell iOS */
  .cm, .akasha, .cartera-h .sp{display:none}     /* piezas del CM que no van al móvil */
  .cartera-cols{display:block; overflow:visible} /* kanban → lista */
  .cartera-col{flex:none; margin-bottom:14px}
  .cartera-col > h6{display:none}                /* el header de columna sobra en lista */

  /* piezas nuevas del móvil, ahora VISIBLES */
  .tabbar,.appbar,.funcbar,.atajos,.chips{display:flex}
  .hoy-tiles,.hq-tiles{display:grid}
  .hoy-foco,.hq-line,.bubble{display:block}

  /* Ficha como bottom sheet */
  .f360{top:auto; bottom:0; left:0; right:0; transform:translateY(100%);
        border-top-left-radius:26px; border-top-right-radius:26px;
        max-height:92%; width:100%; transition:transform .24s}
  .f360.on{transform:translateY(0)}
  .f360-tabs{display:flex; overflow-x:auto; gap:6px}
  .f360-tab{border-radius:9999px; border:1px solid var(--color-border)}

  /* z-index: tabbar 35, scrim 45, sheet 46, modal 48 */
}
```

---

## Apéndice histórico

### Decisiones y descartes
- Decidido (26-ago): **re-adaptación INTEGRAL** para móvil (4 pestañas vivas + Ficha-hoja + barra de funciones + atajos) — porque un CRM Pro parcial en el bolsillo no cierra el ciclo comercial.
- Decidido (26-ago): **un solo `src/index.html` con `@media (max-width:640px)`** — porque preserva el escritorio con Confianza 9/10 y evita duplicar mantenimiento. Explicado a Luciano en el modo "Convivencia con escritorio" de la maqueta.
- Decidido (26-ago): **Sato móvil sin micrófono embebido** — el iframe GAS bloquea `getUserMedia`; el 🎙 dispara la ruta 📞/PWA. Regla T4 ratificada. Fix definitivo (voz full-duplex embebida) queda a `[[pwa-c]]`.
- Descartado (26-ago): PWA aparte SÓLO para el móvil — dupplica mantenimiento y no aporta sobre el `@media` para el 90% de los casos. La PWA-C sigue viva como fix independiente para la voz.
- Descartado (26-ago): `localStorage` para persistir la pestaña activa del móvil — regla de la maqueta: memoria en RAM. Si se persiste, `PropertiesService.getUserProperties()`.
- Descartado (26-ago): app nativa iOS/Android — desalineado con la arquitectura GAS del OS y sin retorno para 20 clientes.
- Descartado (26-ago): reordenar pestañas por `navigator.userAgent` — no es mobile-detection: es responsive por ancho.

### Imprevistos y resolución
- [27-ago-2026] La pestaña Sato tenía padding-top insuficiente y quedaba tapada por la isla dinámica en la maqueta → subí a `padding:56px 16px 20px` en `.sato` → lección: en shells iOS simulados, TODA vista debajo de la status bar necesita `padding-top` explícito ≥52px, no confiar sólo en el `.appbar` (Sato no tiene appbar).

### Changelog del handoff
- [27-ago-2026] Módulo MÓVIL del CRM Pro cerrado a nivel maqueta y arquitectura. Listo para integrarse al ENCARGO grande de la conversación paralela. No hubo código de prod tocado.

