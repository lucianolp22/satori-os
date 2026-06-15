# Migración a Google Workspace — Satori OS (camino C)

> Destraba el muro de Advanced Protection (`Error 400: policy_enforced`) llevando el OS a tu
> Workspace y confiando la app desde el Admin console. **Punto de partida:** ya tenés Workspace + dominio
> (sin Fase 0). Cowork deja el plano; vos hacés lo de cuenta/admin; Code hace clasp. **Fecha:** 2026-06-15 · Confianza: 8/10.

## Decisión clave antes de arrancar: el usuario-OS y APP
El OS necesita un **usuario de tu Workspace** que sea dueño del proyecto Apps Script + los Sheets. Dos variantes:

- **C1 — recomendado para el piloto:** usuario Workspace dedicado al OS (p.ej. `os@tudominio`), **NO** enrolado en APP.
  Más simple: `clasp` y la app autorizan con el flujo normal de Workspace, sin choque con APP. Tu identidad personal
  sigue en APP. El usuario-OS es una identidad de servicio acotada (mínimo privilegio).
- **C2 — máxima protección:** el usuario-OS también en APP. Hay que confiar en el Admin console **dos** OAuth clients:
  el de **clasp** y el de la **app** (si no, `clasp login` también se bloquea — es el mismo muro). Más seguro, más setup.

Default: **C1** para destrabar ya; subís a C2 antes de escalar si querés. (Bastión avala C1: tu personal queda blindada y el usuario-OS es acotado.)

## Fase 1 — Inventario de datos a preservar (ANTES de re-crear)
El sistema se re-bootstrapea solo (setup + cargaInicialClientes crean MAESTRO y 5 clientes de cero). Lo único que se
pierde es lo cargado **a mano**. Revisar en el MAESTRO actual (personal) y los 5 Sheets:
- MAESTRO: `Config` (valores cambiados), `Umbrales` no aplica acá, `Proyectos`/`Tareas` reales, `Bitacora`, `Gobernanza`.
- Cada cliente: `Datos_operativos`/`KPIs` reales, `Umbrales`, `Reglas`, `Aprobaciones` ya decididas (append-only histórico).
- Exportar lo que importe. **Si está todo vacío/stub → re-crear limpio sin pérdida** (hipótesis: es el caso a esta altura del piloto).

## Fase 2 — Re-crear el OS bajo Workspace
1. `clasp login` con la cuenta **Workspace-OS** (no la personal).
2. `clasp create --type standalone --title "Satori OS — MAESTRO"` → nuevo `scriptId` → actualizar `.clasp.json`.
3. `clasp push -f` — sube el código actual (`a6e641e`, sin cambios).
4. Editor (cuenta Workspace) → `bootstrap()` → crea MAESTRO nuevo (`MAESTRO_ID` nuevo en Script Properties) + 5 clientes + triggers + 1ª sync.
5. Re-set Script Properties: `CLAUDE_API_KEY` (obligatorio), `API_BUDGET_MENSUAL_USD` y `WORKER` (opcionales).
6. Re-cargar lo preservado en Fase 1 (si hubo).

## Fase 3 — Confiar la app (Admin console, vos super-admin)
- **Security → Access and data control → API controls.**
- C1: **Manage Third-Party App Access → Configure new app →** pegar el **OAuth Client ID** del proyecto → **Trusted**
  (o tildar **"Trust internal apps"** si el proyecto es interno al org).
- C2: además, confiar el **OAuth Client ID de clasp**.
- El Client ID del proyecto sale en Apps Script → **Project Settings → GCP Project** (para un client ID propio, vincular un GCP project del org).

## Fase 4 — Autorizar + validar (cierra el gate E2+)
- `bootstrap()` re-autoriza (ahora **pasa**, app trusted) → `selfTest()` → **`debugE21()`** → con el log cierro **E2-1**.
- Casos manuales E2-3 (email a vos mismo) / E2-5 / 8 / 9 / 11 / 13 → **Purga de cierre E2+**.
- Recién con esto verde queda habilitada la **Etapa 8a** (`ETAPA-8-PLAN.md`).

