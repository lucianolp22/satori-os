# F5 · Acta del Consejo — migración del motor de Sato-VOZ — 27/08/2026

**VEREDICTO: GO — pero con el modelo INVERTIDO respecto de lo que traía el encargo.**
**Sato-VOZ → `claude-haiku-4-5`. Sato-in-GAS → `claude-sonnet-5`. Son dos decisiones distintas.**
Confianza colectiva **8/10**.

> El `consejo-asesores` vive como skill de Cowork y no existe en CLI. La deliberación se corrió acá
> con su estructura (steelman a favor y en contra, pre-mortem, confianza por eje), alimentada con
> F0, F1, R6 y la medición post-F3. Se declara para que nadie lo lea como si hubieran votado 5
> modelos distintos.

---

## §1 · La corrección que cambia la decisión

El encargo (y la instrucción de arranque) traen esta palanca:

> «Sonnet 5 con caché sale 5× más barato que Haiku sin caché ⇒ Sonnet 5 default.»

**Es cierta, pero es de OTRA superficie.** Medido después de F3 — y los números de la voz están
**verificados contra la API real**, no estimados (dos llamadas idénticas por modelo, mirando
`cache_creation_input_tokens` y `cache_read_input_tokens`):

| Superficie | Prefijo estable | ¿Haiku 4.5 cachea? | ¿Sonnet 5 cachea? |
|---|---:|---|---|
| **Sato-VOZ** (LiveKit, tokens reales) | **8.125 tok** ← MEDIDO contra la API | **SÍ** — `cache_read=8125` al 2º turno | sí (10.178) |
| **Sato-in-GAS** (gate `len/4`, conservador) | **3.728 est** | **NO** — el gate ni lo intenta | sí (mín. 1.024) |

El «5×» sale de comparar *Haiku sin cachear* contra *Sonnet cacheado*. Eso pasa **solo en GAS**,
donde `_estimarTokens_` usa 4 chars/token a propósito (subestima para endurecer el gate) y deja el
bloque en 3.728, justo debajo de los 4.096 de Haiku. **En la voz no pasa**: ahí el prefijo son 7.917
tokens reales y Haiku cachea igual que Sonnet.

Y cuando **los dos cachean**, no hay palanca: gana el barato.

| Modelo (Sato-VOZ, semana tipo) | sin caché | **hit 80%** | hit 90% |
|---|---:|---:|---:|
| `claude-haiku-4-5` | 2,49 | **0,97** | 0,77 |
| `claude-sonnet-5` | 4,99 | **1,93** | 1,55 |
| `claude-sonnet-4-6` | 7,48 | 2,90 | 2,32 |

**Sonnet 5 cuesta el doble que Haiku en la voz, sin comprar nada que la voz necesite.**

Son dos flags independientes (`SATO_VOZ_MODELO` y la Config `sato_modelo`): **no tienen que
coincidir, y no deberían.**

### Un susto que dejó una lección
La primera medición mandó `system` **sin las tools** y dio `cache_read=0` en Haiku: el bloque de
identidad solo son **3.494 tokens**, debajo de los 4.096. Parecía que Haiku no cacheaba y que la
recomendación se caía. Con las tools incluidas —que es lo que el agente manda SIEMPRE, porque el
orden de render es `tools → system → messages`— el prefijo sube a **8.125** y cachea limpio.

**La lección queda escrita:** las 19 tools aportan ~4.600 tokens del prefijo cacheable de Haiku. Si
alguna vez se recortan las tools o se mueve el breakpoint, **Haiku deja de cachear en silencio** y
el coste se multiplica sin que nadie lo note. La telemetría de `voz-tokens.jsonl` es lo que lo
cantaría.

---

## §2 · ¿Migrar el motor de la voz a Claude?

### Steelman A FAVOR
- **Un solo ecosistema.** Hoy el sistema piensa en Anthropic (`llamadaAPI`, TC-10, tarifario,
  ruteo por módulo) y la voz habla OpenAI. Dos proveedores es dos superficies de credenciales, dos
  facturas, dos modelos de caching y dos comportamientos a calibrar.
- **El caching pasa de implícito a explícito.** OpenAI cachea solo, sin control ni telemetría fina.
  Anthropic pide `cache_control` y devuelve `cache_read_input_tokens`: se puede **auditar** que el
  prefijo pega, que es exactamente lo que F1 no pudo hacer.
- **La identidad de F3 recién ahora existe.** Migrar con un prefijo de 7.917 tokens estables es
  barato; migrar antes de F3 habría sido pagar escrituras de caché sin lecturas.
- **Coste ridículo en ambos casos.** USD 0,97/semana contra un baseline de 44,08. El tope del +15%
  ni se acerca.

### Steelman EN CONTRA
- **E1 y E2 llevan horas en producción.** `@57` se promovió hoy. Cambiar el motor de la voz en la
  misma jornada mete una segunda variable: si mañana algo suena raro, no se sabe si fue E2 o el motor.
- **La migración no arregla lo que molesta.** R6 es concluyente: el LLM aporta ~1 s de un turno de
  ~13 s; **GAS explica el 53%**. Se puede migrar perfecto y que Luciano no note nada.
