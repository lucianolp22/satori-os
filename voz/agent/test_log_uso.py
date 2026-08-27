"""Ejercita _log_uso con objetos REALES de livekit.agents.metrics (no stubs adivinados:
regla STUB DIVERGENTE = VERDE FALSO, CLAUDE.md 24-jul)."""
import importlib.util, json, os, sys, tempfile, types

sys.path.insert(0, os.path.dirname(os.path.abspath("agent.py")))
from livekit.agents.metrics.base import LLMMetrics, STTMetrics, TTSMetrics, VADMetrics, EOUMetrics, Metadata

# Se carga agent.py sin ejecutar el entrypoint (import normal: el módulo no arranca nada al importarse).
spec = importlib.util.spec_from_file_location("agentmod", "agent.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

tmp = tempfile.mktemp(suffix=".jsonl")
m._TOKENS_LOG = tmp

fallos = 0
def check(c, msg):
    global fallos
    print(("OK  " if c else "FALLA ") + msg)
    if not c: fallos += 1

# 1) Turno de LLM normal, con cache caliente.
m._log_uso(LLMMetrics(label="anthropic.LLM", request_id="req_1", timestamp=1.0, duration=0.9,
    ttft=0.55, cancelled=False, completion_tokens=32, prompt_tokens=5508,
    prompt_cached_tokens=5376, total_tokens=5540, tokens_per_second=35.5,
    metadata=Metadata(model_name="claude-haiku-4-5", model_provider="anthropic")))

# 2) Primer turno: cache fria (cache_read == 0). El 0 tiene que sobrevivir, no volverse null.
m._log_uso(LLMMetrics(label="anthropic.LLM", request_id="req_2", timestamp=2.0, duration=3.1,
    ttft=3.15, cancelled=False, completion_tokens=27, prompt_tokens=5625,
    prompt_cached_tokens=0, total_tokens=5652, tokens_per_second=8.7,
    metadata=Metadata(model_name="claude-haiku-4-5", model_provider="anthropic")))

# 3) Turno cancelado con prompt_tokens=0: el bug de la cadena `or` lo mandaba a null.
m._log_uso(LLMMetrics(label="anthropic.LLM", request_id="req_3", timestamp=3.0, duration=0.1,
    ttft=1.28, cancelled=True, completion_tokens=0, prompt_tokens=0,
    prompt_cached_tokens=0, total_tokens=0, tokens_per_second=0.0))

# 4) Ruido del pipeline: NADA de esto debe entrar al log de tokens.
m._log_uso(STTMetrics(label="deepgram.STT", request_id="s1", timestamp=4.0, duration=0.0,
    audio_duration=1.2, streamed=True))
m._log_uso(TTSMetrics(label="elevenlabs.TTS", request_id="t1", timestamp=5.0, ttfb=0.2,
    duration=0.8, audio_duration=1.1, cancelled=False, characters_count=42, streamed=True))
m._log_uso(VADMetrics(label="silero.VAD", timestamp=6.0, idle_time=0.4,
    inference_duration_total=0.01, inference_count=3))
m._log_uso(EOUMetrics(timestamp=7.0, end_of_utterance_delay=0.3, transcription_delay=0.1,
    on_user_turn_completed_delay=0.02))

# 5) Un objeto cualquiera sin `type`: no rompe y no escribe.
m._log_uso(types.SimpleNamespace(prompt_tokens=999))

filas = [json.loads(l) for l in open(tmp) if l.strip()]
check(len(filas) == 3, f"solo entran los 3 eventos de LLM (entraron {len(filas)}; antes entraban los 7)")
a, b, c = filas
check(a["input"] == 5508 and a["output"] == 32 and a["cache_read"] == 5376, "turno caliente: valores reales")
check(a["hit"] == round(5376/5508, 4), f"hit-rate con el denominador bueno (dio {a['hit']}, esperaba {round(5376/5508,4)})")
check(a["modelo"] == "claude-haiku-4-5" and a["proveedor"] == "anthropic", "modelo/proveedor los reporta el proveedor")
check(a["ttft_s"] == 0.55 and a["dur_s"] == 0.9 and a["tps"] == 35.5, "latencias")
check(a["cache_write"] is None and "livekit" in a["cache_write_motivo"], "cache_write null CON motivo escrito")
check(b["cache_read"] == 0 and b["hit"] == 0.0, "cache fria: el 0 se loguea como 0, no como null")
check(c["input"] == 0 and c["output"] == 0 and c["cancelado"] is True,
      f"turno cancelado: los ceros sobreviven a la cadena `or` (dio input={c['input']}, output={c['output']})")
check(c["hit"] is None, "hit es null si no hay denominador (no una division por cero)")
os.unlink(tmp)
print(f"\nRESULTADO: FALLA {fallos}")
sys.exit(1 if fallos else 0)
