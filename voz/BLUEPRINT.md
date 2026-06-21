# BLUEPRINT — Satori Voz (agente conversacional)

**Fecha:** 19/06/2026 · **Estado:** arquitectura fijada, fork de marca abierto · **Decisor:** Luciano · **Alcance:** solo Luciano (capa personal, fork A — como la Bandeja) · **Capa de seguridad:** Bastión (ver §5)

> Documento de arquitectura del agente de voz de Satori. El OS sigue siendo GAS+Sheets; la voz **no corre en GAS** — se delega a una plataforma gestionada y GAS queda como *tool-backend*. Este archivo no se pushea a GAS (`rootDir=src`).

---

## 1. Decisión de arquitectura (fijada por Luciano, 19/06/2026 — no re-discutir)

- **Plataforma gestionada corre el always-on.** El WebSocket de la sesión de voz lo sostiene la plataforma (LiveKit Cloud), no un host nuestro. **Sin host propio, sin fijo mensual.** Esto disuelve el flag de seguridad del "daemon always-on" descartado en el HANDOFF: el always-on no es infraestructura nuestra.
- **GAS = tool-backend HTTPS (request/response).** El agente de voz consulta el cerebro (Analista/Vigía/Sheets) llamando al web app de GAS por HTTPS POST. GAS hace lo que hace bien: sincrónico, corto, sin estado.
- **Costo = variable por minuto, no host.** Lo caro de un agente conversacional es el TTS y el LLM (~USD 0,06–0,20/min según perfil), no el servidor. No se contrata nada fijo.
- **Arranque GRATIS en LiveKit Cloud free tier** (~1.000 min de agente/mes). **Sin comprometer gasto hasta validar el loop.**
- **Dominio:** `voz.satoriconsultoria.com` apunta a la plataforma — **recién en producción**. Es la dirección, no un host.
- **Alcance:** solo Luciano. Ningún cliente opera la voz (cambia §5 si algún día sí).

---

## 2. Diagrama de flujo

```
 teléfono / navegador
        ⇅  WebRTC / WebSocket
 ┌─────────────────────────────────────────────┐
 │  LiveKit Cloud  (plataforma gestionada)      │
 │  Agente:  VAD → STT → LLM(cerebro) → TTS     │
 └─────────────────────────────────────────────┘
        ⇅  HTTPS POST  (secreto compartido)
 ┌─────────────────────────────────────────────┐
 │  GAS Web App — doPost(e)  [TOOL-BACKEND]     │
 │  router → tools  (auth + dispatch)           │
 └─────────────────────────────────────────────┘
        ⇅
 Sheets / Cerebro:  estadoVigente · briefDiario
 · verVehemence · datosCliente · leerEstado · capturar
```

El agente vive en LiveKit; el cerebro vive en GAS/Sheets. La voz nunca toca los datos directamente: pide al tool-backend y recibe texto para hablar.

---

## 3. El tool-backend en GAS (contrato)

**Qué falta construir:** un `doPost(e)` nuevo en `src/08_webapp.js` (hoy solo hay `doGet`). Router mínimo:

1. **Autenticar** — el body trae un secreto compartido; se valida contra `Script Properties` (`VOZ_TOOL_SECRET`). Si no coincide → rechazo. *(GAS en deploy "cualquiera" no autentica headers de forma fiable → el secreto va en el payload, no en header.)*
2. **Enrutar** `{ tool, args }` a funciones **que ya existen** (cero reinvención):

| tool | función real | devuelve |
|---|---|---|
| `estado` | `estadoVigente(idCliente)` | foto vigente del cliente/sistema |
| `brief` | `briefDiario(idCliente)` | brief del día |
| `vehemence` | `verVehemence()` | ventas/canales Vehemence |
| `cliente` | `datosCliente(idCliente)` | datos del cliente |
| `cerebro` | `leerEstado(tenant)` | estado materializado del cerebro |
| `capturar` | `capturar(texto,'voz')` | manda una idea a la Bandeja |

3. **Responder** JSON (`ContentService`) que el agente convierte en habla.

**Topología de deploy (⚠ hallazgo Bastión — no obvio):** el web app actual es *"solo yo / ejecutar como yo"*. Un agente externo que llame `doPost` exige acceso *"cualquiera"*; **flipear el deployment actual a "cualquiera" dejaría el `doGet` (UI del cerebro) público.** Por eso el tool-backend va en un **deployment dedicado "cualquiera"**, separado del de la UI, y `doGet` se **endurece** (rechaza al visitante anónimo vía `Session.getActiveUser().getEmail()` vacío → no sirve la shell) para que el deployment público no filtre la UI. El `doPost` queda gateado por el secreto. **No tocar el deployment de la UI ("solo yo") — el endurecimiento de `doGet` se prueba con Code antes de pushear (riesgo: lockout del propio Luciano).**

**Fit-check GAS: ✓** — request/response sincrónico y corto encaja perfecto. Lo que NO encaja (el streaming always-on) está fuera de GAS, en LiveKit. Decisión correcta.