- **Superficie nueva de fallo.** Una dependencia más (`livekit-plugins-anthropic`), un formato de
  envelope distinto, y un `system` de dos bloques que si se arma mal no cachea y nadie se entera.
- **Lo que hay funciona.** gpt-4o-mini viene sosteniendo 243 turnos sin quejas de calidad.

### Pre-mortem — es diciembre y la migración fue un error. ¿Por qué?
1. **Se migró el mismo día que E2 entró a prod** y una regresión de voz costó dos días de bisección
   entre dos cambios simultáneos. *Mitigación: flag `SATO_VOZ_MOTOR` con default `openai`; el flip
   lo hace Luciano después de mirar, en otro momento que el promote.*
2. **El envelope quedó mal armado y nunca cacheó.** Costó 2,5× en vez de bajar, y se descubrió a la
   semana. *Mitigación: loguear `cache_read_input_tokens` a `out/voz-tokens.jsonl` desde el turno 1;
   si el 2º turno no trae `cache_read > 0`, es rojo, no «ya va a calentar».*
3. **Se eligió Sonnet 5 por una palanca de otra superficie** y la voz quedó al doble de precio y más
   lenta, sin ganancia. *Mitigación: §1 — Haiku para la voz.*
4. **Se subió el plugin y arrastró un upgrade de `livekit-agents`** que rompió el VAD o el
   turn-detection. *Mitigación: pinear `livekit-plugins-anthropic==1.6.4`, versión exacta del
   `livekit-agents` instalado. El VAD no se toca (decisión firme).*

**Veredicto del eje: GO.** El coste es despreciable, el beneficio es de arquitectura y auditoría, y
el riesgo real (mezclar con el promote de E2) se neutraliza con un flag apagado por default.
**Confianza 8/10.**

---

## §3 · ¿Sonnet 5 o Haiku 4.5 en la voz?

**Haiku 4.5.** Tres motivos, en orden de peso:

1. **Cachea igual.** 7.917 > 4.096. La única razón para preferir Sonnet desaparece.
2. **Cuesta la mitad** (0,97 vs 1,93 USD/semana con hit 80%).
3. **Es el tier más rápido.** R6 mostró que el LLM es el 8% del turno, pero es el 8% que se puede
   empeorar: Sonnet 5 es un modelo más grande y el p50 de 1,08 s es el número a **no** empeorar.

**Contra-argumento honesto:** Sato-VOZ hace juicio de negocio, no clasificación, y Haiku es el tier
más chico. Si en los 5 turnos de verificación la calidad baja de forma perceptible —confunde tools,
pierde el hilo, afloja el rioplatense— el override a `claude-sonnet-5` es una variable de entorno.
**Por eso `SATO_VOZ_MODELO` es env, no constante.** Confianza 7/10 en Haiku como default; 9/10 en
que la decisión sea reversible en un comando.

---

## §4 · ¿La latencia proyectada es aceptable?

**El criterio del encargo v2 («primer token ≤ 900 ms») se descarta.** R6 mostró que el baseline ya
está en p50 **1,08 s** y que la voz igual se siente lenta, porque el problema es el round-trip a
GAS (p50 6,75 s, p90 21,83 s). Un criterio que ya se cumple no discrimina nada.

**Criterio real, contra el baseline medido:** el p50 del tramo A no debe empeorar respecto de
**1,08 s**, con tolerancia hasta 1,5 s. Si se va por encima, se revierte el flag.

Y queda dicho para el registro: **esta migración no es la palanca de latencia.** Esa es la opción C
(bajar el overhead de GAS), y R6 le dio el gatillo de uso real que le faltaba.

---

## §5 · Decisión

| Eje | Veredicto | Confianza |
|---|---|---|
| ¿Migrar Sato-VOZ a Claude? | **GO**, con flag apagado por default | 8/10 |
| ¿Qué modelo en la voz? | **`claude-haiku-4-5`** (no Sonnet 5) | 7/10 |
| ¿Qué modelo en Sato-in-GAS? | **`claude-sonnet-5`** vía Config `sato_modelo` | 8/10 |
| ¿Criterio de latencia? | «no empeorar el p50 de 1,08 s», no «≤900 ms» | 9/10 |
| ¿Migrar hoy, con E2 recién promovido? | Código sí; **el flip del flag lo decide Luciano aparte** | 8/10 |

**Confianza colectiva: 8/10.**

Condiciones de la aprobación (todas verificables):
1. `SATO_VOZ_MOTOR=openai` por default. El flip es de Luciano.
2. `livekit-plugins-anthropic` **pineado a 1.6.4**, igual que `livekit-agents`. El VAD no se toca.
3. `cache_read_input_tokens` y latencia de primer token a `out/voz-tokens.jsonl` desde el turno 1.
4. Rollback = una variable de entorno + el reload consolidado.

---

*Deliberación corrida por Claude Code sobre F0, F1, R6 y la medición post-F3. La corrección del §1
es el aporte principal: la palanca del «5×» era real pero estaba en la otra superficie.*
