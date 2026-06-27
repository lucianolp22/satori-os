#!/usr/bin/env python3
"""
gas_voz_client.py — Cliente autenticado del tool-backend de Voz (GAS web app).
Satori OS — Opción A (caller = luciano@, el DUEÑO, usuario del dominio).

⚠️ Credencial viva del runtime de Voz = luciano@ (refresh token de luciano@,
generado el 25-jun, scopes openid+email+drive.readonly). os@ fue REEMPLAZADO ese
día y NO se usa más acá. Las variables se llaman OS_* por histórico — NO implican
que la credencial sea de os@: la viva es la de luciano@. (No revocar "el token de
os@" creyendo que esto lo usa: tirarías abajo la Voz.)

Qué hace:
  - Mintea un access token desde el refresh token de luciano@ (se renueva solo, ~1h).
  - Llama al /exec con Authorization: Bearer + secreto-en-body.
  - Maneja el redirect 302 de GAS re-enviando el header de auth al host
    googleusercontent (equivalente a `curl --location-trusted`). requests
    descarta el header en redirects cross-host, por eso se sigue a mano.

El agente importa call_tool() en cada function_tool. Para async (aiohttp/LiveKit),
llamarlo en executor:  await loop.run_in_executor(None, lambda: call_tool("brief"))
(o portar el mismo patrón allow_redirects=False → re-GET con headers a aiohttp).

Env (voz/agent/.env.local):
  GAS_VOZ_URL      https://script.google.com/a/macros/satoriconsultoria.com/s/<deploymentId>/exec
  VOZ_TOOL_SECRET  secreto compartido (rotado)
  OS_CLIENT_ID, OS_CLIENT_SECRET, OS_REFRESH_TOKEN   (nombre histórico; valores = los de luciano@)

pip install google-auth requests
"""
import os
import pathlib
import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request


def _load_env_local() -> None:
    """Carga .env.local (cwd o junto al script) a os.environ, sin pisar lo ya seteado.
    Parser mínimo KEY=VALUE — no requiere python-dotenv."""
    for base in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        env_path = base / ".env.local"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())
            return


_load_env_local()

_TOKEN_URI = "https://oauth2.googleapis.com/token"
_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.readonly",
]
_creds = None


def _get_token() -> str:
    global _creds
    if _creds is None:
        _creds = Credentials(
            None,
            refresh_token=os.environ["OS_REFRESH_TOKEN"],
            client_id=os.environ["OS_CLIENT_ID"],
            client_secret=os.environ["OS_CLIENT_SECRET"],
            token_uri=_TOKEN_URI,
            scopes=_SCOPES,
        )
    if not _creds.valid:
        _creds.refresh(Request())
    return _creds.token


def call_tool(tool: str, **params) -> dict:
    """Llama una tool del backend. Devuelve el JSON {ok, tool, data|error}."""
    url = os.environ["GAS_VOZ_URL"]
    headers = {
        "Authorization": f"Bearer {_get_token()}",
        "Content-Type": "application/json",
    }
    body = {"secret": os.environ["VOZ_TOOL_SECRET"], "tool": tool, **params}

    session = requests.Session()
    resp = session.post(url, headers=headers, json=body, allow_redirects=False, timeout=30)

    # GAS responde 302 → googleusercontent; re-seguir manteniendo el header de auth.
    hops = 0
    while resp.is_redirect and hops < 5:
        resp = session.get(resp.headers["Location"], headers=headers,
                           allow_redirects=False, timeout=30)
        hops += 1

    resp.raise_for_status()
    return resp.json()


if __name__ == "__main__":
    import json
    print(json.dumps(call_tool("brief"), ensure_ascii=False, indent=2))
