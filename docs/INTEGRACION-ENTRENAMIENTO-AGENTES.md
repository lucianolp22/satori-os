# Integración: Entrenamiento del Equipo → Agentes del Satori OS

**Estado:** SPEC para construir en la ventana **E2+/Etapa 8 (~26-jun)**. NO construir antes de cerrar E2+ (`selfTest()` verde + casos manuales). Cowork deja el plano; Claude Code ejecuta. Alineado con `ARCHITECTURE.md`, `ETAPA 8 - Capa de orquestacion`, y el doc canónico `CEREBRO - Arquitectura unica de memoria`.
**Fecha:** 2026-06-15 · **Autor:** Equipo de Agentes Pro (Archivista Mayor)

---

## 1. Qué problema resuelve
Los 5 agentes activos (`13_agentes.js`: Vigía, Conciliador, Cobrador, Analista, Abastecedor) corren con **prompt fijo**. Hoy no se nutren de la inteligencia que el Equipo de Agentes acumula a diario (fiscal ES/AR, seguridad, técnicas, herramientas). Esto los conecta: el **Equipo CURA** conocimiento → el **OS lo CONSUME** en el Cerebro y en el criterio de cada runner. Barra más exigente porque tocan el negocio real (plata, stock, cobranzas).

## 2. Fuente del conocimiento (lado Equipo, ya existe)
- **Track operativo** (curado a diario, por agente, con casos de eval): `Projects/Equipo de Agentes Pro/EQUIPO/knowledge/agentes-satori-os.md`.
- Capa transversal IA: `…/knowledge/transversal-ia.md`. Seguridad/fiscal: `…/knowledge/d5-seguridad.md`, `d6-finanzas-fiscal.md`.
- Backlog demand-driven (vuelta): `…/knowledge/BACKLOG-ENTRENAMIENTO.md`.
Formato: Markdown por agente (Vigente + casos de eval). El puente exporta SOLO la tajada relevante por rol, no todo (context engineering).

## 3. Qué construir en el OS (3 piezas; todas en la ventana E2+/Etapa 8)

### 3.1 Importador al Cerebro — `15_cerebro.js`
- `importarConocimientoEntrenamiento()`: lee el snapshot curado (§4) y lo escribe en el Cerebro, **append-only, por tenant, sin PII**. Idempotente (dedupe por hash o `version_fecha`; no duplica).
- Cadencia: trigger diario tras `corridaDiaria()` (07:00) o manual. TZ **Europe/Madrid**.
- MAESTRO solo índice agregado sin PII (regla del doc canónico de Cerebro).

### 3.2 Inyección de criterio por runner — `13_agentes.js`
- Cada runner antepone a su prompt un bloque **"CRITERIO VIGENTE"** leído del Cerebro para SU rol (p. ej. Conciliador ← criterio contable conservador de D6; Analista ← "sin hype, correlación≠causalidad").
- **Mínimo y de alta señal**: top 3-5 ítems por rol (evitar context rot). Con TTL: descartar ítems vencidos.
- No romper el contrato actual: anonimización vía `llamadaAPI()`, cupos `guardPresupuesto_()`, gate **default-deny** intacto.

### 3.3 Eval harness — nuevo `17_evals.js` (o extensión de `selfTest`)
- Corre los **casos de eval** de `agentes-satori-os.md` contra cada runner con **datos sintéticos** (nunca producción).
- Mide cumplimiento de la salida esperada; marca **regresión** si un cambio de prompt/criterio empeora un caso.
- Cadencia: al cambiar un prompt + semanal. Resultado al feed `Actividad` (tipo `info`).

## 4. Contrato del snapshot (cómo viaja el conocimiento)
Recomendado (simple, GAS-friendly): el Equipo mantiene un archivo canónico por rol; el OS lo copia a una pestaña `Cerebro_entrenamiento` del MAESTRO (alta manual o fetch del publicado).
- Estructura mínima (JSON o tabla): `{ rol, version_fecha, items:[{texto, fuente, confianza, ttl}] }`.
- Reglas: solo items con **2+ fuentes**; con **TTL** (fiscal/CVEs vencen); el OS descarta vencidos al importar.
- Seguridad: el snapshot **no** lleva secretos ni PII. Todo conector/skill candidato pasa por **D5/Bastión** antes de instalarse (40+ CVEs de MCP).

## 5. Loop de vuelta (demand-driven, el OS dirige su propio entrenamiento)
Cuando un runner no puede resolver algo o le falta criterio → deja en el feed `Actividad` una línea `tipo:'info'` marcada `gap`. Un export semanal (o el Director, Etapa 8) vuelca esos gaps al `BACKLOG-ENTRENAMIENTO.md` del Equipo → el entrenamiento los prioriza al día siguiente. Así el negocio real tira del entrenamiento, no al revés.

## 6. Barra de exigencia (no negociable)
- **Fiscal ES/AR**: criterio conservador, confianza X/10; nunca afirmar vigencia de una norma sin fuente fresca.
- **Seguridad**: coordina con Bastión; Cobrador y Abastecedor (gate) **nunca** ejecutan solos (default-deny ya vigente).
- **Honestidad**: sin datos → lo dicen, no inventan (ya es regla en los runners; el entrenamiento la refuerza, no la afloja).

## 7. Orden de ejecución (cuando E2+ esté verde)
1. `15_cerebro.js` + pestaña `Cerebro_entrenamiento` (importador §3.1).
2. Inyección de criterio en `13_agentes.js` — **un rol piloto primero** (sugerido: Conciliador o Analista).
3. `17_evals.js` con los casos espejo del selfTest (§3.3).
4. Loop de vuelta al backlog (§5).
5. Verificar con `selfTest()` extendido antes de declarar hecho.

## 8. Qué NO hacer
- No construir antes de cerrar E2+ (`selfTest()` verde + casos manuales del `ARCHITECTURE.md`).
- No volcar todo el knowledge base al prompt (context rot): solo la tajada de alta señal por rol.
- No instalar skills/conectores de fuente no confiable; pasan por D5/Bastión.
- No tocar el gate de aprobaciones ni la anonimización al inyectar criterio.

## 9. Definición de "hecho"
- `importarConocimientoEntrenamiento()` escribe en el Cerebro sin PII y es idempotente. ✓
- Al menos 1 runner piloto consume criterio vigente y mejora un caso de eval sin romper otros. ✓
- `17_evals.js` corre los 6 casos y reporta al feed. ✓
- Un gap real generado por un runner aparece en el BACKLOG del Equipo. ✓
