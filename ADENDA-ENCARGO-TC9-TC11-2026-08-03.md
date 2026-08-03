# ADENDA al ENCARGO-CODE-CIERRE-INTEGRAL — TC-9/TC-10/TC-11 — 03/08/2026 (noche)

> **Decisión de Luciano (03-ago 20:30):** reactivar TRES diferidos — Forge lab→prod, prompt-caching (B8d) y A5 vigilancia multi-superficie. El resto de los diferidos (D9, D10, VPS, Lift, B8, os@, Telegram) **siguen condicionados a su gatillo** — no se tocan.
> **Mandato de diseño (Cowork, innegociable):** los tres se construyen SIN verde falso. Donde hoy no hay datos, el sistema lo DICE (gris/sin-datos/ahorro-cero), no lo disimula. Todas las reglas duras del encargo original aplican (Paso 0, asserts nuevos, commit por tanda, prohibidos).
> **Orden actualizado de la cadena:** TC-1b (X4b, aprobado por Luciano) → TC-2 → TC-3 → TC-4 → TC-5 → TC-9 → TC-10 → TC-11 → TC-6 (correo, sigue ÚLTIMA de código por el re-consent) → TC-7 → TC-8 (cierre).

---

## TC-1b · X4b: gatear las 16 funciones de LECTURA (aprobado)

Las 16 que quedaron documentadas en TC-1 (getConfig, estadoVigente, briefDiario, consumoApiCliente, leerEstado, verVehemence…). Mismo patrón `_soloOwner_`, con la MISMA precaución que salvó a `vozRechazo_`: **antes de gatear cada una, verificar que no la invoque el doPost de voz, oficina_sync o un trigger sin `SATORI_CTX_SISTEMA`** — y que las llamadas internas (brief desde corridaDiaria, etc.) pasen por el contexto sistema. `getConfig` se llama desde todos lados: si el gate le agrega costo por llamada, apoyarse en el `_esOwner_` memoizado ya hecho. Asserts: extender D31 (cobertura total real: 0 sin gate según el scan honesto).

## TC-9 · Forge: promoción lab→prod con estado en DATOS (hot-reload real)

**Qué es de verdad:** hoy encender un agente de laboratorio = editar `13_agentes.js` + clasp push. Forge convierte eso en un flujo seguro operado desde el CM, con el estado de los agentes viviendo en datos, no en código.

- Paso 0: leer `13_agentes.js` (roster con `activo:false, gate:false`), `14_director.js`, `docs/CRITERIO-arquitectura-agentes.md` y lo que el PLAN-INTEGRACION-kevinfremon especificó de Forge. Verificar cómo lee hoy el runner el flag `activo`.
- **Estado en datos:** hoja `Agentes_estado` en MAESTRO (lista-contrato: `id_agente, activo, gate, max_dia, promovido_en, promovido_por, notas`). El código define los DEFAULTS del roster; la hoja los overridea en runtime → eso ES el hot-reload (cambiar estado sin clasp push). Hoja protegida + oculta.
- **`promoverAgente(id)`:** NO activa directo — crea una APROBACIÓN default-deny (patrón existente) con el test-gate adjunto: corrida dry del agente sobre datos `__TEST__` cuya salida el Director evalúa contra slop (reusar el piso determinístico D22 donde aplique). Test-gate fallado ⇒ la aprobación nace con el resultado adverso visible y NO se recomienda aprobar. Al aprobar Luciano ⇒ fila en `Agentes_estado`.
- **`demoverAgente(id)`:** inmediato y SIN aprobación — apagar siempre es libre (filosofía kill-switch).
- `gateRiesgo_`: declarar el tipo de acción nuevo (que no lo bloquee `tipo_que_nadie_declaro`).
- **Regla dura:** Forge construido ≠ agentes encendidos. NINGÚN agente lab se promueve en esta tanda — Lift y los demás conservan su gatillo. La tanda entrega el MECANISMO probado con un agente `__TEST__`.
- Asserts D37: promover sin aprobar no activa · aprobación aprobada activa vía hoja y el runner lo lee en runtime · demote apaga al instante · caso10 (lab no corre) sigue verde · test-gate fallado queda registrado.

## TC-10 · Prompt-caching (B8d): breakpoints + telemetría honesta

