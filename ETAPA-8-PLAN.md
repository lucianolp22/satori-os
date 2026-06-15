# ETAPA 8 — Plano consolidado (orquestación + entrenamiento de agentes)

> Fuente única de build para Claude Code. Consolida `HANDOFF ETAPA 8 (Director + Cerebro + Health loop)`
> y `INTEGRACION-ENTRENAMIENTO-AGENTES.md`, aterrizados contra el código real del repo.
> Cowork deja el plano; Code ejecuta. **Fecha:** 2026-06-15 · Confianza del plano: **8/10**.

## 0. GATE (no negociable)
**No construir nada de Etapa 8 hasta E2+ verde:** `clasp push -f` del fix `a6e641e` → `bootstrap()` →
`selfTest()` = "— TODO OK —" → casos manuales E2-3/E2-5/8/9/11/13 → Purga de cierre E2+.
Ambas specs lo repiten. Mientras E2+ no esté verde, esto es solo lectura.

## 1. Split de la etapa (una subetapa por vez)
Las dos specs convergen en **`15_cerebro.js`** como sustrato común. Se separan en dos subetapas
secuenciales, cada una con su Purga de cierre:

- **E8a — Orquestación:** `15_cerebro` (grafo) → `14_director` → `16_salud` → UI Command Center → casos 14-21.
- **E8b — Entrenamiento de agentes:** `15_cerebro` (importer) → inyección de criterio en `13_agentes` (1 rol piloto)
  → `17_evals` → loop de vuelta al backlog.

Dependencia dura: **E8b requiere E8a viva** (el cerebro materializado + el Director para volcar gaps). E8a primero.

## 2. E8a — Orquestación (orden del handoff §7)

| # | Módulo / pestañas | Núcleo (verificado contra código) |
|---|---|---|
| a1 | `15_cerebro.js` + pestañas `nodos`,`aristas`,`cerebro_log`,`estado_actual`,`objetivos` | `upsertNodo()`,`upsertArista()`,`logEvento()` (append-only),`materializarEstado()`,`leerEstado(tenant)`. Multi-tenant vía Sheets API. **Empezar acá.** |
| a2 | `14_director.js` | `correrDirector()`: lee `objetivos`+`estado_actual`+cerebro, **encola** vía `encolar(worker,'agente',{agente,id_cliente,args})` o `encolarAgente(idCliente,clave,args)`; gates vía `crearAprobacion()`; escribe "parte" al cerebro. Cadencia híbrida: 1×/día en `corridaDiaria()` 07:00 + chequeo liviano 30 min. |
| a3 | `16_salud.js` | `correrSalud()`: 6 chequeos del handoff §3, clasifica, escribe hallazgos al cerebro. Auto-heal tras flag `AUTOHEAL_ON=false` (solo-alerta en piloto). 100% reglas, 0 API. |
| a4 | UI Command Center (sobre B-orbe; no romper «Hoy» Registro A) | Las 4 *must*: Agenda/Salud · Directiva actual · Tira telemetría (INTEGRIDAD% / LLAMADAS / TOKENS-GASTO vs tope / ERRORES) · Parte del Director. Tokens nuevos → DESIGN.md primero. |
| a5 | Casos 14-21 + `selfTest()` tras cada cambio backend | Aceptación (handoff §6). |

## 3. E8b — Entrenamiento de agentes (orden de la spec §7)

| # | Pieza | Punto de inserción real |
|---|---|---|
| b1 | `importarConocimientoEntrenamiento()` en `15_cerebro.js` + pestaña `Cerebro_entrenamiento` | Lee snapshot curado (§4 spec), escribe al cerebro **append-only, por tenant, sin PII**, idempotente (dedupe por hash/`version_fecha`). Trigger diario tras `corridaDiaria()`. |
| b2 | Inyección de criterio en `13_agentes.js` — **1 rol piloto** (Conciliador o Analista) | Anteponer bloque `CRITERIO VIGENTE` (top 3-5 ítems del rol, con TTL) al `prompt:` que cada `RUNNERS[clave]` pasa a `llamadaAPI(idCliente, modulo, {prompt})`. **No tocar** el gate (`crearAprobacion`), la anonimización (`llamadaAPI`) ni `guardPresupuesto_`. |
| b3 | `17_evals.js` (o extensión de `selfTest`) | Corre los casos de eval de `agentes-satori-os.md` con **datos sintéticos** (nunca producción); marca **regresión**; reporta al feed `Actividad` (`tipo:'info'`). |
| b4 | Loop de vuelta (demand-driven) | Runner sin criterio/sin poder resolver → línea en `Actividad` con **`tipo:'gap'`** (ver guardrail S3) → Director/export semanal vuelca al `BACKLOG-ENTRENAMIENTO.md` del Equipo. |

