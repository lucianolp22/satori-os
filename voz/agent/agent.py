"""
Satori Voz — agente de voz (LiveKit + OpenAI Realtime) que consume el tool-backend GAS (doPost).

Fork de marca: (b) voz-a-voz OpenAI Realtime (confirmado por Luciano). Secretos por env (.env.local),
nunca hardcodeados (Bastión). El agente NUNCA toca los Sheets: pide al doPost (gateado por secreto) y
recibe texto para hablar.

Patrón LiveKit Agents vigente (jun-2026, quickstart oficial): AgentServer + @server.rtc_session +
agents.cli.run_app(server). Verificado contra docs.livekit.io/agents/start/voice-ai.
"""
from __future__ import annotations

import json
import os

import aiohttp
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, RunContext, function_tool
from livekit.agents.llm import ToolError
from livekit.plugins import openai

load_dotenv(".env.local")

GAS_VOZ_URL = os.environ.get("GAS_VOZ_URL", "")
VOZ_TOOL_SECRET = os.environ.get("VOZ_TOOL_SECRET", "")
_HTTP_TIMEOUT = aiohttp.ClientTimeout(total=20)

INSTRUCCIONES = (
    "Sos la voz de Satori OS, el asistente personal de negocios de Luciano (consultor, marca Satori). "
    "Hablás español rioplatense (voseo), claro y conciso: es voz, frases cortas, sin markdown, sin emojis, sin asteriscos. "
    "Respondé de ALTO NIVEL: estados, prioridades y números redondeados. No leas en voz alta cifras crudas largas "
    "ni datos personales de clientes; si hace falta el detalle fino, decí que está en pantalla. "
    "Traé SIEMPRE datos reales con las tools (no inventes): estado, brief, vehemence, cliente, cerebro, capturar. "
    "Si una tool falla, decilo con honestidad y ofrecé reintentar. Cuando Luciano tira una idea o un pendiente, usá 'capturar'. "
    "Para '¿cómo venimos?' usá 'brief' (sistema) o 'estado'."
)


async def _llamar_backend(tool: str, args: dict | None = None) -> str:
    """POST al doPost de GAS con el secreto en el body. Devuelve el campo `data` (string o JSON)."""
    if not GAS_VOZ_URL or not VOZ_TOOL_SECRET:
        raise ToolError("Falta configurar el backend de voz (GAS_VOZ_URL / VOZ_TOOL_SECRET).")
    payload = {"secret": VOZ_TOOL_SECRET, "tool": tool, "args": args or {}}
    try:
        async with aiohttp.ClientSession(timeout=_HTTP_TIMEOUT) as s:
            async with s.post(GAS_VOZ_URL, json=payload) as resp:
                body = await resp.text()  # GAS responde 200 (tras 302 a googleusercontent) con el JSON
        data = json.loads(body)
    except Exception:
        # transporte caído / HTML de error / JSON inválido → mensaje genérico (no filtra detalle)
        raise ToolError("No pude consultar el sistema ahora. Probá de nuevo en un momento.")
    if not isinstance(data, dict) or not data.get("ok"):
        # error de aplicación: unauthorized / unknown_tool / falta_idCliente / error_interno
        raise ToolError("El sistema no pudo responder esa consulta.")
    d = data.get("data", "")
    return d if isinstance(d, str) else json.dumps(d, ensure_ascii=False)


class SatoriVoz(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCCIONES)

    @function_tool()
    async def estado(self, context: RunContext, id_cliente: str = "") -> str:
        """Estado vigente del sistema Satori (sin argumento) o de un cliente puntual.

        Args:
            id_cliente: id del cliente, ej. CLI-002 (Vehemence). Vacío = sistema (Satori).
        """
        return await _llamar_backend("estado", {"idCliente": id_cliente} if id_cliente else {})

    @function_tool()
    async def brief(self, context: RunContext, id_cliente: str = "") -> str:
        """Brief del día: lo más urgente y las 3 cosas a mover. Sistema, o de un cliente.

        Args:
            id_cliente: id del cliente, ej. CLI-002. Vacío = sistema (Satori).
        """
        return await _llamar_backend("brief", {"idCliente": id_cliente} if id_cliente else {})

    @function_tool()
    async def vehemence(self, context: RunContext) -> str:
        """Estado vigente de Vehemence (CLI-002): ventas, canales y pendientes."""
        return await _llamar_backend("vehemence")

    @function_tool()
    async def cliente(self, context: RunContext, id_cliente: str) -> str:
        """Ficha de un cliente: proyectos, próximos pasos y números.

        Args:
            id_cliente: id del cliente, ej. CLI-002 (requerido).
        """
        return await _llamar_backend("cliente", {"idCliente": id_cliente})

    @function_tool()
    async def cerebro(self, context: RunContext, id_cliente: str) -> str:
        """Estado del 'cerebro' (memoria materializada) de un cliente.

        Args:
            id_cliente: id del cliente, ej. CLI-002 (requerido).
        """
        return await _llamar_backend("cerebro", {"idCliente": id_cliente})

    @function_tool()
    async def capturar(self, context: RunContext, texto: str) -> str:
        """Captura una idea, tarea o nota a la Bandeja de Satori para clasificar después.

        Args:
            texto: lo que Luciano quiere anotar.
        """
        context.disallow_interruptions()  # escritura: no dejarla a medias por una interrupción
        await _llamar_backend("capturar", {"texto": texto})
        return "Listo, lo anoté en la bandeja."


server = AgentServer()


@server.rtc_session(agent_name="satori-voz")
async def entrypoint(ctx: agents.JobContext):
    session = AgentSession(
        # voz-a-voz: el modelo realtime hace VAD/turn-detection/STT/TTS; no hace falta pipeline aparte.
        llm=openai.realtime.RealtimeModel(voice="coral"),  # PURGA #2: voz confirmada en el quickstart oficial (alt: marin, echo)
    )
    await session.start(room=ctx.room, agent=SatoriVoz())
    await session.generate_reply(
        instructions="Saludá breve a Luciano en español rioplatense y preguntale en qué lo ayudás."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
