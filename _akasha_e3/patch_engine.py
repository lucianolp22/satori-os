#!/usr/bin/env python3
"""Porta el motor E113 del prototipo al CM: saca el mock, mete el dato real.

El motor NO habla con GAS: recibe H.acc (puente de acciones) del boot y llama
ahí. Un solo dueño por función — Akasha INVOCA los flujos del CM, no los copia.
"""
import sys, re

SRC, OUT = sys.argv[1], sys.argv[2]
s = open(SRC).read()
n_applied = 0


def sub(old, new, why):
    """Reemplazo exacto y verificado: si no matchea, aborta (no silencioso)."""
    global s, n_applied
    if old not in s:
        sys.exit(f'✗ NO MATCHEA ({why}):\n{old[:160]}')
    if s.count(old) != 1:
        sys.exit(f'✗ AMBIGUO ×{s.count(old)} ({why})')
    s = s.replace(old, new)
    n_applied += 1


# ── 1. Cabecera: r184 ESM -> window.THREE r128 del CM (decisión E2/A) ────────
sub("""   AKASHA · Motor 3D E1.6 (Three.js r184 pineado, import lazy)""",
    """   AKASHA · Motor 3D E3 (sobre el window.THREE r128 UMD que ya carga el CM)""",
    'cabecera')

# ── 2. "▶ Despertar" -> dispararAgenteUI real, con confirmación ─────────────
sub("""      b.id='pa-despertar'; b.className='btn btn-ghost'; b.textContent='▶ Despertar a '+a.nombre+' (mock)';
      b.addEventListener('click',()=>toast('En integración dispara la corrida real (dispararAgenteUI) con confirmación'),{once:false});""",
    """      b.id='pa-despertar'; b.className='btn btn-ghost'; b.textContent='▶ Despertar a '+a.nombre;
      b.addEventListener('click',()=>H.acc.despertar(a),{once:false});""",
    'despertar agente')

# ── 3. Panel del Espacio: pie honesto + OV real + Historial fail-closed ─────
sub("""      <div class="p-foot">Espacio mock · En E3: hoja del cliente + estadoVigenteCliente_ + Cerebro real</div>`;""",
    """      <div class="p-foot" id="p3-foot">Datos del MAESTRO · <span class="mono" style="font-size:10px">datosCliente()</span></div>`;""",
    'pie panel cliente')

sub("""    const bov=$('p3-ov'); if(bov) bov.addEventListener('click',()=>toast('En integración abre tu panel real de la Oficina Virtual (oficina_url de Config, tailnet — solo visible si hay URL, como en el CM)'));""",
    """    const bov=$('p3-ov'); if(bov) bov.addEventListener('click',()=>H.acc.abrirOV());""",
    'boton OV')

# El Espacio pide su detalle a demanda (no en el fetch inicial: 1 llamada por Espacio abierto).
sub("""    setStatus('Espacio de '+c.nombre+' — '+c.chip);""",
    """    setStatus('Espacio de '+c.nombre+' — '+c.chip);
    H.acc.detalleCliente(c, ()=>{ if(panel3.classList.contains('show') && panelAncla && panelAncla.el===panel3) mostrarPanelCliente(c); });""",
    'detalle cliente on-demand')

# ── 4. Historial del Espacio: sin mock. E5 construye la hoja Historial. ─────
sub("""  function mostrarHistorialCliente(c){
    const viejo=[['01/07','Informe mensual emitido y conversado'],['24/06','Reunión mensual — compromisos al día'],['12/06','Cierre de mes conciliado — OK'],['02/06','Ajuste de rumbo registrado en el Cerebro']];
    const filas=[...c.flujo, ...viejo].map(f=>""",
    """  function mostrarHistorialCliente(c){
    /* Sin mock: hoy solo existe lo que el feed real de Actividad sabe de este
       Espacio. La línea de tiempo larga llega en E5 (hoja Historial). */
    const filas=c.flujo.map(f=>""",
    'historial sin mock')

sub("""      <div class="p-foot">Mock · En E5: hoja Historial (snapshot diario) + historialCliente() — y el scrubber global del Clima Histórico</div>`;""",
    """      <div class="p-foot">Lo que el feed de Actividad registra de este Espacio. La línea de tiempo completa llega en E5 (hoja <span class="mono" style="font-size:10px">Historial</span> + <span class="mono" style="font-size:10px">historialCliente()</span>).</div>`;""",
    'pie historial')

