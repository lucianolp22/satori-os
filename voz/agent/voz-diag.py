#!/usr/bin/env python3
"""
voz-diag.py — Diagnóstico del 403 de os@ en el tool-backend de Voz (GAS web app).
Satori OS — Opción B2.  NO imprime secretos (solo longitudes + status/body de error).

Corre el MISMO camino que gas_voz_client.py pero NO lanza excepción: captura y
CLASIFICA el fallo para nombrar la causa del 403 ANTES de tocar Admin Console.
Separa "minteo del token" (¿el refresh de os@ sirve?) de "llamada al web app"
(¿la ACL del Workspace deja entrar a os@?), y resuelve la identidad del token.

Uso (parado en la carpeta donde está .env.local):
  pip install google-auth requests
  python3 voz-diag.py
"""
import os, pathlib, sys


def load_env():
    for base in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        p = base / ".env.local"
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
            return str(p)
    return None


src = load_env()
print(f"[env] .env.local: {'cargado de ' + src if src else 'NO ENCONTRADO'}")
for k in ("GAS_VOZ_URL", "VOZ_TOOL_SECRET", "OS_CLIENT_ID", "OS_CLIENT_SECRET", "OS_REFRESH_TOKEN"):
    v = os.environ.get(k)
    print(f"[env] {k}: {'OK (len ' + str(len(v)) + ')' if v else 'FALTA'}")

try:
    import requests
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
except Exception as e:
    print(f"\n[deps] FALTAN libs: {e}\n  -> pip install google-auth requests")
    sys.exit(1)

# 1) Minteo del access token desde el refresh de os@
print("\n=== 1) Minteo de access token (refresh de os@) ===")
try:
    creds = Credentials(
        None,
        refresh_token=os.environ["OS_REFRESH_TOKEN"],
        client_id=os.environ["OS_CLIENT_ID"],
        client_secret=os.environ["OS_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["openid",
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/drive.readonly"],
    )
    creds.refresh(Request())
    tok = creds.token
    print(f"[mint] OK — access token minteado (len {len(tok)}). El refresh token de os@ es VÁLIDO.")
except Exception as e:
    print(f"[mint] FALLÓ: {type(e).__name__}: {e}")
    print("  -> Causa probable: refresh token revocado/expirado o consent OAuth incompleto. NO es el web app.")
    sys.exit(2)

# 1b) ¿De quién es este token? (confirma que la identidad es os@)
try:
    ui = requests.get("https://openidconnect.googleapis.com/v1/userinfo",
                      headers={"Authorization": f"Bearer {tok}"}, timeout=20)
    print(f"[whoami] el token se resuelve como: {ui.json().get('email', '(sin email)')}")
except Exception as e:
    print(f"[whoami] no se pudo resolver: {e}")

# 2) Llamada al web app (POST + manejo manual del redirect 302, reenviando auth)
print("\n=== 2) POST al /exec (brief) ===")
url = os.environ["GAS_VOZ_URL"]
headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
body = {"secret": os.environ["VOZ_TOOL_SECRET"], "tool": "brief"}
s = requests.Session()
r = s.post(url, headers=headers, json=body, allow_redirects=False, timeout=30)
hops = 0
while r.is_redirect and hops < 5:
    loc = r.headers.get("Location", "")
    print(f"[302] -> {loc[:80]}...")
    r = s.get(loc, headers=headers, allow_redirects=False, timeout=30)
    hops += 1

print(f"[resp] status={r.status_code}  final_host={requests.utils.urlparse(r.url).netloc}")
txt = r.text or ""
print(f"[resp] body[:600]:\n{txt[:600]}")

# 3) Clasificación de la causa
print("\n=== 3) Veredicto ===")
low = txt.lower()
if r.status_code == 200 and txt.strip().startswith("{"):
    print("[OK] El web app respondió JSON. os@ PASA. -> Voz desbloqueado: cablear call_tool en el agente.")
elif "apps script" in low and any(t in low for t in ("turned off", "no está habilitado", "deshabilitado", "disabled")):
    print("[CAUSA #1] Apps Script DESHABILITADO para os@/su OU. -> Admin: Apps > Apps Script = ON para esa OU.")
elif "accounts.google.com" in low or "sign in" in low or "iniciar sesión" in low:
    print("[LOGIN] El endpoint sirve página de login -> el nivel de acceso no acepta este token. Revisar 'Quién tiene acceso' = DOMAIN.")
elif r.status_code == 403:
    print("[403] La ACL del Workspace rechaza a os@. Candidatas: #1 Apps Script OFF para os@ · #2 cliente OAuth no confiable (Controles de API) · #3 deployment no-DOMAIN. Mirar el body de arriba.")
else:
    print(f"[?] Respuesta inesperada (status {r.status_code}). Revisar body arriba.")
