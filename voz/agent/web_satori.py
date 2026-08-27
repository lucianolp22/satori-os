"""web_satori.py — B3 · web search + web fetch para Sato-VOZ, con whitelist Satori.

POR QUÉ ES UN MÓDULO Y NO CÓDIGO EN `agent.py`
    Mismo motivo que `brief_hoy.py`: (a) se testea sin levantar LiveKit ni el pipeline de voz, y
    (b) tocar `agent.py` cuesta un reload del agente (lección +59) — esto no.
    `agent.py` sólo aporta dos `@function_tool` de 5 líneas que delegan acá.

POR QUÉ EL SDK CLIENTE Y NO EL PLUGIN DE LIVEKIT
    `livekit.plugins.anthropic 1.6.4` **no expone las server tools de Anthropic**. Verificado en
    fuente: `llm.py` arma `extra["tools"]` sólo desde los `FunctionTool` de LiveKit y su
    `LLMStream._parse_event` parsea `tool_use` para re-despacharlo al agente — un bloque
    `web_search_tool_result`, que se resuelve del lado del servidor, no tiene por dónde entrar.
    Así que la búsqueda es una llamada APARTE con el SDK `anthropic` (ya instalado, cero deps
    nuevas), envuelta en un `@function_tool` propio. Es además la opción correcta de diseño: la
    whitelist, el presupuesto y el log viven en el envoltorio, que es donde se pueden hacer cumplir.

CONTRATO DE LA API — verificado contra la doc oficial el 27/08/2026 (confianza 9/10)
    · `web_search_20250305` y `web_fetch_20250910` son las variantes BÁSICAS: las únicas que
      soporta Haiku 4.5. Las de filtrado dinámico (`_20260209` / `_20260318`) piden Claude 4.6+.
    · **Sin beta header.** Los dos tipos viven en `anthropic/types/` (no en `types/beta/`) y los
      acepta `client.messages.create` a secas.
    · `allowed_domains`: dominio pelado, sin esquema, subdominios incluidos. No convive con
      `blocked_domains` (400 si mandás los dos).
    · Un error de la tool NO levanta excepción: vuelve 200 y `content` pasa de ser una LISTA de
      resultados a ser un OBJETO con `error_code`. Hay que ramificar por eso antes de indexar.
    · Búsqueda sin resultados = lista vacía, NO error.
    · Precio: **$10 por 1.000 búsquedas** ⇒ $0,01 cada una. Un error no se factura.
    · **`web_fetch` no tiene costo adicional** — sólo los tokens del contenido. Corrige al encargo,
      que asumía que consumía presupuesto: no lo hace, y por eso el tope sólo cuenta búsquedas.
    · `web_fetch` sólo trae URLs que YA aparecieron en la conversación (control anti-exfiltración
      de Anthropic, error `url_not_in_prior_context`). Se cumple poniendo la URL en el mensaje.
    · El conteo exacto lo da la API: `usage.server_tool_use.web_search_requests` / `.web_fetch_requests`.

BASTIÓN — lo que devuelve la web es DATO, nunca instrucción
    Tres capas, en este orden:
      1. `allowed_domains` lo aplica el SERVIDOR de Anthropic: un dominio fuera de la whitelist no
         llega a existir como resultado.
      2. Acá se re-verifica el host de CADA URL devuelta contra la whitelist (defensa en
         profundidad: si un redirect terminara en otro lado, el resultado se descarta igual).
      3. El texto pasa por `sanear()`, que neutraliza los marcadores de control del prompt
         (`@@DATOS`, `@@ACCION`, `<<<`, `>>>`) y lo devuelve como texto plano citado. La regla N10
         de `SATO-IDENTIDAD.md` cierra el círculo del lado del modelo.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import os
import re
import time
import urllib.parse

# ── Rutas ────────────────────────────────────────────────────────────────────────────────────
_RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WHITELIST_PATH = os.path.join(_RAIZ, "docs", "WHITELIST-SATO-WEB.md")
_OUT = os.path.join(_RAIZ, "out")
LOG_SEARCH = os.path.join(_OUT, "web-search.jsonl")
LOG_FETCH = os.path.join(_OUT, "web-fetch.jsonl")
PRESUPUESTO_PATH = os.path.join(_OUT, "web-presupuesto.json")

# ── Constantes del contrato ──────────────────────────────────────────────────────────────────
USD_POR_BUSQUEDA = 0.01          # $10 / 1.000 búsquedas (tarifa oficial, 27/08/2026)
TOPE_USD_DEFAULT = 10.0
UMBRAL_AVISO = 0.80              # al 80% del tope, Sato avisa
MODELO = os.environ.get("SATO_WEB_MODELO", "claude-haiku-4-5").strip()
MAX_USOS_BUSQUEDA = 3            # una pregunta de voz no necesita más; es el techo duro por llamada
MAX_TOKENS_CONTENIDO = 20000     # tope de lo que web_fetch mete en contexto
_TTL_S = 60.0
_TIMEOUT_S = float(os.environ.get("SATO_WEB_TIMEOUT_S", "25"))

_MARCADORES = re.compile(r"@@DATOS|@@ACCION|<<<+|>>>+")

_cache: dict = {"cats": {}, "tope": TOPE_USD_DEFAULT, "mtime": 0.0, "chequeado": 0.0, "ok": False}
_lock = asyncio.Lock()


# ═══ WHITELIST ═══════════════════════════════════════════════════════════════════════════════

def _parsear(md: str) -> tuple[dict, float]:
    """Parser propio de 20 líneas en vez de PyYAML: §7 del encargo pide CERO deps nuevas, y el
    formato del archivo es deliberadamente trivial (`categoria:` + `  - dominio`)."""
    cats: dict[str, list[str]] = {}
    tope = TOPE_USD_DEFAULT
    actual = None
    dentro = False
    for cruda in md.splitlines():
        linea = cruda.rstrip()
        if linea.strip().startswith("```"):
            dentro = not dentro
            if not dentro:
                actual = None      # cerrar un bloque cierra la categoría: no se cuelan dominios sueltos
            continue
        if not dentro:
            continue
        s = linea.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("tope_usd_mes:"):
            try:
                tope = float(s.split(":", 1)[1].strip())
            except ValueError:
                pass
            continue
        if s.startswith("- "):
            if actual:
                d = s[2:].strip().strip("'\"").lower()
                if d:
                    cats[actual].append(d)
            continue
        if s.endswith(":"):
            actual = s[:-1].strip().lower()
            cats.setdefault(actual, [])
    return {k: v for k, v in cats.items() if v}, tope


def cargar_whitelist() -> dict:
    """Whitelist vigente, releída por mtime con TTL de 60 s.

    FAIL-CLOSED, a diferencia de `cargar_identidad()`: si el archivo no está, no se puede leer o
    quedó vacío, se devuelve la whitelist VACÍA y toda búsqueda queda rechazada. Un control de
    seguridad que falla abierto no es un control. (La identidad falla abierta porque una Sato sin
    identidad es peor que una Sato con la identidad vieja; una whitelist sin dominios es un
    permiso universal.)
    """
    ahora = time.time()
    if _cache["ok"] and (ahora - _cache["chequeado"]) < _TTL_S:
        return {"categorias": _cache["cats"], "tope_usd_mes": _cache["tope"], "ok": True}
    try:
        m = os.path.getmtime(WHITELIST_PATH)
        _cache["chequeado"] = ahora
        if m == _cache["mtime"] and _cache["ok"]:
            return {"categorias": _cache["cats"], "tope_usd_mes": _cache["tope"], "ok": True}
        with open(WHITELIST_PATH, encoding="utf-8") as fh:
            cats, tope = _parsear(fh.read())
        if not cats:
            raise ValueError("la whitelist no declara ni un dominio")
        _cache.update({"cats": cats, "tope": tope, "mtime": m, "ok": True})
        return {"categorias": cats, "tope_usd_mes": tope, "ok": True}
    except Exception as e:  # noqa: BLE001
        _cache["chequeado"] = ahora
        if _cache["ok"]:                       # se conserva la última buena: un save a medias no desarma el permiso
            return {"categorias": _cache["cats"], "tope_usd_mes": _cache["tope"], "ok": True}
        return {"categorias": {}, "tope_usd_mes": TOPE_USD_DEFAULT, "ok": False, "motivo": str(e)}


def dominios_de(categoria: str) -> list[str]:
    return list(cargar_whitelist()["categorias"].get(str(categoria or "").strip().lower(), []))


def todos_los_dominios() -> list[str]:
    vistos: list[str] = []
    for ds in cargar_whitelist()["categorias"].values():
        for d in ds:
            if d not in vistos:
                vistos.append(d)
    return vistos


def host_de(url: str) -> str:
    """Host en minúsculas, sin puerto y sin userinfo. `urlsplit` ya descarta el `user@` — que es
    justo el truco del que hay que cuidarse (`https://aeat.es@evil.com/` tiene host `evil.com`)."""
    u = str(url or "").strip()
    if not u:
        return ""
    if "://" not in u:
        u = "https://" + u
    try:
        h = urllib.parse.urlsplit(u).hostname or ""
    except ValueError:
        return ""
    return h.lower().rstrip(".")


def _cubre(dominio: str, host: str) -> bool:
    """`gencat.cat` cubre `hisenda.gencat.cat` pero NO `nogencat.cat` ni `gencat.cat.evil.com`."""
    d = dominio.split("/", 1)[0].strip().lower()     # la entrada puede traer path; para el host no sirve
    return bool(d) and (host == d or host.endswith("." + d))


def host_permitido(url: str, dominios: list[str] | None = None) -> bool:
    h = host_de(url)
    if not h:
        return False
    return any(_cubre(d, h) for d in (dominios if dominios is not None else todos_los_dominios()))


def sanear(texto, limite: int = 1200) -> str:
    """La web es dato HOSTIL. Se colapsa a texto plano y se neutralizan los marcadores de control
    del prompt: un `<<<` que venga DENTRO de un resultado no puede hacerse pasar por marcador de
    Sato (§7 de SATO-IDENTIDAD, llevado al canal nuevo)."""
    if not isinstance(texto, str):
        texto = str(texto)
    t = " ".join(texto.replace("\t", " ").replace("\r", " ").replace("\n", " ").split())
    t = _MARCADORES.sub("·", t)
    return (t[:limite].rstrip() + "…") if len(t) > limite else t


# ═══ PRESUPUESTO ═════════════════════════════════════════════════════════════════════════════

def _mes_actual() -> str:
    return datetime.date.today().strftime("%Y-%m")


def presupuesto() -> dict:
    """Estado del mes corriente. El reseteo del día 1 es implícito y por eso no puede fallar: el
    archivo guarda el mes al que corresponde el gasto, y si no es el de hoy se lee en cero. No hay
    cron, no hay tarea programada, no hay nada que se pueda olvidar de correr."""
    tope = cargar_whitelist()["tope_usd_mes"]
    mes = _mes_actual()
    usd, n = 0.0, 0
    try:
        with open(PRESUPUESTO_PATH, encoding="utf-8") as fh:
            d = json.load(fh)
        if str(d.get("mes")) == mes:
            usd = float(d.get("usd") or 0.0)
            n = int(d.get("busquedas") or 0)
    except Exception:  # noqa: BLE001 — sin archivo o corrupto = mes en cero, nunca bloquea
        pass
    return {"mes": mes, "usd": round(usd, 4), "busquedas": n, "tope": tope,
            "restante": round(max(0.0, tope - usd), 4),
            "agotado": usd >= tope,
            "aviso": (tope > 0 and usd >= tope * UMBRAL_AVISO and usd < tope)}


def _sumar(busquedas: int) -> dict:
    """Suma búsquedas facturables al mes corriente. Escritura entera (temp + replace) para que un
    corte no deje un JSON a medias que después se lea como cero."""
    p = presupuesto()
    usd = round(p["usd"] + busquedas * USD_POR_BUSQUEDA, 4)
    n = p["busquedas"] + busquedas
    try:
        os.makedirs(_OUT, exist_ok=True)
        tmp = PRESUPUESTO_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"mes": p["mes"], "usd": usd, "busquedas": n}, fh)
        os.replace(tmp, PRESUPUESTO_PATH)
    except Exception:  # noqa: BLE001
        pass
    return presupuesto()


def _log(path: str, fila: dict) -> None:
    try:
        os.makedirs(_OUT, exist_ok=True)
        fila = dict(fila)
        fila.setdefault("ts", datetime.datetime.now().isoformat(timespec="seconds"))
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(fila, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001 — el log jamás corta una tool
        pass


# ═══ CLIENTE ═════════════════════════════════════════════════════════════════════════════════

_cliente = None


def _get_cliente():
    """Cliente perezoso: sin `ANTHROPIC_API_KEY` no se construye y las tools contestan un error
    tipado en vez de reventar al importar el módulo."""
    global _cliente
    if _cliente is None:
        import anthropic
        _cliente = anthropic.AsyncAnthropic()
    return _cliente


def _bloques(msg):
    return list(getattr(msg, "content", None) or [])


def _texto_de(msg) -> str:
    return " ".join(b.text for b in _bloques(msg)
                    if getattr(b, "type", "") == "text" and getattr(b, "text", ""))


def _usos(msg, campo: str) -> int:
    stu = getattr(getattr(msg, "usage", None), "server_tool_use", None)
    v = getattr(stu, campo, 0) if stu else 0
    return int(v or 0)


# ═══ TOOLS ═══════════════════════════════════════════════════════════════════════════════════

async def buscar(query: str, categoria: str) -> dict:
    """Busca `query` restringido a los dominios de `categoria`.

    Devuelve siempre un dict con `ok`. Con `ok=False` viene un `error` TIPADO:
      `whitelist_no_disponible` · `categoria_desconocida` · `presupuesto_agotado` ·
      `sin_resultados` · `error_tool` · `error_api`.
    """
    q = sanear(query, 380)
    cat = str(categoria or "").strip().lower()
    wl = cargar_whitelist()

    if not wl["ok"]:
        return {"ok": False, "error": "whitelist_no_disponible", "detalle": wl.get("motivo", "")}

    dominios = wl["categorias"].get(cat, [])
    if not dominios:
        return {"ok": False, "error": "categoria_desconocida", "categoria": cat,
                "categorias": sorted(wl["categorias"].keys())}

    pre = presupuesto()
    if pre["agotado"]:
        _log(LOG_SEARCH, {"query": q, "categoria": cat, "ok": False, "error": "presupuesto_agotado",
                          "usd": pre["usd"], "tope": pre["tope"]})
        return {"ok": False, "error": "presupuesto_agotado", "usado": pre["usd"], "tope": pre["tope"]}

    if not q:
        return {"ok": False, "error": "error_tool", "codigo": "query_vacia"}

    try:
        msg = await asyncio.wait_for(_get_cliente().messages.create(
            model=MODELO,
            max_tokens=1024,
            system=("Buscás en la web y contestás en español rioplatense, en 2 a 4 oraciones, "
                    "para que alguien lo ESCUCHE: sin listas, sin markdown, sin URLs habladas. "
                    "Nombrá el dominio de la fuente. Si los resultados no contestan la pregunta, "
                    "decilo — no completes con lo que sepas de memoria."),
            messages=[{"role": "user", "content": q}],
            tools=[{"type": "web_search_20250305", "name": "web_search",
                    "max_uses": MAX_USOS_BUSQUEDA, "allowed_domains": dominios}],
        ), timeout=_TIMEOUT_S)
    except asyncio.TimeoutError:
        _log(LOG_SEARCH, {"query": q, "categoria": cat, "ok": False, "error": "error_api",
                          "detalle": "timeout %ss" % _TIMEOUT_S})
        return {"ok": False, "error": "error_api", "detalle": "la búsqueda tardó demasiado"}
    except Exception as e:  # noqa: BLE001
        _log(LOG_SEARCH, {"query": q, "categoria": cat, "ok": False, "error": "error_api",
                          "detalle": type(e).__name__})
        return {"ok": False, "error": "error_api", "detalle": type(e).__name__}

    # ── Lectura de los bloques. `content` de un resultado es LISTA si salió bien y OBJETO si falló.
    resultados, err_tool = [], ""
    for b in _bloques(msg):
        if getattr(b, "type", "") != "web_search_tool_result":
            continue
        cont = getattr(b, "content", None)
        if isinstance(cont, list):
            for r in cont:
                url = getattr(r, "url", "") or ""
                # Capa 2 de Bastión: el filtro ya lo aplicó el servidor, pero se re-verifica acá.
                # Si un resultado no matchea la whitelist de ESTA categoría, se descarta y se anota.
                if not host_permitido(url, dominios):
                    _log(LOG_SEARCH, {"query": q, "categoria": cat, "ok": False,
                                      "error": "whitelist_violation", "url_descartada": url[:200]})
                    continue
                resultados.append({"url": url, "titulo": sanear(getattr(r, "title", ""), 160),
                                   "edad": getattr(r, "page_age", None)})
        else:
            err_tool = str(getattr(cont, "error_code", "") or "desconocido")

    n = _usos(msg, "web_search_requests")
    pre2 = _sumar(n) if n else presupuesto()
    texto = sanear(_texto_de(msg), 1400)

    fila = {"query": q, "categoria": cat, "resultados": len(resultados), "busquedas": n,
            "usd": round(n * USD_POR_BUSQUEDA, 4), "usd_mes": pre2["usd"], "tope": pre2["tope"],
            "dominios": sorted({host_de(r["url"]) for r in resultados}),
            "ok": bool(resultados or texto) and not err_tool}

    if err_tool:
        _log(LOG_SEARCH, {**fila, "ok": False, "error": "error_tool", "codigo": err_tool})
        return {"ok": False, "error": "error_tool", "codigo": err_tool}
    if not resultados:
        _log(LOG_SEARCH, {**fila, "ok": False, "error": "sin_resultados"})
        return {"ok": False, "error": "sin_resultados", "categoria": cat,
                "dominios": dominios, "aviso": pre2["aviso"], "usado": pre2["usd"], "tope": pre2["tope"]}

    _log(LOG_SEARCH, fila)
    return {"ok": True, "texto": texto, "resultados": resultados,
            "fuentes": sorted({host_de(r["url"]) for r in resultados}),
            "aviso": pre2["aviso"], "usado": pre2["usd"], "tope": pre2["tope"]}


async def traer(url: str) -> dict:
    """Trae el contenido de UNA url, si su host está en cualquier categoría de la whitelist.

    No consume presupuesto: `web_fetch` no tiene costo adicional (sólo tokens).
    """
    u = str(url or "").strip()
    wl = cargar_whitelist()
    if not wl["ok"]:
        return {"ok": False, "error": "whitelist_no_disponible", "detalle": wl.get("motivo", "")}

    h = host_de(u)
    if not h or not u.lower().startswith(("http://", "https://")):
        return {"ok": False, "error": "url_invalida", "url": u[:200]}
    if not host_permitido(u):
        _log(LOG_FETCH, {"url": u[:200], "host": h, "ok": False, "error": "whitelist_violation"})
        return {"ok": False, "error": "whitelist_violation", "host": h}

    try:
        msg = await asyncio.wait_for(_get_cliente().messages.create(
            model=MODELO,
            max_tokens=1024,
            system=("Resumís la página en español rioplatense, en 2 a 4 oraciones, para que alguien "
                    "lo ESCUCHE: sin listas, sin markdown. Nombrá el dominio. Si la página no dice "
                    "lo que se pregunta, decilo — no completes de memoria."),
            # La URL va en el mensaje A PROPÓSITO: `web_fetch` sólo trae URLs que ya aparecieron en
            # la conversación (control anti-exfiltración de Anthropic, `url_not_in_prior_context`).
            messages=[{"role": "user", "content": "Traé y resumí esta página: " + u}],
            tools=[{"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 1,
                    "allowed_domains": [h], "max_content_tokens": MAX_TOKENS_CONTENIDO}],
        ), timeout=_TIMEOUT_S)
    except asyncio.TimeoutError:
        _log(LOG_FETCH, {"url": u[:200], "host": h, "ok": False, "error": "error_api",
                         "detalle": "timeout %ss" % _TIMEOUT_S})
        return {"ok": False, "error": "error_api", "detalle": "la página tardó demasiado"}
    except Exception as e:  # noqa: BLE001
        _log(LOG_FETCH, {"url": u[:200], "host": h, "ok": False, "error": "error_api",
                         "detalle": type(e).__name__})
        return {"ok": False, "error": "error_api", "detalle": type(e).__name__}

    err_tool, url_final, trajo = "", "", False
    for b in _bloques(msg):
        if getattr(b, "type", "") != "web_fetch_tool_result":
            continue
        cont = getattr(b, "content", None)
        if getattr(cont, "type", "") == "web_fetch_result":
            trajo = True
            url_final = getattr(cont, "url", "") or u
        else:
            err_tool = str(getattr(cont, "error_code", "") or "desconocido")

    if err_tool:
        _log(LOG_FETCH, {"url": u[:200], "host": h, "ok": False, "error": "error_tool", "codigo": err_tool})
        return {"ok": False, "error": "error_tool", "codigo": err_tool}
    if not trajo:
        _log(LOG_FETCH, {"url": u[:200], "host": h, "ok": False, "error": "sin_contenido"})
        return {"ok": False, "error": "sin_contenido", "url": u[:200]}

    # Capa 2 otra vez: si el fetch terminó en OTRO host (redirect), el contenido se descarta.
    # `allowed_domains=[h]` ya debería frenarlo del lado del servidor; esto es el cinturón.
    if not host_permitido(url_final):
        _log(LOG_FETCH, {"url": u[:200], "host": h, "url_final": url_final[:200],
                         "ok": False, "error": "redirect_fuera_de_whitelist"})
        return {"ok": False, "error": "redirect_fuera_de_whitelist",
                "host": h, "host_final": host_de(url_final)}

    texto = sanear(_texto_de(msg), 1400)
    _log(LOG_FETCH, {"url": u[:200], "host": h, "url_final": url_final[:200],
                     "fetches": _usos(msg, "web_fetch_requests"), "chars": len(texto), "ok": True})
    return {"ok": True, "texto": texto, "fuente": host_de(url_final), "url": url_final}
