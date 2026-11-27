"""Vector index for verified weekly analysis with partner scoped retrieval."""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer

MONTHS = ("januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus",
          "september", "oktober", "november", "desember")
MONTH_ALIASES = ("jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des")
PARTNER_STOPWORDS = {
    "mitra", "cabang", "toko", "pada", "tanggal", "tagggal", "tanggah", "tgl", "jam", "pukul",
    "pagi", "siang", "sore", "malam", "malem", "berapa", "berpa", "jumlah", "jumal", "jmalh",
    "log", "logs", "stok", "stock", "minus", "mines", "keluar", "terjual", "konsumsi",
    "dari", "sampai", "ke", "dan", "itu", "ini", "yang", "saya", "ingin", "tau", "tahu",
    "november", "nov", "oktober", "okt", "desember", "des", "wib",
}


def _normalize_hour(hour: int, period_word: str | None) -> int:
    period = (period_word or "").lower()
    if period in ("malam", "malem"):
        if hour == 12:
            return 0
        if 1 <= hour <= 11:
            return hour + 12 if hour >= 6 else hour
    elif period in ("siang", "sore"):
        if 1 <= hour <= 11:
            return hour + 12
    elif period == "pagi" and hour == 12:
        return 0
    return hour


def parse_query_hours(query: str) -> tuple[int, int] | None:
    text = query.lower()
    range_match = re.search(
        r"\b(?:dari\s+)?(?:jam|pukul)\s+(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|malem)?\s*"
        r"(?:ke|sampai|s/d|sd|-)\s*(?:jam|pukul)?\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|malem)?\b",
        text,
    )
    if range_match:
        h1 = _normalize_hour(int(range_match.group(1)), range_match.group(3))
        h2 = _normalize_hour(int(range_match.group(4)), range_match.group(6))
        if 0 <= h1 <= 23 and 0 <= h2 <= 23:
            return (min(h1, h2), max(h1, h2))
    single_match = re.search(
        r"\b(?:jam|pukul)\s+(\d{1,2})(?:[.:](\d{2}))?(?:\s*wib)?(?:\s*(pagi|siang|sore|malam|malem))?\b",
        text,
    )
    if single_match:
        h = _normalize_hour(int(single_match.group(1)), single_match.group(3))
        if 0 <= h <= 23:
            return (h, h)
    return None


def partner_name_similarity(query: str, partner_name: str) -> float:
    if not partner_name:
        return 0.0
    q_lower = query.lower()
    p_lower = partner_name.lower()
    if p_lower in q_lower:
        return 1.0
    p_tokens = [tok for tok in re.findall(r"[a-z0-9]+", p_lower) if len(tok) >= 3]
    if not p_tokens:
        return 0.0
    q_tokens = [tok for tok in re.findall(r"[a-z0-9]+", q_lower) if len(tok) >= 3 and tok not in PARTNER_STOPWORDS]
    if not q_tokens:
        return 0.0
    token_scores = []
    for p_tok in p_tokens:
        best = max((SequenceMatcher(None, p_tok, q_tok).ratio() for q_tok in q_tokens), default=0.0)
        token_scores.append(best)
    matched = sum(1 for score in token_scores if score >= 0.72)
    if matched < max(2, len(p_tokens)):
        return 0.0
    return sum(token_scores) / len(token_scores)


