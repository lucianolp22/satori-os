# Satori OS · Command Center (norte v9 zen-futurista) → implementación — Sesión Cowork · 30/06/2026

> Handoff de **diseño/front** para el thread de desarrollo de Satori OS. Warm-start: el dev (Claude Code) integra el Command Center v9 en la Web App GAS real sin re-preguntar.
> **Fuente de verdad visual:** `Projects/SatoriOS/SatoriOS-CommandCenter-v9-zen-futurista.html` (autosuficiente, vanilla, GAS-compatible). **Leerlo entero antes de tocar nada** — este handoff lo explica, no lo reemplaza.
> **Actualización 30/06 — v10 (fondo nuevo, ELEGIDO por Luciano):** se reemplazó la foto JWST de fondo por su **versión reprocesada con profundidad/realismo cinematográfico** (misma Carina), manteniendo el **mismo opaco** (Pillow `Brightness 0.5 / Contrast 1.06` + `.veil`). **NORTE ELEGIDO = `SatoriOS-CommandCenter-v10img-zen-futurista.html`** → fondo = **imagen estática** nueva oscurecida (base64; ~462 KB; liviana, GAS-friendly). **Es la que se porta al `08_webapp`.** · Variante con **video parallax** (`SatoriOS-CommandCenter-v10-zen-futurista.html`, ~1,13 MB, `.photobg-vid` z-index −2 + `prefers-reduced-motion` + pausa) queda **archivada — NO es el norte**. Para todo lo demás (orbe canvas, tokens, widgets) manda v9: el cambio v10 es **solo la capa de fondo**.
> Relacionado: `Projects/_satori-design/DESIGN-v2-zen-futurista.md` (núcleo + capa Satori) · `Projects/SatoriOS/SatoriOS-MAPA-UPGRADES-abrir-la-cabeza-2026-06-30.md` (por qué de cada widget).

## 1. Qué se hizo

Se diseñó y aprobó el **norte visual del Command Center** de Satori OS en zen-futurista (marca propia): orbe "Sato" tipo Cerebro/connectome, fondo galaxia (foto JWST), y un cockpit de widgets. 9 iteraciones con Luciano (v1→v9). El v9 es el final. Todo **vanilla HTML/CSS/JS** (servible por `HtmlService`), autosuficiente (fuentes por CDN + imagen embebida en base64). Pendiente: **portarlo al `08_webapp` real y cablear cada widget a los datos del backend** (E1/E2+/E8a/Conectores ya existen).

## 2. Decisiones cerradas (no se reabren)

- **Orbe = connectome del Cerebro en CANVAS 2D** (no WebGL/Three.js). *GAS-safe (el Three.js dio "recuadro opaco en iframe" + costo 3D); el canvas respeta tu presupuesto de performance (cap dPR, pausa si oculto, reduced-motion). El Three.js queda como camino de prod opcional, no default.*
- **Identidad = Satori propia** (no un cliente): enso abierto + punto Alba, tinta/crema + **terracota (Alba)** + **jade**. *Es tu sistema interno, lleva tu marca.*
- **Orbe en Alba/naranja** (no el verde-cyan del orbe actual). *Pedido de Luciano; coherente con la paleta nueva.*
- **Click en el orbe = "Hablar con Sato"** (sin botón suelto). *Decisión de Luciano.*
- **Tamaño del orbe por 1 variable `--orbe`** (hoy `min(86vmin, 900px)`, ~doble, cap al viewport). *Para escalarlo sin tocar layout.*
- **Fondo = foto JWST de Luciano embebida** (no CSS). *"Amo esa imagen"; va con la paleta. Embebida base64 = autosuficiente para GAS.*
- **Glow "latente" (pulsante) en las partículas** + aro amarillo pegado al orbe. *Iteración final v8/v9.*
- **Layout centrado a pantalla completa** (orbe al medio; widgets distribuidos alrededor). *v8.*
- **Lazo de resultados visible** ("ayer recomendó X → movió +4,1% → ¿sirvió?"). *El hueco clave del mapa de upgrades; queda sembrado en el brief.*

## 3. Datos y definiciones — especificación técnica (lo que hay que reproducir)

### 3.1 Stack / identidad
| Ítem | Valor |
|---|---|
| Output | HTML + CSS custom properties + JS vanilla; un archivo; servible por `HtmlService.createHtmlOutputFromFile` |
| Fuentes (CDN Google) | marca/display **Fraunces** · UI **Hanken Grotesk** · cifras **JetBrains Mono** |
| Temas | **oscuro default** (cockpit) + claro; toggle por `data-theme` en `<html>` |
| Acento | terracota/Alba `#D5824F`/`#C2683D` (primary) · jade `#3E9B82` (accent) · neutrales tinta cálida |
| Tokens | en `:root` del archivo (NIVEL 1 primitivos `--_ink/_terra/_jade…` + semánticos). **Consumir de ahí**; alinear con `DESIGN-v2` |

