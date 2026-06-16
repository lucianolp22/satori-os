# E8a4 — Brief de diseño del Command Center (UI a4)

> Fuente de diseño: **skill `satori-design`** (reemplaza a `DESIGN.md`). Output vanilla GAS-compatible
> (HtmlService, `textContent`, sin frameworks). Construir con la skill, no inventar tokens. **Fecha:** 2026-06-15.

## 1. La visión (integración de 3 referencias de Luciano)
1. **Sureflow Agentic OS** (screenshot): el "layout funcional". Un **cerebro de mando (CEO/Orchestrator)**
   que coordina N especialistas; cada agente es una **card** con estado (`working`/`waiting`/`idle`),
   **modelo**, **contadores** (ROUTES/READS), rol y descripción. Sidebar de navegación (Command Center,
   Agents, Tasks, Schedule, Tools, Pipeline, Analytics, Knowledge Vault). Header con estado global
   ("Agentic System Operational") + reloj.
2. **Z.E.R.O / brain** (video 1): la "identidad viva". El sistema como un **cerebro/red neuronal 3D**
   en fondo espacio, nodos que **disparan** (firing %), regiones etiquetadas, agentes y herramientas como
   nodos que se prenden en tiempo real. Palabras de estado: HELD → ON → RUN. "LIVE 02/07", "parallel minds".
3. **Trillion / Flux** (video 2): la "constelación + móvil". Agentes como avatares en una **constelación**
   ("X is editing now"), y —clave— **el control desde el TELÉFONO**: un **orbe verde** vivo en el móvil.

**Síntesis Satori:** el Centro de Mando es **el Director (cerebro de mando) rodeado por los agentes como
nodos vivos**, sobre fondo espacio, glow/firing en tiempo real con DATOS REALES nuestros (estado de la cola,
feed, presupuesto), navegable y **operable desde el móvil**. El "orbe" del plan original sube de nivel a esto.

## 2. Mapeo a lo que YA tenemos (encaja directo)
| Referencia | Satori OS real |
|---|---|
| CEO/Orchestrator (command brain) | **Director** (`correrDirector`, 14_director.js) |
| 5 especialistas | **5 agentes activos** (Vigía/Conciliador/Cobrador/Analista/Abastecedor) + 8 laboratorio |
| Estado working/waiting/idle | `estadoAgentes()` → estado real de la cola (08_webapp.js) |
| ROUTES / READS / model | llamadas/lecturas + `claude-haiku-4-5` (Consumo_agentes / Costos_API) |
| Tools como nodos | el registry de agentes + (futuro) herramientas |
| Brain / neuronas | **el cerebro real** (`15_cerebro.js`: nodos/aristas) → la viz PUEDE ser el grafo |
| "X is editing now" / firing | feed `Actividad` en vivo |
| Inbox / aprobar | `inboxAprobaciones_` + `resolverAprobacionUI` (gate E2) |

Las **4 _must_** del plan caen como paneles: **Agenda/Salud** (loop `correrSalud`), **Directiva actual**
(último `parte_director`), **Tira de telemetría** (INTEGRIDAD% / LLAMADAS / TOKENS-GASTO vs tope / ERRORES),
**Parte del Director**.

## 3. Plan de construcción (fasear para no morir en el intento)
**a4.1 — Command Center funcional (primero, verificable):** dashboard estilo Sureflow, **mobile-first**.
Director-card central + grid de agent-cards con estado/modelo/contadores reales (`estadoAgentes`), feed en
vivo, inbox de aprobaciones (aprobar con el dedo), tira de telemetría, panel de Salud. Tema oscuro
"espacio" con glow. **No romper la vista «Hoy» (Registro A).** Datos vía `google.script.run`.

**a4.2 — El "orbe vivo" (después):** canvas en fondo espacio: el Director como núcleo, los agentes como
**nodos en órbita que disparan** (glow/partículas) según su estado real; activos vs laboratorio en órbitas
distintas; opción de renderizar el **grafo del cerebro** (nodos/aristas) como la red neuronal. ⌘K / tap para
abrir.

**Realismo (Estratega de límites + Bastión):** GAS HtmlService corre en un iframe sandbox con límites de
performance. **Canvas-2D con glow/partículas** (como el B-orbe original, elevado) es el punto dulce y llega
muy cerca de la estética. El **3D/WebGL del video 1** es la aspiración; si va lento en GAS, se degrada a 2D.
La fidelidad exacta de Z.E.R.O/Trillion son demos de producto pulidas — apuntamos a "primo cercano on-brand",
no copia pixel.

## 4. Móvil (requisito explícito)
La Web App es HTML → **responsive**. Se abre el `/dev` (o un `/exec`) **en el teléfono, logueado como el
dueño** → control total desde el móvil (ver estado, aprobar del inbox, disparar un agente, leer el parte).
a4.1 se diseña **mobile-first** (el desktop es el caso fácil). Caveat: requiere sesión Google del dueño en el
browser del teléfono (no es app nativa; es la Web App).

## 5. Pendiente / decisiones para Luciano (mañana)
- Confirmar el faseo a4.1 → a4.2 (funcional primero, orbe después) o ir all-in al orbe.
- Paleta: ¿el verde del video 2, o la paleta de `satori-design`? (la skill manda).
- Nombre en la UI: "Centro de Mando" / "Command Center" / otro.
- Verificación: la UI **no se auto-verifica** por el iframe cross-origin de GAS → la prueba Luciano en
  desktop y en el teléfono.
