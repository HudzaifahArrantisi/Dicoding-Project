from __future__ import annotations

import os

import psycopg
from dotenv import load_dotenv


def create_stale_reminders() -> int:
    load_dotenv()
    database_url = os.environ["DATABASE_URL"]

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH stale_partners AS (
                    SELECT
                        p.id,
                        p.name,
                        MAX(ps.updated_at) AS last_updated_at
                    FROM partners p
                    LEFT JOIN partner_stocks ps ON ps.partner_id = p.id
                    WHERE p.is_active = true
                    GROUP BY p.id, p.name
                    HAVING MAX(ps.updated_at) IS NULL
                        OR MAX(ps.updated_at) < NOW() - INTERVAL '24 hours'
                )
                INSERT INTO notifications (audience, type, partner_id, title, body)
                SELECT
                    'mitra',
                    'stale_stock',
                    stale.id,
                    'Laporan stok harian belum diperbarui',
                    stale.name || ' belum memperbarui stok selama lebih dari 24 jam.'
                FROM stale_partners stale
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM notifications existing
                    WHERE existing.type = 'stale_stock'
                      AND existing.partner_id = stale.id
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
    count = create_stale_reminders()
    print(f"Reminder stok dibuat: {count}")
