# Evals — golden-set de Satori OS (T3 · MÓDULO M · M4)

> Creado 21-jul-2026. Fuente de verdad del golden-set: **`src/23_evals.js` → constante `EVALS_GOLDEN`**.

## Por qué el golden-set vive en un `.js` y no en un `.json` acá

GAS no puede leer archivos del Mac. Si el golden-set viviera en `docs/evals/*.json`, `correrEvals()` no
podría cargarlo en runtime y habría que espejarlo a mano en una hoja — dos fuentes que divergen el
primer martes. Una hoja `Evals` tampoco sirve como fuente: quedaría fuera del control de versiones
(editable a mano, sin diff, sin revisión). Por eso el set es una **constante versionada en el repo**:
está en el diff de cada PR *y* disponible en el runtime de GAS. Esta carpeta es documentación, no datos.

## Los dos pisos

| Piso | Familias | API | Corre en |
|---|---|---|---|
| **Determinístico** | `quick_add`, `cifras`, `pivot`, `clasificador_parse` | 0 | `selfTest()` (tanda **D22**) + `correrEvals()` |
| **LLM** | `clasificador_llm` | sí (Haiku) | solo `correrEvals({conApi:true})` / `correrEvalsConApi()` |

El piso determinístico asera **entrada → salida exacta**. El piso LLM asera **estructura y rango**
(bin dentro de `BANDEJA_BINS`, confianza 1-10, campos presentes), nunca el texto: aserir el texto del
modelo es aserir el modelo, y el eval mentiría el día que cambie de versión.

## Cómo correrlo

```
correrEvals()               // determinísticos, 0 API — lo mismo que corre selfTest como D22
correrEvals({familia:'cifras'})
correrEvalsConApi()         // + familia LLM (gasta; va a Consumo_agentes como 'clasificador')
```

## Cómo agregar un caso

1. Sacalo de un flujo **real** (una captura de voz que pasó, un objetivo cargado de verdad, un pivot
   escrito por Luciano). Un golden-set inventado asera la imaginación de quien lo escribió.
2. Agregá `{id, familia, entrada, esperado, nota}` a `EVALS_GOLDEN`. El `id` es único (D22a3 lo asera).
3. En `esperado` declará **solo las claves que te importan**: el comparador ignora las demás, así que
   agregar un campo a una salida no pone en rojo casos que no hablaban de ese campo.
4. Corré `correrEvals()`. Si el caso sale rojo, decidí cuál de los dos está mal — el caso o el código.

## Qué encontró apenas se encendió

**CF-04 / CF-08 / CF-09 — `normalizarCifrasTexto_` se comía prefijos de palabras.** La alternación de
palabras-número no tenía `\b`, así que `"cincuenta mil unidades"` matcheaba el `un` de `unidades` y
devolvía **`"50.001idades"`**: una cifra inventada y la palabra mutilada, en texto que ya iba a la hoja.
Igual con `"dosis"` (`dos`). Arreglado en `07_util.js` el mismo día; los 3 casos quedan como regresión.

Ese es exactamente el hueco que M4 venía a tapar: `selfTest` estaba verde porque el sistema **no
reventaba**. Nadie estaba mirando si seguía **decidiendo bien**.
