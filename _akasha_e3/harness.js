/* Harness E3: corre el código REAL de Akasha (extraído de src/index.html) contra
 * el build r128 REAL, con DOM y renderer stubbeados y payloads GAS con el shape
 * documentado del MAESTRO. Prueba adaptador + motor + 5 toggles + teardown.
 * No reemplaza el gate en /dev (fps/render son de Luciano): caza excepciones.
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const LENTO_MS = Number(process.env.LENTO_MS || 3000);   // latencia simulada de cerebroGrafo
const SP = __dirname + '/';
const IDX = '/Users/lucianopablolp/Documents/Claude/Projects/SatoriOS/src/index.html';

/* ── stubs de canvas 2D / DOM ─────────────────────────────────────────────── */
const noop = () => {};
function ctx2d() {
  const g = { addColorStop: noop };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 90, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => g;
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'canvas') return { width: 256, height: 256 };
      return typeof k === 'string' ? (t[k] !== undefined ? t[k] : noop) : undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
let nodeSeq = 0;
function mkEl(id) {
  const el = {
    id: id || ('n' + (++nodeSeq)), tagName: 'DIV', hidden: false, width: 1200, height: 800,
    style: new Proxy({}, { get: (t, k) => (k === 'setProperty' ? noop : t[k]), set: (t, k, v) => (t[k] = v, true) }),
    dataset: {}, children: [], _html: '',
    classList: { _s: new Set(), add(...a) { a.forEach(x => this._s.add(x)); }, remove(...a) { a.forEach(x => this._s.delete(x)); }, toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    appendChild(c) { this.children.push(c); return c; }, insertBefore(c) { this.children.push(c); return c; },
    removeChild: noop, remove: noop, focus: noop, click: noop, blur: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }),
    getContext(t) { return t === '2d' ? ctx2d() : { getExtension: () => null, getParameter: () => 8 }; },
    cloneNode() { return mkEl(this.id); }, replaceWith: noop, toDataURL: () => 'data:,',
    contains: () => false, closest: () => null, scrollIntoView: noop
  };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = String(v); } });
  Object.defineProperty(el, 'textContent', { get() { return this._txt || ''; }, set(v) { this._txt = String(v); } });
  Object.defineProperty(el, 'parentNode', { get() { return mkEl(); } });
  return el;
}
const REG = {};
const byId = id => (REG[id] || (REG[id] = mkEl(id)));

