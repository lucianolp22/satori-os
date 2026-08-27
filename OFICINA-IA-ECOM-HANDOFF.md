# HANDOFF · OFICINA IA · ECOM (codename **MERCURIO**)

**Clon funcional del reel "Zona Ecom Agentes" de Jorge Pinazo**
Fecha: 01/08/2026 · Autor: Satori (Cowork) · Destino: nueva conversación (Claude Code / Cowork)
Fuente: `SatoriOS/VIDEOS PRUEBA/REEL DE OFICINA VIRTUAL EJEMPLO JORGE.mov` (4:17, deconstruido frame a frame)

> **Cómo se usa este handoff:** abrí una conversación nueva, adjuntá este archivo + `OFICINA-IA-ECOM-PROMPT-MAESTRO.md`, y pegá el prompt maestro. El agente lee esto como fuente de verdad y ejecuta módulo por módulo. No re-explicar el proyecto: modo ejecutor desde el primer mensaje.

---

## BLUF

Vamos a construir un **clon fiel y funcional** de la oficina virtual multiagente de Jorge Pinazo ("Zona Ecom Agentes"), en **su mismo stack** (front vanilla + **Cloudflare Worker** como proxy/orquestador + integraciones reales). Es una **consola tipo chat** con un **roster de 7 trabajadores IA** que forman un pipeline de dropshipping: **cazar producto → construir tienda/landing → copys → video-anuncio → atención al cliente → contabilidad → Jarvis (orquestador + voz)**.

Decisiones ya tomadas (vos): **dominio = clon fiel e-commerce** · **alcance = todo funcional** · **stack = igual que Jorge**.

Confianza global de que es construible tal cual: **8.5/10**. Los dos puntos de fricción reales son (a) la **calidad/latencia de la fuente de datos de productos** (scraping de ad libraries — resoluble con Apify, que ya tenés) y (b) el **costo variable** de video (Seedance) e imágenes. Todo lo demás es estándar.

---

## PARTE 1 — DECONSTRUCCIÓN DEL REEL (qué es y cómo está hecho)

### 1.1 Identidad
- Marca en pantalla: **"Zona Ecom Academy · AI AGENTS v11.5"**, consola **"Zona Ecom Agentes"**.
- Formato del reel: grabación de celular filmando una laptop (por eso el moiré). Autor: `@jorgepinazo_`. CTA "Toca para explorar · Clase Gratuita" → es contenido de venta de su formación.
- Título de ventana visto en Claude desktop: **"🚀 Oficina IA / Conver. Zona Ecom Agentes"**.

### 1.2 Arquitectura visible (evidencia directa en pantalla)
| Señal en el video | Timestamp | Qué implica |
|---|---|---|
| URL `ecom-openai-proxyroxy.twilight-bush-ed2f.workers.dev/#d=eyJ...` | 116s | Front servido desde **Cloudflare Workers**; el nombre "openai-proxy" ⇒ el worker **proxea OpenAI**; el `#d=<base64>` ⇒ **datos de la tienda embebidos en la URL** (sin DB para compartir). |
| Menú macOS "**Claude** Archivo Editar Ver…" + ventana "Oficina IA / Conver. Zona Ecom Agentes" | 158s | Parte del flujo (el generador de video) corre **dentro de Claude/Cowork** con un **MCP**. |
| "**Seedance 2.0** · 9:16 · 15s · Audio · Job ID… status pending · Predict Virality · Recreate" | 158s | Video-anuncio con **Seedance 2.0** (modelo de video de ByteDance), image-to-video, vertical, con audio, asíncrono (job + poll). |
| "Aplicando **Shrine** adaptado al nicho" · "lista para subirla a **Shopify** en 1 click" | 104s | Tienda estilo **Shrine** (theme Shopify real) y publicación a **Shopify** vía API. |
| "Integrado con **Shopify**" · "3 tiendas online conectadas" · ROAS/CPA | 226–252s | Contable lee **Shopify Admin API** (multi-tienda) + gasto de ads (Meta/TikTok) para ROAS/CPA. |
| "Detecto productos… **Library** y **Google Trends**… Tiendas Shopify verificadas" | 16–30s | Cazador cruza **ad library** (Facebook/Meta) + **Google Trends** + verificación de tiendas. |

