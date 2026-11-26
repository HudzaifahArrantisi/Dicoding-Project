"""Vector index for verified weekly analysis with partner scoped retrieval."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer


def build_analysis_index(folder: Path, previous_index: dict | None = None, ai_folder: Path | None = None) -> dict:
    categories = {name: json.loads((folder / f"category_{name}.json").read_text(encoding="utf-8"))
                  for name in ("products", "partners", "regions", "reporting")}
    period = f"{categories['partners']['start_date']} sampai {categories['partners']['end_date']}"
    docs = []
    for name in ("products", "regions"):
        for item in categories[name]["items"]:
            docs.append({"partner_id": None, "source": f"category_{name}.json", "period": period,
                         "excerpt": f"Analisis agregat {name} periode {period}: {json.dumps(item, ensure_ascii=False)}"})
    for name in ("partners", "reporting"):
        for item in categories[name]["items"]:
            partner_id = item.get("partner_id")
            if not partner_id:
                continue
            allowed = ("partner_name", "weekly_units", "log_count", "critical_frequency", "stockout_events",
                       "restock_requests", "active_days", "daily_velocity", "turnover_rate", "reporting_status")
            facts = {key: item[key] for key in allowed if key in item}
            docs.append({"partner_id": partner_id, "source": f"category_{name}.json", "period": period,
                         "excerpt": f"Analisis mingguan cabang sendiri periode {period}: {json.dumps(facts, ensure_ascii=False)}"})
    with (folder / "cleaned_inventory_summary.csv").open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if not row.get("partner_id") or not row.get("product_name"):
                continue
            allowed = ("product_name", "weekly_consumption", "days_of_cover", "report_count", "critical_count")
            facts = {key: row[key] for key in allowed if key in row}
            docs.append({"partner_id": row["partner_id"], "source": "cleaned_inventory_summary.csv", "period": period,
                         "excerpt": f"Analisis produk cabang sendiri periode {period}: {json.dumps(facts, ensure_ascii=False)}"})
    summary = json.loads((folder / "weekly_analytics_summary.json").read_text(encoding="utf-8")) if (folder / "weekly_analytics_summary.json").exists() else {}
    for item in summary.get("partner_daily_log_breakdown", []):
        if not item.get("partner_id") or "consumed_units" not in item:
            continue
        facts = {key: item[key] for key in ("day", "partner_name", "consumed_units", "log_count") if key in item}
        docs.append({"partner_id": item["partner_id"], "source": "partner_daily_consumption",
                     "period": period, "day": item["day"], "consumed_units": item["consumed_units"],
                     "excerpt": f"Konsumsi stok harian mitra pada {item['day']}: {json.dumps(facts, ensure_ascii=False)}"})
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
        months = ("januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus",
                  "september", "oktober", "november", "desember")
        aliases = ("jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des")
        match = re.search(r"\b(\d{1,2})\s+(" + "|".join((*months, *aliases)) + r")(?:\s+(\d{4}))?\b", query.lower())
        if match:
            from datetime import datetime
            month_index = next(i for i, month in enumerate(months) if month.startswith(match.group(2)))
            day = f"{int(match.group(3) or datetime.now().year):04d}-{month_index + 1:02d}-{int(match.group(1)):02d}"
    if day:
        dated = [i for i in own if index["documents"][i].get("day") == day]
        if dated:
            highest = any(word in query.lower() for word in ("tinggi", "terbanyak", "terbesar", "paling", "top"))
            dated.sort(key=lambda i: -int(index["documents"][i].get("consumed_units", 0)) if highest else -float(scores[i]))
            return [dict(index["documents"][i], score=round(float(scores[i]), 4)) for i in dated[:limit]]
        return []
    ranked = sorted(own, key=lambda i: float(scores[i]), reverse=True)
    overview = next((i for i in own if index["documents"][i]["source"] == "category_partners.json"), None) if not admin_access else None
    selected = [i for i in ranked if scores[i] >= 0.03][:limit]
    if not selected and any(word in query.lower() for word in ("minggu", "rangkum", "ringkas", "analisis", "kegiatan")):
        selected = ranked[:limit]
    if overview is not None and any(word in query.lower() for word in ("minggu", "rangkum", "ringkas", "rekap", "analisis")):
        selected = [overview, *(i for i in selected if i != overview)][:limit]
    return [dict(index["documents"][i], score=round(float(scores[i]), 4)) for i in selected]
