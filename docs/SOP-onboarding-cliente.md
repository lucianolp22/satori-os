# SOP — Onboarding de cliente nuevo en Satori OS

> **Objetivo:** dar de alta un cliente de punta a punta sin improvisar. Tiempo total: ~20–30 min (5 min si solo alta + datos).
> **Fuentes de verdad:** `src/03_cliente.js` (alta) · `src/01_schema.js` (plantilla de pestañas) · `ACTIVACION.md` (activación) · `GUIA-CARGA-DATOS-CLIENTE.md` (sustancia) · `src/15_cerebro.js:297` (`cargarObjetivo`).
> **Regla:** ningún paso se salta; si algo no da lo esperado, FRENAR y anotar en HANDOFF antes de seguir.

## Fase 0 — Prerequisitos (verificar una vez, no repetir por cliente)

| # | Check | Dónde | Qué esperar |
|---|---|---|---|
| 0.1 | Triggers vivos | Editor GAS → Activadores | `corridaDiaria` (07:00) + `drenarCola` (5 min). Si faltan → correr `instalarTriggers()` |
| 0.2 | API key + tope | Script Properties | `CLAUDE_API_KEY` seteada; `API_BUDGET_MENSUAL_USD` (default 25) |
| 0.3 | selfTest verde | Editor GAS → `selfTest()` | «TODO OK». Si falla algo → resolver ANTES de dar altas |

## Fase 1 — Alta técnica (2 min)

1. Editor GAS del MAESTRO → archivo `03_cliente.js`.
2. En la consola/función temporal, ejecutar:
   ```js
   crearCliente({ nombre: 'NOMBRE COMERCIAL', rubro: 'Rubro', estado: 'activo', responsable_lado_cliente: 'Nombre y rol' })
   ```
   - `estado`: `potencial` | `activo` | `activo-piloto` (default `potencial` si se omite).
   - **Idempotente por nombre** (case-insensitive): si ya existe, devuelve el existente con `ya_existia: true` — no duplica.
3. **Qué esperar (devuelve):** `{ id_cliente: 'CLI-0XX', url: 'https://docs.google.com/...', ya_existia: false }`.
4. **Qué hace solo (no repetir a mano):** crea el Sheet «Satori OS — NOMBRE [CLI-0XX]» con TZ Europe/Madrid; crea las 12 pestañas estándar (`Datos_operativos`, `KPIs`, `Aprobaciones`, `Excepciones`, `Umbrales`, `Costos_API`, `Reglas`, `nodos`, `aristas`, `cerebro_log`, `estado_actual`, `objetivos`); oculta+protege las 10 sensibles (todas salvo `Datos_operativos` y `KPIs`, que quedan con protección de aviso); registra la fila en `Clientes` del MAESTRO con `fecha_alta`.

**Verificación F1:** abrir la URL devuelta → se ven `Datos_operativos` y `KPIs` visibles; en el MAESTRO → pestaña `Clientes` tiene la fila nueva con `id_cliente` formato texto `CLI-0XX` (NO fecha — si aparece como fecha, es la regresión E2-1: frenar y avisar).

## Fase 2 — Datos operativos (el 80% del valor) (5–10 min)

En el Sheet del cliente → pestaña `Datos_operativos`, pegar movimientos reales:

| fecha | concepto | valor | fuente | notas |
|---|---|---|---|---|
| 2026-06-15 | Venta mostrador | 1250.00 | TPV | |
| 2026-06-15 | Compra insumos | -340.00 | proveedor X | factura 0012 |

- Fechas SIEMPRE `aaaa-mm-dd`. Punto decimal. Ventas en positivo, costos en negativo.
- La unidad/moneda clave va en `notas` si no es obvia (los agentes leen filas crudas en lenguaje natural).
- **Mínimo útil:** 4–8 semanas de historia. Con solo esto, Vigía ya produce reporte real.
- ⚠ **PII:** cargar movimientos, no datos personales de terceros (nombres de clientes finales solo si es imprescindible; RGPD formal va al final del programa).

## Fase 3 — North Star + objetivos (para que el Director dirija) (3 min)

1. Editor GAS → `15_cerebro.js` → editar la función de carga (o correr directo):
   ```js
   cargarObjetivo('CLI-0XX', { descripcion: 'Subir el ticket promedio', metrica: 'ticket_promedio_eur', valor_objetivo: 25, prioridad: 'A' });
   ```
