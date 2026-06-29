#!/usr/bin/env python3
"""
serve_voz.py — Server LOCAL de la voz de Satori (desktop, sin nube).

Qué hace:
  - Sirve la página de voz (voz.html + /vendor/livekit-client...) en 127.0.0.1.
  - GET /token → mintea un JWT de LiveKit acotado a la sala, con TTL corto.

Bastión:
  - Escucha SOLO en 127.0.0.1 (loopback): NO se expone a la red local.
  - LIVEKIT_API_SECRET se lee de voz/agent/.env.local y NUNCA viaja al browser;
    al cliente solo va el token firmado (TTL corto, sala acotada).
  - No se loguea el token.

Uso (desde la raíz del repo, con el venv del agente):
  source voz/agent/.venv/bin/activate
  python voz/web/serve_voz.py
"""
import os
import json
import pathlib
import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

HERE = pathlib.Path(__file__).resolve().parent            # voz/web
ENV_PATH = HERE.parent / "agent" / ".env.local"           # voz/agent/.env.local

if load_dotenv:
    load_dotenv(ENV_PATH)

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "").strip()
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "").strip()
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "").strip()
ROOM = os.environ.get("VOZ_ROOM", "satori-os-desktop").strip()
HOST = "127.0.0.1"
PORT = int(os.environ.get("VOZ_PORT", "8787"))
TTL_MIN = int(os.environ.get("VOZ_TTL_MIN", "120"))

# livekit-api viene como dependencia de livekit-agents (ya instalado para el agente).
try:
    from livekit import api as lk_api
except Exception as _e:  # pragma: no cover
    lk_api = None
    _IMPORT_ERR = str(_e)


def mint_token():
    grants = lk_api.VideoGrants(
        room_join=True, room=ROOM,
        can_publish=True, can_subscribe=True, can_publish_data=True,
    )
    return (
        lk_api.AccessToken(api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)
        .with_identity("luciano-desktop")
        .with_name("Luciano")
        .with_grants(grants)
        .with_ttl(datetime.timedelta(minutes=TTL_MIN))
        .to_jwt()
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def _send_json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/token":
            if lk_api is None:
                return self._send_json(500, {"error": "falta livekit-api en el venv"})
            if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
                return self._send_json(500, {"error": "faltan credenciales LiveKit en .env.local"})
            try:
                return self._send_json(200, {"url": LIVEKIT_URL, "room": ROOM, "token": mint_token()})
            except Exception:
                return self._send_json(500, {"error": "no pude mintear el token"})
        if path in ("/", ""):
            self.path = "/voz.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        # Log mínimo. La request line no contiene el token (va en el body de la respuesta).
        try:
            print("[serve_voz]", self.address_string(), "-", fmt % args)
        except Exception:
            pass


def main():
    os.chdir(str(HERE))
    if lk_api is None:
        print("AVISO: no se pudo importar livekit.api (%s)." % _IMPORT_ERR)
        print("       /token va a fallar hasta instalar: pip install 'livekit-api'")
    if not ENV_PATH.exists():
        print("AVISO: no encuentro %s — el mint del token va a fallar." % ENV_PATH)
    with ThreadingHTTPServer((HOST, PORT), Handler) as httpd:
        print("Satori Voz — server local en http://%s:%d  (sala: %s, TTL %dmin)" % (HOST, PORT, ROOM, TTL_MIN))
        print("Abrí el Centro de Mando y tocá 'Hablar con Sato' (o entrá a la URL de arriba).")
        print("Cortar: Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer detenido.")


if __name__ == "__main__":
    main()