**Conclusión de arquitectura:** front vanilla SPA + **un Cloudflare Worker** que (1) proxea el LLM ocultando la key, (2) orquesta herramientas server-side (ads library, trends, shopify, fal.ai, email) y (3) renderiza las landings. El agente de video se apoya en **fal.ai (Seedance)**; Jorge lo mostró vía Claude+MCP, nosotros lo llamamos directo desde el worker (o por MCP, a elección).

### 1.3 Los 7 trabajadores IA (persona + función + salida)

Cada agente tiene: avatar, nombre, **tagline en primera persona** ("Hola, soy…"), color temático, un **dot de estado** con texto vivo, y **tarjetas de resultado** propias (no es solo texto: el LLM devuelve **JSON estructurado** que el front pinta como card).

1. **Cazador de Productos** — *"Hola, soy Cazador de Productos · Detecta oportunidades virales en directo · listo para ayudarte."* Color: **naranja**.
   - Entrada: nicho/categoría/temporada ("productos para verano", "nuevos").
   - Salida: banner "🔥 6 productos explotando ahora mismo" + **grid de ProductCards**: nombre, imagen, **PRECIO DE VENTA**, **COSTE PRODUCTO** (p.ej. 5,97 €), **BENEFICIO POR VENTA** (13,93 €), ventas estimadas (101 ventas), **Margen x3**, badges "🔴 Viral", "Tiendas Shopify verificadas", "Sin productos saturados", link a proveedor. Botón **"Lanzar en mi tienda"** (pasa el producto al Creador de Tienda).

2. **Creador de Tienda Online** — *"Construye tu tienda Shopify desde cero o desde una URL."* Color: **azul/violeta**.
   - Entrada: producto (del Cazador) o URL de referencia.
   - **Calculadora de Precio** ("Modo Libre"): Precio del producto (coste) · Precio de venta · Precio del envío · **Margen %** (70,0%) · **Beneficio por venta €** (+69,93 €) · badge "EXCELENTE" · Coste total (29,97).
   - **Pantalla "Tu equipo IA está trabajando por ti"** (checklist con ticks, "no cierres esta pestaña"): `Analizando la competencia (señales de conversión de la URL)` → `Detectando el ADN del producto (nicho, avatar, ángulos ganadores)` → `Eligiendo paleta y theme premium (Shrine adaptado al nicho)` → `Escribiendo copys de alto CTR (hooks, beneficios, oferta irresistible)` → `Generando imágenes altamente persuasivas` → `Inyectando reseñas y prueba social (Trustpilot)` → `Configurando bundles y upsells (BUY MORE · PAY LESS)` → `Compilando tu tienda autónoma (lista para Shopify en 1 click)`.
   - Salida: **landing/tienda renderizada** (hero "FRÍO PORTÁTIL DONDE LO NECESITES · 99,90 € · REGALO INCLUIDO · -41%", precio tachado 169,90 €, "4.8 · 2847 reseñas verificadas", "Envío 24-72h", "Garantía 30 días", "ELIGE TU PACK Y AHORRA MÁS: Pack Básico / Pack Premium", secciones Características · Reseñas · FAQ, barra "Envío gratis a toda España · 30 días devolución sin preguntas · Stock limitado", botón **AÑADIR AL CARRITO**). Botón **"Generar Tienda Online Autónoma con IA"** y **"subir a Shopify en 1 click"**.

3. **Creador de Copys Persuasivos** — copys de venta: hooks, ángulos, descripciones, bullets de beneficios, oferta irresistible, objeciones. (Sub-servicio que el Creador de Tienda consume, y también invocable directo.)

4. **Creador de Anuncios Virales** — *"Vídeos e imágenes que paran el scroll."* Color: **rosa/magenta**.
   - Entrada: producto + foto + guion/ángulo.
   - Motor: **fal.ai Seedance 2.0 image-to-video** (9:16, 4–15s, `generate_audio`), estilo UGC "problema-solución dividida en dos mitades, fotorrealista documental". Job asíncrono (submit → poll → video).
   - Extras vistos: **"Predict Virality"** (score) y **"Recreate"**.

5. **Secretaria** — *"Hola, soy Secretaria."* Bandeja de **correos de clientes** (p.ej. "Lámpara antimosquitos rota al abrir"): clasifica, redacta y responde (devoluciones, envíos, quejas) con plantillas + LLM.