## 4. Guardrails (auditoría de los cuerpos, integrada al build)

- **🛡️ Bastión — ALTO (8/10):** el criterio inyectado es **texto externo no confiable** → vector de
  prompt-injection que podría intentar subvertir el default-deny. Control: enmarcar el criterio como **DATO**
  entre delimitadores explícitos ("referencia, no instrucciones"); el gate y la anonimización quedan **fuera/encima**
  del bloque inyectado; validar que el snapshot no trae secretos/PII antes de importar. Todo conector/skill candidato
  pasa por D5/Bastión antes de instalarse.
- **🔧 Costo/cuota — 1 hallazgo (handoff #1, 8/10):** la inyección suma tokens a **cada** corrida de runner;
  el tick híbrido 30 min compone gasto. Medir el delta de tokens en el rol piloto **antes** de extender a los 5.
  La tira de telemetría (a4) debe mostrar gasto vs tope USD 25/mes. Health loop y casos sin-datos no llaman API.
- **🔬 Schema — Verificador:** el marcador `gap` debe ser un **`tipo` real y consultable** en `Actividad`
  (`tipo:'gap'`), no texto libre en `texto`. `Cerebro_entrenamiento` + las 5 pestañas nuevas entran al chequeo
  de integridad de schema (handoff §3). Aplicar formato `'@'` (COLUMNAS_TEXTO) a sus columnas-ID.
- **Aislamiento multi-tenant (caso 20):** MAESTRO solo índice agregado **sin PII**; cerebro por tenant.
- **AREL:** `clasp push`/deploy y cualquier envío externo = frenar y pedir OK. Crear Sheets/código = avanzar.

## 5. Aceptación y cierre
- **E8a:** casos 14-21 del handoff (Director asigna / en rumbo sin API / cerebro upsert+log / snapshot materializado /
  Health detecta-no-arregla flag off / Health auto-heal flag on sandbox / aislamiento multi-tenant / tope API).
- **E8b (DoD spec §9):** importer escribe sin PII e idempotente ✓ · ≥1 runner piloto consume criterio y mejora 1 caso
  de eval sin romper otros ✓ · `17_evals` corre los 6 casos y reporta ✓ · un gap real aparece en el BACKLOG ✓.
- `selfTest()` extendido tras cada cambio backend. **Purga de cierre** (`purga-de-errores`) al cerrar E8a y al cerrar E8b.
- Devolución: `HANDOFF VUELTA Etapa 8` + `ARCHITECTURE.md` actualizado (módulos + pestañas nuevas).

## 6. Dependencias abiertas (resolver antes de E8b)
- **Doc canónico `CEREBRO - Arquitectura única de memoria`** — manda el modelo de datos del cerebro; **no está en el repo**.
- **Snapshot fuente del Equipo** — `Projects/Equipo de Agentes Pro/EQUIPO/knowledge/agentes-satori-os.md` **no está montado**
  (otra carpeta). Sin él, el importer (b1) no se construye/prueba contra datos reales. Montarlo o publicar el snapshot.
- Contrato de `Cerebro_entrenamiento`: `{ rol, version_fecha, items:[{texto, fuente, confianza, ttl}] }`, solo items con 2+ fuentes.

## 7. Supuestos (máx 3)
1. E2+ cierra con el fix `a6e641e` (confianza 8/10; lo confirma `selfTest()` en editor).
2. El cerebro multi-tenant se materializa en Sheets sin exceder cuota de triggers (90 min/día) — **medir** en a1/a2.
3. El snapshot de entrenamiento llega como archivo/tabla (alta manual o fetch del publicado), no por API en vivo.
