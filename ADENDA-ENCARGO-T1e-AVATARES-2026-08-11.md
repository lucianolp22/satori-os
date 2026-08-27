# ADENDA al ENCARGO OBS — T1.e + avatares lab + correcciones de contexto · 11/08/2026 (tarde)

> Responde a la devolución de Code sobre T1 (`99245d7`). Buen trabajo el seed dry-run como default (patrón wrapper sin args) y la ortogonalidad `etapa_comercial`⊥`estado` — ambas decisiones quedan ratificadas.

## 0 · Correcciones de contexto (Code trabajó con foto vieja)

- **El promote YA ocurrió: `/exec` @41 (11-ago 13:15).** Secuencia completa corrida por Luciano.
- **Los 2 Altos de la Purga están CERRADOS con evidencia** (no «sin moverse»): #1 teardown verificado 2× por lectura read-only del MAESTRO vía Drive (0 CLI-008, 0 `__TEST__`, NS ok — incluso después del selfTest de 13:01) · #2 backup sano (09-ago, 8 archivos en carpeta, trigger instalado). **`purgaAuditoria()` ya NO es gate de nada** — correrla queda como registro opcional.
- ⚠ `cerebro_url` en Config: **verificar tras el setup() que viene** (el de 13:01 no la dejó visible en el export ~14:20 — puede ser lag del export o siembra que no corrió con HEAD nuevo; si tras el próximo setup() sigue faltando, diagnosticar). Valor útil para el iPhone: los otros loopback ya usan `https://lucianos-macbook-pro.tail4115b8.ts.net` — el grafo podría servirse igual vía Tailscale, decisión aparte (Bastión: hoy es loopback-only a propósito).

## 1 · T1.e — Casa para «próxima acción» (decisión tomada: SÍ)

Las 3 columnas que el encargo v2 listaba en T1.c y T1.a no autorizó: **agregarlas** con las mismas reglas (al final, lista-contrato, `ensureSheet` reconcilia, D42 no aplica):
- `prox_accion` (texto) · `prox_accion_fecha` (ISO) · `etapa_desde` (ISO — la escribe `moverEtapaComercial` en cada movimiento).
- La card pasa a mostrar `prox_accion` + fecha (y días-en-etapa desde `etapa_desde`). `rubro` vuelve a ser rubro real — el seed pone el «qué ofrecer» de la cartera v2 en `prox_accion` (p.ej. «Ofrecer SGIC + Web»), no en `rubro`.
- Señal pasiva del encargo v2 sigue vigente: 1 línea en el brief si hay `prox_accion_fecha` vencida (patrón `_vigLineasBrief_`). Nada más automático.
- Asserts: mover escribe `etapa_desde` · brief incluye línea con fecha vencida simulada · columnas nuevas al final (derivar del schema).

## 2 · SEED — los 14 Spreadsheets: **NO aplicar hasta decisión de Luciano**

Code señaló bien la consecuencia. **Recomendación de Cowork: ALTA LIVIANA para tibios** — fila en el roster con `url_sheet_cliente` VACÍO; el Sheet se crea recién cuando el candidato pasa a caliente/activo (alta real vía `crearCliente`).

**Por qué (segundo orden):** 14 Sheets de prospectos = +14 copias en CADA `backupSemanal` (crece semana a semana) + `syncMaestro`/vigilancia iterando tenants vacíos + ruido en Drive + basura si un tibio nunca avanza.

**Qué implica (Code, si Luciano aprueba):** `_seedCartera_` appendea filas al roster sin `crearCliente` para los tibios nuevos · **lista-contrato de `url_sheet_cliente`**: grep de consumidores que abren el Sheet (`abrirCliente`, sync, vigilancia, backup, hilo) y confirmar que una fila sin URL se saltea con motivo, no revienta · assert: tibio liviano no rompe `syncMaestro` ni `correrSalud` · `moverEtapaComercial` a `caliente`/`activo` sobre fila sin Sheet → avisa «falta alta real (crearCliente)».

**✅ DECIDIDO por Luciano (11-ago tarde): A — ALTA LIVIANA.** Code implementa los guards (lista-contrato `url_sheet_cliente`) y ajusta `_seedCartera_` ANTES de que se corra `Aplicar`. El dry-run actual (que lista 14 `crearCliente`) queda obsoleto: el nuevo dry-run debe listar 14 filas livianas.

## 3 · Avatares lab (E2) — arte GENERADO por Cowork, pendiente aprobación

8 PNGs 512×512 en `Avatares Satori/avatares-lab/` (+ fuentes SVG): `avatar_flux` (hexágono+rayo) · `avatar_relay` (nodos+ondas) · `avatar_scout` (retícula+aguja) · `avatar_prism` (prisma refractando) · `avatar_atlas` (globo) · `avatar_spark` (estrella 8 puntas) · `avatar_forge` (yunque+martillo) · `avatar_lift` (flecha sostenida). Mismo lenguaje que los existentes: emblema line-art terracota con glow, filigrana, cosmos verde-oscuro, destello inferior.

**✅ APROBADOS por Luciano (11-ago tarde).** Flujo decidido (mínima fricción, cero copiar IDs a mano):
1. **Luciano:** arrastrar los 8 PNG de `Avatares Satori/avatares-lab/` a la MISMA carpeta de Drive donde viven los avatares actuales (cuenta luciano@satoriconsultoria.com — 1 drag).
2. **Code:** función one-shot `seedAvataresLab()` (sin args, `_soloOwner_`, editor): busca por nombre `avatar_flux.png`…`avatar_lift.png` con `DriveApp.getFilesByName` (o dentro de la carpeta por Config `avatares_folder_id` si existe), arma `https://drive.google.com/thumbnail?id=<ID>&sz=w512` y setea las 8 claves Config `avatar_<clave>`. Idempotente: no pisa una clave ya cargada salvo flag. Reporta qué encontró/faltó.
3. **Code verifica** que órbita/chips del CM resuelvan avatar por clave para los 8 lab (el mapa E1.1 mezcla `avatar_url` por clave — confirmar que los lab pasan por ahí).
4. **Luciano:** correr `seedAvataresLab()` + eyeball del CM.

## 4 · En cancha de Luciano (orden, mínimo)

1. **`setup()`** en el editor — siembra columnas T1.a (+T1.e cuando Code las agregue) y re-intenta `cerebro_url`. Cura el rojo de `correrSalud`.
2. **`seedCartera2026_08_11()`** (dry-run) — leer la lista; **NO correr `Aplicar` todavía**.
3. **Decidir: seed liviana (A, recomendada) o 14 Sheets (B).**
4. **Aprobar (u observar) los 8 avatares lab** — grilla en el chat.
5. Tras la tanda T1.e de Code: `selfTestTramo5()`.
