# PAQUETE-CODE-B3 — Backup / snapshot — 2026-07-03

**BLUF:** B3 = respaldar **datos** (Sheets) y **código** (repo). Cowork ya escribió y validó offline el módulo de datos (`src/21_backup.js`) + el runbook de recuperación. Falta: (1) Code pushea el módulo y limpia el temporal B2; (2) **crear un remoto git privado** — hoy `git remote -v` está VACÍO, o sea el código NO tiene copia fuera del Mac (hueco real de B3); (3) Luciano corre 5 funciones reversibles en el editor. Gate de salida: **restore probado (`drillRestore` verde), trigger semanal instalado, código en remoto privado.**

> Regla dura respetada: git/clasp los ejecuta Code; guardia diff GAS↔repo antes de todo push; `webapp.access=DOMAIN`; prod webapp `@15` NO se toca (el backup corre por editor+trigger sobre HEAD, no toca doGet/doPost → no requiere promover versión nueva).

---

## Qué entregó Cowork (ya en el repo, sin commitear)

- `src/21_backup.js` — módulo de backup. `node --check` OK · 12 helpers externos verificados existentes · 0 colisiones de nombre. Funciones: `backupSemanal()` (trigger, respeta kill switch), `backupAhora()` (manual), `instalarTriggerBackup()`/`estadoTriggerBackup()`, `smokeBackup()` (prueba de scope reversible), `drillRestore()` (ensayo de restauración), `backupListar()`.
- `RUNBOOK-recuperacion-total.md` — «el Mac murió» + escenario datos + inventario Script Properties.
- `_b3_code.sh` — script de este paquete (guardia + push + commit).
- `HANDOFF.md` — actualizado con estado B3.

**Diseño clave (Bastión):** el snapshot usa `Spreadsheet.copy()` (scope `spreadsheets`, ya concedido) + DriveApp solo sobre objetos creados por la app → alcanza con `drive.file`. `smokeBackup()` lo PRUEBA antes de confiar el trigger (mismo criterio que `smokeKill`). Los backups son copias privadas en el mismo Drive; no heredan sharing.

---

## Parte 1 — Code: push del módulo + limpieza del temporal B2

Un solo script, con guardia que **aborta** ante drift. Corre en el Mac.

1. **Guardia + preview (read-only):**
   ```
   bash _b3_code.sh
   ```
   Espera: `precondiciones OK`, el diff GAS↔repo (solo debe mostrar `Only in src: 21_backup.js` como nuevo y el temporal `99_tmp_b2.js` a borrar), `GUARDIA: OK`, `secret-scan: limpio`, y el preview de `git status`. Si dice `DRIFT DETECTADO` → PARAR, hay cambios en el editor de GAS que no están en el repo; revisar a mano antes de seguir.

2. **Ejecutar:**
   ```
   bash _b3_code.sh --go
   ```
   Hace: borra `src/99_tmp_b2.js`, `clasp push -f` (HEAD de GAS queda con `21_backup.js` y sin el temporal), y `git commit` del módulo + docs (`EJEMPLO-CLAUDE-cliente-DEMO.md`, `HANDOFF.md`, runbook, este paquete, `settings.local.json`).

**Rollback Parte 1:** el commit es revertible (`git revert`); el temporal borrado no afecta prod (`@15` se promovió antes de que existiera). Si `clasp push` fallara, `clasp login` y reintentar.

---

## Parte 2 — Off-Mac: remoto git privado (el hueco real de B3)

Hoy el código vive SOLO en el Mac + en el proyecto GAS. Si el Mac muere sin remoto, se pierde el **historial git y los docs no-.js** (el código .js se recupera del GAS, pero no el resto). Solución: remoto privado.

**Bastión (verificado):** `.gitignore` cubre `.env.local`, `.clasp.json*`, `client_secret*.json`, `.env`, `*.bak`, `_*.txt`. Los únicos archivos `voz/agent` trackeados son `.env.example` (claves vacías) y `get_refresh_token.py` (sin secretos). `.git` pesa 5 MB. → **seguro para un remoto PRIVADO.** El `_b3_code.sh` corre un secret-scan extra antes de commitear.

