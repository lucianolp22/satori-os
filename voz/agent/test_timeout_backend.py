#!/usr/bin/env python3
"""
Harness headless — verifica el timeout duro del backend GAS (encargo 14-jul: voz colgada).

Simula un backend lento (call_tool duerme > timeout) y comprueba que:
  1. _llamar_backend NO cuelga: devuelve texto hablable dentro del tope (fail-closed).
  2. El sentinela de timeout es el mensaje hablable esperado.
  3. capturar (ESCRITURA) NO confirma un guardado falso ante timeout (N5).
  4. El camino feliz sigue devolviendo la data real.

No levanta LiveKit (no hay mic/room): verifica la lógica del chokepoint _llamar_backend
y de la tool capturar. El filler hablado (say) y el audio real quedan para la prueba de
voz de Luciano (reinicio + turno real), que es la otra mitad del pedido #5.

Uso:  .venv/bin/python test_timeout_backend.py
Sale con código !=0 si algún assert falla.
"""
import asyncio
import os
import sys
import time

# Config mínima para pasar el guard de _llamar_backend (valores dummy, no se llama la red real).
os.environ.setdefault("GAS_VOZ_URL", "https://example.invalid/exec")
os.environ.setdefault("VOZ_TOOL_SECRET", "dummy-secret-para-test")

import agent  # noqa: E402
import gas_voz_client  # noqa: E402

FALLOS = []


def _check(nombre, cond, detalle=""):
    estado = "OK " if cond else "FALLA"
    print(f"[{estado}] {nombre}" + (f" — {detalle}" if detalle else ""))
    if not cond:
        FALLOS.append(nombre)


class _CtxStub:
    """RunContext mínimo para capturar: solo necesita disallow_interruptions()."""
    def disallow_interruptions(self):
        pass


def _fake_call_tool_lento(segundos):
    def _impl(tool, **params):
        time.sleep(segundos)  # bloqueante, como el requests real → corre en executor
        return {"ok": True, "tool": tool, "data": "NO DEBERIA LLEGAR"}
    return _impl


def _fake_call_tool_ok(data):
    def _impl(tool, **params):
        return {"ok": True, "tool": tool, "data": data}
    return _impl


async def main():
    orig = gas_voz_client.call_tool
    orig_timeout = agent._TIMEOUT_BACKEND_S
    try:
        # --- 1. Mecanismo (rápido): timeout corto override, backend más lento que el tope ---
        agent._TIMEOUT_BACKEND_S = 2
        gas_voz_client.call_tool = _fake_call_tool_lento(6)
        t0 = time.monotonic()
        r = await agent._llamar_backend("brief")
        dt = time.monotonic() - t0
        _check("timeout devuelve sentinela hablable", r == agent._MSG_BACKEND_TIMEOUT, repr(r))
        _check("timeout corta cerca del tope (no cuelga)", 1.8 <= dt <= 4.0, f"{dt:.2f}s")

        # --- 2. capturar NO confirma guardado falso ante timeout (N5) ---
        gas_voz_client.call_tool = _fake_call_tool_lento(6)
        rc = await agent.SatoriVoz().capturar(_CtxStub(), texto="probar la alarma del auto")
        _check("capturar en timeout NO dice 'Anotado'", "Anotado" not in rc, repr(rc))
        _check("capturar en timeout avisa que no confirma", "no puedo confirmar" in rc.lower(), repr(rc))

        # --- 3. Camino feliz: data real fluye ---
        gas_voz_client.call_tool = _fake_call_tool_ok("brief del día: todo tranquilo")
        r2 = await agent._llamar_backend("brief")
        _check("camino feliz devuelve data real", r2 == "brief del día: todo tranquilo", repr(r2))
        rc2 = await agent.SatoriVoz().capturar(_CtxStub(), texto="comprar café")
        _check("capturar OK ecoa 'Anotado: <texto>'", rc2 == "Anotado: comprar café", repr(rc2))

        # --- 4. Timeout REAL de 25s (lento; prueba el valor de producción) ---
        if "--rapido" not in sys.argv:
            agent._TIMEOUT_BACKEND_S = orig_timeout  # 25 real
            gas_voz_client.call_tool = _fake_call_tool_lento(orig_timeout + 15)
            print(f"    (esperando el tope real de {orig_timeout}s…)")
            t0 = time.monotonic()
            r3 = await agent._llamar_backend("brief")
            dt = time.monotonic() - t0
            _check("tope REAL devuelve sentinela", r3 == agent._MSG_BACKEND_TIMEOUT, repr(r3))
            _check(f"tope REAL corta ~{orig_timeout}s en el MISMO turno",
                   orig_timeout - 1 <= dt <= orig_timeout + 3, f"{dt:.2f}s")
        else:
            print("    (--rapido: se salta el tope real de 25s)")
    finally:
        gas_voz_client.call_tool = orig
        agent._TIMEOUT_BACKEND_S = orig_timeout

    print()
    if FALLOS:
        print(f"RESULTADO: {len(FALLOS)} FALLA(S) → {', '.join(FALLOS)}")
        sys.exit(1)
    print("RESULTADO: todo OK — el backend lento devuelve fallback hablable dentro del tope.")


if __name__ == "__main__":
    asyncio.run(main())
