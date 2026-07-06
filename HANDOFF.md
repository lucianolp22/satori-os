# HANDOFF — Satori OS — 2026-07-06

PRÓXIMO PASO: **Desplegar el rediseño CM+Voz.** En el Mac: `cd ~/Documents/Claude/Projects/SatoriOS && rm -f .git/index.lock && bash _cm_deploy.sh` (guardia; esperar `GUARDIA: OK (solo difiere index.html)`) → `bash _cm_deploy.sh --go` (commit `index.html`+`voz.html`+HANDOFF + clasp push a HEAD + git push) → abrir el **/dev** del CM y hacer **eyeball** de los 8 cambios visuales → si OK, **promover versión nueva a `/exec`** (prod, como en B4). Recargar la página de voz (Cmd-Shift-R) para ver su restyle.

## Estado vigente
Satori OS = ERP multi-tenant **GAS + Sheets** en prod (`luciano@satoriconsultoria.com`) + Voz (CM desktop + PWA iPhone por Tailscale). **Cierre-dev esencialmente completo.** B1 higiene ✅ · B2 onboarding ✅ · B4 rediseño CM ✅ (@15) · **B3 backup ✅** (06-jul) · **B5 purga total+CAPABILITIES ✅** (06-jul). Lo que resta NO es "construir": es **desplegar el rediseño visual** (pendiente, ver PRÓXIMO PASO) y luego **B7 cartera** (decisiones comerciales de Luciano sobre 11 candidatos) + **B8 FINAL** (datos reales + RGPD + go-live). Motor/método (fase→skill, F2/F3, brief-push) = diferidos con gatillo (especulativos para operador solo; la mitad de B6 —telemetría, estadoVigente, North Star— ya estaba verde). Fuente de plan: `PLAN-ACCION-INTEGRAL-SatoriOS-2026-07-02.md`.

