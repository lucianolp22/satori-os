# HANDOFF — Satori OS — 20-jul-2026 (CIERRE DE SESIÓN) — T1 métrica + North Star + fixes UI

**ESTE es el handoff de retome vigente** (supersede al HANDOFF-2026-07-17-CIERRE-AKASHA-E37 del proyecto; el `HANDOFF.md` del repo lo actualiza Code en su próxima sesión). **Modo ejecutor al retomar.** Reglas de Luciano: hablarle EN LLANO paso a paso, sin asumir que sabe programación · eyeballs los hace ÉL · verificar contra el CÓDIGO antes de construir (código+HANDOFF > checklists; esta regla evitó 3 reconstrucciones esta sesión) · git write solo Mac/Code · comandos limpios sin `#` ni paréntesis · gobierno: Círculo+Equipo+Bastión de fondo, AREL por paso, purga por cierre de tanda.

## CIERRE (formato declaración): qué incluye · qué queda abierto

**CIERRE — esta sesión (20-jul) incluye, todo VERIFICADO:**
- **T1 · Métrica CM v3 EN VIVO end-to-end:** whitelist server-side (`metricasValidas_` unión curadas+objetivos+KPIs) + `asignarMetricaUI`/`metricasValidasUI` + **chips probados por Luciano en /dev: aprobación → chips → asignar, y rechazo** ✓. Defensa de tenant en `encolarAgente` (D17p). Normalizador de cifras es-AR (`normalizarCifrasTexto_`) + regla ESCRITURA en agent.py (aplica al reiniciar el agente).
- **North Star enriquecido SEMBRADO:** 6 clientes pagos al 31/12/2026 (5/6) + `retenciones_formalizadas` + `ingresos_recurrentes_mes_eur` + 3 guardrails + 2 pivots muertos (Kit Consulting · OSS/waitlist). Lector backward-compat; `recomendacionDelDia_` refactor a candidatas lazy que saltean pivots (`_pivotMuerto_` sin-tildes, min 4 chars). Se ve en el panel NORTH STAR·SATORI del Despacho ✓.
- **RESET ejecutado:** backup verificado-restaurable **`1xpL2TC1l5uHEQaBmuxQDzkEvlnT0wrLtV7Mo3Zze25k`** (restore: `restaurarObjetivosDesdeBackup("<id>")`) · borró 2 filas (CLI-001, CLI-006) · **CLI-002 Vehemence EXCLUIDO e intacto (3 filas)** · Config `ns_satori_*` limpiada y re-sembrada con el NS nuevo · `migrarObjetivosNorthStar` +21 columnas/7 tenants.
- **Error fantasma:** archivado (no borrado) — **Errores=0**; `limpiarErroresFantasma()` idempotente; D17p previene reaparición.
- **Gates:** selfTestF2 + selfTest completos VERDES 2× (17:41 y 19:21) — primera ejecución real de D17j-p y D18a-e, incluido drill restore con Drive real. NO re-flaggear.
- **Fixes UI verificados por eyeball:** fecha dd/mm/aaaa en 2 líneas en AMBAS vistas ✓ · voz ida/vuelta Akasha Y Despacho sin crash (contrato `?volver=` validado contra script.google.com) ✓ · **ESPEJO Akasha↔Despacho** (timer único 15s refresca la vista activa; aprobaciones aparecieron en Akasha con Muelle=2 y desaparecieron al resolverse) ✓ · semáforo FUENTE ÚNICA `semaforoCliente` (operativo pisa comercial; potencial/baja nunca verdes) ✓ · header "API DEL MES $" con espacio ✓ · estrellas: aparentemente OK tras auto-saneo de `ak-modal` en `entrar()` (confirmar de pasada).
- Higiene: `index.html.bak` borrado · PIPELINE (D2 firmada) + north-star-TEMPLATE v2 commiteados · settings.local gitignoreado. Commits: `c63369f` → `3edb8f1` → `c6addff`, todo pusheado a GAS HEAD (/dev). `/exec` AÚN NO tocado.

