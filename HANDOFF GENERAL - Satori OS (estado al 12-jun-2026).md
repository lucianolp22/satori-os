# HANDOFF GENERAL — Satori OS · estado al 12-jun-2026

**Para retomar en conversación nueva: leer esto + montar las carpetas "Videos analizados" y "SatoriOS". Modo ejecutor desde el primer mensaje; "avanzá" es el gatillo. No re-explicar el proyecto.**

## 1. Qué es esto

**Satori OS**: sistema interno de gestión integral de Luciano (clientes, proyectos, tareas, avisos, observaciones, aprobaciones) sobre GAS + Google Sheets. Es la BASE; después viene el **"Sistema de gestión inteligente y consciente"** (producto multi-rubro para clientes — NUNCA llamarlo "dashboard"). Origen: análisis de un reel (second brain de negocio) → investigación profunda → plan etapado.

## 2. Decisiones registradas (no rediscutir)

1. Satori OS primero; piloto cliente = **Vehemence** (indumentaria; Tiendanube + banco), NO MesaQuince.
2. Topología: **Sheet por cliente + MAESTRO agregador**; sync vía GAS (no IMPORTRANGE); cero código en Sheets cliente; un solo proyecto GAS.
3. Capa de aprobaciones = el "consciente": draft-then-approve, gates por umbral €, cola de excepciones, **default deny**, el silencio nunca aprueba, append-only.
4. Costos de API: wrapper único, registro en USD + conversión € mensual, **widget por cliente** (pedido explícito).
5. Cuenta: gmail consumer + Google One (One NO cambia cuotas GAS: 90 min triggers, 20k UrlFetch, 100 emails/día). Workspace se presupuesta para el piloto si hace falta.
6. **Precios Satori SIEMPRE "+ IVA"** (regla permanente). Diagnóstico de entrada: 690 € + IVA, 3 sesiones (2 relevamiento + 1 entrega). Primer candidato: SIP Coffee Roasters.
7. UI: Registro **A** de DESIGN.md (dashboard/ERP operativo; está en esta carpeta). Cambios estéticos se proponen EN DESIGN.md primero.
8. Secuencia: un rubro/cliente por vez; paralelo solo como excepción dirigida por Luciano. Clientes: FRANFLACA/Mesaquince, Vehemence, LC Travel, Barbería Alex/DAM (sistemas 🔧), SIP (potencial 🎯).

## 3. Estado por etapa

| Etapa | Estado |
|---|---|
| 0 Fundaciones | ✅ Cerrada — 5 docs (mapa de nodos, spec aprobaciones, modelo de datos, fit-check, oferta diagnóstico) |
| 1 Núcleo Satori OS | ✅ **Cerrada 12-jun**: backend + Web App construidos por Claude Code, bootstrap y selfTest verdes en GAS real (27 checks), Purga ejecutada, **Lote A aplicado y verificado** (incl. formula injection confirmada empíricamente y neutralizada). **EN VALIDACIÓN de uso 2 semanas** (hasta ~26-jun) |
| 2 Aprobaciones + costos + seguridad | 📋 Especificada (`ETAPA 2 - Especificación...md`), se construye al cerrar la validación. Incluye **Lote B de la Purga** (anotado en ARCHITECTURE.md del repo) |
| 3 Piloto Vehemence | Pendiente — precondiciones en plan 3.1 (autorización formal, scopes Tiendanube, ingesta bancaria, COGS) |
| 4 Diagnóstico (refinar) | Oferta definida en 0.5; falta vender el primero (SIP) |
| 5 Escala/licencia | Futuro |

## 4. Infraestructura técnica

