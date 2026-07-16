# ENCARGO CODE — Mantenimiento: dieta Cola_tareas + avisos agrupados + rename fila OV (16-jul, OK dado)

> **Rol:** Cowork diseñó, Luciano dio OK; Code ejecuta. Dry-run → `--go`, guardia clasp, `node --check`,
> selfTest, commit + push /dev. Promote SOLO Luciano. Contexto completo en
> `SPEC-GAS-brief-lento-doPost-2026-07-14.md` (sección "PROPUESTA APARTE") y `HANDOFF.md`.

## 1 · Dieta de `Cola_tareas` — **Opción A: archivar** (decisión tomada)

**Problema medido (14-jul):** `estadoAgentes` hace `leerTabla(Cola_tareas)` SIN poda (~857 filas y creciendo)
en cada poll del CM (15s) y en el doPost de voz → costo fijo que crece sin límite.

**Diseño:** hoja `Cola_archivo` (mismo schema). `archivarColaVieja_()` mueve filas con estado terminal
(`hecha`/`error`/`cancelada`) y antigüedad > **30 días**, bajo `conLock`, bottom-up, batch. Hook al final de
`corridaDiaria` (después del warm del brief). `estadoAgentes`/telemetría siguen leyendo solo `Cola_tareas`.

**Los 2 riesgos detectados — mitigaciones OBLIGATORIAS:**
- **Conteo de errores subcontado:** si la telemetría cuenta errores del mes desde la cola, archivar se los
  come. Mitigación: horizonte de archivo (30d) ≥ ventana de conteo, o el contador suma `Cola_archivo` del
  período. Verificá primero DÓNDE se cuentan los errores y dejalo asserted en selfTest.
- **Último-estado-por-agente:** si el estado de un agente se deriva de su última fila en la cola, archivar la
  última fila de un agente quieto lo deja "sin estado". Mitigación: `archivarColaVieja_` NUNCA archiva la fila
  más reciente de cada agente (aunque sea vieja y terminal).

selfTest: asserts (archiva vieja terminal · NO archiva pendiente/en_curso · NO archiva la última por agente ·
conteo de errores del período intacto pre/post archivo · idempotente).

## 2 · Avisos `tarea_estancada` agrupados

**Problema:** 18 avisos individuales `tarea_estancada` saturan la bandeja (y el resumen por email).
**Diseño:** el generador (06_avisos) emite **1 aviso resumen** cuando hay >3 estancadas: "N tareas estancadas
(las 3 más viejas: TAR-x, TAR-y, TAR-z…)" con dedupe por baseline (patrón existente), en lugar de N avisos.
Los 18 avisos existentes: resolverlos por baseline en la misma corrida (patrón del bonus SGIC). selfTest: con
5 estancadas inyectadas → 1 aviso, no 5; con 2 → individuales.

## 3 · Rename fila "Negocio paralelo pausado" (UX)

**Problema:** en `CLI-000/Datos_operativos` la fila concepto **"Negocio paralelo pausado"** + valor `no` se lee
como si la Oficina ESTUVIERA pausada (ya causó un falso diagnóstico el 14-jul).
**Diseño:** concepto → **"Oficina Virtual — kill-switch (np_pausado)"** con valor `no`/`sí`. OJO compatibilidad:
esa fila la escribe el sync de la OV (`oficina_sync` doPost, reemplazo idempotente por fuente) y puede leerla
el CM/brief → actualizar ESCRITOR y LECTORES juntos, y verificar que el reemplazo idempotente matchea por el
concepto nuevo (que no queden fila vieja + nueva conviviendo: migrar/borrar la vieja en el mismo cambio).

## Entregable

Script `_mant_cola_code.sh` (dry-run/--go) + commit + clasp push /dev + HANDOFF actualizado. Nada de esto
toca la voz ni la UI; riesgo bajo, pero el archivo de cola es DESTRUCTIVO-móvil: bottom-up + lock + selfTest
antes del --go.
