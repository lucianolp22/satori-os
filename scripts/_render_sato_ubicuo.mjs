/**
 * _render_sato_ubicuo.mjs — B1 · verificación headless del dock Sato Ubicuo (F7b).
 *
 * POR QUÉ LOCAL Y NO CONTRA /dev: el CM de GAS se sirve dentro de un iframe sandbox
 * cross-origin (`userCodeAppPanel`) — ni `querySelectorAll` desde el top ni el screenshot
 * de Chrome llegan al DOM real (CLAUDE.md: "el CM NO es auto-screenshoteable").
 * Un `querySelectorAll('#satoUbicuo').length === 0` desde el top-level da 0 SIEMPRE,
 * esté el widget o no: no es señal. La señal de que /dev lo sirve es el HTML de GAS HEAD
 * (guardia `clasp pull` + grep). Esto verifica lo otro: que el markup RINDE.
 *
 * Uso: node scripts/_render_sato_ubicuo.mjs
 */
import { createRequire } from 'node:module';
// playwright no está en el repo (regla: cero deps nuevas). Se resuelve desde el cache de npx,
// que es de donde ya lo corren los render-checks del proyecto. Override con PLAYWRIGHT_DIR.
const require_ = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_DIR || '/Users/lucianopablolp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require_(PW);

const HTML = new URL('../src/index.html', import.meta.url).pathname;
let fallos = 0, oks = 0;
const check = (cond, msg) => { if (cond) { oks++; console.log('✅ ' + msg); } else { fallos++; console.log('❌ ' + msg); } };

/** Shim de `google.script.run`: encadena withSuccessHandler/withFailureHandler y responde por endpoint. */
function shim(respuestas) {
  return `(function(){
    var R = ${JSON.stringify(respuestas)};
    function mk(){
      var ok=function(){}, fail=function(){};
      var p = new Proxy({}, { get:function(t,k){
        if(k==='withSuccessHandler') return function(f){ ok=f; return p; };
        if(k==='withFailureHandler') return function(f){ fail=f; return p; };
        return function(){ var r = Object.prototype.hasOwnProperty.call(R,k) ? R[k] : {ok:true};
          setTimeout(function(){ try{ ok(r); }catch(e){} }, 0); return undefined; };
      }});
      return p;
    }
    window.google = { script: { run: mk(), host:{ setHeight:function(){}, editor:{focus:function(){}} }, url:{ getLocation:function(f){ f({parameter:{}}); } } } };
  })();`;
}

async function escena(nombre, { respuestas, antesDeCargar, png }) {
  // El chromium bundleado del playwright del cache no está bajado; se usa el que YA está en
  // ~/Library/Caches/ms-playwright (build 1148). Override con PLAYWRIGHT_CHROME.
  const CHROME = process.env.PLAYWRIGHT_CHROME ||
    process.env.HOME + '/Library/Caches/ms-playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errores = [];
  page.on('pageerror', e => errores.push(String(e).slice(0, 160)));
  await page.addInitScript({ content: shim(respuestas) });
  if (antesDeCargar) await page.addInitScript({ content: antesDeCargar });
  await page.goto('file://' + HTML, { waitUntil: 'load' });
  await page.waitForTimeout(3200);   // > 1 tick del poll (2000ms): el rótulo se recalcula ahí
  const r = await page.evaluate(() => {
    const el = document.querySelector('#satoUbicuo');
    const b = el ? el.getBoundingClientRect() : null;
    const cs = el ? getComputedStyle(el) : null;
    return {
      n: document.querySelectorAll('#satoUbicuo').length,
      w: b ? Math.round(b.width) : 0, h: b ? Math.round(b.height) : 0,
      x: b ? Math.round(b.x) : -1, y: b ? Math.round(b.y) : -1,
      display: cs ? cs.display : null,
      lbl: el ? (el.querySelector('#suLbl') || {}).textContent : null,
      fb: !!document.querySelector('#fichaboard'),
      fbAttr: (document.querySelector('#fichaboard')||{getAttribute:()=>null}).getAttribute('data-cliente'),
      f360: window.F360_CLIENTE || null,
      // hit-test del chip: ¿el widget es el que efectivamente recibe el click?
      hit: (() => { const c = el && el.querySelector('.chip'); if (!c) return null;
        const cb = c.getBoundingClientRect();
        const t = document.elementFromPoint(cb.x + cb.width / 2, cb.y + cb.height / 2);
        return t ? (t.closest('#satoUbicuo') ? 'satoUbicuo' : (t.id || t.tagName)) : null; })()
    };
  });
  if (png) await page.locator('body').screenshot({ path: png }).catch(async () => { await page.screenshot({ path: png }); });
  await browser.close();
  return { ...r, errores };
}

const VP = 1440;
console.log('== B1 · render headless del dock Sato Ubicuo ==\n');

// Escena 1 — flag ENCENDIDO (backend responde ok con turnos).
const on = await escena('on', {
  respuestas: { charlaCola: { ok: true, tenant: 'CLI-000', turnos: [], tenant_datos: 'CLI-000' } },
  png: 'out/screenshot_sato_ubicuo.png'
});
check(on.n === 1, `existe exactamente 1 #satoUbicuo (encontré ${on.n})`);
check(on.w > 0 && on.h > 0, `tiene dimensiones reales (${on.w}×${on.h})`);
check(on.display !== 'none', `visible con el flag encendido (display=${on.display})`);
check(on.x > VP * 0.6, `anclado a la derecha (x=${on.x} de ${VP})`);
check(on.y >= 0 && on.y < 80, `anclado arriba (y=${on.y})`);
check(on.hit === 'satoUbicuo', `el hit-test del chip devuelve el widget, no otra capa (dio: ${on.hit})`);
check(on.lbl === 'Sato · Sistema', `sin ficha abierta rotula sistema (dio: "${on.lbl}")`);
check(on.errores.length === 0, `0 errores JS en la página (${on.errores.join(' | ') || 'ninguno'})`);

// Escena 2 — contexto de tenant: con una Ficha 360 abierta el dock queda anclado a ESE cliente.
const ficha = await escena('ficha', {
  respuestas: { charlaCola: { ok: true, tenant: 'CLI-002', turnos: [], tenant_datos: 'CLI-002' } },
  antesDeCargar: `document.addEventListener('DOMContentLoaded', function(){
     var f = document.getElementById('fichaboard');
     if (f) f.setAttribute('data-cliente','CLI-002'); else { window.F360_CLIENTE='CLI-002'; }
   });`
});
check(/CLI-002/.test(String(ficha.lbl)), `en Ficha 360 de CLI-002 rotula el tenant (dio: "${ficha.lbl}")`);

// Escena 3 — PURGA ADVERSARIAL: `sato_ubicuo_on=no` ⇒ el backend contesta off ⇒ dock oculto e inerte.
const off = await escena('off', {
  respuestas: { charlaCola: { ok: false, motivo: 'sato_ubicuo_off' } }
});
check(off.display === 'none', `con sato_ubicuo_on=no el dock se apaga solo (display=${off.display})`);
check(off.w === 0 && off.h === 0, `apagado no ocupa caja (${off.w}×${off.h})`);
check(off.errores.length === 0, `0 errores JS con el flag apagado`);

console.log(`\nRESULTADO: PASA ${oks} / FALLA ${fallos}`);
process.exit(fallos ? 1 : 0);
