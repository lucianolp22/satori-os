#!/usr/bin/env python3
"""
get_refresh_token.py — Obtiene UNA sola vez el refresh token de
os@satoriconsultoria.com para que el agente de Voz se autentique contra el
web app de GAS (Satori OS — Opción B2).

Mover a: voz/agent/get_refresh_token.py  (helper de uso único, NO se commitea con secretos)

Uso (una vez, en la máquina de Luciano):
  1. Tener el client_secret.json del OAuth client tipo "App de escritorio" (GCP).
  2. pip install google-auth-oauthlib
  3. python get_refresh_token.py ./client_secret.json
  4. Se abre el navegador → logueate como os@satoriconsultoria.com → "Permitir".
  5. Copiá las 3 líneas que imprime a voz/agent/.env.local  (NUNCA al repo).
"""
import os
import sys
import json

# Evita el crash "Scope has changed" cuando Google agrega 'openid' al set de scopes.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

from google_auth_oauthlib.flow import InstalledAppFlow

# Opción A (25-jun PM): el caller es el DUEÑO (luciano@). identidad sola
# (openid+email) dio 401 al abrir el /exec → el endpoint exige un scope drive.
# Fallback documentado del runbook (paso 3): drive.READONLY (drive blando, solo
# lectura — el script corre como dueño; no se concede drive de escritura).
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.readonly",
]


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python get_refresh_token.py <ruta/al/client_secret.json>")
        sys.exit(1)

    client_secret_path = sys.argv[1]
    flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, scopes=SCOPES)

    # access_type=offline + prompt=consent garantizan que venga refresh_token.
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

    with open(client_secret_path, encoding="utf-8") as fh:
        data = json.load(fh)
    info = data.get("installed", data.get("web", {}))

    print("\n=== Copiá esto a voz/agent/.env.local (NO al repo) ===")
    print(f"OS_CLIENT_ID={info.get('client_id', '')}")
    print(f"OS_CLIENT_SECRET={info.get('client_secret', '')}")
    print(f"OS_REFRESH_TOKEN={creds.refresh_token}")

    if not creds.refresh_token:
        print(
            "\n[!] No vino refresh_token. Revocá el acceso previo en "
            "https://myaccount.google.com/permissions (cuenta os@) y reintentá."
        )


if __name__ == "__main__":
    main()
