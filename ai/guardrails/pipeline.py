"""
Unified Guardrail Pipeline for Daisuki AI Chatbot.
Menggabungkan Pre-guardrail, Prompt Generation, dan Post-guardrail.
"""

from typing import Dict, Any, Tuple, Optional
from .threats import check_input_threats, check_output_leakage
from .faithfulness import verify_grounded_reply
from .prompt import build_system_prompt


class GuardrailPipeline:
    def __init__(self, fallback_message: Optional[str] = None):
        self.default_fallback = fallback_message or (
            "Halo! Saat ini saya hanya dapat memberikan informasi resmi berdasarkan catatan stok fisik, "
            "pesanan restock aktif, dan laju konsumsi mingguan cabang Anda. "
            "Silakan cek tab Laporan Harian atau menu Restock untuk rincian data Anda."
        )

    def pre_check(self, user_message: str) -> Tuple[bool, Optional[str]]:
        """
        Pemeriksaan input user sebelum dikirim ke LLM (Layer 1).
        Mengembalikan (is_safe, error_or_blocked_response)
        """
        is_threat, reason = check_input_threats(user_message)
        if is_threat:
            if reason == "PROMPT_INJECTION_DETECTED":
                return False, (
                    "Maaf, permintaan Anda tidak dapat diproses karena mengandung instruksi di luar batas kewenangan asisten inventaris."
                )
            if reason == "SENSITIVE_TERM_PROBE":
                return False, (
                    "Akses ditolak: Permintaan informasi konfigurasi atau kredensial internal tidak diizinkan."
                )
            return False, self.default_fallback

        return True, None

    def create_prompt(
        self,
        facts: Dict[str, Any],
        memory: Optional[Dict[str, Any]] = None
    ) -> str:
        """Membuat system prompt lengkap berbasis fakta (Layer 2)."""
        return build_system_prompt(facts, memory)

    def post_check(
        self,
        llm_reply: str,
        facts: Dict[str, Any]
    ) -> Tuple[bool, str, str]:
        """
        Pemeriksaan respons LLM sebelum ditampilkan ke pengguna (Layer 4).
        Mengembalikan (is_valid, final_reply, audit_status)
        """
        # 1. Cek kebocoran informasi sistem
        has_leak, leak_reason = check_output_leakage(llm_reply)
        if has_leak:
            return False, self.default_fallback, f"LEAKAGE_BLOCKED:{leak_reason}"

        # 2. Cek grounding & faithfulness (angka, PO, produk, plafon)
        is_grounded, ground_reason = verify_grounded_reply(llm_reply, facts)
        if not is_grounded:
            return False, self.default_fallback, f"UNGROUNDED_BLOCKED:{ground_reason}"

        return True, llm_reply, "PASSED_GROUNDED"
