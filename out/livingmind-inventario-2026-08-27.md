# F2c · Inventario livingmind aplicable al Cerebro — 27/08/2026

> Precondición de F10. **Leer el §1 antes de planificar F10: el supuesto de stack del encargo es falso.**

---

## §1 · Hallazgo bloqueante: el Cerebro NO usa Three.js

El encargo §F10 lista bloques (Bloom, fresnel, `InstancedMesh`, `ACESFilmicToneMapping`, fog exp2,
`setPixelRatio`, raycasting) que son **API de Three.js/WebGL**. El renderer real es otra cosa:

| Dimensión | Realidad verificada |
|---|---|
| Archivo | `_cerebro/GRAFO.html` — 325 KB, de los cuales **321 KB son el JSON de datos** |
| Renderer | **Canvas 2D** (`getContext('2d')`) |
| Código de render | **~4,8 KB de JS**. Total. |
| Three.js | **ausente** — 0 ocurrencias de `THREE.Scene`, `WebGLRenderer`, `three.min.js`, `import * as THREE` |
| Dependencias externas | **cero**. Ni un `<script src="http…">`, ni un `<link href="http…">` |
| Generador | `_cerebro/_scripts/grafo.py` (11,8 KB) — emite el HTML entero, datos incluidos |

Las 4 apariciones del texto «Three.js» en el archivo son **contenido del vault** (labels de nodos),
no código.

### Consecuencias

1. **F10 tal como está escrito no es «aplicar mejoras»: es reescribir el renderer**, de 4,8 KB de
   canvas 2D a una escena Three.js. Es la causal de escalado **§8.8** del encargo, disparada.
2. **El cero-dependencias-externas es una propiedad de Bastión, no un accidente.** El servidor es
   loopback-only, sirve un solo archivo, sin escritura, sin parámetros del cliente. Meter Three.js
   obliga a **vendorizarlo** (~600 KB minificado dentro del repo del vault, revisado como dep nueva
   según la regla de deps de CLAUDE.md). Un `<script src="cdn…">` rompería el modelo: no se hace.
3. **El presupuesto está invertido.** F10 pide 6 h para lo visual. El renderer entero son 4,8 KB y
   los tres problemas medidos en F2b (§W1 huérfanos, §W2 sin fechas, §W3 rAF infinito) se arreglan
   en **menos de 1 h combinada**, sin tocar el stack, y valen más que cualquier bloom.

---

## §2 · Inventario técnica por técnica

`APLICABLE` = entra en canvas 2D sin cambiar el stack · `ADAPTABLE` = existe un equivalente 2D con
otro nombre · `NO APLICA` = exige Three.js/WebGL.

| # | Técnica livingmind | Veredicto | Motivo (1 línea) |
|---|---|---|---|
| 1 | Starfield | **APLICABLE** | Puntos con `alpha` en el mismo `ctx` antes del grafo; barato |
| 2 | Bloom | **NO APLICA** | Post-proceso WebGL. Aproximación 2D = `shadowBlur`, **ya está** (`glow` en MOCs/hubs) |
| 3 | Fresnel glow (membrana) | **NO APLICA** | Shader sobre normales; en 2D no hay normales |
| 4 | Reverse-fresnel en nodos | **ADAPTABLE** | `createRadialGradient` por nodo da el halo con borde brillante. Coste: gradiente por nodo por frame |
| 5 | `InstancedMesh` por dimensión | **NO APLICA** | Concepto de draw-call de GPU; en canvas 2D no existe instancing |
| 6 | `ACESFilmicToneMapping` | **NO APLICA** | Tone mapping de WebGL |
| 7 | Fog exp2 | **ADAPTABLE** | En 2D = `globalAlpha` por distancia al centro/zoom. Barato |
| 8 | `setPixelRatio(min(dpr,2))` | **APLICABLE — y es un bug abierto** | `rs()` hace `cv.width=innerWidth` **sin `devicePixelRatio`**: en Retina el grafo se dibuja a la mitad de resolución y se ve borroso. **Arreglo de 3 líneas, el mejor ratio impacto/esfuerzo de toda la lista** |
| 9 | `aFreshness = 0.5^(edad/30)`, piso 0,15 | **APLICABLE — pero primero el dato** | El nodo **no tiene fecha** (`grafo.py:41` emite `{id,label,group,moc,deg}`). Requiere `+1 línea` en `grafo.py` con `os.path.getmtime`. Los 996 archivos resuelven en disco (F2b §W2) ⇒ el dato está disponible |
| 10 | `aPhase` FNV-1a (fase determinista) | **APLICABLE** | Hash puro de JS sobre `n.id`; da pulso desincronizado sin `Math.random()` |
| 11 | Bezier arcs en aristas | **APLICABLE** | `ctx.quadraticCurveTo` existe. **Ojo perf:** 1.164 aristas curvas por frame |
| 12 | `LineSegments` merged por kind | **NO APLICA** | Merge de geometría de GPU. Equivalente 2D: un `beginPath()` por color en vez de por arista — **eso sí conviene**, hoy hace `beginPath()` 1.164 veces |
| 13 | Shimmer por similitud | **ADAPTABLE** | Alpha oscilante por arista; necesita métrica de similitud que hoy no existe |
| 14 | Comet flow en 3 trunks | **APLICABLE** | Punto animado a lo largo de la arista por `t∈[0,1]`. Los trunks reales ya se conocen: 272/261/206 de grado (F2b §2) |
| 15 | Force-directed precomputado (150 iters, seed determinista) | **APLICABLE — alto valor** | Hoy corre **en vivo y O(n²)**: 996² / 2 ≈ **496.000 chequeos de par por frame** durante ~17 s. Precomputarlo en `grafo.py` mata el arranque caro Y hace el layout reproducible (hoy usa `Math.random()` ⇒ el grafo sale distinto en cada carga) |
| 16 | Distribución golden-angle por cluster | **APLICABLE** | Reemplaza el `Math.random()` de la siembra inicial (`grafo.py`/JS línea de init) |
| 17 | Camera drift ambiental | **APLICABLE** | Es un `ox/oy` que deriva lento; ya existen `ox/oy/zoom` |
| 18 | Hover raycasting + edge highlight | **YA EXISTE** | `pick()` hace hit-test por distancia y `selSet` ya resalta las aristas del nodo. No rehacer |
| 19 | Búsqueda por substring + fly-to | **MITAD HECHA** | El filtro por substring ya está (`q` + `visible()`). **Falta el fly-to** (centrar la cámara en el match) |
| 20 | Deep links `#node=` | **APLICABLE — no existe** | 0 ocurrencias de `location.hash`. Es el ítem que más sirve para «Sato te manda al nodo X» |
| 21 | FPS governor | **APLICABLE** | Ver F2b §W3: hoy no hay ni medición de FPS ni gate. Lo correcto acá no es degradar bloom, es **dejar de redibujar cuando nada cambió** |
| 22 | Stats line con counts reales | **APLICABLE — barato** | 996/1.164/34/42 ya están calculados en memoria |
| 23 | Fail visibly / «no dibujar lo que no está en la fuente» (§10-E) | **APLICABLE — y ya se cumple en parte** | El grafo se genera del vault real, sin scaffold inventado. Falta el caso «server apagado ⇒ cartel, no página en blanco» |

