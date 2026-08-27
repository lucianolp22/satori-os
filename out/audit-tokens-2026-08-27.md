# F0+F1 · Auditoría de consumo Claude Max y hit-rate de caching — 27/08/2026

> Generado por Claude Code (Bloque A del `ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md`).
> **Alcance real:** F0 completo. F1 en su mitad OFFLINE (auditoría estática del gate TC-10, que
> resulta ser concluyente). La tabla de hit-rate EN VIVO por módulo requiere leer `Costos_API` de
> 5 Sheets y no se puede correr headless — queda como cabo con dueño (§F1.4).

---

## (a) Baseline actual

**Corrección de dato del encargo.** El encargo §3 cita «USD 649,54 al 18-ago» y ubica el panel en
`web/dashboard.html` del repo SatoriOS. Ninguna de las dos cosas es cierta hoy:

| Dato del encargo | Realidad verificada (27-ago) | Fuente |
|---|---|---|
| USD 649,54 | **USD 500,37** (Fuente A, 76 filas, 21 días) | `out/consolidado.csv` + `HANDOFF.md` del Medidor |
| `SatoriOS/web/dashboard.html` | `Projects/MEDIDOR TOKENS/web/dashboard.html` | `find` |
| `SatoriOS/scripts/gen_dashboard.py` | `Projects/MEDIDOR TOKENS/scripts/` | `find` |

El Medidor es un **proyecto aparte**. En SatoriOS no existen `web/` ni `scripts/`; `_capabilities_gen.sh`
vive en la raíz. F14 (extender el dashboard) tendrá que apuntar al repo del Medidor, no a éste.

### Consumo Claude Max (Fuente A · Claude Code)

| Ventana | USD | Días activos |
|---|---:|---:|
| Junio 2026 | 20,52 | — |
| Julio 2026 | 16,42 | — |
| **Agosto 2026 (1-27)** | **463,43** | 17 |
| Últimos 14 d (14-27 ago) | 88,16 | 7 |
| Últimos 7 d (21-27 ago) | 45,05 | 4 |
| Últimos 7 d **sin hoy** (20-26) | 14,78 | 3 |

**Baseline semanal.** La dispersión es enorme (hoy 27-ago solo son USD 30,27 — es esta misma sesión).
Se toman dos:

- **Conservador: USD 44,08/sem** (media semanal sobre los últimos 14 días). Denominador chico ⇒ hace
  ver el delta MÁS grande. Es el que manda para el gate del +15%.
- Amplio: USD 120,15/sem (media semanal prorrateada sobre agosto completo).

Tope del encargo: **+15%** ⇒ +USD 6,61/sem sobre el conservador.

### Consumo Sato-VOZ actual (medido del log, no estimado)

`~/Library/Logs/satori-voz-agent.log` **no registra tokens** (el pipeline LiveKit no loguea `usage`).
Sí registra la estructura de las sesiones, que es lo que permite proyectar:

| Métrica | Julio | Agosto | Últimos 7 d (21-27) |
|---|---:|---:|---:|
| Sesiones con turnos | 29 | 22 | 21 |
| Turnos (`user turn committed`) | 122 | 116 | 115 |
| Llamadas a tool | 70 | 77 | 76 |
| Turnos por sesión | 4,2 | 5,3 | 5,5 |
| Días distintos con uso | — | 4 | 4 |

Uso real: **ráfagas**, no goteo. 21 sesiones concentradas en 4 días.

**Huella de prompt medida sobre `voz/agent/agent.py` (863 líneas):**

| Bloque | chars | ~tokens (3,6 c/tok, es) | Estable |
|---|---:|---:|---|
| `SOUL_REGLAS` | 1.115 | 310 | sí |
| `_FECHA_HOY` | 354 | 98 | **no** (cambia por día) |
| resto de `INSTRUCCIONES` | 10.544 | 2.929 | sí |
| **`INSTRUCCIONES` total** | **12.013** | **3.337** | — |
| 19 `@function_tool` (desc. + firmas + overhead JSON) | — | ~3.774 | sí |
| **Prefijo estable (tools → system)** | — | **~7.111** | — |

> El orden de render de la API es `tools → system → messages`, así que el prefijo cacheable real es
> tools + system = **~7.111 tok**. Está **por encima del mínimo de Haiku 4.5 (4.096)** — el caso
> peor de toda la tabla de mínimos. Con la envoltura two-block del §F6, Haiku 4.5 cachea.

Modelo actual: `openai.LLM(model="gpt-4o-mini")` (agent.py). El coste OpenAI **no se verificó en esta
sesión** (sin acceso a la consola ni a tarifas oficiales) — se omite deliberadamente en vez de
inventarlo. No hace falta para el veredicto: el gate del +15% es sobre Claude Max, y la migración
SUMA gasto a Claude, no lo compara.

---

## (b) Proyección con Haiku 4.5 · (c) con Sonnet

Modelo de una semana tipo (21 sesiones · 115 turnos · 76 tools), con supuestos declarados:
turno de usuario 35 tok · respuesta 90 tok · resultado medio de tool 500 tok · el historial acumula.