6. **Contable** — *"Cockpit Multi-Tienda · Integrado con Shopify."* Color: **violeta**.
   - "Buenas tardes Jorge · Así van tus Tiendas Autónomas ahora mismo · 3 tiendas online conectadas · Tus números pintan bien hoy · las ventas van 1,0% por encima de ayer."
   - **VENTAS TOTALES**, **BENEFICIO NETO** (3.819 € ▲6,0%), **Margen 25,8%**, pedidos, evolución temporal, desglose por **Tienda 1 / 2 / 3**. Resúmenes hablados ("acabamos con ~15.000 € los últimos 7 días", "100.173 €", "beneficio 26.000 €").

7. **Jarvis** — *"Asistente de Voz · Tu mano derecha · listo para ayudarte."* Color: **cian/oscuro**. Cabecera **"J.A.R.V.I.S — just a rather very intelligent system"**.
   - **Command-center estilo Iron-Man**: panel **ESTADO DEL IMPERIO** (Fact. hoy, Beneficio, Pedidos, ROAS medio, CPA medio) + **SISTEMA · ENTORNO** (Ubicación=Málaga, Temperatura=18°C, Día, Hora local, Sistema=OPERATIVO) + **radar/sonar animado** + estado ACTIVO.
   - Rol real: **orquestador** por voz/texto que rutea al agente correcto y agrega el estado global.

### 1.4 El pipeline (cómo encadena)
`Cazador (producto) → Creador de Tienda (+Copys +Imágenes → landing) → Creador de Anuncios (video) → [lanzar] → Secretaria (postventa) + Contable (números) ← Jarvis orquesta y vigila todo.`

---

## PARTE 2 — ARQUITECTURA DEL CLON (MERCURIO)

### 2.1 Veredicto de stack (gate `stack-satori`)
Tu default es GAS+Sheets. **Para esto GAS NO encaja** (chat con streaming, latencia <500 ms, jobs asíncronos de video, scraping externo, multi-usuario fuera de tu Workspace). El propio reel usa **Cloudflare Workers**. Elegiste "igual que Jorge" ⇒ **veredicto: front vanilla + Cloudflare Workers + integraciones**. GAS queda descartado con fundamento; no re-litigar.

### 2.2 Capas
```
┌─────────────────────────────────────────────────────────────┐
│ FRONT (SPA vanilla, /public)                                │
│  Roster lateral · Workspace del agente · Cards · Input       │
│  Reusa tokens de satori-design (rebrandeable a "Oficina IA") │
└───────────────▲──────────────────────────────┬──────────────┘
                │ fetch/SSE                     │ /s/{id} landing
┌───────────────┴──────────────────────────────▼──────────────┐
│ CLOUDFLARE WORKER (/src)  — la pieza central                 │
│  /api/chat        proxy LLM (OpenAI) + streaming SSE         │
│  /api/agent/{a}   orquesta cada agente (tool-calling)        │
│  /api/tools/*     ads-library · trends · shopify · fal · mail│
│  /s/{id} · /#d=   render de la landing (Shrine-like)         │
│  auth · rate-limit · CORS  (capa Bastión)                    │
│  KV: STORES,SESSIONS · D1: mercurio · Secrets: *_KEY         │
└───────┬───────────┬───────────┬───────────┬──────────┬───────┘
        │           │           │           │          │
     OpenAI      Apify      fal.ai       Shopify    Gmail/Meta
     (LLM)    (ad libs)   (Seedance)   (Admin API)   Ads API
```

### 2.3 Integraciones (verificadas al 01/08/2026)
- **LLM:** OpenAI GPT‑4o / GPT‑4o‑mini vía worker (o Claude, intercambiable). **Structured Outputs (JSON Schema)** para todas las cards. Streaming SSE para el chat. Patrón proxy CF estándar y documentado. Confianza 9/10.
- **Cazador → datos reales:** **Apify actors** (los tenés por MCP y por token API):
  - Meta/Facebook Ads Library: `apify/s-r/meta-ads-library`, `aurumworks/facebook-ads-library`, `harvestlab/facebook-ads-library-scraper`, `thirdwatch/fb-ad-library-scraper`.
  - TikTok Ads Library: `s-r/tiktok-ads-library`, `beyondops/tiktok-ad-library-scraper`.
  - + **Google Trends** (validación de tendencia) + heurística de saturación/margen. Confianza 7/10 (los actores cambian; dejar la fuente **pluggable**).
