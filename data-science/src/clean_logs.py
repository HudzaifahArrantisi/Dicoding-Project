from __future__ import annotations

import csv
import hashlib
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
TRAIN_OUTPUT_PATH = ROOT / "data" / "train_inventory_summary.csv"
TEST_OUTPUT_PATH = ROOT / "data" / "test_inventory_summary.csv"
INVENTORY_SNAPSHOT_PATH = ROOT / "data" / "inventory_snapshot.csv"
LEAD_TIME_DAYS = 6

COLUMNS = [
    "partner_id",
    "partner_name",
    "product_id",
    "product_name",
    "current_qty",
    "par_level",
    "weekly_consumption",
    "adu",
    "safety_stock",
    "rop",
    "days_of_cover",
    "is_critical",
    "data_source",
    "is_synthetic",
]


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def get_synthetic_partner_ids() -> set[str]:
    """Menghasilkan set UUID mitra sintetis dari init.sql demo dan seed-mitra.ts."""
    ids = {
        # Demo partners dari neon/init.sql dan seed.ts
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
        "101b8697-9c73-49af-89f0-bdc770d4d74c",
        "bf582ad4-b195-4e58-9a20-f40f9890a854",
    }
    # 100 demo mitra dari seed-mitra.ts (formula SHA-1 deterministik)
    for number in range(1, 101):
        hex_digest = hashlib.sha1(f"daisuki-demo-mitra-2026:partner:{number}".encode("utf-8")).hexdigest()
        uuid_str = f"{hex_digest[:8]}-{hex_digest[8:12]}-5{hex_digest[13:16]}-8{hex_digest[17:20]}-{hex_digest[20:32]}"
        ids.add(uuid_str)
    return ids


KNOWN_SYNTHETIC_IDS = get_synthetic_partner_ids()
DEMO_PARTNER_NAMES = {
    "kafe sejuk bsd",
    "hotel aruna jakarta",
    "resto bento serpong",
}
SYNTHETIC_CATEGORIES = ("hotel", "restoran", "kafe", "minimarket")
SYNTHETIC_BRANDS = (
    "arunika", "cendana", "puspa", "nirwana", "sembada",
    "langit", "senja", "samudra", "kencana", "melati",
    "seruni", "purnama", "lestari", "mentari", "angkasa",
    "mahoni", "teratai", "cakrawala", "kirana", "beringin",
    "kemuning", "taman sari", "bumi raya", "pelangi", "akasia",
)


def determine_source(
    partner_id: str,
    partner_name: str = "",
    explicit_source: str | None = None,
) -> tuple[str, bool]:
    """Mendeteksi apakah baris berasal dari data sintetis (seed) atau data primer Daisuki.

    Returns:
        tuple[str, bool]: (data_source, is_synthetic)
        data_source: 'synthetic_seed' atau 'primary_daisuki'
        is_synthetic: True atau False
    """
    if explicit_source in ("primary_daisuki", "synthetic_seed"):
        return explicit_source, (explicit_source == "synthetic_seed")

    pid = str(partner_id).strip().lower()
    if pid in KNOWN_SYNTHETIC_IDS:
        return "synthetic_seed", True

    pname = str(partner_name).strip().lower()
    if pname in DEMO_PARTNER_NAMES or "demo" in pname:
        return "synthetic_seed", True

    for cat in SYNTHETIC_CATEGORIES:
        if pname.startswith(cat + " "):
            remainder = pname[len(cat) + 1:].strip()
            for brand in SYNTHETIC_BRANDS:
                if remainder.startswith(brand + " ") or remainder == brand:
                    return "synthetic_seed", True

    return "primary_daisuki", False