```
input  total/sem : 1.815.345 tok   (82% cacheable = 1.493.310)
fresco (no cach.):   322.035 tok
output total/sem :    18.900 tok
```

Precios de 1ª parte de Anthropic (fuente: skill `claude-api`, caché 2026-06-24).
Escritura de caché 1,25× · lectura 0,10×.

| Modelo | sin caché | hit 50% | **hit 80%** | hit 90% | mín. cacheable | ¿cachea con 7.111 tok? |
|---|---:|---:|---:|---:|---:|---|
| `claude-haiku-4-5` | 2,28 | 1,42 | **0,91** | 0,74 | 4.096 | sí |
| `claude-sonnet-5` | 4,57 | 2,85 | **1,82** | 1,48 | 1.024 | sí |
| `claude-sonnet-4-6` | 6,85 | 4,27 | **2,73** | 2,21 | 1.024 | sí |
| `claude-opus-5` | 11,42 | 7,12 | **4,55** | 3,69 | 512 | sí |

*(USD/semana. El hit 80% es el escenario realista: dentro de una sesión los turnos van a segundos
de distancia y refrescan el TTL de 5 min; entre sesiones el caché se enfría. ≈1 write por sesión
y el resto lecturas ⇒ ~89% teórico; se usa 80% por prudencia.)*

---

## (d) Veredicto

### **GO — con margen amplio. Ni siquiera Opus 5 rompe el tope.**

| Modelo | USD/sem (hit 80%) | % del baseline conservador (44,08) | % del amplio (120,15) | Veredicto |
|---|---:|---:|---:|---|
| `claude-haiku-4-5` | 0,91 | **2,1%** | 0,8% | **GO** |
| `claude-sonnet-5` | 1,82 | **4,1%** | 1,5% | GO |
| `claude-sonnet-4-6` | 2,73 | **6,2%** | 2,3% | GO |
| `claude-opus-4-8` / `opus-5` | 4,55 | **10,3%** | 3,8% | GO |

Tope duro: +15%. **Haiku 4.5 usa 1/7 del margen disponible.**

**Sensibilidad — si el uso de voz se duplica** (42 sesiones/sem): Haiku 4,1% · Sonnet 5 8,3%.
Sigue debajo del tope con el uso duplicado y el baseline conservador.

**Recomendación:** `claude-haiku-4-5` como default (`SATO_VOZ_MODELO`), con override a
`claude-sonnet-5` — no a Sonnet 4.6: Sonnet 5 es más barato ($2/$10 vs $3/$15) y tiene el mismo
mínimo de caché (1.024). El encargo §2 nombra «Sonnet 4.6»; **Sonnet 5 lo domina en precio.**

**El riesgo real de F6 NO es el coste.** Es:

1. **No hay credencial Anthropic en esta Mac.** `ant` no está instalado, `ANTHROPIC_API_KEY` sin
   setear, sin SDK `anthropic` en el venv. F6 arranca bloqueado hasta que Luciano provisione la key
   en `.env.local`. *(Escalado §8.6 del encargo, anticipado.)*
2. **Disponibilidad del plugin `livekit.plugins.anthropic`** — sin verificar (no se tocó el venv;
   lección +59).
3. Confianza de la proyección: **7/10**. Los conteos de sesión/turno son medidos; los tamaños de
   turno y de resultado de tool son supuestos declarados. Sin `count_tokens` (requiere key) los
   tokens son estimación por chars/3,6.

---

## § F1 · Hit-rate de caching por módulo

### F1.1 · El gate TC-10 está bien construido

`_systemBloques_(fijo, vivo, modelo)` en `src/05_costos.js` es correcto y **no tiene drift**:

- La tabla `CACHE_MIN_TOKENS` coincide **exactamente** con la tabla autoritativa de Anthropic al
  27-ago, incluida la no-monotonía (Haiku 4.5 = 4.096 mientras Sonnet 4.6 = 1.024). Verificado
  contra el skill `claude-api`.
- Modelo desconocido ⇒ mínimo más alto (4.096). Fail-closed correcto.
- El contexto vivo va SIEMPRE después del breakpoint y SIEMPRE sin marca. La línea roja del
  aislamiento se respeta: no se cachea un prefijo con datos de un tenant.
- `_estimarTokens_` usa 4 chars/token, que **subestima** para español (~3,6 real). Deliberado y
  documentado: subestimar endurece el gate.

### F1.2 · Y aun así, hoy NO CACHEA NADA. Es correcto, no es un bug.

| Módulo | bloque fijo | est. (4 c/tok) | modelo | mínimo | ¿cachea? |
|---|---|---:|---|---:|---|
| `vigia`, `cobrador`, `abastecedor` | `GUARDIA_INYECCION` (573 ch) | 143 | Haiku 4.5 | 4.096 | **NO** |
| `conciliador`, `analista` | `GUARDIA_INYECCION` (573 ch) | 143 | Sonnet 4.6 | 1.024 | **NO** |
| `clasificador` (Bandeja) | `GUARDIA_INYECCION`, **ruta propia** | 143 | Haiku 4.5 | 4.096 | **NO** (ver F1.3) |
| `sato_ficha` | system fijo de `satoChat` (4.840 ch) | **1.210** | Haiku 4.5 (default) | 4.096 | **NO** |
| `sato_ficha` **si** `sato_modelo`=Sonnet/Opus | ídem | 1.210 | Sonnet 4.6 / Opus 4.8 | 1.024 | **SÍ** |

