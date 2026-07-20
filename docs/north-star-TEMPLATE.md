# North Star enriquecido — formato y almacenamiento (v2, 20-jul-2026)

> Decisión 20-jul (Arquitecto de Defensa + Verificador, aprobada por Luciano): **NO migrar a archivos `north-star-<cliente>.md`** — rompería el lector, la sync y el render del brief que ya andan. Se **extiende lo que ya existe**: Config para el North Star de SISTEMA, y la fila de objetivo para el de TENANT. Este archivo describe ESE formato (no un archivo nuevo). Implementación: ver `ENCARGO-CODE-northstar-reset-2026-07-18.md`.

## Los campos enriquecidos (mismo modelo para sistema y tenant)
- **OBJETIVO ÚNICO + DEADLINE** — qué, para cuándo (dd/mm/aaaa). Sin fecha es deseo, no meta.
- **MÉTRICAS QUE LO MIDEN (máx 3)** — antes era una sola; ahora hasta tres.
- **VALORES / GUARDRAILS** — qué NO se hace aunque acerque al objetivo (lente Satori: no crecer a costa de la paz del dueño).
- **DECISIONES DESCARTADAS (pivots muertos)** — caminos ya descartados que NADIE debe re-proponer (ni el agente ni el humano). `recomendacionDelDia_` los consulta y no los sugiere.
- **AL CUMPLIRSE** — se celebra y se RE-FIJA el siguiente (con fecha) en el mismo acto.

## Dónde vive cada uno (el almacenamiento real)

**North Star de SISTEMA (Satori) → hoja `Config` del MAESTRO** (fuente única, decisión firme 16-jul):

| Clave Config | Qué | Estado |
|---|---|---|
| `ns_satori_desc` | objetivo único (texto) | ✅ existe |
| `ns_satori_valor` | meta numérica | ✅ existe |
| `ns_satori_horizonte` | deadline (yyyy-mm-dd) | ✅ existe |
| `ns_satori_metrica` | métrica principal | ✅ existe |
| `ns_satori_metricas` | métricas secundarias (hasta 2 más, separadas por `·`) | 🔧 NUEVO |
| `ns_satori_valores` | guardrails (separados por `·`) | 🔧 NUEVO |
| `ns_satori_pivots` | decisiones descartadas (`fecha·qué·porqué`, una por línea) | 🔧 NUEVO |

**North Star de TENANT (cliente) → una fila de la hoja `objetivos` del cliente** (la que hoy usa `cargarNorthStarVehemence`), con columnas análogas nuevas: `metricas_extra`, `valores`, `pivots_descartados`.

## Regla dura
El North Star se siembra/edita **por acto humano** (Config o la fila objetivo desde el editor), jamás desde texto libre de LLM/voz. `pivots_descartados` es de solo-consulta para `recomendacionDelDia_`.