def read_raw_logs() -> list[dict[str, str]]:
    """Membaca log transaksi dari Neon DB atau fallback CSV, serta menggabungkan data primer lokal jika ada."""
    load_dotenv(ROOT / ".env")
    database_url = os.getenv("DATABASE_URL")
    logs: list[dict[str, str]] | None = None

    if database_url:
        try:
            import psycopg
            with psycopg.connect(database_url, connect_timeout=5) as connection:
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
        except Exception:
            logs = None

    if logs is None:
        if not RAW_PATH.exists():
            raise FileNotFoundError(f"CSV tidak ditemukan: {RAW_PATH}; sediakan DATABASE_URL atau export CSV.")
        with RAW_PATH.open(newline="", encoding="utf-8-sig") as handle:
            logs = list(csv.DictReader(handle))

    # Dukung file data primer Daisuki tambahan jika tersedia di folder data
    primary_candidates = [
        ROOT / "data" / "primary_stock_logs.csv",
        ROOT / "data" / "raw_stock_logs_primary.csv",
        ROOT / "data" / "primary_raw_logs.csv",
    ]
    for candidate in primary_candidates:
        if candidate.exists():
            with candidate.open(newline="", encoding="utf-8-sig") as handle:
                primary_rows = list(csv.DictReader(handle))
                existing_keys = {
                    (r.get("log_id"), r.get("partner_id"), r.get("product_id"), r.get("created_at"))
                    for r in logs
                }
                merged_count = 0
                for row in primary_rows:
                    row["_explicit_source"] = "primary_daisuki"
                    key = (row.get("log_id"), row.get("partner_id"), row.get("product_id"), row.get("created_at"))
                    if key not in existing_keys:
                        logs.append(row)
                        existing_keys.add(key)
                        merged_count += 1
                if merged_count > 0:
                    print(f"Data primer Daisuki digabungkan dari {candidate.name}: {merged_count} baris log.")

    return logs


def read_inventory(logs: list[dict[str, str]]) -> dict[tuple[str, str], dict[str, str]]:
    """Membaca data inventaris saat ini (current_qty & par_level) dari DB, snapshot cache, atau logs."""
    load_dotenv(ROOT / ".env")
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        try:
            import psycopg
            with psycopg.connect(database_url, connect_timeout=5) as connection:
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
        except Exception:
            pass

    if INVENTORY_SNAPSHOT_PATH.exists():
        with INVENTORY_SNAPSHOT_PATH.open(newline="", encoding="utf-8-sig") as handle:
            return {(row["partner_id"], row["product_id"]): {
                "partner_id": row["partner_id"], "partner_name": row["partner_name"],
                "product_id": row["product_id"], "product_name": row["product_name"],
                "current_qty": int(row["current_qty"]), "par_level": int(row["par_level"]),
            } for row in csv.DictReader(handle)}

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


def filter_valid_logs(raw: list[dict[str, str]]) -> list[dict[str, str]]:
    """Membersihkan log transaksi: validasi field, urut waktu, debounce, filter manual_update, dan pelabelan sumber."""
    required = ("partner_id", "product_id", "qty_before", "qty_after", "source", "created_at")
    valid_raw: list[dict[str, str]] = []
    for row in raw:
        if any(not row.get(field) for field in required):
            continue
        try:
            parse_time(row["created_at"])
        except (TypeError, ValueError):
            continue
        valid_raw.append(row)

    valid_raw.sort(key=lambda r: parse_time(r["created_at"]))
    kept: list[dict[str, str]] = []
    last_seen: dict[tuple[str, str], datetime] = {}

    for row in valid_raw:
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
        if before < 0 or after < 0 or before < after:
            continue

        data_source, is_synthetic = determine_source(
            row["partner_id"],
            row.get("partner_name", ""),
            row.get("_explicit_source"),
        )
        row["data_source"] = data_source
        row["is_synthetic"] = str(is_synthetic)
        row["_moment"] = moment.isoformat()
        row["_consumption"] = str(before - after)
        kept.append(row)

    return kept


def summarize_inventory(
    kept: list[dict[str, str]],
    inventory: dict[tuple[str, str], dict[str, str]],
    reference_time: datetime | None = None,
) -> list[dict[str, object]]:
    """Menghitung metrik konsumsi mingguan, ADU, Safety Stock, ROP, dan Days of Cover dengan pelabelan sumber."""
    business_now = reference_time or datetime.now(timezone(timedelta(hours=7)))
    cutoff = business_now - timedelta(days=7)

    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in kept:
        if parse_time(row["_moment"]) >= cutoff:
            grouped[(row["partner_id"], row["product_id"])].append(row)

    output: list[dict[str, object]] = []
    for key, reference in inventory.items():
        partner_id = key[0]
        partner_name = reference.get("partner_name", "")
        data_source, is_synthetic = determine_source(partner_id, partner_name)

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
            "partner_id": partner_id,
            "partner_name": partner_name,
            "product_id": key[1],
            "product_name": reference["product_name"],
            "current_qty": qty,
            "par_level": par,
            "weekly_consumption": round(weekly, 2),
            "adu": round(adu, 3),
            "safety_stock": safety,
            "rop": rop,
            "days_of_cover": cover,
            "is_critical": cover < 2 or qty < par * 0.2,
            "data_source": data_source,
            "is_synthetic": is_synthetic,
        })
    return output


