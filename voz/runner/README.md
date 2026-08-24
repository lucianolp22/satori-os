# Runner de Encargos (F2 · Sato Ejecutor) — cómo se enciende

> El runner ejecuta encargos APROBADOS con `claude -p` en tu Mac. Es la superficie de máximo riesgo
> del sistema. Por eso **arranca deshabilitado** y solo se enciende con un acto deliberado tuyo, tras
> pasar el cebo. NADIE (ni Cowork) lo enciende por vos.

## Qué hace, en una línea
Bandeja `Encargos` (GAS) → vos aprobás (CM o voz) → el runner levanta el encargo → lo ejecuta con
Claude Code headless en un scratch aislado (solo lectura, sin ver el repo) → captura el resultado a
`entregables/encargos/<id>/resultado.md` → lo reporta a GAS y te avisa.

## Controles de seguridad (Bastión C1–C7)
- **Dos llaves para encender:** `HABILITADO = False` en `encargos_runner.py` **y** el marcador
  `.encargos_runner_enabled` (lo crea el cebo). Faltando cualquiera, el runner sale sin ejecutar.
- **Aislamiento:** cada encargo corre con `cwd` en su scratch vacío; `claude` usa solo
  Read/Grep/Glob/WebSearch/WebFetch (sin Edit/Write/Bash) y **sin** `--dangerously-skip-permissions`.
  No ve el repo ni el `.env`.
- **Guardia + deny-list:** rechaza tipos/repos fuera de whitelist y textos que pidan secretos,
  ejecución o escalada, ANTES de tocar `claude`.
- **Prompt-guardia:** el texto del encargo entra como DATO; si pide romper reglas, `claude` aborta.
- **Frenos:** respeta el kill-switch #7, timeout 20 min, cap 10/día, uno a la vez.
- **v1 = dry-run:** solo `investigar` y `documento`. `codigo_dry` (editar el repo) queda para F2.d.

## Prerequisitos
1. `claude` CLI instalado: `npm i -g @anthropic-ai/claude-code` (y logueado).
2. `ENCARGOS_SECRET` generado y puesto en DOS lados (deben coincidir):
   - Script Properties del MAESTRO (editor GAS → Configuración → Propiedades del script).
   - `voz/agent/.env.local` como `ENCARGOS_SECRET=<mismo valor>`.
   Generar: `openssl rand -hex 24`.

## Encendido (orden estricto)
1. **Cebo (F2.c):** desde `voz/runner/`, correr con el python del venv:
   `~/Documents/Claude/Projects/SatoriOS/voz/agent/.venv/bin/python encargos_runner_selftest.py`
   Debe imprimir **CEBO VERDE** y crear `.encargos_runner_enabled`. Si sale ROJO, NO seguir.
2. **Gate 1:** editar `encargos_runner.py` → `HABILITADO = True`.
3. **Prueba manual (sin launchd todavía):** aprobar un encargo inocuo por voz
   ("encargá una investigación sobre X" → aprobarlo) y correr el runner una vez a mano:
   `~/Documents/Claude/Projects/SatoriOS/voz/agent/.venv/bin/python encargos_runner.py`
   Verificar `entregables/encargos/<id>/resultado.md` + el aviso en el CM. Y un encargo-cebo hostil
   aprobado a la fuerza debe quedar `fallido` con "rechazado por guardia".
4. **launchd (opcional, para que corra solo):** `cp com.satori.encargos.runner.plist ~/Library/LaunchAgents/`
   y `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.satori.encargos.runner.plist`.

## Apagar
`launchctl bootout gui/$(id -u)/com.satori.encargos.runner` y/o `HABILITADO = False`.
El kill-switch #7 del sistema (pausarSistema) también lo frena sin tocar el runner.

## Riesgo residual declarado (Custodio)
El aislamiento (scratch + solo-lectura) evita que un encargo lea el repo/`.env`. La deny-list y el
prompt-guardia son capas extra; ninguna es única. Para `codigo_dry` (F2.d) hará falta una capa más
(deny-rules en `.claude/settings` del repo + revisión del diff antes de merge). No habilitar
`codigo_dry` sin ese análisis.