sub("""      <div class="p-row"><div class="l">Todo lo que pasó acá</div>${filas}</div>""",
    """      <div class="p-row"><div class="l">Todo lo que pasó acá</div>${filas||'<div style="font-size:12.5px;color:var(--color-text-subtle);padding:6px 0">Sin actividad registrada para este Espacio.</div>'}</div>""",
    'historial vacio')

# ── 5. Panel del Núcleo: nodos reales del Cerebro ───────────────────────────
sub("""      <div class="p-foot">Datos mock · Cerebro real en E3</div>`;
    panelAncla={obj:nucleo, off:new THREE.Vector3(0,7.8,0), el:panel2};""",
    """      <div class="p-foot">Grafo real del Cerebro · <span class="mono" style="font-size:10px">cerebroGrafo()</span> por Espacio</div>`;
    panelAncla={obj:nucleo, off:new THREE.Vector3(0,7.8,0), el:panel2};""",
    'pie nucleo')

sub("""    <div class="p-row" style="font-size:12.5px;color:var(--color-text-muted)">Tocá un nodo para aislar su dimensión y leer su registro. Las tres dimensiones del Cerebro: la estructura, el sistema y vos.</div>""",
    """    <div class="p-row"><div class="l">Puntos ciegos</div><div>${DATA.akasha.filter(n=>n.alert).length} nodo(s) con cobertura &lt; 40</div></div>
      <div class="p-row" style="font-size:12.5px;color:var(--color-text-muted)">Tocá un nodo para aislar su dimensión. Las tres dimensiones del Cerebro: la estructura, el sistema y vos.</div>""",
    'puntos ciegos nucleo')

# ── 6. Panel de nodo: FAIL-CLOSED (decisión Luciano 17/07, opción 1) ────────
#   cerebroGrafo() devuelve {dim, alert} SIN etiquetas, a propósito (Bastión).
#   Se muestra dato real (dimensión · punto ciego · Espacio) y NADA inventado.
#   E3.5: cerebroNodo(idCliente, indice) para el detalle bajo demanda.
sub("""  function mostrarPanelNodo(i){
    const n=DATA.akasha[i], col=nodoColor(n);
    const b=$('panel2-body');
    b.innerHTML = `<div class="p-head"><div class="p-avatar" style="border-color:${col};box-shadow:0 0 18px -6px ${col}">◆</div>
      <div><div class="p-name">${n.t}</div><div class="p-role" style="color:${col};text-transform:uppercase;letter-spacing:.18em;font-size:10px;font-weight:700">${n.alert?'alerta · ':''}${n.dim} · registro akásico</div></div></div>
      <div class="p-row"><div class="l">Registro</div><div>${n.d}</div></div>
      <button class="btn btn-ghost" id="p2-volver">Ver toda la constelación</button>
      <div class="p-foot">Datos mock · Cerebro real en E3</div>`;""",
    """  function mostrarPanelNodo(i){
    const n=DATA.akasha[i], col=nodoColor(n);
    const cli=n.cli?DATA.clientes.find(c=>c.id===n.cli):null;
    const b=$('panel2-body');
    b.innerHTML = `<div class="p-head"><div class="p-avatar" style="border-color:${col};box-shadow:0 0 18px -6px ${col}">◆</div>
      <div><div class="p-name" style="font-family:var(--font-brand);text-transform:capitalize">${n.dim}</div><div class="p-role" style="color:${col};text-transform:uppercase;letter-spacing:.18em;font-size:10px;font-weight:700">${n.alert?'alerta · ':''}registro akásico</div></div></div>
      <div class="p-row"><div class="l">Dimensión</div><div style="text-transform:capitalize">${n.dim}</div></div>
      <div class="p-row"><div class="l">Cobertura</div><div>${n.alert?'<span style="color:var(--_red-400)">punto ciego — cobertura &lt; 40</span>':'cubierto'}</div></div>
      ${cli?`<div class="p-row"><div class="l">Espacio</div><div>${cli.nombre} <span class="mono" style="font-size:10.5px;color:var(--color-text-subtle)">${cli.ns}</span></div></div>`:''}
      <button class="btn btn-ghost" id="p2-volver">Ver toda la constelación</button>
      <div class="p-foot">El grafo del Cerebro no expone etiquetas (Bastión, por diseño): el bulk viaja anónimo. El detalle por nodo llega en E3.5 (<span class="mono" style="font-size:10px">cerebroNodo()</span>).</div>`;""",
    'panel nodo fail-closed')

