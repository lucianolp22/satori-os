# ADENDA F2 — verificación contra el código (CORRIGE el ENCARGO-F2 de ayer)

> Cowork leyó `18_direccion.js` real (vía puente). **Hallazgo: F2 "lazo e informes" ya está construido casi entero desde el 08-jul. NO reconstruir.** El `ENCARGO-CODE-F2-lazo-informes-2026-07-18.md` de ayer queda **superseded**: sus Partes B/C/D/E ya existen en el código; solo sobrevive la Parte A (North Star enriquecido), reformulada abajo. Confianza 9/10 (leído en fuente, con línea).

## Lo que YA ESTÁ CONSTRUIDO (verificado — no tocar salvo confirmar promote a /exec)

| Ítem F2 | Estado | Evidencia en `18_direccion.js` |
|---|---|---|
| **A2 · Contrato de status report (10 secciones fijas)** | ✅ | `contratoStatusReport_` (L250) + `CONTRATO_ORDEN` (L229): bluf·apertura·metricas·autoresuelto·espera·recomendaciones·**cierre_accion**·insumos·instrumentacion·cierre |
| **A1 · Cierre acción→métrica** | ✅ | `_cierreAccionMetrica_` (L318): lee hoja `Recomendaciones` (se_hizo + kpi_movio), solo cerradas. Es la sección 7 del contrato |
| **Persistencia de recomendaciones con estado** (lo que la purga marcó como riesgo) | ✅ existe | `registrarRecomendacionDelDia` (L801, escribe estado 'abierta', dedupe por esencia) + `marcarRecomendacion` (L823, se_hizo/kpi_movio → 'cerrada'). **La purga #1 era un no-issue.** |
| **A2 · Juicio anclado en el dato** | ✅ | `recomendacionDelDia_` (L692), docstring "Trillion-delta A2 (08-jul): cada recomendación cita el dato real (días vencida, integridad %, progreso NS). Espejo honesto, no oráculo" |
| **B2 · Botón "→ Crear aprobación" desde el brief** | ✅ | `aprobacionDesdeRecomendacion` (L852), "Trillion-delta B2 (08-jul)": convierte rec abierta → aprobación P1 del cliente, reusa `crearAprobacion`, dedupe por rec_id |
| **A3 · Refinamientos** (insumos requeridos · huecos de instrumentación · contrapeso de riesgo · apertura humana) | ✅ | secciones `insumos`/`instrumentacion` en el contrato + `_contrapeso_` (L298) + apertura humana (agenda antes de KPIs, briefDiarioSistema_ L363) |
| **Feedback "¿sirvió?" 1-clic** | ✅ | `registrarFeedback` (L939), origenTipo brief/aviso/recomendacion |

**Consecuencia:** las Partes B (cierre acción→métrica), C (juicio anclado), D (botón crear-aprobación) y E (refinamientos) del ENCARGO de ayer **NO se construyen — ya existen**. Para esos ítems la única acción posible es **confirmar que están promovidos a `/exec`** (no rebuild).

## Lo único GENUINAMENTE pendiente de F2

### 1. North Star enriquecido (Parte A reformulada) — should · S/M
**Estado real:** el lector `northStarSatori_` (L586) devuelve el formato **base** (`{desc, metrica, valor, horizonte, actual, meta}`) — **una sola métrica**, desde Config (`ns_satori_*`). El template enriquecido (`docs/north-star-TEMPLATE.md`, métricas múltiples + valores/guardrails + `pivots_descartados` + re-fijar) **NO está implementado en el código**.

**⚠ Disyuntiva de diseño que Code debe resolver ANTES (no está trivial):** hay DOS mecanismos de almacenamiento distintos, y el template propone un TERCERO:
- North Star de **sistema** (Satori) = claves de **Config** `ns_satori_*` (L586-642) — fuente única, decisión firme 16-jul (NO duplicar en tenant).
- North Star de **tenant** (Vehemence) = una fila de **objetivo** (`OBJ-0001`) en la hoja `objetivos` del cliente (`cargarNorthStarVehemence` L649).
- El **template** propone un archivo `north-star-<cliente>.md` — que **no coincide** con ninguno de los dos.

**Decisión requerida (Luciano/Arquitecto):** enriquecer los mecanismos existentes (agregar claves `ns_satori_metricas`, `ns_satori_pivots` en Config; y campos análogos en el objetivo del tenant) **en vez de** migrar a archivos .md. Recomendación de Cowork: **no migrar a .md** (rompería el lector, la sync y el render del brief ya andando) — extender Config + la fila objetivo, y actualizar el template para que describa ESE formato, no uno nuevo. Esto pasa por el Arquitecto + sus Senior antes de tocar.

**Lo más valioso del ítem (el 20%):** que `recomendacionDelDia_` **consulte `pivots_descartados`** y NO re-proponga un camino ya descartado. Eso es el enforcement del "audit pivots dead, stay focused" de Kevin.

### 2. A4 · Tono anclado extendido al Informe Mensual KAIROS — ⏸️ PAUSA (cliente)
El "Informe Mensual KAIROS" es un **entregable a cliente** distinto del brief interno (que ya tiene el tono anclado). Construir su motor toca la entrega a cliente → **en pausa** por la restricción vigente. Además hay que verificar si el Informe Mensual existe como pieza separada o si se deriva del `contratoStatusReport_` (probablemente lo segundo).

## Reglas duras (iguales)
Edit no Write · solo `18_direccion.js` (Config reader) para el North Star · no pisar lo que Code edita en T1 · `selfTestF2` antes de hecho · promover solo con eyeball de Luciano · el North Star se siembra por acto humano (Config/objetivo), jamás texto libre LLM.

## Neto para la cola
Después de T1 (métrica), **T2 se reduce a UN ítem chico** (North Star enriquecido, con su decisión de diseño) + A4 en pausa. El grueso de "lazo e informes" ya está. Reevaluar si conviene saltar de T1 → T3 (motor profundo/seguridad) y meter el North Star enriquecido como quick-win intercalado.
