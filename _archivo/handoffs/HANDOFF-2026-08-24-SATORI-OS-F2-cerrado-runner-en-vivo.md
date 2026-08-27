# HANDOFF — Satori OS · F2 cerrado, runner en vivo · 24/25-ago-2026

> **Estado final:** F1 y F2 del PLAN-SATO-EJECUTOR en prod, verificados de punta a punta.
> El runner de encargos ejecuta y reporta en vivo. Sesion cerrada limpia.

## BLUF

Sato ya ejecuta, no solo captura. La sesion cerro los ultimos tres gaps: (1) fix del Muelle
tras accion por voz, promovido a prod @50; (2) runner de encargos encendido con las dos
llaves de Bastion (cebo verde + `HABILITADO=True`); (3) parche de robustez del runner
(retry+timeout, cola durable, ejecucion idempotente) que cerro los dos encargos huerfanos
de la primera corrida (ENC-0001, ENC-0002). El lazo voz->aprobacion->runner->reporte->CM
esta probado en vivo.

## Lo que quedo en prod

### @50 (deployment `AKfycbxZJL4E_...`)
- **Muelle: refresco tras accion por voz.** `src/index.html`: `visibilitychange` +
  debounce 20s reusando `refrescar()` de Akasha. Evita el sintoma "la aprobacion desaparecio
  pero el UI no se entero". Commit `d0c7807`.
- **CAPABILITIES regen** + HANDOFF sincronizado (commit `3ce808d`, deploy @50).

### Runner de encargos (voz/runner/, en el Mac, NO en GAS)
- `encargos_runner.py`: dos llaves (`HABILITADO=True` + marcador `.encargos_runner_enabled`).
- **Parche 25-ago** aplicado y validado en vivo:
  1. `_post` con retry 3x + timeout 90s (backoff 5/10/20s). Cold-start de GAS deja de
     ser terminal — el 2do intento pega caliente.
  2. Cola durable `.pending_reports.jsonl`: si un reporte falla despues de ejecutar, se
     encola y se reintenta al arranque del proximo run. Cierra el hueco de que `poll`
     marca `en_ejecucion` ANTES de ejecutar (encargo huerfano si el reporte se pierde).
  3. Ejecucion idempotente: si `resultado.md` ya existe, no vuelve a correr `claude`.
- **Bastion C1-C7 intactos:** guardia+deny-list (11 rechazos+2 aceptaciones probados por
  cebo), scratch aislado, tools solo-lectura (`Read Grep Glob WebSearch WebFetch`), sin
  `--dangerously-skip-permissions`, timeout 20min, cap 10/dia, kill-switch #7.

### Encargos ejecutados y cerrados en vivo
| ID | Tipo | Estado | Como cerro |
|---|---|---|---|
| ENC-0001 | investigar (proveedores de velas) | hecho | reporte encolado post-timeout, reenviado por retry |
| ENC-0002 | investigar (proveedores de velas) | hecho | idem |

Ambos con `resultado.md` real en `entregables/encargos/<id>/` (BLUF, tabla 3 vias,
confianza 6/10 — investigacion util). Log en `~/Library/Logs/satori-encargos-runner.log`.

## Frontera de confianza (16-jul, NO negociable, sigue vigente)

La cadena `objetivos.descripcion -> correrDirector -> pregunta CRUDA al LLM` +
`GUARDIA_INYECCION` que bendice la pregunta **sigue sin sanear**. Prerequisito para
cualquier ampliacion que escriba campos que un agente luego lea como instruccion.
F1/F2 se limitan a acciones cuyo payload NO entra a prompts de agentes (decidir,
disparar, tarea, encargar) — respeta la frontera.

## Backlog priorizado (por PLAN-SATO-EJECUTOR)

| # | Fase | Que | Tamano | Gate |
|---|---|---|---|---|
| 1 | F2.d | `codigo_dry`: encargos que editen el repo (diffs sin push) | M | prerequisito GUARDIA_INYECCION saneada + purga |
| 2 | F3 | Tailscale para la voz (sacar del loopback) | M | Bastion (superficie de red) |
| 3 | F3 | Retomar PWA-C Fase 0 (iPhone) | M | Bastion (superficie de red) |
| 4 | F4 | Adopcion #3 mapa Trillion: connection health por conector externo | 3-4h | should |
| 5 | F4 | Adopcion #4: modo persona en consejo-asesores | 2-3h | nice |
| 6 | F4 | Adopcion #1: regla anti-brief-estatico | 30min | must, empezar por aca |
| 7 | F4 | Adopcion #2: WWWHH estructurado en handoffs | 1-2h | should |
| 8 | N2 v2 | push automatico con Direccion pre-aprobada | M | despues de codigo_dry |
| 9 | launchd | always-on del runner (plist templateada en voz/runner/) | S | tras primera semana estable |

Not-to-do explicito: Supabase/DigitalOcean/Three.js (descartados 27-jul), replicar los 25
prompts Trillion (mapeados: 17 cubiertos, 6 contra-arquitectura), board con nombres
reales como servicio a cliente sin rebranding (riesgo impersonation).

## Verificacion offline (para el proximo Cowork)

```
cd ~/Documents/Claude/Projects/SatoriOS
node _harness.js | tail -3                # 658/0
node _f1_voz_checks.js | tail -1          # F1: 24/24
node _f2_voz_checks.js | tail -1          # F2: 30/30
python3 _verificar_index.py               # index 439/439
cd voz/runner
../agent/.venv/bin/python encargos_runner_selftest.py --check-only  # 16 OK (gate1 se
                                                                     # invierte porque ya
                                                                     # esta encendido)
```

## Como retomar

Proximo Cowork lee este handoff + `PLAN-SATO-EJECUTOR-2026-08-24.md` + memoria
`_cerebro/00-INBOX.md` (entry 25-ago). Modo ejecutor desde el primer mensaje.

## Confianza global

- Ejecucion + reporte + cierre en GAS: **9/10** (probado en vivo con ENC-0001/0002).
- Robustez del retry contra cold-start: **8/10** (el intento 1 casi siempre falla; el 2
  cierra en <10s). Si empezara a fallar tambien el 2do intento, subir el timeout de
  90s a 120s.
- Guardia+aislamiento del runner: **9/10** (Bastion completo, cebo verde,
  scratch aislado, sin repo ni .env).

## Files clave tocados esta sesion

- `src/index.html` — Muelle refresh visibilitychange (3 edits)
- `voz/runner/encargos_runner.py` — retry+cola+idempotencia (parche 25-ago)
- `voz/runner/.pending_reports.jsonl` — cola durable (gitignored)
- `voz/runner/.encargos_runner_enabled` — marcador (gitignored, creado por cebo)
- `.gitignore` — cola pendientes agregada
- `CAPABILITIES.md` — regen @50
- `_archivo/handoffs/HANDOFF-2026-08-24-SATORI-OS-F2-cerrado-runner-en-vivo.md` — este handoff

## Cierre honesto

Incluye: F1+F2 en prod, runner en vivo, dos encargos reales cerrados, parche de robustez
validado, HANDOFF y memoria escritos. Queda abierto: encender launchd del runner (S,
plist templateada esperando primera semana estable), F2.d, F3, F4.