# ── 7. Muelle: Aprobar/Rechazar -> flujo REAL del CM (default-deny) ─────────
sub("""      <div class="p-row"><div class="l">Detalle</div><div>${ap.detalle}</div></div>
      ${cli?`<div class="p-row"><div class="l">Espacio</div><div>${cli.nombre} <span class="mono" style="font-size:10.5px;color:var(--color-text-subtle)">${cli.ns}</span></div></div>`:''}
      <button class="btn btn-primary" data-d="ok">Aprobar (mock)</button>
      <button class="btn btn-ghost" data-d="no">Rechazar (mock)</button>
      <div class="p-foot">En integración esto opera tu Bandeja real — misma lógica fail-closed del OS</div>`;""",
    """      <div class="p-row"><div class="l">Detalle</div><div>${ap.detalle}</div></div>
      ${ap.monto?`<div class="p-row"><div class="l">Monto</div><div class="mono">${ap.monto}</div></div>`:''}
      ${cli?`<div class="p-row"><div class="l">Espacio</div><div>${cli.nombre} <span class="mono" style="font-size:10.5px;color:var(--color-text-subtle)">${cli.ns}</span></div></div>`:''}
      <button class="btn btn-primary" data-d="aprobada">Aprobar</button>
      <button class="btn btn-ghost" data-d="rechazada">Rechazar</button>
      <div class="p-foot">Opera tu Bandeja real — <span class="mono" style="font-size:10px">resolverAprobacionUI()</span>, default-deny y confirmación obligatoria.</div>`;""",
    'muelle botones')

sub("""    b.querySelectorAll('[data-d]').forEach(btn=>btn.addEventListener('click',()=>{
      toast('Decisión simulada. En E3 esto llama a tu Bandeja real (con confirmación obligatoria).');
    }));""",
    """    b.querySelectorAll('[data-d]').forEach(btn=>btn.addEventListener('click',()=>{
      H.acc.resolver(ap, btn.getAttribute('data-d'));
    }));""",
    'muelle handler')

# ── 8. Status central del Núcleo: texto real ───────────────────────────────
sub("""  const stN=texLabel('Todo al día. El equipo espera tus órdenes.', null, {size:15, color:'rgba(244,238,226,.92)', w:620});
  const stS=sprite(stN.tex, 8.6, 8.6/stN.ar); esfera.add(stS);               // status central (dato real en E3)""",
    """  const stN=texLabel(H.statusNucleo(), null, {size:15, color:'rgba(244,238,226,.92)', w:620});
  const stS=sprite(stN.tex, 8.6, 8.6/stN.ar); esfera.add(stS);               // status central — dato real (salud + decisiones)""",
    'status central')

# ── 9. FUGAS DE ID MOCK (las cazó el harness) ───────────────────────────────
# El Muelle se anclaba a estaciones['sato']: 'sato' era el id del director en el
# mock. En el roster real la clave es 'director' -> undefined.pos -> se caía al
# construir. Se ancla al que el roster marque director, con fallback.
sub("""  muelle.position.copy(estaciones['sato'].pos).add(new THREE.Vector3(7.5,3.4,3.5));""",
    """  const agDir = DATA.agentes.find(a=>a.director) || DATA.agentes[0];
  const anclaMuelle = (agDir && estaciones[agDir.id]) ? estaciones[agDir.id].pos : new THREE.Vector3(0,0,26);
  muelle.position.copy(anclaMuelle).add(new THREE.Vector3(7.5,3.4,3.5));""",
    'muelle: ancla al director real, no al id mock')

# El botón de la Oficina Virtual colgaba del id mock 'ov'. Real: se muestra solo
# si hay oficina_url en Config (igual que el CM) y en el Espacio del tenant OV.
sub("""      ${c.id==='ov'?'<button class="btn btn-primary" id="p3-ov">▦ Abrir el panel de la Oficina Virtual</button>':''}""",
    """      ${H.acc.esEspacioOV(c)?'<button class="btn btn-primary" id="p3-ov">▦ Abrir el panel de la Oficina Virtual</button>':''}""",
    'OV: condición real (oficina_url), no id mock')

open(OUT, 'w').write(s)
print(f'✓ {n_applied} parches aplicados')
for bad in ('mock', '(mock)', 'En integración', 'simulada'):
    c = s.count(bad)
    print(f'  {bad!r:18} restantes: {c}')
