# MICRO-ENCARGO CODE — cierre purga X1-X3 · 24-jul-2026

Contexto que ya tenés: purga X1-X3 commiteada (HEAD `d8bbcbc`, 4 commits ahead de `origin`). Harness 161/0. Decisiones de Luciano tomadas. Esto es tu parte (git + código). Las monedas y la matriz de riesgo NO van acá — son escrituras en Config que hace Luciano desde el editor (clasp run bloqueado, no las podés tocar vos).

## 1 · Push a origin (respaldo remoto, NO toca GAS)
```
git push origin main
```
Sube los 4 commits (`6cfae62` X1 · `f825620` X2 · `d6b8222` X3 · `d8bbcbc` CAPABILITIES). Confirmá `git status -sb` → `ahead 0`. **NO** hagas `clasp push`: el push a /dev lo dispara Luciano en el editor para correr `selfTest()` en el acto (los triggers corren HEAD; así no queda ventana con código sin verificar).

## 2 · Lista clasificada de X4 (TRAER, no ejecutar)
Las 51 top-level sin gate que tocan datos/servicios. Clasificá cada una y devolvé la tabla `fn · archivo:línea · clase · acción · riesgo-si-se-toca`:

- **(a) Helper interno** — nunca invocada por el front (`google.script.run` ni el puente `gas()/pedir()` de Akasha) → renombrar con `_` final + actualizar TODOS los call sites. Defensa estructural, cero costo runtime. ⚠️ Antes de renombrar, `grep` el nombre en `index.html` y en las llamadas de voz: si aparece, NO es helper interno.
- **(b) Front-callable** — el front SÍ la llama → NO renombrar (rompe el front); va a `ENDPOINTS_UI` + `_soloOwner_`.
- **(c) Mantenimiento/editor** — setup, migraciones, seeds, backups que corrés a mano desde el editor → `_soloOwner_` (en el editor corrés como owner, pasás el gate).

Prioridad alta (destructivas/costosas) para que las marques primero: `llamadaAPI` (quema crédito de API), `borrarFilasDonde`, `crearCliente`, `syncMaestro`, `sembrarDatosEjemplo`, `limpiarTodoTest`, `migrarCerebroSchema`. Con tu tabla decidimos el commit X4 (no lo ejecutes hasta que Luciano lo apruebe).

## 3 · Versionar el harness (para no perderlo por 3ra vez)
Agregá `_harness.js` al repo **y** metelo en `.claspignore` (es Node-only para correr las tandas D21+ offline; NO debe subir a GAS). Esto SÍ hacelo ahora — es independiente de la higiene del árbol (`.mov`, `VIDEOS PRUEBA/`, `_akasha_e3/three.r128.min.js`, `_to_delete/`), que se decide aparte y no bloquea.

## Verificación de cierre
`git status` → ahead 0 (post-push, con origin actualizado) · `.claspignore` incluye `_harness.js` · `node _harness.js` verde · la tabla de X4 completa. Devolvé con el diff y la tabla; no toques `/exec`.