## Quién hace qué (ejecución supervisada)
- **Vos:** crear usuario Workspace-OS, decidir C1/C2, `clasp login`, Admin console (trust), correr funciones en el editor, mover datos.
- **Claude Code:** `clasp create`/`push`, ajustes de código si hicieran falta.
- **Cowork:** este plano + auditoría + cerrar E2-1 desde el log de `debugE21` + Purga.

## Riesgos (cuerpos)
- 🛡️ **Bastión:** `CLAUDE_API_KEY` solo en Script Properties del proyecto nuevo, nunca en código ni Sheet. El usuario-OS (C1) es identidad de servicio: no usarla para mail personal ni nada fuera del OS.
- 🔬 **Senior (Auditor):** re-crear cambia `MAESTRO_ID` y las URLs de los 5 Sheets — es **esperado** (el sistema nace nuevo, sin punteros viejos). Verificar que `url_sheet_cliente` quede consistente tras `bootstrap()`. El proyecto/Sheets viejos en la cuenta personal → trashear para no confundir cuál es el vigente.
- 🔵 **Arquitecto:** barato ahora (Sheets casi vacíos); en 3 meses con data real, caro. Hacerlo ya.

## Supuestos (máx 3)
1. Sos (o podés ser) super-admin del Workspace.
2. Los 5 Sheets tienen poca/ninguna data real → re-crear es seguro (confirmar en Fase 1).
3. C1 alcanza para el piloto; tu cuenta personal sigue en APP.

## Pendiente detrás de este muro
- **E2-1** (bug de Sheets, falla `selfTest`): se diagnostica con `debugE21` recién en Fase 4. No se toca antes.

---

# RUNBOOK RESUELTO — decisiones 15-jun (C1-reuse · clasp · re-crear limpio)

**Decidido por Luciano:** C1 **reusando una cuenta Workspace existente** (sin APP) · vía **A (clasp)** · **Fase 1 = no-op**.

**Inventario Cowork (15-jun, leído directo del Drive de `llopriore@gmail.com`):** cero data cargada a mano.
`Clientes` (5 reales) está hardcodeado en `cargaInicialClientes()` (03_cliente.js:72-78) → se regenera idéntico.
`Config` (12 claves) = `CONFIG_DEFAULTS` (01_schema.js:57) → se regenera. Proyectos/Tareas/Avisos/Bitácora/
Gobernanza/Aprob_agregadas vacías; 5 Sheets cliente solo headers (Vehemence verificado entero);
Cola_tareas/Actividad/Consumo = runtime descartable. **Re-crear limpio es seguro — confianza 9/10.**
Los 6 Sheets viejos quedan **intactos** hasta el gate verde (red de seguridad). Único costo: URLs de los 5
Sheets + `MAESTRO_ID` cambian (esperado por diseño) y `fecha_alta`→hoy (cosmético).

## Fase 2 — comandos exactos (Mac, repo `~/Documents/Claude/Projects/SatoriOS`)
Lanzá Claude Code en esa carpeta. Vos hacés el `clasp login` (browser) y las corridas en el editor; Code corre el resto y reacciona a los errores.

```bash
cd ~/Documents/Claude/Projects/SatoriOS
clasp logout
clasp login                          # browser → ELEGÍ luciano@satoriconsultoria.com (NO llopriore@gmail.com)
mv .clasp.json .clasp.json.personal.bak   # conserva el scriptId viejo por las dudas
clasp create --type standalone --title "Satori OS — MAESTRO" --rootDir src
clasp push -f                        # sube a6e641e tal cual (sin cambios de código)
```
Fallback si `clasp create` choca con los archivos de `src/`: crear el proyecto standalone desde el editor de la cuenta Workspace, copiar su scriptId a `.clasp.json` (con `"rootDir": "src"`) y `clasp push -f`.

**Gate de cuenta (una vez, ANTES de `clasp create`):** habilitar la Apps Script API del usuario en https://script.google.com/home/usersettings, **logueado en el browser como `luciano@satoriconsultoria.com`** (ojo con multi-cuenta). Sin esto, `clasp create` corta con *"User has not enabled the Apps Script API"*. Propaga en ~1-2 min.

