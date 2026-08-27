# PLAN C — Satori OS como PWA real (Netlify + GAS API) — 08/08/2026

> **Estado:** plano + andamiaje construido y verificado por Cowork. **NO ejecutado** (se aplica en otra conversación, en modo ejecutor). Objetivo confirmado por Luciano: **offline + push + distribución** (además de ícono y fullscreen). Deploy A (launcher) va en paralelo y da el ícono ya.

## 1. Objetivo
Convertir Satori OS (hoy web app GAS servido en `script.google.com`, iframe) en una **PWA instalable desde dominio propio (Netlify)**: ícono Satori, pantalla completa real (sin barra de Safari), **offline** (abre y muestra lo último sin red), **push** (avisos al iPhone), y **distribución** (instalable/compartible, base para wrap a store si se quiere).

## 2. Por qué hoy no se puede (recordatorio)
El web app es `access:"DOMAIN"` + `executeAs:USER_DEPLOYING` (auth por sesión de Google) y el HTML corre en iframe de Google → iOS lee el `<head>` de Google, no el nuestro. Un iframe en dominio propio rompe por ITP (cookies de Google de terceros). ⇒ **La UI tiene que servirse desde NUESTRO origen** y hablarle a GAS como **API JSON con token** (no sesión de Google).

## 3. Arquitectura objetivo
```
[ iPhone: PWA instalada ]  ──HTTPS──>  [ Netlify: front estático + SW ]
   ícono/fullscreen/offline/push            index.html (UI actual) + gas-shim.js + sw.js
                                                   │  fetch JSON {fn,args,token}
                                                   ▼
                                      [ GAS deployment #2 = API ]  access:ANYONE + TOKEN
                                          doPost router → whitelist → funciones existentes
                                                   │
                                          [ Sheets MAESTRO ] (sin cambios)

[ GAS deployment #1 = editor actual ]  access:DOMAIN  ← SE MANTIENE tal cual (vos, /exec @NN)
[ Push sender ]  CF Worker/servicio (VAPID)  ← Fase 4, fuera de GAS
```
**Dos deployments GAS del mismo proyecto:** el editor DOMAIN de siempre (no se toca) + un **API nuevo ANYONE+token** SOLO para la PWA. El MAESTRO no cambia de esquema; cambia la puerta.

## 4. El linchpin (YA construido + testeado): shim `google.script.run` → `fetch`
`gas-shim.js` reemplaza `google.script.run` por `fetch` al API. El `index.html` actual (cientos de `google.script.run.withSuccessHandler(cb).fn(args)`) **funciona casi sin tocarse**: solo se carga el shim antes del `<script>` grande y se setea `SATORI.API_URL` + token.
- Envía `text/plain` → **sin preflight CORS** (GAS no maneja OPTIONS).
- Cada acceso a `.run` = runner nuevo (estado aislado por cadena).
- Mapea success/failure/userObject.
- **Verificado offline 4/4** (body {fn,args,token}, text/plain, success, failure, concurrencia aislada, sin-API_URL→fail limpio).

Esto es lo que baja C de "reescribir 900KB" a "un adaptador + un router".

## 5. SEGURIDAD (Bastión) — el corazón de C · GATE duro
Mover una superficie del MAESTRO a `ANYONE+token` es una decisión de seguridad. **Antes de desplegar el API: pleno de Bastión.** Patrón base: `portal-token-gas` (ya probado en Vehemence/LC/DAM), extendido al panel maestro.

**Modelo de token (draft en `api-router.gs`):**
- 2 tokens con scope: `SATORI_API_TOKEN_R` (lectura) y `_W` (lectura+escritura). En **Script Properties**, jamás en git/claro.
- **Whitelist explícita de funciones** (`API_WHITELIST`) — NADA de dispatch arbitrario. Escrituras exigen scope `w`.
- Comparación de token en **tiempo constante**.
- **Hardening pendiente Bastión:** rate-limit (CacheService por token/IP), rotación (vencimiento + procedimiento), token por-dispositivo (revocable), HTTPS only, logging de accesos sin PII, `_resolveFn_` → **mapa explícito `{fn:ref}` en vez de `eval`**, y evaluar si el token vive en el front (riesgo: es visible en el device) o se cambia por un **login corto** (PIN → token de sesión efímero servido por el API). ← decisión Bastión.
- **Bandera roja a resolver:** el token en un front estático es extraíble. Mitigación fuerte = token de sesión corto tras un PIN/passkey, no un token largo hardcodeado. Bastión decide el esquema.

