# ADENDA — Satori OS — 25-ago-2026 (tanda 4) · Sato sin ventanas por defecto · botones fuera · mobile

> Complementa `HANDOFF-2026-08-25-SATORI-OS-orbe-v2-sato-unificado-CRM.md`. Working tree:
> `CAPABILITIES.md` (regen del hook, del push abortado) + `src/index.html` — SIN commitear.

## CIERRE — incluye (obs del eyeball de Luciano ~03:00)

1. **"Me sigue sacando a otra ventana" → RESUELTO en el default.** Tocar el orbe (CM), el orbe de
   la cabecera de la Ficha o el Núcleo de Akasha ahora abre **el panel de Sato DENTRO del OS**
   (charla + 🎙 dictado + 🔊 respuesta con voz). **Cero `window.open` en el flujo por defecto**
   (verificado con contador en render: 0). La voz full-duplex del agente quedó como **📞 en el
   header del panel** — abre la ventanita SOLO si la pedís.
   **Por qué no puede ser 100% embebida:** el iframe donde Google sirve toda web app de GAS
   prohíbe el micrófono (T1.4c, documentado en el propio código) — esa es la única razón por la
   que la voz completa vive en una ventana top-level. **La solución definitiva sin ventana es
   PWA-C** (el OS servido fuera del iframe de Google, plano listo en `HANDOFF-PWA-C.md`): si
   este punto molesta en el uso diario, PWA-C sube de prioridad.
2. **Botones "Sato" fuera (el Orbe ES el acceso):** ocultos `cmVoz` ("Hablar con Sato" del header
   CM), `btn-voz` (pill de Akasha) y `f360SatoBtn` ("🜂 Sato" de la Ficha). **Ocultos con
   `display:none`, NO removidos del DOM:** `satoVozVentana_` lee el href de `cmVoz`, y
   `f360SatoInit_` cablea el cierre del panel a través de `f360SatoBtn` (removerlos rompía el
   panel — verificado antes de decidir). La paleta (⌘K) conserva su entrada "Hablar con Sato".
3. **Mobile iPhone 15 Pro Max (430pt):** tiles de la Cartera en carrusel horizontal (sin barra),
   foco y formularios de la solapa Comercial apilados a ancho completo, targets ≥44px en cards y
   botones, sin overflow horizontal de página (verificado en render 430×932 DPR3 — screenshots
   en la sesión).

## Verificación
`_verificar_index.py` 449/449 · harness **676/0** · render desktop y móvil: 0 errores JS ·
orbe→panel sin ventanas ✓ · 📞→1 ventana ✓ · panel abre sobre Akasha ✓.

## QUEDA ABIERTO
1. **Runbook (Mac):**
```
cd ~/Documents/Claude/Projects/SatoriOS
git add CAPABILITIES.md src/index.html
git commit -m 'Sato panel in-page por defecto + telefono opcional + botones Sato ocultos + mobile CRM + CAPABILITIES regen'
npx clasp push
git push
```
2. **Eyeball `/dev`:** tocar el orbe → panel adentro, sin ventana · 📞 → ventanita de voz ·
   Akasha doble-toque al Núcleo → panel · Cartera y solapa Comercial en el iPhone.
3. **Decisión (no urgente):** si querés la voz full-duplex 100% embebida, PWA-C es el camino —
   decime y lo priorizo como próximo frente.
4. Arrastrados: moneda por Chrome (CLI-002 ARS · CLI-003 ARS · CLI-004 EUR) · D45 live CRM
   (Cowork, antes del promote) · re-cert selfTest · encaje de tibios maduros.

*Cowork · 25-ago-2026 · tanda 4 · prod intacta.*
