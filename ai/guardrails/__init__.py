"""
Daisuki AI Guardrails & Context Grounding Workspace.
Package init.
"""

from .rules import (
    OFFICIAL_PRODUCTS,
    ALLOWED_ORDER_STATUSES,
    STOCK_THRESHOLDS,
    calculate_stock_status,
)
from .threats import check_input_threats, check_output_leakage
from .faithfulness import verify_grounded_reply, extract_allowed_numbers
from .prompt import build_system_prompt
from .pipeline import GuardrailPipeline

__all__ = [
    "OFFICIAL_PRODUCTS",
    "ALLOWED_ORDER_STATUSES",
    "STOCK_THRESHOLDS",
    "calculate_stock_status",
    "check_input_threats",
    "check_output_leakage",
    "verify_grounded_reply",
    "extract_allowed_numbers",
    "build_system_prompt",
    "GuardrailPipeline",
]
