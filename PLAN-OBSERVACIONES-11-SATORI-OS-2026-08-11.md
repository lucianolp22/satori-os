# PLAN — Las 11 observaciones de Luciano → Satori OS · 11/08/2026

> **Fuentes verificadas hoy (FASE 0):** memoria `satori-os.md` (11-ago) · `HANDOFF-2026-08-07-cierre-sesion.md` · `HANDOFF.md` repo (cabecera 04-ago, STALE) · `ARCHITECTURE.md` · `CAPABILITIES.md` (regen 10-ago) · `PIPELINE-SatoriOS.md` · `PLAN-INTEGRACION-jarvis-os.md` · `Comparativa-Pipelines-no_hype-vs-kevinfremon` (13-jul) · `PLAN-F3-COMERCIAL` (03-ago) · greps en vivo sobre `src/` del Mac (no sobre copias staged viejas).
> **Capa de fondo aplicada:** Círculo (lectura ambiental) · Bastión (seguridad, §6) · AREL (este plan ES el auto-plan previo; nada largo se ejecuta sin que lo veas) · satori-design (registro declarado por etapa) · Purga (gate al cierre de cada etapa, §8).

---

## §0 · BLUF

**De las 11 observaciones, 4 ya están construidas total o parcialmente y 3 chocan con decisiones documentadas que tenés que re-confirmar antes de tocar nada.** El sistema hoy está en un punto delicado: `/exec` sigue en @37, `/dev` tiene Edificio + tablero t1/t2 verificados (selfTest 216/0, harness 560/0), pero el **promote está en NO-GO por 2 Altos de la Purga del 11-ago** (teardown del selfTest en el MAESTRO compartido + `backup_degradado ×2`). **Nada nuevo entra antes de cerrar eso** — sería construir sobre base no confirmada, exactamente lo que pediste evitar.

El plan: **E0 destrabar prod (hoy) → E1 cartera+pipeline comercial (la plata) → E2 avatares+logos (quick win visual) → E3 Ficha 360 propia + Checklist + Dashboard de Objetivos (el build grande) → E4 Fichas 360 cliente (solapas + orbe) → E5 Hilos vivos → E6 Cerebro/Memoria (verificación) → E7 minería de contactos (misión aparte, gate Bastión).**

---

## §1 · Auditoría — punto por punto contra lo YA construido

