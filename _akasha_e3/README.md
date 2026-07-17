# _akasha_e3 — cómo se portó la Oficina a `src/index.html`

E3 metió ~1.700 líneas en un `index.html` de 600KB. No se hizo a mano: se hizo con
estos scripts, y por eso se puede **auditar y rehacer**. El injerto YA ESTÁ APLICADO
(commit de E3) — esto es el registro de cómo, y el harness que lo verifica.

## Fuente de verdad
`AKASHA-prototipo-E113.html` (raíz) **es la spec**: se porta, no se rediseña.
Contrato de integración: `ENCARGO-CODE-AKASHA-E2E3-2026-07-16.md` + `ADENDA-E3-2026-07-17.md`.

## E3.7 — boot en 2 tiempos (esta tanda)

El harness ahora también verifica E3.7 (lee `src/index.html` en vivo):
- **A** esqueleto-primero: el motor se construye con DATA vacío ANTES del server (0ms).
- **B** 2 olas paralelas: universo (`bootUniverso`) puebla ANTES que docks (`bootResto`); `RESTO_MS` simula que bootResto (con estadoSalud) es más lento.
- **C** snapshot warm (localStorage, TTL 10min): 2ª entrada pinta sin esperar server.
- **D17j** `engine.poblar` idempotente: 2×/3× no duplica meshes (hook `_counts()`).

D17i (fail-closed de bootUniverso/bootResto) vive en `selfTestF2` (server). D17j vive
ACÁ porque necesita Three+DOM. Correr: `node harness.js` (verde = A+B+C+D17j+toggles).

## ⚠️ El injerto ya ocurrió: `index.html` es la fuente de verdad

`scope_css.py` / `patch_engine.py` / `splice.py` son el **registro histórico** de cómo
entró el port (E3, commit `26f3e3a`). **NO los vuelvas a correr**: `splice.py` reconstruye
desde el backup pre-E3 y te **borraría los fixes de E3.1** (que se aplicaron sobre
`index.html`, no sobre las fuentes del scratchpad):

- **BUG A** — `#akasha` se movió FUERA de `#centro` + la regla de maniquíes del boot.
- **BUG B** — segunda ola del Cerebro (`cargarCerebros`, `refrescarNucleo`).
- **BUG C** — el bloque de estilos tardío, reparado.

Lo único vivo y re-corrible acá es **`harness.js`** (lee `index.html` en vivo).

## El pipeline (histórico)
1. **`scope_css.py`** — CSS del prototipo → scopeado bajo `#akasha`.
   `:root{}` → `#akasha{}` (los tokens quedan confinados: no se filtran al CM) ·
   `@keyframes pulse` → `akPulse` (**el CM ya define `pulse`; los keyframes son
   globales** — sin renombrar, uno pisaba al otro) · descarta `.galaxy/.photobg/#veil`
   (se reusa el fondo del CM: **439KB → 22KB**, el photobg no se duplica) y el
   `#despacho` mock (el Despacho real es el CM).
2. **`patch_engine.py`** — motor E113 → motor E3. 16 parches **por match exacto**
   (si un ancla no matchea, **aborta**: nunca falla en silencio). Saca el mock y
   mete el dato real; el motor no habla con GAS, recibe `H.acc` del boot.
3. **`splice.py`** — injerta CSS+DOM+JS en `src/index.html` reemplazando el spike E2.
   Anclas exactas, nunca números de línea. Verifica que **no sobreviva** el andamio
   (`akBuild_`, `akGl`, `akHud`…) y que **sí sobrevivan** los invariantes
   (`!(AK&&AK.on)`, `window.AK = AK`, el `<script>` r128 del CM).
4. **`harness.js`** — la verificación que importa. Corre el **código REAL extraído de
   `index.html`** contra el **build r128 REAL** (bajado del CDN, SRI verificado contra
   el `<script>` del CM), con DOM y renderer stubbeados y payloads GAS con el shape
   documentado del MAESTRO. Prueba adaptador + construcción del motor + **5 toggles**
   + teardown (`dispose`/`forceContextLoss`).

## Correrlo
```bash
cd _akasha_e3
curl -so three.r128.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
node harness.js                  # verde = adaptador + motor + 5 toggles + segunda ola
LENTO_MS=14000 node harness.js   # cerebroGrafo que nunca contesta: prueba el timeout
```
`LENTO_MS` simula lo que tarda `cerebroGrafo` por Espacio (default 3000ms). El harness
verifica que el universo se construya **sin esperarlo** (BUG B): si vuelve a bloquearse,
el tiempo de construcción se dispara y da rojo. Con `LENTO_MS` por encima del timeout
(12s) todos los cerebros fallan: la Oficina tiene que quedar entera igual, con el Núcleo
sin constelación — ahí el rojo es de la aserción (espera 11 nodos), no del producto.
El harness lee `src/index.html` en vivo: **corrélo después de tocar Akasha.**

## Lo que el harness NO prueba
**fps y render reales** (renderer stubbeado, sin GPU). Eso es el gate de Luciano en
`/dev` — el CM no es auto-screenshoteable (iframe cross-origin). El harness caza
excepciones y contratos de datos rotos, que es donde se cae el 90% de un port así:
de hecho cazó 2 fugas de id mock del prototipo (`estaciones['sato']`, `c.id==='ov'`)
que se caían con datos reales.

## Invariantes (vienen del gate E2 — no tocar sin re-medir)
1. Renderer **propio** (`#gl`). Jamás comparte el del orbe (`cm3D.renderer`).
2. **Un solo loop de render a la vez**: `cmLoop` saltea su *cuerpo* mientras `AK.on`.
   La cadena de rAF **nunca se corta** → el orbe del CM retoma solo al salir. Por eso
   `AK` vive en `window` (la guardia lo lee como global) y por eso **no** se pausa
   cancelando el rAF.
3. Salida = `dispose` + `forceContextLoss` + `canvas.replaceWith` (límite de contextos WebGL en iOS).
4. Fail-closed: sin THREE / sin WebGL / reduced-motion → **Vista Plana**, nunca pantalla negra.
5. **Un solo Three**: el r128 UMD que ya carga el CM (decisión E2/A). No se carga un segundo.

## Regla dura de datos
**Mock jamás en el CM real.** Si una fuente falla, la sección queda **vacía con aviso
discreto** — nunca un número inventado (`pedir()` resuelve por fuente: una caída no
tumba la Oficina). Cero endpoints nuevos: las 15 funciones de la matriz ya existían.