def clean_and_summarize(
    raw: list[dict[str, str]],
    inventory: dict[tuple[str, str], dict[str, str]],
    reference_time: datetime | None = None,
) -> list[dict[str, object]]:
    """Membersihkan raw logs dan menghasilkan dataset ringkasan stok inventaris."""
    raw_count = len(raw)
    kept = filter_valid_logs(raw)
    output = summarize_inventory(kept, inventory, reference_time=reference_time)
    print(f"Data kotor: {raw_count}; data bersih (baris log valid): {len(kept)}; ringkasan: {len(output)}")
    return output


def write_summary_csv(data: list[dict[str, object]], path: Path) -> None:
    """Menyimpan list dict ke file CSV dengan kolom standar."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(data)


def create_time_based_split(
    raw_or_cleaned: list[dict[str, str]],
    inventory: dict[tuple[str, str], dict[str, str]],
    train_ratio: float = 0.8,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """Membagi data log transaksi secara urutan waktu (time-based train-test split).

    80% periode awal digunakan sebagai Train Set, dan 20% periode terbaru digunakan
    sebagai Test Set untuk mencegah data leakage pada analisis time-series/forecasting.
    Hasilnya disimpan ke:
      - data-science/data/train_inventory_summary.csv
      - data-science/data/test_inventory_summary.csv
    """
    if not raw_or_cleaned or any("_moment" not in r for r in raw_or_cleaned):
        logs = filter_valid_logs(raw_or_cleaned)
    else:
        logs = list(raw_or_cleaned)

    logs.sort(key=lambda r: parse_time(r["created_at"]))
    total_logs = len(logs)
    if total_logs == 0:
        empty: list[dict[str, object]] = []
        write_summary_csv(empty, TRAIN_OUTPUT_PATH)
        write_summary_csv(empty, TEST_OUTPUT_PATH)
        return empty, empty

    split_idx = int(total_logs * train_ratio)
    split_idx = max(1, min(split_idx, total_logs - 1)) if total_logs > 1 else 1

    train_logs = logs[:split_idx]
    test_logs = logs[split_idx:]

    train_ref = parse_time(train_logs[-1]["created_at"]) if train_logs else None
    test_ref = parse_time(test_logs[-1]["created_at"]) if test_logs else None

    train_summary = summarize_inventory(train_logs, inventory, reference_time=train_ref)
    test_summary = summarize_inventory(test_logs, inventory, reference_time=test_ref)

    write_summary_csv(train_summary, TRAIN_OUTPUT_PATH)
    write_summary_csv(test_summary, TEST_OUTPUT_PATH)

    train_t0 = train_logs[0]["created_at"] if train_logs else "N/A"
    train_t1 = train_logs[-1]["created_at"] if train_logs else "N/A"
    test_t0 = test_logs[0]["created_at"] if test_logs else "N/A"
    test_t1 = test_logs[-1]["created_at"] if test_logs else "N/A"

    print("\n--- Ringkasan Time-Based Train-Test Split (Anti Data Leakage) ---")
    print(f"Total Log Transaksi Valid : {total_logs} baris")
    print(f"Train Log (Periode Awal {int(train_ratio * 100)}%) : {len(train_logs)} baris ({train_t0} s/d {train_t1})")
    print(f"Test Log  (Periode Akhir {int((1 - train_ratio) * 100)}%) : {len(test_logs)} baris ({test_t0} s/d {test_t1})")
    print(f"Train Summary Output : {len(train_summary)} baris -> {TRAIN_OUTPUT_PATH}")
    print(f"Test Summary Output  : {len(test_summary)} baris -> {TEST_OUTPUT_PATH}")

    return train_summary, test_summary


def main() -> None:
    raw = read_raw_logs()
    inventory = read_inventory(raw)

    # 1. Dataset Penuh (cleaned_inventory_summary.csv)
    summary = clean_and_summarize(raw, inventory)
    write_summary_csv(summary, OUTPUT_PATH)
    print(f"Dataset bersih lengkap disimpan: {OUTPUT_PATH}")

    # Breakdown sumber data pada dataset bersih
    synth_count = sum(1 for r in summary if r["is_synthetic"])
    primary_count = sum(1 for r in summary if not r["is_synthetic"])
    print(f"Breakdown Sumber Data : {primary_count} primer Daisuki, {synth_count} sintetis (seed)")

    # 2. Time-Based Train-Test Split (train_inventory_summary.csv & test_inventory_summary.csv)
    create_time_based_split(raw, inventory, train_ratio=0.8)


if __name__ == "__main__":
    main()