### Verificado
- [06-jul] **B3 backup live** — evidencia: `smokeBackup` PASS 6/6 (incl. moveTo drive.file), `backupAhora` 7 copias ok, `drillRestore` eyeball-verificado, trigger `backupSemanal` domingo 04:00. Código en **GitHub privado** `lucianolp22/satori-os` (push OK, off-Mac). `_b5_code.sh --go` → `clasp push OK`.
- [06-jul] **B5 6 fixes live en GAS HEAD** — evidencia: `selfTest()` = **TODO OK** post-push (incl. `E8a-2 SISTEMA (7)` valida el fix #1 O(n²) del cerebro; `F1 BAN-0009` valida #4 nextId; capa Voz verde). Commits `7c1aef4`/`13fab76`.
- [06-jul] **CAPABILITIES.md autogenerado** — evidencia: `bash _capabilities_gen.sh` → 150 líneas, re-generable.
- [06-jul] **Rediseño CM+Voz** validado OFFLINE (0 colores fríos, HTML balanceado, markers JS intactos, `node --check`); NO validado en vivo (render-check = eyeball de Luciano, pendiente deploy).

### No verificado
- El rediseño CM+Voz **en pantalla** (los 8 cambios: isologo, botón voz terracota, Modo calma/luna/Calidad fuera, transición dissolve, orbe regular, header sin solape) — falta `_cm_deploy.sh --go` + eyeball /dev + promoción a /exec.
- El **#7 kill-switch total en `doPost`** en el endpoint de VOZ — corre por versión desplegada, no HEAD → falta promover el deployment de voz (no urgente).

## Pendiente
**Must:**
- Deploy CM+Voz (PRÓXIMO PASO) + eyeball + promoción a /exec.
- Promover deployment de VOZ para activar el #7 (va con el próximo toque de voz).

**Should:**
- **B7 cartera / build-in-public:** análisis+priorización de 11 candidatos + estrategia de contacto (Cowork arma el marco; decisiones = Luciano).
- Bucket B de la purga (PII a LLM #6, conector refunds/canal/moneda #8/#9/#10) → tratar en **B8** con riesgo documentado (`PURGA-SISTEMA-B5-2026-07-06.md`).

**Nice:**
- Brief-push (briefDiario por email opt-in) + PM persistente dogfooding (cron). Bucket C de la purga (deuda con gatillo). `_index_html_dump`/`ks_*` viejos → archivar.

## Artefactos
| Tipo | Nombre | Ruta / ID / URL |
|---|---|---|
| Proyecto GAS | MAESTRO | scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` |
| Sheet MAESTRO | Satori OS — MAESTRO | `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` |
| Deployment prod | /exec | `AKfycbxZJL4E…` (@15; promover a @16 con el rediseño) |
| /dev CM | Centro de Mando | `script.google.com/a/macros/satoriconsultoria.com/s/AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I/dev` |
| Remoto git | GitHub privado | `github.com/lucianolp22/satori-os` (off-Mac backup del código) |
| Backup datos | módulo + carpeta | `src/21_backup.js` → Drive «Satori OS — Backups» (Script Property `BACKUP_FOLDER_ID`) |
| Deploy scripts | CM / B5 / capabilities | `_cm_deploy.sh` · `_b5_code.sh` · `_capabilities_gen.sh` (guardia allowlist + clasp push) |
| Docs B5 | paquete / purga / caps | `PAQUETE-CODE-B5-2026-07-06.md` · `PURGA-SISTEMA-B5-2026-07-06.md` · `CAPABILITIES.md` |
| Runbook | recuperación total | `RUNBOOK-recuperacion-total.md` (el Mac murió + restore + Script Properties) |
| Kit de marca | isologo + variantes | `Projects/KAIROS…/Satori - Identidad Visual/` (lockup horizontal = PNG-embebido+ámbar; usar PNG para recolorear) |
| UI (vanilla GAS) | CM / Voz | `src/index.html` · `voz/web/voz.html` (render-check = eyeball) |

## Desvíos del plan original
- **B4 (rediseño CM) se adelantó a B3** (backup). Ambos cerrados.
- **B6 (motor) mayormente ya existía** (telemetría, estadoVigente, North Star, brief, pipeline Bandeja): re-verificado verde en selfTest → no se reconstruyó; el resto (fase→skill, F2/F3, brief-push) = diferido con gatillo por ser proceso especulativo para un operador solo.
- **Rediseño visual (opción b)** ejecutado ahora (CM header + página de voz completa) en vez de al final.
- Datos+RGPD+go-live AL FINAL (firme).

---

## Apéndice histórico
{Se lee solo si un problema reaparece o se cuestiona una decisión.}

### Decisiones y descartes
- **[06-jul] #7 kill switch = congelar TODO en pausa** (doPost rechaza también lecturas cliente/cerebro, no solo capturar). Decisión Luciano.
- **[06-jul] Bucket B de la purga (PII a LLM + integridad conector) → diferido a B8** con riesgo documentado (corre con datos sembrados/demo hoy). Decisión Luciano.
- **[06-jul] Motor/método B6 (fase→skill, /promote, F2 clasificador general, F3 PM persistente, brief-push) = diferido con gatillo** (equipo/más clientes): proceso especulativo para un operador solo; el 80/20 de B6 (datos/telemetría/estado) ya estaba hecho.
- **[06-jul] O(n²) del cerebro** resuelto con snapshot pre-cargado OPCIONAL (`snap`) en `upsertPorClave_/upsertNodo/upsertArista` — callers viejos sin `snap` = comportamiento idéntico; snap consistente intra-lote (clave repetida actualiza, no duplica).
- **[06-jul] isologo del CM** = PNG del lockup recoloreado negro→crema `#ECEAE3` + ámbar (no hay lockup-reverse; los SVG del lockup son PNG-embebido, no recolorables por fill).
- **[30-jun] `appsscript.json` webapp.access = DOMAIN (Bastión):** NO volver a MYSELF (rompe el CM + URLs de dominio).
- **[30-jun] A' voz = pipeline Deepgram+OpenAI+ElevenLabs+Silero.** VAD Silero = NO se toca (deprecación = warning cosmético). Thinking-sound descartado (tapaba TTS). Mic SIEMPRE Mac (`audioCaptureDefaults`). ElevenLabs Starter pago.
- **[29-jun] Voz A' = LiveKit** (NO stack WS-custom de Kevin, NO OpenAI Realtime). Mic en iframe GAS DESCARTADO (getUserMedia bloqueado) → voz en página local. Token = mint local. Latencia 13s = overhead GAS (no cold-start).
- Decidido (27-jun): kill switch = pausa operativa; alertas email opt-in default OFF. Caller = luciano@ (os@ baja). Descartado: `drive.file` para el token del agente (gate 404 → readonly); SA externa (Workspace la rechaza).

### Imprevistos y resolución
- [06-jul] **`.git/index.lock` huérfano (2 días) tumbaba el commit** → el sandbox de Cowork NO puede tocar `.git/` (`Operation not permitted`) → lo remueve Luciano en el Mac (`rm -f .git/index.lock`); scripts ahora chequean el lock al inicio.
- [06-jul] **guardia `_b3_code.sh` false-positivo sobre `index.html.bak`** (local-only, clasp no lo pushea) → guardia corregida: solo marca `differ` y `Only in <GAS>/src` (ignora `Only in src:`); usa allowlist de los archivos que intencionalmente cambian.
- [06-jul] **GitHub device-flow (`gh auth login`) no llegaba el código** → push vía PAT clásico embebido en la URL (`git push https://user:TOKEN@github.com/...`), saltea keychain/gh. GitHub ya no acepta password para git.
- [06-jul] **imagen pegada en el chat NO se guarda a disco** (solo en contexto) → pedir archivo adjunto o montar la carpeta; el isologo estaba en `Projects/KAIROS…/Satori - Identidad Visual/Exportaciones/PNG/`.
- [06-jul] **CM sirve la versión DESPLEGADA, no HEAD** → cambios de `index.html` se ven en /dev con `clasp push`, pero /exec necesita promover versión (como B4); triggers sí corren HEAD.
- [30-jun] /dev perdió el botón tras /exec = HEAD de GAS desincronizado del repo → regla: SIEMPRE diff repo↔GAS antes de `clasp push` (guardia que aborta).
- [27-jun] El CM NO es auto-screenshoteable (iframe cross-origin GAS) → render-check = eyeball de Luciano.
- [29-jun] `#` inline / paréntesis en comandos pegados rompen el zsh de Luciano → comandos limpios; multi-paso = script desde archivo (`bash x.sh`).

### Changelog del handoff
- **[06-jul] Sesión Cowork — B3 + B5 cerradas + rediseño CM/Voz:** **B3 backup** (módulo `21_backup.js` = copias semanales a Drive + restore drill probado; código off-Mac en GitHub privado; runbook recuperación). **B5 purga total** (2 auditores adversariales, 0 críticos-hoy) + **CAPABILITIES.md** autogenerado + **6 fixes live** (O(n²) cerebro, guard anti-inyección Bandeja, sanitizar `\t\r\n`, nextId defensivo, lock consumo agentes, kill switch total en pausa) — `selfTest` TODO OK. **Rediseño zen-futurista** coherente CM↔Voz: isologo horizontal embebido, botón voz terracota, Modo calma/luna/«Calidad» removidos, transición dissolve, orbe wireframe regular, header sin solape. PENDIENTE: `_cm_deploy.sh --go` + eyeball /dev + promoción a /exec.
- **[03-jul] Cowork — verificación total + B1/B2:** SOP+template onboarding, paquete B1 higiene, agent.py corregido, VOZ_TOOL_SECRET rotado, marca definida (enso+Alba/Fraunces/Hanken/terracota-jade).
- **[30-jun] A' fase (ii) PWA móvil CERRADA** (Tailscale Serve, sala/identidad únicas anti-zombie) · **[30-jun] A' fase (i) voz grave CERRADA** (pipeline LiveKit) · **[29-jun] Voz integrada al CM CERRADA.**
- [26-jun] Fase Voz local + Purga + Bastión · [25-jun] Integración v14 + PIPELINE.
