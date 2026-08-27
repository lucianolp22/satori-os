"""brief_hoy.py — parser del bloque "HOY hay que mirar" del brief de sistema (E2.d, 27-ago).

Vive SEPARADO de `agent.py` por una razón práctica: importar `agent.py` arrastra livekit y los
plugins, así que un test del parser tendría que levantar medio agente. Acá es una función pura sobre
un string, y el arnés (`_harness.js`) la ejercita de verdad en cada corrida.

EL CONTRATO con el backend: `_briefInsertarHoy_` (src/18_direccion.js) emite el encabezado con el
CONTEO DE SEÑALES entre paréntesis — `## HOY hay que mirar (2 señales)`. Ese número es lo que decide
si Sato abre la boca. Deducirlo del texto de las líneas ("nada", "OK", "sin") sería un acuerdo
tácito entre dos lenguajes, y se rompería en silencio la primera vez que alguien mejore una frase.
"""

from __future__ import annotations

import re

TITULO = "HOY hay que mirar"

# `se(ñ|n)ales` tolera la pérdida del acento en el transporte; el resto es literal a propósito.
_RE_HOY = re.compile(r"^##\s+" + re.escape(TITULO) + r"\s*\((\d+)\s+se(?:ñ|n)ales\)\s*$")


def brief_hoy(md: str) -> tuple[int, list[str]]:
    """Extrae (señales, líneas) del bloque HOY. Sin bloque ⇒ (0, []) — silencio, no adivinanza."""
    lineas: list[str] = []
    senales = 0
    dentro = False
    for cruda in str(md or "").splitlines():
        linea = cruda.rstrip()
        if dentro:
            if linea.startswith("## "):
                break
            if linea.strip():
                lineas.append(linea.lstrip("- ").strip())
            continue
        m = _RE_HOY.match(linea)
        if m:
            senales = int(m.group(1))
            dentro = True
    return senales, lineas