- **Creador de Anuncios → fal.ai Seedance 2.0:** endpoint `bytedance/seedance-2.0/image-to-video`. Params: `prompt` (movimiento/guion), `image_url` (foto producto/escena), `resolution` 480p/720p/1080p, `duration` "auto"|4–15, `aspect_ratio` **"9:16"**, `generate_audio` (default true), `seed`. Cola: submit → status → result (o `fal.subscribe`). Auth `FAL_KEY`. Confianza 9/10.
- **Imágenes persuasivas:** OpenAI images o **fal.ai (flux)** para hero/creatividades.
- **Creador de Tienda → Shopify:** **Admin API** (crear producto, páginas, publicar) para "1‑click". Alternativa 100% propia: landing servida por el worker (checkout con **Stripe**). Confianza 8/10.
- **Secretaria → email:** **Gmail API** (OAuth) o IMAP. Confianza 8/10.
- **Contable → números:** Shopify Admin API (orders/revenue multi-tienda) + **Meta Marketing API** / **TikTok Business API** (spend → ROAS/CPA). Confianza 7/10.
- **Jarvis → voz:** **reusar tu pipeline ya funcionando** (Deepgram + gpt‑4o‑mini + ElevenLabs + LiveKit). No reinventar. Confianza 9/10.

### 2.4 Estructura de archivos
```
mercurio/
├─ wrangler.toml            # config worker, bindings KV/D1, rutas
├─ .dev.vars               # secrets locales (GITIGNORED)
├─ package.json
├─ src/                    # Cloudflare Worker
│  ├─ index.js             # router principal
│  ├─ llm.js               # proxy OpenAI + streaming + structured outputs
│  ├─ auth.js  rate.js     # Bastión: login token, rate-limit, CORS
│  ├─ schemas.js           # JSON Schemas de todas las cards (contrato)
│  ├─ agents/
│  │  ├─ cazador.js  tienda.js  copys.js  anuncios.js
│  │  └─ secretaria.js  contable.js  jarvis.js
│  ├─ tools/
│  │  ├─ apify.js  trends.js  shopify.js  fal.js  gmail.js  ads.js
│  └─ store/render.js      # landing Shrine-like (SSR desde KV o #d=)
├─ public/                 # Front SPA vanilla
│  ├─ index.html  styles.css
│  ├─ app.js               # estado + router de agentes + SSE
│  ├─ roster.js            # sidebar/equipo
│  ├─ cards.js             # renderers de cada card type
│  └─ store.html           # plantilla de tienda (cliente)
├─ prompts/                # system prompts por agente (.md)
└─ README.md
```

---

## PARTE 3 — CONTRATOS DE DATOS (el LLM devuelve esto; el front lo pinta)

Definir en `src/schemas.js` y forzarlos con Structured Outputs. Mínimo:

- **ProductCard**: `{ nombre, imagen_url, nicho, precio_venta, coste, beneficio_unit, margen_x, ventas_est, viral_score(0-100), saturacion(baja|media|alta), competidores:[{tienda,url}], proveedor_url, fuente }`
- **PriceCalc**: `{ coste, envio, precio_venta, margen_pct, beneficio_unit, veredicto(EXCELENTE|BUENO|AJUSTADO) }`
- **StoreSpec**: `{ producto, avatar, angulos:[], paleta, theme:"shrine", hero:{titulo,precio,precio_tachado,descuento_pct,regalo}, bullets:[], reviews:[{autor,estrellas,texto}], bundles:[{nombre,precio,ahorro}], upsells:[], faq:[{q,a}] }`
- **BuildProgress**: `{ steps:[{label,sub,estado(pending|done)}], store_id }`
- **VideoJob**: `{ job_id, estado(pending|done|error), video_url, aspect:"9:16", virality_pred(0-100) }`
- **EmailThread**: `{ de, asunto, categoria(devolucion|envio|queja|info), draft_respuesta, tono }`
- **FinanceSnapshot**: `{ periodo, tiendas:[{nombre,ventas,beneficio}], ventas_total, beneficio_neto, margen_pct, pedidos, delta_pct_vs_ayer }`
- **EmpireState** (Jarvis): `{ fact_hoy, beneficio, pedidos, roas_medio, cpa_medio, entorno:{ubicacion,temp,hora_local,estado} }`

