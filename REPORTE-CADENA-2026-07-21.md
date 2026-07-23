# REPORTE — CADENA INTEGRAL F0→F6

> Ejecutada por Claude Code el **23-jul-2026** sobre el encargo `ENCARGO-CODE-CADENA-INTEGRAL-2026-07-21.md`
> y el marco `PLAN-INTEGRAL-SATORI-OS-v3-2026-07-21.md`.
> Autorizaciones confirmadas por Luciano: **A1=SÍ · A2=NO · A3=SÍ · A4=SÍ · A5=SÍ · A6=SÍ**.
> **`/exec` NO se tocó.** Todo fue a `/dev` (HEAD de GAS) + GitHub. No se corrió ninguna puesta en marcha.

---

## 1. Hecho / saltado / bloqueado, por fase

| Fase | Estado | Commit | Verificación offline |
|---|---|---|---|
| **F0** preflight | ✅ hecho | — | drift repo↔GAS **idéntico** (25 archivos) · `node --check` 23 `.js` ✓ · working tree sin modificados trackeados |
| **F1** T3-M3/M4/M5 | ✅ hecho | `9ce5e4f` | harness **41/41** · asserts D21·D22·D23 |
| **F2** T3-H (H1-H4) | ✅ hecho | `209bbce` | harness **61/61** · asserts D24 |
| **F3** TC-W3 conectores | ✅ hecho | `ceb4664` | harness **100/100** (incluye B8 y la purga) · asserts D25 |
| **F4** TC-W1/W2/W4 Hilo | ✅ hecho | `bf640b2` | harness **34/34** · asserts D26 |
| **F5** T7 correo | ⏸ **spec, por A2=NO** | `5acead4` | sin código: era la instrucción exacta |
| **F6** B8 + cierre | ✅ hecho | `5acead4` | B8 dentro del harness F3 |
| **Purga integral** (Cowork) | ✅ aplicada 23-jul | (este) | mapeo cliente↔SGIC corregido + 11 gates · asserts D25g..g6 |

**Ninguna fase se bloqueó.** Un solo desvío deliberado, ya previsto en el encargo: F5.

### Numeración de asserts — corrección a anotar
El encargo asignaba D24 a F3, D25 a F4 y D26 a F5. Como F2 (módulo H) también necesitaba su tanda y
el encargo no se la había numerado, la serie quedó corrida en uno:

| Tanda | Cubre |
|---|---|
| **D21** | M3 memoria caliente/fría |
| **D22** | M4 golden-set determinístico |
| **D23** | M5 verificación ≥2 dominios |
| **D24** | **F2 · módulo H** (SOUL · Salud humana · cerebroNodo · flag del mapa) |
| **D25** | F3 conectores |
| **D26** | F4 Hilo |
| **D27** | reservada para T7 correo (spec, sin implementar) |

---

## 2. Lo que la cadena encontró (no estaba en el encargo)

Tres hallazgos reales de la cadena — los tres los produjo la verificación, no la lectura. El cuarto
(§2.4) lo encontró la purga integral de Cowork **después**, y es el más grave de todos.

### 2.1 🐞 Bug de producción en el normalizador de cifras — **arreglado**
El golden-set M4, apenas se encendió, puso en rojo el caso `CF-04`:

```
"llegar a cincuenta mil unidades"  →  "llegar a 50.001idades"
```

La alternación de palabras-número de `normalizarCifrasTexto_` **no tenía `\b`**, así que se comía el
prefijo de palabras comunes: el `un` de `unidades`, el `dos` de `dosis`. Resultado: **una cifra
inventada y la palabra mutilada**, en texto que ya iba a la hoja — vía la voz, que es exactamente
donde se dictan objetivos y metas.

Arreglado en `07_util.js` el mismo día. `CF-04`/`CF-08`/`CF-09` quedan como regresión.

**Por qué importa más allá del bug:** `selfTest` estaba verde. Lo estuvo siempre. Verificaba que el
sistema **no reventara**; nadie estaba mirando si seguía **decidiendo bien**. Ese hueco es lo que M4
venía a tapar, y lo tapó a los diez minutos de existir.

