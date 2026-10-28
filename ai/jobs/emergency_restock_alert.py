from __future__ import annotations

import os

import psycopg
from dotenv import load_dotenv
from pathlib import Path


def create_emergency_alerts() -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    database_url = os.environ["DATABASE_URL"]

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH critical_stock AS (
                    SELECT
                        ps.partner_id,
                        p.name AS partner_name,
                        pr.id AS product_id,
                        pr.name AS product_name,
                        ps.current_qty,
                        ps.par_level
                    FROM partner_stocks ps
                    JOIN partners p ON p.id = ps.partner_id
                    JOIN products pr ON pr.id = ps.product_id
                    WHERE p.is_active = true
                      AND pr.is_active = true
                      AND (ps.current_qty <= 10 OR ps.current_qty < ps.par_level * 0.2)
                )
                INSERT INTO notifications (audience, type, partner_id, title, body)
                SELECT
                    'admin',
                    'low_stock',
                    critical.partner_id,
                    'Restock darurat: ' || critical.product_name,
                    critical.product_name || ' di ' || critical.partner_name ||
                        ' tersisa ' || critical.current_qty || ' dari ' ||
                        critical.par_level || ' pcs.'
                FROM critical_stock critical
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM notifications existing
                    WHERE existing.audience = 'admin'
                      AND existing.type = 'low_stock'
                      AND existing.partner_id = critical.partner_id
                      AND existing.title = 'Restock darurat: ' || critical.product_name
                      AND existing.resolved_at IS NULL
                      AND existing.created_at >= NOW() - INTERVAL '24 hours'
                )
                RETURNING id
                """
            )
            created = len(cursor.fetchall())
        connection.commit()
    return created


if __name__ == "__main__":
    count = create_emergency_alerts()
    print(f"Alert restock darurat dibuat: {count}")
