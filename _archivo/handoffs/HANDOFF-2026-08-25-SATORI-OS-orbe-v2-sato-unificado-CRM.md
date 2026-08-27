# HANDOFF — Satori OS — 25-ago-2026 (tanda 3) · Orbe v2 fiel al Núcleo · Sato UNIFICADO · CRM COMPLETO

> **Al retomar: modo ejecutor.** Correcciones de la observación dura de Luciano ("bola grotesca")
> + unificación del Director Sato + **build completo del CRM** (maqueta v1 + handoff CRM §4).
> Working tree **M sobre `f037895`, 7 archivos SIN commitear** — runbook abajo. Prod intacta (≈@50).
> Verificado: harness **676/0** (17 asserts nuevos) · `_verificar_index.py` 449/449 · **render
> headless con payload simulado: la Cartera CRM renderiza IGUAL que la maqueta v1** · 0 errores JS.

## CIERRE — incluye

1. **R1 · Orbe corregido (obs Luciano):** el orbe NATIVO del CM quedó **intacto** (se revirtió el
   reemplazo del cuerpo). La capa persistente v2 es **fiel al Núcleo**: 140 partículas
   (crema/jade/terra) sobre esfera + anillo fino + halo suave. Solo aparece al abrir la Ficha 360:
   nace sobre el orbe del CM, vuela a la cabecera, y al cerrar vuelve y desaparece. Fail-safe @42.
2. **R2 · Akasha:** el cartel "Núcleo Akasha" **ya no se auto-abre** al entrar al Núcleo (se
   contempla; doble toque = Hablar con Sato). Barra: **fuera "?" y "◈ Full/Eco"** (calidad SIEMPRE
   Full — auto-eco removido), **entra "◉ Cartera"** (sale de la escena y abre el panel Cartera).
3. **R3 · Director Sato UNIFICADO (decisión Luciano: ventana flotante + panel):** el chip "Sato"
   del CM **desapareció**. "🎙 Hablar con Sato" (CM, orbe del CM y Akasha) ahora abre la voz REAL
   en una **ventanita flotante** (patrón satomic: top-level ⇒ micrófono OK; `window.close()` de
   voz.html funciona por ser popup) **+ el panel de charla del GAS como registro** — nunca más
   navega la pestaña afuera. En Akasha el panel (body z-300) queda sobre la escena (200).
4. **R4 · CRM COMPLETO (backend + UI, contra maqueta v1):**
   - **Backend (`33_cartera.js`):** `carteraProxAccion` (edición próx. acción + fecha, validada,
     lock, log) · `propuestaRegistrar` (fila en `recurrentes_propios`, estado=propuesta, sella
     "registrada fecha") · `propuestaFirmar` (→ activo, IDEMPOTENTE, **ciclo medido en días** a
     Actividad) · `_carteraFoco_` PURA (2 contactos F3: vencida más vieja → caliente → más quieto).
     `carteraPipeline` suma campos ADITIVOS: `foco`, `recurrentes` (activos/propuestas/por_moneda),
     `props` (propuesta viva por cliente, con booleano `firmada`), `pide_prox` por card (el juicio
     del enum vive en el server — regla anti-enum-clavado del harness, que me cazó 2 veces ✓).
   - **Seguridad:** los 3 endpoints con `_soloOwner_` + alta en `ENDPOINTS_UI` en el MISMO commit.
   - **Schema:** +`encaje_kairos_4b` AL FINAL de `Clientes` (4 chars s/n/-, tildado A MANO en
     Etapa 2 — no es ML, el código no lo escribe). Asserts D44a2/E-c actualizados (cola nueva).
   - **UI Cartera:** 4 tiles (retenciones activas · recurrente/mes por moneda · vencidas ·
     **sin próximo paso**) + **barra Foco de la semana** (el OS propone con motivo; vos decidís) +
     badges (◎ foco · propuesta/retención con monto) + regla «el siguiente paso siempre existe»
     (rojo) + **card → Ficha 360** (cierra el panel primero — lección stacking).
   - **UI Ficha 360:** solapa **"Comercial"** (6ª): Oportunidad (etapa + próx. acción **editable**
     con fecha) · Encaje KAIROS (4 leds desde `encaje_kairos_4b`) · Propuesta/retención (lista +
     "→ Registrar propuesta" + "✓ Marcar firmada" con ciclo). `datosCliente` propaga los campos
     (aditivo) + `recurrentes` del cliente.

