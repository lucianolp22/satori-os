# HANDOFF — PWA C (Satori OS app real) — retomar en modo ejecutor

> **Al retomar:** modo ejecutor desde el primer mensaje. NO re-explicar el proyecto. Leer este handoff + `PLAN-C-PWA-Satori-OS.md` + `ENCARGO-CODE-PWA-C.md`, y arrancar por el "PRÓXIMO PASO". Este handoff es de la **subtarea PWA-C**; NO reemplaza al `SatoriOS/HANDOFF.md` (proyecto distinto).

## Qué es
Migrar Satori OS a **PWA real** (Netlify front + GAS como API JSON con token) para **offline + push + distribución + ícono/fullscreen**. Confirmado por Luciano (08-ago) que esos objetivos son reales → C se justifica (no es solo cosmético).

## Por qué (dato duro)
Web app hoy = `access:DOMAIN` + sesión Google + iframe → iOS no lee nuestro `<head>`. Solución = servir la UI desde dominio propio y hablarle a GAS como **API JSON + token** (no sesión).

## Estado actual (08-ago, Cowork)
- **Opción A (launcher) desplegable YA** — da el ícono. Paquete `satori-pwa/` + `DEPLOY.md`. (Interino; C lo reemplaza en Fase 5.)
- **Andamiaje de C construido y verificado** en `satori-pwa-C/`:
  - `gas-shim.js` — `google.script.run`→`fetch`. **Testeado 4/4** (linchpin: el index.html actual anda sin reescribirse).
  - `sw.js` — service worker offline (draft, `node --check` OK).
  - `api-router.gs` — doPost JSON + token + whitelist (draft, `node --check` OK). **Requiere Bastión + whitelist real.**
- **NADA desplegado de C. El editor DOMAIN sigue intacto.**

## PRÓXIMO PASO (arrancar acá)
**Fase 0 — Bastión.** Convocar `bastion-satori`: "exponer el MAESTRO vía API ANYONE+token — threat model + esquema de token". Cerrar la spec de auth (recomendación Cowork: **PIN/passkey → sesión corta**, no token largo en el front; + rate-limit + rotación). Sin eso, no se toca GAS.

Después: Fase 1 (API JSON) → 2 (front Netlify) → 3 (offline) → 4 (push) → 5 (dominio). Detalle en el ENCARGO.

## Decisiones abiertas (Luciano, Fase 0)
1. Token largo por-dispositivo vs **login PIN/passkey → sesión corta** (rec: 2º).
2. Dominio (`app.satoriconsultoria.com`?).
3. API 1-usuario (tu consola) o multi-usuario desde ya.
4. Push sender: CF Worker (como el Taller) vs gestionado.

## Riesgo #1
Token filtrado desde el front estático → mitigar con sesión corta + rate-limit + rotación (Fase 0). El resto de riesgos en PLAN §10 (paridad, latencia, iOS push, doble deployment).

## Punteros
- `PLAN-C-PWA-Satori-OS.md` (arquitectura/fases/seguridad/pre-mortem) · `ENCARGO-CODE-PWA-C.md` (qué ejecuta Code) · `satori-pwa/` (launcher A) · `satori-pwa-C/` (andamiaje C).
- CLAVES Satori OS: en memoria `satori-os.md` + `SatoriOS/HANDOFF.md`. `/dev` id `AKfycbz…6I`. Editor luciano@satoriconsultoria.com.