| # | Observación | Estado real | Veredicto |
|---|---|---|---|
| 1 | Pipelines (@_no_hype_ai) | **~70% integrado como MÉTODO** desde jun/jul: `PIPELINE-SatoriOS.md` (10 fases + estados), `17_bandeja.js` (captura+clasificador Haiku con confianza+escalate, CERRADO 07-jul), escalera de maduración (doctrina firmada 20-jul). Lo que NO existe: la **materialización visual/operativa** de pipelines en el producto (vistas por etapa para ideas/clientes/objetivos/proyectos) | Parcial — falta la capa producto. ⚠ Divergencia D1 (§2) |
| 2 | Avatares + logos en todo | **Mecanismo construido** (E1.1): `avatar_url` por agente vía Config + `avatar_cerebro`/`avatar_bandeja`; con fallback a inicial. PNGs en `Avatares Satori/` (12 core + set 512) y 6 logos cliente en `Avatares Satori/clientes/`. Lo que falta: **cobertura** (agentes lab sin URL cargada), **logos NO tienen mecanismo** (cero referencias a logo por cliente en schema/UI), y el Edificio/Akasha no los consumen en todos los rincones | Parcial — mecanismo sí, cobertura y logos no |
| 3 | Registro automático por cliente en su hilo, infalible | **Núcleo construido y certificado**: hoja `charla` por tenant + sello `tenant_datos` + D30 (aislamiento, 617/0) + 9 reglas duras de AISLAMIENTO en CLAUDE.md + `25_hilo.js` + `exportarCharlas()` (TC-5). Lo pendiente documentado: **«Capa 3 · Hilos vivos» (diferida 03-ago)** — que lo trabajado fluya al Hilo sin paso manual | Parcial — activar Capa 3, NO construir de cero |
| 4 | Ficha 360 propia (checklist, objetivos, números, cartera) | **NO existe.** CLI-000 es el tenant sistema (charla de Sato modo sistema), pero no tiene Ficha. Piezas sueltas que la alimentan ya existen: North Star + `objetivos` (18_direccion), `31_admin.js` (tus números), roster (cartera), f360Chk (checklist… de clientes) | Nuevo — el build grande |
| 5 | Checklist personal multi-capa (Notas iPhone → OS) | NO existe como tal. Base aprovechable: Bandeja (captura), Tareas/tablero kanban (BLOQUE A certificado), guardián foco/paz (TC-2), brief diario | Nuevo — vive dentro de E3 |
| 6 | Objetivos del OS (organizar, optimizar, calidad de vida, oportunidades) | Parcial: North Star + métricas (`ns_satori_metricas`) + guardián foco/paz ya apuntan ahí. Falta **formalizarlos como los 4 ejes del Dashboard de Objetivos** | Se integra en E3 |
| 7 | Cartera Comercial (calientes/tibios/fríos) | `PLAN-F3-COMERCIAL` (03-ago) tiene la cartera VIEJA (11 candidatos Bloque 6). **Tu lista de hoy la reemplaza**: 4 calientes + 12 tibios + fríos por minar. Entregable aparte: `CARTERA-COMERCIAL-SATORI-2026-08-11.md` | Actualizada HOY (doc listo) |
| 8 | Dashboard de Objetivos propios (pizarra → flow) | NO existe. Insumo ya construido: métrica de objetivos v3 (T1), PM persistente del Director (foto por objetivo en nodos `NOD-PM-*`), sugerencias = patrón del brief | Nuevo — corazón de E3 |
| 9 | Fichas 360 cliente: solapas + orbe ×3 + más puntos | Ficha 360 existe y es densa (hilo, checklist, docs, vigilancia, Sato, cierre, encargos) pero **sin solapas** (scroll único). El orbe individual existe en Akasha | UI — E4, con eyeball |
| 10 | Conexión OS ↔ Cerebro ↔ Memoria | Grafo local VIVO (`127.0.0.1:8788` + launchd). ⚠ **El botón 🧠 del CM sigue HARDCODEADO** (`href="http://127.0.0.1:8788/"` en `index.html:1342`, verificado hoy) — el patch Config (`cerebro_url` + nacer oculto) decidido el 07-ago **NO se aplicó**: en la PWA del iPhone es un botón muerto. BRIEF-HOY local falló el 03-ago y no se re-verificó | Parcial — 1 patch pre-promote + verificación |
| 11 | Validar Hilos de clientes activos | Herramientas existen (`hiloCliente`, `repararHilo`, asserts D30). Falta la **pasada de validación** cliente por cliente con evidencia | Verificación — E5 |

## §2 · Divergencias — RESUELTAS por Luciano (11-ago tarde)

**D1 — RESUELTA: módulo pipeline completo YA.** Derogación consciente de la regla F3 §2.5 («no módulo hasta 3 corridas manuales»), decidida por Luciano el 11-ago con la regla a la vista. Se anota en el decision log del OS (`registrarDecision`, alcance sistema) como parte de T1, con el porqué: la cartera de 20 nombres ya amerita instrumento propio; el riesgo de dispersión se contiene porque el módulo muestra y registra, no automatiza — toda automatización de seguimiento sigue gateada por aprobaciones + escalera.

**D2 — RESUELTA: reactivar Capa 3 (Hilos vivos) en E5.** El no-cruce ya está garantizado por sello `tenant_datos` + charla por tenant + validación roster + `fuera_de_contexto` + 5 asserts 🔒 (D30). Lo que se construye es solo el flujo automático cierre→Hilo.

**D3 — Vigente:** minería de contactos arranca SOLO 1er grado, manual-first; 2do grado solo sobre negocios públicos (gate Bastión).