## PURGA tanda 3 — 0 Críticos/Altos · 3 Medios · 4 Bajos

- **M1:** los endpoints CRM nuevos quedan cubiertos por D19c/D31a (dinámicos) + harness offline,
  pero **sin asserts funcionales EN VIVO todavía** (D45 live) → DEUDA con dueño: Cowork, próxima
  tanda, antes del promote definitivo del CRM.
- **M2:** `_setColumnasCliente_` se reusa sobre `recurrentes_propios` (funciona por headers+_fila;
  nombre engañoso, documentado en comment).
- **M3:** editar próx. acción desde la solapa no refresca una Cartera abierta detrás (refresca al
  reabrir). Menor.
- **B:** el popup de voz puede toparse con el popup-blocker la primera vez (permitir y listo) ·
  en iPhone PWA la ventanita no aplica (queda el flujo actual) · `encaje_kairos_4b` se tilda a mano
  en el Sheet (deliberado nivel-0, sin endpoint) · tile Recurrente/mes muestra "—" hasta que haya
  filas con moneda en `recurrentes_propios`.

## QUEDA ABIERTO

1. **Runbook de Luciano (Mac) — publica TODO a `/dev`:**
```
cd ~/Documents/Claude/Projects/SatoriOS
git add src/01_schema.js src/08_webapp.js src/09_selftest.js src/22_seguridad.js src/33_cartera.js src/index.html _harness.js
git commit -m 'Orbe v2 fiel al Nucleo + Sato unificado + Akasha barra + CRM completo - Cowork 25-ago'
npx clasp push
git push
```
2. **Editor GAS:** `setup` (materializa `encaje_kairos_4b`). La re-certificación selfTest completa
   puede esperar al cierre del ciclo CRM (D44a2 nuevo la requiere antes del próximo promote).
3. **Eyeball `/dev`:** CM (orbe nativo como siempre; "Hablar con Sato" abre ventanita + panel) →
   Ficha 360 (el orbe-partículas vuela a la cabecera; solapa **Comercial**: editá una próx. acción)
   → Cartera (tiles + foco + badges; click en una card abre su Ficha) → Akasha (sin cartel del
   Núcleo; sin "?"/Full; botón ◉ Cartera; doble toque al Núcleo = voz).
4. **Moneda en el MAESTRO** (pendiente de Chrome): CLI-002 ARS · CLI-003 ARS · CLI-004 EUR —
   abrí Chrome y decime "cargala", o a mano (columna N de Clientes). `encaje_kairos_4b` de los
   4-5 maduros cuando quieras (col O: ej. `ssss`, `ss-s`, `s-ns`).
5. Deuda: D45 live asserts CRM (Cowork) · re-cert selfTest · HANDOFF.md repo cabecera vieja ·
   maqueta CRM v1 ya implementada (marcar OK) · resto arrastrado del backlog.

## PUNTEROS
- Anclas: `CRM 25-ago` (33_cartera.js, 08_webapp.js, index.html) · `ORBE PERSISTENTE v2` ·
  `unificación Director Sato` (irAVoz / abrirVoz).
- Verificación reproducible: `node _harness.js` (676/0) · `python3 _verificar_index.py` ·
  render shim GAS con payload simulado (script `render_final.js` de la sesión Cowork).

*Cowork · 25-ago-2026 madrugada · tanda 3 · prod intacta; todo va a `/dev` con tu clasp push.*