def build_analysis_index(folder: Path, previous_index: dict | None = None, ai_folder: Path | None = None) -> dict:
    categories = {name: json.loads((folder / f"category_{name}.json").read_text(encoding="utf-8"))
                  for name in ("products", "partners", "regions", "reporting")}
    period = f"{categories['partners']['start_date']} sampai {categories['partners']['end_date']}"
    docs = []
    for item in categories["products"]["items"]:
        docs.append({
            "partner_id": None,
            "source": "category_products.json",
            "period": period,
            "excerpt": (
                f"Analisis produk periode {period}: peringkat #{item.get('rank', '-')} {item.get('product_name', '')} "
                f"({item.get('category', '')}) terjual {item.get('weekly_units', 0)} pcs "
                f"dengan pangsa {item.get('share_pct', 0)}%."
            ),
        })
    for item in categories["regions"]["items"]:
        docs.append({
            "partner_id": None,
            "source": "category_regions.json",
            "period": period,
            "excerpt": (
                f"Analisis aktivitas wilayah periode {period}: peringkat #{item.get('rank', '-')} "
                f"{item.get('regency_name', '')}, {item.get('province_name', '')} — konsumsi {item.get('weekly_units', 0)} pcs, "
                f"{item.get('active_partners', 0)} mitra aktif melapor dari {item.get('partner_count', 0)} mitra, "
                f"frekuensi restock {item.get('restock_frequency', 0)} kali."
            ),
        })
    for name in ("partners", "reporting"):
        for item in categories[name]["items"]:
            partner_id = item.get("partner_id")
            if not partner_id:
                continue
            docs.append({
                "partner_id": partner_id,
                "partner_name": item.get("partner_name"),
                "partner_type": item.get("partner_type"),
                "province_name": item.get("province_name"),
                "regency_name": item.get("regency_name"),
                "source": f"category_{name}.json",
                "period": period,
                "excerpt": (
                    f"Analisis mingguan mitra {item.get('partner_name', '')} ({item.get('partner_type', '')}, "
                    f"{item.get('regency_name', '')}, {item.get('province_name', '')}) periode {period}: "
                    f"konsumsi {item.get('weekly_units', 0)} pcs, {item.get('log_count', 0)} log laporan "
                    f"(log minus: {item.get('minus_log_count', item.get('log_count', 0))}), "
                    f"{item.get('active_days', 0)} hari aktif melapor, laju harian {item.get('daily_velocity', 0)} pcs/hari, "
                    f"status pelaporan {item.get('reporting_status', '-')}, pengajuan restock {item.get('restock_requests', 0)} kali, "
                    f"kejadian kritis {item.get('critical_frequency', 0)} kali, stok habis {item.get('stockout_events', 0)} kali. "
                    f"{json.dumps({k: item[k] for k in ('weekly_units', 'log_count', 'restock_requests', 'stockout_events') if k in item}, ensure_ascii=False)}"
                ),
            })
    with (folder / "cleaned_inventory_summary.csv").open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if not row.get("partner_id") or not row.get("product_name"):
                continue
            docs.append({
                "partner_id": row["partner_id"],
                "partner_name": row.get("partner_name"),
                "source": "cleaned_inventory_summary.csv",
                "period": period,
                "excerpt": (
                    f"Analisis produk cabang {row.get('partner_name', '')} ({row.get('regency_name', '')}) periode {period}: "
                    f"{row.get('product_name', '')} konsumsi {row.get('weekly_consumption', 0)} pcs, "
                    f"sisa stok {row.get('current_qty', 0)} pcs, ketahanan stok {row.get('days_of_cover', 0)} hari."
                ),
            })
    summary = json.loads((folder / "weekly_analytics_summary.json").read_text(encoding="utf-8")) if (folder / "weekly_analytics_summary.json").exists() else {}
    for item in summary.get("partner_daily_log_breakdown", []):
        if not item.get("partner_id") or "consumed_units" not in item:
            continue
        logs = item.get("logs") if isinstance(item.get("logs"), list) else []
        log_summary = "; ".join(
            f"pukul {entry.get('time_wib', '')} WIB {entry.get('product_name', '')} {entry.get('qty_before', 0)}->{entry.get('qty_after', 0)} pcs (minus {entry.get('consumed_units', 0)} pcs, {entry.get('source', 'manual_update')})"
            for entry in logs
        )
        profile_parts = [p for p in (item.get("partner_type"), item.get("regency_name"), item.get("province_name")) if p and p != "Tidak diketahui"]
        profile_str = f" ({', '.join(profile_parts)})" if profile_parts else (f" ({item.get('partner_type')})" if item.get("partner_type") else "")
        month_str = f" ({item.get('month_name')})" if item.get("month_name") else ""
        excerpt = (
            f"Konsumsi stok harian mitra {item.get('partner_name', '')}{profile_str} pada {item['day']}{month_str}: "
            f"total keluar {item['consumed_units']} pcs dari {item.get('log_count', 0)} log "
            f"(log minus: {item.get('minus_log_count', item.get('log_count', 0))})."
            f"{f' Rincian jam log: {log_summary}.' if log_summary else ''}"
        )
        docs.append({
            "partner_id": item["partner_id"],
            "partner_name": item.get("partner_name"),
            "partner_type": item.get("partner_type"),
            "province_name": item.get("province_name"),
            "regency_name": item.get("regency_name"),
            "source": "partner_daily_consumption",
            "period": period,
            "day": item["day"],
            "month_name": item.get("month_name"),
            "consumed_units": item["consumed_units"],
            "log_count": item.get("log_count", 0),
            "minus_log_count": item.get("minus_log_count", item.get("log_count", 0)),
            "hours": item.get("hours", []),
            "excerpt": excerpt,
        })
    if ai_folder:
        for name in ("weekly_operational_facts.json", "regional_stockout_insights.json",
                     "model_evaluation.json", "allocation_preview.json"):
            path = ai_folder / name
            if not path.exists():
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            facts = {key: value[:10] if isinstance(value, list) else value for key, value in payload.items()
                     if key in ("metadata", "network_sales", "top_selling_products", "regional_hotspots",
                                "metrics", "summary", "items", "model_version")}
            docs.append({"partner_id": None, "source": name, "period": period,
                         "excerpt": f"Hasil AI Engineer periode {period}: {json.dumps(facts, ensure_ascii=False)[:1600]}"})
    previous_documents = (previous_index or {}).get("documents") or []
    current_week = categories["partners"]["start_date"]
    docs.extend(item for item in previous_documents if isinstance(item, dict) and
                str(item.get("period", "")).split(" sampai ")[0] != current_week and
                isinstance(item.get("excerpt"), str))
    if not docs:
        return {"documents": []}
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=30000)
    vectors = vectorizer.fit_transform([item["excerpt"] for item in docs])
    return {"documents": docs, "vectorizer": vectorizer, "vectors": vectors}


