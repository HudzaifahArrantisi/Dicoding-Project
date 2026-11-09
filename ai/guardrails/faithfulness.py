"""
Context Grounding & Faithfulness Engine.
Memverifikasi bahwa respons LLM 100% didasarkan pada data faktual RAG,
tanpa halusinasi angka, nomor PO fiktif, atau klaim tindakan palsu.
"""

import re
from typing import Set, Dict, Any, Tuple
from .rules import (
    OFFICIAL_PRODUCTS,
    FORBIDDEN_TERMS_REPRESENTING_CEILING,
    MUTATION_CLAIM_VERBS,
    calculate_stock_status,
)


def extract_allowed_numbers(data: Any, results: Set[str] = None) -> Set[str]:
    """Ekstraksi rekursif seluruh angka yang sah dari FAKTA_JSON."""
    if results is None:
        results = set()

    if isinstance(data, (int, float)):
        results.add(str(data))
        # Format Indonesia (misal 1000 -> 1.000 atau koma desimal)
        if isinstance(data, float):
            results.add(f"{data:.1f}".replace(".", ","))
            results.add(f"{data:.1f}")
        results.add(str(int(data)))
    elif isinstance(data, list):
        for item in data:
            extract_allowed_numbers(item, results)
    elif isinstance(data, dict):
        for value in data.values():
            extract_allowed_numbers(value, results)

    return results


def verify_grounded_reply(reply: str, facts: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Evaluasi ketat kepatuhan respon LLM terhadap fakta RAG.
    Mengembalikan (is_grounded, failure_reason)
    """
    if not reply or not reply.strip():
        return False, "EMPTY_REPLY"

    if len(reply) > 3000:
        return False, "REPLY_EXCEEDS_MAX_LENGTH"

    # 1. Tolak HTML, skrip mencurigakan, atau hyperlink luar
    if re.search(r"https?://|```|<\/?[a-z][^>]*>", reply, re.IGNORECASE):
        return False, "FORBIDDEN_FORMAT_OR_HTML"

    # 2. Cek istilah plafon kapasitas (pelanggaran Unbounded Stock)
    for term in FORBIDDEN_TERMS_REPRESENTING_CEILING:
        if term in reply.lower():
            return False, f"UNBOUNDED_STOCK_VIOLATION:{term}"

    # 3. Cek klaim mutasi palsu (LLM berhalusinasi telah mengeksekusi aksi)
    for verb in MUTATION_CLAIM_VERBS:
        if re.search(rf"\b{verb}\b", reply, re.IGNORECASE):
            return False, f"MUTATION_CLAIM_VIOLATION:{verb}"

    # 4. Verifikasi Nomor PO (Hanya nomor PO nyata di fakta yang boleh disebut)
    active_orders = facts.get("operational_facts", {}).get("active_orders", [])
    recent_orders = facts.get("operational_facts", {}).get("recent_orders", [])
    known_orders = {
        order["order_no"].upper()
        for order in (active_orders + recent_orders)
        if "order_no" in order
    }

    mentioned_orders = re.findall(r"\bPO-[A-Z0-9-]+\b", reply, re.IGNORECASE)
    for po in mentioned_orders:
        if po.upper() not in known_orders:
            return False, f"FABRICATED_ORDER_NO:{po}"

    # 5. Verifikasi Angka Numerik (Zero Numerical Hallucination)
    # Hapus nomor PO terlebih dahulu agar tidak dianggap angka biasa
    text_without_po = re.sub(r"\bPO-[A-Z0-9-]+\b", "", reply, flags=re.IGNORECASE)
    allowed_numbers = extract_allowed_numbers(facts)

    # Tambahkan angka hari kalender atau period umum yang diizinkan (7 hari, 24 jam, 4 produk)
    allowed_numbers.update({"1", "2", "3", "4", "7", "14", "24"})

    found_numbers = re.findall(r"\b\d+(?:[.,]\d+)?\b", text_without_po)
    for num in found_numbers:
        clean_num = num.replace(",", ".")
        if num not in allowed_numbers and clean_num not in allowed_numbers:
            return False, f"UNAUTHORIZED_NUMBER:{num}"

    # 6. Verifikasi Nama Produk (Hanya 4 produk resmi, tulis nama lengkap)
    for official in OFFICIAL_PRODUCTS:
        alias = official.split()[0]  # Misal "Dimsum"
        # Jika menyebut kata Dimsum tapi tidak ada satupun nama resmi yang cocok
        if re.search(rf"\b{alias}\b", reply, re.IGNORECASE):
            has_valid_official = any(p.lower() in reply.lower() for p in OFFICIAL_PRODUCTS)
            if not has_valid_official:
                return False, "INCOMPLETE_OFFICIAL_PRODUCT_NAME"

    return True, "VERIFIED_GROUNDED"
