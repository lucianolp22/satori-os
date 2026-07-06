# RUNBOOK — Recuperación total («el Mac murió») — Satori OS — B3

**BLUF:** Qué vive dónde, y cómo volver a operar si se pierde el Mac o los datos. Regla de oro: **el código y los datos NO viven en el Mac** — viven en Google (proyecto GAS + Sheets, cuenta `luciano@satoriconsultoria.com`). El Mac solo hospeda: el repo git local, el stack de Voz (`.env.local` + LaunchAgents + Tailscale) y el link de `clasp`. Este runbook cubre los dos desastres reales: **(A) muere el Mac** y **(B) se pierden/corrompen los datos**.

---

## Mapa de dónde vive cada cosa (para calibrar el miedo)

| Activo | Dónde vive | ¿Sobrevive a un Mac muerto? | Respaldo |
|---|---|---|---|
| Código GAS (src/*.js) | Proyecto Apps Script (Google) **+** repo git local | El de Google **sí**; el repo local **no** si no hay remoto | **git remote privado** (B3) |
| MAESTRO + Sheets cliente (datos) | Google Drive (`luciano@satoriconsultoria.com`) | **Sí** (están en la nube) | **backup semanal en Drive** (módulo `21_backup.js`) + XLSX off-Google mensual |
| Script Properties (secretos GAS) | Proyecto GAS (server-side) | **Sí** | Inventario abajo (nombres); valores → gestor de contraseñas |
| Voz: `.env.local` (LiveKit/OpenAI/ElevenLabs/VOZ_TOOL_SECRET) | `voz/agent/.env.local` (solo en el Mac, gitignored) | **NO** | **Gestor de contraseñas** (acción pendiente) |
| Voz: LaunchAgents + Tailscale Serve | Mac | **NO** | Este runbook + repo |
| `clasp` link (`.clasp.json` con scriptId) | Mac (gitignored, PURGA #8) | **NO** | scriptId anotado en gestor de contraseñas |
| Credenciales `clasp` (`~/.clasprc.json`) | Mac (global) | **NO** | Se regeneran con `clasp login` |

**Conclusión operativa:** si el Mac muere, **no perdés ni el sistema ni los datos de los clientes**. Perdés la capacidad de *desplegar* (hasta re-clonar + re-clasp) y la *Voz* (hasta restaurar `.env.local`). Por eso las dos únicas acciones de blindaje que importan son: **(1) git remote privado** y **(2) `.env.local` en un gestor de contraseñas**.

---

## Inventario de Script Properties (nombres, NUNCA valores en el repo)

Documentar los valores en un gestor de contraseñas (1Password/Bitwarden), no acá.

- `MAESTRO_ID` — id del Sheet MAESTRO. **Crítico**: sin esto `getMaestro()` lanza y el sistema no arranca.
- `BACKUP_FOLDER_ID` — carpeta raíz de backups (la crea sola el módulo; se regenera si falta).
- `SISTEMA_PAUSADO` — kill switch (`1`=pausado).
- `VOZ_TOOL_SECRET` — secreto de la tool de voz (doPost). **Secreto.**
- `CLAUDE_API_KEY` — key de Anthropic (agentes). **Secreto.**
- `API_BUDGET_MENSUAL_USD` — tope de gasto mensual.
- `OWNER_EMAIL` — destino de las alertas por email.
- `alertas_email_on` — flag (`true`/`false`) de alertas por email.
- `AUTOHEAL_ON` — flag de auto-reparación de Salud.
- `WORKER`, `voz_alerta_fecha` — internos (dedupe/estado).

---

## Escenario A — Murió el Mac (comprar/formatear otra máquina)

1. **Instalar base:** Homebrew, Node LTS, git, y `npm i -g @google/clasp`. Instalar la app de Tailscale (App Store) y loguearte en el tailnet.
2. **Recuperar el repo:** `git clone <URL del remoto privado>` en `~/Documents/Claude/Projects/SatoriOS`. (Si no había remoto y no hay clone: el código igual vive en el proyecto GAS → `clasp clone <scriptId>` lo baja, pero perdés el historial git y los docs no-.js.)
3. **Re-linkear clasp:** `clasp login` (regenera `~/.clasprc.json`). Si falta `.clasp.json` (está gitignored), recrearlo con el `scriptId` (del gestor de contraseñas o de la URL del proyecto en script.google.com) y `rootDir=src`.
4. **Verificar que NO hace falta tocar los datos:** el MAESTRO y los Sheets cliente siguen intactos en Drive. Correr `selfTest()` desde el editor de Apps Script → debe dar TODO OK. Si da OK, el cerebro del sistema está sano; el Mac era solo el puesto de trabajo.
5. **Restaurar la Voz:**
   a. Copiar los valores a `voz/agent/.env.local` desde el gestor de contraseñas (LiveKit URL/KEY/SECRET, OPENAI_API_KEY, ELEVENLABS_*, GAS_VOZ_URL, VOZ_TOOL_SECRET).
   b. Reinstalar el entorno del agente (venv + `pip install` del `requirements`), reinstalar los LaunchAgents `com.satori.voz.agent` y `com.satori.voz.server` (RunAtLoad + KeepAlive) y verificar `launchctl` status 0.
   c. `tailscale serve --bg 8787` para re-exponer la PWA en el tailnet.
6. **Verificar Voz:** tocar «🎙 Hablar con Sato» en el CM (desktop) y en el iPhone (PWA). Debe conectar y responder con datos reales.

**Qué esperar:** pasos 1–4 devuelven el sistema operable en ~30–45 min. La Voz (5–6) es la parte más artesanal; sin `.env.local` respaldado, hay que **regenerar** todas las keys (LiveKit/OpenAI/ElevenLabs) → por eso el respaldo de `.env.local` es la acción de mayor palanca.

---

## Escenario B — Se corrompieron/borraron los datos (MAESTRO o un Sheet cliente)

1. **No entrar en pánico ni editar la hoja viva.** Pausar el sistema desde el editor: `pausarSistema()` (congela automatizaciones y escrituras; la consulta por voz sigue).
2. **Ubicar el backup:** correr `backupListar()` en el editor → lista las carpetas `backup_<fecha>` (más nueva primero) en «Satori OS — Backups» de Drive.
3. **Restaurar:**
   - **Todo el MAESTRO:** abrir la carpeta del backup elegido, tomar la copia `MAESTRO — <fecha>`, y o bien **re-apuntar** el sistema a esa copia (`setProperty('MAESTRO_ID', <id de la copia>)` desde el editor — con cuidado, es el corazón del sistema) o **copiar el contenido** de la copia sobre el MAESTRO vivo pestaña por pestaña.
   - **Un solo cliente:** tomar la copia `<CLI-xxx nombre> — <fecha>`, y restaurar su contenido al Sheet cliente vivo (o re-apuntar `url_sheet_cliente` en la pestaña `Clientes` del MAESTRO a la copia).
4. **Verificar:** `selfTest()` + `estadoVigente()` deben reflejar la realidad restaurada. Recién ahí `reanudarSistema()`.

**Ensayo obligatorio (ya automatizado):** `drillRestore()` prueba, sin tocar el sistema vivo, que el backup más reciente del MAESTRO **abre y trae todas las pestañas del esquema** (devuelve `pestanas` vs `esperadas`) — restaura a una hoja `__RESTORE_DRILL__` y devuelve su URL para el ojo humano. *Un backup no probado no es backup.*

---

## Límite honesto del backup en Drive (confianza 8/10)

El backup del módulo vive en el **mismo Drive** de `luciano@satoriconsultoria.com`. Protege contra el 95% de los desastres reales (borrado accidental, edición mala, script que ensucia, corrupción de una hoja). **NO** protege contra la pérdida de la cuenta Google entera (suspensión, hackeo del dominio). Para ese último 5%: **una vez al mes, descargar el MAESTRO como XLSX** (Archivo → Descargar → Excel) a un disco/otro cloud. Barato, cubre el hueco. *(Segundo orden: si algún día se justifica, automatizar el export XLSX off-Google es un proyecto aparte; hoy el manual mensual alcanza.)*