def search_partner_analysis(index: dict, partner_id: str | None, query: str, limit: int = 6,
                            admin_access: bool = False) -> list[dict]:
    if (not partner_id and not admin_access) or not index.get("documents") or "vectorizer" not in index:
        return []
    query_vector = index["vectorizer"].transform([query])
    scores = (index["vectors"] @ query_vector.T).toarray().ravel()
    own = [i for i, item in enumerate(index["documents"]) if admin_access or item["partner_id"] == partner_id]
    day = next((match.group(0) for match in re.finditer(r"\b\d{4}-\d{2}-\d{2}\b", query)), None)
    if day is None:
        match = re.search(r"\b(\d{1,2})\s+(" + "|".join((*MONTHS, *MONTH_ALIASES)) + r")(?:\s+(\d{4}))?\b", query.lower())
        if match:
            month_index = next(i for i, month in enumerate(MONTHS) if month.startswith(match.group(2)))
            day = f"{int(match.group(3) or datetime.now().year):04d}-{month_index + 1:02d}-{int(match.group(1)):02d}"
    hour_range = parse_query_hours(query)
    if day:
        dated = [i for i in own if index["documents"][i].get("day") == day]
        if dated:
            partner_matches = sorted(
                ((i, partner_name_similarity(query, str(index["documents"][i].get("partner_name") or ""))) for i in dated),
                key=lambda item: item[1],
                reverse=True,
            )
            if partner_matches and partner_matches[0][1] >= 0.75:
                dated = [i for i, sim in partner_matches if sim >= 0.75]
            elif hour_range:
                h_start, h_end = hour_range
                with_hours = [
                    i for i in dated
                    if any(h_start <= int(h) <= h_end for h in (index["documents"][i].get("hours") or []))
                ]
                if with_hours:
                    dated = with_hours
            highest = any(word in query.lower() for word in ("tinggi", "terbanyak", "terbesar", "paling", "top"))
            dated.sort(key=lambda i: -int(index["documents"][i].get("consumed_units", 0)) if highest else -float(scores[i]))
            return [dict(index["documents"][i], score=round(float(scores[i]), 4)) for i in dated[:limit]]
        return []
    if admin_access:
        partner_matches = sorted(
            ((i, partner_name_similarity(query, str(index["documents"][i].get("partner_name") or ""))) for i in own),
            key=lambda item: (item[1], float(scores[item[0]])),
            reverse=True,
        )
        if partner_matches and partner_matches[0][1] >= 0.78:
            matched_indices = [i for i, sim in partner_matches if sim >= 0.78][:limit]
            return [dict(index["documents"][i], score=round(float(scores[i]), 4)) for i in matched_indices]
    ranked = sorted(own, key=lambda i: float(scores[i]), reverse=True)
    overview = next((i for i in own if index["documents"][i]["source"] == "category_partners.json"), None) if not admin_access else None
    selected = [i for i in ranked if scores[i] >= 0.03][:limit]
    if not selected and any(word in query.lower() for word in ("minggu", "rangkum", "ringkas", "analisis", "kegiatan")):
        selected = ranked[:limit]
    if overview is not None and any(word in query.lower() for word in ("minggu", "rangkum", "ringkas", "rekap", "analisis")):
        selected = [overview, *(i for i in selected if i != overview)][:limit]
    return [dict(index["documents"][i], score=round(float(scores[i]), 4)) for i in selected]