### 2.2 🐞 Drift en SOUL, atrapado por su propio chequeo — **cerrado**
Al espejar las invariantes a `voz/agent/agent.py` se dejó que el espejo adaptara la 2ª persona. El
chequeo de drift del harness marcó **S7** ("se deriva al humano" → "a Luciano") y **S8** ("no se
narra" → "no narres"): dos reglas corridas de sentido, en el archivo que gobierna la conducta de la
voz, en el mismo commit que las creaba. Se pasó a **espejo verbatim** y el harness compara las 8
reglas enteras.

### 2.3 🔓 Secretos en claro en documentación de OTROS proyectos — **reportado, no tocado**
El barrido A3 encontró **tokens de acceso en texto plano dentro de documentación**:

- `Vehemence/DOC-Vehemence-ERP-sistema.md` §13 → un `OWNER_TOKEN`
- `DAM Barber Shop/HANDOFF.md` → tabla "Artefactos"

**No están en el repo de Satori OS y no se modificó nada de esos proyectos.**

**Corrección de la purga integral (23-jul):** la primera versión de este reporte recomendaba "purgar
el historial de git". **Esos dos proyectos no tienen repositorio git** — son carpetas en el Mac. No
hay historial que reescribir, y hablar de purgarlo habría mandado a Luciano a hacer un `filter-repo`
sobre algo que no existe.

**La acción real, más chica y más útil:**
1. **Vehemence — rotar el `OWNER_TOKEN`** en su SGIC, porque estuvo escrito en claro en un archivo
   que se comparte y se copia. Rotar es lo que corta el riesgo; borrarlo del doc sin rotarlo no.
2. **Sacar el valor del `DOC-Vehemence-ERP-sistema.md`** y dejar en su lugar dónde vive el token
   (Script Property), no cuál es.
3. **DAM — revisar la tabla "Artefactos"** con el mismo criterio: si lo que hay es un token, rotarlo
   y reemplazarlo por un puntero; si son solo IDs de planilla, no son secretos (el ACL es el gate) y
   pueden quedarse.

Sin git de por medio, el alcance de la exposición es quien haya tenido acceso a esas carpetas —
acotado, pero no nulo si esos docs se pasaron por algún canal.

### 2.4 🔴 `id_cliente` cruzados en la siembra de conectores — **lo encontró la purga, no la cadena**
El barrido A3 confirmó los cuatro Spreadsheet-ID contra archivo:línea, pero **nunca abrió la hoja
`Clientes` del MAESTRO**. Los `id_cliente` se pusieron por suposición y quedaron corridos: **CLI-004
(DAM) apuntando a la DB de MesaQuince** y **CLI-005 (SIP, que no tiene SGIC) apuntando a la de DAM**.

El código llevaba un `⚠ los id_cliente son un SUPUESTO` en el log — y eso no sirvió de nada. **Anotar
un supuesto no lo vuelve inofensivo.** Lo que contuvo el daño fueron las decisiones de diseño, no la
advertencia: nacen apagados, `probarConector` es ensayo en seco, y encender es un acto separado. Sin
eso, un `encenderConector` sin mirar habría escrito las finanzas de un cliente en el Sheet de otro.

**La lección operativa:** el barrido A3 verificó la mitad de una relación (el ID del SGIC) y dio por
buena la otra mitad (a qué cliente pertenece). Una relación entre dos sistemas hay que verificarla en
los DOS extremos. Corregido y fijado con asserts (D25g..g6) para que no vuelva a pasar en silencio.

---

## 3. Flags OFF y cómo se encienden

Todo lo riesgoso nació apagado. **La cadena construyó; la revisión enciende.**

| Flag | Dónde | Default | Cómo se enciende | Antes de encender |
|---|---|---|---|---|
| `conector_<CLI>_on` | hoja **Config** | `false` | `encenderConector('CLI-00X')` | `probarConector('CLI-00X')` y **comparar los totales contra la fuente** |
| `cerebro_map` | hoja **Config** | `off` | poner `on` en Config | eyeball de fps en el iPhone (ver §5, paso 6) |
| `correo_on` | — | — | **no existe**: T7 no se implementó (A2=NO) | — |
| `autoheal_on` | Config / Script Property | `false` | sin cambios en esta cadena | — |

**Conectores dados de alta pero APAGADOS** (se siembran con `sembrarConectoresHallados()`, una vez,
desde el editor):

| Cliente | SGIC | Adapter | Estado |
|---|---|---|---|
| **CLI-001** FRANFLACA | MesaQuince | `movimientos_mesaquince` | ⏸ **OFF** |
| **CLI-002** | Vehemence | `ventas_sgic` (por código) | ✅ ya validado y corriendo |
| **CLI-003** | LC Travel | `libro_lctravel` | ⏸ **OFF** |
| **CLI-004** Barbería Alex | DAM | `fresha_dam` | ⏸ **OFF** |
| **CLI-005** SIP | — | — | sin SGIC: no hay nada que conectar |

> **🔴 Corregido en la purga integral (23-jul).** La primera versión de esta tabla —y del código—
> tenía los `id_cliente` **cruzados**: el barrido A3 confirmó los Spreadsheet-ID pero nunca leyó la
> hoja `Clientes` del MAESTRO, así que los ids se pusieron por suposición. Quedaban **CLI-004 (DAM)
> apuntando a la DB de MesaQuince** y **CLI-005 (SIP, que no tiene SGIC) apuntando a la de DAM**.
> Nacían apagados y `probarConector` es ensayo en seco, así que el radio estaba contenido — pero un
> `encenderConector` sin mirar habría escrito las finanzas de un cliente en el Sheet de otro.
> Ahora el mapeo es un **contrato aserido** (D25g/g2/g3/g4/g5/g6): cruzarlo de nuevo pone rojo el
> `selfTest`. `estadoConectores()` muestra el mapa completo.

---

## 4. IDs de SGIC hallados (A3) y su origen

Barrido de solo-lectura sobre las carpetas de proyectos del Mac. **No se adivinó ningún ID.**

| Proyecto | Spreadsheet-DB | Confianza | Origen (archivo:línea) | Hoja mapeada |
|---|---|---|---|---|
| **Vehemence** | `1ac1ccVMdFgO_VyOzsGwvdtEhCil41A6GnrJIAoNAwNk` | CONFIRMADO (14 archivos) | `DOC-Vehemence-ERP-sistema.md:506`, `PLANO-B-GAS-Workspace.md:16` | `DB_VENTAS` |
| **LC Travel** | `1_5fyiolfK2bvvPwKmGr5kUxrRCUAUOGXiTu-x2Zigzc` | CONFIRMADO (literal) | `LC Travel/Code.js:1`, `HANDOFF.md:74` | `DB_LIBRO` |
| **MesaQuince** | `16scXurhcVyzjLJoRtjKZViy7aqpvd7wjvEzZ7mwo-d8` | CONFIRMADO | `code.gs.rtf:28`, `HANDOFF_MesaQuince.md:15` | `tx_movimientos` |
| **DAM** | `1_pkEGg5e14gF2_59EmEygDoR9BlIvPAvZZOg6k50dWY` | CONFIRMADO (4 archivos) | `HANDOFF.md:77`, `N3_Plano_DataLayer.md:9` | `Fresha_Daily` |
| **EJF / Figueras** | — | **NO HALLADO** | su ID vive **solo** en la Script Property `FIGUERAS_SS_ID` de SU proyecto GAS (`figueras-app/gas/Code.gs:32,390`) | — |
| **Oficina Virtual** | — | **NO APLICA** | no es GAS+Sheets: Python + **SQLite** (`oficina-virtual/data/oficina.db`) | — |

**Descartados a propósito** (para que nadie los reuse por error): `12B63WIx…` (MesaQuince) es base64
de una imagen embebida · `1ASSodIy…` (Vehemence) es data-URI de un logo · `1EoqiKG7…` es un **backup**
de Vehemence del 09-jun, no la DB viva · los IDs de `oficina-virtual/data/cache_fuentes/` son scraping
externo.

### Límites conocidos de los adapters — **leer antes de encender**

- **MesaQuince:** el adapter trae el **rubro CRUDO**. El rubro efectivo de MesaQuince sale de aplicar
  un overlay guardado en un blob JSON (`_dash_movimientos_overlay`) y después un catálogo de 59
  cuentas → 17 rubros. Sirve para **volumen y serie temporal**; **NO reproduce su EERR por rubro**.
- **DAM:** solo **ingresos** (`Fresha_Daily`). Los costos viven en `Costos_Cal`, con otra forma
  (`ym`+`day` separados, filas plantilla con `ym='tmpl'`) y un criterio de devengado sin validar.
  Documentado como siguiente paso, no improvisado.
- **LC Travel:** cuidado con el **doble conteo** — `DB_VIAJES.mov_id_ingreso` apunta a filas del
  Libro. El adapter lee **solo** `DB_LIBRO`, así que hoy no hay doble conteo; si alguien agrega
  `DB_VIAJES`, hay que resolverlo.
- **EJF:** aunque aparezca el ID, su SGIC **no tiene libro contable** (es CMS de artista). El único
  mapeo honesto sería su hoja `metrics`, que no es dinero. Y sus tabs `contacto`/`emails`/`cartas`
  tienen **PII de fans**: no ingestar.

---

## 5. Guion de eyeball para la revisión conjunta — pantalla por pantalla

Ordenado de barato a caro. **Todo en `/dev`.**

### Paso 1 · `selfTest()` en el editor GAS *(lo único que puede dar rojo de golpe)*
Trae **6 tandas nuevas**: D21 · D22 · D23 · D24 · D25 · D26.
- Si sale ❌ **D19b**, mirá eso primero: la Session del editor no está entregando el email y arrastra
  todo lo demás.
- Si sale ❌ **D22c**, hay una **regresión de producto** — el sistema dejó de decidir lo que decidía.
  El mensaje del assert dice qué caso del golden-set se rompió.

### Paso 2 · Centro de Mando · pestaña **Salud**
Antes: `cola [crit] 0 pendientes · 2 tomadas colgadas`. Ahora tenés que ver:
- Arriba, un **semáforo con frase** ("Todo en orden" / "Requiere atención" / "Necesita acción ya") y
  `N de 7 chequeos piden algo · integridad X%`.
- Debajo, los 7 chequeos **ordenados crit → warn → ok**, con nombre en llano ("Estructura de las
  planillas", "Cerrojos del sistema") y, en los que no están en verde, una línea **→ qué hacer**.
- **Verificá:** que ningún chequeo en verde muestre acción, y que ninguno en rojo la omita.

### Paso 3 · Panel de cliente del CM
- Arriba de todo, una card **"Hilo de trabajo"**.
- Sin Hilo cargado (que es el estado de hoy) debe decir **"Hilo no cargado"** y explicar qué correr.
  **No debe mostrar secciones vacías** — eso se leería como "todo en orden".

### Paso 4 · Akasha → entrar a un Espacio de Cliente
- El panel del Espacio trae ahora la **estación del Hilo** (misma vista que el CM: es literalmente la
  misma función de render) y dos botones nuevos: **"◈ Cerebro de este Espacio"** y el historial.
- **Verificá:** que el Hilo del Espacio y el del CM digan **exactamente lo mismo**. Si difieren, hay
  dos renders vivos y eso es justo lo que la absorción venía a cerrar.

### Paso 5 · Akasha → Núcleo → click en un nodo
- El panel del nodo ya no dice "el detalle llega en E3.5". Ahora **pide el detalle y lo muestra**:
  etiqueta real, tipo, dimensión, cobertura, **relaciones con nombre** (`→ orquesta Director`) y los
  últimos movimientos del log.
- **Verificá:** que aparezcan etiquetas de verdad. Si dice "Sin detalle", el nodo llegó sin id
  (recargá) o el Cerebro de ese Espacio no respondió.

### Paso 6 · Mapa neural *(el único que hay que decidir, no solo mirar)*
- Con `cerebro_map=off` (como está hoy), el botón "◈ Cerebro de este Espacio" muestra un toast
  explicando cómo encenderlo. **Eso es lo correcto**, no un bug.
- Para probarlo: poné `cerebro_map=on` en Config, recargá Akasha, entrá a un Espacio y tocá el botón.
  Deberías ver los nodos del tenant orbitando su Espacio, agrupados en bandas por dimensión, con las
  aristas como líneas tenues.
- **Lo que hay que medir es el fps en el iPhone.** El CM vive en un iframe cross-origin: no es
  screenshoteable, así que esto solo lo podés juzgar vos. Si no llega a 30fps, dejalo en `off` — el
  código queda y no molesta.
- Salí del Espacio y volvé: el mapa tiene que **desaparecer y reconstruirse**, no acumularse.

### Paso 7 · Voz (Sato)
- El prompt ahora arranca con las **8 invariantes de SOUL**. La personalidad no se tocó.
- **Verificá:** que Sato siga sonando igual (rioplatense, con aplomo) y que consultar y capturar
  sigan funcionando.

### Paso 8 · Brief del día
- La recomendación trae una línea nueva **"Verificación:"** — `verificado (X + Y coinciden en N)`,
  `1 fuente (X) — NO verificado`, o `⚠ CONFLICTO entre fuentes`.
- **Si ves un CONFLICTO, no es un bug: es el punto.** Significa que dos hojas dicen cosas distintas
  del mismo número y alguien tiene que decidir cuál miente.

---

## 6. Lo que corre Luciano (nada de esto lo puede hacer Code)

1. **`selfTest()` en el editor GAS.** `clasp run` sigue bloqueado.
2. **`sembrarConectoresHallados()`** — una vez. Siembra CLI-001 (MesaQuince), CLI-003 (LC Travel) y
   CLI-004 (DAM), los tres **apagados**. El mapeo ya está aserido en D25g contra el roster real, así
   que un `selfTest` verde es la verificación; igual conviene mirar `estadoConectores()` después.
3. **Por cada conector, en este orden:** `probarConector('CLI-00X')` → comparar los totales con lo que
   el cliente ve en SU sistema → `encenderConector('CLI-00X')`. **Uno por uno, no los tres juntos.**
4. **`repararCerebro()`** (crea `cerebro_log_archivo` + `cerebro_resumen`) y **`repararHilo()`** (crea
   la hoja `hilo`) en los clientes existentes.
5. **N1 · correr la skill `hilo-de-trabajo`** en ≥2 clientes (DAM + Vehemence) y espejar con
   `bash _hilo_sync.sh CLI-00X "<ruta al HILO.md>"` → `espejarHiloCSV(...)`. **Hasta que esto pase,
   la vista del Hilo está vacía a propósito.**
6. **Decidir `cerebro_map`** después de mirar los fps (paso 6 del guion).
7. **Decidir A2 (correo).** Hoy NO. La spec está entera en `docs/SPEC-correo-T7.md`.
8. **Llevar `docs/RGPD-registro-tratamiento.md` a un asesor** antes de cargar el primer dato real.
9. **Rotar el `OWNER_TOKEN` de Vehemence** y sacar su valor del `DOC-Vehemence-ERP-sistema.md`
   (dejar el puntero a la Script Property, no el secreto). Revisar la tabla "Artefactos" de DAM con
   el mismo criterio. **No hay historial de git que purgar en esos proyectos** — ver §2.3.
10. **Promote a `/exec`** — recién después de todo lo anterior.

---

## 7. Qué queda abierto (gate de declaración de cierre)

`bash _inventario_cierre.sh` corrido el 23-jul. Lista depurada a mano:

### Construido pero SIN VERIFICAR EN RUNTIME
Todo lo de esta cadena está verificado **offline** (`node --check` + harness `vm` con stubs de GAS).
**Nada se ejecutó dentro de GAS.** Las funciones que tocan Sheets (`comprimirMemoriaFria`,
`sincronizarCliente_`, `espejarHilo`, `cerebroNodo`, `hiloCliente`) tienen sus **decisiones puras**
aseridas, pero **su ruta de I/O no corrió nunca**. Ese es el riesgo real de haber batcheado 6 fases.

### Deuda declarada, no accidental
- **T7 correo** — spec completa, cero código (A2=NO).
- **Adapter de costos de DAM** (`Costos_Cal`) — no escrito; falta validar su criterio de devengado.
- **Overlay de rubros de MesaQuince** — el adapter trae rubro crudo (§4).
- **EJF** — sin conector: su ID no existe en disco y su SGIC no tiene libro contable.
- **Oficina Virtual** — fuera del alcance de un conector de Sheets (es SQLite).
- **T4 admin propia** — fuera de la cadena por A6; entra cuando Luciano suba las facturas.
- **Retención RGPD** — hoy **no existe borrado automático de nada**. Definida como propuesta, sin
  implementar (§3 del doc RGPD).
- **Supresión en backups** — sin resolver: borrar del sistema vivo no borra de los backups.

### Riesgo aceptado y documentado
- **Nombres propios siguen viajando en claro** a la API en la vía Bandeja. Es deliberado (tokenizarlos
  rompe el linkeo a `id_cliente`). La mitigación es de uso, no técnica: no dictar PII de terceros.
- **`_ctxSistema_`** sigue apoyado en el supuesto verificado de que un trigger nunca entrega un email
  de tercero. Vale desde M1a; esta cadena no lo cambió.
- **El espejo del Hilo puede quedar viejo** respecto del `.md`. Por eso la UI muestra la fecha del
  espejo — nunca se hace pasar por la fuente.

### Lo que esta cadena NO incluye
Promote a `/exec` · puesta en marcha · carga de datos reales · encendido de conectores · corrida de
Hilos (N1) · reinicio del agente de voz · la purga integral (la corre Cowork sobre este reporte + los
diffs, antes de la sesión de revisión).

---

## 8. Resumen en una línea

Seis fases, seis commits, **236 asserts offline verdes**, 6 tandas nuevas en `selfTest`, **3 bugs
reales encontrados y arreglados** (2 por la propia cadena, 1 por la purga integral de Cowork:
los `id_cliente` de la siembra de conectores estaban cruzados), 1 hallazgo de seguridad reportado en
proyectos vecinos, **4 flags apagados esperando tu validación al peso**, y `/exec` intacto.