---

## PARTE 4 — PLAN DE CONSTRUCCIÓN (módulos, en orden de dependencia)

> "Todo funcional" es el **estado final**; igual se construye y **se verifica módulo a módulo** (loop Satori: construir → VERIFICAR → purga → siguiente). Cada módulo cierra con evidencia.

- **M0 · Andamiaje + chat vivo.** Repo, `wrangler`, front shell (roster + workspace + input), `/api/chat` proxy a OpenAI con **streaming**, 1 agente (Cazador) respondiendo con tool mock. **Verificar:** escribo y recibo respuesta en streaming; la key no viaja al front. `wrangler dev` OK.
- **M1 · Cazador real.** `tools/apify.js` (Meta+TikTok ad library) + `tools/trends.js` (Google Trends) + schema+render de **ProductCard**. **Verificar:** una consulta real devuelve ≥3 productos con números coherentes y links vivos.
- **M2 · Creador de Tienda + landing.** **PriceCalc**, generación de **StoreSpec**, imágenes, `store/render.js` (Shrine-like) servido en `/s/{id}` (KV) y en `/#d=` (shareable), pantalla **BuildProgress**. **Verificar:** de un ProductCard sale una landing navegable y compartible.
- **M3 · Copys.** Agente de copys + inyección en StoreSpec. **Verificar:** copys por ángulo, editables.
- **M4 · Anuncios (video).** `tools/fal.js` (Seedance 2.0, submit/poll), card **VideoJob**, player 9:16, "Predict Virality" (heurística LLM) y "Recreate". **Verificar:** de una foto sale un mp4 9:16 con audio.
- **M5 · Secretaria.** `tools/gmail.js` (OAuth), clasificación + **draft** de respuesta con plantillas. **Verificar:** lee bandeja de prueba, redacta respuesta correcta por categoría.
- **M6 · Contable.** `tools/shopify.js` (multi-tienda) + `tools/ads.js` (Meta/TikTok spend) → **FinanceSnapshot** + cockpit. **Verificar:** números cuadran contra el panel nativo de Shopify (±1%).
- **M7 · Jarvis.** Orquestador (function-calling que rutea a M1–M6) + dashboard **EmpireState** (radar) + geo/clima/hora + **enganche de voz** (tu LiveKit). **Verificar:** por voz/texto "buscá productos de verano" dispara el Cazador y muestra cards.
- **M8 · Cierre.** Publicación **Shopify 1‑click** (o Stripe Checkout), persistencia D1, pulido UI, **pasada Bastión** (secrets, rate-limit, auth, CORS, PII de clientes) + **purga** adversarial. **Verificar:** checklist de seguridad + go/no-go.

**T‑shirt sizing:** M0 S · M1 M · M2 L · M3 S · M4 M · M5 M · M6 L · M7 L · M8 M. Ruta crítica: M0→M1→M2→M4 (el "wow" del reel). Secretaria/Contable/Jarvis se pueden diferir sin romper la demo.

---

## PARTE 5 — SYSTEM PROMPTS (semilla por agente)

Patrón común: `Sos {AGENTE} de la Oficina IA. Hablás en español, primera persona, directo. Devolvés SIEMPRE JSON válido contra el schema {X}. No inventás datos numéricos: si faltan, llamás a la tool {T}. Tono: {persona}.`

- **Cazador:** persona = cazador táctico, urgencia de oportunidad. Tools: `apify.adLibrary`, `trends`. Output: `ProductCard[]`. Regla: margen mínimo x3, marcar saturación, exigir ≥1 competidor con tienda Shopify verificada.
- **Tienda:** persona = growth + CRO. Tools: `copys`, `images`, `store.save`. Output: `StoreSpec` + `BuildProgress`. Regla: oferta irresistible (ancla de precio, regalo, escasez real), bundles BUY MORE·PAY LESS, reviews plausibles y **marcadas como generadas** (ver nota legal).
- **Copys:** persona = copywriter directo (Halbert/Hopkins). Output: hooks+angles+bullets+FAQ.
- **Anuncios:** persona = creativo UGC. Tool: `fal.seedance`. Output: `VideoJob`. Prompt de video: "problema-solución en dos mitades, fotorrealista documental, 9:16, {producto} en uso real".
- **Secretaria:** persona = soporte empático y resolutivo. Tool: `gmail`. Output: `EmailThread` con draft. Nunca envía sin tu OK (gate).
- **Contable:** persona = CFO frío y claro. Tools: `shopify`, `ads`. Output: `FinanceSnapshot`. Regla: distinguir bruto/neto, margen real (incluye ads+envío+comisiones).
- **Jarvis:** persona = mano derecha, breve, ejecuta. Function-calling a todos. Output: `EmpireState` + ruteo.

