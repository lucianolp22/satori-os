# ENCARGO CODE — Voz pulido post-@27: espejo de aprobaciones + N9 + verificación N5 (16-jul noche)

> **Origen:** primera prueba real de `accion` en @27 (16:4x). La tool FUNCIONÓLA de punta a punta
> (confirmación verbal → APR-0001 creada → mensaje N5 correcto "un clic y queda registrado"), pero
> la aprobación NO apareció en el CM. + los 2 cabos del log de las 16:23 (pre-promote).
> Dry-run → `--go`, guardia clasp, node --check, asserts en selfTestF2 (chk acumulativo), commit + push /dev.
> Promote lo decide Luciano. Leé HANDOFF.md primero.

## 1 · BUG visible — las aprobaciones creadas por voz no aparecen en el CM [el importante]

**Diagnóstico (verificalo contra el código antes de construir):** `crearAprobacion` escribe la fila en
la hoja `Aprobaciones` del CLIENTE; el CM lee el ESPEJO `Aprobaciones_agregadas` del MAESTRO, que solo
reconstruye `syncMaestro` (documentado el 08-jul en Delta 2, que resolvió el caso inverso con
`quitarAgregada_`). `aprobacionDesdeRecomendacion` (T2 B2) llama `syncMaestro()` tras crear; `accionVoz_`
NO — y no debe: syncMaestro tarda 15-30s server-side y colgaría el doPost de voz (lección SPEC-GAS 14-jul).

**Fix quirúrgico:** helper **`agregarAgregada_(idCliente, filaAprobacion)`** — el espejo INCREMENTAL de
`quitarAgregada_`: appendea la fila a `Aprobaciones_agregadas` bajo `conLock`, con las MISMAS columnas
que arma syncMaestro (leé el builder real, no asumas el schema). Llamalo desde **`crearAprobacion`**
(cubre a TODOS los callers: voz, T2, futuros) — verificá primero que syncMaestro sea reconstrucción
completa idempotente (no debe duplicar la fila incremental en la próxima corrida).
**Matices:** (a) una aprobación auto-aprobada por Dirección NO debe aparecer como pendiente en el espejo
— respetá el criterio de syncMaestro (¿el espejo lleva solo pendientes o todas con estado? copiá su
lógica exacta); (b) fail-safe: si el append al espejo falla, la aprobación del cliente YA está escrita —
loguear y seguir (el sync de la mañana la refleja igual; no romper el turno de voz por el espejo).

**Asserts (selfTestF2, tanda D16):** crear vía `accionVoz_` → la fila aparece en `Aprobaciones_agregadas`
SIN correr syncMaestro · syncMaestro posterior NO la duplica · auto-aprobada por Dirección → respeta el
criterio del espejo · fallo simulado del espejo no rompe la creación.

## 2 · Regla N9 — tool falla ≠ inventar soporte [prompt, agent.py]

En el log de las 16:23 (pre-promote), al fallar la tool `accion`, Sato terminó recomendando "comunicate
con **Cloud Pro** y mencioná el inconveniente" — un canal de soporte QUE NO EXISTE (probablemente eco
STT de "Claude Pro"). Primo del gap 4 al revés: en vez de "no puedo" seco, un camino inventado.

**Regla N9 (redacción candidata, ajustá el estilo del prompt):**
"REGLA N9 (cuando una herramienta falla): decí que falló y cuál era la acción, y ofrecé los TRES caminos
reales — reintentar ahora, que Luciano lo haga desde el Centro de Mando, o dejarlo anotado para que el
equipo lo revise (capturar). JAMÁS inventes un canal de soporte, un equipo técnico o un destino que no
esté en tus herramientas. Si te preguntan el detalle del error y no lo tenés, decí que no lo tenés (N4)."

Verificación conductual (no unit-testeable): queda en la prueba de voz de cierre — forzar un fallo
(p.ej. tool contra id inexistente) y ver que ofrece los 3 caminos sin inventar.

## 3 · Verificación N5 — la nota del "motivo del error" [investigar ANTES de tocar]

En el mismo log, Luciano pidió "dejame registrado el porqué" y Sato afirmó "dejé registrado el motivo del
inconveniente". **Verificá si es cierto:** (a) grep del log del agente (`~/Library/Logs/satori-voz-agent.log`,
~16:23-16:26) buscando una llamada a `capturar` en ese turno; (b) buscá en la Bandeja una captura de esa
hora con fuente `voz`.
- **Si existe la nota:** N5 intacta, cerrá el punto documentándolo.
- **Si NO existe:** es afirmación de acción sin acción (la clase GRAVE del stress test 12/07). Refuerzo de
  prompt: "decir 'lo dejé registrado/anotado' SOLO después de que la tool capturar devuelva OK en ESTE
  turno; si no la llamaste o falló, decí que no pudiste anotarlo" — y sumá el caso a la prueba conductual.

## 4 · Menor (si sobra sesión): nombres gemelos en el desplegable

`verifArchivoCola()` (dry-run) y `archivarColaVieja()` (ejecuta real) quedaron adyacentes en el editor.
Tu propio aviso. Opción barata sin romper nada: renombrar el wrapper real a `archivarColaViejaREAL()` o
que pida confirmación vía `Browser.msgBox` cuando corre desde editor. Decisión tuya; si lo hacés,
actualizá el HANDOFF y la lista de wrappers.

## Entregable

`_voz_pulido_code.sh` (dry-run/--go) + asserts nuevos en selfTestF2 + HANDOFF actualizado. Recordatorio
para el output: el punto 1 toca GAS → funciona en voz recién POST-promote (@28); los puntos 2-3 son
agent.py local → `kickstart -k` alcanza. Prueba de cierre: "registrá X para Vehemence" → confirmar →
**la aprobación aparece en el CM sin tocar nada** → clic → objetivo en CLI-002 con metrica vacía.
