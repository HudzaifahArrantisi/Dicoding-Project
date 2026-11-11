"""Extract one dated operational snapshot for the AI workspace."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import shutil
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from statistics import pstdev
from zoneinfo import ZoneInfo

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "data-science" / "reports"
CATALOG = ROOT / "ai" / "data" / "mainbrain" / "corporate_knowledge" / "business_rules.json"
JAKARTA = ZoneInfo("Asia/Jakarta")
CSV_COLUMNS = ["partner_id", "partner_name", "partner_type", "province_name", "regency_name",
               "product_id", "product_name", "product_sku", "current_qty", "par_level",
               "weekly_consumption", "adu", "safety_stock", "rop", "days_of_cover",
               "is_critical", "prev_velocity", "critical_events", "zero_stock_events", "has_active_order"]
CATEGORY_FILES = {
    "products": "category_products.json",
    "partners": "category_partners.json",
    "regions": "category_regions.json",
    "reporting": "category_reporting.json",
}


def database_url() -> str:
    for path in (ROOT / "data-science" / ".env", ROOT / "ai" / ".env", ROOT / "apps" / "api" / ".env"):
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                key, separator, value = line.partition("=")
                if separator and key.strip() == "DATABASE_URL":
                    os.environ.setdefault("DATABASE_URL", value.strip().strip("'\""))
    value = os.getenv("DATABASE_URL", "")
    if not value or "<host" in value or "<user" in value:
        raise RuntimeError("DATABASE_URL read-only belum dikonfigurasi")
    return value


def fetch_rows(start: datetime, end: datetime) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    previous = start - (end - start)
    with psycopg.connect(database_url(), row_factory=dict_row, connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION READ ONLY")
            cursor.execute("SELECT id::text AS id, name, sku, central_stock FROM products WHERE is_active")
            products = cursor.fetchall()
            cursor.execute("""SELECT p.id::text AS partner_id, p.name AS partner_name,
                p.type::text AS partner_type, coalesce(nullif(p.province_name, ''), 'Tidak diketahui') AS province_name,
                coalesce(nullif(p.regency_name, ''), 'Tidak diketahui') AS regency_name,
                pr.id::text AS product_id, pr.name AS product_name, pr.sku AS product_sku,
                coalesce(ps.current_qty, 0) AS current_qty, coalesce(ps.par_level, 0) AS par_level, ps.updated_at
                FROM partners p CROSS JOIN products pr
                LEFT JOIN partner_stocks ps ON ps.partner_id=p.id AND ps.product_id=pr.id
                WHERE p.is_active AND pr.is_active""")
            stocks = cursor.fetchall()
            cursor.execute("""SELECT sl.partner_id::text AS partner_id, sl.product_id::text AS product_id,
                sl.qty_before, sl.qty_after, sl.created_at
                FROM stock_logs sl WHERE sl.source='manual_update' AND sl.created_at >= %s AND sl.created_at < %s""",
                (previous, end))
            logs = cursor.fetchall()
            cursor.execute("""SELECT o.id::text AS order_id, o.partner_id::text AS partner_id,
                oi.product_id::text AS product_id, o.status::text AS status,
                oi.qty_requested, oi.qty_approved, o.created_at
                FROM orders o JOIN order_items oi ON oi.order_id=o.id
                WHERE o.created_at >= %s AND o.created_at < %s OR o.status IN ('diproses','disetujui','dalam_pengiriman')""",
                (start, end))
            orders = cursor.fetchall()
    return products, stocks, logs, orders


def category(name: str) -> str:
    return "Makanan Instan" if "seblak" in name.casefold() else "Camilan"


def percent(value: float, total: float) -> float:
    return round(100 * value / total, 1) if total else 0.0


def analyze(start: datetime, end: datetime, products: list[dict], stocks: list[dict],
            logs: list[dict], orders: list[dict]) -> tuple[dict, list[dict]]:
    with CATALOG.open(encoding="utf-8") as source:
        official = set(json.load(source)["official_products"])
    products = [p for p in products if p["name"] in official]
    product_ids = {p["id"] for p in products}
    stocks = [s for s in stocks if s["product_id"] in product_ids]
    logs = [row for row in logs if row["product_id"] in product_ids]
    orders = [row for row in orders if row["product_id"] in product_ids]
    days = (end - start).days
    if days < 1:
        raise ValueError("Rentang analisis harus minimal satu hari")
    partner_names = {s["partner_id"]: s["partner_name"] for s in stocks}
    daily_partner_counts: dict[tuple[str, str], int] = defaultdict(int)
    for row in logs:
        if start <= row["created_at"] < end and row["partner_id"] in partner_names:
            day = row["created_at"].astimezone(JAKARTA).date().isoformat()
            daily_partner_counts[(day, row["partner_id"])] += 1
    partner_daily = [{"day": day, "partner_id": partner_id, "partner_name": partner_names[partner_id], "log_count": count}
                     for (day, partner_id), count in sorted(daily_partner_counts.items())]
    daily_reporting = [{"day": (start.astimezone(JAKARTA).date() + timedelta(days=i)).isoformat(),
                        "active_partners": sum(day == (start.astimezone(JAKARTA).date() + timedelta(days=i)).isoformat()
                                               for day, _ in daily_partner_counts),
                        "log_count": sum(count for (day, _), count in daily_partner_counts.items()
                                         if day == (start.astimezone(JAKARTA).date() + timedelta(days=i)).isoformat())}
                       for i in range(days)]
    logs_by_pair: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in logs:
        logs_by_pair[(row["partner_id"], row["product_id"])].append(row)
    orders_by_pair: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in orders:
        orders_by_pair[(row["partner_id"], row["product_id"])].append(row)

    cleaned: list[dict] = []
    risk_records: list[dict] = []
    partner_totals: dict[str, dict] = {}
    region_totals: dict[tuple[str, str], dict] = {}
    product_units: dict[str, int] = defaultdict(int)
    active_order_states = {"diproses", "disetujui", "dalam_pengiriman"}
    period_orders = [row for row in orders if start <= row["created_at"] < end]
    for stock in stocks:
        key = (stock["partner_id"], stock["product_id"])
        history = logs_by_pair[key]
        current_logs = [row for row in history if start <= row["created_at"] < end]
        previous_logs = [row for row in history if row["created_at"] < start]
        consumed = sum(max(0, row["qty_before"] - row["qty_after"]) for row in current_logs)
        previous_units = sum(max(0, row["qty_before"] - row["qty_after"]) for row in previous_logs)
        velocity = consumed / days
        previous_velocity = previous_units / days
        qty, buffer = int(stock["current_qty"]), int(stock["par_level"])
        cover = round(qty / velocity, 2) if velocity else (999.0 if qty else 0.0)
        critical = sum(row["qty_after"] <= buffer * .2 for row in current_logs)
        zero = sum(row["qty_after"] == 0 for row in current_logs)
        daily = defaultdict(int)
        for row in current_logs:
            daily[row["created_at"].astimezone(JAKARTA).date().isoformat()] += max(0, row["qty_before"] - row["qty_after"])
        series = [daily.get((start.astimezone(JAKARTA).date() + timedelta(days=i)).isoformat(), 0) for i in range(days)]
        safety = math.ceil(1.65 * pstdev(series) * math.sqrt(7)) if len(series) > 1 else 0
        rop = math.ceil(velocity * 7 + safety)
        active_order = any(row["status"] in active_order_states for row in orders_by_pair[key])
        cleaned.append({
            "partner_id": stock["partner_id"], "partner_name": stock["partner_name"],
            "partner_type": stock["partner_type"], "province_name": stock["province_name"],
            "regency_name": stock["regency_name"], "product_id": stock["product_id"],
            "product_name": stock["product_name"], "product_sku": stock["product_sku"],
            "current_qty": qty, "par_level": buffer, "weekly_consumption": consumed,
            "adu": round(velocity, 3), "safety_stock": safety, "rop": rop,
            "days_of_cover": cover, "is_critical": qty <= buffer * .2 or cover < 2,
            "prev_velocity": round(previous_velocity, 3), "critical_events": critical,
            "zero_stock_events": zero, "has_active_order": int(active_order),
        })
        risk_records.append({**{k: stock[k] for k in ("partner_id", "partner_name", "partner_type", "province_name", "regency_name", "product_id", "product_name", "product_sku", "current_qty")},
                             "daily_velocity": round(velocity, 3), "units_7d": consumed,
                             "par_level": buffer, "safety_stock": safety, "rop": rop,
                             "days_of_cover": cover, "turnover_rate": round(consumed / max(1, buffer), 3),
                             "prev_velocity": round(previous_velocity, 3), "critical_events": critical,
                             "zero_stock_events": zero, "has_active_order": int(active_order)})
        product_units[stock["product_id"]] += consumed
        pid = stock["partner_id"]
        if pid not in partner_totals:
            partner_totals[pid] = {"partner_id": pid, "partner_name": stock["partner_name"],
                                   "province_name": stock["province_name"], "regency_name": stock["regency_name"],
                                   "weekly_units": 0, "log_count": 0, "active_days": set(), "critical_frequency": 0,
                                   "stockout_events": 0, "restock_requests": 0,
                                   "current_stock_total": 0, "buffer_total": 0, "last_report_at": None}
        partner = partner_totals[pid]
        partner["weekly_units"] += consumed
        partner["log_count"] += len(current_logs)
        partner["critical_frequency"] += critical
        partner["stockout_events"] += zero
        partner["current_stock_total"] += qty
        partner["buffer_total"] += buffer
        partner["active_days"].update(row["created_at"].astimezone(JAKARTA).date().isoformat() for row in current_logs)
        for row in current_logs:
            if partner["last_report_at"] is None or row["created_at"] > partner["last_report_at"]:
                partner["last_report_at"] = row["created_at"]

    total_units = sum(product_units.values())
    ranked_products = sorted(products, key=lambda p: (-product_units[p["id"]], p["name"]))
    products_report = [{"rank": i, "product_id": p["id"], "product_name": p["name"], "category": category(p["name"]),
                        "weekly_units": product_units[p["id"]], "share_pct": percent(product_units[p["id"]], total_units)}
                       for i, p in enumerate(ranked_products, 1)]
    partners_report = []
    for partner in partner_totals.values():
        active_days = len(partner.pop("active_days"))
        last = partner.pop("last_report_at")
        partner.update(active_days=active_days, daily_velocity=round(partner["weekly_units"] / days, 2),
                       turnover_rate=round(partner["weekly_units"] / max(1, partner["buffer_total"]), 3),
                       reporting_status="disiplin" if active_days >= min(5, days) else "stale" if not last or end - last > timedelta(hours=24) else "perlu_perhatian",
                       last_report_at=last.isoformat() if last else None)
        partners_report.append(partner)
        region_key = (partner["province_name"], partner["regency_name"])
        region = region_totals.setdefault(region_key, {"province_name": region_key[0], "regency_name": region_key[1],
                                                      "weekly_units": 0, "active_partners": 0, "partner_count": 0,
                                                      "restock_frequency": 0})
        region["weekly_units"] += partner["weekly_units"]
        region["partner_count"] += 1
        region["active_partners"] += int(partner["active_days"] > 0)
    region_by_partner = {p["partner_id"]: (p["province_name"], p["regency_name"]) for p in partners_report}
    seen_orders: set[str] = set()
    for order in period_orders:
        if order["order_id"] in seen_orders or order["status"] in ("ditolak", "dibatalkan"):
            continue
        seen_orders.add(order["order_id"])
        if order["partner_id"] in partner_totals:
            partner_totals[order["partner_id"]]["restock_requests"] += 1
        key = region_by_partner.get(order["partner_id"])
        if key in region_totals:
            region_totals[key]["restock_frequency"] += 1
    regions_report = sorted(region_totals.values(), key=lambda r: (-r["weekly_units"], r["province_name"], r["regency_name"]))
    for i, region in enumerate(regions_report, 1):
        region["rank"] = i
    partners_report.sort(key=lambda p: (-p["weekly_units"], p["partner_name"]))
    for i, partner in enumerate(partners_report, 1):
        partner["rank"] = i
    reporting_report = sorted(partners_report, key=lambda p: (-p["log_count"], p["partner_name"]))
    requested = sum(int(row["qty_requested"]) for row in period_orders if row["status"] not in ("ditolak", "dibatalkan"))
    approved = sum(int(row["qty_approved"] or 0) for row in period_orders if row["status"] in ("disetujui", "dalam_pengiriman", "selesai"))
    warehouse = []
    for product in products:
        units = product_units[product["id"]]
        stock = int(product["central_stock"])
        product_requested = sum(int(o["qty_requested"]) for o in period_orders
                                if o["product_id"] == product["id"] and o["status"] not in ("ditolak", "dibatalkan"))
        daily_demand = max(units, product_requested) / days
        warehouse.append({"product_id": product["id"], "product_name": product["name"], "sku": product["sku"],
                          "central_stock": stock, "weekly_units": units,
                          "requested_restock_units": product_requested, "demand_basis_units": max(units, product_requested),
                          "estimated_runout_days": round(stock / daily_demand, 1) if daily_demand else None,
                          "suggested_factory_batch_order": max(0, math.ceil(daily_demand * (7 + 14)) - stock)})
    previous_units = sum(max(0, row["qty_before"] - row["qty_after"]) for row in logs if row["created_at"] < start)
    daily_consumption_totals: dict[str, int] = defaultdict(int)
    for row in logs:
        if row["partner_id"] in partner_names:
            day = row["created_at"].astimezone(JAKARTA).date().isoformat()
            daily_consumption_totals[day] += max(0, row["qty_before"] - row["qty_after"])
    first_day = (start - (end - start)).astimezone(JAKARTA).date()
    daily_consumption = [{"day": (first_day + timedelta(days=i)).isoformat(),
                          "units": daily_consumption_totals.get((first_day + timedelta(days=i)).isoformat(), 0)}
                         for i in range(days * 2)]
    report = {"metadata": {"schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(),
                            "start_date": start.astimezone(JAKARTA).date().isoformat(),
                            "end_date": (end - timedelta(days=1)).astimezone(JAKARTA).date().isoformat(),
                            "period_days": days},
              "products": products_report, "partners": partners_report, "regions": regions_report,
              "reporting": reporting_report, "daily_reporting": daily_reporting,
              "daily_consumption": daily_consumption,
              "partner_daily_log_breakdown": partner_daily,
              "warehouse": warehouse, "risk_records": risk_records,
              "network_sales": {"total_sold_7d": total_units, "total_sold_prev_7d": previous_units,
                                "requested_restock_units": requested, "approved_restock_units": approved}}
    return report, cleaned


def write_report(report: dict, cleaned: list[dict], destination: Path = REPORTS) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    json_path = destination / "weekly_analytics_summary.json"
    csv_path = destination / "cleaned_inventory_summary.csv"
    md_path = destination / "weekly_analytics_report.md"
    category_payloads = {
        key: {"category": key, "generated_at": report["metadata"]["generated_at"],
              "start_date": report["metadata"]["start_date"], "end_date": report["metadata"]["end_date"],
              "items": report[key]}
        for key in CATEGORY_FILES
    }
    files = [(json_path, json.dumps(report, ensure_ascii=False, indent=2)),
             (md_path, render_markdown(report))]
    files.extend((destination / filename, json.dumps(category_payloads[key], ensure_ascii=False, indent=2))
                 for key, filename in CATEGORY_FILES.items())
    for path, content in files:
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(content + "\n", encoding="utf-8")
        os.replace(temp, path)
    temp_csv = csv_path.with_suffix(".csv.tmp")
    with temp_csv.open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(cleaned)
    os.replace(temp_csv, csv_path)


def validate_handoff(report: dict, cleaned: list[dict]) -> None:
    with CATALOG.open(encoding="utf-8") as source:
        official = set(json.load(source)["official_products"])
    metadata = report["metadata"]
    start_day, end_day = date.fromisoformat(metadata["start_date"]), date.fromisoformat(metadata["end_date"])
    if start_day > end_day or metadata["period_days"] != (end_day - start_day).days + 1:
        raise ValueError("Tanggal atau jumlah hari laporan tidak konsisten")
    names = {item["product_name"] for item in report["products"]}
    if names != official or len(report["products"]) != 4:
        raise ValueError("Laporan harus memuat tepat empat produk resmi")
    pairs = {(item["partner_id"], item["product_id"]) for item in cleaned}
    risk_pairs = {(item["partner_id"], item["product_id"]) for item in report["risk_records"]}
    if len(pairs) != len(cleaned) or len(cleaned) != len(report["risk_records"]) or pairs != risk_pairs:
        raise ValueError("Pasangan mitra-produk tidak unik atau jumlah baris tidak cocok")
    total = sum(int(item["weekly_consumption"]) for item in cleaned)
    if total != report["network_sales"]["total_sold_7d"] or total != sum(item["weekly_units"] for item in report["products"]):
        raise ValueError("Total konsumsi JSON dan CSV tidak cocok")
    for item in cleaned:
        numeric = ("current_qty", "par_level", "weekly_consumption", "adu", "safety_stock", "rop",
                   "days_of_cover", "prev_velocity", "critical_events", "zero_stock_events")
        if item["product_name"] not in official or any(not math.isfinite(float(item[field])) or float(item[field]) < 0 for field in numeric):
            raise ValueError("Produk atau angka CSV tidak valid")


def write_immutable_run(report: dict, cleaned: list[dict], run_id: str, base: Path = REPORTS) -> Path:
    canonical_id = str(uuid.UUID(run_id))
    validate_handoff(report, cleaned)
    runs = base / "runs"
    runs.mkdir(parents=True, exist_ok=True)
    target = runs / canonical_id
    if target.exists():
        raise FileExistsError(f"Run {canonical_id} sudah ada")
    temporary = runs / f".{canonical_id}.tmp"
    if temporary.exists():
        raise FileExistsError(f"Run {canonical_id} masih diproses")
    try:
        write_report(report, cleaned, temporary)
        names = ("weekly_analytics_summary.json", "cleaned_inventory_summary.csv", "weekly_analytics_report.md", *CATEGORY_FILES.values())
        hashes = {name: hashlib.sha256((temporary / name).read_bytes()).hexdigest() for name in names}
        manifest = {"schema_version": 1, "run_id": canonical_id, "status": "draft",
                    "start_date": report["metadata"]["start_date"], "end_date": report["metadata"]["end_date"],
                    "timezone": "Asia/Jakarta", "generated_at": report["metadata"]["generated_at"],
                    "partner_product_rows": len(cleaned), "product_count": len(report["products"]), "sha256": hashes}
        (temporary / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, target)
    except BaseException:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise
    return target


def render_markdown(report: dict) -> str:
    meta = report["metadata"]
    lines = ["# Analisis mingguan Daisuki", "", f"Periode: {meta['start_date']} sampai {meta['end_date']}",
             f"Dibuat: {meta['generated_at']}", "", "## Produk resmi"]
    for item in report["products"]:
        lines.append(f"- {item['product_name']}: {item['weekly_units']} pcs; pangsa {item['share_pct']}%")
    lines += ["", "## Mitra konsumsi tertinggi"]
    for item in report["partners"][:5]:
        lines.append(f"- {item['partner_name']}: {item['weekly_units']} pcs; {item['active_days']} hari melapor")
    lines += ["", "## Wilayah"]
    for item in report["regions"][:5]:
        lines.append(f"- {item['regency_name']}, {item['province_name']}: {item['weekly_units']} pcs; {item['restock_frequency']} restock")
    lines += ["", "## Disiplin laporan"]
    for item in report["reporting"][:5]:
        lines.append(f"- {item['partner_name']}: {item['log_count']} log; {item['active_days']} hari aktif ({item['reporting_status']})")
    lines += ["", "## Stok pusat dan kebutuhan pabrik"]
    for item in report["warehouse"]:
        cover = f"{item['estimated_runout_days']} hari" if item["estimated_runout_days"] is not None else "belum dapat dihitung"
        lines.append(f"- {item['product_name']}: sisa {item['central_stock']} pcs; ketahanan {cover}; saran batch {item['suggested_factory_batch_order']} pcs")
    return "\n".join(lines)


def run() -> dict:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-date", type=date.fromisoformat)
    parser.add_argument("--end-date", type=date.fromisoformat)
    parser.add_argument("--run-id", type=str)
    args = parser.parse_args()
    today = datetime.now(JAKARTA).date()
    end_day = args.end_date or today
    start_day = args.start_date or end_day - timedelta(days=6)
    if start_day > end_day:
        parser.error("start-date tidak boleh setelah end-date")
    start = datetime.combine(start_day, time.min, JAKARTA)
    end = datetime.combine(end_day + timedelta(days=1), time.min, JAKARTA)
    report, cleaned = analyze(start, end, *fetch_rows(start, end))
    if args.run_id:
        report["metadata"]["source_run_id"] = str(uuid.UUID(args.run_id))
        destination = write_immutable_run(report, cleaned, args.run_id)
    else:
        validate_handoff(report, cleaned)
        write_report(report, cleaned)
        destination = REPORTS
    print(f"Laporan Data Science: {len(cleaned)} pasangan mitra-produk; {destination}")
    return report


if __name__ == "__main__":
    run()
