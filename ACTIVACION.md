# Puesta en marcha — dejar Satori OS produciendo

> El sistema ya está **construido, pusheado y latiendo** (triggers `corridaDiaria` 07:00 + `drenarCola` cada 5 min). Lo único que falta para que **produzca** es alimentar un cliente con datos. Esta guía es la receta de 5 minutos por cliente.

## Estado base (no hace falta tocar)
- **API**: key seteada y con saldo (tope **USD 25/mes**, ajustable en Script Properties `API_BUDGET_MENSUAL_USD`).
- **Agentes**: 5 activos con runner real — **Vigía** (monitoreo), **Analista** (tendencias/margen), **Conciliador** (banco↔ventas), **Cobrador** (cobranzas, con aprobación), **Abastecedor** (stock, con aprobación). Los otros 8 siguen en laboratorio (sin runner aún).
- **Loop**: `corridaDiaria` encola Vigía por cliente activo + Director (dirige por objetivo) + Salud. `drenarCola` corre lo encolado cada 5 min.

## Receta por cliente (5 min)

### 1) Confirmar el latido (una vez)
Editor GAS → **Activadores** (reloj, panel izq.). Tienen que estar:
- `corridaDiaria` — cada día, 07:00.
- `drenarCola` — cada 5 minutos.

Si faltan, correr **`instalarTriggers()`** una vez.

### 2) Cargar datos del cliente → pestaña `Datos_operativos` (visible)
Pegá los movimientos reales del negocio. Columnas:

| fecha | concepto | valor | fuente | notas |
|---|---|---|---|---|
| 2026-06-15 | Venta mostrador | 1250.00 | TPV | |
| 2026-06-15 | Compra insumos | -340.00 | proveedor X | factura 0012 |
| 2026-06-16 | Factura pendiente | 800.00 | cliente Y | vence 2026-06-30 |

- Fechas **siempre** `aaaa-mm-dd`. Montos con punto decimal. Egresos en negativo si querés que se distingan.
- Con SOLO esto, **Vigía** ya produce un reporte real del negocio. El resto de los agentes leen la misma pestaña.

### 3) (Plus) Cargar objetivos → para que el Director dirija
La pestaña `objetivos` está oculta/protegida, así que se cargan por función. En el editor, abrir `15_cerebro.js` → **editar** `cargarObjetivosPiloto()` con los objetivos reales → **Ejecutar**:

```js
function cargarObjetivosPiloto() {
  cargarObjetivo('CLI-001', { descripcion: 'Subir el ticket promedio', metrica: 'ticket_promedio_eur', valor_objetivo: 25, prioridad: 'A' });
}
```

- Solo los objetivos **con `metrica`** disparan el análisis dirigido del **Analista** vía Director.
- `idCliente` es el código del cliente (`CLI-001`, etc. — está en la pestaña `Clientes` del MAESTRO).

### 4) Verlo correr
- **Ya mismo** (sin esperar a las 07:00): en el editor correr **`corridaDiaria()`**. Encola Vigía + Director; en ≤5 min `drenarCola` los corre (o corré `drenarCola()` a mano).
- **O** desde el **Command Center** (🛰): elegí el cliente arriba y tocá un agente (Vigía/Analista) para dispararlo.
- Los resultados aparecen en **Actividad** (feed) y, si un agente con gate (Cobrador/Abastecedor) propone algo, en **Aprobaciones** (lo aprobás vos: nada sale sin tu OK).

## Qué esperar
- **Vigía**: estado general + anomalía + el dato a mirar hoy.
- **Analista**: respuesta con números al objetivo cargado (ej. margen, ticket).
- **Cobrador/Abastecedor**: propuesta que queda **pendiente de tu aprobación** (default-deny).
- Sin datos → cada agente lo dice honesto, no inventa.

## Límites (a propósito)
- Nada externo se envía sin tu aprobación (emails de Cobrador, etc.).
- Gasto API capado al tope mensual; Vigía nunca se frena, el resto sí al llegar al tope.
- Los 8 agentes de laboratorio se activan cuando se les defina capacidad y fuente de datos (futuro / E8b).
