"""
Threat Defense & Pattern Matching for LLM Guardrails.
Mencegah Prompt Injection, Jailbreak, System Prompt Leakage, dan Bypass Peran.
"""

import re
from typing import Tuple, List

# Pola regex untuk mendeteksi upaya manipulasi sistem (Prompt Injection & Jailbreak)
PROMPT_INJECTION_PATTERNS = [
    r"(?i)abaikan\s+(semua\s+)?(instruksi|aturan|perintah)\s+(sebelumnya|di\s+atas)",
    r"(?i)ignore\s+(all\s+)?(previous\s+)?(instructions|prompts|rules)",
    r"(?i)sekarang\s+kamu\s+adalah\s+(bukan|bot\s+bebas|ai\s+tanpa\s+aturan|dan)",
    r"(?i)you\s+are\s+now\s+(in\s+developer\s+mode|dan|unrestricted)",
    r"(?i)mode\s+(pengembang|developer|tanpa\s+batas|bebas)\s+(aktif|on)",
    r"(?i)(tampilkan|bocorkan|tuliskan|spill)\s+(system\s+prompt|instruksi\s+asli|prompt\s+awal)",
    r"(?i)what\s+is\s+your\s+(system\s+prompt|initial\s+prompt|instructions)",
    r"(?i)pretend\s+(you\s+have\s+no\s+rules|to\s+be\s+an\s+unfiltered)",
    r"(?i)bypass\s+(filter|safety|guardrail|rule)",
    r"(?i)tuliskan\s+ulang\s+seluruh\s+instruksi\s+di\s+atas",
]

# Pola deteksi kebocoran informasi teknis backend
LEAKAGE_INDICATORS = [
    r"(?i)(postgres|postgresql)://",
    r"(?i)daisuki_token",
    r"(?i)9router",
    r"(?i)assistant_conversation_memory",
    r"(?i)jwt_secret",
    r"(?i)SELECT\s+.+\s+FROM\s+users",
]


def check_input_threats(user_input: str) -> Tuple[bool, str]:
    """
    Memeriksa input user terhadap ancaman keamanan (Pre-guardrail).
    Returns (is_threat, reason)
    """
    if not user_input or not user_input.strip():
        return False, ""

    text = user_input.strip()

    # 1. Cek upaya Prompt Injection / Jailbreak
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text):
            return True, "PROMPT_INJECTION_DETECTED"

    # 2. Cek upaya ekstraksi kredensial atau skema internal
    for pattern in LEAKAGE_INDICATORS:
        if re.search(pattern, text):
            return True, "SENSITIVE_TERM_PROBE"

    return False, ""


def check_output_leakage(llm_output: str) -> Tuple[bool, str]:
    """
    Memeriksa output LLM apakah tidak sengaja membocorkan instruksi sistem
    atau token rahasia (Post-guardrail).
    """
    for pattern in LEAKAGE_INDICATORS:
        if re.search(pattern, llm_output):
            return True, "SYSTEM_DATA_LEAKAGE"

    if re.search(r"(?i)FAKTA_JSON\s*:\s*\{", llm_output):
        return True, "RAW_JSON_PROMPT_LEAKAGE"

    return False, ""
