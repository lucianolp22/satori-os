# Decisiones de diseño — 27/08/2026

## F11 · No-op documentado

**F11 («aplicar decay + trunks a la UI existente») se cierra como no-op.** No hay tercera superficie.

- La única superficie con freshness + trunks que existe es el **Cerebro** (`_cerebro/GRAFO.html`), y
  eso ya lo cubre **F10-a**.
- El **Orbe Persistente v2** y el **orbe del CM** están protegidos por la **regla +51**: la maqueta
  aprueba comportamiento, no reemplaza identidad visual. No se tocan.
- El **CRM Pro §2d** ya tiene sus propias señales de frescura en prod (`ultimo_contacto`, semáforo
  M3). Aplicarles decay encima sería **duplicar una señal existente**, que es exactamente lo que el
  gate anti-rollup del BLOQUE 4 prohíbe: antes de agregar una métrica, «¿qué haría distinto según
  este número?». Ya hay un número que responde eso.

Cerrada. No se ejecuta.

---

## F12 · Regla de diseño: **nunca renderizar lo que no está en la fuente de verdad**

> **Si una región de la pantalla no tiene dato real detrás, se dibuja el vacío con su nombre —
> «sin datos», «sin conector», «no cargado»— y NUNCA un andamio inventado.**
> Un placeholder que parece dato es indistinguible de un dato la semana siguiente.

Es la traducción a UI de **S1** (mock jamás). Vale para tablas, gráficos, tiles, grafos y cualquier
cosa que se pinte.

**Corolarios operativos**

1. **Cero relleno decorativo.** Ni filas de ejemplo, ni series sintéticas «para que se vea el
   gráfico», ni nodos de andamiaje. Si hay 3 clientes, se ven 3.
2. **El vacío se nombra y se distingue del cero.** «Sin datos» y «0» son cosas distintas y se
   dibujan distinto: una es ausencia de medición, la otra es una medición.
3. **Fail visibly.** Si la fuente cae, la pantalla lo dice. Nunca una página en blanco ni el último
   render cacheado haciéndose pasar por actual.
4. **Toda cifra declara su procedencia.** De qué hoja y de qué fecha. Si no se puede nombrar la
   fuente, la cifra no se pinta.

**Los dos precedentes que la fundan**

- **`null.isSheetHidden` (23-jul).** `CLIENTE_SHEETS_SENSIBLES` creció con tres hojas *lazy* que no
  existían en el cliente recién creado. El código asumió que la lista era subconjunto de
  `CLIENTE_ORDEN` — dibujó sobre algo que no estaba — y `getSheetByName` devolvió `null`. **Asumir
  que existe lo que no verificaste es la misma falla, del lado de los datos.**
- **Lección +51 (25-ago).** La maqueta del orbe (esfera lisa animada) fue rechazada: **aprobaba un
  comportamiento, no reemplazaba una identidad visual**. Un render bonito que no corresponde a lo
  que el sistema realmente es, es un render que miente. El orbe definitivo es fiel al Núcleo.

**Desvío declarado.** El encargo pide editar la skill `satori-design`. Esa skill vive en Cowork y
**no existe en el entorno CLI** (`~/.claude/skills/` sólo tiene `all-deploy` y `cyber-neo`). La
regla se deja acá, que es donde el repo la puede leer y donde `_drift_checker.sh` la vigila. Para
que quede en la skill hay que copiarla desde Cowork — cabo con dueño.
