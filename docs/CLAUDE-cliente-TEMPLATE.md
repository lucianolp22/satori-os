# CLAUDE.md — {{NOMBRE CLIENTE}} ({{CLI-0XX}})

> Plantilla v1 (03-jul-2026). Copiar a `~/Documents/Claude/Projects/{{Cliente}}/CLAUDE.md` y completar. ≤60 líneas: lo voluminoso se linkea, no se pega.

## Regla de oro
- Leer PRIMERO: `_cerebro/MOC - {{Cliente}}.md` (estado) + el HANDOFF vigente del cliente si existe.
- No asumir hojas/columnas/funciones: verificarlas en el Sheet o preguntarle a Luciano.
- Todo dato fiscal/legal: prudencia, fuente vigente, confianza X/10. No sustituye asesor habilitado.

## Qué es
- Cliente de Satori (consultoría). Rubro: {{rubro}}. Jurisdicción: {{ES/AR}}. Moneda operativa: {{EUR/ARS}}.
- Servicio activo: {{S1/S2/S3/S4 + nivel retención}}. Fase KAIROS: {{F1–F6}}.
- Responsable lado cliente: {{nombre y rol}}.

## Satori OS (sistema)
- `id_cliente`: {{CLI-0XX}} · Sheet cliente: {{URL}} (pestañas visibles: `Datos_operativos`, `KPIs`; el resto ocultas/protegidas).
- North Star: {{métrica + valor objetivo + moneda}} — cargado vía `cargarObjetivo` el {{fecha}}.
- Conector: {{ninguno (carga manual) / nombre función en 19_conectores.js + fuente + validación al peso: fecha}}.
- El MAESTRO agrega sin PII. **No cargar PII del cliente final en la Bandeja personal.**

## Datos y convenciones
- `Datos_operativos`: fechas `aaaa-mm-dd`, punto decimal, ventas +, costos −, unidad en `notas`.
- Fuentes del negocio: {{TPV/banco/ERP/planillas — dónde vive cada una}}.
- Particularidades: {{ej. IVA reducido hostelería / monotributo proveedores / estacionalidad}}.

## Límites (no negociables)
- Nada externo (emails, mensajes, pagos) sin aprobación explícita de Luciano (default-deny del OS).
- No compartir el Sheet con el cliente sin revisión Bastión (Etapa 3).
- Decisiones de precio/alcance del engagement: las toma Luciano.

## Historial mínimo
- Alta: {{fecha}} · Últimos hitos: {{2–3 líneas máx, el detalle vive en el MOC}}.
