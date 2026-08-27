# Pendientes gateados por el cierre de E2 — 27/08/2026

> Este archivo existe porque **PC-2 dio rojo**. Lo pide el gate previo de F3 del
> `ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md`. Se borra cuando E2 quede cerrado.

## Por qué está gateado — evidencia, no lectura del HANDOFF

| Cabo de E2 | Dueño | Estado | Evidencia |
|---|---|---|---|
| Promote a `/exec @57` | Luciano | ✅ **HECHO** | `clasp deployments` → `AKfycbxZJL4E…phLm @57`; HEAD `9c17f68` |
| `NTFY_TOKEN` en Script Properties | Luciano | ⚠️ **sin verificar** | Cowork lo reporta cargado; la comprobación real es `probarPushTelefono()` en el editor. No corrible headless |
| **2º reload de `agent.py`** | Luciano · Mac | ❌ **PENDIENTE** | El proceso vivo (PID 95500) arrancó **10:49:05**; `agent.py` tiene mtime **10:56:15** — 7 min después. `brief_hoy` no figura entre los módulos cargados del proceso y su `.pyc` se compiló a las **10:57**. El agente que corre **no tiene E2.d**: la voz no puede enunciar el bloque «HOY hay que mirar (N)» |
| `push_proactivo_on = true` | Luciano | ❌ **en `false`** (a propósito) | Decisión consciente post-eyeball. **Este encargo tiene prohibido tocarlo** (§0.8) |
| `selfTestTramo6()` contra Sheets | Luciano | ❌ **nunca corrido** | D48 (15 asserts) + D49 (17) — E1 y E2 están en prod sin un solo assert vivo |

⇒ Ruta tomada, según §4 del encargo: **sólo Bloque A**. `agent.py` no se tocó (lección +59).

## Lo que queda esperando, en orden

**Bloque B** — F3 (identity file `docs/SATO-IDENTIDAD.md` + `cargar_identidad()` con TTL por mtime)
y F4 (CAPABILITIES extendido + drift-checker). F3 toca `agent.py`.

**Bloque C** — F5 (Consejo) y F6 (migración del motor). F0 ya dejó el insumo: **veredicto GO con
margen amplio** (`out/audit-tokens-2026-08-27.md`). Dos correcciones al plan antes de correr F5:

1. **Usar `claude-sonnet-5`, no `claude-sonnet-4-6`** como override. Mismo mínimo de caché (1.024)
   y más barato: $2/$10 contra $3/$15.
2. **No hay credencial Anthropic en esta Mac** — sin `ant`, sin `ANTHROPIC_API_KEY`, sin SDK
   `anthropic` en el venv. F6 arranca bloqueado hasta que Luciano cargue la key en `.env.local`.
   Tampoco se verificó la disponibilidad del plugin `livekit.plugins.anthropic` (habría que tocar
   el venv, y eso implica reload — lección +59).

**Bloque D** — F7 (widget SatoUbicuo). Toca `agent.py` en F7c.
**F13** — checkpoint anti-drift. Toca `agent.py`.

> Los tres (F3, F6/F6', F7c, F13) deben consolidarse en **una sola tanda con UN solo
> `launchctl kickstart -k gui/$UID/com.satori.voz.agent` al final**. Lección +59.

**Bloque E** — F10 **no está gateado por E2**, pero sí quedó **reformulado por F2c**: el Cerebro es
canvas 2D, no Three.js. Ver `out/livingmind-inventario-2026-08-27.md` §4: F10-a (11 ítems, ~2 h, sin
cambio de stack) es ejecutable ya; F10-b (migrar a Three.js vendorizado) es **decisión de Luciano**.

**Bloque G** — F-CRM-Mobile no está gateado por E2 y no se ejecutó por la regla del encargo (sólo
Bloque A). Queda como el trabajo más grande y más listo para arrancar.

## Lo mínimo para desbloquear todo

Una sola pasada por el editor de Apps Script + un comando en la Mac:

```
1. Editor GAS:  selfTestTramo6()        → D48 + D49, 32 asserts vivos
2. Editor GAS:  probarPushTelefono()    → confirma NTFY_TOKEN
3. Editor GAS:  estadoVigente('CLI-000') / ('CLI-002') / ('CLI-003')   ← lo que faltó de F2b
4. Mac:         launchctl kickstart -k gui/$UID/com.satori.voz.agent   ← el 2º reload
5. Eyeball 30 s de voz: "hola Sato, dame el brief" → debe enunciar "HOY hay que mirar (N)"
6. Recién ahí:  setConfig('push_proactivo_on','true')   ← decisión tuya, no de Code
```
