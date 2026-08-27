# R6 · Baseline de latencia de la voz — 27/08/2026

> Precondición de F6. **NO se instrumentó `agent.py`** (lección +59): los números salen de parsear
> los 9.910 renglones de `~/Library/Logs/satori-voz-agent.log`, así que son **retroactivos sobre
> 243 turnos reales** en vez de una muestra de 5 tomada a mano.

## Qué se puede medir y qué no

El log no emite un evento de *primer token*. Sí emite `user turn committed`, `executing tool`,
`tools execution completed` y `conversation_item_added`, que delimitan tres tramos:

| Tramo | Qué mide |
|---|---|
| **A** · turno cerrado → 1ª acción del LLM | Proxy de primer token: cuánto tarda el modelo en decidir |
| **B** · llamada a tool → tool completada | **Round-trip a GAS.** El modelo no participa |
| **C** · turno cerrado → respuesta completa | Extremo a extremo, con la cola de TTS |

## Medición (segundos)

    A · turno cerrado → 1ª acción del LLM (llamada a tool) n= 129  min   0.00  p50   1.08  p90   2.96  max  124.20  ← proxy de primer token
    B · llamada a tool → tool completada (ROUND-TRIP A GAS) n= 168  min   0.00  p50   6.75  p90  21.83  max   35.00  ← overhead de GAS, el modelo no lo toca
    C · turno cerrado → respuesta del asistente completa n= 243  min   1.23  p50  12.82  p90  46.27  max  105.23  ← extremo a extremo (con cola de TTS)
    
      A sólo 24-27 ago (n=53): p50 1.05s · p90 5.86s
      B sólo 24-27 ago (n=78): p50 6.95s · p90 19.57s

### Sólo los 4 días de uso real (24-27 ago)

    A sólo 24-27 ago (n=53): p50 1.05s · p90 5.86s
    B sólo 24-27 ago (n=78): p50 6.95s · p90 19.57s
    C sólo 24-27 ago (n=92): p50 15.85s · p90 53.43s

## Veredicto — y reformula F6

### El modelo aporta ~1 s de los ~13 s. **La latencia es GAS, y ningún cambio de motor la toca.**

| | p50 | % del turno |
|---|---:|---:|
| Decisión del LLM (A) | **1,08 s** | ~8% |
| Round-trip a GAS (B) | **6,75 s** | **~53%** |
| Turno completo (C) | 12,82 s | 100% |

- **48 de 168 llamadas a tool superan los 10 s** contra GAS; el máximo medido es 35 s.
- El «13 s de latencia» que arrastra el `HANDOFF.md` queda **confirmado y localizado**: p50 12,82 s
  extremo a extremo, y más de la mitad es el ida y vuelta a Apps Script.

**Consecuencias para F6:**

1. **Su criterio de aceptación mide lo que no importa.** F6 exige «primer token ≤ 900 ms»: el
   baseline ya está en p50 1,08 s con gpt-4o-mini, o sea que el criterio se cumple o se roza hoy,
   y aun así la voz se siente lenta. Migrar el motor y celebrar ese número sería un verde falso.
2. **F6 se justifica por coste, control y calidad — no por velocidad.** El techo de mejora que
   puede comprar un cambio de modelo es ~8% del turno. Nadie lo va a notar.
3. **La palanca real de latencia es la opción C** (bajar el overhead de GAS), que el `HANDOFF.md`
   dejó diferida «con gatillo de uso real». Este informe **es** ese gatillo: 4 días de uso, p90 de
   19,6 s contra GAS.

**Recomendación:** correr F5/F6 por sus motivos reales y **sacar la latencia de sus criterios de
aceptación**, reemplazándola por «no empeora el p50 de A». Y abrir la opción C como frente propio.

*Claude Code · 27/08/2026 · R6 de la Ola 2. Confianza 8/10 — n alto y fuentes directas; el límite
es que A es un proxy de primer token, no el primer token.*