/* ── payloads GAS con el shape REAL documentado ──────────────────────────── */
const GAS = {
  estadoAgentes: () => ({
    agentes: [
      { clave: 'vigia', nombre: 'Vigía', rol: 'Monitoreo', activo: true, gate: false, estado: 'work', hoy: { total: 3, ok: 3 }, ultimo: '11:40 · Sync conectores — OK', avatar_url: '' },
      { clave: 'conciliador', nombre: 'Conciliador', rol: 'Banco↔Ventas', activo: true, gate: false, estado: 'ok', hoy: { total: 1, ok: 1 }, ultimo: '08:05 · Cuadre — OK', avatar_url: '' },
      { clave: 'cobrador', nombre: 'Cobrador', rol: 'Cobranzas', activo: true, gate: true, estado: 'idle', hoy: { total: 2, ok: 1 }, ultimo: '10:30 · Factura vencida', avatar_url: 'https://x/y.png' },
      { clave: 'analista', nombre: 'Analista', rol: 'Tendencias', activo: true, gate: false, estado: 'fail', hoy: { total: 1, ok: 0 }, ultimo: '09:15 · EERR — ERROR', avatar_url: '' },
      { clave: 'abastecedor', nombre: 'Abastecedor', rol: 'Stock', activo: true, gate: true, estado: 'idle', hoy: { total: 1, ok: 1 }, ultimo: '12:10 · Stock crítico', avatar_url: '' },
      { clave: 'flux', nombre: 'Flux', rol: 'Ingeniería', activo: false, gate: true, estado: 'idle', hoy: { total: 0, ok: 0 }, ultimo: '', avatar_url: '' },
      { clave: 'atlas', nombre: 'Atlas', rol: 'Research', activo: false, gate: false, estado: 'idle', hoy: { total: 0, ok: 0 }, ultimo: '', avatar_url: '' },
      { clave: 'director', nombre: 'Director', rol: 'Orquestación', activo: true, gate: false, estado: 'work', hoy: { total: 1, ok: 1 }, ultimo: '07:00 · Brief emitido', avatar_url: '' }
    ],
    feed: [
      { ts: '2026-07-17 11:40', agente: 'vigia', tipo: 'sync', id_cliente: 'CLI-001', texto: 'Sync ventas del día — OK', tarea_id: '', aprobacion_id: '' },
      { ts: '2026-07-17 10:30', agente: 'cobrador', tipo: 'aviso', id_cliente: 'CLI-004', texto: 'Factura vencida detectada', tarea_id: '', aprobacion_id: 'APR-0001' },
      { ts: '2026-07-17 08:05', agente: 'conciliador', tipo: 'cuadre', id_cliente: 'CLI-001', texto: 'Cuadre banco⇄ventas — OK', tarea_id: '', aprobacion_id: '' }
    ],
    cfg: { voz_url: 'http://127.0.0.1:8787', oficina_url: '', avatar_bandeja: '', avatar_cerebro: '' },
    north_star: null,
    presupuesto: { gastoUsd: 0.43, topeUsd: 25 },
    aprobaciones: [
      { id: 'APR-0001', id_cliente: 'CLI-004', cliente: 'EJF', modulo: 'cobrador', patron: 'P1', tipo_accion: 'Recordatorio de cobro', descripcion: 'Enviar recordatorio factura vencida', payload: '{}', monto: '', fecha_creacion: '2026-07-17' },
      { id: 'APR-0002', id_cliente: 'CLI-002', cliente: 'Vehemence', modulo: 'abastecedor', patron: 'P2', tipo_accion: 'Orden de reposición', descripcion: 'Reponer 4 ítems', payload: '{}', monto: '€ 320', fecha_creacion: '2026-07-17' }
    ],
    clientes_activos: [],
    telemetria: { llamadas: 12, tokens: 4000, gasto_usd: 0.43, tope_usd: 25, errores: 1 },
    ts: '2026-07-17 12:00'
  }),
  datosHoy: () => ({
    estado: { clientes: 4, proyectos: 3, tareas: 9, avisos_activos: 1, aprobaciones_pendientes: 2, ultima_sync_ok: '17/07 07:09', ultima_sync_estado: 'ok', ultima_corrida_avisos: '17/07 07:10' },
    avisos: [{ tipo: 'vencida', mensaje: 'Factura vencida', id_cliente: 'CLI-004', fecha: '2026-07-17' }],
    proximos_pasos: [
      { id_tarea: 'TAR-0001', descripcion: 'ARMAR REUNIONES LC TRAVEL', prioridad: 'A', estado: 'pendiente', fecha_limite: '2026-07-18', id_cliente: 'CLI-003', vencida: false },
      { id_tarea: 'TAR-0002', descripcion: 'Registrar Patinete en Hacienda', prioridad: 'B', estado: 'pendiente', fecha_limite: '', id_cliente: '', vencida: true }
    ],
    aprobaciones_por_patron: {},
    tareas_ctx: { hoy: 0, clientes: 7, periodicas: 3, en_curso: 1, abiertas: 8 }
  }),
  estadoSalud: () => ({ global: 'ok', integridad: 98, hallazgos: [], ts: '2026-07-17 12:00' }),
  recomendacionesAbiertas: () => ([{ id: 'REC-0001', fecha: '2026-07-16', texto: '[A] ARMAR REUNIONES LC TRAVEL', kpi: 'north_star', se_hizo: '', kpi_movio: '', id_cliente: 'CLI-003' }]),
  listaClientes: () => ([
    { id_cliente: 'CLI-001', nombre: 'FRANFLACA / Mesaquince', estado: 'activo', rubro: 'Dirección Administrativa' },
    { id_cliente: 'CLI-002', nombre: 'Vehemence', estado: 'activo-piloto', rubro: 'Conector TiendaNube' },
    { id_cliente: 'CLI-003', nombre: 'LC Travel', estado: 'activo', rubro: 'SGIC' },
    { id_cliente: 'CLI-004', nombre: 'EJF', estado: 'potencial', rubro: 'Formalización' }
  ]),
  agendaRango: () => ([{ id: 'AG-1', fecha: new Date().toISOString().slice(0, 10), hora: '10:00', titulo: 'Reunión', id_cliente: 'CLI-003', notas: '', estado: 'ok' }]),
  cerebroGrafo: (id) => (id === 'CLI-004'
    ? { nodos: [{ dim: 'negocio', alert: true }, { dim: 'lider', alert: false }], aristas: [[0, 1]] }
    : { nodos: [{ dim: 'negocio', alert: false }, { dim: 'sistema', alert: false }, { dim: 'lider', alert: false }], aristas: [[0, 1], [1, 2]] }),
  datosCliente: (id) => ({
    cliente: { id_cliente: id, nombre: 'X', rubro: 'Y', estado: 'activo', responsable: 'Nico', fecha_alta: '2026-01-01', url_sheet_cliente: '' },
    proyectos: [{ id_proyecto: 'P1', nombre: 'p', estado: 'en curso', avance: 50, proximo_hito: '', fecha_objetivo: '', fecha_ultimo_movimiento: '' }],
    proximos_pasos: [], observaciones: [],
    consumo_api: { llamadas: 3, tokens_in: 100, tokens_out: 50, usd: 0.02, por_modulo: {}, ultimas: [], error: '' },
    gobernanza: null
  }),
  dispararAgenteUI: () => ({ tareaId: 'COLA-1' }),
  resolverAprobacionUI: () => ({ ok: true, estado: 'aprobada', ejecucion: {} }),
  registrarFeedback: () => 'FBK-0001',
  aprobacionDesdeRecomendacion: () => ({ ok: true, id: 'APR-0003', patron: 'P1' })
};

