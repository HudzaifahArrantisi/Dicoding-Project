"""Vector index for verified weekly analysis with partner scoped retrieval."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer


def build_analysis_index(folder: Path) -> dict:
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
    if not docs:
        return {"documents": []}
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=30000)
    vectors = vectorizer.fit_transform([item["excerpt"] for item in docs])
    return {"documents": docs, "vectorizer": vectorizer, "vectors": vectors}


def search_partner_analysis(index: dict, partner_id: str, query: str, limit: int = 6) -> list[dict]:
    if not partner_id or not index.get("documents") or "vectorizer" not in index:
        return []
    query_vector = index["vectorizer"].transform([query])
    scores = (index["vectors"] @ query_vector.T).toarray().ravel()
    own = [i for i, item in enumerate(index["documents"]) if item["partner_id"] == partner_id]
    ranked = sorted(own, key=lambda i: float(scores[i]), reverse=True)
    overview = next((i for i in own if index["documents"][i]["source"] == "category_partners.json"), None)
    selected = [i for i in ranked if scores[i] >= 0.03][:limit]
    if not selected and any(word in query.lower() for word in ("minggu", "rangkum", "ringkas", "analisis", "kegiatan")):
        selected = ranked[:limit]
    if overview is not None and any(word in query.lower() for word in ("minggu", "rangkum", "ringkas", "rekap", "analisis")):
        selected = [overview, *(i for i in selected if i != overview)][:limit]
    return [dict(index["documents"][i], score=round(float(scores[i]), 4)) for i in selected]