## 6. Offline (SW ya esqueletado)
`sw.js` (draft): precache del **app-shell** (index.html, css/js, íconos) → la app **abre offline** (muestra el marco; `offline.html` para navegaciones sin red). 
- **Datos offline (Fase 3b):** cachear las últimas respuestas del API en **IndexedDB** y servirlas con banner "mostrando lo último (sin conexión)". El SW no cachea POST; lo hace el front.

## 7. Push (Fase 4) — con límites de iOS explícitos
- iOS **solo permite Web Push si la PWA está instalada en pantalla de inicio** (iOS ≥16.4) y el user acepta el permiso. No hay push en Safari-tab.
- **VAPID** + suscripción desde el SW. El **sender NO es GAS** (GAS no firma Web Push cómodo): un **worker aparte** (CF Worker/servicio) guarda las suscripciones y envía. GAS puede *disparar* (llamar al worker) cuando hay algo (aprobación, alerta del Vigía).
- Andamiaje: el `sw.js` ya tiene `push`/`notificationclick`.

## 8. Distribución
Es una PWA: se instala desde el navegador (link → "Agregar a inicio"). Compartible por URL. Si más adelante se quiere store (App Store/Play), se envuelve la PWA (PWABuilder/Capacitor) — **fuera de alcance de C**, pero C lo habilita.

## 9. Fases (T-shirt · cada una shippable/verificable)
| Fase | Qué | Tamaño | Gate |
|---|---|---|---|
| **0** | Bastión: threat model + esquema de token (largo vs sesión-corta) + decisión ANYONE-API | **S** | Bastión |
| **1** | GAS deployment #2 = API JSON (`api-router.gs` real: whitelist con las fns reales del index, `_tokenScope_`, mapa sin eval). En paralelo, NO toca el editor. Smoke por `curl`. | **M** | Bastión ✓ |
| **2** | Netlify front: mover `index.html` + `gas-shim.js`; setear `SATORI.API_URL`+token; la UI actual anda contra el API. Verificar paridad con /exec. | **M** | render + eyeball |
| **3** | Service worker (`sw.js`): app-shell offline + `offline.html`. **3b:** datos en IndexedDB. | **M** | Lighthouse PWA + prueba avión |
| **4** | Push: VAPID + worker sender + disparadores desde GAS (aprobaciones/Vigía). | **L** | prueba en iPhone real |
| **5** | Dominio propio + `manifest` final + cutover; A (launcher) se retira o redirige. | **S** | eyeball |

**Camino crítico:** 0 → 1 → 2 (ahí ya hay app fullscreen con ícono). 3/4 suman offline/push. 5 pule.

## 10. Pre-mortem (por qué podría fracasar)
- **Token filtrado** desde el front estático → cualquiera pega al MAESTRO. *Mitig.:* sesión corta tras PIN + rate-limit + rotación (Fase 0/Bastión). **Es el riesgo #1.**
- **Paridad rota:** alguna `google.script.run` usa features del host GAS (no solo datos) → el shim no las cubre. *Mitig.:* inventariar en Fase 2 (grep de `google.script.host`, `withUserObject`, uploads) antes de cortar.
- **Latencia:** cada llamada suma el RTT a GAS (ya lento). Same-origin no lo arregla. *Mitig.:* batch/caché + los timeouts duros que ya existen.
- **iOS push** no llega si no está instalada / permiso denegado → expectativa. *Mitig.:* comunicar el requisito.
- **Doble deployment** desincronizado (editor vs API con distinta versión del código) → comportamientos distintos. *Mitig.:* mismo scriptId, promover ambos juntos; el diff repo↔GAS de siempre.

## 11. Segundo orden
Con el API JSON + token, además de la PWA quedan habilitados: la **Voz** puede pegarle al mismo API (hoy usa otro camino), portales de cliente unificados, e integraciones (Telegram/n8n) sin re-exponer nada nuevo. Es infra reusable, no solo cosmética — eso es lo que justifica C dado que offline/push/distribución son objetivos reales.

## 12. Ya hecho (andamiaje, en `satori-pwa-C/`)
- `gas-shim.js` — **testeado 4/4**.
- `sw.js` — esqueleto (install/activate/fetch/push), `node --check` OK.
- `api-router.gs` — draft doPost+token+whitelist, `node --check` OK. **Requiere Bastión + poblar whitelist real.**

## 13. Decisiones abiertas para Luciano (Fase 0)
1. **Esquema de token:** ¿token largo por-dispositivo, o login con **PIN/passkey → sesión corta**? (Bastión recomienda lo 2º para el MAESTRO). 
2. **Dominio:** ¿`app.satoriconsultoria.com` u otro?
3. **Alcance del API:** ¿solo tu consola (1 usuario), o preparar multi-usuario desde ya?
4. **Push sender:** ¿CF Worker (como el Taller) o servicio gestionado?
