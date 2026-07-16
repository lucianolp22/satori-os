# ENCARGO CODE — AKASHA (Oficina Universo) · VERSIÓN FINAL — 16/07/2026
**Documento de arranque para la conversación de ejecución (Claude Code o Cowork). Autosuficiente: contexto + matriz de persistencia + 15 mejoras aprobadas + etapas con gates.**

**Contexto:** Cowork diseñó y construyó `AKASHA-prototipo-E16.html` (en el root de este repo): la Oficina Universo con el design system real del CM (tokens de `#centro`, fondo photobg embebido, aro eclipse, badges --nc, paleta del Cerebro) + Espacios de Cliente. Datos MOCK marcados. Handoff completo: proyecto claude.ai "SATORI · Asesoramiento y consultoría" → `claude/HANDOFF-2026-07-16-AKASHA-E0.md`.

**Regla de oro:** nada decorativo — cada luz mapea un dato real. El CM prod NO se toca hasta el eyeball final; todo en `/dev`.

## E2 — Spike de convivencia Three (1 sesión corta)
El CM YA corre Three.js **r128 UMD (CDN+SRI, con fallback 2D)** en prod — el riesgo GAS+WebGL está validado. El prototipo usa **r184 ESM** (import dinámico). DECISIÓN A TOMAR (una sola versión por página, jamás dos):
- **Opción A (recomendada, menor riesgo):** Akasha reusa el `window.THREE` r128 global ya cargado por el CM. El motor del prototipo usa solo APIs presentes en r128 (Points, BufferGeometry, EdgesGeometry, LineSegments, Sprite, CatmullRomCurve3, QuadraticBezierCurve3, Raycaster, FogExp2, MathUtils.damp ≥r113). Cambio: quitar el `import()` y tomar `window.THREE`; verificar que el orbe existente y Akasha no compartan renderer (cada uno el suyo) y que NUNCA corran los dos loops a la vez (al entrar a Akasha, pausar el loop del orbe del CM; al salir, revertir).
- Opción B: subir TODO el CM a r184 ESM (importmap) — más limpio a futuro, más riesgo hoy. Solo si A revela un blocker.
- Gate E2: en `/dev`, vista Akasha mínima (núcleo + 1 estación) 60fps desktop / ≥30fps iPhone PWA / 5 toggles Despacho↔Akasha sin context-loss ni pantalla negra (dispose + forceContextLoss + canvas.replaceWith ya están en el motor del prototipo — conservarlos).

## E3 — Integración (1-2 sesiones)
1. **Vista:** portar el CSS del prototipo (scopear bajo `#akasha` como `#centro`) + DOM (cosmos, paneles, vista plana) + motor JS al index.html. El fondo NO se duplica: reusar `.photobg/.galaxy/.veil` existentes del CM.
2. **Puerta:** botón pill "⟶ Akasha" en la topbar del CM (junto a "Oficina Virtual"). Lazy total: nada de Akasha se inicializa si no se entra.
3. **Datos reales (reemplazar el objeto `DATA` mock — su shape es el contrato):**
   - `agentes` ← roster real del CM v11 (13_agentes/18_direccion) + estados de corridas + avatares reales (Config B24-B29, mismo patrón .av-img del fix de órbita: si hay URL, tapa el glifo).
   - `clientes` ← Clientes del MAESTRO + semáforo (estadoVigenteCliente_) + flujo (últimas corridas/avisos por cliente) + aprobaciones ligadas.
   - `aprobaciones` ← 11_aprobaciones (pendientes).
   - `akasha` ← grafo del Cerebro (15_cerebro, mismo endpoint que alimenta el orbe 3D; dims negocio/sistema/lider/alerta con CM_DIMCOL).
   - `salud`/`corridasHoy` ← 16_salud + telemetría.
   - Sin endpoints nuevos, sin scopes nuevos, sin secretos en cliente.
4. **Bandeja real:** los botones Aprobar/Rechazar del Muelle llaman al flujo existente de Aprobaciones (fail-closed, confirmación obligatoria) — NO reimplementar lógica.
5. **Vista Plana:** ya está en el prototipo — misma info, DOM 2D; conservarla como rama de reduced-motion/sin-WebGL/fallo.
6. selfTest verde + eyeball Luciano en /dev → **la promoción la decide Luciano** (ojo: el eyeball de órbita Fase 2 → @25 va ANTES, no encolar dos cambios UI).

