# F2b · Salud del Cerebro viviente — 27/08/2026

> Bloque A del `ENCARGO-CODE-SATO-VIVIENTE-2026-08-27.md`. Dos capas distintas comparten el nombre
> «Cerebro» y el encargo las mezcla: se separan acá.

| Capa | Qué es | Estado |
|---|---|---|
| **Cerebro-vault** (`~/Documents/Claude/_cerebro/`) | grafo de wikilinks sobre los `.md`, servido por `grafo_server.py` en 127.0.0.1:8788 | **medido en esta sesión** |
| **Cerebro-GAS** (`15_cerebro.js`, hojas `cerebro_*` por tenant) | nodos/aristas/`cerebro_log` multi-tenant que alimentan `estadoVigente(id)` | **no medible headless** — ver §4 |

---

## §1 · F2a · Servidor del grafo: corregido y verificado

El encargo (PC-1) daba el servidor por caído. **No lo estaba**: `com.satori.cerebro-grafo` ya estaba
cargado bajo launchd desde el 17-ago (`runs = 1`, `never exited`, 200 en loopback). Lo que sí había
eran dos defectos reales, ambos arreglados:

1. **Los logs iban a `/tmp`** (`/tmp/cerebro-grafo.{log,err}`) y **no existían**: macOS purga `/tmp`,
   así que el diagnóstico de cualquier caída se perdía. Movidos a
   `~/Library/Logs/satori-grafo-server.{out,err}.log`, como pedía el encargo. Verificado: el `out`
   ya tiene contenido, el `err` está en 0 bytes.
2. **La instalación era manual y no reproducible** — el plist vivía sólo en el disco de Luciano, sin
   instalador en ningún repo. Ahora existe `scripts/install-grafo-launchd.sh` (idempotente, con
   `--check` y `--force`). Verificado: 1ª corrida reinstala, 2ª corrida es no-op.

### Desvíos declarados respecto del encargo §F2a

| El encargo pedía | Se hizo | Por qué |
|---|---|---|
| Crear `voz/launchagents/com.satori.grafo-server.plist` | **No.** Se reusa el plist canónico `_cerebro/_scripts/com.satori.cerebro-grafo.plist` | Ya existía y apunta al script que levanta. Un 2º plist con otro Label para el mismo servicio = dos fuentes de verdad y dos jobs peleando por el puerto 8788 |
| `Program=/usr/bin/python3` | **No.** `/opt/homebrew/bin/python3.12` | El propio plist documenta el motivo: bajo launchd, el python de CommandLineTools **no tiene el permiso TCC de `~/Documents`** y muere con «Operation not permitted» antes de abrir el script. Seguir el encargo al pie de la letra rompía el servicio |
| `kill -9` → resucita en <5 s | **No corrido** | El clasificador de permisos bloqueó el `kill -9`. Lo que sí se probó: el ciclo `bootout` + `bootstrap` del instalador levantó el proceso de nuevo (PID 1058 → 2753) y contestó 200. `KeepAlive=true` está en el plist y `plutil -lint` da OK, pero **la rama KeepAlive nunca se ejercitó** (`runs = 1`, `never exited`) — verde con asterisco |

**Rollback:** `launchctl bootout gui/$(id -u)/com.satori.cerebro-grafo`.
Copia previa del plist: `_cerebro/_scripts/com.satori.cerebro-grafo.plist.bak-2026-08-27`.

---

## §2 · Tamaño y forma del grafo

**996 nodos · 1.164 aristas · 34 grupos · 42 MOCs.** Grado medio 3,81; máximo 272.

> El objetivo de rendimiento de F10 («<2 s con 500 nodos») está calibrado a **la mitad** del grafo real.

| Grupo | Nodos | | Grupo | Nodos |
|---|---:|---|---|---:|
| Handoffs | 245 | | POLTRAIN | 22 |
| SatoriOS | 158 | | Equipo de Agentes Pro | 20 |
| Vehemence | 138 | | Oportunidades en desarrollo | 17 |
| LC Travel | 56 | | Scheduled | 13 |
| Videos analizados | 53 | | oficina-virtual / MesaQuince | 11 c/u |
| DAM Barber Shop | 47 | | Bastión Satori / Skills | 10 c/u |
| SATORI · consultoría | 42 | | Taller / Copiadas de Claude Code | 9 c/u |
| `_cerebro` | 42 | | *(otros 16 grupos)* | ≤7 |
| Figueras Music | 39 | | | |