Luego en el editor (cuenta Workspace), en orden:
1. `bootstrap()` → MAESTRO nuevo + 5 clientes + triggers + 1ª sync. Autorizá permisos (pasa tras Fase 3; si la cuenta es APP-free, autoriza directo ya).
2. Project Settings → **Script Properties**: setear `CLAUDE_API_KEY` (oblig.). Opc.: `API_BUDGET_MENSUAL_USD=25`, `WORKER`.
3. `selfTest()` → debe terminar en "— TODO OK —". Si rojo en E2-1 → `debugE21()` (ver Fase 4).

> 🛡️ 🔑 **Guardián de Accesos — ALTO · DECIDIDO: rotar.** No copies la `CLAUDE_API_KEY` vieja. Generá una nueva en console.anthropic.com → solo en Script Properties del proyecto Workspace → revocá la vieja al trashear el proyecto personal. Nunca en código ni Sheet. Confianza 9/10.
> 🛡️ 🔑 **Guardián de Accesos — MEDIO · DECIDIDO: cuenta admin/principal del Workspace.** Concesión consciente de piloto — el OS corre como identidad alta: los scopes `drive` + `send_mail` actúan sobre **todo** tu Drive y mandan mail **como vos**. Mitigaciones obligatorias: deploy queda `access: MYSELF` (jamás "Anyone"); confiar **solo** ese client ID; no sumar scopes; **mover a un `os@dominio` dedicado antes de activar agentes de laboratorio que envían mail o de escalar la cartera.**

## Fase 3 — confiar la app (Admin console, super-admin)
- Apps Script → Project Settings → **GCP Project**: vinculá un proyecto GCP del org (da OAuth Client ID propio) y poné el **consent screen en Internal** (mata el "app no verificada").
- Admin console → Security → Access and data control → **API controls → Manage Third-Party App Access → Configure new app** → pegá ESE Client ID → **Trusted**. C1 = un solo client ID (el de la app).

> 🛡️ **Arquitecto de Defensa — MEDIO:** confiá SOLO ese client ID, no abras "trust all internal". Deploy ya al mínimo (`access: MYSELF`, `executeAs: USER_DEPLOYING`); scopes justos (spreadsheets, drive, scriptapp, external_request, send_mail, userinfo.email). No sumes scopes en la migración.

## Fase 4 — diagnosticar E2-1 (recién acá, con auth resuelta)
`debugE21()` en el editor → pegá el log completo en Cowork. El fix `'@'` (`a6e641e`) NO lo resolvió → **no es coerción de id pura**. Hipótesis ya mapeadas a líneas del log (descartar 2 de 3 en minutos):

| Línea de `debugE21` | Si muestra… | Causa probable | Conf. |
|---|---|---|---|
| `match por id exacto?` + per-fila `id=` | `false` con `id=` Date / nº / char raro | id read-back ≠ `ret.id` (coerción residual pese a '@') | 6/10 |
| `filas ANTES/DESPUES` + `control APR-CTRL presente?` | DESPUES no sube y/o APR-CTRL ausente | escritura no visible cross-instancia (openByUrl/`flush`) | 6/10 |
| `headers=` + per-fila `estado=` | `estado=""` o columnas corridas | desalineación header↔key en `Aprobaciones` (estado nace en blanco) | 5/10 |

Notas de lectura: `crearAprobacion` hace `appendFila` + `SpreadsheetApp.flush()` bajo `conLock` (11_aprobaciones.js:62-83); `aprCli()` reabre fresco. Si APR-CTRL (appendFila directo) **sí** persiste pero la fila de `crearAprobacion` **no** → el problema es específico del camino E2, no del modelo de escritura. Si **ninguna** persiste cross-instancia → es el modelo `openByUrl` bajo este runtime/cuenta.

Cierre: fix mínimo desde la evidencia → `selfTest()` verde → casos manuales E2-3/5/8/9/11/13 → **Purga de cierre E2+** → trashear los 6 Sheets + proyecto viejos de la cuenta personal (evitar doble fuente de verdad).