## MATRIZ DE PERSISTENCIA FUNCIONAL (contrato E3 — nada del CM se pierde)
Inventario del código real (`cm_body` + scripts): cada función/widget del CM y dónde vive en Akasha. El prototipo E17 ya trae TODO en mock; E3 conecta el wiring real (columna 3).

| Función del CM | En Akasha (E17, mock ✓) | Wiring E3 (GAS existente) |
|---|---|---|
| Topbar: Sistema OK + reloj | topbar HUD ✓ | — |
| Selector de cliente | selector topbar → vuela a su Espacio ✓ | `datosCliente()` |
| API budget + barra | budget pill ✓ | telemetría/api_usage |
| Hablar con Sato | pill ✓ | `voz_url` de Config |
| Oficina Virtual (condicional) | pill ✓ | `oficina_url` de Config (mostrar solo si hay URL, como el CM) |
| ＋ Capturar → Bandeja | pill ✓ | `capturar()` |
| Brief de hoy | **Atril** ✓ | `datosHoy()` |
| Lazo: ¿Se hizo? / ¿Movió KPI? | Atril ✓ | `registrarFeedback()` + `recomendacionesAbiertas()` |
| → Crear aprobación desde recomendación (T2) | agregar al lazo del Atril en E3 | `aprobacionDesdeRecomendacion()` (fail-closed) |
| Estado del sistema (corrida/coste/errores/salud) | Atril ✓ | `datosHoy()` + `estadoSalud()` |
| Cartera · semáforo | **Espacios de Cliente** (anillo) ✓ | `listaClientes()` |
| Tareas: resumen + tablero (quick-add, 7 filtros) | Atril resumen ✓ + "Abrir tablero" | `tableroTareas()` + `crearTareaQuick()` — REUSAR el modal board del CM, no duplicar |
| Aprobaciones · default-deny | **Muelle** ✓ (aprobar/rechazar) | `resolverAprobacionUI()` |
| Actividad de agentes | **Estaciones** (halo estado + panel + última corrida) ✓ | `estadoAgentes()` |
| Disparar agente a demanda | botón "▶ Despertar" en panel de agente idle ✓ | `dispararAgenteUI()` con confirmación |
| Calendario semanal + modal mensual | Atril mini-semana ✓ | `agendaRango()` — modal mensual: REUSAR el del CM (calboard) |
| Orbe + grafo del Cerebro | **Núcleo Akasha** (geodésico + eclipse + constelación) ✓ | `cerebroGrafo()` (mismo endpoint del orbe) |
| Nodos órbita (avatares+aro, Cerebro, Bandeja) | Estaciones / Núcleo / Muelle ✓ | avatares Config B24-B29 (patrón .av-img del fix órbita) |
| Boot limpio (cmVeil/cmPill) | aplicar el patrón al entrar a Akasha en E3 | existente |
| Vista clásica + cerrar | Despacho ↔ puerta (ida y vuelta) ✓ | — |
| `cmdBtn` (¿palette?) | verificar qué hace hoy en v11 y decidir | — |

Regla: donde el CM ya tiene un modal/flujo (tablero de tareas, calendario mensual, Bandeja), Akasha lo INVOCA — jamás lo reimplementa. Un solo dueño por función.

## MEJORAS APROBADAS POR LUCIANO (entran al proyecto — construir en E4/E5, post-wiring)
1. **El Pulso del Día** (E4 · S-M): ritual de apertura — vuelo guiado ~30s al entrar (Muelle→Espacios con novedades→Núcleo status). Datos: los mismos de datosHoy/aprobaciones. Con voz (voz_url): Sato narra el recorrido (patrón filler existente). El brief_push diario linkea "entrá al Pulso".
2. **Hilos de causalidad** (E5 · M · requiere lazo real T2/P2 andando): recomendación aprobada → hilo Núcleo→agente→Espacio; feedback ¿movió KPI? consolida jade/terracota. Fuente: recomendacionesAbiertas + registrarFeedback + aprobacionDesdeRecomendacion. Persistir hilos históricos (hoja nueva o reutilizar log del lazo).
3. **Modo "Sato co-presenta"** (E4 · S): botón ▶ Presentar = órbita cinematográfica automática (estaciones→Espacios→Núcleo, paneles auto, 60-90s loop) + variante filtrada por cliente (su universo, para reuniones KAIROS y reels B7). Sin datos nuevos: coreografía de cámara sobre lo existente.

