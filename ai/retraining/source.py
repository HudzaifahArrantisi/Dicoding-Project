"""Read the operational facts used by the admin AI Insights panel."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Mapping

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

LOGGER = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[2]

# The same source tables and windows used by admin AI Insights:
# stock_logs (manual consumption), partner_stocks, partners, products, orders.
TRAINING_QUERY = """
WITH sales AS (
  SELECT partner_id, product_id,
    COALESCE(SUM(qty_before - qty_after) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::int AS sold_7d,
    COALESCE(SUM(qty_before - qty_after) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'), 0)::int AS sold_prev_7d,
    COALESCE(SUM(qty_before - qty_after), 0)::int AS sold_30d,
    COUNT(*)::int AS report_count
  FROM stock_logs
  WHERE source = 'manual_update' AND qty_before > qty_after
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY partner_id, product_id
), critical AS (
  SELECT ps.partner_id, ps.product_id,
    COUNT(sl.id)::int AS critical_count
  FROM partner_stocks ps
  LEFT JOIN stock_logs sl ON sl.partner_id = ps.partner_id
    AND sl.product_id = ps.product_id
    AND sl.created_at >= NOW() - INTERVAL '30 days'
    AND sl.qty_after <= GREATEST(10, ps.par_level * 0.2)
  GROUP BY ps.partner_id, ps.product_id
), order_summary AS (
  SELECT o.partner_id, oi.product_id,
    COALESCE(SUM(oi.qty_requested) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days'), 0)::int AS requested_30d,
    COALESCE(SUM(oi.qty_approved) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days' AND o.status IN ('disetujui', 'dalam_pengiriman', 'selesai')), 0)::int AS approved_30d,
    BOOL_OR(o.status IN ('diproses', 'disetujui', 'dalam_pengiriman')) AS has_active_order
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.created_at >= NOW() - INTERVAL '30 days'
    OR o.status IN ('diproses', 'disetujui', 'dalam_pengiriman')
  GROUP BY o.partner_id, oi.product_id
)
SELECT ps.partner_id::text AS partner_id, pa.name AS partner_name,
  pa.type::text AS partner_type, ps.product_id::text AS product_id,
  pr.name AS product_name, ps.current_qty, ps.par_level, pr.central_stock,
  COALESCE(s.sold_7d, 0) AS sold_7d,
  COALESCE(s.sold_prev_7d, 0) AS sold_prev_7d,
  COALESCE(s.sold_30d, 0) AS sold_30d,
  COALESCE(s.report_count, 0) AS report_count,
  COALESCE(c.critical_count, 0) AS critical_count,
  COALESCE(o.requested_30d, 0) AS requested_30d,
  COALESCE(o.approved_30d, 0) AS approved_30d,
  COALESCE(o.has_active_order, FALSE) AS has_active_order
FROM partner_stocks ps
JOIN partners pa ON pa.id = ps.partner_id AND pa.is_active = TRUE
JOIN products pr ON pr.id = ps.product_id AND pr.is_active = TRUE
LEFT JOIN sales s ON s.partner_id = ps.partner_id AND s.product_id = ps.product_id
LEFT JOIN critical c ON c.partner_id = ps.partner_id AND c.product_id = ps.product_id
LEFT JOIN order_summary o ON o.partner_id = ps.partner_id AND o.product_id = ps.product_id
ORDER BY pa.name, pr.name
"""


def database_url() -> str:
    for path in (ROOT / "ai" / ".env", ROOT / "apps" / "api" / ".env", ROOT / ".env"):
        load_dotenv(path, override=False)
    value = os.environ.get("DATABASE_URL", "")
    if not value or "<host" in value or "<user" in value:
        raise RuntimeError("DATABASE_URL PostgreSQL belum dikonfigurasi")
    return value


def fetch_training_records() -> list[dict[str, Any]]:
    """Read one consistent snapshot. No database mutation occurs here."""
    with psycopg.connect(database_url(), row_factory=dict_row, connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            cursor.execute(TRAINING_QUERY)
            records = cursor.fetchall()
    LOGGER.info("Memuat %d pasangan mitra-produk dari data operasional", len(records))
    return records


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