2. Solo los objetivos **con `metrica`** disparan el análisis dirigido del Analista vía Director.
3. **Moneda correcta** (lección Vehemence 19-jun: North Star estaba en € y era ARS): confirmar unidad con el cliente antes de cargar.

**Verificación F3:** correr `estadoVigente('CLI-0XX')` → el snapshot muestra sección «## Objetivo (North Star)» con lo cargado.

## Fase 4 — Proyectos y tareas (opcional, MAESTRO) (3 min)

En el MAESTRO → pestañas `Proyectos`/`Tareas`: cargar iniciativas activas del cliente (id_cliente correcto). Da contexto al Director y al brief.

## Fase 5 — Conector de datos (solo si el cliente tiene SGIC/sistema en el Workspace)

- Patrón: `sincronizarConectorVentas_(id, src, sheet, fuente)` en `19_conectores.js` (ejemplo vivo: `sincronizarVehemence()` — lectura cross-Sheet sin credenciales, mismo Workspace, agrega mes×canal, se engancha en `corridaDiaria`).
- **Es desarrollo por cliente (Code), no configuración**: requiere mapear la fuente + validar al peso contra el sistema origen (como se hizo con Vehemence: mayo/junio al centavo) + cargar TODOS los canales (lección: solo online → el −83% engañaba).
- Sin conector, el cliente opera igual con carga manual (Fase 2).

## Fase 6 — Activación y verificación end-to-end (5 min)

1. Editor GAS → correr `corridaDiaria()` (no esperar a las 07:00). **Qué esperar:** encola Vigía por cliente activo + Director + Salud.
2. Correr `drenarCola()` (o esperar ≤5 min). **Qué esperar:** en el MAESTRO → `Actividad`, entradas nuevas del cliente; `Cola_tareas` sin `fallida`.
3. Command Center (🛰 `/dev` o `/exec`): elegir el cliente arriba → disparar Vigía. **Qué esperar:** estado general + anomalía + dato a mirar hoy. Sin datos suficientes → el agente lo dice honesto (no inventa).
4. Si Cobrador/Abastecedor proponen algo → queda en `Aprobaciones` PENDIENTE (default-deny: nada sale sin OK).
5. Correr `selfTest()` → verde completo.

## Fase 7 — Contexto para Claude (carpeta del cliente) (5 min)

1. Crear carpeta `~/Documents/Claude/Projects/<Cliente>/` si no existe.
2. Copiar `docs/CLAUDE-cliente-TEMPLATE.md` → `<Cliente>/CLAUDE.md` y completar los campos `{{...}}`.
3. Crear/actualizar el MOC del cliente en `_cerebro/` (patrón: `MOC - <Cliente>.md`) linkeando el CLAUDE.md y el Sheet.

## Checklist de cierre (los que se olvidan)

- [ ] `id_cliente` como TEXTO en `Clientes` (no fecha).
- [ ] Pestañas sensibles ocultas (abrir el Sheet como si fueras el cliente: solo `Datos_operativos` + `KPIs` visibles).
- [ ] **NO compartir el Sheet con el cliente todavía** (compartir = Etapa 3, con revisión Bastión previa).
- [ ] Moneda del North Star confirmada con el cliente.
- [ ] `corridaDiaria` + `drenarCola` corridos 1 vez con el cliente activo, `Actividad` con salida real.
- [ ] Tope API revisado (¿el cliente nuevo justifica subir `API_BUDGET_MENSUAL_USD`?).
- [ ] CLAUDE.md del cliente creado + MOC en `_cerebro/`.
- [ ] Alta registrada en `HANDOFF.md` (línea en Estado vigente).

## Gaps conocidos del flujo (mejoras futuras — NO bloquean el SOP)

1. `crearCliente` no valida `rubro`/`estado` contra lista cerrada (typo pasa silencioso).
2. No existe `compartirClienteConDueno(id, email)` atómico (compartir es manual — a propósito hasta Etapa 3).
3. Carga de objetivos requiere editar código (candidato a UI/wizard en el CM — backlog).
4. Conector = dev por cliente (no configurable) — aceptado por ahora.