## 5 IDEAS APROBADAS (16/07 tarde — Luciano: "entran las 5") · construir POST-E3
1. **Clima Histórico — GLOBAL + POR CLIENTE** (E5 · M): scrubber temporal del organismo (salud, semáforo, actividad, decisiones por día) **+ log histórico individual por cliente accesible desde su Espacio** (pedido explícito: botón "◷ Historial del Espacio" — semilla mock YA en el prototipo E111). Requiere LA PRIMERA PERSISTENCIA NUEVA del proyecto: hoja `Historial` en el MAESTRO (snapshot diario por cliente: fecha, estado, salud, corridas, decisiones tomadas) escrita por `corridaDiaria` (trigger 07:00 existente — 1 fila/cliente/día, barato) + función `historialCliente(id, rango)` + `snapshotDia(fecha)` para el scrubber global. Bastión: mismas hojas del MAESTRO, sin datos sensibles nuevos, sin scopes nuevos.
2. **El Tejido — rayos-X de dependencias** (E5 · M): toggle que revela hilos vivos conector→Espacio, trigger→agente, agente→tablero. Topología: estática en código (matriz conocida) + estado por `estadoSalud`/err.log → hilo roto parpadea terracota. Sin persistencia nueva.
3. **La Sala de Reunión** (E6 · M-L): al abrir "Reunión" desde el Espacio de un cliente, cargar el guion del `tablero-de-reunion` (chasis HTML/JSON existente) como tarjetas orbitantes; conducir desde ahí; al cerrar, el JSON baja al SGIC por el flujo existente. Integración con skill/flujo KAIROS real — coordinar el formato con Cowork.
4. **Los Guardianes** (E5 · S-M): Bastión/Círculo/Purga como faros tenues en la periferia, apagados por defecto; se encienden al intervenir. Estado: filas simples en Config (`guardian_bastion|circulo|purga` = ok|hallazgo + mensaje + fecha), actualizadas al cerrar purgas/hallazgos (manual al inicio, automatizable después). Regla Satori: silencio = correcto.
5. **Modo Enfoque** (E4-E5 · M): "trabajar sobre {cliente}" → reconfiguración espacial client-side: su Espacio avanza, sus agentes en semicírculo, tableros filtrados por cliente (reusa `datosCliente`), resto atenuado. Sin datos nuevos. Sinergia con "Sato co-presenta" variante cliente (comparten coreografía).

**HOJA DE RUTA DE LAS 15 MEJORAS APROBADAS (3+5+7):**
- **E4** (sin persistencia nueva): Pulso del Día · Sato co-presenta · Modo Enfoque · Bitácora del agente · El Eco (voz).
- **E5** (persistencia liviana: hoja Historial + estados en Config/roster): Clima Histórico global+por cliente · El Tejido · Los Guardianes · La Forja · La Constancia del Director · El Astillero.
- **E6** (integraciones mayores): Sala de Reunión (→SGIC) · Hilos de causalidad (lazo real) · El Ensayo (what-if fail-closed) · Las Mareas (data estacional de conectores).
Regla transversal: una etapa por vez, "avanzá" como gatillo; cada cierre de etapa → Purga + eyeball de Luciano; nada se promociona a /exec sin su palabra.

