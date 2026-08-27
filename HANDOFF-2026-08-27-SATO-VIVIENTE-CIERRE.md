# HANDOFF — SATO VIVIENTE · cierre PARCIAL (Bloque A) — 27/08/2026

**CIERRE: incluye F0 · F1 (mitad offline) · F2a · F2b (capa vault) · F2c — todo el Bloque A.
QUEDA ABIERTO: Bloques B, C, D, E, G y F14, gateados por el cierre de E2 (2º reload de `agent.py`).**

> Sesión de Claude Code sobre `ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md`. Rama `feat/sato-viviente`,
> mergeada a `main`. **`src/` y `voz/` no se tocaron** — el diff es 4 archivos nuevos, 556 líneas,
> todas documentación + un instalador. `/exec @57` intacto.

## Estado vigente

PC-0/1/3 verdes (working tree limpio, `main`, `/exec @57`, `§2d.MOBILE` presente en el encargo CRM).
**PC-2 rojo** ⇒ ruta «sólo Bloque A» del §4 del encargo. `agent.py` no se tocó (lección +59 respetada).

El rojo de PC-2 se determinó **por evidencia del proceso vivo, no leyendo el HANDOFF**: el agente de
voz (PID 95500) arrancó a las 10:49:05 y `agent.py` tiene mtime 10:56:15; `brief_hoy` no está cargado
en el proceso y su `.pyc` se compiló a las 10:57. **El 2º reload sigue pendiente.**

## Entregables

| Archivo | Qué contiene |
|---|---|
| `out/audit-tokens-2026-08-27.md` | F0 (baseline + proyección + veredicto) y F1 (auditoría estática del caching TC-10) |
| `out/cerebro-salud-2026-08-27.md` | F2a (launchd) y F2b (996 nodos, 3 warnings) |
| `out/livingmind-inventario-2026-08-27.md` | F2c — 23 técnicas clasificadas + priorización + recomendación |
| `out/pendientes-post-E2.md` | Qué quedó gateado, con evidencia, y los 6 pasos para desbloquearlo |
| `scripts/install-grafo-launchd.sh` | Instalador idempotente del LaunchAgent del grafo (`--check`, `--force`) |

## Los cuatro hallazgos que cambian algo

1. **F0 · GO con margen amplio.** Sato-VOZ en Haiku 4.5 = **2,1%** del baseline semanal conservador
   (USD 44,08/sem); el tope es +15%. Ni Opus 5 lo rompe (10,3%). El prefijo estable medido son
   **7.111 tok** (tools 3.774 + system 3.337), por encima del mínimo de Haiku 4.5 (4.096). **El
   riesgo de F6 no es el coste: es que no hay credencial Anthropic en esta Mac.**
2. **F1 · El caching TC-10 está bien construido y por eso mismo hoy no cachea nada.**
   `GUARDIA_INYECCION` son 143 tokens contra mínimos de 1.024/4.096 ⇒ `cache_intentado=false` en
   todos los módulos. No hay invalidator: hay bloques cortos. Palanca no obvia: **Sonnet 5 con caché
   (0,20 USD/M) sale 5× más barato que Haiku sin caché (1,00 USD/M)**. Y F3 (identity file, ~3.300
   tok) empujaría el bloque fijo de Sato por encima de 4.096 — **F1 y F3 se pagan mutuamente**.
3. **F2c · El Cerebro es canvas 2D, no Three.js.** Bloom, fresnel, `InstancedMesh` y ACES **no
   aplican**: F10 tal como está escrito es reescribir el renderer (4,8 KB de JS) y vendorizar ~600 KB
   en un vault que hoy tiene **cero dependencias externas por diseño de Bastión**. Causal de escalado
   §8.8 disparada. Reformulado en F10-a (11 ítems, ~2 h, sin cambio de stack) y F10-b (decisión de
   Luciano).
4. **F2a · El servidor del grafo no estaba caído** (el encargo lo daba por caído): estaba bajo
   launchd desde el 17-ago. Lo que sí había: los logs iban a `/tmp` —que macOS purga— y no existían.

## Verificado

- `node _harness.js` → **899 / 0**. `python3 _verificar_index.py` → OK (453/453). Sin cambios en
  `src/`, así que el resultado es el mismo de antes de la sesión: prueba de no-regresión, no de lo nuevo.
- `scripts/install-grafo-launchd.sh` corrido dos veces: 1ª reinstala (PID 1058 → 2753), 2ª es no-op.
  `http://127.0.0.1:8788/` → 200. `plutil -lint` del plist → OK. Logs escribiendo en
  `~/Library/Logs/satori-grafo-server.{out,err}.log`.
- `bash _inventario_cierre.sh` corrido. Todo lo que reporta es deuda **preexistente de otras
  sesiones** (`docs/RGPD-registro-tratamiento.md`, `docs/RUNBOOK-puesta-en-marcha-…`,
  `importarConocimientoEntrenamiento()` sin implementar). Esta sesión no agrega cabos nuevos.

