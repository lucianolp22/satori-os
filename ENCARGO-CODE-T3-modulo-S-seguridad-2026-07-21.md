# ENCARGO CODE — T3 · MÓDULO S (seguridad del motor) — 2026-07-21

**Contexto:** tanda 20-21 jul CERRADA (5 gates pasados, purga 0 críticos, selfTest verde en editor 21-jul 09:53). Arranca **T3** del `PLAN-INTEGRAL-SATORI-OS-2026-07-18.md` (fila T3: "Cowork spec + Code, Bastión lidera seguridad; gate = selfTest+purga POR MÓDULO"). T3 va en 3 módulos, **uno por vez**: **S (seguridad, este encargo) → M (motor: D6 estados, D8 hot/cold, evals+piso, verificación ≥2 dominios) → H (SOUL.md, panel Salud humano, neural map render — NO 2D, está descartado)**. NO arrancar M ni H sin cierre de S.

**Verificado por Cowork contra el código (21-jul) — construir SOLO sobre esto:**
- `doGet` ya tiene gate de owner fail-closed (`08_webapp.js:22-26`, PURGA #4, `OWNER_EMAIL` en Script Properties). Los endpoints server-side que llama `google.script.run` **NO re-chequean identidad**: `setPrefUI` (471), `prefsUI` (479), `dispararAgenteUI` (969), `resolverAprobacionUI` (976), `metricasValidasUI` (986), `asignarMetricaUI` (1004), `crearTarea` (1149), `crearTareaQuick` (1175), `moverTarea` (1197) — y los demás que enumeres (grep `google.script.run` en `index.html` + voz.html y cruzar; esta lista es piso, no techo).
- Voz/Oficina: secretos comparados por digest (`ctEq_` `08_webapp.js:408`, whitelist de tools, D12 verde). **Sin vencimiento.**
- `correrSalud` 6 chequeos + panel Salud E8a4 en la UI (`index.html:567`). **Sin security-scan.**
- **No existe:** `_soloOwner_`, expiry de credenciales, matriz de riesgo, security-scan.
- Recordatorios duros: `clasp run` bloqueado (selfTest lo corre Luciano en editor) · git write solo vos · trabajar contra /dev, `/exec` NO se toca (promote lo decide Luciano) · todo selector/cambio se verifica contra el código real antes de commitear.

## S1 — `_soloOwner_()` en endpoints mutantes (Bastión: cerrar la puerta lateral)

- Helper único `_soloOwner_()` con el MISMO criterio fail-closed del doGet (reusar la lógica, no duplicar el string de la property). Si `Session.getActiveUser().getEmail()` ≠ `OWNER_EMAIL` o falta la property → `throw`/return `{error:'no_autorizado'}` **sin ejecutar nada**.
- Aplicarlo a TODOS los endpoints mutantes (los 9 listados + los que salgan del grep). Los read-only (`prefsUI`, `metricasValidasUI`, `datosHoy`, etc.): gatearlos también — costo cero y cierra enumeración de datos.
- **NO tocar** `doPost` (voz/oficina van por secreto propio) ni funciones de triggers (`corridaDiaria`, `drenarCola`, backup — corren como sistema, sin usuario activo: gatearlas las rompería).
- UI: si el server devuelve `no_autorizado`, toast claro, sin crash.

## S2 — Credencial con vencimiento (doPost secrets)

- Script Properties nuevas: `VOZ_SECRET_EXPIRA` y `OFICINA_SECRET_EXPIRA` (fecha ISO). `doPost` rechaza con `secret_expirado` (mismo camino fail-closed que `unauthorized`) si la fecha pasó; si la property falta → **decidir explícito y documentarlo: sin fecha = no expira** (compat con lo vigente, no rompe voz hoy).
- `correrSalud` chequeo nuevo: avisa en el CM cuando falten ≤7 días para un vencimiento (aviso tipo `credencial_por_vencer`), y falla el chequeo si ya venció.
- Rotación: función `rotarSecretoVoz()` documentada en HANDOFF (genera, muestra UNA vez, setea expiry a +90 días). No automatizar el reparto: el `.env` del agente lo actualiza Luciano a mano (instrucción llana en el output).
- Sembrar fechas iniciales: +90 días desde hoy.

## S3 — Gate por matriz de riesgo

- Matriz en `Config` (`riesgo_*`): filas = tipo de acción del sistema (leer_tenant, escribir_tenant, ejecutar_agente, accion_externa, tocar_config, tocar_secretos), valor = `permitir | aprobar | bloquear`. **Default-deny: combinación no listada = bloquear.**
- Un solo choke point `gateRiesgo_(tipo, ctx)` consultado por los caminos que ejecutan acciones de agentes (encolarAgente/ejecutores de cola, acciones de voz). No inventar caminos nuevos: cablear el gate en los existentes. El default-deny de Umbrales (montos) queda como está — la matriz lo complementa, no lo reemplaza.
- Siembra inicial conservadora: todo lo externo y lo que toque config/secretos = `bloquear`; escrituras de tenant = `aprobar` (pasa por Aprobaciones); lecturas = `permitir`.

## S4 — Security-scan (en Salud)

- `securityScan_()` estilo selfTest, corrido por `correrSalud`: (a) endpoints públicos del 08_webapp sin `_soloOwner_` (introspección por lista mantenida + assert de cobertura en selfTest); (b) secrets sin expiry o vencidos; (c) hojas sensibles visibles (reusar `CLIENTE_SHEETS_SENSIBLES`); (d) properties críticas vacías (`OWNER_EMAIL`, secrets); (e) `np_pausado` y kill-switch legibles. Resultado al panel de Salud como chequeo 7.

## Cierre del módulo S

1. Asserts nuevos en selfTest (serie D19): `_soloOwner_` rechaza no-owner y deja pasar owner · `secret_expirado` fail-closed · gate matriz default-deny · securityScan detecta un endpoint sin gate sembrado a propósito y lo reporta.
2. `node --check` + guardia drift + `clasp push` a /dev + commit/push GitHub.
3. HANDOFF.md: estado del módulo + 2 líneas de lo que Luciano corre en editor (`selfTest()`) y eyeballea en /dev (CM opera normal con los gates puestos; voz sigue andando).
4. Frenar ahí. Purga del módulo S la corre Cowork; después M.

**NO hacer:** módulos M/H · tocar /exec · re-flaggear gates verdes · automatizar reparto de secretos.