---

## PARTE 6 — SEGURIDAD (capa Bastión, obligatoria)

- **Secrets sólo en el Worker** (`wrangler secret put`), jamás en el front ni en git. `.dev.vars` en `.gitignore`.
- **Auth** en la oficina (token/login) — no dejar la consola abierta al mundo. **Rate-limit** por IP/sesión en el proxy (evita que te vacíen la cuota de OpenAI/fal). **CORS** cerrado a tu dominio.
- **PII de clientes** (Secretaria/Contable): no logguear correos ni datos; anonimizar en ejemplos; sos **encargado del tratamiento** → base legal + minimización.
- **Riesgo cuota/costo:** fal.ai y OpenAI cobran por uso; poné **límites duros** por sesión y un "kill switch". 
- Antes de cualquier deploy con auth/OAuth/secretos: **pasar Bastión** (protocolo `PROTOCOLO-SEGURIDAD-SATORI`) y **purga** antes de cerrar.

---

## PARTE 7 — RIESGOS, PRE-MORTEM Y LEGAL

**Pre-mortem (asumí que fracasó, ¿por qué?):**
1. **Datos de producto malos/lentos** → el Cazador miente y todo el pipeline nace podrido. Mitigación: fuente pluggable, validación cruzada Trends, marcar confianza por producto.
2. **Costo de video/imágenes se dispara** → Seedance por segundo + imágenes por generación. Mitigación: caché, límites, previsualización barata antes del render caro.
3. **Shopify/Meta APIs con fricción de acceso** (revisión de app, tokens). Mitigación: empezar con modo landing propia (worker + Stripe) y diferir Shopify/Ads a M6/M8.
4. **Reviews/claims inventados** = riesgo legal (publicidad engañosa, LGDS/AEPD en ES). Mitigación: reseñas marcadas como ilustrativas hasta tener reales; claims sin promesas falsas; disclaimer.

**Legal (ES, orientativo, confianza 6/10 — verificar con fuente antes de vender):** dropshipping en España obliga a IVA/IGIC, desistimiento 14 días, identidad del vendedor y del origen del envío, y publicidad no engañosa. **No es asesoría fiscal**: antes de facturar, verificar régimen (autónomo/SL), IVA de bienes desde fuera de UE (IOSS) y consumo. Marcar como pendiente de gestoría.

**Second-order:** si funciona, escala a multi-tienda (ya contemplado en Contable/Jarvis). El cuello no será la tecnología sino **operar postventa y caja** — por eso Secretaria y Contable existen desde el diseño.

---

## PARTE 8 — LO QUE HAY QUE CONSEGUIR ANTES DE EMPEZAR (checklist de llaves)

- [ ] Cuenta **Cloudflare** (Workers + KV + D1) · `wrangler login`.
- [ ] **OPENAI_API_KEY** (o Anthropic).
- [ ] **FAL_KEY** (fal.ai, para Seedance/flux).
- [ ] **APIFY_TOKEN** (para ad libraries; ya lo tenés).
- [ ] **Shopify** Admin API token(s) por tienda (diferible a M6).
- [ ] **Gmail OAuth** (diferible a M5).
- [ ] **Meta/TikTok** Ads API (diferible a M6).
- [ ] Reusar credenciales de **voz** (LiveKit/Deepgram/ElevenLabs) para Jarvis (M7).

---

## PARTE 9 — DEFINICIÓN DE "HECHO" (demo del reel reproducida)
Escribo en el chat "buscá productos de verano" → salen ProductCards reales → "lanzá el #1" → PriceCalc + BuildProgress + **landing navegable** → "hacé el anuncio" → **video 9:16 con audio** → Contable muestra números de una tienda de prueba → Jarvis lo resume por **voz**. Eso = paridad con el reel.

---
*Fin del handoff. El prompt maestro para disparar todo está en `OFICINA-IA-ECOM-PROMPT-MAESTRO.md` y replicado abajo.*
