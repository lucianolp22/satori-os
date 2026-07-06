# CLAUDE.md — DEMO Bistró Ejemplo (CLI-006)

> **EJEMPLO del drill B2 (03-jul-2026)** — validación en seco de la Fase 7 del SOP: así queda `docs/CLAUDE-cliente-TEMPLATE.md` completado para un cliente real. El DEMO fue dado de baja al cerrar el drill; este archivo se conserva como referencia de formato. Con un cliente real, esto vive en `~/Documents/Claude/Projects/<Cliente>/CLAUDE.md`.

## Regla de oro
- Leer PRIMERO: `_cerebro/MOC - DEMO Bistró Ejemplo.md` (estado) + el HANDOFF vigente del cliente si existe.
- No asumir hojas/columnas/funciones: verificarlas en el Sheet o preguntarle a Luciano.
- Todo dato fiscal/legal: prudencia, fuente vigente, confianza X/10. No sustituye asesor habilitado.

## Qué es
- Cliente de Satori (consultoría). Rubro: Gastronomía (restaurante). Jurisdicción: ES (Barcelona). Moneda operativa: EUR.
- Servicio activo: S1 — Diagnóstico y Estructura Interna (drill). Fase KAIROS: F1 REVELAR.
- Responsable lado cliente: Dueño Demo (ficticio).

## Satori OS (sistema)
- `id_cliente`: CLI-006 · Sheet cliente: https://docs.google.com/spreadsheets/d/1LU007RjzhxHQfkzqv5mzBEhrOfylAsunz8FL9paUZYA/edit (pestañas visibles: `Datos_operativos`, `KPIs`; el resto ocultas/protegidas).
- North Star: ticket_promedio_eur = 25 € — cargado vía `cargarObjetivo` el 03-jul-2026 (OBJ-0001, prioridad A, 12m).
- Conector: ninguno (carga manual — datos sembrados con `sembrarDatosEjemplo`, 18 filas jun-2026).
- El MAESTRO agrega sin PII. **No cargar PII del cliente final en la Bandeja personal.**

## Datos y convenciones
- `Datos_operativos`: fechas `aaaa-mm-dd`, punto decimal, ventas +, costos −, unidad en `notas`.
- Fuentes del negocio: TPV (ventas diarias con cubiertos en notas), proveedores (facturas con vencimiento en notas), nómina, alquiler.
- Particularidades: IVA reducido hostelería; ticket fin de semana > semana; eventos privados con señas parciales.

## Límites (no negociables)
- Nada externo (emails, mensajes, pagos) sin aprobación explícita de Luciano (default-deny del OS).
- No compartir el Sheet con el cliente sin revisión Bastión (Etapa 3).
- Decisiones de precio/alcance del engagement: las toma Luciano.

## Historial mínimo
- Alta: 03-jul-2026 (drill B2, función temporal `tmp_altaDemoB2`) · Vigía corrió con éxito 17:33 (detectó cobro pendiente evento + vencimiento factura bebidas — anomalías sembradas a propósito) · Baja: 03-jul-2026 al cierre del drill (estado `baja`; Sheet conservado como referencia).
