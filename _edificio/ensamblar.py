#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ensambla src/edificio.html con las partes extraidas de v4 + el envoltorio del seam."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import _partes as partes

OUT = pathlib.Path('/Users/lucianopablolp/Documents/Claude/Projects/SatoriOS/src/edificio.html')

CABECERA = """<!-- ═══════════════════════════════════════════════════════════════════════════════
     edificio.html — EL EDIFICIO SATORI · modulo LAZY de la escena de Akasha
     Generado desde AKASHA-EDIFICIO-v4.html (maqueta certificada por render, Cowork 10-ago-2026)
     por _edificio/extraer.py + _edificio/ensamblar.py.
     NO EDITAR A MANO: se regenera con `bash _gen_edificio.sh` (y ese script corre el harness).

     QUE ES. La torre de 8 plantas que cuelga DEBAJO del universo de Akasha. No es una vista
     aparte ni un segundo modo: es la MISMA escena, el MISMO renderer y el MISMO loop. Bajas del
     orbe y estas en el Edificio. (Correccion de concepto de Luciano, adenda del 10-ago: no hay
     toggle; el Edificio ES el Akasha nuevo.)

     COMO SE ENGANCHA. Todo entra por `window.__AK_EXT`, la unica costura abierta en la clausura
     de `__buildAkashaEngine`. Este archivo NO crea renderer, ni escena, ni camara, ni loop, ni
     listeners de canvas: los toma prestados. Asi se cumple por construccion el invariante del
     gate E2 (index.html L6439): renderer propio del canvas #gl, un solo loop de render a la vez.

     COMO SE CARGA. No esta inlineado en index.html a proposito: index ya pesa ~960KB y esto suma
     ~300KB (240KB son los avatares base64). Inlinearlo le cobraria ese peso a cada carga del
     Centro de Mando, entres o no al Edificio — justo el TTFP que afino E3.7. Lo sirve
     `moduloEdificio()` (32_flota.js) y el hook lo pide la primera vez que se desciende.

     LO QUE SE DESCARTO DE v4 Y POR QUE:
       · renderer / escena / camara / domo / polvo / env PMREM / luces base → los pone Akasha.
       · el UNIVERSO de v4 (orbe + anillo + 7 clientes demo) → Akasha YA lo dibuja con
         `listaClientes` real. Duplicarlo seria inventar una cartera al lado de la verdadera.
         Del bloque solo sobrevive el HAZ conector, que si es nuevo.
       · los listeners de pointer/wheel/touch → los de Akasha ya cubren orbita y zoom; el modulo
         solo suma el descenso vertical.
       · las sombras (`shadowMap.enabled`) → encenderlas en el renderer COMPARTIDO recompila los
         materiales de todo el universo y agrega un pase por luz. Los `castShadow` de los meshes
         quedan inertes, sin costo. Si algun dia se encienden, se mide antes.
     ═══════════════════════════════════════════════════════════════════════════════ -->
<style id="ediStyle">
%(CSS)s
/* ── Capa propia del modulo. Vive a nivel <body>, hermana de #akasha (z-index 200), NUNCA
   dentro de #centro: #centro es position:fixed con z-index:50, o sea que CREA stacking context
   y encapsularia todo lo de adentro por debajo de 50 (precedente Sato vs Akasha, 04-ago). Como
   ademas #ediRoot lleva sus propios tokens arriba, no sufre el corolario de perder el tema al
   salir del scope de #centro. ── */
#ediRoot{position:fixed;inset:0;z-index:210;pointer-events:none;display:none;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--text);font-size:var(--tx-base);line-height:1.5;-webkit-font-smoothing:antialiased}
#ediRoot.on{display:block}
#ediRoot>*{pointer-events:auto}
#ediRoot .e-tip{pointer-events:none}
</style>

<div id="ediRoot" aria-hidden="true">
  <nav class="e-dir" id="ediDir" aria-label="Directorio de plantas"></nav>
  <div class="e-viewbar">
    <button id="ediExplode">&#8661; Expandir torre</button>
    <button id="ediReset">&#9678; Subir al Universo</button>
  </div>
  <div class="e-tip" id="ediTip"></div>
  <aside class="e-panel" id="ediPanel" aria-label="Planta seleccionada"></aside>
  <div class="e-scrim" id="ediScrim"></div>
  <div class="e-dash" id="ediDash" role="dialog" aria-modal="true" aria-label="Ficha del agente"></div>
</div>

<script>
/* eslint-disable */
(function(){
'use strict';
var EXT = window.__AK_EXT;
if(!EXT){ try{console.warn('[Edificio] __AK_EXT ausente: el modulo no se monta');}catch(_){} return; }
if(window.__EDIFICIO){ return; }              /* idempotente: cargarlo 2x no duplica la torre */

var THREE=EXT.THREE, renderer=EXT.renderer, scene=EXT.scene, camera=EXT.camera, canvas=EXT.canvas;
var REDUCED=!!EXT.reducedMotion, QUAL=EXT.isMobile?'low':'high';

/* ── ESCALA. v4 se dibujo ~5.7x mas grande que Akasha (torre W=240 y clientes en R=225, contra
   R=22 del anillo de estaciones y RC=40 de los Espacios de Cliente). La torre entra escalada por
   EDI.K, no reescribiendo 900 lineas de constantes. Lo que NO puede ir dentro del grupo escalado:
   las luces — el frustum de sombra de un DirectionalLight y el `distance` de un PointLight se
   interpretan en espacio de MUNDO y no heredan la escala del padre.
   Afinador en vivo (mismo patron que akEncuadre): en la consola -> ediEncuadre(k, techo).      */
var EDI = { K:0.175, TECHO:-26 };             /* TECHO = y del piso 8 (el mas alto de la torre) */
%(DATOS)s

%(TEXTURAS)s

%(BASE)s

%(CONSTRUCT)s

%(PISOS)s

/* ── Layout de la torre (portado de v4, sin la parte del universo: ese lo pone Akasha). Reparte
   los pisos segun el gap vigente y estira el nucleo dorado para que los acompañe. ── */
function layoutTower(){
  PISOS.forEach(function(p,i){ floorGroups[i].position.y=(p.id-1)*gapCur; });
  var h=8*gapCur+44;
  core.scale.y=h/COREH; coreBeam.scale.y=h/COREH; coreGlow.position.y=h*0.55;
  /* coreLight vive FUERA del grupo escalado (ver nota de escala): su posicion va en mundo. */
  if(coreLight) coreLight.position.set((CORE_X-10)*EDI.K, tower.position.y + 4*gapCur*EDI.K, 50*EDI.K);
}

/* ── Ubicacion: la torre cuelga del universo. Alto real = 8 pisos * GAP * K. ── */
var ALTO_TORRE = 8*GAP*EDI.K;
function ubicarTorre(){
  tower.scale.setScalar(EDI.K);
  tower.position.set(0, EDI.TECHO - ALTO_TORRE, 0);   /* base abajo, techo en EDI.TECHO */
  if(coreLight) coreLight.distance = 900*EDI.K;       /* el `distance` no hereda escala del padre */
  /* Cuánto se puede bajar con shift+arrastrar. El engine no sabe cuánto mide la torre: se lo dice
     el módulo. Un poco más abajo de la planta baja, para que el lobby no quede pegado al borde. */
  EXT.nav.ovYMin = EDI.TECHO - ALTO_TORRE - 6;
}

/* ── Luces propias del Edificio. Fuera del grupo (ver nota de escala) y sin sombras (ver
   cabecera). Se suman a las de Akasha: el universo de arriba no cambia de aspecto. ── */
var sun = new THREE.DirectionalLight(0xffeeda, 0.85);
sun.position.set(60, 40, 42);
var rim = new THREE.DirectionalLight(0x4FB89C, 0.22);
rim.position.set(-66, 20, -56);
var coreLight = new THREE.PointLight(0xD4A857, 1.2, 900*EDI.K, 1.8);
var extras = new THREE.Group(); extras.add(sun, rim, coreLight);   /* sin escala: luces + haz */

/* ── Haz dorado que cose el orbe con la torre: continuidad del Cerebro, no adorno. Arranca bajo
   el Nucleo de Akasha (y=10) y baja hasta el techo de la torre. ── */
var beamLen = Math.max(2, 6 - EDI.TECHO);
var univBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.5, 1.5, 1, 16, 1, true),
  new THREE.MeshBasicMaterial({color:0xD4A857, transparent:true, opacity:0.13,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
function ubicarHaz(){
  beamLen = Math.max(2, 6 - EDI.TECHO);
  univBeam.scale.y = beamLen;
  univBeam.position.set(0, 6 - beamLen/2, 0);
}

/* ── CAMARA. No hay sistema de camara propio: se conduce el `nav` de Akasha por el seam. El
   descenso es `nav.ovY` (offset vertical del centro de orbita, 0 = universo). Con ovY=0 el
   comportamiento del overview es identico al de hoy — el Edificio no cambia como se ve arriba. */
var Y_PISO_1 = EDI.TECHO - ALTO_TORRE;
function yDePiso(pid){ return Y_PISO_1 + (pid-1)*GAP*EDI.K*(gapCur/GAP); }
function focusUniverse(){ EXT.navOverview({ovY:0, radio:58, alt:18}); }
function focusFloor(pid){ EXT.navOverview({ovY:yDePiso(pid)+4, radio:30, alt:7}); }
function setCutaway(pid){ floorGroups.forEach(function(fg,i){ fg.visible = !(pid!==null && PISOS[i].id>pid); }); }

/* ── DOM. Los nodos ya estan en el markup de arriba (dentro de #ediRoot); acá solo se toman las
   referencias que el bloque portado de v4 espera encontrar. ── */
var ediRoot=document.getElementById('ediRoot');
var tip=document.getElementById('ediTip');
var hovered=null;
function crumb(s){ if(EXT.setCrumb) EXT.setCrumb(s); }
/* La cartera del panel del Universo NO se inventa: sale de la misma `listaClientes` que dibuja
   los Espacios de Cliente de Akasha. Si el seam no la expone, se dice — no se rellena. */
function carteraReal(){
  var cs = (EXT.clientes && EXT.clientes()) || [];
  if(!cs.length) return '<div class="e-agent" style="cursor:default"><span class="e-rl">'+
    'La cartera todav\\u00eda no lleg\\u00f3 del server.</span></div>';
  return cs.map(function(c){
    var st = c.estado==='activo'||c.estado==='activo-piloto' ? 'g' : (c.estado==='pausado'?'y':'b');
    return '<div class="e-agent" style="cursor:default"><span class="e-nm"><span class="e-st '+st+
      '"></span>'+esc(c.nombre||'')+'</span><span class="e-rl">'+esc(c.id||'')+
      ' \\u00b7 Espacio de Cliente</span></div>';
  }).join('');
}
%(DOMJS)s

/* ── Picking: se cuelga del raycaster de Akasha; no hay un segundo raycaster ni segundos
   listeners. Akasha rutea por `userData.tipo`; los hits del Edificio viajan con tipo 'edi'. ── */
pickFloors.forEach(function(o){ o.userData={tipo:'edi', edi:'piso', pid:o.userData.pid}; });
pickAgents.forEach(function(o){ o.userData={tipo:'edi', edi:'agente', pid:o.userData.pid, idx:o.userData.idx}; });
EXT.addHits(pickFloors.concat(pickAgents));
EXT.onPick(function(u){
  if(!u || u.tipo!=='edi') return false;
  if(u.edi==='agente'){ var p=PISOS.filter(function(x){return x.id===u.pid;})[0];
    selectFloor(u.pid,false); openDash(p, p.ags[u.idx]); return true; }
  selectFloor(u.pid); return true;
});
EXT.onHover(function(u, x, y){
  if(!u || u.tipo!=='edi'){ tip.style.display='none'; return false; }
  var p=PISOS.filter(function(z){return z.id===u.pid;})[0]; if(!p) return false;
  tip.style.display='block';
  tip.style.setProperty('--tc', CSSC[p.c]);
  tip.style.left=Math.min(x+14, innerWidth-230)+'px';
  tip.style.top=(y+14)+'px';
  if(u.edi==='agente'){ var a=p.ags[u.idx];
    tip.innerHTML='<b>'+esc(a.n)+'</b><br><span>'+esc(a.r)+' &middot; '+ST_LABEL[a.st]+'</span>'; }
  else tip.innerHTML='<b>P'+p.id+' &middot; '+esc(p.nom)+'</b><br><span>'+esc(p.tag)+'</span>';
  return true;
});

/* ── DATOS REALES: el semaforo de la torre lo manda el server, no el roster estatico.
   `flotaEstado()` (32_flota.js) es un lector puro de la flota PROPIA de Satori — ni una hoja de
   tenant. Los 68 del roster son mayormente persona-skills sin runtime: a esos NO se les inventa
   un estado, se quedan con el suyo. Solo se pisan los que tienen clave real. ── */
var EDI_RUNTIME = {
  'Sato':'sato', 'Director':'director', 'Admin propia':'admin', 'Salud':'salud',
  'Bandeja':'bandeja', 'Cerebro':'cerebro', 'Vigilancia':'vigilancia',
  'Conectores':'conectores', 'Lift (retenci\\u00f3n)':'lift'
};
var FLOTA = null;
function aplicarFlota(f){
  if(!f) return;
  FLOTA=f;
  var porClave={};
  (f.runtime||[]).concat(f.modulos||[]).forEach(function(r){ porClave[r.clave]=r; });
  PISOS.forEach(function(p){ p.ags.forEach(function(a){
    var k=EDI_RUNTIME[a.n]; if(!k) return;
    var r=porClave[k]; if(!r) return;
    a.st=r.estado; a._k=k; a._live=r;          /* _live: procedencia para el panel y el dash */
    if(a._unit) pintarUnidad(a);
  }); });
  if(SEL!==null){ var p=PISOS.filter(function(x){return x.id===SEL;})[0]; if(p) renderPanel(p); }
}
function pintarUnidad(a){
  var u=a._unit&&a._unit.userData?a._unit.userData:a._unit; if(!u) return;
  var col=ST_HEX[a.st]||ST_HEX.b;
  if(u.hglow&&u.hglow.material&&u.hglow.material.color) u.hglow.material.color.setHex(col);
  if(u.halo&&u.halo.material&&u.halo.material.color) u.halo.material.color.setHex(col);
}
function cargarFlota(){
  if(!EXT.rpc) return;
  EXT.rpc('flotaEstado', [], function(f){ aplicarFlota(f); }, function(){ /* sin datos: el roster
    estatico se queda como esta y el panel lo dice; no se pinta un verde falso */ });
}

/* ── DASHBOARD CON DATOS REALES (encargo §4: on-demand, NO preload).
   El dash que trae la maqueta muestra KPIs ilustrativos, y lo dice. Para los agentes que TIENEN
   runtime se pide `agenteDetalle(clave)` al abrirlo — nunca antes: son 68 agentes y precargarlos
   seria 68 lecturas de Sheets para mirar uno. Los que no tienen runtime (las persona-skills del
   Circulo, el Consejo, Equipo Pro, Bastion) NO llaman al endpoint: no tienen nada que leer, y su
   ficha estatica ya dice lo que se sabe de ellos. Mejor un panel que admite "no consume hasta que
   se lo convoca" que uno que inventa una metrica. ── */
function _kpi(lb, val, det, dir){
  return '<div class="e-kpi"><span class="e-lb">'+esc(lb)+'</span><b>'+esc(val)+
         '</b><span class="e-dl e-'+(dir||'fl')+'">'+esc(det)+'</span></div>';
}
function pintarDetalleReal(a, d){
  if(!d) return;
  var caja=dash.querySelector('.e-kpis');
  if(caja){
    var costo = d.costoMes && d.costoMes.usd ? ('$'+d.costoMes.usd.toFixed(2)) : '$0.00';
    var ult   = d.ultimaCorrida || 'sin registro';
    var cupo  = d.cupo ? (d.cupo.usado+'/'+d.cupo.max) : '—';
    caja.innerHTML =
      _kpi('Corridas 30d', String(d.corridas30d), 'hoja Actividad', d.corridas30d?'up':'fl') +
      _kpi('Última corrida', ult, d.diasDesdeCorrida==null?'nunca registrada':('hace '+d.diasDesdeCorrida+'d'), d.diasDesdeCorrida===0?'up':'fl') +
      _kpi('Costo del mes', costo, 'Costos_API · '+(d.costoMes?d.costoMes.mes:''), 'fl') +
      (d.tipo==='runner'
        ? _kpi('Cupo diario', cupo, d.cupo&&d.cupo.ok?'dentro del cupo':'cupo alcanzado', d.cupo&&d.cupo.ok?'up':'fl')
        : _kpi('Tipo', 'Módulo', d.rol||'', 'fl'));
  }
  /* El pie deja de ser un descargo genérico y pasa a declarar de dónde salió cada número
     (regla §7 del aislamiento: una cifra sin procedencia no se muestra). */
  var pie=dash.querySelector('.e-d-demo');
  if(pie && d.fuentes){
    pie.innerHTML = '<b>Datos reales</b> · corridas: '+esc(d.fuentes.corridas)+
      ' · costo: '+esc(d.fuentes.costo)+(d.fuentes.cupo?(' · cupo: '+esc(d.fuentes.cupo)):'')+
      '. El pulso y el mix de abajo siguen siendo ilustrativos.';
  }
}
var _openDashBase = openDash;
openDash = function(p, a){
  _openDashBase(p, a);
  if(!a || !a._k || !EXT.rpc) return;      /* persona-skill: sin runtime, no hay nada que pedir */
  EXT.rpc('agenteDetalle', [a._k], function(d){
    /* Puede haber cerrado el dash o abierto otro mientras volvía: solo pinta si sigue siendo éste. */
    if(!dash.classList.contains('e-open')) return;
    try{ pintarDetalleReal(a, d); }catch(e){ try{console.error('[Edificio] detalle',e);}catch(_x){} }
  }, function(){ /* sin datos: quedan los KPIs de la ficha estática, que ya se declaran ilustrativos */ });
};

/* ── POST cinematografico. Detras de flag con rollback instantaneo (adenda §5): cambia
   `outputEncoding` y `toneMapping` del renderer COMPARTIDO, o sea que le toca la cara al universo
   de arriba tambien. Arranca APAGADO hasta que Luciano lo mire; se prende con
   `ediPost(true)` o localStorage `ak_post=1`. ── */
var POSTFX=null, postOn=false, _encPrev=null, _tmPrev=null;
function construirPost(){
  if(POSTFX) return POSTFX;
%(POST_INDENT)s
  POSTFX = POST; return POSTFX;
}
function ediPost(on){
  on=!!on;
  if(on===postOn) return postOn;
  if(on){
    construirPost();
    _encPrev=renderer.outputEncoding; _tmPrev=renderer.toneMapping;
    renderer.outputEncoding=THREE.LinearEncoding;   /* el shader final hace ACES + sRGB */
    renderer.toneMapping=THREE.NoToneMapping;
    POSTFX.setSize();
    EXT.setRenderHook(function(scn,cam){
      POSTFX.setFocus(cam.position.distanceTo(EXT.nav.look));
      POSTFX.render(scn,cam);
    });
  } else {
    EXT.setRenderHook(null);
    if(_encPrev!=null) renderer.outputEncoding=_encPrev;
    if(_tmPrev!=null) renderer.toneMapping=_tmPrev;
  }
  postOn=on;
  try{ localStorage.setItem('ak_post', on?'1':'0'); }catch(_e){}
  return postOn;
}

/* ── FRAME. Una funcion por cuadro dentro del loop de Akasha: no hay segundo requestAnimationFrame
   (invariante del gate E2). Se salta entero si la torre no se esta viendo. ── */
var _t=0, EASE=REDUCED?1:0.085;
var posAttr=core.geometry.attributes.position;
function frame(dt){
  _t+=dt;
  if(Math.abs(gapDes-gapCur)>0.01){ gapCur+=(gapDes-gapCur)*EASE; layoutTower(); ubicarTorre(); }
  if(REDUCED) return;
  for(var i=0;i<NP;i++){
    var y=posAttr.array[i*3+1]+0.35+cs[i]*0.3;
    if(y>COREH) y=-8;
    posAttr.array[i*3+1]=y;
  }
  posAttr.needsUpdate=true;
  core.rotation.y=_t*0.25;
  SCREEN_T.jade.offset.y=(_t*0.05)%%1;
  SCREEN_T.warn.offset.y=(_t*0.033)%%1;
  SCREEN_T.info.offset.y=(_t*0.02)%%1;
  floorGroups.forEach(function(fg){ if(fg.userData&&fg.userData.holo) fg.userData.holo.rotation.y=_t*0.5; });
}

/* ── MONTAJE. `ubicarTorre` primero: `layoutTower` lee `tower.position.y` para colocar la luz
   del nucleo, asi que la torre tiene que estar ya en su sitio.
   El haz va al grupo SIN escalar (no a `tower`): sus dos extremos son coordenadas de MUNDO — el
   Nucleo de Akasha en y=10 y el techo de la torre —, y dentro de un grupo escalado por 0.175 y
   corrido 100 unidades hacia abajo no apuntarian a ninguno de los dos. ── */
ubicarTorre(); layoutTower(); ubicarHaz();
extras.add(univBeam);
EXT.addGroup(tower);
EXT.addGroup(extras);
EXT.onFrame(frame);
ediRoot.classList.add('on');
ediRoot.setAttribute('aria-hidden','false');
cargarFlota();
try{ if(localStorage.getItem('ak_post')==='1') ediPost(true); }catch(_e){}

/* Afinador en vivo, mismo contrato que akEncuadre: devuelve los numeros para pegarlos al codigo. */
window.ediEncuadre=function(k, techo){
  if(k!=null) EDI.K=+k;
  if(techo!=null) EDI.TECHO=+techo;
  ALTO_TORRE=8*GAP*EDI.K; Y_PISO_1=EDI.TECHO-ALTO_TORRE;
  ubicarTorre(); ubicarHaz();
  try{console.log('[Edificio encuadre] k='+EDI.K+'  techo='+EDI.TECHO+'  <- pasame estos 2 numeros');}catch(_e){}
  return {k:EDI.K, techo:EDI.TECHO};
};
window.ediPost=ediPost;
window.__EDIFICIO={
  PISOS:PISOS, selectFloor:selectFloor, selectUniverse:selectUniverse,
  /* Abrir una ficha por indice: lo usa el harness y deja la puerta para navegar por teclado sin
     tener que raycastear (el 3D no puede ser el unico camino a un dato). */
  openDash:function(pid, i){ var p=PISOS.filter(function(x){return x.id===pid;})[0];
                             if(p && p.ags[i]) openDash(p, p.ags[i]); },
  refrescar:cargarFlota, post:ediPost,
  _counts:function(){ return {pisos:floorGroups.length, hitsPiso:pickFloors.length,
    hitsAgente:pickAgents.length, agentes:PISOS.reduce(function(n,p){return n+p.ags.length;},0)}; },
  destroy:function(){
    ediPost(false);
    EXT.removeGroup(tower); EXT.removeGroup(extras);
    EXT.offFrame(frame); EXT.removeHits(pickFloors.concat(pickAgents));
    tower.traverse(function(o){ if(o.geometry&&o.geometry.dispose) o.geometry.dispose();
      var ms=Array.isArray(o.material)?o.material:[o.material];
      ms.forEach(function(m){ if(!m) return; if(m.map&&m.map.dispose) m.map.dispose(); if(m.dispose) m.dispose(); }); });
    ediRoot.classList.remove('on'); ediRoot.setAttribute('aria-hidden','true');
    window.__EDIFICIO=null;
  }
};
})();
</script>
"""

post_ind = '\n'.join(('  ' + l if l.strip() else l) for l in partes.POST.split('\n'))

OUT.write_text(CABECERA % {
    'CSS': partes.CSS,
    'DATOS': partes.DATOS,
    'TEXTURAS': partes.TEXTURAS,
    'BASE': partes.BASE,
    'CONSTRUCT': partes.CONSTRUCT,
    'PISOS': partes.PISOS,
    'DOMJS': partes.DOMJS,
    'POST_INDENT': post_ind,
}, encoding='utf-8')
print('escrito:', OUT, OUT.stat().st_size, 'bytes')