**D3 — Minería de contactos (fríos) toca PII y términos de Instagram.** Repasar TUS contactos (1er grado) con tu aprobación es verde. El **2do grado** (contactos de tus contactos) implica scrapear perfiles de terceros sin relación directa — Bastión lo marca ámbar: legalmente gris (RGPD legitimate interest dudoso para prospección B2C) y operativamente frágil. Propuesta: E7 arranca SOLO con 1er grado, manual-first (nivel 0), con la skill de inteligencia IG para negocios (perfiles comerciales públicos = verde). 2do grado solo sobre **negocios** (no personas) que tus contactos sigan/etiqueten.

## §3 · Diseño por punto (lo esencial)

**P1 · Pipelines.** Tres pipelines materializados, todos como vista sobre datos existentes:
- **Comercial** (roster + `etapa_comercial`): `frío → tibio → caliente → activo → en_pausa/perdido`. Vista kanban en el CM; cada card = cliente con logo, servicio a ofrecer y próxima acción. Motor: F3 manual (nivel 0) — el OS muestra, no empuja.
- **Ideas/proyectos** (Bandeja + Tareas): los bins del clasificador ya son estados; falta la vista «embudo» Bandeja → triaje → proyecto/tarea con contadores. Sin schema nuevo.
- **Objetivos** (E3): cada objetivo con flow de avance (ver P8). Mismo patrón de vista.

**P2 · Avatares + logos.** (a) Inventario: 13 agentes del registry (`vigia, conciliador, cobrador, analista, abastecedor, flux, relay, scout, prism, atlas, spark, forge, lift`) contra Config `avatar_*` — cargar los que falten desde `Avatares Satori/avatares-satori-512/` (Drive, enlace lector). (b) Logos: columna `logo_url` en roster (lista-contrato: grepear consumidores del schema en el MISMO commit) + render en cabecera de Ficha 360, card del pipeline comercial, orbe de Akasha y planta del Edificio. Tenés 6 logos (DAM, EJF, LC-Travel, MesaQuince-CONFIRMAR, SIP, Vehemence); faltan los tibios nuevos — se cargan cuando existan, con fallback a inicial (patrón avatar).

**P3+P11 · Hilos (Capa 3 + validación).** (a) Validación: correr `hiloCliente(id)` por cada cliente activo + `repararHilo()` donde falle + evidencia en tabla (cliente | hilo OK | última entrada | charla OK). (b) Capa 3: al `satoCierreSesion` confirmado, el resumen del cierre se appendea al Hilo del cliente con sello `tenant_datos` — mismo chokepoint, cero camino nuevo de escritura (Bastión: reusar `appendFila`→`sanitizarCelda`). Assert nuevo de aislamiento (regla 9 de CLAUDE.md).

**P4+5+6+8 · SATORI HQ (tu Ficha 360 propia).** Una ficha para CLI-000 con **solapas**: 
- **Hoy** (brief + guardián foco/paz + checklist del día), 
- **Checklist** (multi-capa: rutinas recurrentes + captura rápida desde Bandeja/voz; reemplaza Notas iPhone), 
- **Objetivos** (el Dashboard: corto/mediano/largo plazo × 4 ejes — Profesional, Calidad de vida, Finanzas, Oportunidades; cada objetivo con flow de avance alimentado por tareas/proyectos linkeados y métrica v3; sugerencias del Director como «SGIC sugiere»), 
- **Números** (resumen `31_admin.js` por jurisdicción y moneda, sin total global), 
- **Cartera** (pipeline comercial del P1). 
Capas pedidas: Visual = satori-design registro híbrido (declarar antes de construir) · Funcional = ciclos (diario brief / semanal revisión / mensual cierre — «imitar a la Naturaleza» = cadencias, no metáfora decorativa) · Inteligente+Consciente = sugerencias del Director + guardián foco/paz ya existentes, apuntados a TUS objetivos. **Cowork hace la maqueta v1 (yo), Code la porta.**

**P9 · Fichas 360 cliente.** Reorganizar en solapas (Resumen · Hilo · Números · Docs · Sato · Checklist · Encargos), orbe individual ×3 con más puntos de dato (vigilancia multi-superficie ya da los semáforos; docs y charla dan densidad). Regla dura de overlays (z-index/stacking + tokens propios) aplica. Eyeball tuyo obligatorio (nivel 2 por diseño).

