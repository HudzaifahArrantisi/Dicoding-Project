from __future__ import annotations

import csv
import math
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

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

ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw_stock_logs.csv"
OUTPUT_PATH = ROOT / "data" / "cleaned_inventory_summary.csv"
LEAD_TIME_DAYS = 6


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def read_raw_logs() -> list[dict[str, str]]:
    load_dotenv(ROOT / ".env")
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        import psycopg
        with psycopg.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT sl.id AS log_id, sl.partner_id, pa.name AS partner_name,
                           sl.product_id, pr.name AS product_name, sl.qty_before,
                           sl.qty_after, sl.source, sl.created_at
                    FROM stock_logs sl
                    JOIN partners pa ON pa.id = sl.partner_id
                    JOIN products pr ON pr.id = sl.product_id
                    ORDER BY sl.created_at
                """)
                names = [column.name for column in cursor.description]
                logs = [dict(zip(names, map(str, row))) for row in cursor.fetchall()]
        return logs
    if not RAW_PATH.exists():
        raise FileNotFoundError(f"CSV tidak ditemukan: {RAW_PATH}; sediakan DATABASE_URL atau export CSV.")
    with RAW_PATH.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def read_inventory(logs: list[dict[str, str]]) -> dict[tuple[str, str], dict[str, str]]:
    load_dotenv(ROOT / ".env")
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        import psycopg
        with psycopg.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT ps.partner_id, pa.name AS partner_name, ps.product_id,
                           pr.name AS product_name, ps.current_qty, ps.par_level
                    FROM partner_stocks ps
                    JOIN partners pa ON pa.id = ps.partner_id
                    JOIN products pr ON pr.id = ps.product_id
                    WHERE pa.is_active AND pr.is_active
                """)
                return {(str(row[0]), str(row[2])): {
                    "partner_id": str(row[0]), "partner_name": row[1],
                    "product_id": str(row[2]), "product_name": row[3],
                    "current_qty": int(row[4]), "par_level": int(row[5]),
                } for row in cursor.fetchall()}
    inventory: dict[tuple[str, str], dict[str, str]] = {}
    latest: dict[tuple[str, str], tuple[datetime, dict[str, str]]] = {}
    for row in logs:
        key = row["partner_id"], row["product_id"]
        moment = parse_time(row["created_at"])
        if key not in latest or moment > latest[key][0]:
            latest[key] = moment, row
    for key, (_, row) in latest.items():
        qty_values = [int(item["qty_after"]) for item in logs if (item["partner_id"], item["product_id"]) == key]
        inventory[key] = {
            "partner_id": key[0], "partner_name": row.get("partner_name", ""),
            "product_id": key[1], "product_name": row.get("product_name", ""),
            "current_qty": int(row["qty_after"]), "par_level": max(qty_values, default=0),
        }
    return inventory


def clean_and_summarize(raw: list[dict[str, str]], inventory: dict[tuple[str, str], dict[str, str]]) -> list[dict[str, object]]:
    raw_count = len(raw)
    required = ("partner_id", "product_id", "qty_before", "qty_after", "source", "created_at")
    valid_raw = []
    for row in raw:
        if any(not row.get(field) for field in required):
            continue
        try:
            parse_time(row["created_at"])
        except (TypeError, ValueError):
            continue
        valid_raw.append(row)
    raw = valid_raw
    raw.sort(key=lambda row: parse_time(row["created_at"]))
    kept: list[dict[str, str]] = []
    last_seen: dict[tuple[str, str], datetime] = {}
    for row in raw:
        if row.get("source") != "manual_update":
            continue
        key = row["partner_id"], row["product_id"]
        moment = parse_time(row["created_at"])
        if key in last_seen and (moment - last_seen[key]).total_seconds() < 60:
            continue
        last_seen[key] = moment
        try:
            before, after = int(row["qty_before"]), int(row["qty_after"])
        except (TypeError, ValueError):
            continue
        reference = inventory.get(key)
        if before < 0 or after < 0 or before < after:
            continue
        row["_moment"] = moment.isoformat()
        row["_consumption"] = str(before - after)
        kept.append(row)

    business_now = datetime.now(timezone(timedelta(hours=7)))
    cutoff = business_now - timedelta(days=7)
    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in kept:
        if parse_time(row["_moment"]) >= cutoff:
            grouped[(row["partner_id"], row["product_id"])].append(row)

    output: list[dict[str, object]] = []
    for key, reference in inventory.items():
        entries = grouped.get(key, [])
        consumption_by_day: dict[str, int] = defaultdict(int)
        for row in entries:
            day = parse_time(row["_moment"]).date().isoformat()
            consumption = int(row["_consumption"])
            consumption_by_day[day] += consumption
        # Missing report days are imputed with the branch-product daily mean.
        mean = sum(consumption_by_day.values()) / len(consumption_by_day) if consumption_by_day else 0.0
        today = business_now.date()
        daily = [consumption_by_day.get((today - timedelta(days=n)).isoformat(), mean) for n in range(7)]
        weekly = sum(daily)
        adu = weekly / 7
        std_dev = math.sqrt(sum((value - adu) ** 2 for value in daily) / 7)
        safety = round(1.65 * std_dev * math.sqrt(LEAD_TIME_DAYS))
        rop = round(adu * LEAD_TIME_DAYS + safety)
        qty, par = int(reference["current_qty"]), int(reference["par_level"])
        cover = round(qty / adu, 1) if adu > 0 else (999.0 if qty > 0 else 0.0)
        output.append({
            "partner_id": key[0], "partner_name": reference["partner_name"],
            "product_id": key[1], "product_name": reference["product_name"],
            "current_qty": qty, "par_level": par, "weekly_consumption": round(weekly, 2),
            "adu": round(adu, 3), "safety_stock": safety, "rop": rop,
            "days_of_cover": cover, "is_critical": cover < 2 or qty < par * 0.2,
        })
    print(f"Data kotor: {raw_count}; data bersih (baris log valid): {len(kept)}; ringkasan: {len(output)}")
    return output


def main() -> None:
    raw = read_raw_logs()
    inventory = read_inventory(raw)
    summary = clean_and_summarize(raw, inventory)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    columns = ["partner_id", "partner_name", "product_id", "product_name", "current_qty", "par_level", "weekly_consumption", "adu", "safety_stock", "rop", "days_of_cover", "is_critical"]
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(summary)
    print(f"Dataset bersih disimpan: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
