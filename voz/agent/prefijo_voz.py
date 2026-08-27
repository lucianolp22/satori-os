"""prefijo_voz.py — B4 · mide el PREFIJO CACHEABLE de Sato-VOZ. Imprime JSON por stdout.

QUÉ MIDE Y POR QUÉ
    El caching de Anthropic es match de PREFIJO, y el orden de render es `tools` → `system` →
    `messages`. El plugin de LiveKit pone el breakpoint `cache_control` en la última tool Y en el
    último bloque de system (llm.py:226-231). O sea: el prefijo cacheable de la voz son **las
    definiciones de las 21 tools + la identidad**, no la identidad sola.

    Eso es lo que hace peligroso el hallazgo de F5: el mínimo cacheable de Haiku 4.5 son **4.096
    tokens**. La identidad sola no llega (~3,7k, ver D-ID8 del arnés). Son las tools las que
    empujan el prefijo por encima del umbral. Si alguien recorta tools —una limpieza razonable a
    los ojos de cualquiera— el prefijo cae por debajo de 4.096 y **Haiku deja de cachear en
    silencio**: no hay error, no hay warning, sólo la factura. R15 en `_harness.js` es el assert
    que lo caza.

CÓMO SE MIDE
    Importando `agent.py` de verdad e introspeccionando los `@function_tool` con la API de
    LiveKit (`find_function_tools` + `get_function_info` + `build_legacy_openai_schema`). No hay
    lista de tools escrita a mano en ningún lado: el conteo DERIVA del código, así que el que
    agregue o saque una tool no tiene que acordarse de actualizar nada (regla de las
    listas-contrato: los asserts que derivan sobreviven, los clavados a mano no).

    El estimador es el mismo del repo: **4 caracteres por token**, el gate conservador de
    `05_costos.js`. Es una estimación, no la cuenta de la API — y está bien que lo sea: R15 es un
    guard contra un recorte, no un medidor de facturación. Medir de verdad pediría un
    `count_tokens` contra la API, y el arnés corre OFFLINE en segundos.

Uso:  voz/agent/.venv/bin/python voz/agent/prefijo_voz.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys

_AQUI = os.path.dirname(os.path.abspath(__file__))
CHARS_POR_TOKEN = 4          # mismo gate conservador que 05_costos.js y D-ID8
MINIMO_HAIKU = 4096          # mínimo cacheable de Haiku 4.5 (_cacheMinimo_ en 05_costos.js)


def medir() -> dict:
    sys.path.insert(0, _AQUI)
    from livekit.agents.llm.tool_context import get_function_info, is_function_tool
    from livekit.agents.llm.utils import build_legacy_openai_schema

    spec = importlib.util.spec_from_file_location("agentmod", os.path.join(_AQUI, "agent.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # Se recorre la CLASE, no una instancia: `find_function_tools(instancia)` toca properties
    # como `realtime_llm_session`, que exigen una sesión viva y revientan fuera del runtime.
    # La definición de las tools es estática, así que la clase alcanza y no hay que levantar nada.
    tools = [v for v in vars(mod.SatoriVoz).values() if is_function_tool(v)]

    nombres, chars_tools = [], 0
    for t in tools:
        info = get_function_info(t)
        nombres.append(info.name)
        try:
            esquema = build_legacy_openai_schema(t)
        except Exception:  # noqa: BLE001 — si una tool no serializa, cuenta al menos su descripción
            esquema = {"name": info.name, "description": info.description or ""}
        chars_tools += len(json.dumps(esquema, ensure_ascii=False))

    identidad = mod.cargar_identidad()
    chars_sys = len(identidad)

    total = chars_tools + chars_sys
    tok = total // CHARS_POR_TOKEN
    return {
        "tools": len(tools),
        "nombres": sorted(nombres),
        "chars_tools": chars_tools,
        "chars_sys": chars_sys,
        "chars_total": total,
        "tok_estimado": tok,
        "minimo_haiku": MINIMO_HAIKU,
        "cachea_en_haiku": tok >= MINIMO_HAIKU,
        "margen_tok": tok - MINIMO_HAIKU,
    }


if __name__ == "__main__":
    print(json.dumps(medir(), ensure_ascii=False))
