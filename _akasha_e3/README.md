# _akasha_e3 — cómo se portó la Oficina a `src/index.html`

E3 metió ~1.700 líneas en un `index.html` de 600KB. No se hizo a mano: se hizo con
estos scripts, y por eso se puede **auditar y rehacer**. El injerto YA ESTÁ APLICADO
(commit de E3) — esto es el registro de cómo, y el harness que lo verifica.

## Fuente de verdad
`AKASHA-prototipo-E113.html` (raíz) **es la spec**: se porta, no se rediseña.
Contrato de integración: `ENCARGO-CODE-AKASHA-E2E3-2026-07-16.md` + `ADENDA-E3-2026-07-17.md`.

## El pipeline
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
curl -sO https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js   # → three.r128.min.js
node harness.js        # verde = adaptador y motor construyen; 5 toggles limpios
```
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
