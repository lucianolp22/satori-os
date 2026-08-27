# ADENDA al ENCARGO EDIFICIO — corrección de concepto de Luciano (SUPERSEDE §2 del encargo)
**Fecha:** 10/08/2026 (noche) · **Autor:** Cowork · **Para:** Claude Code · **Estado:** vigente — reemplaza el diseño de "modo/toggle" del encargo original y la decisión "engine hermano" de tu FASE 0.

---

## El concepto corregido (palabras de Luciano)
> "El edificio ES el Akasha nuevo. Tiene que estar por debajo del orbe gigante principal y la estructura de órbitas y elementos que hoy lo rodean. Que se acceda a la vista del edificio navegando y yendo hacia abajo del Orbe. Todo una vista integral donde pueda navegar con fluidez en toda la oficina."

**NO hay dos modos. NO hay toggle. Una sola escena, un solo loop:** el Universo actual de Akasha (orbe/Cerebro + Muelle + Espacios de Cliente en órbita) queda ARRIBA; la torre de 8 plantas se construye DEBAJO, conectada por un haz dorado (continuidad del Cerebro). Se navega verticalmente con fluidez: bajás del orbe y estás en el Edificio.

**Maqueta de referencia nueva: `AKASHA-EDIFICIO-v4.html`** (reemplaza a v3 como fuente del módulo). Ya trae: universo (orbe de partículas + halo + anillo de polvo + 7 Espacios de Cliente con la cartera real como demo), haz conector, navegación vertical continua (pan clamp hasta el orbe, foco Universo/piso, cutaway), directorio con entrada "◉ Universo", breadcrumb dinámico, y el POST cinematográfico aplicado a TODO.

## Qué queda de tu FASE 0 y qué cambia

| Tu FASE 0 | Estado |
|---|---|
| `flotaEstado()` usa `estadoSalud()` (no `correrSalud()`) | **QUEDA** — regla dura |
| Cupo desde `filaConsumoAgentes_()`+`agenteEfectivo_().maxDia` (no `guardPresupuesto_()`) | **QUEDA** — regla dura |
| Mapeo `idle/work/ok/fail → g/b/y/gr` en adaptador | **QUEDA** |
| Endpoints lectores puros, `_soloOwner_`+ENDPOINTS_UI mismo commit | **QUEDA** |
| Pack **Opción 1** (archivo GAS lazy, ~4KB de hook en index) | **QUEDA** (ver abajo qué carga) |
| `__buildEdificioEngine` hermano + `_gpu()` + pausar loop de Akasha | **CAE** — no hay segundo engine |

## Diseño corregido de integración
1. **Extensión de la escena viva, no engine aparte.** El módulo lazy (`edificio.html`) contiene los CONSTRUCTORES (funciones que crean la torre: pisos, mobiliario, Despacho, avatares base64) y al cargarse **inyecta el grupo `torre` en la escena existente de Akasha**. Mismo renderer (el de la clausura de `__buildAkashaEngine`), mismo RAF. El invariante L6439 "un solo loop" se cumple por construcción.
2. **Seam mínimo a abrir en la clausura** (vos definís el punto exacto): una API interna tipo `__AK_EXT = { addGroup(g), onFrame(fn), navTo(target,r,phi), raycastList(list) }` expuesta DESDE ADENTRO de `__buildAkashaEngine`. Es el único cambio en el engine actual; todo lo demás entra por ahí.
3. **Ubicación espacial:** la torre debajo del universo actual. Coordenadas reales de la escena de Akasha las tenés vos — en la maqueta: orbe en y≈+700 relativo a la base de la torre, haz conector, plataforma en y=0. Adaptá el origen conservando la relación "orbe arriba / torre abajo / haz entre ambos". Si el universo actual vive en y≈0, la torre va a y negativo — misma geometría.
4. **Navegación:** extender la cámara actual de Akasha para el descenso (pan vertical con clamp, focos por piso con cutaway, foco Universo). Toda la lógica está en v4 (`selectFloor`/`selectUniverse`/`focusFloor`/`setCutaway`/pan clamp); portala sobre el sistema de cámara de Akasha (o reemplazá el de Akasha por éste si es más simple — tu call, con eyeball de Luciano).
5. **Post-proceso:** el POST de v4 (bloom+AO+DoF+ACES+viñeta+grano) aplica a la escena ENTERA — el orbe del universo con bloom gana muchísimo. Integrarlo detrás de un flag (`ak_post=1` en Config o localStorage) con rollback instantáneo al render directo, y `QUAL='low'` en móvil (ya viene en v4). El render actual de Akasha pasa a ser el fallback.
6. **Lazy (Opción 1, refinada):** el hook en index (~4KB) = botón/gesto de descenso + fetch del módulo al primer uso + velo honesto E3.7. El módulo NO re-inlinea three (usa el ya cargado); avatares base64 adentro del lazy (CORS de texturas WebGL).
7. **Cartera del universo:** en la maqueta es demo hardcodeada; en prod los Espacios de Cliente son los que Akasha YA dibuja con `listaClientes` — no duplicar: la torre se suma al universo existente, no lo reconstruye.

## Logo (pedido directo de Luciano)
Reemplazar el logo del header de Akasha (arriba a la izquierda, junto a "Akasha") por el **isologo correcto: enso + punto dorado**. En v4 está listo como SVG inline (copiar tal cual):
```html
<svg width="27" height="27" viewBox="0 0 100 100" fill="none">
  <g transform="rotate(-122 50 50)"><circle cx="50" cy="50" r="38" stroke="#ECEAE3" stroke-width="13" stroke-linecap="round" stroke-dasharray="185 53.8"/></g>
  <circle cx="57" cy="7.5" r="7.5" fill="#D4A857"/>
</svg>
```
(Si preferís imagen: los PNG del isologo están en el paquete `satori-pwa/` — íconos 180/192/512.) Posición: exactamente donde está el logo actual. Eyeball de Luciano confirma que el trazo/gap coincide con su original; si no, ajustar `rotate`/`dasharray`.

## Verificación de cierre (actualiza la del encargo)
- Navegar Universo→P8→P1→Universo 3 veces: fluido, sin duplicar loops, sin RTs sin disponer.
- El universo actual de Akasha (orbe, clientes, minimapa, paneles) sigue funcionando idéntico con el módulo cargado y con el POST on/off.
- `flotaEstado` 10× sin escribir celda ni mandar mail.
- selfTest verde + assert de aislamiento + eyeball Luciano en /dev → promote /exec.
