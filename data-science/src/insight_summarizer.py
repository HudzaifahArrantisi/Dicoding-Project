#!/usr/bin/env python3
"""
insight_summarizer.py — AI Operational Insight Summarizer (Tiket #8)

Menyintesis hasil agregasi matriks mingguan (Tiket #6), profil klaster mitra (Tiket #4/#5),
dan proyeksi risiko stockout (Tiket #3) menjadi ringkasan eksekutif operasional otomatis
berbahasa Indonesia (2–3 kalimat per konteks) yang komunikatif dan siap ditindaklanjuti
oleh Admin Daisuki Pusat dan PIC Senior Cabang.

Output:
  - data-science/data/operational_insight.json
  - apps/web/src/data/operational_insight.json
  - apps/web/src/data/operational-insight-fallback.ts
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Path direktori proyek
SCRIPT_DIR = Path(__file__).resolve().parent
DS_ROOT = SCRIPT_DIR.parent
DATA_DIR = DS_ROOT / "data"
MODELS_DIR = DS_ROOT / "models"
REPORTS_DIR = DS_ROOT / "reports"
REPO_ROOT = DS_ROOT.parent

WEB_DATA_DIR = REPO_ROOT / "apps" / "web" / "src" / "data"
OUTPUT_JSON_PATH = DATA_DIR / "operational_insight.json"
WEB_FALLBACK_JSON_PATH = WEB_DATA_DIR / "operational_insight.json"
WEB_FALLBACK_TS_PATH = WEB_DATA_DIR / "operational-insight-fallback.ts"


def load_matrix_data() -> Dict[str, Any]:
    """Memuat data matriks mingguan dari file atau mengenerate on-the-fly jika belum ada."""
    matrix_file = DATA_DIR / "weekly_absorption_matrix.json"
    if matrix_file.exists():
        try:
            with matrix_file.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Gagal membaca {matrix_file}: {e}")

    # Fallback: coba dari apps/web/src/data
    web_matrix_file = WEB_DATA_DIR / "weekly_absorption_matrix.json"
    if web_matrix_file.exists():
        try:
            with web_matrix_file.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Gagal membaca {web_matrix_file}: {e}")

    # Jika file belum ada sama sekali, jalankan generator weekly_absorption_matrix
    print("[INFO] Matriks mingguan belum ada. Menjalankan generator weekly_absorption_matrix...")
    sys.path.insert(0, str(SCRIPT_DIR))
    from weekly_absorption_matrix import generate_weekly_absorption_matrix
    return generate_weekly_absorption_matrix()


def generate_period_executive_summary(
    period_id: str,
    period_label: str,
    rankings: List[Dict[str, Any]],
    summary_meta: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Menyusun ringkasan eksekutif 2-3 kalimat berbahasa Indonesia untuk periode tertentu,
    dilengkapi prioritas tindakan armada logistik pabrik dan breakdown kota.
    """
    active_partners = [p for p in rankings if p.get("is_active_partner", False)]
    critical_partners = [
        p for p in active_partners
        if p.get("has_lead_time_breach", False) or p.get("dominant_risk_level") == "Kritis"
    ]
    top_partners = [p for p in active_partners if p.get("performance_tier") == "top_performer"]
    slow_partners = [p for p in rankings if p.get("performance_tier") == "slow_moving"]

    net_avg_pct = round(summary_meta.get("network_avg_absorption_rate", 0.881) * 100, 1)
    crit_count = len(critical_partners)
    slow_count = len(slow_partners)

    # Hitung estimasi sisa hari terkritis dan rata-rata kritis
    if critical_partners:
        min_crit_days = min(p.get("min_days_to_stockout", 7.0) for p in critical_partners)
        avg_crit_days = round(
            sum(p.get("min_days_to_stockout", 7.0) for p in critical_partners) / len(critical_partners),
            1
        )
    else:
        min_crit_days = 7.0
        avg_crit_days = 7.0

    # Nama cabang kritis teratas untuk narasi
    crit_names = [p["partner_name"] for p in critical_partners[:2]]
    crit_names_str = " dan ".join(crit_names) if crit_names else "sejumlah cabang aktif"

    # Kalimat 1: Gambaran Laju Penjualan & Top Performers
    s1 = (
        f"Pada {period_label}, laju penyerapan produk di seluruh jaringan mitra mencapai {net_avg_pct}% dari buffer acuan, "
        f"dengan {len(top_partners)} cabang teratas menunjukkan perputaran stok sangat cepat."
    )

    # Kalimat 2: Peringatan Kritis Lead Time Pabrik (< 7 Hari)
    if crit_count > 0:
        s2 = (
            f"Namun, terdapat {crit_count} cabang mitra—termasuk {crit_names_str}—yang berada dalam status kritis "
            f"dengan ketahanan stok tersisa hanya {min_crit_days:.1f} hingga {avg_crit_days:.1f} hari, melanggar batas aman lead time pabrik (5–7 hari)."
        )
    else:
        s2 = "Seluruh cabang aktif saat ini memiliki ketahanan stok di atas batas minimum lead time pabrik (5–7 hari)."

    # Kalimat 3: Arahan Tindakan PIC & Penanganan Slow-Moving
    if crit_count > 0:
        s3 = (
            f"Admin logistik wajib memprioritaskan penerbitan surat jalan armada pengiriman sebelum akhir pekan ini, "
            f"sementara {slow_count} cabang dengan stok menumpuk di rak perlu dievaluasi kapasitas pajangnya guna menghindari barang mandek."
        )
    else:
        s3 = (
            f"Fokus operasional minggu ini diarahkan pada pemantauan pengiriman rutin serta optimalisasi {slow_count} cabang "
            f"yang belum mencatat penjualan fisik."
        )

    executive_summary = f"{s1} {s2} {s3}"

    headline = (
        f"{crit_count} Cabang Kritis Menjelang Batas Lead Time Pabrik: Prioritaskan Pengiriman ke {crit_names_str}"
        if crit_count > 0 else
        f"Distribusi Pasokan Jaringan Berjalan Stabil pada {period_label}"
    )

    # Prioritas Tindakan
    priority_actions = []
    if crit_count > 0:
        priority_actions.append({
            "priority": "P1 - Segera Kirim (1–2 Hari)",
            "target": crit_names_str,
            "action": f"Keluarkan ready stock gudang pusat untuk mengisi kembali buffer toko sebelum stok habis (sisa {min_crit_days:.1f} hari).",
            "risk_level": "Kritis",
        })

    priority_actions.append({
        "priority": "P2 - Penyesuaian Jadwal Lonjakan (Tipe A & B)",
        "target": "Cabang Perhotelan & Kafe (Jakarta, Makassar, Cijeruk)",
        "action": "Jadwalkan armada Kamis Sore / Jumat Pagi untuk mengakomodasi lonjakan konsumsi akhir pekan sebesar 25–30%.",
        "risk_level": "Waspada",
    })

    if slow_count > 0:
        priority_actions.append({
            "priority": "P3 - Evaluasi Deadstock & Display Rak",
            "target": f"{slow_count} Cabang Mitra Lambat / Inaktif",
            "action": "Lakukan program display ulang, pendampingan pelaporan stok fisik, atau penarikan stok jika mandek > 30 hari.",
            "risk_level": "Perhatian",
        })

    # Analisis per Kota
    city_insights: Dict[str, Dict[str, Any]] = {}
    city_groups: Dict[str, List[Dict[str, Any]]] = {}
    for p in rankings:
        c = p.get("city", "Jabodetabek")
        city_groups.setdefault(c, []).append(p)

    for city, plist in city_groups.items():
        c_active = [p for p in plist if p.get("is_active_partner", False)]
        c_crit = [p for p in c_active if p.get("has_lead_time_breach", False) or p.get("dominant_risk_level") == "Kritis"]
        c_consumption = sum(p.get("total_weekly_consumption", 0) for p in c_active)
        c_stock = sum(p.get("total_current_stock", 0) for p in plist)

        if c_crit:
            c_status = "Kritis"
            c_min_days = min(p.get("min_days_to_stockout", 7.0) for p in c_crit)
            c_names = ", ".join(p["partner_name"] for p in c_crit[:2])
            c_headline = f"Stok Kritis di {city}: {c_names} Butuh Kiriman Cepat"
            c_summary = (
                f"Cabang mitra di {city} mencatat konsumsi tinggi sebesar {c_consumption:.0f} pcs minggu ini. "
                f"Ketahanan stok tersisa hanya {c_min_days:.1f} hari, wajib segera dipasok sebelum rak toko kosong."
            )
            c_action = f"Terbitkan pesanan pasokan darurat untuk cabang kritis di {city} hari ini."
        elif c_active:
            c_status = "Aman"
            c_headline = f"Penjualan Berjalan Stabil di {city}"
            c_summary = (
                f"Mitra di {city} mencatat konsumsi teratur sebesar {c_consumption:.0f} pcs dengan sisa stok {c_stock:.0f} pcs di rak. "
                f"Pasokan berada dalam batas aman lead time."
            )
            c_action = f"Lanjutkan jadwal armada rutin mingguan untuk wilayah {city}."
        else:
            c_status = "Stagnan"
            c_headline = f"Belum Ada Penjualan Aktif di {city}"
            c_summary = (
                f"Terdapat {len(plist)} cabang di {city} dengan total stok {c_stock:.0f} pcs di rak toko, "
                f"namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini."
            )
            c_action = f"Hubungi PIC cabang di {city} untuk konfirmasi pelaporan stok atau program promo toko."

        city_insights[city] = {
            "city": city,
            "headline": c_headline,
            "summary": c_summary,
            "status": c_status,
            "total_branches": len(plist),
            "active_branches": len(c_active),
            "critical_branches": len(c_crit),
            "total_consumption": c_consumption,
            "total_stock": c_stock,
            "recommended_action": c_action,
        }

    return {
        "period_id": period_id,
        "period_label": period_label,
        "headline": headline,
        "executive_summary": executive_summary,
        "network_avg_absorption_rate": summary_meta.get("network_avg_absorption_rate", 0.881),
        "total_critical_branches": crit_count,
        "total_slow_moving_branches": slow_count,
        "min_safe_stock_days": min_crit_days,
        "avg_critical_safe_days": avg_crit_days,
        "priority_actions": priority_actions,
        "city_insights": city_insights,
    }


