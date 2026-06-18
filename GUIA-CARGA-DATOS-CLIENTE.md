# Guía de carga de datos de un cliente — Satori OS

> Cómo darle sustancia a la Capa de Dirección de un cliente. Ejemplo trabajado: **Vehemence (CLI-002)** — e-commerce de indumentaria, activo-piloto.
> Objetivo de la guía: que `briefDiario('CLI-002')`, `estadoVigente('CLI-002')` y el **Analista** dejen de decir "(sin datos)" y empiecen a calcular sobre la operación real.

## BLUF

La Capa de Dirección ya funciona, pero está **vacía**: sin `Datos_operativos`, el Analista no tiene qué analizar y el brief no tiene qué priorizar. Cargás **3 cosas, en este orden de impacto**:

1. **`Datos_operativos`** (el 80% del valor) — el libro que leen los agentes.
2. **Proyectos + Tareas** (en el MAESTRO) — para que "Las 3 cosas de hoy" tenga contenido.
3. **KPIs** (opcional) — titulares con objetivo/alerta.

El **North Star ya está cargado** (`OBJ-0001`: subir ticket promedio → 22). No hay que tocarlo.

---

## El modelo en un párrafo

El sistema NO impone un esquema rígido de conceptos: los agentes (Vigía, Analista, Conciliador, Cobrador) **leen las filas crudas** de `Datos_operativos` (cabeceras + últimas ~60 filas) y razonan sobre ellas con el LLM. Por eso el nombre del `concepto` es **lenguaje natural** — el Analista lo interpreta. La regla de oro: cargá lo que un humano necesitaría para entender el negocio, con **fechas, montos con signo y la unidad clave en `notas`**.

| Pestaña | Dónde vive | Columnas | Para qué |
|---|---|---|---|
| `Datos_operativos` | Sheet de Vehemence | `fecha · concepto · valor · fuente · notas` | El libro que leen los agentes. **Lo más importante.** |
| `KPIs` | Sheet de Vehemence | `fecha · kpi · valor · objetivo · alerta` | Titulares medibles (AOV, conversión…). Opcional. |
| `objetivos` | Sheet de Vehemence | (North Star) | **Ya cargado** (`cargarNorthStarVehemence`). |
| `Proyectos` | MAESTRO | `id_proyecto · id_cliente · nombre · estado · %_avance · fecha_objetivo · proximo_hito · …` | Agrupan el trabajo. |
| `Tareas` | MAESTRO | `id_tarea · id_proyecto · descripcion · prioridad · estado · fecha_limite · …` | Alimentan **"Las 3 cosas de hoy"**. |

---

## Qué cargar para Vehemence (e-commerce indumentaria)

### 1. `Datos_operativos` — el libro

Pensalo como el flujo de caja + la actividad comercial. **Ventas en positivo, costos en negativo.** Poné la **unidad clave en `notas`** (nº de pedidos, unidades) — así el Analista calcula el ticket promedio (AOV = ventas ÷ pedidos), que es justo tu North Star.

Conceptos típicos de e-commerce indumentaria (usá los que apliquen):

| concepto | signo | notas (clave) | fuente ejemplo |
|---|---|---|---|
| `Ventas del día` / `Ingresos pedidos` | + | **nº pedidos · nº unidades** | Shopify / Tiendanube / web |
| `Devoluciones` | − | nº devoluciones · motivo | plataforma |
| `Publicidad (Meta/Google)` | − | impresiones / campaña | Ads Manager |
| `Comisiones plataforma / pasarela` | − | % sobre ventas | Shopify/Stripe |
| `Envíos / logística` | − | nº envíos | Correo/courier |
| `Compra de mercadería / stock` | − | unidades · proveedor | proveedor |
| `Sueldos`, `Alquiler depósito`, `Servicios`, `Software/SaaS` | − | período | nómina/varios |

**Regla de oro del AOV:** en cada fila de venta, escribí en `notas` el nº de pedidos. Sin esa unidad, el Analista no puede separar "vendiste más" de "subiste el ticket" — que es la pregunta de tu North Star.

### 2. `Proyectos` + `Tareas` (en el MAESTRO)

Para que el brief tenga "3 cosas hoy", cargá a mano en el MAESTRO **1 proyecto hacia el objetivo** + 2-3 tareas. Ejemplo:

- Proyecto: `PRY-002-01` · id_cliente `CLI-002` · "Subir AOV de Vehemence" · estado `en curso`.
- Tareas (prioridad A/B/C = must/should/nice):
  - `[A]` Configurar upsell + bundles en el checkout · fecha_límite.
  - `[B]` Campaña email a clientes recurrentes (cross-sell).
  - `[C]` Test de envío gratis desde €X para subir el carrito.