- Repo: `~/Documents/Claude/Projects/SatoriOS` (git, 4+ commits; `.clasp.json` local y gitignored — el scriptId vive ahí, no se publica). `clasp push -f` sube `src/`; cuenta llopriore@gmail.com.
- MAESTRO Sheet: ID en Script Properties (`MAESTRO_ID`); 9 pestañas per 0.3. 5 clientes cargados (CLI-001…005) con Sheets propios (URLs en pestaña Clientes).
- Trigger diario `corridaDiaria` 07:00 Europe/Madrid (expira→sync→detectores). Web App deploy "solo yo", `executeAs: USER_DEPLOYING`. UI: `src/index.html` vanilla, tokens DESIGN.md, claro/oscuro.
- Índice del código: `ARCHITECTURE.md` del repo (leerlo ANTES de tocar código). Docs por flujo en `docs/`.
- `src/11_repro.js` es temporal (repro formula injection) — **eliminar en la próxima sesión de Code**.
- selfTest(): verificación end-to-end auto-limpia (pre-clean + try/finally). Correrlo tras cada cambio de backend.

## 5. Reglas de trabajo (resumen operativo)

Luciano dirige/aprueba, Cowork analiza/planifica/audita, Claude Code ejecuta código (handoffs .md en esta carpeta; Luciano solo lanza Code en Terminal y corre funciones que exigen OAuth en el editor de Apps Script). Test AREL antes de accionar. Skills activas de fondo: ejecución supervisada, Círculo Satori, Bastión; Purga al cierre de cada etapa (montar carpeta SatoriOS para purgar código real). Verificar antes de declarar hecho; confianza X/10 donde importe.

## 6. Pendientes inmediatos

1. **Luciano (en curso):** usar Satori OS 2 semanas con datos reales; cargar Proyectos/Tareas a mano; **fechas SIEMPRE `yyyy-MM-dd`** (bug latente conocido, fix en Lote B); anotar fricciones para E2.
2. **Vender el diagnóstico a SIP** — checklist y guion listos (`DIAGNOSTICO SIP - Checklist...md`). No depende de nada técnico.
3. **Al cerrar validación → construir E2** (spec lista + Lote B + mejoras UI aprobadas: saludo contextual, timestamp de sync legible, quitar jerga "stub" de la UI, command palette ⌘K estilo ninja-keys, inbox de aprobaciones con teclado).
4. **Post-piloto:** capa de voz + orbe funcional (referencias en `REFERENCIA - Capa de voz...md` y `REFERENCIAS - UI tipo Jarvis...md`).
5. Antes de E3: confirmar autorización de datos de Vehemence (doc breve, encargo de tratamiento simple).

## 7. Archivos de esta carpeta (fuente de verdad)

`2026-06-10 - PLAN SATORI OS - Plan de acción etapado.md` (v2, plan maestro) · `ETAPA 0.1...0.5` (fundaciones) · `ETAPA 2 - Especificación` · `HANDOFF ETAPA 1 - Claude Code` + `HANDOFF VUELTA ETAPA 1` · `PURGA ETAPA 1 - Hallazgos y remediación` (Lote B vigente) · `DIAGNOSTICO SIP - Checklist y guion` · `DESIGN.md` (fuente única estética) · `REFERENCIA - Capa de voz y UI Jarvis` + `REFERENCIAS - UI tipo Jarvis y patrones útiles` + `REF voice-orb UI.jpg` · informes origen (reel kzzy47 + investigación profunda).

## 8. Próximo paso al retomar

Si la validación sigue en curso: apoyar el uso (carga de datos, fricciones) o avanzar el diagnóstico SIP. Si la validación cerró: **ejecutar `HANDOFF E2+ - Claude Code (integración Trillion).md`** (el handoff de E2 ya está escrito; no redactar otro).

## 9. ADENDA 12-jun (tarde) — Capa Trillion incorporada al plan