/* google.script.run: async como en GAS (los handlers vuelven en otro tick) */
function mkRun() {
  const st = { ok: null, fail: null };
  const api = new Proxy({}, {
    get(t, k) {
      if (k === 'withSuccessHandler') return f => (st.ok = f, api);
      if (k === 'withFailureHandler') return f => (st.fail = f, api);
      return (...args) => {
        // cerebroGrafo abre el Sheet de cada Espacio: es LENTO. Se simula así para
        // probar que la escena NO lo espera (BUG B).
        const lento = (k === 'cerebroGrafo') ? LENTO_MS : 0;
        setTimeout(() => {
          try {
            if (!GAS[k]) throw new Error('función GAS inexistente: ' + k);
            const v = GAS[k](...args);
            st.ok && st.ok(v);
          } catch (e) { st.fail ? st.fail(e) : (() => { throw e; })(); }
        }, lento);
      };
    }
  });
  return api;
}

/* ── sandbox ──────────────────────────────────────────────────────────────── */
const errores = [];
const sandbox = {
  console: { log: noop, warn: (...a) => errores.push(['warn', a.join(' ')]), error: (...a) => errores.push(['error', a.map(String).join(' ')]) },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
  requestAnimationFrame: () => 1, cancelAnimationFrame: noop,
  performance: { now: () => Date.now() },
  matchMedia: q => ({ matches: false, addEventListener: noop, addListener: noop }),
  devicePixelRatio: 2, innerWidth: 1400, innerHeight: 900,
  addEventListener: noop, removeEventListener: noop, open: noop,
  confirm: () => true, alert: noop, prompt: () => 'x',
  AbortController, AbortSignal, TextDecoder, TextEncoder, URL,
  Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error, isFinite, isNaN, parseInt, parseFloat, Set, Map, Proxy, Reflect, Uint8ClampedArray, Float32Array, Uint16Array, Uint32Array, Int32Array, ArrayBuffer, TypeError,
  document: {
    getElementById: byId, createElement: t => mkEl(), createElementNS: () => mkEl(),
    addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
    hidden: false, readyState: 'complete', fonts: { ready: Promise.resolve() },
    body: mkEl('body'), documentElement: mkEl('html')
  },
  navigator: { userAgent: 'node', maxTouchPoints: 0 },
  google: { script: { run: null } },
  EN_GAS: true,
  cmToast: noop, refrescarCentro: noop, calAbrir: noop,
  location: { href: '' }, localStorage: { getItem: () => null, setItem: noop }, sessionStorage: { getItem: () => null, setItem: noop }
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
Object.defineProperty(sandbox.google.script, 'run', { get: mkRun });
vm.createContext(sandbox);

/* 1. THREE r128 real */
vm.runInContext(fs.readFileSync(SP + 'three.r128.min.js', 'utf8'), sandbox);
console.log('· THREE r' + sandbox.THREE.REVISION + ' (build real del CDN, SRI verificado)');

/* 2. renderer stubbeado: el harness prueba lógica, no GPU */
const RealWGL = sandbox.THREE.WebGLRenderer;
let ctxLost = 0, disposed = 0;
sandbox.THREE.WebGLRenderer = function (o) {
  this.domElement = (o && o.canvas) || mkEl();
  this.setPixelRatio = noop; this.setSize = noop; this.setClearColor = noop; this.setScissorTest = noop;
  this.render = noop; this.clear = noop;
  this.dispose = () => { disposed++; };
  this.forceContextLoss = () => { ctxLost++; };
  this.getContext = () => ({ getExtension: () => null });
  this.info = { render: {}, memory: {} };
  this.capabilities = { getMaxAnisotropy: () => 8 };
  this.outputEncoding = 0; this.shadowMap = { enabled: false };
};

/* 3. el código REAL de Akasha, tal como quedó en index.html */
const h = fs.readFileSync(IDX, 'utf8');
const banner = h.indexOf('AKASHA · Motor 3D E3');
if (banner < 0) { console.error('✗ no encontré el bloque de Akasha en index.html'); process.exit(1); }
const i = h.lastIndexOf('/*', banner);          // arrancar en la apertura del comentario
// cortar al cierre del IIFE del boot, NO en </script> (después sigue el CM)
const ret = h.indexOf('return { S: S,', i);
const k = h.indexOf('})();', ret) + '})();'.length;
if (ret < 0 || k < 5) { console.error('✗ no encontré el cierre del boot de Akasha'); process.exit(1); }
const code = h.slice(i, k);
vm.runInContext(code, sandbox);
console.log('· bloque Akasha evaluado (' + code.length + ' bytes)');

/* 4. simular: entrar → 5 toggles */
(async () => {
  const A = sandbox.window.AKASHA;
  if (!A) { console.error('✗ window.AKASHA no quedó definido'); process.exit(1); }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ── BUG B: la escena NO debe esperar a los cerebros ──
  const t0 = Date.now();
  A.entrar();
  let tEscena = null;
  for (let i = 0; i < 200; i++) {          // poll hasta que el motor exista
    if (A.S.engine) { tEscena = Date.now() - t0; break; }
    await wait(25);
  }
  console.log('\n── BUG B · SEGUNDA OLA ──');
  console.log('  cerebroGrafo simulado en   :', LENTO_MS + 'ms por Espacio ×', A.DATA ? A.DATA.clientes.length : '?');
  console.log('  universo construido en     :', tEscena + 'ms', tEscena !== null && tEscena < LENTO_MS ? '✓ (NO esperó la memoria)' : '✗ ESPERÓ');
  console.log('  nodos al construir         :', A.DATA.akasha.length, '(0 = Núcleo nace vacío ✓)');
  await wait(LENTO_MS + 900);             // dejar entrar la segunda ola
  console.log('  nodos tras la segunda ola  :', A.DATA.akasha.length);
  console.log('  nodos por Espacio          :', A.DATA.clientes.map(c => c.id + '=' + c.reg.length).join(' '));
  const okB = tEscena !== null && tEscena < LENTO_MS && A.DATA.akasha.length === 11;
  console.log('  ' + (okB ? '✓ segunda ola OK' : '✗ segunda ola MAL'));
  A.salir();
  await wait(30);

  for (let t = 1; t <= 5; t++) {
    A.entrar();
    await wait(60);                       // deja resolver las promesas de google.script.run
    if (t === 1) {
      const D = A.DATA;
      if (!D) { console.error('✗ DATA quedó null tras entrar()'); process.exit(1); }
      console.log('\n── ADAPTADOR (MAESTRO → DATA) ──');
      console.log('  salud            :', D.salud);
      console.log('  corridasHoy      :', D.corridasHoy);
      console.log('  estaciones       :', D.agentes.length, '→', D.agentes.map(a => a.nombre + '/' + a.estado).join(' '));
      console.log('  laboratorio      :', D.lab.length, '→', D.lab.join(' '));
      console.log('  Espacios         :', D.clientes.length, '→', D.clientes.map(c => c.id + ':' + c.chip).join(' '));
      console.log('  Muelle           :', D.aprobaciones.length, '→', D.aprobaciones.map(a => a.id + ' de ' + a.de).join(' | '));
      console.log('  Núcleo (nodos)   :', D.akasha.length, '· puntos ciegos:', D.akasha.filter(n => n.alert).length);
      console.log('  nodos por Espacio:', D.clientes.map(c => c.id + '=' + c.reg.length).join(' '));
      console.log('  brief            :', D.brief.length, '| lazo:', D.lazo ? D.lazo.id : 'null');
      console.log('  sistema          :', JSON.stringify(D.sistema));
      console.log('  tareas           :', JSON.stringify(D.tareas));
      console.log('  agenda           :', D.agenda.length, 'días');
      console.log('  fuentes caídas   :', D._fallas.length ? D._fallas : 'ninguna ✓');
      console.log('  motor construido :', !!A.S.engine);
      console.log('');
    }
    A.salir();
    await wait(10);
  }
  console.log('── TOGGLES ──');
  console.log('  5 toggles Despacho↔Akasha:', 'sin excepción ✓');
  console.log('  renderer.dispose()        :', disposed, '(esperado 6: 5 toggles + la corrida de BUG B)');
  console.log('  forceContextLoss()        :', ctxLost, '(esperado 6)');
  console.log('  AK.on tras salir          :', sandbox.window.AK.on, '(esperado false → el orbe del CM retoma)');

  const graves = errores.filter(e => e[0] === 'error');
  console.log('\n── CONSOLA ──');
  if (!graves.length) console.log('  sin console.error ✓');
  else graves.forEach(e => console.log('  ✗', e[1].slice(0, 160)));
  const ok = disposed === 6 && ctxLost === 6 && !graves.length && sandbox.window.AK.on === false && okB;
  console.log('\n' + (ok ? '✓ HARNESS VERDE' : '✗ HARNESS EN ROJO'));
  process.exit(ok ? 0 : 1);
})();
