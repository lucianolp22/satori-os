# PAQUETE CODE — P2: Lazo de resultados + status report + brief-push — 07-jul-2026

> **Para Claude Code** (repo `SatoriOS/`, leer CLAUDE.md raíz primero). Cowork verificó supuestos contra el repo el 07-jul. Objetivo del bloque: convertir "agentes que opinan al vacío" en "sistema que registra si sus recomendaciones movieron KPIs" — el gap que ningún caso paralelo tiene resuelto (ver `docs/CRITERIO-arquitectura-agentes.md`).

## Supuestos VERIFICADOS (no re-verificar)
- ✅ Clasificador con confianza + escalate **YA EXISTE** (`17_bandeja.js`: `bandejaUmbral_()` default 6, bin `escalate`, aviso al dudar) → **gap #5 CERRADO, no construir**.
- ❌ Feedback "¿sirvió?" en avisos/brief: NO existe (grep vacío en `06_avisos.js`/`18_direccion.js`).
- ❌ Contrato de status report fijo en `briefDiario`: NO existe.
- ❌ Brief-push por email: NO existe.
- ❌ Cola de aprobaciones con despacho en lote: NO existe (solo toasts "encolado" de agentes en CM).

> **UPDATE 07-jul PM:** **F1+F2+F3 YA IMPLEMENTADAS POR COWORK** en el working tree (validadas offline: `node --check` los 3 .js + bloque nuevo del HTML compila; el error "referencia" del harness es preexistente en HEAD, falso positivo). Archivos tocados: `01_schema.js` (hoja `Feedback` + orden), `18_direccion.js` (`registrarFeedback` + contrato de status report en `briefDiarioSistema_`), `06_avisos.js` (`briefPush_` + `probarBriefPush` + enganche en `corridaDiaria`), `index.html` (`ccFeedbackRow` en la card del brief). **Lo que queda a Code: `bash _p2_code.sh` (dry-run → `--go`)** = guardia + commit + clasp push; luego Luciano: `setup()` (crea la hoja Feedback) + `selfTest()` + eyeball `/dev`. F1 alcance: feedback SOLO en la card del brief (avisos → con F4). **F4-F5 siguen pendientes para la sesión 2 de Code** (abajo).

## Fases (2 sesiones: F1-F3 primera ✅ implementada, F4-F5 segunda)

**F1 — Feedback 1-clic (semilla del lazo).** Hoja nueva `Feedback` en MAESTRO (`id, fecha, origen_tipo, origen_id, util, nota`) vía `01_schema`. En cada aviso/brief renderizado en el CM: 2 botones (Sirvió / No sirvió) → `google.script.run` → append. Append-only (regla innegociable). NO emails.

**F2 — Contrato de status report fijo** (Luke R3). Reestructurar la salida de `briefDiario` (`18_direccion.js`) a 4 bloques SIEMPRE: (1) métrica/North Star hoy, (2) qué se auto-resolvió desde ayer, (3) qué espera decisión de Luciano, (4) recomendación priorizada + pregunta "¿qué primero?". Mantener compatibilidad: la voz (`brief` tool del doPost) consume el mismo texto — verificar que el largo siga apto para TTS (alto nivel, sin cifras crudas largas).

**F3 — Brief-push (email opt-in).** Config `brief_push` default **OFF** (regla Bastión 27-jun: alertas email opt-in). Si ON: `corridaDiaria` manda el briefDiario por `MailApp` SOLO a `OWNER_EMAIL` (Script Property, nunca hardcode). Kill-switch pausa lo respeta (guard existente de corridaDiaria).

**F4 — Lazo de resultados completo.** Hoja `Recomendaciones` (`id, fecha, texto, kpi_objetivo, se_hizo, kpi_movio, cerrada_fecha`). El brief (F2 bloque 4) registra su recomendación con id. Vista mínima en CM: lista de recomendaciones abiertas con 2 toggles (se hizo s/n · KPI se movió s/n). Cierre manual — NO automatizar el juicio.

**F5 — Cola de aprobaciones con despacho en lote.** Vista en CM: aprobaciones `pendiente` con checkboxes + botón "Aprobar seleccionadas" / "Rechazar seleccionadas" → loop server-side sobre `11_aprobaciones.js` existente (no duplicar lógica de decisión; reusar la función unitaria). Append-only en el registro (regla dura).

## Gates de cierre (cada sesión)
1. `selfTest()` TODO OK post-push (agregar asserts D-x para Feedback/Recomendaciones si el patrón existente lo hace barato).
2. AREL: nada de emails salvo F3 con opt-in OFF default; ninguna hoja existente se muta de estructura (solo hojas NUEVAS).
3. Guardia diff repo↔GAS antes de `clasp push` (regla 30-jun). UI: `/dev` + eyeball Luciano; promoción a `/exec` solo con su OK.
4. Purga de errores al cierre del bloque + actualizar HANDOFF + regenerar CAPABILITIES (el hook pre-push lo exige).

## Anti-scope-creep (pre-mortem del plan 06-jul)
NO derivar hacia auto-mejora/SOUL/F2-clasificador-general: timebox estricto, esas apuestas tienen gatillo propio (diferidos). El éxito de P2 = **un brief real termina en acción aprobada y el "¿sirvió?" registra**.