**P10 · Cerebro/Memoria.** (a) Patch botón 🧠 → patrón Config (pre-promote). (b) Verificar BRIEF-HOY diario local. (c) Chequeo de flujo: lo que se guarda en `_cerebro/` aparece en grafo + INBOX; runbook corto de «dónde vive cada memoria» (nativa de proyecto ≠ Cerebro Satori ≠ cerebro por cliente en Sheets — hoy conviven 3 capas y la confusión es riesgo real).

**P7 · Cartera.** Doc aparte entregado hoy. El roster del MAESTRO se actualiza en E1 (altas `potencial` para los 12 tibios que no existen + `etapa_comercial` seed).

## §4 · Etapas, orden y esfuerzo

| Etapa | Qué | Quién | Esfuerzo | Gate de cierre |
|---|---|---|---|---|
| **E0 · Destrabar prod** (HOY) | Cerrar Altos Purga 11-ago: teardown test en MAESTRO + salud backup + eyeball Edificio · patch botón 🧠 (Code) · git push (main ahead 2) · promote @38 | Luciano (editor+bash) + Code (patch) | **S** | `clasp deployments` = @38 · MAESTRO sin `__TEST__` · backup con archivo reciente en carpeta correcta |
| **E1 · Cartera + pipeline comercial** | Roster: altas tibios + `etapa_comercial` + `logo_url` (schema, lista-contrato) · vista pipeline en CM · cartera doc como fuente | Code (tanda 1) + Cowork (doc listo) | **M** | selfTest verde + eyeball vista + Purga |
| **E2 · Avatares + logos 100%** | Inventario Config `avatar_*` · subir faltantes a Drive · logos en Ficha/Akasha/Edificio | Cowork (inventario+bash) + Code (render) + Luciano (aprobar arte) | **S–M** | Ningún agente sin avatar; ningún activo sin logo; fallback verificado |
| **E3 · SATORI HQ** | Ficha propia: maqueta Cowork → observación tuya → port Code (schema `checklist_propia`/`objetivos_propios` + solapas + dashboard) | Cowork → Luciano → Code | **L–XL** (2-3 tandas) | Maqueta aprobada · selfTest con asserts nuevos · Purga por tanda |
| **E4 · Fichas 360 cliente** | Solapas + orbe ×3 + densidad de datos | Code + eyeball Luciano | **M** | Eyeball + `_verificar_index.py` + render Playwright |
| **E5 · Hilos vivos** | Validación 100% hilos + Capa 3 (cierre→Hilo automático) + assert aislamiento | Cowork (validación) + Code (Capa 3) | **M** | Tabla de evidencia por cliente + assert 🔒 verde |
| **E6 · Cerebro/Memoria** | Verificación de flujo diario + runbook 3-capas + BRIEF-HOY | Cowork | **S** | Corrida real verificada un día completo |
| **E7 · Minería de contactos** | 1er grado manual-first con gate Bastión (D3) | Equipo Agentes Pro (misión) + Luciano | **M** | Lista priorizada S/M/L → alimenta pipeline E1 |

**80/20:** E0+E1 (prod al día + la cartera viva en el OS con tus 16 nombres) es el 20% que mueve `retenciones_formalizadas` e `ingresos_recurrentes_mes_eur` — las dos métricas que el propio sistema declara como North Star. E3 es lo más grande y lo más tuyo, pero sin E0 no hay dónde apoyarlo.

**Cadencia AREL:** una etapa por vez; «avanzá» dispara la siguiente. Cada cierre de etapa = Purga + inventario + CIERRE/QUEDA ABIERTO.

## §5 · Reparto exacto

- **Cowork (yo, ya hecho hoy):** este plan · cartera actualizada · encargo Code tanda E0/E1 · próximo paso al «avanzá»: maqueta SATORI HQ (E3) + inventario avatares (E2).
- **Code (Terminal Mac):** `ENCARGO-CODE-OBS-E0-E1-2026-08-11.md` (en el repo). Primero el micro-patch 🧠, después tanda E1.
- **Vos (mínimo, por seguridad/autorización):** los pasos E0 de abajo (§7) — son los únicos que requieren tu cuenta y tu ojo.

