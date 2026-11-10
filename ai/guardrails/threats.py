"""
Threat Defense & Pattern Matching for LLM Guardrails.
Mencegah Prompt Injection, Jailbreak, System Prompt Leakage, dan Bypass Peran.
"""

from typing import Tuple, List
from .data_loader import matches

# Pola regex untuk mendeteksi upaya manipulasi sistem (Prompt Injection & Jailbreak)
PROMPT_INJECTION_FILE = "mega_data_word/guardrails/prompt_injections.json"
SYSTEM_PROBE_FILE = "mega_data_word/guardrails/system_probe.json"


def check_input_threats(user_input: str) -> Tuple[bool, str]:
    """
    Memeriksa input user terhadap ancaman keamanan (Pre-guardrail).
    Returns (is_threat, reason)
    """
    if not user_input or not user_input.strip():
        return False, ""

    text = user_input.strip()

    # 1. Cek upaya Prompt Injection / Jailbreak
    if matches(PROMPT_INJECTION_FILE, text):
        return True, "PROMPT_INJECTION_DETECTED"

    # 2. Cek upaya ekstraksi kredensial atau skema internal
    if matches(SYSTEM_PROBE_FILE, text):
        return True, "SENSITIVE_TERM_PROBE"

    return False, ""


def check_output_leakage(llm_output: str) -> Tuple[bool, str]:
    """
    Memeriksa output LLM apakah tidak sengaja membocorkan instruksi sistem
    atau token rahasia (Post-guardrail).
    """
    if matches(SYSTEM_PROBE_FILE, llm_output):
        return True, "SYSTEM_DATA_LEAKAGE"

    return False, ""