## No verificado (verde con asterisco)

- **La rama `KeepAlive` del grafo nunca se ejercitó.** `runs = 1`, `never exited`. El `kill -9` que
  pedía el encargo lo bloqueó el clasificador de permisos. Lo que sí se probó es `bootout`+`bootstrap`.
- **F1 en vivo:** la tabla de hit-rate por módulo y tenant necesita leer `Costos_API` de 5 Sheets.
  Predicción falsable: todo en `cache_intentado=false`, `cache_write=0`, `cache_read=0`.
- **F2b capa GAS:** `estadoVigente(id)` por tenant no es corrible headless.
- **F0** usa conteos de sesión/turno medidos del log, pero tamaños de turno y de resultado de tool
  son supuestos declarados, y los tokens son estimación por chars/3,6 (sin `count_tokens`, que pide
  key). **Confianza 7/10.**

## Dos datos del encargo que estaban mal (corregidos en los informes)

| Encargo | Realidad |
|---|---|
| «USD 649,54 al 18-ago» | **USD 500,37** (`out/consolidado.csv` + HANDOFF del Medidor, 27-ago) |
| `web/dashboard.html`, `scripts/gen_dashboard.py`, `out/consolidado.csv` en SatoriOS | Viven en `Projects/MEDIDOR TOKENS/`. En SatoriOS **no existían** `web/` ni `out/` ni `scripts/`. F14 tendrá que apuntar al repo del Medidor |
| F2a: `Program=/usr/bin/python3` | Rompe el servicio: bajo launchd, el python de CommandLineTools **no tiene permiso TCC de `~/Documents`**. Se mantiene el de Homebrew |
| PC-1: el Cerebro está caído | Estaba corriendo bajo launchd desde el 17-ago |

## Pendiente

**Must — desbloquea todo (dueño: Luciano):**
1. Editor GAS: `selfTestTramo6()` (D48+D49, 32 asserts vivos — E1 y E2 están en prod sin ninguno).
2. Editor GAS: `probarPushTelefono()` (confirma `NTFY_TOKEN`).
3. Editor GAS: `estadoVigente('CLI-000'|'CLI-002'|'CLI-003')` ← lo que faltó de F2b.
4. Mac: `launchctl kickstart -k gui/$UID/com.satori.voz.agent` ← **el 2º reload**.
5. Eyeball 30 s de voz: «hola Sato, dame el brief» → debe enunciar «HOY hay que mirar (N)».
6. Después: `setConfig('push_proactivo_on','true')` — decisión consciente, no de Code.

**Must — decisión de Luciano, no de Code:**
- **F10-b:** ¿se migra el Cerebro a Three.js vendorizado, o el vault se queda sin dependencias
  externas? La recomendación por defecto de F2c es **no**, pero es tu llamada.
- **F6:** cargar la key de Anthropic en `.env.local` si se va a migrar el motor de voz.

**Should (Code, ya desbloqueado — no depende de E2):**
- **F-CRM-Mobile** (Bloque G): el trabajo más grande y más listo para arrancar. No toca `agent.py`.
- **F10-a:** los 5 primeros ítems del inventario (`devicePixelRatio`, cortar el rAF infinito, `mtime`
  + freshness, layout precomputado, deep links). ~2 h, sin cambio de stack.
- Corregir la deriva de documentación de `05_costos.js:50` («todo cacheable» es falso).

**Nice:**
- Sacar el `id` del bloque fijo de `satoChat` para que el prefijo de caché sea byte-idéntico entre
  tenants (hoy fragmenta en hasta 20 prefijos). El aislamiento no se debilita: el `id` sigue en
  `systemVivo`. Detalle en `out/audit-tokens-2026-08-27.md` §F1.5.
- Unificar `llamadaClasificador_` (`17_bandeja.js`) con `llamadaAPI`: hoy es una 2ª ruta al mismo
  endpoint, sin telemetría de caché y fuera del ruteo de modelo.

## Cabos de otras sesiones respetados

`push_proactivo_on` **no se tocó** · `/exec` **no se promovió** · Orbe Persistente v2 y orbe del CM
**intactos** (regla +51) · CRM Pro §2d en prod **intacto** · `agent.py` **no se tocó** (lección +59)
· F8-F9 SatoPatrones **no ejecutado** (gate E5) · frontera `objetivos.descripcion → correrDirector`
**no tocada**.

> **Un diferido del encargo que NO se hizo:** F8-F9 pedía dejar el diseño escrito en
> `docs/DISENO-SATOPATRONES-2026-08-27.md` y abrir el item en el backlog de `sato-ejecutor`. No se
> escribió — el diseño de una superficie de inyección nueva merece la sesión completa que no tuvo.
> Queda como cabo con dueño (Cowork o Code, post-E5).

---
*Claude Code · 27/08/2026 · rama `feat/sato-viviente` → `main`. Confianza global 8/10.*
