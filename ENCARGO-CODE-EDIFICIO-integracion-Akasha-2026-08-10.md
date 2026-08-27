# ENCARGO CODE — Integrar el Edificio Satori como sala de Akasha
**Fecha:** 10/08/2026 · **Autor:** Cowork · **Para:** Claude Code (Terminal Mac) · **Estado:** listo para ejecutar con aprobación de Luciano
**Fuente del módulo:** `Projects/SatoriOS/EDIFICIO-SATORI-v3.html` (maqueta certificada por render) · **Regla:** eyeball en /dev lo hace Luciano; verificar en /exec, no /dev; NO editar `index.html` mientras Cowork lo toca.

---

## 0. Qué es y qué NO es
El Edificio **no es una página nueva**: es un **segundo modo de Akasha**. Akasha ya es una escena three.js r128 (canvas `#gl`, "Oficina Universo": equipo adentro, clientes alrededor, Cerebro al centro). El Edificio reusa **el mismo renderer, el mismo `#gl`, el mismo boot**. Un switch en el HUD alterna Oficina Universo ⇄ Edificio. Datos propios de la flota → **Bastión verde** (no toca datos de cliente cruzados; ver §5).

## 1. Seams reales verificados (src/index.html, 7475 líneas)
- Canvas 3D: `<canvas id="gl">`, sección Akasha ~L1694. Renderer L5287: `new THREE.WebGLRenderer({canvas, antialias:!isM, alpha:true, powerPreference:'high-performance'})` — **`alpha:true`** (la Ficha 360/Sato se superponen como capas HTML sobre la escena).
- Boot 2 olas (L2662+): `bootUniversoP()` → `google.script.run.bootUniverso()` devuelve **estadoAgentes + listaClientes** (puebla la escena). `bootRestoP()` → datosHoy + recomendaciones + agenda + estadoSalud.
- Encuadre de cámara: `akEncuadre(alt, radio, lookY)` (L5823, afinador en vivo).
- three r128 inlineado (patrón `_akasha_e3/three.r128.min.js`).
- Botón que ya existe: `#cmAkasha` "⟶ Akasha" entra a la Oficina Universo.

## 2. Diseño de integración (mínimo y aditivo)
1. **Toggle de modo** en el HUD de Akasha (`#hud-top` de la Oficina): `◎ Oficina Universo | 🏢 Edificio`. Reusar el patrón visual del v3 (`.modesw`).
2. **Lazy build:** la torre se construye la 1ª vez que se entra al modo Edificio (no en el boot de Akasha, para no tocar el TTFP ya afinado E3.7). Mantener ambos grupos en memoria y togglear visibilidad + `akEncuadre`/cámara; destruir el que no se usa solo si la RAM lo pide.
3. **Cámara/controles:** portar la órbita custom del v3 (drag/rueda/shift-pan/pinch) o reusar la de Akasha si ya cubre; el Edificio necesita además **cutaway** (ocultar pisos por encima del enfocado) y **explode**.
4. **Overlays (paneles de piso / dashboard de agente):** son capas HTML como la Ficha 360. **Regla dura de stacking (lección 04-ago):** viven a nivel `<body>` (hermanos de `#akasha`/`#f360Sato`), NO dentro de `#centro` (crea stacking context y secuestra selectores por texto de `.eyebrow`). Scrim del dashboard casi opaco (lección E3.14, overlay translúcido sobre 3D animado se ve sucio).

## 3. Datos — de dónde sale cada estado (nada inventado)
- **Runtime (P8 Director/Sato, P3 Salud/Bandeja/Cerebro/Vigilancia/Conectores, P5 Admin):** estado `g/b/y/gr` desde el **mismo `estadoAgentes`** que `bootUniverso` ya trae. El halo 3D y el semáforo del panel leen de ahí.
- **Persona-skills (Círculo 19, Consejo 6, Equipo Pro, Bastión, D5-D9):** roster estático desde **`FLOTA.json`** (derivar del `_cerebro/FLOTA.html` actual — ya tiene los 68). Estado default `b` (en guardia). No consumen hasta convocarse.
- **Dashboards por agente (al abrir, on-demand, NO preload):** ver §4.

## 4. Endpoints nuevos (read-only · `_soloOwner_` · alta en `ENDPOINTS_UI` en el MISMO commit — regla anti-drift 22_seguridad.js)
1. `flotaEstado()` → `{ runtime:[{clave,estado,ultimaCorrida,cupoOk}], salud:correrSalud() }`. Lector puro sobre estadoAgentes + `16_salud.js`.
2. `agenteDetalle(clave)` → KPIs reales del runtime: corridas 30d (`Consumo_agentes`), costo mes (`Costos_API_consolidado` vía `medidorEsquema`/`consolidarCostosMes` ya existentes), salud. Para persona-skills devuelve solo el roster estático (sin datos de cliente).
- Ambos derivan de hojas que ya existen; son lectores, no escriben. Assert de aislamiento (§9 CLAUDE.md): "desde el Edificio no se lee ninguna hoja `charla`/tenant de cliente".