**Hubs reales** (los que el grafo debería destacar):

| Grado | Nodo |
|---:|---|
| 272 | `_cerebro/MOC - Satori OS.md` |
| 261 | `…/Equipo de Agentes Pro/EQUIPO/knowledge/transversal-ia.md` |
| 206 | `…/knowledge/agentes-satori-os.md` |
| 176 | `_cerebro/MOC - Vehemence.md` |
| 166 | `…/knowledge/d7-desarrollo.md` |

---

## §3 · Warnings

### ⚠ W1 — 229 nodos huérfanos (23,0% del grafo)

Casi 1 de cada 4 archivos indexados **no tiene un solo wikilink**, ni de entrada ni de salida. El
grafo ya trae un toggle (`soloC`) para esconderlos, o sea que el síntoma es conocido y se tapa en la
UI en vez de tratarse. Un nodo huérfano es un archivo que el Cerebro indexó pero que nadie puede
alcanzar navegando — que es exactamente lo que el Cerebro existe para evitar.

**No es un bug del renderer: es deuda de curaduría del vault.** Sale de la lista de huérfanos, no de
un cambio de código.

### ⚠ W2 — El vault está frío, y el grafo no lo muestra

Frescura real, leída del `mtime` de los 996 archivos (los 996 resuelven en disco, 0 faltantes):

| Ventana | Archivos tocados | % |
|---|---:|---:|
| últimas 24 h | 16 | 1,6% |
| últimos 7 d | 61 | 6,1% |
| últimos 30 d | 292 | 29,3% |
| últimos 90 d | 983 | 98,7% |

Mediana de edad **49 días**, p90 76 días, máximo 128.

**El grafo no representa nada de esto.** El esquema de nodo que emite `grafo.py:41` es
`{id, label, group, moc, deg}` — **sin fecha**. Un archivo de hoy y uno de hace 4 meses se dibujan
idénticos. Esto es precisamente lo que el `freshness decay` de F10 (§10-B) vendría a resolver, y es
la razón por la que **hay que tocar `grafo.py` antes que el renderer** (ver F2c §3).

### ⚠ W3 — El bucle de render nunca se detiene

`draw()` se re-agenda con `requestAnimationFrame(()=>{step();draw()})` **incondicionalmente**. La
simulación física sí se apaga (`alpha *= 0.995`, corta bajo 0,005 ≈ 17 s), pero el redibujo de 996
nodos + 1.164 aristas con `shadowBlur` sigue a 60 fps **para siempre**, aunque la pestaña esté
quieta y nada haya cambiado. Con el Cerebro abierto de fondo, es ventilador y batería gratis.

Arreglo barato (1 línea, fuera de Bloque A): sólo re-agendar si `alpha >= 0.005`, hay hover/drag/pan,
o cambió el filtro. Es más valioso que cualquier ítem visual de F10.

---

## §4 · Lo que NO se pudo medir (cabo con dueño)

F2b pedía, **por tenant** (CLI-000, CLI-002, CLI-003, LC Travel, DAM): llamar `estadoVigente(id)`,
contar `nodos`/`aristas`/`cerebro_log`, verificar evento del último día, y simular
`_satoDatos_('CLI-002','cerebro',…)`.

**No es ejecutable headless.** Todo eso lee hojas de Google Sheets; `clasp run` está muerto por
scopes excluyentes (memoria `gas-runtime-verif-no-headless`). Requiere el editor de Apps Script.

**Queda para Luciano, en una sola pasada del editor** — junto al `selfTestTramo6()` que ya debe:

```
estadoVigente('CLI-000'); estadoVigente('CLI-002'); estadoVigente('CLI-003');
```

y mirar, por cada uno, si el `cerebro_log` tiene un evento de los últimos 7 días.
**Criterio de alarma del encargo:** tenant sin eventos > 7 días ⇒ Director dormido.

---

*Claude Code · 27/08/2026 · rama `feat/sato-viviente` · F2a y F2b (capa vault) del Bloque A.*