**Qué es de verdad:** marcar la parte FIJA de los system prompts para que la API la cachee, y medir. Con el gasto actual ($0.08/mes) el ahorro hoy es ~cero — **el valor de la tanda es la telemetría y quedar listo para cuando el volumen crezca; el commit lo dice así, sin inflar.**

- Paso 0: leer `llamadaAPI` (05_costos.js): cómo arma el request, qué modelos usa, dónde entra el system.
- **Breakpoint bien puesto:** system pasa a array de bloques; `cache_control` (ephemeral) SOLO en el bloque fijo (reglas duras, roster de fuentes, doctrina) — **jamás en bloques con contexto vivo del cliente ni memoria** (eso va después del breakpoint, si no el cache no pega nunca y encima fija datos viejos). Aplicar donde el prefijo fijo sea sustancial (sato_ficha, agentes con prompt estable).
- **Requisito de la API:** el bloque cacheado tiene un mínimo de tokens (verificar el mínimo vigente en la doc de Anthropic al implementar; si el bloque fijo no llega, NO se cachea y se anota el porqué — nada de rellenar prompts para llegar al mínimo).
- **Telemetría:** columnas `cache_read` y `cache_write` en Costos_API (aditivo, lista-contrato) desde el `usage` de la respuesta; el resumen de costos del CM las muestra. Sin `usage` en la respuesta ⇒ 0 y sigue (fail-safe).
- Asserts D38: el builder arma bloques con cache_control solo en la parte fija · con contexto dinámico el breakpoint queda ANTES · telemetría persiste y tolera usage ausente.

## TC-11 · A5: vigilancia multi-superficie con semáforo que sabe decir «no sé»

**Qué es de verdad:** de vigilar 1 superficie (ventas Vehemence) a N superficies declaradas por cliente. **La regla que mata el verde falso: GRIS = sin datos, y vacío JAMÁS es verde** (doctrina D26c). Hoy la mayoría de la cartera va a estar en gris — eso es lo honesto y lo esperado; el módulo cobra vida a medida que entren conectores/datos (B8).

- Paso 0: leer `sgicVentas_`/adapters (19_conectores.js), el Vigía (13_agentes), semáforo del Hilo (`_semaforoHilo_`, 25_hilo.js) para reusar vocabulario y patrones, y cómo la Ficha 360 renderiza estados.
- **Declaración por cliente** (Config, patrón conector_*): superficies estándar: `ventas · operativos_caja · kpis · aprobaciones · tareas · resenas · fiscal`. Cada una: fuente (hoja/conector o `manual`/`sin_fuente`) + regla de umbral (Config con default prudente) por superficie.
- **Motor `vigilarCliente_(id)`** (corre en corridaDiaria + on-demand desde la Ficha): evalúa cada superficie declarada → `verde / ambar / rojo / gris` con el DATO que lo ancla (patrón juicio anclado A2: nunca un color sin su número) y la FRESCURA del dato (dato viejo ⇒ degradar a gris con nota, no mantener un verde vencido).
- **Render** (registro operativo, tokens existentes): fila de semáforos por superficie en la Ficha 360 + línea en el brief («Vigilancia CLI-002: ventas ✅ · caja ⬜ sin datos · …»). Es TAMBIÉN el artefacto de venta S1/S2 — tiene que ser mostrable a un cliente tal cual sale.
- **Prohibido en esta tanda:** inventar fuentes (reseñas/fiscal nacen declaradas en gris con nota «sin conector — entra a mano o con B8») · tocar Sheets de clientes reales para probar (clientes `__TEST__` con datos sembrados).
- Asserts D39: superficie sin datos ⇒ GRIS nunca verde · dato viejo ⇒ degrada con nota · umbral de Config con default · rojo/ámbar determinístico con datos `__TEST__` · cada color trae su dato ancla · el brief renderiza el resumen.

---

## Registro de la decisión (para el decision log cuando exista — TC-2)

`2026-08-03 · Luciano reactiva Forge/caching/A5 adelantando su gatillo · porqué: completar el Plan Integral ahora; Cowork marcó el riesgo de verde falso y se mitigó por diseño (gris-sin-datos, mecanismo-sin-encender, telemetría-sin-inflar) · el resto de diferidos conserva gatillo.`

*Adenda generada por Cowork 03/08/2026. La purga integral de TC-8 audita también estas tres tandas.*