`GUARDIA_INYECCION` son **573 chars ≈ 143 tokens** — 26× por debajo del mínimo de Haiku 4.5 y 7×
por debajo del de Sonnet. Los 5 agentes de laboratorio nunca cachearon ni pueden.

⇒ **`cache_intentado` es `false` en todos los módulos.** El disparador de escalado del encargo
(«hit-rate <5% con `cache_intentado=true` ⇒ invalidator sistémico») **no se cumple**: no hay
invalidator, hay bloques cortos. La telemetría en vivo va a mostrar ceros y eso es la verdad.

**Deriva de documentación a corregir** (no ejecutada — Bloque A no toca `05_costos.js`):
el comentario de cabecera de `05_costos.js:50` dice *«Los 5 agentes y la Bandeja mandan
`GUARDIA_INYECCION`, una constante — todo cacheable»*. Es **falso**: constante sí, cacheable no.

### F1.3 · La Bandeja tiene una segunda ruta al mismo endpoint

`llamadaClasificador_` (`src/17_bandeja.js:220-244`) hace su **propio `UrlFetchApp.fetch`** a
`CLAUDE_ENDPOINT` con `system: GUARDIA_INYECCION` como string plano — no pasa por `llamadaAPI` ni
por `_systemBloques_`. Consecuencias:

- Sin `cache_control` posible, ni siquiera si el bloque creciera.
- **Sin telemetría de caché**: no escribe `cache_write`/`cache_read` en `Costos_API` (loguea vía
  `registrarConsumoAgente_`). Nunca va a aparecer en una tabla de hit-rate.
- Un segundo camino de deploy hacia el mismo proveedor ⇒ el ruteo de modelo y el tarifario de
  `llamadaAPI` no aplican ahí.

Es deuda estructural conocida, no un incidente. Se anota; no se toca en esta tanda.

### F1.4 · La palanca no obvia: **caché en Sonnet 5 sale más barato que Haiku sin caché**

`sato_ficha` tiene 1.210 tok estimados de bloque fijo — cae en la banda muerta entre el mínimo de
Sonnet (1.024) y el de Haiku (4.096). Con el default actual (Haiku 4.5) **nunca cachea**. Con
`sato_modelo = claude-sonnet-5` cachea desde el primer turno. La cuenta por millón de tokens de input:

| Ruta | USD/M input |
|---|---:|
| Haiku 4.5 **sin** caché (hoy) | 1,00 |
| Sonnet 5 **con** caché (lectura 0,10×) | **0,20** |
| Sonnet 5 sin caché | 2,00 |

**Un modelo 2× más caro por token, cacheado, cuesta 5× menos que el barato sin cachear.** Aplica solo
a la fracción del prefijo que sale de caché, y solo si hay ≥2 llamadas dentro del TTL.

La otra palanca: **subir el bloque fijo de `sato_ficha` por encima de 4.096** (hoy 1.210) y quedarse
en Haiku. `docs/SATO-IDENTIDAD.md` de F3 —~3.300 tok de identidad— haría exactamente eso al
inyectarse en el system fijo. **F3 y F1 se pagan mutuamente.** Ninguna de las dos se ejecuta en
Bloque A.

### F1.5 · Fragmentación del prefijo (hallazgo secundario)

El bloque «fijo» de `satoChat` (`src/26_sato.js:360-412`) **no es idéntico entre tenants**: interpola
`id` (la regla dura de aislamiento nombra al cliente), `modoSistema` y `conVoz`. Son hasta
**5 tenants × 2 modos × 2 flags = 20 prefijos distintos**, cada uno con su propia entrada de caché y
su propio 1,25× de escritura. Con tráfico en ráfagas, muchos nunca llegan a la 2ª lectura que
amortiza la escritura.

Arreglo (no ejecutado, fuera de Bloque A): mover la oración con `id` a `systemVivo` y dejar en el
fijo una regla genérica («estás anclado al cliente indicado en el contexto vivo»). El aislamiento no
se debilita —el `id` sigue presente, un bloque más abajo— y el prefijo pasa a ser byte-idéntico
entre tenants.

### F1.6 · Lo que queda sin poder verificar headless

La tabla EN VIVO de `cache_read / (input + cache_write + cache_read)` por módulo y tenant
(CLI-000, CLI-002, CLI-003, LC Travel, DAM, últimos 7 días) exige leer `Costos_API` de 5 Sheets.
`clasp run` está muerto por scopes excluyentes (memoria `gas-runtime-verif-no-headless`).
**Predicción falsable:** todas las filas van a dar `cache_intentado=false`, `cache_write=0`,
`cache_read=0`. Si alguna da distinto, F1.2 está mal y hay que revisarlo.

---

*Claude Code · 27/08/2026 · rama `feat/sato-viviente` · F0 y F1 del Bloque A.*
