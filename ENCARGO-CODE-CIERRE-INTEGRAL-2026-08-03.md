# ENCARGO CODE · CIERRE INTEGRAL DEL PLAN — Satori OS — 03/08/2026

> **Misión:** terminar de desarrollar TODO lo pendiente sin gatillo del Plan Integral (decisión de Luciano 03-ago, con 4 compuertas resueltas: F6 correo SÍ · X4 SÍ · F4a motor-ahora · diferidos respetan gatillos). Al cerrar este encargo, el único frente abierto del core queda siendo la carga de datos reales de Luciano (facturas F4a) y lo diferido-con-gatillo.
> **Base:** repo `origin/main` = `6be28bc` · prod `/exec` @35 · selfTest **617/0** (03-ago) · harness offline **213/0** · `/dev` sirve HEAD.
> **Ejecutor:** Claude Code en el Mac. **Cowork audita** cada tanda (purga) y Luciano supervisa/aprueba. Orden de la cadena: una tanda por vez, commit por tanda, `clasp push` por tanda; **promote a `/exec` NO — lo decide Luciano al final del ciclo.**

---

## Reglas duras del encargo (no negociables)

1. **CLAUDE.md del repo manda** (regla de oro, lista-contrato, STUB, forma-de-retorno, verificación antes de declarar hecho). Leerlo entero antes de escribir la primera línea.
2. **Paso 0 por tanda:** verificar qué existe ANTES de construir (grep + leer los archivos que toca). Cowork ya verificó el 03-ago que NO existen: decision log, guardián foco/paz, `exportar_charlas`, PM persistente, C1/C2, código Gmail. Pero re-verificá al arrancar cada tanda — pudo cambiar.
3. **Asserts nuevos obligatorios por tanda** (D31…D36, patrón D30: parte liviana siempre + Sheets vivos solo con `opts.completo`, clientes `__TEST__`, cero LLM/APIs externas en asserts, sin conteos pineados a mano). Harness offline ampliado donde el módulo tenga funciones puras.
4. **Ningún dato real de cliente** se toca: patrón D30 (clientes de prueba, limpieza siempre). El roster de MesaQuince NO se corrige (mismatch comercial anotado — decisión de Luciano pendiente; solo dejar nota en HANDOFF).
5. **UI:** todo cambio de pantalla respeta el registro operativo y los tokens existentes (DESIGN.md / los tokens que ya viven en `#centro`/`#akasha` — lección 01-ago: panel fuera de `#centro` pierde tokens → tema propio). **Diagnóstico por render (Playwright), no por lectura de código.** Sin frameworks, sin CDN nuevo (cadena de suministro: preferir vanilla a ninja-keys si empata en esfuerzo).
6. **Verificación por tanda:** `node --check` de los módulos tocados + `bash _harness.js`-equivalente (`node _harness.js`) verde + divs/JS de `index.html` con el verificador existente (ojo: no busca `<script>` por offset). El **selfTest de editor lo corre Luciano UNA vez al final del encargo** (esperado ~617 + los D31-D36 nuevos / FALLA 0).
7. **Commits:** uno por tanda, mensaje claro sin paréntesis. `bash _capabilities_gen.sh` antes de cada push (hook). JAMÁS commitear `FOUNDER OS/`, `OFICINA-IA-ECOM-*`, ni nada ajeno. Los avatares NFD sí: `git add "Avatares Satori/"` en la tanda TC-8.
8. **Al terminar cada tanda:** avisar a Luciano en una línea (qué cerró, qué asserts sumó). Él da «avanzá» o frena. Al final: actualizar HANDOFF.md (cabecera nueva, anterior a archivo) + correr `bash _inventario_cierre.sh` + dejar reporte para la purga de Cowork.

---

## TC-1 · X4: gatear las 35 con `_soloOwner_` (S) — primero, porque endurece antes de agregar superficie

- Fuente: bloque X2/X4 de `22_seguridad.js` — el inventario `ENDPOINTS_UI` ya define qué "debe estar gateado"; X4 son las 35 funciones top-level que siguen sin gate.
- Paso 0: `securityScan_` y D19 ya auditan presencia del gate — obtener del scan la lista exacta de las 35.
- Hacer: agregar `_soloOwner_('<nombre>')` en la primera línea de cada una + darlas de alta donde el invariante lo exija. OJO: las que corren desde triggers/sistema ya pasan por `SATORI_CTX_SISTEMA` — verificar que ninguna de las 35 se invoque desde un trigger sin ese contexto (romperías corridaDiaria: probarlo).
- Asserts D31: cobertura completa (el scan devuelve 0 sin gate) + una función de sistema sigue corriendo con `SATORI_CTX_SISTEMA`.