## 5. Bastión (datos propios → verde, con 2 guardas)
- El Edificio es vista de la **flota propia de Satori**, no de tenants. No cruza datos de cliente. Los dashboards muestran costos/salud/actividad **de los agentes**, no cifras de clientes.
- Guarda 1: `agenteDetalle` nunca devuelve nombres/cifras de clientes (solo agregados de consumo del agente).
- Guarda 2: los 2 endpoints van con `_soloOwner_` + `ENDPOINTS_UI` (el assert D19c/securityScan_ audita cobertura).

## 6. Motor gráfico (bloom/SSAO/DoF) — dos caminos, recomiendo (a)
El v3 ya trae un **pipeline de post-proceso hand-written** (bloom multi-octava + AO por profundidad + DoF bokeh + ACES + viñeta + grano), **sin addons** (el sandbox de Cowork tiene npm/CDN bloqueados y los addons de three no están en el repo). Corre en r128 puro.
- **(a) Portar mi POST tal cual.** Sin dependencias nuevas. **Ajuste único para Akasha:** Akasha usa `alpha:true` (overlays translúcidos). Como el Edificio es escena full (la torre + domo cubren el frame), puede ir **opaco**; si se quiere preservar el patrón de superposición translúcida, el `sceneRT` debe conservar alpha y el shader final emitir alpha. Marcado en el código.
- **(b) Addons oficiales de three r128** (`EffectComposer`+`UnrealBloomPass`+`SSAOPass`+`BokehPass`): **Code los baja en el Mac** (tiene red) e inlinea igual que three. Da SSAO/DoF "de librería" a cambio de +~40KB y más pases. Solo si Luciano quiere la vía canónica.

## 7. Mobiliario GLTF fotorrealista — frente aparte (Code en el Mac)
Cowork **no pudo** traer GLTF: no hay assets `.glb/.gltf` en el repo/Cerebro/Downloads y la red del sandbox está bloqueada (verificado). Lo resuelto en su lugar: **craft procedimental PBR + los avatares/emblemas reales de Satori** (`Avatares Satori/`, ya embebidos como texturas emisivas que brillan con el bloom). Si se quiere GLTF real:
- Code baja modelos **CC0** (escritorio, silla, monitor, sofá) en el Mac + `GLTFLoader` (addon r128).
- Reemplaza `deskUnit`/`execDesk`/`chairMesh` por instancias GLTF (mismo posicionamiento; reusar hitboxes).
- Inlinar o servir como asset por dominio propio (GAS no sirve binarios grandes cómodo → considerar base64 de modelos livianos o el shell Netlify del patrón PWA).
- No bloquea el v3 procedimental; es un upgrade opcional.

## 8. Perf / Retina / mobile (lecciones aplicadas)
- **Retina (E3.12):** `renderer.setSize(w,h,false)` + canvas `#gl` con `style.width/height` = viewport (no el buffer 2×). Mi `POST.setSize()` usa `pixelRatio` correcto.
- **DPR/quality tier:** `QUAL='low'` en mobile/≤820px → DPR≤1.5, SSAO+DoF OFF, bloom liviano (ya en el v3). Alinea con `antialias:!isM` de Akasha.
- **Boot:** construir la torre lazy; reusar snapshot warm si aplica. No sumar trabajo al TTFP de Akasha.

## 9. Verificación y deploy (nunca "listo" sin evidencia)
1. Cowork/Code: `node --check` + render (Cowork ya lo hizo en sandbox: WebGL ✓, 68 agentes ✓, click-raycast ✓, P8 Despacho ✓, emblemas ✓, 0 errores consola).
2. Code: integrar en `index.html` (capa aditiva), `clasp push`, **eyeball de Luciano en /dev**.
3. `selfTest()`/`selfTestVeredicto()` en el editor (verde) + assert nuevo de aislamiento del Edificio.
4. `bash _promote_exec.sh` → `--go`. Verificar en **/exec** (no /dev). Fingerprint por código (GAS strippea comentarios HTML).

## 10. Entregables que Code recibe
- `EDIFICIO-SATORI-v3.html` — fuente del módulo (escena + POST + paneles + chrome).
- Este encargo.
- Avatares: `Avatares Satori/*.png` (o los 256px generados).
- FLOTA (68) a `FLOTA.json`: derivar de `_cerebro/FLOTA.html`.

---
*Ningún paso toca datos de cliente. Frente 100% aditivo sobre Akasha. Cowork deja el plano; Code ejecuta en el Terminal del Mac; Luciano aprueba push/promote.*
