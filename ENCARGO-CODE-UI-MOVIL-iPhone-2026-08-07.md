# ENCARGO CODE — UI móvil iPhone (Satori OS) — 07/08/2026 · v3

> **v3 (tras 2º eyeball de Luciano en /dev):** portrait ya quedó bien (v2 Akasha vivo). Esta ronda: **landscape**, **Sato no-auto-abre**, e **ícono/metas** (best-effort). **Hay CSS + JS + `<head>` nuevos → re-diff + clasp push otra vez.**

## Cambios de v3 (diff vs último push = 3 hunks, 11 líneas +, 3 −)
1. **HEAD (línea ~7):** metas móviles + `apple-touch-icon`/`icon` (isologo Satori, PNG base64 180×180) + `theme-color:#0b0806` + `apple-mobile-web-app-*`.
2. **Media query (línea ~1194):** `@media (max-width:600px)` → `@media (max-width:600px), (max-height:520px) and (max-width:960px)`. **Extiende TODA la capa móvil al landscape de teléfono** (alto ≤520 y ancho ≤960 = iPhone apaisado; el desktop 1440×900 no entra → intacto).
3. **`fichaCargar_` (línea ~3786):** el `satoPanel_(true)` incondicional (v3 28-jul "Sato siempre presente") pasa a **gated**: `if(#f360Sato.classList.contains('open')) satoPanel_(true)`. Abrir un cliente ya **NO** auto-abre Sato; se despliega con su botón △. Si el cajón ya estaba abierto (cambio de cliente), se re-titula/recarga igual.

## Qué resuelve (medido por render)
- **Landscape** (antes: docks del Atril pisados + marca "Akasha" partida en 3 líneas + márgenes): ahora **columna única scrolleable**, topbar en 1 fila, sin superposición. Verificado a **844×390 y 932×430**: `overlap:false`, dock-left/right apilados; CM cockpit idem (constelación centrada, entra).
- **Sato**: verificado por JS con `EN_GAS=true` + `fichaAbrir('CLI-001')` → `#f360Sato.open == false` (no auto-abre); botón △ lo abre; cambiar de cliente con el cajón abierto lo mantiene. 0 errores de página.

## Ícono y barra blanca — LÍMITE DE GAS (honesto)
Agregué los metas correctos, PERO en un web app de Apps Script **el `<head>` que ve iOS es el de la página EXTERIOR de Google** (`script.google.com`), no el nuestro — nuestro HTML corre en un iframe (`*.googleusercontent.com`). Por eso:
- **Ícono de home-screen:** iOS seguirá mostrando la "S" (primera letra del title). Nuestro `apple-touch-icon` vive en el iframe → iOS no lo lee. Además `apple-touch-icon` con data-URI es poco fiable en iOS.
- **Barra de estado blanca:** la colorea la página exterior de Google (Safari la samplea de ahí), no nuestro `theme-color`.
- **Solución real (otra tarea):** servir el **shell del front por dominio propio** (Netlify/CF Worker, como el Taller) que llame a GAS como API. Ahí sí controlamos `<head>`, ícono, `manifest.json` y `display:standalone`. Es un cambio de arquitectura, no un "emprolijar".
- Los metas quedan igual: correctos y sin costo, y funcionan el día que se migre el hosting.

## Verificación (Cowork, render headless Chromium)
- **Landscape 844×390 / 932×430** + **portrait 375/390/430**: sin overlap, columnas apiladas, topbars OK.
- **Desktop 1440×900:** baseline vs v3 = **0 px** en las 5 capas (reduced-motion). Todo lo nuevo de CSS vive en el media query móvil/landscape.
- **Sato gate:** probado con la ruta real (`EN_GAS=true`).
- CSS+JS puro de UI → `selfTest`/`_harness.js` sin tocar (igual conviene correr selfTest tras push).

## Deploy (v3)
1. `.git/index.lock` (Luciano) → commit pendientes + esto.
2. **Diff GAS↔repo** — delta esperado = 3 hunks (head, media query, fichaCargar_).
3. `clasp push`.
4. `selfTest()` → verde igual.
5. **Eyeball Luciano /dev iPhone**: portrait + **landscape** (Akasha Atril → columna única; CM cockpit; Ficha; Sato). Abrir un cliente → **la ficha abre sola, sin Sato** → tocar △ Sato → se despliega.
6. OK → `git push` + `_promote_exec.sh` → @38.

## Rollback
Todo el móvil/landscape = el bloque `@media (...){…}` al final del `<style>`. El gate de Sato = 1 línea (3786). Los metas = head. Desktop nunca se toca.
