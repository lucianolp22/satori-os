# Prácticas adoptadas del "Jarvis OS" (Fase 0 — gratis)

> Tres prácticas del caso @_no_hype_ai que suman hoy sin código nuevo en Satori OS. Ver `PLAN-INTEGRACION-jarvis-os.md` para el plan completo.

## 1. Higiene de contexto en Claude Code (para nuestro trabajo de build)
El "context rot": a partir de **~150k tokens** todo modelo degrada (alucina, se va de tema). Tres cosas, todas se piden en una línea a Claude Code:

- **Status bar de contexto** — "Claude, armame una status bar que muestre el % de contexto usado" → edita `settings.json` y la dibuja. Para saber cuándo estás cerca del límite.
- **Hook de tokens** — "Claude, configurá un hook que te exponga tu propio conteo de tokens" → para poder cambiar a una sesión/sub-agente fresco ANTES de degradar.
- **`/rename`** — renombrá cada sesión/tab por lo que estás haciendo. Barato y salva la "RAM cognitiva" cuando tenés muchas abiertas.

Regla práctica robada: *"metas clarísimas son la única forma de que un puñado de sub-agentes de contexto fresco logren lo que querés"* → cuando una sesión se alarga, cerrá con un handoff y abrí una nueva con objetivo acotado (ya lo hacemos con `HANDOFF.md`).

## 2. SOP — "Preparar el terreno" antes de meter agentes (por cliente)
El insight más infravalorado del caso (reel 17): Liam dedicó **semanas a ordenar su espacio digital** antes de automatizar, porque *"el contexto es lo más importante; el agente necesita saber qué tenés y cómo rutear"*. Para Satori multi-tenant es pre-requisito: sin orden, los agentes producen slop.

**SOP de onboarding de un cliente (antes de activar agentes):**
1. **Inventario** — qué datos hay, dónde, en qué formato (ventas, banco, stock, facturas).
2. **Limpieza** — un solo lugar por tipo de dato; nombres y fechas consistentes (`aaaa-mm-dd`).
3. **Índice raíz** — el cerebro del cliente (`estado_actual` materializado) + su ficha en `Cerebro_index` cumplen este rol; confirmá que esté materializado (`materializarEstado`).
4. **Objetivos** — cargar 1-3 objetivos con métrica (`cargarObjetivo`) para que el Director dirija.
5. **Recién ahí** — disparar agentes. Datos sucios = análisis sucio.

## 3. Requirements-doc como contrato de ejecución
El único punto humano de Liam: refinar el plan propuesto y convertirlo en un **requirements document** antes de ejecutar. Nosotros ya lo hacemos (`ETAPA-8-PLAN.md`, `HANDOFF.md`, AREL), pero conviene formalizarlo como artefacto repetible.

**Template mínimo (antes de construir algo no trivial):**
- **Objetivo + success-criteria** (acotado, medible — "qué quiero exactamente").
- **Alcance / no-alcance** (qué SÍ, qué NO).
- **Plan por fases** (pasos chicos, verificables).
- **Riesgos / supuestos** (con confianza X/10).
- **Quién hace qué** (Cowork / Code / Luciano) + **tu único checkpoint**.
- **Verificación** (cómo sé que funcionó) + **Purga** al cierre.

Esto es exactamente lo que separamos como Fase de plan antes de cada build, y lo que aprobás vos en un solo lugar.
