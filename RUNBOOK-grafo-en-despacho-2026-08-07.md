# Grafo del Cerebro en el Despacho de Sato — plano de ejecución (opción B, reencuadrada)

> **Decisión (07/08):** botón en el Despacho de Sato → abre el grafo del Cerebro, **vivo 24/7 y fresco**.
> **Reencuadre:** en vez de subir el grafo a Drive/GAS (cruce a la nube), se usa el **patrón que el CM ya tiene** para el orbe de voz (`cmVoz` → `http://127.0.0.1:8787/`): un **server local en loopback** + botón `<a>` a localhost. El grafo **nunca sale de tu Mac**.

## Arquitectura (3 piezas)
1. **`grafo_server.py`** (ya en `_cerebro/_scripts/`) — sirve SOLO `GRAFO.html` en `http://127.0.0.1:8788/`, regenerándolo on-demand (cache 60s → siempre fresco al abrir).
2. **`com.satori.cerebro-grafo.plist`** — launchd que lo mantiene vivo 24/7 (RunAtLoad + KeepAlive), igual que la Oficina Virtual.
3. **Botón `<a>` en el Despacho de Sato** (index.html) — apunta a `http://127.0.0.1:8788/` con `target="_blank"`. Es la pieza GAS.

## 🛡️ Bastión — pleno corto (veredicto: VERDE con 2 controles)
- **🔑 Guardián de Accesos:** el server bindea **`127.0.0.1` SOLO** (loopback) — no `0.0.0.0`. No es alcanzable desde la LAN ni internet; solo tu propia máquina. Sin auth porque no hay superficie remota. **Control duro: nunca cambiar el HOST a `0.0.0.0`.**
- **🔎 Cazador de Vulnerabilidades:** sirve **un solo archivo** (ignora la ruta del request) → sin path-traversal al resto del vault; sin input del cliente que llegue a disco/shell; sin escritura. GET-only.
- **🗄️ Custodio de Datos:** el grafo muestra nombres de clientes/proyectos, pero **queda 100% local** (loopback) — cero nube, cero Drive, cero terceros. No cruza el límite que preocupaba. Verde.
- Frena solo si alguien: expone el puerto a la red, agrega escritura, o sirve el vault entero. Nada de eso está.

## PARTE A — Code (GAS · index.html)
Agregar el botón junto a los lanzadores de Sato (`cmVoz`/`cmSato`, ~línea 1218-1219) **o** dentro del panel de Sato, a criterio del Despacho. Espejo de `cmVoz`:
```html
<a class="cm-btn" id="cmGrafo" href="http://127.0.0.1:8788/" target="_blank" rel="noopener"
   title="Mapa del Cerebro — tus notas y su red (local)">🧠 Cerebro</a>
```
- Es un `<a>` estático: **sin endpoint, sin `google.script.run`, sin `_soloOwner_`** (no hay RPC ni dato server-side). Mismo perfil de riesgo que `cmVoz`.
- Assert opcional (si querés cobertura anti-drift): sumar en `_verificar_index.py` un check de que `id="cmGrafo"` y el `href` localhost existen. No es imprescindible.
- Verificación: `python3 _verificar_index.py` → `node _harness.js` → **`clasp push`** → smoke visual del botón → `git push` + `_promote_exec.sh` con OK de Luciano. **Se puede foldear en el próximo push de A** (es 1 línea, no compite con nada).

## PARTE B — Luciano (Mac · Terminal, una vez)
El server ya quedó en `_cerebro/_scripts/grafo_server.py`. Instalar el launchd:
```
cp ~/Documents/Claude/_cerebro/_scripts/com.satori.cerebro-grafo.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.satori.cerebro-grafo.plist
sleep 1
curl -s -o /dev/null -w "grafo server: HTTP %{http_code}\n" http://127.0.0.1:8788/
```
Esperás `HTTP 200`. Abrís `http://127.0.0.1:8788/` en el navegador para el eyeball. Si algún día no responde: `launchctl list | grep cerebro-grafo` (status 0 = ok) y `cat /tmp/cerebro-grafo.err`.

> Nota python3: el `.plist` usa `/usr/bin/python3` (el del sistema, alcanza — grafo.py es stdlib puro). Si tu `python3` real es de Homebrew, cambiá esa línea del plist por la ruta de `which python3`.

## Qué resuelve
- **"¿vivo 24/7?"** → sí: el launchd mantiene el server arriba; on-demand regen = fresco cada vez que abrís.
- **"¿botón en el Despacho de Sato?"** → sí, mismo patrón que "Hablar con Sato", sin tocar el modelo de datos ni cruzar a la nube.
- Los Orbes actuales quedan intactos; esto solo suma un lanzador más.
