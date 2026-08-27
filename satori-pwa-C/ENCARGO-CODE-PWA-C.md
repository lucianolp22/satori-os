# ENCARGO CODE — PWA C (Netlify + GAS API) — para ejecutar en otra conversación

> Referencia: `PLAN-C-PWA-Satori-OS.md`. Andamiaje verificado en `satori-pwa-C/`. **No arrancar la Fase 1 sin cerrar la Fase 0 (Bastión).** Loop de siempre: Cowork planifica+asserts → Code ejecuta (Terminal, commit+clasp push) → Luciano aprueba.

## Orden fijo
**Fase 0 (Bastión + Luciano, sin código):** convocar `bastion-satori` sobre "exponer el MAESTRO vía API ANYONE+token". Cerrar: esquema de token (recomendado: **PIN/passkey → sesión corta**, no token largo en el front), rate-limit, rotación, logging. Salida = spec de auth aprobada.

**Fase 1 — API JSON (GAS, deployment #2):**
1. Inventario: `grep` en `src/index.html` de TODAS las `google.script.run.….(fn)` → set real de funciones → poblar `API_WHITELIST` en `api-router.gs` (lecturas vs escrituras).
2. Llevar `api-router.gs` al repo (`src/`), aplicar la spec de Bastión (mapa `{fn:ref}` en vez de `eval`; `_tokenScope_` real; rate-limit).
3. Sembrar `SATORI_API_TOKEN_R/_W` (o el esquema de sesión) en Script Properties. **Cero en git.**
4. **Deployment NUEVO** access=ANYONE, executeAs=USER_DEPLOYING (mismo scriptId). El editor DOMAIN queda intacto.
5. Smoke `curl` (POST text/plain {fn,args,token}): ok con token válido, 'unauthorized' sin token, 'fn no permitida' fuera de whitelist, escritura bloqueada con token de lectura.

**Fase 2 — Front en Netlify:**
1. Copiar `index.html` actual + `gas-shim.js` a un dir estático; cargar el shim ANTES del `<script>` grande; setear `SATORI.API_URL` (= /exec del API) + token/sesión.
2. Inventario de incompatibilidades: `grep google.script.host`, `withUserObject`, `google.script.run` con features no-datos, uploads. Cubrir o adaptar.
3. Deploy Netlify (skill `deploy-gas`, bloque Netlify). Verificar **paridad con /exec** (misma data, mismos flujos) por eyeball + el render headless de Cowork.

**Fase 3 — Offline:** `sw.js` al dir; registrar SW; crear `offline.html` + `app.css/app.js` reales (o inline). **3b:** cachear respuestas del API en IndexedDB + banner "sin conexión". Verificar con Lighthouse PWA + modo avión.

**Fase 4 — Push:** VAPID; worker sender (CF, como el Taller) con store de suscripciones; disparadores desde GAS (aprobación/Vigía → llama al worker). Probar en iPhone real (instalada).

**Fase 5 — Dominio + cutover:** dominio propio, `manifest` final, retirar/redirigir el launcher A.

## Reglas
- El **editor DOMAIN de siempre NO se toca** en ninguna fase.
- Todo lo de token/secretos pasa por **Bastión**; secretos solo en Script Properties/CF, nunca en git (grep de cierre).
- Cada fase es shippable y se verifica antes de la siguiente. `selfTest()` verde tras tocar GAS.
- Persistir avance en `HANDOFF-PWA-C.md` al cerrar cada fase.
