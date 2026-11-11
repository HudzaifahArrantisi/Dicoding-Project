from __future__ import annotations

import csv
import json
import math
import os
from pathlib import Path

import psycopg

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(path: Path | None = None) -> None:
        env_path = path or Path(".env")
        if not env_path.exists():
            return
        for line in env_path.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if separator and key.strip() and not key.lstrip().startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data-science" / "reports" / "cleaned_inventory_summary.csv"
SOURCE_PATH = ROOT / "data-science" / "reports" / "weekly_analytics_summary.json"
RISK_PATH = ROOT / "ai" / "data" / "mainbrain" / "context_embeddings" / "regional_item_risks.json"
MODEL_VERSION = "v2.0-deep-naive-bayes"
LEAD_TIME_DAYS = 7


def read_rows() -> list[dict[str, str]]:
    with DATA_PATH.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def load_risks() -> dict[tuple[str, str], dict]:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    risks = json.loads(RISK_PATH.read_text(encoding="utf-8"))
    if risks.get("source_generated_at") != source.get("metadata", {}).get("generated_at"):
        raise ValueError("Skor risiko tidak cocok dengan laporan Data Science terbaru")
    return {(item["partner_id"], item["product_id"]): item for item in risks["items"]}


def allocate_recommendations() -> int:
    load_dotenv(ROOT / "ai" / ".env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL wajib di ai/.env untuk menyimpan rekomendasi.")
    rows = read_rows()
    risks = load_risks()
    if not rows:
        print("Dataset bersih kosong; tidak ada rekomendasi untuk disimpan.")
        return 0

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            product_ids = {row["product_id"] for row in rows}
            cursor.execute("SELECT id::text, central_stock FROM products WHERE id::text = ANY(%s) AND is_active = true", (list(product_ids),))
            remaining_stock = {product_id: int(stock) for product_id, stock in cursor.fetchall()}
            if any((row["partner_id"], row["product_id"]) not in risks for row in rows):
                raise ValueError("Skor risiko mitra-produk belum lengkap")
            ranked = sorted(rows, key=lambda row: (-risks[(row["partner_id"], row["product_id"])]["stockout_probability"], float(row["days_of_cover"] or 0)))
            generated = 0
            for row in ranked:
                product_id = row["product_id"]
                current = int(float(row["current_qty"]))
                safety = int(float(row["safety_stock"]))
                adu = float(row["adu"])
                suggested_par_level = max(1, math.ceil(adu * LEAD_TIME_DAYS + safety))
                demand = max(0, suggested_par_level - current)
                available = remaining_stock.get(product_id, 0)
                suggested = min(demand, available)
                remaining_stock[product_id] = available - suggested
                cursor.execute("""
                    INSERT INTO restock_recommendations
                        (partner_id, product_id, forecast_qty, suggested_qty, days_of_cover, model_version, generated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (partner_id, product_id) DO UPDATE SET
                        forecast_qty = EXCLUDED.forecast_qty,
                        suggested_qty = EXCLUDED.suggested_qty,
                        days_of_cover = EXCLUDED.days_of_cover,
                        model_version = EXCLUDED.model_version,
                        generated_at = NOW()
                """, (row["partner_id"], product_id, round(adu * LEAD_TIME_DAYS), suggested, float(row["days_of_cover"]), MODEL_VERSION))
                generated += 1
                if risks[(row["partner_id"], product_id)]["risk_level"] == "TINGGI" and suggested > 0:
                    cursor.execute("""
                        INSERT INTO notifications (audience, type, partner_id, title, body)
                        SELECT 'admin', 'low_stock', %s, %s, %s
                        WHERE NOT EXISTS (
                            SELECT 1 FROM notifications existing
                            WHERE existing.audience = 'admin'
                              AND existing.type = 'low_stock'
                              AND existing.partner_id = %s
                              AND existing.title = %s
                              AND existing.body LIKE %s
                              AND existing.resolved_at IS NULL
                              AND existing.created_at >= NOW() - INTERVAL '24 hours'
                        )
                    """, (row["partner_id"], f"Prioritas Suplai: {row['partner_name']}", f"{row['partner_name']} sering kehabisan {row['product_name']}. Disarankan kirim {suggested} pcs.", row["partner_id"], f"Prioritas Suplai: {row['partner_name']}", f"%kehabisan {row['product_name']}.%"))
            connection.commit()
    print(f"Rekomendasi upsert: {generated}; versi model: {MODEL_VERSION}")
    return generated


if __name__ == "__main__":
    allocate_recommendations()
