# `_edificio/` — cómo se portó el Edificio a la escena de Akasha

`src/edificio.html` son ~320KB **generados**, no escritos. Acá está el generador, para que el
injerto se pueda auditar y rehacer — mismo criterio que `_akasha_e3/` con el port de E3.

## Fuente de verdad
`AKASHA-EDIFICIO-v4.html` (raíz) **es la maqueta**: se porta, no se rediseña.
Contrato: `ENCARGO-CODE-EDIFICIO-integracion-Akasha-2026-08-10.md` +
`ADENDA-ENCARGO-EDIFICIO-una-sola-escena-2026-08-10.md` (la adenda manda: **una sola escena, sin
toggle** — el Edificio ES el Akasha nuevo, colgado debajo del orbe).

## El pipeline
```bash
bash _gen_edificio.sh      # extraer → ensamblar → verificar index → harness
```
1. **`extraer.py`** — corta de v4 lo reusable y lo transforma:
   - **CSS**: `:root` → `#ediRoot` (los tokens no se filtran al CM) y las 72 clases se prefijan
     `e-`. **24 ya existían en `index.html`** (`.panel .card .scrim .toast .dir .logo .st .kpi …`):
     sin prefijar, el módulo le pisaba el CSS al Centro de Mando. El scopeado es **recursivo**:
     las reglas dentro de `@media` también, o `.dir`/`.hint`/`.prov` se escapaban justo en móvil.
   - **IDs** → `edi*` (menos `#gl`, que es el canvas compartido y no lo crea el módulo).
   - **Descarta** lo que Akasha ya pone: renderer, escena, cámara, domo, luces base, listeners de
     input, y **el universo de demo de v4** (la cartera real la dibuja `listaClientes`; duplicarla
     sería inventar una segunda cartera al lado de la verdadera). Del universo solo sobrevive el
     haz conector.
2. **`ensamblar.py`** — pega las partes dentro del envoltorio que se engancha a `window.__AK_EXT`.
   Ahí viven las tres cosas que no son un corte: la **escala** (v4 dibuja ~5.7× más grande que
   Akasha), la **cámara** (se conduce el `nav` de Akasha con `ovY`, no hay un segundo sistema) y
   el **merge con `flotaEstado`**.

## El seam
`__AK_EXT` es la única costura abierta en `__buildAkashaEngine` (`src/index.html`). Presta el
motor, no lo entrega: `addGroup` · `onFrame` · `addHits`/`onPick`/`onHover` · `setRenderHook` ·
`navOverview` · `clientes()` · `rpc()`. Los dos invariantes del gate E2 se cumplen **por
construcción**: el renderer del `#gl` es del engine, y hay un solo loop (por eso se ofrece
`onFrame` y no un `requestAnimationFrame` propio).

## Verificación
`node _akasha_e3/harness.js` — sección **E · EDIFICIO**. Corre el módulo contra THREE r128 real y
el motor real: torre construida (8 plantas / 68 agentes / 76 hits), merge de `flotaEstado` pisando
el roster estático, aislamiento del payload, navegación y teardown sin grupos residuales.
La capa server (`32_flota.js`) se verifica en `node _harness.js`, sección **E**.

**Lo que ningún harness certifica**: cómo se ve. El encuadre de la torre bajo el orbe es eyeball de
Luciano en `/dev`, con el afinador en vivo `ediEncuadre(k, techo)` en la consola (mismo contrato
que `akEncuadre`: devuelve los números para pegarlos al código).
