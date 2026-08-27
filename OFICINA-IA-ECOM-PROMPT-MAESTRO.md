# PROMPT MAESTRO · OFICINA IA · ECOM (MERCURIO)

> Pegá esto en una conversación nueva (Claude Code o Cowork) con `OFICINA-IA-ECOM-HANDOFF.md` adjunto. Es el gatillo de construcción end-to-end.

---

**ROL.** Actuás como **Arquitecto de Software + Desarrollador Senior con foco en ciberseguridad**. Yo (Luciano) dirijo, decido y reviso; vos ejecutás y agotás tus propias alternativas antes de pedirme accionar (loop de ejecución supervisada). Modo ejecutor desde el primer mensaje: no me re-expliques el proyecto ni me propongas un "plan general" — el plan ya está en el handoff.

**MISIÓN.** Construir **MERCURIO** (Oficina IA · Ecom): un **clon fiel y funcional** de la oficina virtual multiagente "Zona Ecom Agentes" del reel de Jorge Pinazo. Consola tipo chat con roster de **7 agentes IA** en pipeline de dropshipping: Cazador de Productos → Creador de Tienda Online → Copys → Anuncios Virales (video) → Secretaria → Contable → **Jarvis** (orquestador + voz).

**FUENTE DE VERDAD.** El archivo `OFICINA-IA-ECOM-HANDOFF.md` adjunto. Leelo entero antes de escribir una línea. No te desvíes de su arquitectura, contratos de datos ni orden de módulos. Si encontrás una mejora, decila en 1 oración (qué se gana) y procedé solo si confirmo.

**DECISIONES FIJAS (no re-litigar):**
- Dominio: **clon fiel e-commerce** (dropshipping real).
- Alcance: **todo funcional** (estado final), construido y verificado **módulo por módulo**.
- Stack: **igual que Jorge** → front **vanilla SPA** + **Cloudflare Worker** (proxy LLM + orquestador de tools + render de landings) + integraciones. **GAS descartado** (streaming/latencia/jobs/scraping). 
- LLM vía worker con **Structured Outputs (JSON Schema)** para todas las cards; **streaming SSE** en el chat.

**INTEGRACIONES (ya verificadas, no re-investigar salvo que fallen):**
- Video: **fal.ai `bytedance/seedance-2.0/image-to-video`** — params `prompt`, `image_url`, `aspect_ratio:"9:16"`, `duration:4–15|auto`, `resolution:480p|720p|1080p`, `generate_audio`. Cola: submit → poll → result. Auth `FAL_KEY`.
- Datos de producto: **Apify actors** (Meta/Facebook Ads Library + TikTok Ads Library) + **Google Trends**. Fuente **pluggable**.
- Tienda/pagos: **Shopify Admin API** (1-click) o landing propia del worker + **Stripe**.
- Email: **Gmail API**. Números: Shopify + **Meta/TikTok Ads** (ROAS/CPA). 
- Voz (Jarvis): **reusar** el pipeline existente (LiveKit + Deepgram + ElevenLabs + gpt-4o-mini).

**ORDEN DE EJECUCIÓN (una etapa por vez; "avanzá" = siguiente):**
M0 andamiaje + chat en streaming (1 agente mock) → M1 Cazador real (Apify+Trends) → M2 Creador de Tienda + landing Shrine-like (`/s/{id}` y `/#d=`) + PriceCalc + BuildProgress → M3 Copys → M4 Anuncios (Seedance) → M5 Secretaria (Gmail) → M6 Contable (Shopify+Ads) → M7 Jarvis (orquestador+radar+voz) → M8 cierre (Shopify/Stripe, persistencia, Bastión, purga).

**LOOP OBLIGATORIO por módulo:** construir → **VERIFICAR con evidencia** (levantar `wrangler dev`, probar la ruta real, mostrar el output) → **purga** (auditoría adversarial) → recién ahí cerrar y avanzar. Nunca "listo" sin evidencia. No marques hecho un módulo con tests fallando o integración a medias.

**SEGURIDAD (Bastión, innegociable):** secrets sólo en Worker (`wrangler secret put`), nunca en front ni en git; `.dev.vars` en `.gitignore`; auth + rate-limit + CORS cerrado en el proxy; PII de clientes minimizada y sin logs; límites de costo duros + kill switch para OpenAI/fal. Antes de cualquier deploy con auth/OAuth/secretos, pasá Bastión.

**DEPENDENCIAS (Node/npm):** usar `npm ci` con lockfile commiteado, pinear versiones exactas, y revisar cada dep nueva (autor, descargas, typosquatting, postinstall) antes de instalar.

**ARRANQUE — hacé esto ahora:**
1. Confirmá en 3 líneas que leíste el handoff (stack, pipeline de 7 agentes, orden M0–M8).
2. Decime qué llaves necesitás para M0 (mínimo: Cloudflare + OPENAI_API_KEY) y cuáles difieren a módulos posteriores.
3. Andamiá **M0**: estructura de `mercurio/` según la Parte 2.4 del handoff, `wrangler.toml` con bindings, `/api/chat` (proxy OpenAI + streaming SSE, key oculta), y el front shell (roster con los 7 agentes + workspace + input) con el **Cazador** respondiendo contra un tool mock.
4. Cerrá M0 mostrándome evidencia (chat en streaming andando, key no expuesta) y esperá mi "avanzá" para M1.

Si algo del handoff choca con la realidad técnica al implementarlo, frená, decímelo en 1 oración con la alternativa, y seguí con lo que no dependa de esa decisión. Dale.
