"""Build model samples from supplied records and intent data files."""

from __future__ import annotations

from pathlib import Path
import json
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[2]



def build_training_samples(records: list[Mapping[str, Any]]) -> tuple[list[str], list[str]]:
    """Convert AI Insights facts into text samples and deterministic risk labels."""
    texts: list[str] = []
    labels: list[str] = []
    for row in records:
        qty = max(0, int(row["current_qty"]))
        buffer = max(1, int(row["par_level"]))
        sold_7d = max(0, int(row["sold_7d"]))
        daily = sold_7d / 7
        cover = qty / daily if daily > 0 else (99.0 if qty > 0 else 0.0)
        critical = max(0, int(row["critical_count"]))
        has_order = bool(row["has_active_order"])
        if qty <= max(10, buffer * 0.2) or cover < 2 or critical >= 3:
            label = "urgent_restock"
        elif has_order or cover < 6 or qty <= buffer * 0.5:
            label = "regular_order"
        else:
            label = "normal"
        text = (
            f"Mitra {row['partner_name']} tipe {row['partner_type']} produk {row['product_name']}. "
            f"Sisa stok {qty} pcs, buffer minimal {buffer} pcs, stok pusat {int(row['central_stock'])} pcs. "
            f"Log konsumsi 7 hari {sold_7d} pcs, 7 hari sebelumnya {int(row['sold_prev_7d'])} pcs, "
            f"30 hari {int(row['sold_30d'])} pcs dari {int(row['report_count'])} laporan. "
            f"Cakupan stok {cover:.1f} hari, kejadian kritis {critical} kali. "
            f"Pesanan 30 hari {int(row['requested_30d'])} pcs, disetujui {int(row['approved_30d'])} pcs, "
            f"pesanan aktif {'ada' if has_order else 'tidak ada'}."
        )
        texts.append(text)
        labels.append(label)
    return texts, labels


def load_intent_examples() -> dict[str, list[str]]:
    intent_dir = ROOT / "ai" / "data" / "mega_data_word" / "intent"
    path = intent_dir / "training_examples.json"
    with path.open(encoding="utf-8") as source:
        data = json.load(source)
    examples = {intent: list(phrases) for intent, phrases in data["intents"].items()}
    for phrase_file in sorted((intent_dir / "training").glob("*.json")):
        with phrase_file.open(encoding="utf-8") as source:
            supplement = json.load(source)
        intent = supplement.get("intent")
        phrases = supplement.get("phrases")
        if intent not in examples or not isinstance(phrases, list) or not all(isinstance(value, str) and value.strip() for value in phrases):
            raise ValueError(f"Dataset intent tidak valid: {phrase_file.name}")
        examples[intent].extend(phrases)
    normalized = {intent: list(dict.fromkeys(phrase.strip().casefold() for phrase in phrases)) for intent, phrases in examples.items()}
    owners: dict[str, str] = {}
    for intent, phrases in normalized.items():
        for phrase in phrases:
            previous = owners.get(phrase)
            if previous and previous != intent:
                raise ValueError(f"Frasa training ambigu: {phrase}")
            owners[phrase] = intent
    return normalized


def build_intent_samples() -> tuple[list[str], list[str]]:
    examples = load_intent_examples()
    return (
        [sample for samples in examples.values() for sample in samples],
        [intent for intent, samples in examples.items() for _ in samples],
    )