**Recuento:** APLICABLE 11 · ADAPTABLE 3 · NO APLICA 5 · ya hecho o a medias 4.

---

## §3 · Priorización por impacto / esfuerzo

Ninguno de los cinco primeros necesita Three.js, y juntos no llegan a las 2 h.

| # | Trabajo | Esfuerzo | Impacto | Por qué primero |
|---|---|---|---|---|
| **P1** | `devicePixelRatio` en `rs()` (#8) | 3 líneas | **Alto** | El grafo se ve borroso en Retina **hoy**. Es un defecto, no una mejora |
| **P2** | Cortar el rAF cuando nada cambió (F2b §W3, #21) | ~5 líneas | **Alto** | Deja de quemar CPU/batería 60 fps para siempre |
| **P3** | `mtime` en `grafo.py` + `aFreshness` + `aPhase` (#9, #10) | ~15 líneas | **Alto** | Hace visible lo que F2b §W2 midió: mediana de 49 días. Es *el* punto del livingmind |
| **P4** | Layout precomputado y determinista en `grafo.py` (#15, #16) | ~40 líneas | **Alto** | Mata 496k chequeos/frame en el arranque y vuelve el grafo reproducible |
| **P5** | Deep links `#node=` + fly-to (#20, #19) | ~20 líneas | **Medio-alto** | Habilita «Sato te lleva al nodo». Utilidad, no cosmética |
| P6 | Un `beginPath()` por color de arista (#12) | ~10 líneas | Medio | 1.164 → ~3 draw calls |
| P7 | Starfield + fog por alpha + camera drift (#1, #7, #17) | ~30 líneas | Medio | Acá empieza lo estético |
| P8 | Bezier arcs + comet flow en los 3 trunks (#11, #14) | ~40 líneas | Medio | Medir FPS antes: 1.164 curvas/frame |
| P9 | Halo por `createRadialGradient` (#4) | ~15 líneas | Bajo | `shadowBlur` ya da el 80% del efecto |
| — | Bloom / fresnel / instancing / ACES (#2,3,5,6) | **reescritura + dep** | — | Requieren migrar a Three.js vendorizado. **Decisión de Luciano, no de Code** |

---

## §4 · Recomendación

**Reformular F10 en dos fases y no ejecutar ninguna sin que Luciano decida la §4b.**

- **F10-a (sin cambio de stack, ~2 h):** P1→P5. Arregla dos defectos reales (borroso en Retina, rAF
  infinito), le da al grafo la dimensión de tiempo que hoy no tiene, y lo vuelve determinista y
  enlazable. Todo dentro de `grafo.py` + los 4,8 KB de JS. Riesgo bajo, rollback = `git`/`.bak`.
- **F10-b (migración a Three.js):** **escalada a Luciano.** Es reescribir el renderer + vendorizar
  una dependencia de ~600 KB en el vault, contra un archivo que hoy tiene cero dependencias
  externas por diseño de Bastión. La pregunta no es técnica sino de criterio: *¿cuánto vale que el
  Cerebro se vea vivo, contra mantener el vault sin dependencias?* Con 996 nodos y un uso de
  ráfagas, la respuesta por defecto de este informe sería **no** — pero es decisión de Luciano.

**Advertencia de alcance (regla +51):** todo lo de acá es para `_cerebro/GRAFO.html`. **Ni una línea
toca el Orbe Persistente v2 ni el orbe del CM.** Son identidad visual clavada.

---

*Claude Code · 27/08/2026 · rama `feat/sato-viviente` · F2c del Bloque A. Confianza 9/10 — el stack
se verificó por grep directo sobre el archivo servido, no por lectura del encargo.*
