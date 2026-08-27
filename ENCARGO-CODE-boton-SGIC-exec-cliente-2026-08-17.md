# ENCARGO CODE — Botón SGIC → /exec del sistema del cliente · 17/08/2026

> **Obs de Luciano (17-ago):** el botón "Abrir el SGIC" de la Ficha 360 (solapa **Números**) hoy abre el **Google Sheet** del cliente (`url_sheet_cliente`). Debe abrir el **/exec (web app) del sistema propio de cada cliente** — el ingreso al SGIC de cada caso, no la hoja.
>
> **Regla Satori:** cambio ADITIVO + lista-contrato (grepear consumidores en el MISMO commit). Verificar con `_verificar_index.py` + harness + selfTest. Eyeball obligatorio.

## Estado actual (verificado en el repo, 17-ago)

- `src/01_schema.js:26` — roster `Clientes`: `['id_cliente','nombre','rubro','estado','url_sheet_cliente','responsable_lado_cliente','fecha_alta','etapa_comercial','logo_url','prox_accion','prox_accion_fecha','etapa_desde']`. **NO existe** columna de URL de sistema/exec.
- `src/08_webapp.js:~839-847` — el panel de cliente arma `cliente:{ ..., url_sheet_cliente: cli.url_sheet_cliente }` + `consumo_api: consumoApiCliente(cli.url_sheet_cliente)`. `cli` viene de `leerTabla('Clientes')` (mapea por header → aditivo seguro).
- `src/index.html`:
  - `f360Cabecera_` (~4804): `F360.sheetUrl=(c.url_sheet_cliente||'');`
  - reset (~3992): `F360.sheetUrl='';`
  - `f360Num_` (~4898-4903): botón `f360-sgic-btn` texto `▤ Abrir el SGIC del cliente` → `window.open(F360.sheetUrl,'_blank')`.
  - Además hay botón `f360Sheet` (~4810-4811) que abre `url_sheet_cliente` (cabecera/contexto) — **ese se deja como está** (acceso a la hoja).

## Cambios (3 archivos)

**1) `src/01_schema.js:26`** — agregar `'url_exec_cliente'` AL FINAL del array `Clientes` (después de `'etapa_desde'`). `ensureSheet` reconcilia headers aditivo; filas viejas quedan con la celda vacía (correcto).

**2) `src/08_webapp.js`** — en el objeto `cliente` del panel (~842), agregar `url_exec_cliente: cli.url_exec_cliente`. Revisar `fichaCliente()` (~891) por si arma otro objeto cliente que también alimente la solapa Números; propagar igual si corresponde. NO tocar `url_sheet_cliente` ni `consumo_api`.

**3) `src/index.html`**:
- `f360Cabecera_` (~4804): agregar `F360.execUrl=(c.url_exec_cliente||'');` junto a `sheetUrl`.
- reset (~3992): agregar `F360.execUrl='';`.
- `f360Num_` (~4898-4903): el botón "Abrir el SGIC" pasa a:
  - texto: `▶ Entrar al SGIC del cliente`
  - onclick: `window.open(F360.execUrl,'_blank')`
  - **guard nuevo**: crear el botón SOLO si `F360.execUrl` (si vacío → no renderizar; así los clientes sin sistema propio no muestran botón muerto).
- Aplicar `safeUrl(F360.execUrl)` antes de abrir (mismo blindaje que la línea 2321 hace con el sheet).

## Consumidores del schema `Clientes` a revisar en el MISMO commit (lista-contrato) — feedback de Code 18-ago

Agregar la columna toca a todos los que leen el roster por header. Puntos de contacto verificados por Code contra HEAD `70d0a0d`:
- `03_cliente.js` — `abrirCliente`/lectura de `url_sheet_cliente`.
- `04_sync.js` — `syncMaestro` arma `Aprobaciones_agregadas` con `url_sheet_cliente`.
- selfTest **D32a1** ("toda pestaña de `MAESTRO_ORDEN` tiene columnas en `MAESTRO_SHEETS`") + los asserts de lista-contrato.

Ninguno de esos **necesita** `url_exec_cliente` para funcionar (queda opcional, fallback vacío = botón oculto), pero el assert de schema debe quedar verde en el mismo commit. **No es un one-liner** — es el ciclo aditivo completo del roster.

## Bastión

- `url_exec_cliente` es una URL `/exec` pública, gateada por el propio SGIC de cada cliente (su gate de owner). No es endpoint del OS → **no** requiere alta en `ENDPOINTS_UI`.
- Validar formato: https + host `script.google.com` (usar `safeUrl`). No cargar URLs de otro dominio.

## Datos a cargar (Sheet MAESTRO · hoja Clientes · columna nueva `url_exec_cliente`)

Cargar celda×celda (patrón +41) las URLs `/exec` reales de cada sistema propio:
- **EJF (CLI-007)** — Oficina Galgo: `https://script.google.com/macros/s/AKfycbxkCje4RWhlb6-6ylCQ-MuuGVb4VrHZTdZgDAPPz8wmG9BWgy5LcZMtmZugpilt4LHN/exec` *(deploy id tomado del trigger "Galgo"; confirmar que sea el /exec vigente antes de cargar).*
- **DAM (CLI-004)** — Marketing Dashboard V28: pegar el `/exec` que ya tiene Alex.
- **LC Travel (CLI-003)** — SGIC LC Travel (@64/@65): pegar su `/exec`.
- **Vehemence (CLI-002)** — POS/sistema (@80): pegar su `/exec`.
- **MesaQuince (CLI-001), SIP (CLI-005)** — sin sistema propio → dejar vacío (botón oculto por el guard).

## Verificación

1. `python3 _verificar_index.py` (validador estructural).
2. Harness offline verde.
3. `selfTest()` en el editor sin fallos (incluido D32a1 y lista-contrato).
4. Eyeball: Ficha 360 de un cliente con `url_exec_cliente` cargada → solapa Números → botón "▶ Entrar al SGIC del cliente" abre su `/exec` en tab nuevo. Cliente sin URL → botón NO aparece.

*Encargo Cowork · 17/08/2026 (matiz de consumidores agregado 18-ago tras el diagnóstico de Code). Base verificada contra el repo real. Esfuerzo: S-M.*