## TERCERA TANDA — APROBADA por Luciano (16/07): construir según etapa
1. **La Forja** (E5 · M): alta de cliente como experiencia — semilla de luz → el Espacio se construye en vivo mientras `crearCliente()` + SOP de onboarding corren; checklist SOP visible en el proceso.
2. **La Bitácora del agente** (E4-E5 · S-M): botón en el panel de cada estación → sus últimas corridas narradas en lenguaje humano (fuente: log de corridas + avisos por agente; el estilo narrativo del brief ya existe).
3. **El Ensayo (what-if)** (E6 · M-L): previsualizar el efecto de una decisión ANTES de aprobar en el Muelle — impacto en caja del cliente + cadena de pasos que dispara. Requiere lógica de proyección simple sobre los montos/encadenamientos de la aprobación. Fail-closed: el Ensayo JAMÁS ejecuta.
4. **Las Mareas** (E5-E6 · M): estacionalidad visible — cada Espacio respira con el ciclo real de su negocio (ventas por día de semana de los conectores) + vista superpuesta de la cartera: cuándo se carga TU semana.
5. **El Eco** (E4-E5 · S, requiere voz): al acoplar a estación/Espacio, Sato dice UNA línea de contexto (TTS corto, opt-in, sin conversación — la PWA queda para hablar). LiveKit existente.
6. **La Constancia del Director** (E5 · S): tu presencia como dato, discreto en el Despacho — días entrando al Pulso, decisiones a tiempo vs vencidas, tiempo medio de respuesta. Espejo, no gamificación (valor #8: paz como métrica).
7. **El Astillero** (E5 · M): el Laboratorio como pipeline real de incubación — cada agente lab con su etapa (diseñado→entrenando→en prueba→listo) desde el roster/Config, y "promover" lo muda ceremonialmente del anillo alto al anillo prod.

## Comportamientos E1.9/E1.10 (nuevos vs matriz — mismo wiring)
- Órbita del equipo: el anillo de estaciones GIRA (spin 95s, como el CSS del CM); cámara acoplada persigue (goal dinámico por worldPosition); streams con origen dinámico; spokes con gradiente al color de cada agente; minimapa compensa la rotación.
- Núcleo: tilt 0.35 + spin 0.15 + banda de energía (sweep 0.7 rad/s de cmDrawOrb) + twinkle por chispa. En E3, la energía del sweep debe modularse por actividad real (CM.work 0-3+, como el orbe 2D).
- Nitidez: sprite 128px, badges/sellos 288px con halo corto (blur 10) + aro exterior fino, eclipse 1024px, labels 2.5x aniso 8, starfield con devicePixelRatio.
- Doble toque en Núcleo → voz_url · tableros del cockpit navegan (flyTo).

## Notas de Cowork (purga previa)
- Prototipo: sintaxis node OK ×3, cero vars CSS huérfanas, degradación probada. Fixes aplicados: hits de tarjetas independientes (escala de sprite deforma esferas hijas), materiales de línea individuales, canvas.replaceWith tras forceContextLoss (iOS), contextlost frena loop, fonts.ready antes de generar labels.
- Presupuesto: pixelRatio ≤2 (móvil 1.5), Q=0.45 en móvil, auto-eco si fps<24. Mantener.
- `99_tmp_tipos.js` sigue en src/ — borrarlo (pendiente P0.5 del repaso 10-jul).

## CÓMO USAR ESTE ENCARGO (arranque en conversación nueva)
1. Abrir junto con `AKASHA-prototipo-E113.html` (mismo directorio) — el prototipo ES la spec visual/UX viva; este doc es el contrato de integración.
2. Orden: **E2** (convivencia Three, gate de fps/toggles) → **E3** (portar vista + wiring de la matriz completa; el objeto `DATA` del prototipo es el contrato de datos) → **E4→E6** (las 15 mejoras según hoja de ruta).
3. Innegociables: el CM prod NO se toca hasta eyeball (todo en /dev) · donde el CM ya tiene un modal/flujo, Akasha lo INVOCA (un solo dueño por función) · cero endpoints/scopes/secretos nuevos salvo la hoja `Historial` (E5, especificada) · dato→forma: nada decorativo · dispose+forceContextLoss al salir (patrón ya en el motor).
4. Contexto ampliado y decisiones: handoff del proyecto claude.ai "SATORI · Asesoramiento y consultoría" → `claude/HANDOFF-2026-07-16-AKASHA-E0.md`. Bash de arranque: `cd ~/Documents/Claude/Projects/SatoriOS && claude` → "Leé ENCARGO-CODE-AKASHA-E2E3-2026-07-16.md y avanzá con E2".