**QUEDA ABIERTO (con diagnóstico y dueño):**
1. **❌ Tablero + Calendario abiertos DESDE Akasha siguen rotos** (3 rondas de fix sin pegarle; desde Despacho andan). Lo hecho: E3.14 scrim, E3.15 `ak-modal`→`#akasha{display:none}` + reruta `atril-board`→`cmBoardOpen`. **BASTA DE ADIVINAR (regla de la casa: instrumentar).** Experimento decisivo (5 min, dos caminos):
   - *Camino A (Luciano, guiado):* en /dev, Akasha, abrir Calendario roto → F12 Console → **en el desplegable que dice `top` elegir el frame interno** (el que menciona googleusercontent/userHtml — lección AK_T: la consola de afuera no ve adentro) → pegar `document.getElementById('centro').className` y `getComputedStyle(document.getElementById('akasha')).display` → reportar los dos resultados.
   - *Camino B (Code, próxima sesión):* instrumentar — toast/log en `akModal_` que muestre si corrió y qué clase quedó.
   - **Lectura:** sin `ak-modal` en className → el handler de ESA entrada no dispara (hay otra puerta de apertura sin cablear — p.ej. el "Abrir tablero →" del panel TAREAS derecho de Akasha, o el click en el día del mini-calendario). Con `ak-modal` y `display:none` pero el universo visible → **el canvas 3D vive FUERA de `#akasha`** (engine lo apendea a body) → el CSS debe ocultar también el canvas (`#centro.ak-modal canvas` o el id real del canvas #gl). Con display ≠ none → CSS pisado por otra regla.
2. **⚠ Delay al volver de la voz al Despacho** (a Akasha es instantáneo). Hipótesis fuerte (7/10): Akasha hidrata de **localStorage** (`ak_snap_v1`, TTL 10min) que sobrevive la navegación a voz.html; el snapshot del Despacho (`cmRestaurarSnapshot`) usaría **sessionStorage**, que muere al navegar la pestaña afuera y volver. **Fix propuesto a Code: migrar el snapshot del Despacho a localStorage con TTL, mismo patrón ak_snap_v1.** Verificar primero en qué storage está.
3. **Limpieza:** borrar la fila "Objetivo de prueba" que quedó en `objetivos` de CLI-001 (residuo del test de chips — Code en 1 min, o Luciano a mano en la hoja).
4. **DECISIÓN DE LUCIANO — PROMOTE a /exec:** recomendación de Cowork = **promover YA sin esperar el fix de overlays**: ese bug YA EXISTE en prod (vino con E3.7), no es regresión de esta tanda, y reteniendo el promote se le niega a prod todo lo verificado (métrica+NS+espejo+voz+fechas+semáforo). Comandos abajo. Tras promover: reiniciar el agente de voz (para que la voz pegue al /exec nuevo con normalizador + regla de escritura).
5. **Purga de cierre de tanda + declaración formal** — corre DESPUÉS del promote (quedó pendiente a propósito).
6. **Re-siembra de objetivos de TENANTS** — pausa clientes vigente; se definen al retomar cada cliente. Vehemence ya tiene los suyos.
7. **Cola del plan (PLAN-INTEGRAL-SATORI-OS-2026-07-18.md):** T3 motor profundo/seguridad (arranca con `_soloOwner_` en endpoints UI mutantes + gate matriz de riesgo + credencial con vencimiento + memoria hot/cold + security-scan + evals + SOUL + panel salud + neural map) → T4 admin propia (necesita facturas de Luciano) → T7 correo (pleno Bastión ANTES) → B8 final. T5/T6 ⏸ pausa clientes. IG monitor sigue diario.

## Comandos para Luciano (Terminal; uno por línea, Enter tras cada uno)

Promote a producción (1º muestra el plan sin tocar nada; 2º ejecuta):
```
cd "/Users/lucianopablolp/Documents/Claude/Projects/SatoriOS"
```
```
bash _promote_exec.sh
```
```
bash _promote_exec.sh --go
```
Después, verificar en /exec: la Oficina carga, fecha limpia, North Star visible, Errores 0. Rollback si algo sale mal: el deployment anterior quedó anotado en `_promote_rollback.txt`.

Reinicio del agente de voz (post-promote, para cifras-en-números por voz):
```
cd "/Users/lucianopablolp/Documents/Claude/Projects/SATORI · Asesoramiento y consultoría"
```
```
bash ks_voz_reinicio_agente.sh
```

## Al retomar (nueva conversación)
Decir "retomemos Satori OS" + adjuntar/citar este handoff. Primer paso: preguntar a Luciano el resultado del promote y (si lo hizo) del experimento del punto 1. Luego encargo a Code: ronda 3 de overlays CON instrumentación (no más fixes a ciegas) + snapshot Despacho a localStorage + borrar fila test CLI-001 + actualizar HANDOFF.md del repo. Cerrado eso → purga de cierre de tanda → T3.

## Claves
prod `/exec` `AKfycbxZJL4E_t8qpIP5tFaEBJKxjZX_z3KyelUQ_Om4EJDiSU90v3u0-UbAPnD-V7ubphLm` (pre-promote) · /dev `AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I` · scriptId `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO` · MAESTRO `1DMORlkps1Rgvk2D-1XXA7h3R2gMfSGIXirIGR3KjYjk` · CLI-002 `1CFUTQNXxcWTqxxy4zTo9j9_u6czeL7OWbd9gmUOyuIg` · **backup reset `1xpL2TC1l5uHEQaBmuxQDzkEvlnT0wrLtV7Mo3Zze25k`** · Trigger SIP `trig_01PLkGMpfmegViFeEaUHZd7A` · Repo `~/Documents/Claude/Projects/SatoriOS`.

## Lecciones oro (20-jul)
Verificar contra el código ANTES de construir evitó 3 reconstrucciones (F1 doctrina, F2 lazo, FIX 7 snapshot) — código+HANDOFF > checklists. · La consola top no ve dentro del iframe (AK_T "not defined" ≠ falla; frame selector o confirmación visual). · Re-stagear a la MISMA ruta sirve caché viejo → verificar archivos recién editados con device_bash grep directo. · Fix UI sin reproducir = whack-a-mole: a la 2ª ronda fallida, INSTRUMENTAR (lección AK-DEBUG). · La voz pega al doPost de /exec: probar features nuevas de voz exige promote (los "cinco mil euros" en palabras eran prod viejo, no bug del fix). · Formato único de fecha en 2 capas (`fechaHoraCorta` cliente + `fechaHoraCorta_` server); tiles angostos → 2 líneas. · sessionStorage no sobrevive la ida a voz.html; localStorage sí (hipótesis delay Despacho).