## TC-2 · F4b restante: decision log + guardián foco/paz

**Decision log** — las decisiones de dirección dejan de vivir solo en pivots del North Star:
- Hoja `Decisiones` en MAESTRO (lista-contrato en `01_schema.js`): `id, fecha, decision, porque, alcance, fuente, estado` (vigente/revertida — nunca se borra, se revierte con fecha).
- Funciones: `registrarDecision(texto, porque, alcance)` (con gate) + `decisionesVigentes()` (read-only).
- Integración Sato: nueva fuente `decisiones` en `SATO_FUENTES` + sumarla a la "memoria que frena" (T2.4): antes de acompañar una idea, Sato puede chequear decisiones vigentes. El cierre de sesión (T2.1) suma `tipo:"decision"` como ítem tildable → `satoAplicarCierre` lo registra.
- **OJO aguas abajo:** tocar `SATO_FUENTES` toca el system prompt de Sato y `_satoDatos_`; D30b2 asserta fuentes clave por membresía (aditivo, no rompe). Verificar que el harness de T1.6 no pinee el conteo de fuentes.

**Guardián foco/paz** — paz y salud como métricas de resultado (doctrina Satori):
- Rutina `guardianFocoPaz_()` dentro de `corridaDiaria` (leyendo lo que YA existe: Tareas A vencidas, densidad de Agenda 7 días, turnos de Sato/día, aprobaciones estancadas). Umbrales en Config (`fp_max_vencidas_A`, `fp_max_eventos_dia`, defaults prudentes).
- Señal → aviso tipo `foco_paz` (hoja Avisos, patrón existente) con recomendación concreta de soltar/reprogramar UNA cosa. **Solo avisa, jamás escribe/reprograma.** Máximo 1 aviso/día (no ruido).
- Asserts D32: hoja+schema declarados · umbral legible de Config con default · señal simulada genera 1 aviso y no duplica · sin señal = silencio.

## TC-3 · F5 restante: actividad inter-agentes + PM persistente

- Paso 0 OBLIGATORIO: las hojas `Actividad` y `Consumo_agentes` ya existen y el Director ya escribe "partes" — leer `13_agentes.js`/`14_director.js` para NO duplicar. Buscar en PLAN-INTEGRAL-SATORI-OS-v3 y ENCARGO-CADENA qué se especificó exactamente para D7 "PM persistente".
- **Actividad inter-agentes:** vista en el CM (sección o pestaña ligera) que muestre el feed cruzado: qué agente hizo qué, para qué tenant, cuándo — sobre `Actividad` + `Consumo_agentes`, read-only, con filtro por agente/cliente. Backend `datosActividadAgentes(limite)` gateado.
- **PM persistente:** el análisis del Director por objetivo PERSISTE entre corridas (hoy re-analiza de cero). Usar el cerebro del tenant (nodo por objetivo con último análisis + fecha) para que la corrida siguiente parta del estado anterior y solo reporte el DELTA. Fail-safe: sin nodo previo = análisis completo (comportamiento actual).
- Asserts D33: el feed devuelve filas cruzadas con shape estable · el Director con nodo previo emite delta y sin nodo hace análisis completo · nada escribe fuera del tenant `__TEST__`.

## TC-4 · UI (F7/E2 + C1 + C2) — registro operativo, tokens existentes, render-verificado

- **E2 · Paleta ⌘K** en el CM: overlay vanilla (sin dependencia externa) con las acciones YA existentes (abrir ficha de cliente, Sato, brief, aprobar pendiente, capturar a Bandeja, buscar). Catálogo estático + filtro fuzzy simple. Atajo ⌘K/Ctrl-K, Esc cierra, accesible por teclado. OJO stacking context: montarla a nivel `<body>` con z-index sobre 300 y tema propio (lección Sato 01-ago).
- **C1 · Aro de estado del orbe:** la data ya llega en `setSato` — render del aro (idle/escuchando/pensando/hablando) por CSS, sin lib.
- **C2 · Progreso en chatlog de voz:** durante los ~13s del turno hablado, estados de etapa REALES en el chatlog (enviado → pensando → generando voz → listo), no un spinner mentiroso. 0 llamadas API extra: son los estados que el flujo ya atraviesa.
- Verificación: render Playwright (hit-test de la paleta sobre Akasha y sobre ficha abierta, captura del aro en 2 estados) + verificador de index.html + harness. Eyeball final de Luciano.