## §6 · Bastión (lo que vigila en este plan)

1. **Logos/avatares por URL:** Drive con enlace «cualquiera con el enlace: lector» es aceptable para arte (no PII); JAMÁS ese patrón para docs de cliente. 2. **Capa 3 Hilos:** reusar el chokepoint `appendFila`→`sanitizarCelda`; ningún write path nuevo; assert de aislamiento obligatorio (regla 9). 3. **Minería de contactos:** D3 — 1er grado con tu OK explícito; negocios, no personas; nada se persiste en Sheets de cliente. 4. **Checklist personal:** es TU PII personal — vive en el MAESTRO (CLI-000), nunca en Sheets de cliente, y no entra en capturas/screenshots de demos. 5. **Endpoints nuevos** (vista pipeline, ficha propia) → `_soloOwner_` + alta en `ENDPOINTS_UI` en el MISMO commit (regla anti-drift).

## §7 · E0 — **CERRADA 11-ago ~13:15: PROD `/exec` @41** ✅

Secuencia completa ejecutada por Luciano: push (drift resuelto, `1a92894`) → `setup()` → `selfTest()` **216/0** → promote `--go` → **@41** confirmado por `clasp deployments`. Teardown post-selfTest **re-verificado limpio por Cowork** (export Drive ~14:20: 0 CLI-008, 0 `__TEST__`, NS correcto). Nota candidata a purga menor: el label del deploy dice «HANDOFF al 11-08-2026» pero el contenido real incluye Edificio+tablero+🧠 — cosmético.
⚠ **Cabo abierto detectado:** `cerebro_url` NO aparece en Config pese al `setup()` de 13:01 (el export sí muestra `voz_url`/`oficina_url` en `ts.net`). Verificar en el CM si el botón 🧠 aparece; si no: re-correr `setup()` o revisar la siembra (va al arranque de T1).

### §7-hist · Estado previo (archivo)

- **Alto #1 (teardown test en MAESTRO): CERRADO.** `limpiarTodoTest` corrido por Luciano 12:34 + verificación independiente de Cowork (lectura read-only del MAESTRO vía conector Drive, 11-ago ~14h): **cero** `CLI-008`, **cero** `__TEST__`, NS = «Gestionar 6 clientes pagos…», sin tarea 2020-01-01.
- **Alto #2 (backup): CERRADO.** `backupListar` 12:35: último backup **09-ago 04:09 con 8 archivos** en su carpeta (no en raíz); 04-ago con 8; los ceros anteriores son alcance `drive.file` (copias pre-BK-2 invisibles, no ausentes). `estadoTriggerBackup`: instalado, 1. Los avisos `backup_degradado` eran anteriores al fix — resolverlos del CM.
- **Medio #4 (eyeball Edificio): OK** por Luciano.
- **T0 (botón 🧠 → patrón Config): APLICADO** por Code, commit `c72cca3`, en `/dev`. Harness 560/0 · `_verificar_index.py` 431/431. Decisión correcta de Code: `cerebro_url` va CRUDA sin fallback (el fallback ERA el bug del iPhone).
- **Bloqueo restante:** el `git push` abortó por el drift-checker (CAPABILITIES.md regenerado en working tree). Resolución en 3 comandos (§7bis).

### §7bis · Lo que queda en tus manos (secuencia exacta, revisada 3×)

**Terminal:**
```bash
cd ~/Documents/Claude/Projects/SatoriOS
git add CAPABILITIES.md
git commit -m "CAPABILITIES: regen (drift-checker)"
git push origin main
```
**Editor GAS** (desplegable, sin argumentos): **`setup`** (`02_setup.js`) — siembra `cerebro_url` en Config; idempotente, no pisa valores. Después **`selfTest`** (`09_selftest.js`) — gate del runbook post-clasp-push; esperar 0 fallos.
**Terminal (promote):**
```bash
bash _promote_exec.sh        # dry-run: leer qué haría
bash _promote_exec.sh --go
npx clasp deployments        # confirmar versión nueva en /exec
```
Con eso `/exec` queda @38+ (Edificio + tablero t1/t2 + botón 🧠) y se abre T1.