> Las tareas con prioridad A y fecha vencida son las que el brief levanta primero.

### 3. `KPIs` (opcional, pero potente)

Una fila por KPI con su objetivo, para ver la brecha de un vistazo:

| fecha | kpi | valor | objetivo | alerta |
|---|---|---|---|---|
| 2026-06-18 | `ticket_promedio_eur` | (tu AOV actual) | 22 | |
| 2026-06-18 | `tasa_conversion_pct` | … | … | |
| 2026-06-18 | `unidades_por_pedido` | … | … | |

---

## El 80/20 — el set mínimo para que el brief sirva HOY

No esperes a tener todo. Con esto ya cobra vida:

1. **~12-15 filas de `Datos_operativos`** = las últimas 2-3 semanas: ventas diarias (con nº de pedidos en `notas`) + los 4-5 costos principales (ads, mercadería, comisiones, sueldos, envíos).
2. **1 proyecto + 3 tareas** hacia "subir AOV".
3. **1 KPI**: `ticket_promedio_eur` actual vs objetivo 22.

Con (1) el Analista calcula tu AOV real y la tendencia; con (2) el brief te da las 3 movidas; con (3) ves la brecha contra el North Star.

---

## Cómo cargarlo

### Opción A — directo en el Sheet (lo más simple para datos reales)

Abrí el Sheet de Vehemence (URL en la fila CLI-002 de la pestaña `Clientes` del MAESTRO) → pestaña `Datos_operativos` → tipeá las filas. Fechas en **`yyyy-mm-dd`**, montos con signo. Para `Proyectos`/`Tareas`, igual pero en el MAESTRO.

### Opción B — función no-arg (si preferís cargar en lote / repetible)

Mismo patrón que `sembrarDatosEjemplo`. Editás los valores reales en la función, la pusheás y la corrés del dropdown (sin argumentos). Plantilla lista para pegar en `src/15_cerebro.js` (o donde prefieras):

```javascript
/** Carga REAL de Datos_operativos de Vehemence (CLI-002). EDITAR con los números reales y correr. */
function cargarDatosVehemence() {
  var sh = abrirCliente('CLI-002').ss.getSheetByName('Datos_operativos');
  if (!sh) throw new Error('CLI-002 sin Datos_operativos');
  var datos = [
    // ↓↓↓ REEMPLAZAR por los datos reales de Vehemence ↓↓↓
    { fecha: '2026-06-01', concepto: 'Ventas del día', valor: 640.00, fuente: 'Shopify', notas: '29 pedidos · 41 unidades' },
    { fecha: '2026-06-02', concepto: 'Ventas del día', valor: 510.00, fuente: 'Shopify', notas: '24 pedidos · 33 unidades' },
    { fecha: '2026-06-03', concepto: 'Publicidad (Meta)', valor: -180.00, fuente: 'Ads Manager', notas: 'campaña remarketing' },
    { fecha: '2026-06-05', concepto: 'Compra de mercadería', valor: -1200.00, fuente: 'Proveedor X', notas: '120 unidades temporada' },
    { fecha: '2026-06-06', concepto: 'Ventas del día', valor: 880.00, fuente: 'Shopify', notas: '38 pedidos · 55 unidades · finde' },
    { fecha: '2026-06-07', concepto: 'Comisiones plataforma', valor: -95.00, fuente: 'Shopify/Stripe', notas: '~2.9% sobre ventas' },
    { fecha: '2026-06-08', concepto: 'Devoluciones', valor: -120.00, fuente: 'Shopify', notas: '6 devoluciones · talle' }
    // … sumá las últimas 2-3 semanas
  ];
  datos.forEach(function (d) { appendFila(sh, d); });
  Logger.log('cargarDatosVehemence: ' + datos.length + ' filas.');
  return { filas: datos.length };
}
```

> Si querés, te dejo esta función ya en el repo lista para pushear — me decís y la agrego.

---

## Después de cargar — qué cambia

- `verVehemence()` deja de mostrar "(sin datos)" → el **Analista** calcula tu AOV real, tendencia y dónde está la palanca para subirlo (igual que hizo el ticket €15,82 del ejemplo).
- `briefDiario('CLI-002')` muestra las 3 cosas reales hacia el objetivo + el movimiento del Vigía.
- El **Director**, en la corrida diaria, encola al Analista **por tu objetivo** (subir ticket) y escribe el "parte".

## Higiene (innegociables)

- **Append-only** en históricos: no edites filas pasadas de `Datos_operativos`, sumá nuevas.
- Fechas **`yyyy-mm-dd`** siempre.
- **Signos**: ingresos +, egresos −. La unidad clave (pedidos/unidades) va en `notas`.
- Datos sensibles del cliente: quedan en SU Sheet (Vehemence), no se mezclan entre clientes.