### 3.2 Fondo (galaxia)
| Ítem | Valor |
|---|---|
| Imagen fuente | `Projects/SatoriOS/SPACE UNIVERSE 2.jpeg` (3000×1738) |
| Procesado | Pillow: resize 1920w · `Brightness 0.5` · `Contrast 1.06` · JPEG q72 → ~186 KB → **base64 embebido** en `.photobg{background-image:url('data:image/jpeg;base64,…')}` |
| Capas | `.galaxy` (fallback) < `.photobg` (foto) < `.veil` (vignette legibilidad) < contenido |

### 3.3 Orbe "Sato" — connectome en canvas (LA pieza a portar con cuidado)
| Parámetro | Valor |
|---|---|
| Render | `<canvas id="cerebro">` 2D, llena `.orbe` (tamaño `--orbe`) |
| Puntos | **N=160**, distribuidos en esfera (Fibonacci: `y=1-i/(N-1)*2`, `θ=i*2.399963`), color de paleta cálida (naranjas + algún jade/crema), `s` tamaño aleatorio |
| Malla | pares de puntos a distancia < `TH=0.56` (precalculados 1 vez) → líneas finas terracota, alpha por profundidad |
| Rotación | `rot += speed`; proyección con tilt 0.34 + perspectiva `1/(1.7 - z2*0.55)` |
| Glow partículas | por punto `ctx.shadowBlur=(10 + d*22)*pulse*DPR`, `shadowColor=color` + núcleo casi-blanco `rgba(255,250,242,…)`; **pulse "latente"** `1+0.4*sin(t*1.1)` |
| Glow del orbe | `box-shadow` multicapa (highlight cremoso + bloom terracota + halo jade) + `::before` radial; aro `.oring.a` pegado (`--orbe + 4px`) |
| Estados | `data-orb` = idle/listen/think → cambia `speed` (0.0015 / 0.006 / 0.011) y el texto centro |
| Performance | `DPR=min(devicePixelRatio,1.5)`; **pausa** en `visibilitychange` (hidden); `prefers-reduced-motion` → 1 frame estático. ⚠ El glow pulsante en 160 puntos es lo más pesado: si lacklea, bajar N o `shadowBlur` |
| Interacción | click/Enter en `.orbe` → `toggle()` (abre chat + estados) |

### 3.4 Layout
| Ítem | Valor |
|---|---|
| Topbar | sticky glass: marca (enso+`satori`) · Sistema OK · última corrida · **coste mes vs tope** (barra) · `⌘K` · toggle tema |
| Cockpit | grid `340px 1fr 340px`, **centrado vertical** (`align-items:center; min-height:calc(100vh-112px)`), `max-width:1760` |
| Columnas | izq = Brief + Estado · centro = orbe (`.stage`/`.constel`) · der = Cartera + Tareas + Aprobaciones |
| Full-width abajo | **Actividad de Agentes** + **Calendario semanal** |
| Nodos orbitando | 5 agentes (órbita interna) + 3 sistema (Director/Cerebro/Bandeja, externa) con spokes; técnica: `.orbiter` gira, `.node` contragira (animation reverse + delay) para quedar derecho; reduced-motion usa `--angle` estático |