### §7-original (instrucciones ya ejecutadas — archivo)

**Paso 1 — En el editor de Apps Script** (script Satori OS, cuenta `luciano@satoriconsultoria.com` — `clasp open-script` o tu URL del editor). Las 3 funciones existen, van sin argumentos y son visibles en el desplegable:

1. **`limpiarTodoTest`** (archivo `09_selftest.js`) — *Por qué:* la Purga del 11-ago detectó que el selfTest pudo dejar basura de test (CLI-008, NS «__TEST__», tarea 2020) en el MAESTRO que `/dev` y `/exec` COMPARTEN. Esta función la barre y reporta. *Después:* mirá en el Sheet MAESTRO que el roster no tenga CLI-008, que el North Star diga «Gestionar 6 clientes» y que en Tareas no quede nada `__TEST__`.
2. **`backupListar`** (archivo `21_backup.js`) — *Por qué:* hay 2 avisos `backup_degradado` vivos y el backup «activo pero muerto» es el fallo #1 histórico. Mirá que el último backup tenga fecha reciente (domingo pasado) y esté en la carpeta de backups, no en la raíz del Drive.
3. **`estadoTriggerBackup`** (archivo `21_backup.js`) — *Por qué:* confirma que el trigger semanal sigue instalado. Si algo da mal acá, frenamos: Code repara antes del promote.

**Paso 2 — Eyeball del Edificio en `/dev`** (URL `/dev` de siempre): zoom al abrir, logo ensō, botonera horizontal arriba-centro. 30 segundos.

**Paso 3 — Terminal del Mac** (solo si Paso 1 y 2 dieron bien, y DESPUÉS de que Code aplique el micro-patch 🧠 del encargo — así el promote sale completo). Revisado 3×; el script tiene dry-run primero y guardia de diff:

```bash
cd ~/Documents/Claude/Projects/SatoriOS
git push origin main
bash _promote_exec.sh
```

Leé lo que muestra el dry-run. Si coincide con lo esperado (promover /dev actual a /exec):

```bash
bash _promote_exec.sh --go
npx clasp deployments
```

*Qué esperar:* `clasp deployments` mostrando la versión nueva (@38+) en `/exec`. La versión real la da ese comando, NO `_promote_rollback.txt`.

## §8 · Purga de este plan (auto-auditoría antes de entregarte)

- ✅ Contrastado contra decisiones firmes: no re-propone daemon/Hermes/OpenClaw/os@; respeta B8 (datos reales+RGPD al final); respeta escalera (D1 lo hace explícito en vez de pisarla).
- ✅ Cada «ya existe» tiene evidencia de grep/archivo, no memoria de conversación. Cada función que te pido correr fue verificada hoy: existe, sin `_` final, sin argumentos.
- ⚠ Riesgo #1 (pre-mortem): **dispersión** — 11 frentes matan el F3 comercial que vos mismo elegiste el 03-ago. Contención: E1 ES F3 (la cartera es la palanca de plata); E3 no arranca hasta cerrar E0-E2.
- ⚠ Riesgo #2: SATORI HQ crece sin límite («asistente inteligente multi-capa» invita scope-creep). Contención: gate anti-rollup del BLOQUE 4 aplicado a cada widget («¿qué harías distinto según este número?») + maqueta aprobada ANTES de una línea de GAS.
- ⚠ Supuestos (máx 3): (1) el estado 11-ago de la memoria refleja el repo real — confirmado por git log de hoy; (2) los 12 tibios nuevos NO están en el roster — a confirmar en E1 contra el Sheet vivo; (3) el set `avatares-satori-512` cubre los 13 agentes — a confirmar en inventario E2.

*Plan v2 · Cowork · 11/08/2026 tarde. Un solo plan vivo: las revisiones editan ESTE archivo.*
*Changelog v2: D1 resuelta (módulo completo, derogación registrable) · D2 resuelta (Capa 3 va) · cartera v2 (16 tibios; Noor→Nook, Alex Barbershop→DAM) · E0: Altos #1/#2 cerrados con evidencia, T0 aplicado (c72cca3), queda §7bis (push+setup+selfTest+promote).*
