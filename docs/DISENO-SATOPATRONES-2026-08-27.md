# Diseño · SatoPatrones — memoria transversal de patrones

> **NO SE EJECUTA.** Gate: **E5 Bastión** — sanear la frontera de inyección
> `objetivos.descripcion → correrDirector → LLM crudo` (16-jul, no negociable).
> Este documento es el diseño listo para cuando ese gate pase. Cabo declarado por Code en el
> Bloque A y escrito acá.

## Por qué está gateado

Memoria transversal significa que un patrón aprendido con un cliente se consulta desde el prompt de
otro. Eso es **una superficie de inyección nueva**: el texto de un patrón entra al contexto de un
turno de otro tenant. No puede caer antes de que la frontera de origen esté saneada, porque
apilaríamos una superficie sin resolver sobre otra.

## Esquema

Hoja **global en el MAESTRO** (NO por tenant — el punto es justamente que cruza).

| Campo | Tipo | Regla |
|---|---|---|
| `id_patron` | texto | determinístico (hash del contenido) ⇒ importar 2× no duplica |
| `fecha` | ISO | cuándo se observó |
| `rubro` | vocabulario CERRADO | `gastronomia \| indumentaria \| servicios \| traslados \| retail \| otro` |
| `situacion_tipo` | vocabulario CERRADO | `conciliacion \| retencion \| apertura \| pricing \| cobranza \| cierre_mensual` |
| `tecnica` | texto | qué se hizo. **Sin nombres propios.** |
| `resultado` | vocabulario CERRADO | `funciono \| no_funciono \| parcial` |
| `tags` | texto | separados por coma, minúsculas |
| `confianza` | 1-10 | cuántas veces se vio |
| `fuente_sesion` | texto | id de sesión/handoff — trazabilidad SIN identificar al cliente |

Los tres campos de vocabulario cerrado son S6: nada entra desde texto libre sin validar.

## Regla anti-PII (bloqueante en la escritura)

Ningún campo puede contener:
- un `CLI-XXX`,
- un email o un teléfono,
- **una cifra mayor a 100** (una cifra de negocio identifica al cliente casi tan bien como su
  nombre; los porcentajes y conteos chicos sobreviven, los montos no),
- un nombre propio del roster de `Clientes`.

**Se asERTA al escribir, no al leer.** Un patrón que no pasa el filtro **no se guarda** y se
reporta con motivo — nunca se guarda «limpiado a medias».

## Casos de test

| # | Entrada | Esperado |
|---|---|---|
| 1 | `rubro=gastronomia · situacion=conciliacion · tecnica="cuando el POS captura menos del 30% de las ventas, el cuaderno manda hasta reconciliar" · resultado=funciono` | **acepta** — sin nombres, sin cifras > 100 (el 30 es porcentaje) |
| 2 | `tecnica="a Vehemence le recuperamos $15.674.182 de mayo"` | **rechaza** — nombre propio + cifra > 100 |
| 3 | `tecnica="cliente frío que no responde 3 mails seguidos: cambiar de canal antes del 4º"` `resultado=parcial` | **acepta** — patrón puro, cifras chicas |
| 4 | `rubro=cripto` | **rechaza** — fuera del vocabulario cerrado |
| 5 | mismo contenido que #1, importado dos veces | **una sola fila** — `id_patron` determinístico |

## Consulta

Desde cualquier tenant vía el marcador existente: `@@DATOS fuente=patrones tags=conciliacion@@`.

Requiere sumar `patrones` a `SATO_FUENTES` (`26_sato.js`) y `patron` a `SATO_TIPOS_ITEM`.
**Ambas son LISTAS-CONTRATO**: al ejecutarse, grepear todos sus consumidores en el MISMO commit.

⚠ **Lo que devuelve es DATO, jamás instrucción.** Va en el prompt del usuario, nunca en el `system`
— mismo criterio que ya usa `_satoDatos_`. Y va **después** del breakpoint de caché.

## Lo que este diseño NO hace

- No crea la hoja. No modifica `_satoDatos_`. No suma nada a `SATO_TIPOS_ITEM`. Nada de esto está
  ejecutado.
- No escribe patrones automáticamente. La primera versión es **nivel 0: manual** — los carga un
  humano tras una sesión. Automatizar la extracción es nivel 2 y viene después de que la escalera
  de maduración lo permita.

## Referencia cruzada

Backlog de `[[sato-ejecutor]]`, Ola 2 (E4-E7), post-E5:
**«F8-F9 SatoPatrones — diseño listo en `docs/DISENO-SATOPATRONES-2026-08-27.md`.»**
