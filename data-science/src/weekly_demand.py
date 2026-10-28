from __future__ import annotations

import csv
import math
import os
from collections import defaultdict
from datetime import timedelta
from pathlib import Path
from statistics import mean, pstdev

import psycopg

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data-science" / "data" / "weekly_market_hotspots.csv"
PROFILE_OUTPUT = ROOT / "data-science" / "data" / "weekly_demand_profiles.csv"
LEAD_DAYS = 6


def database_url() -> str:
    for path in (ROOT / "data-science" / ".env", ROOT / "apps" / "api" / ".env", ROOT / ".env"):
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                key, sep, value = line.partition("=")
                if sep and key.strip() == "DATABASE_URL":
                    os.environ.setdefault("DATABASE_URL", value.strip().strip("'\""))
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL diperlukan untuk analisis mingguan")
    return url


def collect_rows(connection: psycopg.Connection) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT sl.partner_id::text, p.name, p.type::text,
                   COALESCE(p.province_name, 'Tidak diketahui'),
                   COALESCE(p.regency_name, 'Tidak diketahui'),
                   COALESCE(p.district_name, 'Tidak diketahui'),
                   sl.product_id::text, pr.sku, pr.name,
                   sl.qty_before, sl.qty_after, sl.created_at,
                   ps.current_qty, ps.par_level
            FROM stock_logs sl
            JOIN partners p ON p.id = sl.partner_id AND p.is_active
            JOIN products pr ON pr.id = sl.product_id AND pr.is_active
            LEFT JOIN partner_stocks ps ON ps.partner_id = p.id AND ps.product_id = pr.id
            WHERE sl.source = 'manual_update'
              AND sl.created_at >= now() - interval '56 days'
            ORDER BY sl.partner_id, sl.product_id, sl.created_at
        """)
        return [dict(zip(("partner_id", "partner_name", "partner_type", "province", "regency", "district", "product_id", "sku", "product_name", "before", "after", "at", "current_qty", "par_level"), row)) for row in cursor.fetchall()]


def profile(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    weekly: dict[tuple[str, str, str], int] = defaultdict(int)
    latest: dict[tuple[str, str], dict] = {}
    for row in rows:
        before, after = int(row["before"]), int(row["after"])
        if before < 0 or after < 0 or after > before:
            continue
        week = (row["at"].date() - timedelta(days=row["at"].weekday())).isoformat()
        key = (row["partner_id"], row["product_id"])
        weekly[(*key, week)] += before - after
        latest[key] = row
    result = []
    for (partner_id, product_id), row in latest.items():
        values = [qty for (pid, prid, _), qty in weekly.items() if pid == partner_id and prid == product_id]
        awc = mean(values) if values else 0
        std = pstdev(values) if len(values) > 1 else 0
        cv = std / awc if awc else 0
        safety = math.ceil(1.65 * (std / 7) * math.sqrt(LEAD_DAYS))
        rop = math.ceil(awc / 7 * LEAD_DAYS + safety)
        current = int(row["current_qty"] or 0)
        par = int(row["par_level"] or 1)
        result.append({**row, "awc": round(awc, 2), "coefficient_variation": round(cv, 3), "safety_stock": safety, "reorder_point": rop, "current_qty": current, "critical": current <= 10 or current < par * .2, "fast_moving": awc >= 10})
    groups: dict[tuple[str, str, str, str, str], list[dict]] = defaultdict(list)
    for row in result:
        for level, place in (("province", row["province"]), ("regency", row["regency"]), ("district", row["district"])):
            groups[(level, row["province"], row["regency"] if level != "province" else "", place, row["partner_type"])].append(row)
    hotspots = []
    for (level, province, regency, place, partner_type), items in groups.items():
        hotspots.append({"level": level, "province": province, "regency": regency, "area": place, "partner_type": partner_type, "partner_count": len({r["partner_id"] for r in items}), "average_weekly_consumption": round(sum(r["awc"] for r in items), 2), "critical_fast_moving": sum(bool(r["critical"] and r["fast_moving"]) for r in items), "mean_variation": round(mean(r["coefficient_variation"] for r in items), 3), "suggested_units": sum(max(0, math.ceil(r["awc"]) + r["safety_stock"] - r["current_qty"]) for r in items)})
    hotspots.sort(key=lambda r: (-r["average_weekly_consumption"], -r["critical_fast_moving"], r["area"]))
    return result, hotspots


def main() -> None:
    with psycopg.connect(database_url()) as connection:
        profiles, hotspots = profile(collect_rows(connection))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fields = ["level", "province", "regency", "area", "partner_type", "partner_count", "average_weekly_consumption", "critical_fast_moving", "mean_variation", "suggested_units"]
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(hotspots)
    profile_fields = ["partner_id", "partner_name", "partner_type", "province", "regency", "district", "product_id", "sku", "product_name", "current_qty", "awc", "coefficient_variation", "safety_stock", "reorder_point", "critical", "fast_moving"]
    with PROFILE_OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=profile_fields)
        writer.writeheader()
        writer.writerows({field: row[field] for field in profile_fields} for row in profiles)
    print(f"Profil mitra-produk: {len(profiles)}; klaster wilayah: {len(hotspots)}; {OUTPUT}")


if __name__ == "__main__":
    main()