1. **Luciano (auth):** crear un repo **privado** vacío en GitHub (github.com/new → nombre p.ej. `satori-os` → Private → sin README). *(O si `gh` está logueado: `gh repo create satori-os --private --source=. --remote=origin --push` hace todo de una.)*
2. **Code:** enlazar y pushear:
   ```
   git remote add origin git@github.com:TU-USUARIO/satori-os.git
   git push -u origin HEAD
   ```
   *(HTTPS si no hay llave SSH: `https://github.com/TU-USUARIO/satori-os.git`.)*
3. **Verificar:** `git remote -v` muestra `origin`; el repo privado en GitHub muestra el último commit. **Confirmá que NO aparecen `.env.local` ni `.clasp.json` en GitHub** (deben estar ausentes por `.gitignore`).

**Belt-and-suspenders opcional:** además del remoto, un `git bundle create satori-os.bundle --all` subido manualmente a la carpeta Drive «Satori OS — Backups» te da una copia del repo dentro del mismo backup de datos.

---

## Parte 3 — Luciano (editor Apps Script): 5 funciones reversibles, EN ESTE ORDEN

Todas se corren desde el editor (Ejecutar). Ninguna toca prod ni datos vivos de forma irreversible.

1. **`smokeBackup()`** — prueba que el scope alcanza. Espera `{ pass: true, detalle: [...todas true] }`. Crea y **borra** una hoja+carpeta throwaway; no deja rastro. *Si `pass:false`* → el ítem en `false` dice qué op del scope faltó → PARAR y avisar a Cowork (habría que ajustar el módulo; no seguir).
2. **`backupAhora()`** — primer backup real. Espera `{ ok: true, copiados: [MAESTRO + N clientes], fallidos: [], folder_url: ... }`. Abrí `folder_url`: debe tener 1 copia del MAESTRO + 1 por cliente.
3. **`drillRestore()`** — ensayo de restauración (**gate B3**). Espera `{ ok: true, restore_url: ..., pestanas: 14, esperadas: 14 }`. Abrí `restore_url`, verificá que los datos están, y **mandá esa hoja `__RESTORE_DRILL__` a la papelera** (es un ensayo, queda a propósito).
4. **`instalarTriggerBackup()`** — agenda semanal (domingo 04:00). Espera `{ ok: true, nota: 'trigger backupSemanal creado...' }`.
5. **`estadoTriggerBackup()`** — confirmar. Espera `{ instalado: true, cantidad: 1 }`.

**Rollback Parte 3:** las copias sobran → papelera de Drive. El trigger → panel Activadores → borrar. Nada de esto toca el MAESTRO vivo.

---

## Parte 4 — Bastión / seguridad (acciones de mayor palanca)

1. **Respaldar `voz/agent/.env.local` en un gestor de contraseñas** (1Password/Bitwarden): LiveKit URL/KEY/SECRET, OPENAI_API_KEY, ELEVENLABS_*, GAS_VOZ_URL, VOZ_TOOL_SECRET. **Por qué:** es lo único cuya pérdida obliga a *regenerar* todas las keys si muere el Mac (ver runbook, escenario A). Anotar también el `scriptId` (está gitignored, no viaja al remoto).
2. **Opcional (defensa en profundidad, arrastre de B1/B4):** revocar el grant OAuth viejo `drive` en myaccount.google.com/permissions → el próximo consent pedirá solo «archivos creados por esta app».
3. **Mensual:** descargar el MAESTRO como XLSX a un disco/otro cloud (cubre el 5% que el backup in-Drive no cubre: pérdida de la cuenta Google).

---

## Gate de salida B3 (para marcar CERRADA)

- [ ] `smokeBackup()` = `pass:true` (scope probado)
- [ ] `backupAhora()` = ok, carpeta con MAESTRO + N clientes
- [ ] `drillRestore()` = ok, 14 pestañas, eyeball de los datos → **restore probado, no asumido**
- [ ] `instalarTriggerBackup()` + `estadoTriggerBackup()` = trigger vivo
- [ ] Remoto git privado con el último commit (código off-Mac)
- [ ] `.env.local` en gestor de contraseñas

**Siguiente del programa tras B3:** B5 purga total del sistema + `CAPABILITIES.md` (varios ítems de B6 —telemetría, estado-vigente, North Star— ya aparecen VERDES en el selfTest; re-verificar antes de re-planificar B6).
