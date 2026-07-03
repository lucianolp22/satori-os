# PAQUETE B4 — Portar Command Center v10img (zen-futurista) a `08_webapp` · para Claude Code · 03-jul-2026

> **Cómo usar:** Terminal → `cd "$HOME/Documents/Claude/Projects/SatoriOS"` → `claude` → «Ejecutá PAQUETE-CODE-B4-command-center-2026-07-03.md paso a paso».
> **Fuentes de verdad (leer ANTES de escribir una línea):** `SatoriOS-CommandCenter-v10img-zen-futurista.html` (norte visual ELEGIDO — entero) · `HANDOFF-SatoriOS-CommandCenter-v9-2026-06-30.md` (spec de widgets/datos/interacciones §3) · `Projects/_satori-design/DESIGN-v2-zen-futurista.md` (tokens; si la ruta no existe, los tokens del v10img mandan) · `src/index.html` actual (lo que NO se puede romper).
> **Reglas para Code:** commits chicos por widget · `node --check`/lint offline antes de cada push · guardia diff GAS↔repo antes de TODO `clasp push` (pull a /tmp + diff, abortar si GAS tiene algo que el repo no) · el render final lo valida Luciano por eyeball en `/dev` (el CM no es auto-screenshoteable).

## Decisiones CERRADAS por Luciano (03-jul — no reabrir, no re-preguntar)

1. **Orbe = el Three.js 3D existente, re-esteticado** a la identidad del norte: paleta Alba/naranja + jade (connectome cálido), NO el verde-cyan actual. **SIN UnrealBloomPass** (ya se probó y dio recuadro opaco en el iframe → revertido 22-jun): el glow se logra como en el canvas del v9 pero en 3D — material additivo/sprites con textura radial + pulso «latente» (`1+0.4*sin(t*1.1)`) + halo CSS multicapa del v10img (`box-shadow` terracota+jade + aro `.oring.a` pegado). El canvas 2D del v10img queda como **fallback** (ya existe fallback 2D en el CM actual — mantener ese mecanismo).
2. **Tareas = pestaña `Tareas` del MAESTRO** (ya existe en `MAESTRO_ORDEN`). El kanban 6 columnas del v9 mapea a una columna de estado de esa pestaña; **verificar primero el schema real** de `Tareas` en `01_schema.js` (columnas/estados existentes) y mapear — si los estados actuales no dan 6 columnas, usar los estados reales (no inventar estados nuevos sin avisar). Drag&drop escribe el estado vía `google.script.run` (interno + reversible = AREL bajo impacto, sin gate). La migración desde Trello la hace Luciano a mano una única vez (fuera de este paquete).
3. **Cableado = lo que ya existe, datos reales:**
   | Widget | Fuente real | Estado |
   |---|---|---|
   | Estado del sistema | `16_salud.js` (última corrida, errores, triggers) + `Costos_API_consolidado` (gasto vs tope) | cablear YA |
   | Actividad de Agentes | `Actividad` + `Cola_tareas` + `Consumo_agentes` (feed + estados por agente) | cablear YA |
   | Brief de hoy | `18_direccion.js` (`briefDiario`/`estadoVigente`) + motor de aprobaciones para los botones | cablear YA |
   | Cartera · semáforo | `Clientes` + North Star por cliente (`estadoVigente(id)`) | cablear YA |
   | Aprobaciones | `Aprobaciones_agregadas` + flujo aprobar/rechazar existente (botones reales) | cablear YA |

   **Fix obligatorio del widget Aprobaciones (bug real 03-jul):** hoy la lista lee la agregada del MAESTRO, que solo se refresca con `syncMaestro` (07:00) → tras aprobar/rechazar, la card queda «pendiente» fantasma hasta el día siguiente y permite re-clickear (el backend responde «no está pendiente»). En el CM nuevo: (a) **optimistic update** — al confirmar la acción, sacar la card de la lista al toque; (b) tras la acción, disparar re-sync de esa aprobación o leer el estado real del Sheet del cliente antes de re-render; (c) **ningún toast vacío** — todo `say()` con mensaje explícito de éxito/error (03-jul se vieron banners vacíos).
   | Tareas (kanban) | pestaña `Tareas` MAESTRO (decisión 2) | cablear YA |
   | Calendario semanal | — | **mock/oculto** (no cablear CalendarApp sin decisión aparte) |
   | Voz | botón/click-en-orbe → página local (flujo `cmVoz` actual) | reusar intacto |