def generate_operational_insights(output_path: Optional[str] = None) -> Dict[str, Any]:
    """Menghasilkan payload lengkap AI Operational Insights dan menyimpannya ke JSON & TS."""
    print("=== GENERATOR AI OPERATIONAL INSIGHT SUMMARIZER (TIKET #8) ===")
    matrix = load_matrix_data()
    metadata = matrix.get("metadata", {})
    summary_meta = matrix.get("summary", {})
    available_periods = matrix.get("available_periods", [])
    period_data = matrix.get("period_data", {})

    current_period_id = metadata.get("current_period_id", "2026-W46")

    period_insights: Dict[str, Any] = {}
    for p_info in available_periods:
        pid = p_info["id"]
        plabel = f"{p_info['label']} ({p_info.get('date_range', '')})"
        p_rankings = period_data.get(pid, {}).get("rankings", [])
        period_insights[pid] = generate_period_executive_summary(
            period_id=pid,
            period_label=plabel,
            rankings=p_rankings,
            summary_meta=summary_meta,
        )

    # Default insight untuk periode aktif
    active_insight = period_insights.get(current_period_id, list(period_insights.values())[0])

    payload: Dict[str, Any] = {
        "metadata": {
            "version": "1.0.0",
            "generator": "Daisuki AI Operational Insight Summarizer",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "pipeline_stage": "Tiket #8 - Production Handoff & Summarizer",
            "active_period_id": current_period_id,
            "model_references": [
                "featured_partner_metrics.csv (Tiket #2: Laju Penyerapan & Profil Harian)",
                "stockout_model.joblib (Tiket #3: Proyeksi Risiko & Ambang Lead Time 7 Hari)",
                "partner_clustering.joblib (Tiket #4/#5: K-Means k=4 Persona Tipe A/B/C)",
                "weekly_absorption_matrix.json (Tiket #6: Matriks Peringkat Penyerapan Mingguan)",
            ],
        },
        "network_overview": {
            "headline": active_insight["headline"],
            "executive_summary": active_insight["executive_summary"],
            "network_avg_absorption_rate": active_insight["network_avg_absorption_rate"],
            "total_critical_branches": active_insight["total_critical_branches"],
            "total_slow_moving_branches": active_insight["total_slow_moving_branches"],
            "min_safe_stock_days": active_insight["min_safe_stock_days"],
            "avg_critical_safe_days": active_insight["avg_critical_safe_days"],
            "priority_actions": active_insight["priority_actions"],
        },
        "period_insights": period_insights,
        "city_insights": active_insight["city_insights"],
    }

    # 1. Simpan ke data-science/data/operational_insight.json
    target_path = Path(output_path) if output_path else OUTPUT_JSON_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"[OK] Operational Insight JSON disimpan ke: {target_path}")

    # 2. Salin fallback ke apps/web
    try:
        WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with WEB_FALLBACK_JSON_PATH.open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"[OK] Salinan JSON fallback frontend disimpan ke: {WEB_FALLBACK_JSON_PATH}")

        # Tulis TypeScript Fallback
        ts_code = f"""// Auto-generated Fallback Data untuk AI Operational Insight
// Generated: {payload['metadata']['generated_at']}

export interface PriorityActionItem {{
  priority: string
  target: string
  action: string
  risk_level: string
}}

export interface CityInsightItem {{
  city: string
  headline: string
  summary: string
  status: 'Kritis' | 'Waspada' | 'Aman' | 'Stagnan'
  total_branches: number
  active_branches: number
  critical_branches: number
  total_consumption: number
  total_stock: number
  recommended_action: string
}}

export interface PeriodInsightItem {{
  period_id: string
  period_label: string
  headline: string
  executive_summary: string
  network_avg_absorption_rate: number
  total_critical_branches: number
  total_slow_moving_branches: number
  min_safe_stock_days: number
  avg_critical_safe_days: number
  priority_actions: PriorityActionItem[]
  city_insights: Record<string, CityInsightItem>
}}

export interface OperationalInsightResponse {{
  metadata: {{
    version: string
    generator: string
    generated_at: string
    pipeline_stage: string
    active_period_id: string
    model_references: string[]
  }}
  network_overview: {{
    headline: string
    executive_summary: string
    network_avg_absorption_rate: number
    total_critical_branches: number
    total_slow_moving_branches: number
    min_safe_stock_days: number
    avg_critical_safe_days: number
    priority_actions: PriorityActionItem[]
  }}
  period_insights: Record<string, PeriodInsightItem>
  city_insights: Record<string, CityInsightItem>
}}

export const FALLBACK_OPERATIONAL_INSIGHT: OperationalInsightResponse = {json.dumps(payload, ensure_ascii=False, indent=2)} as const;
"""
        with WEB_FALLBACK_TS_PATH.open("w", encoding="utf-8") as f:
            f.write(ts_code)
        print(f"[OK] Fallback TypeScript disimpan ke: {WEB_FALLBACK_TS_PATH}")

    except Exception as e:
        print(f"[WARN] Tidak dapat menyalin langsung ke apps/web: {e}")

    return payload


if __name__ == "__main__":
    res = generate_operational_insights()
    print(f"\n[RINGKASAN EKSEKUTIF OPERASIONAL]")
    print(f"Headline : {res['network_overview']['headline']}")
    print(f"Summary  : {res['network_overview']['executive_summary']}")
    print(f"\nPrioritas Tindakan:")
    for a in res["network_overview"]["priority_actions"]:
        print(f"  - [{a['priority']}] {a['target']} -> {a['action']}")
    print("\n=== SELESAI DENGAN SUKSES ===")
