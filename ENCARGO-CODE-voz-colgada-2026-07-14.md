# ENCARGO CODE — Voz colgada "pensando" sin respuesta final · 14/07/2026

**Sintoma (video 08:21, evidencia en frames):** primera consulta simple respondio OK (~1:04). A las 1:08 Luciano pide "el brief del dia" -> "Pensando..." -> filler correcto DENTRO de la tool ("Dame un segundo que reviso", T1 funciona) -> **la tool nunca devuelve**. Durante 80+ segundos Sato promete sin cumplir ("Lo veo y te digo" 1:35 · "Un momento, consulto el sistema" 2:01 · "Dame un segundo que lo reviso" 2:31) y **jamas llega la respuesta**. Antes al menos respondia al segundo intento; ahora ni eso.

**Contexto tecnico:** pipeline Deepgram+gpt-4o-mini+ElevenLabs+Silero INTACTO (no tocar). Filler E1.2 emitido via context.session.say dentro de las tools GAS lentas. Latencia conocida del doPost GAS ~13s — esto fue mucho mas: cuelgue, no lentitud.

## Pedido (en orden)
1. **Diagnostico con logs reales:** logs del agente (launchd `com.satori.voz.agent`, stdout/err) del 14-jul ~08:22-08:25. Buscar: la llamada `brief` salio? HTTP quedo esperando? excepcion tragada? el turno murio despues del say del filler? Anotar la causa con evidencia textual del log.
2. **Timeout duro en `_llamar_backend` (tools GAS):** hoy no hay tope efectivo percibido por el usuario. Poner timeout total (sugerido 25s) -> al vencer, la MISMA tool devuelve un texto hablable: "El sistema esta tardando mas de lo normal. Proba de nuevo en un momento." Fail-closed, SIN reintento automatico (brief no es idempotente en costo/tiempo). El turno SIEMPRE termina con una respuesta.
3. **Anti-promesa vacia (prompt, 1 linea):** si una tool devolvio timeout, Sato NO dice "lo sigo mirando": ofrece reintentar cuando el usuario quiera (coherente con N5: no narrar acciones que no ocurren).
4. **Chequear contencion GAS:** 08:21 no es corridaDiaria (07:00) pero `drenarCola` corre cada 5 min y toma `conLock`; `sincronizarConectores` cada 8h tambien. Medir cuanto tarda el doPost `brief` cuando hay lock tomado. Si el lock explica el cuelgue -> proponer (NO implementar sin OK) lectura sin lock o cache corto del brief.
5. **Verificacion obligatoria:** harness headless con backend lento simulado (sleep > timeout): el filler suena, y a los 25s llega el fallback EN EL MISMO turno. `py_compile` + reinicio con `ks_voz_reinicio_agente.sh` + prueba real de voz de Luciano.

## Reglas duras
- NO tocar VAD/Silero, STT, TTS, pipeline, ni las tools de Oficina (E2 con confirmacion queda igual).
- agent.py es local (no GAS): no requiere clasp ni promote. Commit + push del repo al cerrar.
- Si el diagnostico apunta al doPost GAS (server), FRENAR y dejar hallazgo para spec aparte — no tocar GAS en este encargo.
