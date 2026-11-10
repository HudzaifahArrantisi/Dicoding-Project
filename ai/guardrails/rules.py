"""
Aturan Domain & Batasan Operasional Inventaris Daisuki B2B.
Source of Truth: CLAUDE.md & packages/shared/src/index.ts
"""

from .data_loader import load_json

_rules = load_json("mainbrain/corporate_knowledge/business_rules.json")
OFFICIAL_PRODUCTS = _rules["official_products"]
ALLOWED_ORDER_STATUSES = _rules["allowed_order_statuses"]
STOCK_THRESHOLDS = _rules["stock_thresholds"]
FORBIDDEN_TERMS_REPRESENTING_CEILING = _rules["forbidden_ceiling_terms"]
MUTATION_CLAIM_VERBS = _rules["mutation_claim_verbs"]


def calculate_stock_status(current_qty: int, par_level: int) -> str:
    """Menghitung status stok sesuai aturan resmi shared package."""
    if par_level <= 0:
        return "aman"
    ratio = current_qty / par_level
    if ratio > STOCK_THRESHOLDS["AMAN_MIN_RATIO"]:
        return "aman"
    if ratio > STOCK_THRESHOLDS["WASPADA_MIN_RATIO"]:
        return "waspada"
    return "kritis"