- Sesión Cowork analizó Trillion (Kevin Fremon) + 4 reels de recursos UI + prompt cloud-to-local. Decisiones nuevas: **roster de 13 sub-agentes** (5 activos: Vigía/Conciliador/Cobrador/Analista/Abastecedor + 8 laboratorio Trillion bloqueados: Flux/Relay/Scout/Prism/Atlas/Spark/Forge/Lift), estilo **B-orbe** aprobado → `DESIGN.md` ya está en **v2.0** (overlay A+ "Modo Juego" §8bis), tope API USD 25/mes editable, ping solo feed in-app, puente cloud→local a la Mac post-piloto.
- E2 pasa a ser **E2+**: spec original + Lote B + capa Trillion (cola durable `12_cola.js`, agentes `13_agentes.js` con gates vía `crearAprobacion`, Centro de Mando B-orbe como vista adicional — la vista «Hoy» Registro A queda intacta). Plan módulo por módulo, casos de aceptación 7-13 y reglas: `HANDOFF E2+ - Claude Code (integración Trillion).md`.
- Código donante congelado en `Videos analizados/satori-os/` (referencia; se adapta al repo, no se copia).
- Obsoletos a borrar por Luciano en Drive: Sheet "Satori OS — Piloto" + "Proyecto sin título" (creados 12-jun por error de contexto; reemplazados por MAESTRO).
- Catálogo de recursos/arquitectura Trillion: `satori-os-recursos-trillion.md` · decisiones del día: `PLAN-SATORI-OS.md` (superseded por el handoff E2+ donde choque).

## 10. ADENDA 14-jun — Etapa 8 especificada (Director + Cerebro + Health loop)

- Derivado de 2 reels (Sureflow Agentic OS @seanpurvis + Z.E.R.O @jonathonmj). **Etapa 8 = capa de orquestación** encima de E2+: **Director** (agente CEO que chequea→decide→asigna por objetivos), **Cerebro** (memoria) y **Health loop** (sonda de salud que detecta y, con flag, autocorrige whitelist).
- **Decisiones cerradas:** cadencia híbrida (1×/día + salud c/30 min) · auto-heal SOLO-ALERTA en piloto (flag `AUTOHEAL_ON=false`) · Etapa 8 separada post-Vehemence · Cerebro como **grafo de entrada** 3 ejes, snapshot **materializado**.
- **Cerebro = doc CANÓNICO único:** `CEREBRO - Arquitectura única de memoria (Satori OS + Sistemas cliente).md`. Consolida los 4 docs dispersos de "segundo cerebro" (kzzy47/Obsidian) — ya no se rediscute. Un cerebro por tenant (SATORI en MAESTRO; cada cliente en su Sheet, aislado, exportable). Ejes **líder/negocio/sistema** = los dos planos Satori hechos modelo de datos.
- Specs: `ETAPA 8 - Capa de orquestación...md` (+ Adenda §13 con ideas del video) · ejecución: `HANDOFF ETAPA 8 - Claude Code...md` (módulos 14-16, pestañas nodos/aristas/cerebro_log/estado_actual/objetivos, casos 14-21). **No construir hasta cerrar E2+.**

## 11. ADENDA 21-jun — Presupuesto de performance del orbe (refina E2+ Módulo 7)

- Reel de Kevin Fremon (`2026-06-21 - Informe - UI orbe Trillion...md`, score 5, 3er contacto con Trillion): la UI de Trillion corre el orbe en 4K y le satura GPU/CPU/RAM en background. Validado técnicamente (9/10).
- **Decisión:** el Centro de Mando B-orbe debe cumplir un **presupuesto de recursos** antes de entrar a piloto; vista «Hoy» Registro A nunca paga el 3D. Palancas (orden): render solo si el orbe es visible → Page Visibility API → cap `devicePixelRatio` ≤1.5 → toggle calidad alto/bajo. Detalle ejecutable + casos de aceptación 14-17 en **`HANDOFF E2+...md` §7**.
- **Pendiente inmediato nuevo:** probar las 3 palancas must en `satori-os-demo-b-orbe.html` y medir consumo en pestaña de fondo (antes de portar al repo). Si no baja claro, el orbe queda detrás de flag.
- ⚠️ A verificar al construir: `localStorage` puede no persistir en el iframe sandbox de HtmlService → persistir la preferencia de calidad vía backend.
