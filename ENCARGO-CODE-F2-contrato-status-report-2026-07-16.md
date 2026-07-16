# ENCARGO CODE — Contrato de Status Report v1 (F2 Plan Maestro / bloque 6 PAQUETE 10-jul)

> **Rol:** Cowork planificó y verificó el terreno; Code ejecuta. Metodología de siempre: dry-run → `--go`,
> guardia clasp repo↔GAS, `node --check`, selfTest con asserts nuevos, commit + push /dev. Promote SOLO Luciano.
> **Base:** repo SatoriOS en `dfe726f` o posterior. Leé `HANDOFF.md` y este encargo completo ANTES de tocar código.

## Qué construir

Formato único y FIJO de reporte, aplicado a `briefDiario` (versión corta) y al Informe Mensual KAIROS
(versión completa). **Extiende T2 (juicio anclado, `recomendacionDelDia_`) — NO lo reemplaza.**

**Estructura contractual (orden fijo, 10 secciones):**
1. **BLUF** — 1-3 líneas, cada juicio anclado en un dato citado (patrón T2 existente).
2. **Apertura humana** *(solo brief)* — agenda del día antes de los KPIs (1 línea; la Agenda ya existe desde @19).
3. **Métricas core vs North Star** — con tendencia ("acelerando/frenando"), no solo foto.
4. **Qué se auto-resolvió** + "qué aprendí y ya ajusté" (dentro de mandato, sin pedir permiso por micro-ajuste).
5. **Qué espera TU decisión** — cola de aprobaciones con botón (ya existe `aprobacionDesdeRecomendacion`, T2 B2).
6. **Recomendación priorizada (1-3)** — cada una: dato que la ancla + **contrapeso de riesgo** ("hacé X, pero
   protegé Y") + acción concreta.
7. **Cierre acción→métrica** — lo recomendado el período anterior vuelve con efecto medido ("se hizo X → el
   KPI hizo Y"); usa el lazo F1-F5 existente (juicio `se_hizo`).
8. **Insumos requeridos** de Luciano/cliente — qué necesita el sistema para seguir.
9. **Señal de instrumentación** — qué NO estamos midiendo y debería ("solo capturamos ventas; caja y reseñas
   siguen a ciegas").
10. **Cierre:** "¿Qué manejo primero?" + **feedback 1-clic ¿sirvió? 👍/👎** (P2.1 — registra en hoja `Feedback`;
    el CM ya tiene un widget ¿sirvió? en la rec del día: reutilizá el patrón, no dupliques).

**Direcciones pre-aprobadas (P2.8, diseño chico):** hoja `Direcciones` (id, tipo_accion, alcance/tenant,
aprobada_fecha, vigencia, activa). `crearAprobacion` la consulta: si la acción matchea una dirección vigente →
auto-aprueba + LOGUEA "por dirección DIR-nnn" (trazable, revocable). **Default-deny intacto para todo lo demás.**
Reconciliar schema en `setup()` como siempre.

## Paso 0 (verificar ANTES de construir — media sesión)

Ya verificado por Cowork el 14/16-jul (no re-verificar): **(c) vista de cola + lote de Aprobaciones EXISTE**
(P2 F5) · **(f) brief email llega estable** (`alertaEmail_` existe y corre en `corridaDiaria`).
Queda para Code: (a) qué quedó vivo de "alertas 27-jun" vs B9 · (b) si `clasificarBandeja` ya escala por
confianza X/10 · (d) si la Purga B5 cerró el blindaje de la `pregunta` del analista (si no está, es MUST) ·
(e) si las instructions de `voz/agent/agent.py` traen la regla anti-alucinación numérica TEXTUAL del bloque 9b
del PAQUETE (N4 existe; verificar que cubre "jamás completar con un número de memoria").

## Restricciones Bastión

- Cero escrituras nuevas sin `conLock` + `sanitizarCelda`/`limpiarHostilTexto_` donde el dato pueda ser hostil.
- `Direcciones` es una superficie de AUTO-aprobación: el matcheo debe ser exacto (tipo_accion + tenant),
  con vigencia obligatoria; sin wildcard de tenant; una dirección vencida o `activa=false` NO matchea.
- selfTest: asserts nuevos (contrato renderiza las 10 secciones con datos inyectados · dirección vigente
  auto-aprueba y loguea · dirección vencida NO · feedback escribe en `Feedback`).
- El texto del brief pasa a la voz: mantener el contrato hablable (sin markdown pesado en la versión corta).

## Entregable

Script `_f2_contrato_code.sh` (dry-run/--go, patrón de siempre) + commit + clasp push /dev + actualización
del bloque Verificado del `HANDOFF.md`. Promote y prueba de voz quedan para Luciano.