### 3.5 Widgets y a qué dato real se cablean (GAS)
| Widget | Qué muestra | Fuente de datos real (backend existente) |
|---|---|---|
| **Brief de hoy** | 1-3 acciones + aprobar + "¿sirvió?" | Capa de Dirección (brief diario) + motor de **aprobaciones** (`crearAprobacion`); el "¿sirvió?" = **lazo de resultados** (a construir, MUST del mapa) |
| **Estado del sistema** | última corrida, coste/tope, errores, triggers | `16_salud.js` + telemetría de costo en `llamadaAPI` (retrofit-costo) + estado de triggers |
| **Cartera · semáforo** | clientes + North Star + alerta | MAESTRO + Capa de Dirección (North Star) + Capa de Conectores (`19_conectores`) |
| **Tareas → tablero Trello** | resumen + kanban 6 col, drag&drop | hoy el board es de Trello de Luciano (foto). Opciones: leer Trello vía API, o gestionar tareas en una pestaña del MAESTRO. **Definir** |
| **Calendario semanal** | 7 días + eventos | Google Calendar de Luciano (`CalendarApp`/API) o pestaña Agenda |
| **Actividad de Agentes** | estado + barras tarea/**entrenamiento** + feed (acciones/interacciones/asignaciones/entregas/entrenamiento) | `13_agentes` (runners) + `Actividad`/`Cola_tareas`/`Consumo_agentes` + Director (asignaciones) + **E8b entrenamiento** (TRAINING-LOG/evals) |
| **Voz (chat)** | panel al tocar el orbe | Voz ya desplegada (agente LiveKit + `doPost` tool-backend); el CM ya integra el botón→orbe |

### 3.6 Interacciones implementadas (todas vanilla, sin libs)
Toggle tema · click orbe→chat+estados · **kanban drag&drop** (HTML5 DnD: `.kcard` draggable, `.kcards` dropzones) · **filtros del feed** de agentes (chips `.fchip`) · aprobaciones (botones) · feedback 👍/👎 · click en nodos→info (toast) · click cliente→toast. Todo con `say()` (toast). Reemplazar los `say(...)` demo por `google.script.run` reales.

## 4. Preguntas ya respondidas (no volver a preguntar)
- Orbe → **canvas connectome Alba/naranja**, click = hablar, tamaño por `--orbe`.
- Fondo → **foto JWST embebida**.
- Glow → **en las partículas** (latente/pulsante) + el del orbe; aro pegado.
- Layout → **centrado pantalla completa**.
- Widgets pedidos → brief, estado, cartera, **tareas→Trello**, **calendario semanal**, **actividad de agentes** (con estado/acción/interacción/avance de tareas/entrenamiento/asignaciones/entregas). Todos ✅ en v9.

## 5. Preguntas abiertas para Luciano
- **Orbe en prod:** ¿mantenemos el **canvas** (GAS-safe, recomendado) o portamos al **Three.js** existente para el 3D pleno?
- **Tareas:** ¿el tablero lee tu **Trello** (API) o las tareas pasan a vivir en el **MAESTRO** (pestaña)? 
- **Cableado ahora o después:** tu reorden dice datos+RGPD+go-live AL FINAL → ¿integramos el CM con **datos mock** ahora (solo front) y cableamos al cierre, o ya conectamos lo que está (estado/cartera/agentes)?

## 6. Próximo paso concreto (en el thread de desarrollo)
1. **Leer** `SatoriOS-CommandCenter-v9-zen-futurista.html` entero (es el norte).
2. Decidir destino: **reemplazar/elevar el Command Center actual** en `08_webapp` (hoy mobile-first a4) con este layout, o nueva ruta. Mantener el botón Voz→orbe ya existente.
3. Portar markup+CSS+JS; **el orbe canvas va tal cual** (es autocontenido). Embeber la imagen base64 como `include` o constante.
4. **Cablear por widget** (tabla §3.5) vía `google.script.run.withSuccessHandler`; empezar por los baratos y que ya existen: **Estado del sistema** (16_salud + costo) y **Actividad de Agentes** (13_agentes/Actividad). Reemplazar los `say()` demo.
5. **Performance:** verificar 60fps con el glow; si lacklea en el iPhone, bajar N a ~120 o `shadowBlur`. Confirmar `prefers-reduced-motion` y la pausa en `visibilitychange`.
6. **Bastión:** el CM no debe exponer datos sensibles al cliente del iframe; respetar el gate de Voz/`doGet`. Correr la **Purga** antes de cerrar.
7. `clasp push` + deploy sobre el deployment del Command Center.

## 7. Archivos
- `Projects/SatoriOS/SatoriOS-CommandCenter-v9-zen-futurista.html` — **norte final (fuente de verdad)**.
- `Projects/SatoriOS/SatoriOS-CommandCenter-v2…v8-…html` — iteraciones (historial; ignorar, manda v9).
- `Projects/SatoriOS/SPACE UNIVERSE 2.jpeg` — imagen fuente del fondo.
- `Projects/SatoriOS/SatoriOS-MAPA-UPGRADES-abrir-la-cabeza-2026-06-30.md` — el por qué (lazo de resultados, etc.).
- `Projects/_satori-design/DESIGN-v2-zen-futurista.md` — tokens/núcleo a respetar.
- Backend a cablear: `08_webapp` (UI) · `13_agentes` · `14_director` · `15_cerebro` · `16_salud` · `19_conectores` · motor de aprobaciones · Capa de Dirección.

## 8. Supuestos y riesgos abiertos
- **Es un norte (front), con datos de muestra.** Confianza de que porta limpio a GAS: **8/10** (es vanilla y autocontenido; el riesgo es el cableado, no el render).
- **Performance del glow pulsante** (160 partículas + shadowBlur): el punto a vigilar en móvil/iframe GAS. Mitigación: bajar N/blur (1 línea).
- **Imagen base64** infla el HTML (~250 KB). Aceptable; si pesa en GAS, servirla como recurso aparte.
- **Tareas/Calendario**: dependen de decidir Trello-API vs MAESTRO y Google Calendar — no cablear sin esa definición.
- **No romper** Voz ni el gate de Bastión al integrar el CM. Reorden de Luciano (datos/RGPD/go-live al final) sigue vigente: el CM puede ir con mock primero.
