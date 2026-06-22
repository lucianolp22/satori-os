# Satori Voz — agente (LiveKit + OpenAI Realtime)

Agente de voz que consume el **tool-backend GAS** (`doPost`). Voz-a-voz con OpenAI Realtime. El agente
NO toca los Sheets: pide al `doPost` (gateado por secreto) y habla la respuesta.

## Requisitos
- Python ≥ 3.10.
- Cuenta **LiveKit Cloud** (free tier "Build" = 1.000 min agente/mes, sin tarjeta).
- `OPENAI_API_KEY` (Realtime).
- El **`doPost` desplegado** → `GAS_VOZ_URL` (URL `/exec` del deployment "Cualquiera") + `VOZ_TOOL_SECRET`
  (el que seteaste en Script Properties). Ver `../DEPLOY-doPost.md`.

## Setup
```bash
cd voz/agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local      # completar las 6 variables
```

## Probar
- **Console (sin gastar transporte, habla por la terminal):**
  ```bash
  python agent.py console
  ```
- **Dev (conecta a LiveKit Cloud; hablás desde el Agent Console del navegador):**
  ```bash
  python agent.py dev
  ```
- **Deploy a LiveKit Cloud** (free tier): `lk agent create` desde esta carpeta (requiere LiveKit CLI: `brew install livekit-cli` + `lk cloud auth`).

> Atajo oficial recomendado si querés tests + AGENTS.md: `lk agent init satori-voz --template agent-starter-python` y pegás este `agent.py` encima. El standalone de acá ya corre sin scaffolding.

## Tools expuestas (→ doPost)
`estado(id_cliente?)` · `brief(id_cliente?)` · `vehemence` · `cliente(id_cliente)` · `cerebro(id_cliente)` · `capturar(texto)`

## Bastión (notas vivas)
- 🔑 Secretos **solo** en `.env.local` (en `.gitignore`); nunca commitear. Las keys de vendor viven acá, no en GAS ni en el repo.
- 🗄️ El system prompt obliga a responder de **alto nivel** (sin PII cruda); aun así el `cliente`/`cerebro`/`vehemence` traen cifras que el TTS vocaliza → decisión consciente antes de prod (blueprint §5).
- ⚔️ El control de acceso al backend es el **secreto en el body** del `doPost`; el agente solo expone lectura + `capturar`.
- 💸 Costo variable (OpenAI ~$0.05–0.46/min) NO pasa por el tope $25 del OS → vigilar el dashboard de LiveKit/OpenAI; el free tier es el techo natural mientras validás.

## Estado
Construido por Cowork (plano de Code). **Pendiente:** desplegar el `doPost` (para tener `GAS_VOZ_URL`), crear cuentas LiveKit + OpenAI, completar `.env.local`, y probar el loop en `console`/`dev`.
