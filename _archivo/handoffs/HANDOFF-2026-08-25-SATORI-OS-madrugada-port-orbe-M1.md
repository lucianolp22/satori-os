# HANDOFF — Satori OS — 25-ago-2026 (madrugada) · PORT Orbe Persistente en index.html + M1 + certificación 937/0

> **Al retomar: modo ejecutor.** Continúa el handoff del 24-ago noche. Luciano corrió el runbook completo:
> commit `f037895` + push + clasp push + kickstart + **selfTest CERTIFICADO 937/0** (los 5 tramos, con los
> asserts nuevos de `moneda`) + `limpiarTodoTest`. El `setup()` que no corrió aparte NO hacía falta: cada
> tramo lo corre internamente ("MAESTRO listo") — verificado por Drive: la columna `moneda` YA existe en
> `Clientes` (última, N). Después de eso, esta tanda 2 de Cowork: **working tree M sobre `f037895`
> (2 archivos), SIN commitear** — runbook abajo.

## CIERRE tanda 2 — incluye

1. **Parche M1 (OK de Luciano):** `fichaCliente` ahora propaga la `moneda` POR FILA de `Datos_operativos`
   (08_webapp.js) y la fila de Operación la suma al hint de `fmtMoneda` (index.html). Harness 659/0.
2. **PORT Orbe Persistente v1 → `src/index.html` (para eyeball en `/dev`):**
   - `#orbeP` (halo + canvas 512 + anillo) a nivel body. **Arquitectura por RE-PARENTING:** docked vive
     DENTRO del slot (cero guerras de z-index/stacking — lección 04-ago); solo se eleva a `fixed z-90000`
     durante el vuelo FLIP (640ms ease-out-expo). Tokens literales (cruza scopes de tema).
   - **Slots:** CM home = `#orbe` (el orbe viejo 2D/3D cede vía `body.orbep-on`; el texto `.orbe-center`
     queda arriba) · Ficha 360 = `#f360OrbeSlot` en la cabecera (46px, click → `satoPanel_()`) · Akasha =
     `#akOrbeSlot` (88px abajo-derecha, click/Enter → **`satoPanel_(true)` — se le habla a Sato desde
     Akasha**, el panel body z-300 queda sobre akasha 200).
   - **Navegación por observers** (sin tocar funciones existentes): `#centro` class/style (CM visible ·
     `ak-on`) + `#fichaboard` class `open`. Estados: espejo de `data-orb` del CM (listen → anillo cálido).
   - **Fail-safe lección @42:** IIFE + try/catch; `body.orbep-on` (que oculta el orbe viejo) solo se pone
     si el init salió bien — si el módulo falla, el CM queda EXACTAMENTE como estaba.
   - **Verificado (render headless, shim GAS):** boot dock en `#orbe` ✓ canvases viejos ocultos ✓ texto
     visible ✓ vuelo a Ficha ✓ vuelo a Akasha ✓ **Sato abre desde el orbe de Akasha ✓** vuelta al CM ✓
     0 errores JS ✓ `_verificar_index.py` 443/443 ✓ harness 659/0 ✓.
3. **Moneda en el MAESTRO:** columna verificada por Drive (existe, vacía). ⚠ **La carga por Chrome quedó
   BLOQUEADA: la extensión no estaba conectada (2 intentos ~01:55).** Valores decididos: CLI-002
   Vehemence=ARS · CLI-003 LC Travel=ARS · CLI-004 DAM=EUR.

## PURGA tanda 2 — 0 Críticos/Altos · 2 Medios · 3 Bajos

- **M1:** entrada CM→Akasha: si `#akasha` aún no es visible al agregar `ak-on`, el vuelo degrada a dock
  instantáneo (el orbe "ya está" cuando abre la escena; el vuelo pleno se ve en Akasha→CM y CM↔Ficha).
  Confirmar en el eyeball real de `/dev`.
- **M2:** con el panel Sato abierto en Akasha, el orbe queda detrás del panel (26 vs 300) — deliberado.
- **B:** canvases viejos siguen dibujándose ocultos en CM home (gasto menor) · toggle "orbe 3D" del CM
  sin efecto visual con orbep-on · resolución 512 fija (crisp hasta ~512px).

## QUEDA ABIERTO

1. **Runbook de Luciano (Mac) — publica la tanda 2 a `/dev`:**
```
cd ~/Documents/Claude/Projects/SatoriOS
git add src/08_webapp.js src/index.html
git commit -m 'M1 moneda por fila + PORT Orbe Persistente v1 - Cowork 25-ago'
npx clasp push
git push
```
2. **Eyeball en `/dev`** (URL `AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I`): CM home (orbe respira,
   terra/jade, texto arriba) → abrir una Ficha 360 (el orbe VUELA a la cabecera) → cerrar (vuelve) →
   "⟶ Akasha" (orbe abajo-derecha) → **tocar el orbe → charla con Sato** → volver al CM. Observaciones →
   Cowork ajusta → promote cuando decidas.
3. **Moneda (20 segundos, dos caminos):** (a) abrís Chrome con la extensión y me decís "cargala" — la cargo
   yo; o (b) a mano: MAESTRO → pestaña Clientes → columna N `moneda`: fila Vehemence ARS · LC Travel ARS ·
   DAM EUR.
4. Arrastrados: URLs `url_exec_cliente` DAM/LC/Vehemence · observación maqueta CRM v1 · HANDOFF.md del repo
   con cabecera vieja (@46) · deuda purga integral 04-ago · avisos activos 52 (33 bandeja_escalada) como
   backlog operativo.

## PUNTEROS
- Anclas del port en `src/index.html`: buscar `ORBE PERSISTENTE` (3 bloques: CSS+markup · módulo JS ·
  slots `#akOrbeSlot`/`#f360OrbeSlot`).
- Verificación reproducible: `python3 _verificar_index.py` · `node _harness.js` (659/0) · render shim GAS.
- Memorias: [[satori-os]] · [[crm-pipeline]] · [[sato-ejecutor]].

*Cowork · 25-ago-2026 madrugada · prod intacta (≈@50); todo lo nuevo va a `/dev` con tu clasp push.*