---

## 4. Fork de marca pendiente — tu decisión (es de marca, no técnica)

Precios verificados jun-2026 (USD, orientativos, reconfirmar al contratar):

| Opción | Qué es | Costo aprox. | Pros | Contras | Cuándo conviene |
|---|---|---|---|---|---|
| **(a) Pipeline** Deepgram + ElevenLabs + LLM | 3 piezas: STT + TTS de marca + cerebro | STT ~$0,008/min · TTS ~$0,06–0,15/min · + LLM | **Voz clonada de marca Satori**; control fino de la voz | 3 vendors, más latencia y más partes que romper | La voz es un **activo de marca** cara-a-cliente |
| **(b) Voz-a-voz** single vendor (OpenAI Realtime / Gemini Live) | 1 modelo hace STT+razonamiento+TTS | OpenAI ~$0,05–0,10/min *con caching* · Gemini Live el input más barato | Simple, 1 key, menor latencia, **más barato** | Voz = presets del vendor (menos marca) | Herramienta **interna** (= fork A, solo vos) |

**Recomendación (conf 7/10):** para el piloto personal (solo vos), **arrancá con (b)** — Gemini Live por costo o OpenAI Realtime por madurez. La voz de marca (a)/ElevenLabs recién cuando la voz sea cara-a-cliente y la marca lo justifique. Validás el loop barato; no pagás la complejidad de (a) para un usuario.
*No bloquea el blueprint: es lo único que falta definir y se decide en cualquier momento antes de §7.4.*

---

## 5. Seguridad (Bastión)

- **Exposición de la UI por el deployment (hallazgo principal, ver §3):** el tool-backend NO comparte deployment con la UI. Deployment dedicado "cualquiera" + `doGet` endurecido (rechaza anónimo) + `doPost` con secreto. Sin esto, abrir la voz abriría el cerebro al público.
- **Keys de vendors** (LiveKit, Deepgram/ElevenLabs **o** OpenAI/Gemini): viven en el entorno del agente **en la plataforma**, nunca en GAS ni en el repo.
- **`doPost` del tool-backend:** se despliega público → **obligatorio** secreto compartido en el body (`VOZ_TOOL_SECRET` en Script Properties, rotable). Mismo patrón que la `CLAUDE_API_KEY`. Sin secreto, el cerebro queda expuesto.
- **Flujo de datos a vigilar (2º orden):** aun en alcance personal, las **respuestas** del cerebro (cifras de cliente, p.ej. Vehemence) se sintetizan en el vendor de TTS → **números de cliente transitan el vendor como audio**. Mitigación: la voz responde **de alto nivel** (sin PII ni cifras crudas), el detalle a pantalla; o aceptar con vendor enterprise/no-train, decisión consciente **antes de prod**.
- **Subdominio:** TLS; apuntar `voz.` recién en prod.
- **Tope de gasto:** el costo variable no pasa por el tope de $25 del OS (es otro proveedor) → vigilar el consumo en el dashboard de la plataforma; LiveKit free tier es el techo natural mientras se valida.

---

## 6. Validación sin gasto (free tier)

Probar el loop end-to-end **antes de cualquier gasto**: hablar → el agente llama `estado`/`brief` por el tool-backend → te lo dice. Todo en LiveKit Build ($0) + el voz-a-voz más barato. Sin ElevenLabs, sin fijo, sin subdominio. Si el loop cierra y la latencia sirve, **recién ahí** se decide la voz de marca (a) y el gasto variable.

---

## 7. Próximos pasos

1. ✓ Decisión de arquitectura registrada (este doc).
2. ☐ Elegir fork de marca a/b (tu call; recomiendo (b) para validar).
3. ☐ **Code:** `doPost` tool-backend en `08_webapp.js` (secreto + router a las 6 tools). Cowork deja el plano, Code ejecuta.
4. ☐ **Code:** agente LiveKit en free tier que consuma el tool-backend.
5. ☐ Probar loop end-to-end (free) → **Purga de cierre** → actualizar HANDOFF.
6. ☐ Solo si valida + querés marca: subdominio `voz.` + (a) ElevenLabs + control de gasto variable.

---

## Confianza y fuentes

Pricing jun-2026 **orientativo** (reconfirmar al contratar): **conf 7–8/10**. Arquitectura fijada por Luciano: firme.

- [LiveKit Pricing 2026](https://trtc.io/blog/details/livekit-pricing-2026) · [LiveKit Free Tier 2026 — AgentDeals](https://agentdeals.dev/vendor/livekit)
- [OpenAI API Pricing](https://openai.com/api/pricing/) · [OpenAI Realtime cost/min 2026 — CallSphere](https://callsphere.ai/blog/vw2c-openai-realtime-cost-per-minute-math-2026)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Deepgram Pricing 2026](https://diyai.io/ai-tools/speech-to-text/deepgram-pricing-2026/) · [ElevenLabs Pricing 2026 — BIGVU](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/)