4. **Fondo = imagen estática Carina** del v10img (base64 embebida, ~462 KB, capas `.galaxy` < `.photobg` < `.veil`). La variante video (v10) quedó archivada — no usar.
5. El feedback **«¿sirvió?» 👍/👎** del brief (v9 §2 «lazo de resultados») se incluye aunque solo loggee a una pestaña/feed por ahora — es la semilla del lazo de resultados (MAPA-UPGRADES). Registrar el clic con fecha+item; el análisis viene después.

## Qué NO se puede romper (leer `src/index.html` actual antes)

- **Botón/entrada de Voz** (`cmVoz`, `target="_top"` → `http://127.0.0.1:8787`): en el norte el acceso es **click en el orbe** — mantener AMBOS caminos si es barato, o solo orbe-click si el botón molesta al layout (avisar en el reporte).
- **Gate del `doGet`** (`OWNER_EMAIL`, fail-closed) y `webapp.access: DOMAIN` — intactos.
- **Selector de cliente** + disparo de agentes (`dispararAgenteUI`) — funcionalidad existente que el norte también contempla (nodos orbitando clickeables).
- **Kill switch / Modo calma / Capturar** (UI actual, commits `9d7241c`/`20_killswitch`) — preservar acceso a esas acciones en el layout nuevo.
- **Vista móvil:** el CM actual es mobile-first; el norte es cockpit desktop (grid 340/1fr/340, max 1760). Mínimo aceptable v1: breakpoint que apile columnas y reduzca el orbe (`--orbe` ya es 1 variable) — NO dejar el móvil roto (el iPhone es un uso real: PoC cockpit + PWA).
- **Performance (presupuesto vigente del orbe, casos 14-17):** render-si-visible · Page Visibility API pausa · `devicePixelRatio` cap ≤1.5 · toggle calidad · `prefers-reduced-motion` → frame estático. Si el glow lagea en iPhone: bajar N puntos / blur (1 línea).

## Secuencia sugerida (commits chicos)

1. Leer entero `v10img` + `src/index.html` actual + schema `Tareas`. Plan corto de merge (qué se reemplaza, qué se conserva) — pegárselo a Luciano en 5 líneas antes de codear (gate ≥96% confianza).
2. **Commit A — esqueleto:** layout cockpit + tokens + fondo Carina + topbar (tema claro/oscuro), con los widgets en mock del v10img. Botón Voz preservado.
3. **Commit B — orbe:** Three.js re-esteticado (paleta Alba, glow sin bloom, estados idle/listen/think, click = voz). Fallback 2D intacto.
4. **Commit C–F — cableado por widget** (orden: Estado → Actividad → Brief+Aprobaciones → Cartera → Tareas kanban). Cada uno: `google.script.run.withSuccessHandler` + estado de carga + manejo de error visible (no silencios).
5. **Verificación:** `node --check` de los .js tocados · harness vm si aplica · guardia diff → `clasp push` → **eyeball de Luciano en `/dev`** (desktop + iPhone) → ajustes → push final.
6. **Purga de cierre** (UI + seguridad: no exponer datos sensibles nuevos en el DOM del iframe; el CM es DOMAIN pero el least-privilege visual aplica) → actualizar `HANDOFF.md` («B4 CERRADA») → promover `/exec` con versión nueva (aviso a Luciano).

## Criterio de éxito (gate B4)
Luciano abre `/dev` y ve el cockpit del norte con **datos reales** en Estado/Actividad/Brief/Cartera/Aprobaciones/Tareas, el orbe 3D en paleta Alba reaccionando (idle/listen/think), la voz accesible desde el orbe, tema claro/oscuro, y el CM móvil usable. Purga sin críticos/altos.