## TC-5 · Capa 3 · Hilos siempre vivos: `exportar_charlas` + `_charla_pull.sh`

- `exportarCharlas(idCliente?, desde?)`: read-only, gateado, devuelve transcripción de `charla` del tenant (o de todos si modo sistema) con cap de tamaño y saneo — para que Cowork baje lo hablado al `.md` del Hilo (el `.md` sigue siendo la fuente de verdad, NO se escribe desde GAS).
- `_charla_pull.sh` en la raíz del repo: llama al endpoint (`/dev`) y guarda `entregables/charlas/<CLI-00X>-charla.md` por cliente. Sin secretos hardcodeados (usa el patrón de token existente del repo).
- Asserts D34: cap de tamaño se respeta · tenant aislado (patrón D30: B no exporta charla de A) · `desde` filtra por fecha.

## TC-6 · F6 · Correo T7 — A2 AUTORIZADO por Luciano el 03-ago

- **Ley: `docs/SPEC-correo-T7.md` COMPLETA, incluido su dictamen Bastión embebido de 9 cláusulas — se cumple TAL CUAL, no se reinterpreta.** Núcleo: scope único `gmail.readonly` · solo `luciano@` · el correo es `fuente='correo'` en Bandeja (clasificador existente, ni módulo ni hoja nueva).
- ⚠ **El push de `appsscript.json` con el scope nuevo dispara re-consentimiento de Google al abrir el CM.** Por diseño esta tanda va ÚLTIMA de las de código, con aviso previo a Luciano: la pantalla de permisos es ESPERADA y debe decir únicamente lectura de Gmail — si pide más, NO aceptar y frenar.
- Asserts D35: los que la SPEC exija + dedupe (un mail no entra dos veces) + kill-switch respetado.

## TC-7 · F4a · Motor de administración propia (facturas después)

- **Alcance de ESTA tanda: el motor, sin datos reales.** Sheet propio `Satori ADMIN` (no un cliente del roster): hojas `facturas_emitidas` (nº, fecha, cliente, base, IVA, total, moneda, estado cobro, jurisdicción ES/AR), `gastos`, `cobros`, `calendario_fiscal`. Lista-contrato en schema + `ensureSheet` reconciliador propio.
- Funciones: alta/lectura gateadas + resumen mensual (`adminResumenMes()`) que el brief de sistema pueda citar (facturado/cobrado/pendiente del mes, por jurisdicción).
- **Calendario fiscal ES: SOLO estructura + placeholders marcados `«verificar con gestor/AEAT»`.** PROHIBIDO hardcodear fechas/modelos/tipos como ciertos sin fuente — regla de prudencia fiscal; los valores los valida Luciano con su gestor al cargar. Nada de asesoría embebida.
- Datos de ejemplo `__TEST__` para los asserts D36 (alta → resumen cuadra → limpieza). **El gate de cierre real de F4a (un trimestre cuadrado contra el gestor) queda ABIERTO esperando las facturas 2026 de Luciano** — dejarlo explícito en HANDOFF.

## TC-8 · Cierre del encargo

1. `git add "Avatares Satori/"` (cosmético pendiente desde julio).
2. `bash _capabilities_gen.sh` + selfTest de editor (Luciano, 1 vez): esperado 617 + D31…D36 / **FALLA 0**.
3. HANDOFF.md: cabecera nueva "Plan Integral CERRADO salvo gatillos" + tabla de diferidos con su gatillo exacto (D9/D10/Forge/caching/VPS/Lift/A5/B8/os@/Telegram) + F4a esperando facturas.
4. `bash _inventario_cierre.sh` + reporte final → **purga integral de Cowork** antes de declarar cerrado. Promote a @36: decisión de Luciano post-purga.

## Fuera de este encargo (no tocar)

MERCURIO · FORJA · todo diferido-con-gatillo (Lift ON, A5, D9, D10, Forge, caching, VPS, Telegram, os@) · promote a `/exec` · roster de MesaQuince · rotación OWNER_TOKEN Vehemence (tanda aparte con Luciano, requiere saber dónde vive la URL `?k=`) · cualquier Sheet de cliente real.

---
*Encargo generado por Cowork 03/08/2026 (sesión D30+F3). Compuertas de alcance resueltas por Luciano vía AskUserQuestion. Cowork corre purga por tanda a pedido y la integral al cierre.*
