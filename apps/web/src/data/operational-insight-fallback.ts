// Auto-generated Fallback Data untuk AI Operational Insight
// Generated: 2026-11-20T07:00:44.708656+00:00

export interface PriorityActionItem {
  priority: string
  target: string
  action: string
  risk_level: string
}

export interface CityInsightItem {
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
}

export interface PeriodInsightItem {
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
}

export interface OperationalInsightResponse {
  metadata: {
    version: string
    generator: string
    generated_at: string
    pipeline_stage: string
    active_period_id: string
    model_references: string[]
  }
  network_overview: {
    headline: string
    executive_summary: string
    network_avg_absorption_rate: number
    total_critical_branches: number
    total_slow_moving_branches: number
    min_safe_stock_days: number
    avg_critical_safe_days: number
    priority_actions: PriorityActionItem[]
  }
  period_insights: Record<string, PeriodInsightItem>
  city_insights: Record<string, CityInsightItem>
}

export const FALLBACK_OPERATIONAL_INSIGHT: OperationalInsightResponse = {
  "metadata": {
    "version": "1.0.0",
    "generator": "Daisuki AI Operational Insight Summarizer",
    "generated_at": "2026-11-20T07:00:44.708656+00:00",
    "pipeline_stage": "Tiket #8 - Production Handoff & Summarizer",
    "active_period_id": "2026-W46",
    "model_references": [
      "featured_partner_metrics.csv (Tiket #2: Laju Penyerapan & Profil Harian)",
      "stockout_model.joblib (Tiket #3: Proyeksi Risiko & Ambang Lead Time 7 Hari)",
      "partner_clustering.joblib (Tiket #4/#5: K-Means k=4 Persona Tipe A/B/C)",
      "weekly_absorption_matrix.json (Tiket #6: Matriks Peringkat Penyerapan Mingguan)"
    ]
  },
  "network_overview": {
    "headline": "9 Cabang Kritis Menjelang Batas Lead Time Pabrik: Prioritaskan Pengiriman ke Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
    "executive_summary": "Pada Minggu 2 - Nov 2026 (Aktif) (10 Nov - 17 Nov 2026), laju penyerapan produk di seluruh jaringan mitra mencapai 88.1% dari buffer acuan, dengan 4 cabang teratas menunjukkan perputaran stok sangat cepat. Namun, terdapat 9 cabang mitra—termasuk Hotel Aruna Jakarta dan Hotel Pelangi Makassar—yang berada dalam status kritis dengan ketahanan stok tersisa hanya 1.3 hingga 34.4 hari, melanggar batas aman lead time pabrik (5–7 hari). Admin logistik wajib memprioritaskan penerbitan surat jalan armada pengiriman sebelum akhir pekan ini, sementara 102 cabang dengan stok menumpuk di rak perlu dievaluasi kapasitas pajangnya guna menghindari barang mandek.",
    "network_avg_absorption_rate": 0.881,
    "total_critical_branches": 9,
    "total_slow_moving_branches": 102,
    "min_safe_stock_days": 1.3,
    "avg_critical_safe_days": 34.4,
    "priority_actions": [
      {
        "priority": "P1 - Segera Kirim (1–2 Hari)",
        "target": "Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
        "action": "Keluarkan ready stock gudang pusat untuk mengisi kembali buffer toko sebelum stok habis (sisa 1.3 hari).",
        "risk_level": "Kritis"
      },
      {
        "priority": "P2 - Penyesuaian Jadwal Lonjakan (Tipe A & B)",
        "target": "Cabang Perhotelan & Kafe (Jakarta, Makassar, Cijeruk)",
        "action": "Jadwalkan armada Kamis Sore / Jumat Pagi untuk mengakomodasi lonjakan konsumsi akhir pekan sebesar 25–30%.",
        "risk_level": "Waspada"
      },
      {
        "priority": "P3 - Evaluasi Deadstock & Display Rak",
        "target": "102 Cabang Mitra Lambat / Inaktif",
        "action": "Lakukan program display ulang, pendampingan pelaporan stok fisik, atau penarikan stok jika mandek > 30 hari.",
        "risk_level": "Perhatian"
      }
    ]
  },
  "period_insights": {
    "2026-W46": {
      "period_id": "2026-W46",
      "period_label": "Minggu 2 - Nov 2026 (Aktif) (10 Nov - 17 Nov 2026)",
      "headline": "9 Cabang Kritis Menjelang Batas Lead Time Pabrik: Prioritaskan Pengiriman ke Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
      "executive_summary": "Pada Minggu 2 - Nov 2026 (Aktif) (10 Nov - 17 Nov 2026), laju penyerapan produk di seluruh jaringan mitra mencapai 88.1% dari buffer acuan, dengan 4 cabang teratas menunjukkan perputaran stok sangat cepat. Namun, terdapat 9 cabang mitra—termasuk Hotel Aruna Jakarta dan Hotel Pelangi Makassar—yang berada dalam status kritis dengan ketahanan stok tersisa hanya 1.3 hingga 34.4 hari, melanggar batas aman lead time pabrik (5–7 hari). Admin logistik wajib memprioritaskan penerbitan surat jalan armada pengiriman sebelum akhir pekan ini, sementara 102 cabang dengan stok menumpuk di rak perlu dievaluasi kapasitas pajangnya guna menghindari barang mandek.",
      "network_avg_absorption_rate": 0.881,
      "total_critical_branches": 9,
      "total_slow_moving_branches": 102,
      "min_safe_stock_days": 1.3,
      "avg_critical_safe_days": 34.4,
      "priority_actions": [
        {
          "priority": "P1 - Segera Kirim (1–2 Hari)",
          "target": "Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
          "action": "Keluarkan ready stock gudang pusat untuk mengisi kembali buffer toko sebelum stok habis (sisa 1.3 hari).",
          "risk_level": "Kritis"
        },
        {
          "priority": "P2 - Penyesuaian Jadwal Lonjakan (Tipe A & B)",
          "target": "Cabang Perhotelan & Kafe (Jakarta, Makassar, Cijeruk)",
          "action": "Jadwalkan armada Kamis Sore / Jumat Pagi untuk mengakomodasi lonjakan konsumsi akhir pekan sebesar 25–30%.",
          "risk_level": "Waspada"
        },
        {
          "priority": "P3 - Evaluasi Deadstock & Display Rak",
          "target": "102 Cabang Mitra Lambat / Inaktif",
          "action": "Lakukan program display ulang, pendampingan pelaporan stok fisik, atau penarikan stok jika mandek > 30 hari.",
          "risk_level": "Perhatian"
        }
      ],
      "city_insights": {
        "Jakarta": {
          "city": "Jakarta",
          "headline": "Stok Kritis di Jakarta: Hotel Aruna Jakarta Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Jakarta mencatat konsumsi tinggi sebesar 770 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 2,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 770.0,
          "total_stock": 130.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta hari ini."
        },
        "Makassar": {
          "city": "Makassar",
          "headline": "Stok Kritis di Makassar: Hotel Pelangi Makassar Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Makassar mencatat konsumsi tinggi sebesar 875 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 875.0,
          "total_stock": 421.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Makassar hari ini."
        },
        "Cijeruk": {
          "city": "Cijeruk",
          "headline": "Stok Kritis di Cijeruk: kopken cijeruk Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Cijeruk mencatat konsumsi tinggi sebesar 259 pcs minggu ini. Ketahanan stok tersisa hanya 4.7 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 1,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 259.0,
          "total_stock": 349.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cijeruk hari ini."
        },
        "Semarang": {
          "city": "Semarang",
          "headline": "Stok Kritis di Semarang: Minimarket Lestari Semarang Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Semarang mencatat konsumsi tinggi sebesar 210 pcs minggu ini. Ketahanan stok tersisa hanya 5.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 210.0,
          "total_stock": 516.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Semarang hari ini."
        },
        "Jabodetabek": {
          "city": "Jabodetabek",
          "headline": "Belum Ada Penjualan Aktif di Jabodetabek",
          "summary": "Terdapat 16 cabang di Jabodetabek dengan total stok 2234 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 16,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 2234.0,
          "recommended_action": "Hubungi PIC cabang di Jabodetabek untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Malang": {
          "city": "Malang",
          "headline": "Belum Ada Penjualan Aktif di Malang",
          "summary": "Terdapat 4 cabang di Malang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Malang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Depok": {
          "city": "Depok",
          "headline": "Belum Ada Penjualan Aktif di Depok",
          "summary": "Terdapat 4 cabang di Depok dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Depok untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Tangerang Selatan": {
          "city": "Tangerang Selatan",
          "headline": "Belum Ada Penjualan Aktif di Tangerang Selatan",
          "summary": "Terdapat 4 cabang di Tangerang Selatan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Tangerang Selatan untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Bandung": {
          "city": "Bandung",
          "headline": "Belum Ada Penjualan Aktif di Bandung",
          "summary": "Terdapat 4 cabang di Bandung dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Bandung untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Timur": {
          "city": "Jakarta Timur",
          "headline": "Belum Ada Penjualan Aktif di Jakarta Timur",
          "summary": "Terdapat 4 cabang di Jakarta Timur dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Jakarta Timur untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Cirebon": {
          "city": "Cirebon",
          "headline": "Stok Kritis di Cirebon: Restoran Purnama Cirebon Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Cirebon mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 759.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cirebon hari ini."
        },
        "Jakarta Utara": {
          "city": "Jakarta Utara",
          "headline": "Penjualan Berjalan Stabil di Jakarta Utara",
          "summary": "Mitra di Jakarta Utara mencatat konsumsi teratur sebesar 0 pcs dengan sisa stok 855 pcs di rak. Pasokan berada dalam batas aman lead time.",
          "status": "Aman",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 0,
          "total_consumption": 0.0,
          "total_stock": 855.0,
          "recommended_action": "Lanjutkan jadwal armada rutin mingguan untuk wilayah Jakarta Utara."
        },
        "Solo": {
          "city": "Solo",
          "headline": "Stok Kritis di Solo: Restoran Mentari Solo Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Solo mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 2,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 742.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Solo hari ini."
        },
        "Bogor": {
          "city": "Bogor",
          "headline": "Stok Kritis di Bogor: Kafe Melati Bogor Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Bogor mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 58.1 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 514.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Bogor hari ini."
        },
        "Surabaya": {
          "city": "Surabaya",
          "headline": "Belum Ada Penjualan Aktif di Surabaya",
          "summary": "Terdapat 4 cabang di Surabaya dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Surabaya untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Tangerang": {
          "city": "Tangerang",
          "headline": "Belum Ada Penjualan Aktif di Tangerang",
          "summary": "Terdapat 4 cabang di Tangerang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Tangerang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Denpasar": {
          "city": "Denpasar",
          "headline": "Belum Ada Penjualan Aktif di Denpasar",
          "summary": "Terdapat 4 cabang di Denpasar dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Denpasar untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Bekasi": {
          "city": "Bekasi",
          "headline": "Belum Ada Penjualan Aktif di Bekasi",
          "summary": "Terdapat 4 cabang di Bekasi dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Bekasi untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Medan": {
          "city": "Medan",
          "headline": "Belum Ada Penjualan Aktif di Medan",
          "summary": "Terdapat 4 cabang di Medan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Medan untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Barat": {
          "city": "Jakarta Barat",
          "headline": "Belum Ada Penjualan Aktif di Jakarta Barat",
          "summary": "Terdapat 4 cabang di Jakarta Barat dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Jakarta Barat untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Palembang": {
          "city": "Palembang",
          "headline": "Belum Ada Penjualan Aktif di Palembang",
          "summary": "Terdapat 4 cabang di Palembang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Palembang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Mataram": {
          "city": "Mataram",
          "headline": "Belum Ada Penjualan Aktif di Mataram",
          "summary": "Terdapat 4 cabang di Mataram dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Mataram untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Selatan": {
          "city": "Jakarta Selatan",
          "headline": "Stok Kritis di Jakarta Selatan: Minimarket Arunika Jakarta Selatan Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Jakarta Selatan mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 406.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta Selatan hari ini."
        },
        "Yogyakarta": {
          "city": "Yogyakarta",
          "headline": "Stok Kritis di Yogyakarta: Minimarket Angkasa Yogyakarta Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Yogyakarta mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 397.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Yogyakarta hari ini."
        },
        "Serpong": {
          "city": "Serpong",
          "headline": "Belum Ada Penjualan Aktif di Serpong",
          "summary": "Terdapat 2 cabang di Serpong dengan total stok 120 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 2,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 120.0,
          "recommended_action": "Hubungi PIC cabang di Serpong untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "BSD": {
          "city": "BSD",
          "headline": "Belum Ada Penjualan Aktif di BSD",
          "summary": "Terdapat 1 cabang di BSD dengan total stok 90 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 1,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 90.0,
          "recommended_action": "Hubungi PIC cabang di BSD untuk konfirmasi pelaporan stok atau program promo toko."
        }
      }
    },
    "2026-W45": {
      "period_id": "2026-W45",
      "period_label": "Minggu 1 - Nov 2026 (03 Nov - 10 Nov 2026)",
      "headline": "9 Cabang Kritis Menjelang Batas Lead Time Pabrik: Prioritaskan Pengiriman ke Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
      "executive_summary": "Pada Minggu 1 - Nov 2026 (03 Nov - 10 Nov 2026), laju penyerapan produk di seluruh jaringan mitra mencapai 88.1% dari buffer acuan, dengan 4 cabang teratas menunjukkan perputaran stok sangat cepat. Namun, terdapat 9 cabang mitra—termasuk Hotel Aruna Jakarta dan Hotel Pelangi Makassar—yang berada dalam status kritis dengan ketahanan stok tersisa hanya 1.3 hingga 34.4 hari, melanggar batas aman lead time pabrik (5–7 hari). Admin logistik wajib memprioritaskan penerbitan surat jalan armada pengiriman sebelum akhir pekan ini, sementara 102 cabang dengan stok menumpuk di rak perlu dievaluasi kapasitas pajangnya guna menghindari barang mandek.",
      "network_avg_absorption_rate": 0.881,
      "total_critical_branches": 9,
      "total_slow_moving_branches": 102,
      "min_safe_stock_days": 1.3,
      "avg_critical_safe_days": 34.4,
      "priority_actions": [
        {
          "priority": "P1 - Segera Kirim (1–2 Hari)",
          "target": "Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
          "action": "Keluarkan ready stock gudang pusat untuk mengisi kembali buffer toko sebelum stok habis (sisa 1.3 hari).",
          "risk_level": "Kritis"
        },
        {
          "priority": "P2 - Penyesuaian Jadwal Lonjakan (Tipe A & B)",
          "target": "Cabang Perhotelan & Kafe (Jakarta, Makassar, Cijeruk)",
          "action": "Jadwalkan armada Kamis Sore / Jumat Pagi untuk mengakomodasi lonjakan konsumsi akhir pekan sebesar 25–30%.",
          "risk_level": "Waspada"
        },
        {
          "priority": "P3 - Evaluasi Deadstock & Display Rak",
          "target": "102 Cabang Mitra Lambat / Inaktif",
          "action": "Lakukan program display ulang, pendampingan pelaporan stok fisik, atau penarikan stok jika mandek > 30 hari.",
          "risk_level": "Perhatian"
        }
      ],
      "city_insights": {
        "Jakarta": {
          "city": "Jakarta",
          "headline": "Stok Kritis di Jakarta: Hotel Aruna Jakarta Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Jakarta mencatat konsumsi tinggi sebesar 708 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 2,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 708.4,
          "total_stock": 130.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta hari ini."
        },
        "Makassar": {
          "city": "Makassar",
          "headline": "Stok Kritis di Makassar: Hotel Pelangi Makassar Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Makassar mencatat konsumsi tinggi sebesar 805 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 805.0,
          "total_stock": 421.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Makassar hari ini."
        },
        "Cijeruk": {
          "city": "Cijeruk",
          "headline": "Stok Kritis di Cijeruk: kopken cijeruk Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Cijeruk mencatat konsumsi tinggi sebesar 238 pcs minggu ini. Ketahanan stok tersisa hanya 4.7 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 1,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 238.3,
          "total_stock": 349.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cijeruk hari ini."
        },
        "Semarang": {
          "city": "Semarang",
          "headline": "Stok Kritis di Semarang: Minimarket Lestari Semarang Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Semarang mencatat konsumsi tinggi sebesar 193 pcs minggu ini. Ketahanan stok tersisa hanya 5.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 193.2,
          "total_stock": 516.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Semarang hari ini."
        },
        "Jabodetabek": {
          "city": "Jabodetabek",
          "headline": "Belum Ada Penjualan Aktif di Jabodetabek",
          "summary": "Terdapat 16 cabang di Jabodetabek dengan total stok 2234 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 16,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 2234.0,
          "recommended_action": "Hubungi PIC cabang di Jabodetabek untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Malang": {
          "city": "Malang",
          "headline": "Belum Ada Penjualan Aktif di Malang",
          "summary": "Terdapat 4 cabang di Malang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Malang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Depok": {
          "city": "Depok",
          "headline": "Belum Ada Penjualan Aktif di Depok",
          "summary": "Terdapat 4 cabang di Depok dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Depok untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Tangerang Selatan": {
          "city": "Tangerang Selatan",
          "headline": "Belum Ada Penjualan Aktif di Tangerang Selatan",
          "summary": "Terdapat 4 cabang di Tangerang Selatan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Tangerang Selatan untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Bandung": {
          "city": "Bandung",
          "headline": "Belum Ada Penjualan Aktif di Bandung",
          "summary": "Terdapat 4 cabang di Bandung dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Bandung untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Timur": {
          "city": "Jakarta Timur",
          "headline": "Belum Ada Penjualan Aktif di Jakarta Timur",
          "summary": "Terdapat 4 cabang di Jakarta Timur dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Jakarta Timur untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Cirebon": {
          "city": "Cirebon",
          "headline": "Stok Kritis di Cirebon: Restoran Purnama Cirebon Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Cirebon mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 759.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cirebon hari ini."
        },
        "Jakarta Utara": {
          "city": "Jakarta Utara",
          "headline": "Penjualan Berjalan Stabil di Jakarta Utara",
          "summary": "Mitra di Jakarta Utara mencatat konsumsi teratur sebesar 0 pcs dengan sisa stok 855 pcs di rak. Pasokan berada dalam batas aman lead time.",
          "status": "Aman",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 0,
          "total_consumption": 0.0,
          "total_stock": 855.0,
          "recommended_action": "Lanjutkan jadwal armada rutin mingguan untuk wilayah Jakarta Utara."
        },
        "Solo": {
          "city": "Solo",
          "headline": "Stok Kritis di Solo: Restoran Mentari Solo Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Solo mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 2,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 742.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Solo hari ini."
        },
        "Bogor": {
          "city": "Bogor",
          "headline": "Stok Kritis di Bogor: Kafe Melati Bogor Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Bogor mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 58.1 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 514.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Bogor hari ini."
        },
        "Surabaya": {
          "city": "Surabaya",
          "headline": "Belum Ada Penjualan Aktif di Surabaya",
          "summary": "Terdapat 4 cabang di Surabaya dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Surabaya untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Tangerang": {
          "city": "Tangerang",
          "headline": "Belum Ada Penjualan Aktif di Tangerang",
          "summary": "Terdapat 4 cabang di Tangerang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Tangerang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Denpasar": {
          "city": "Denpasar",
          "headline": "Belum Ada Penjualan Aktif di Denpasar",
          "summary": "Terdapat 4 cabang di Denpasar dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Denpasar untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Bekasi": {
          "city": "Bekasi",
          "headline": "Belum Ada Penjualan Aktif di Bekasi",
          "summary": "Terdapat 4 cabang di Bekasi dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Bekasi untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Medan": {
          "city": "Medan",
          "headline": "Belum Ada Penjualan Aktif di Medan",
          "summary": "Terdapat 4 cabang di Medan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Medan untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Barat": {
          "city": "Jakarta Barat",
          "headline": "Belum Ada Penjualan Aktif di Jakarta Barat",
          "summary": "Terdapat 4 cabang di Jakarta Barat dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Jakarta Barat untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Palembang": {
          "city": "Palembang",
          "headline": "Belum Ada Penjualan Aktif di Palembang",
          "summary": "Terdapat 4 cabang di Palembang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Palembang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Mataram": {
          "city": "Mataram",
          "headline": "Belum Ada Penjualan Aktif di Mataram",
          "summary": "Terdapat 4 cabang di Mataram dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Mataram untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Selatan": {
          "city": "Jakarta Selatan",
          "headline": "Stok Kritis di Jakarta Selatan: Minimarket Arunika Jakarta Selatan Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Jakarta Selatan mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 406.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta Selatan hari ini."
        },
        "Yogyakarta": {
          "city": "Yogyakarta",
          "headline": "Stok Kritis di Yogyakarta: Minimarket Angkasa Yogyakarta Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Yogyakarta mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 397.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Yogyakarta hari ini."
        },
        "Serpong": {
          "city": "Serpong",
          "headline": "Belum Ada Penjualan Aktif di Serpong",
          "summary": "Terdapat 2 cabang di Serpong dengan total stok 120 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 2,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 120.0,
          "recommended_action": "Hubungi PIC cabang di Serpong untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "BSD": {
          "city": "BSD",
          "headline": "Belum Ada Penjualan Aktif di BSD",
          "summary": "Terdapat 1 cabang di BSD dengan total stok 90 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 1,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 90.0,
          "recommended_action": "Hubungi PIC cabang di BSD untuk konfirmasi pelaporan stok atau program promo toko."
        }
      }
    },
    "2026-W44": {
      "period_id": "2026-W44",
      "period_label": "Minggu 4 - Okt 2026 (27 Okt - 03 Nov 2026)",
      "headline": "9 Cabang Kritis Menjelang Batas Lead Time Pabrik: Prioritaskan Pengiriman ke Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
      "executive_summary": "Pada Minggu 4 - Okt 2026 (27 Okt - 03 Nov 2026), laju penyerapan produk di seluruh jaringan mitra mencapai 88.1% dari buffer acuan, dengan 4 cabang teratas menunjukkan perputaran stok sangat cepat. Namun, terdapat 9 cabang mitra—termasuk Hotel Aruna Jakarta dan Hotel Pelangi Makassar—yang berada dalam status kritis dengan ketahanan stok tersisa hanya 1.3 hingga 34.4 hari, melanggar batas aman lead time pabrik (5–7 hari). Admin logistik wajib memprioritaskan penerbitan surat jalan armada pengiriman sebelum akhir pekan ini, sementara 102 cabang dengan stok menumpuk di rak perlu dievaluasi kapasitas pajangnya guna menghindari barang mandek.",
      "network_avg_absorption_rate": 0.881,
      "total_critical_branches": 9,
      "total_slow_moving_branches": 102,
      "min_safe_stock_days": 1.3,
      "avg_critical_safe_days": 34.4,
      "priority_actions": [
        {
          "priority": "P1 - Segera Kirim (1–2 Hari)",
          "target": "Hotel Aruna Jakarta dan Hotel Pelangi Makassar",
          "action": "Keluarkan ready stock gudang pusat untuk mengisi kembali buffer toko sebelum stok habis (sisa 1.3 hari).",
          "risk_level": "Kritis"
        },
        {
          "priority": "P2 - Penyesuaian Jadwal Lonjakan (Tipe A & B)",
          "target": "Cabang Perhotelan & Kafe (Jakarta, Makassar, Cijeruk)",
          "action": "Jadwalkan armada Kamis Sore / Jumat Pagi untuk mengakomodasi lonjakan konsumsi akhir pekan sebesar 25–30%.",
          "risk_level": "Waspada"
        },
        {
          "priority": "P3 - Evaluasi Deadstock & Display Rak",
          "target": "102 Cabang Mitra Lambat / Inaktif",
          "action": "Lakukan program display ulang, pendampingan pelaporan stok fisik, atau penarikan stok jika mandek > 30 hari.",
          "risk_level": "Perhatian"
        }
      ],
      "city_insights": {
        "Jakarta": {
          "city": "Jakarta",
          "headline": "Stok Kritis di Jakarta: Hotel Aruna Jakarta Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Jakarta mencatat konsumsi tinggi sebesar 654 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 2,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 654.5,
          "total_stock": 130.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta hari ini."
        },
        "Makassar": {
          "city": "Makassar",
          "headline": "Stok Kritis di Makassar: Hotel Pelangi Makassar Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Makassar mencatat konsumsi tinggi sebesar 744 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 743.8,
          "total_stock": 421.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Makassar hari ini."
        },
        "Cijeruk": {
          "city": "Cijeruk",
          "headline": "Stok Kritis di Cijeruk: kopken cijeruk Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Cijeruk mencatat konsumsi tinggi sebesar 220 pcs minggu ini. Ketahanan stok tersisa hanya 4.7 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 1,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 220.2,
          "total_stock": 349.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cijeruk hari ini."
        },
        "Semarang": {
          "city": "Semarang",
          "headline": "Stok Kritis di Semarang: Minimarket Lestari Semarang Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Semarang mencatat konsumsi tinggi sebesar 178 pcs minggu ini. Ketahanan stok tersisa hanya 5.3 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 178.5,
          "total_stock": 516.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Semarang hari ini."
        },
        "Jabodetabek": {
          "city": "Jabodetabek",
          "headline": "Belum Ada Penjualan Aktif di Jabodetabek",
          "summary": "Terdapat 16 cabang di Jabodetabek dengan total stok 2234 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 16,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 2234.0,
          "recommended_action": "Hubungi PIC cabang di Jabodetabek untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Malang": {
          "city": "Malang",
          "headline": "Belum Ada Penjualan Aktif di Malang",
          "summary": "Terdapat 4 cabang di Malang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Malang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Depok": {
          "city": "Depok",
          "headline": "Belum Ada Penjualan Aktif di Depok",
          "summary": "Terdapat 4 cabang di Depok dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Depok untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Tangerang Selatan": {
          "city": "Tangerang Selatan",
          "headline": "Belum Ada Penjualan Aktif di Tangerang Selatan",
          "summary": "Terdapat 4 cabang di Tangerang Selatan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Tangerang Selatan untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Bandung": {
          "city": "Bandung",
          "headline": "Belum Ada Penjualan Aktif di Bandung",
          "summary": "Terdapat 4 cabang di Bandung dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Bandung untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Timur": {
          "city": "Jakarta Timur",
          "headline": "Belum Ada Penjualan Aktif di Jakarta Timur",
          "summary": "Terdapat 4 cabang di Jakarta Timur dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Jakarta Timur untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Cirebon": {
          "city": "Cirebon",
          "headline": "Stok Kritis di Cirebon: Restoran Purnama Cirebon Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Cirebon mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 759.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cirebon hari ini."
        },
        "Jakarta Utara": {
          "city": "Jakarta Utara",
          "headline": "Penjualan Berjalan Stabil di Jakarta Utara",
          "summary": "Mitra di Jakarta Utara mencatat konsumsi teratur sebesar 0 pcs dengan sisa stok 855 pcs di rak. Pasokan berada dalam batas aman lead time.",
          "status": "Aman",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 0,
          "total_consumption": 0.0,
          "total_stock": 855.0,
          "recommended_action": "Lanjutkan jadwal armada rutin mingguan untuk wilayah Jakarta Utara."
        },
        "Solo": {
          "city": "Solo",
          "headline": "Stok Kritis di Solo: Restoran Mentari Solo Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Solo mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 2,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 742.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Solo hari ini."
        },
        "Bogor": {
          "city": "Bogor",
          "headline": "Stok Kritis di Bogor: Kafe Melati Bogor Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Bogor mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 58.1 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 514.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Bogor hari ini."
        },
        "Surabaya": {
          "city": "Surabaya",
          "headline": "Belum Ada Penjualan Aktif di Surabaya",
          "summary": "Terdapat 4 cabang di Surabaya dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Surabaya untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Tangerang": {
          "city": "Tangerang",
          "headline": "Belum Ada Penjualan Aktif di Tangerang",
          "summary": "Terdapat 4 cabang di Tangerang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Tangerang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Denpasar": {
          "city": "Denpasar",
          "headline": "Belum Ada Penjualan Aktif di Denpasar",
          "summary": "Terdapat 4 cabang di Denpasar dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Denpasar untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Bekasi": {
          "city": "Bekasi",
          "headline": "Belum Ada Penjualan Aktif di Bekasi",
          "summary": "Terdapat 4 cabang di Bekasi dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Bekasi untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Medan": {
          "city": "Medan",
          "headline": "Belum Ada Penjualan Aktif di Medan",
          "summary": "Terdapat 4 cabang di Medan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Medan untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Barat": {
          "city": "Jakarta Barat",
          "headline": "Belum Ada Penjualan Aktif di Jakarta Barat",
          "summary": "Terdapat 4 cabang di Jakarta Barat dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Jakarta Barat untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Palembang": {
          "city": "Palembang",
          "headline": "Belum Ada Penjualan Aktif di Palembang",
          "summary": "Terdapat 4 cabang di Palembang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Palembang untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Mataram": {
          "city": "Mataram",
          "headline": "Belum Ada Penjualan Aktif di Mataram",
          "summary": "Terdapat 4 cabang di Mataram dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 4,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 546.0,
          "recommended_action": "Hubungi PIC cabang di Mataram untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "Jakarta Selatan": {
          "city": "Jakarta Selatan",
          "headline": "Stok Kritis di Jakarta Selatan: Minimarket Arunika Jakarta Selatan Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Jakarta Selatan mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 406.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta Selatan hari ini."
        },
        "Yogyakarta": {
          "city": "Yogyakarta",
          "headline": "Stok Kritis di Yogyakarta: Minimarket Angkasa Yogyakarta Butuh Kiriman Cepat",
          "summary": "Cabang mitra di Yogyakarta mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
          "status": "Kritis",
          "total_branches": 4,
          "active_branches": 1,
          "critical_branches": 1,
          "total_consumption": 0.0,
          "total_stock": 397.0,
          "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Yogyakarta hari ini."
        },
        "Serpong": {
          "city": "Serpong",
          "headline": "Belum Ada Penjualan Aktif di Serpong",
          "summary": "Terdapat 2 cabang di Serpong dengan total stok 120 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 2,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 120.0,
          "recommended_action": "Hubungi PIC cabang di Serpong untuk konfirmasi pelaporan stok atau program promo toko."
        },
        "BSD": {
          "city": "BSD",
          "headline": "Belum Ada Penjualan Aktif di BSD",
          "summary": "Terdapat 1 cabang di BSD dengan total stok 90 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
          "status": "Stagnan",
          "total_branches": 1,
          "active_branches": 0,
          "critical_branches": 0,
          "total_consumption": 0,
          "total_stock": 90.0,
          "recommended_action": "Hubungi PIC cabang di BSD untuk konfirmasi pelaporan stok atau program promo toko."
        }
      }
    }
  },
  "city_insights": {
    "Jakarta": {
      "city": "Jakarta",
      "headline": "Stok Kritis di Jakarta: Hotel Aruna Jakarta Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Jakarta mencatat konsumsi tinggi sebesar 770 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 2,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 770.0,
      "total_stock": 130.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta hari ini."
    },
    "Makassar": {
      "city": "Makassar",
      "headline": "Stok Kritis di Makassar: Hotel Pelangi Makassar Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Makassar mencatat konsumsi tinggi sebesar 875 pcs minggu ini. Ketahanan stok tersisa hanya 1.3 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 875.0,
      "total_stock": 421.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Makassar hari ini."
    },
    "Cijeruk": {
      "city": "Cijeruk",
      "headline": "Stok Kritis di Cijeruk: kopken cijeruk Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Cijeruk mencatat konsumsi tinggi sebesar 259 pcs minggu ini. Ketahanan stok tersisa hanya 4.7 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 1,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 259.0,
      "total_stock": 349.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cijeruk hari ini."
    },
    "Semarang": {
      "city": "Semarang",
      "headline": "Stok Kritis di Semarang: Minimarket Lestari Semarang Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Semarang mencatat konsumsi tinggi sebesar 210 pcs minggu ini. Ketahanan stok tersisa hanya 5.3 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 210.0,
      "total_stock": 516.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Semarang hari ini."
    },
    "Jabodetabek": {
      "city": "Jabodetabek",
      "headline": "Belum Ada Penjualan Aktif di Jabodetabek",
      "summary": "Terdapat 16 cabang di Jabodetabek dengan total stok 2234 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 16,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 2234.0,
      "recommended_action": "Hubungi PIC cabang di Jabodetabek untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Malang": {
      "city": "Malang",
      "headline": "Belum Ada Penjualan Aktif di Malang",
      "summary": "Terdapat 4 cabang di Malang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Malang untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Depok": {
      "city": "Depok",
      "headline": "Belum Ada Penjualan Aktif di Depok",
      "summary": "Terdapat 4 cabang di Depok dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Depok untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Tangerang Selatan": {
      "city": "Tangerang Selatan",
      "headline": "Belum Ada Penjualan Aktif di Tangerang Selatan",
      "summary": "Terdapat 4 cabang di Tangerang Selatan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Tangerang Selatan untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Bandung": {
      "city": "Bandung",
      "headline": "Belum Ada Penjualan Aktif di Bandung",
      "summary": "Terdapat 4 cabang di Bandung dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Bandung untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Jakarta Timur": {
      "city": "Jakarta Timur",
      "headline": "Belum Ada Penjualan Aktif di Jakarta Timur",
      "summary": "Terdapat 4 cabang di Jakarta Timur dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Jakarta Timur untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Cirebon": {
      "city": "Cirebon",
      "headline": "Stok Kritis di Cirebon: Restoran Purnama Cirebon Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Cirebon mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 0.0,
      "total_stock": 759.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Cirebon hari ini."
    },
    "Jakarta Utara": {
      "city": "Jakarta Utara",
      "headline": "Penjualan Berjalan Stabil di Jakarta Utara",
      "summary": "Mitra di Jakarta Utara mencatat konsumsi teratur sebesar 0 pcs dengan sisa stok 855 pcs di rak. Pasokan berada dalam batas aman lead time.",
      "status": "Aman",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 0,
      "total_consumption": 0.0,
      "total_stock": 855.0,
      "recommended_action": "Lanjutkan jadwal armada rutin mingguan untuk wilayah Jakarta Utara."
    },
    "Solo": {
      "city": "Solo",
      "headline": "Stok Kritis di Solo: Restoran Mentari Solo Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Solo mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 59.4 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 2,
      "critical_branches": 1,
      "total_consumption": 0.0,
      "total_stock": 742.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Solo hari ini."
    },
    "Bogor": {
      "city": "Bogor",
      "headline": "Stok Kritis di Bogor: Kafe Melati Bogor Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Bogor mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 58.1 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 0.0,
      "total_stock": 514.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Bogor hari ini."
    },
    "Surabaya": {
      "city": "Surabaya",
      "headline": "Belum Ada Penjualan Aktif di Surabaya",
      "summary": "Terdapat 4 cabang di Surabaya dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Surabaya untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Tangerang": {
      "city": "Tangerang",
      "headline": "Belum Ada Penjualan Aktif di Tangerang",
      "summary": "Terdapat 4 cabang di Tangerang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Tangerang untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Denpasar": {
      "city": "Denpasar",
      "headline": "Belum Ada Penjualan Aktif di Denpasar",
      "summary": "Terdapat 4 cabang di Denpasar dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Denpasar untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Bekasi": {
      "city": "Bekasi",
      "headline": "Belum Ada Penjualan Aktif di Bekasi",
      "summary": "Terdapat 4 cabang di Bekasi dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Bekasi untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Medan": {
      "city": "Medan",
      "headline": "Belum Ada Penjualan Aktif di Medan",
      "summary": "Terdapat 4 cabang di Medan dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Medan untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Jakarta Barat": {
      "city": "Jakarta Barat",
      "headline": "Belum Ada Penjualan Aktif di Jakarta Barat",
      "summary": "Terdapat 4 cabang di Jakarta Barat dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Jakarta Barat untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Palembang": {
      "city": "Palembang",
      "headline": "Belum Ada Penjualan Aktif di Palembang",
      "summary": "Terdapat 4 cabang di Palembang dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Palembang untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Mataram": {
      "city": "Mataram",
      "headline": "Belum Ada Penjualan Aktif di Mataram",
      "summary": "Terdapat 4 cabang di Mataram dengan total stok 546 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 4,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 546.0,
      "recommended_action": "Hubungi PIC cabang di Mataram untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "Jakarta Selatan": {
      "city": "Jakarta Selatan",
      "headline": "Stok Kritis di Jakarta Selatan: Minimarket Arunika Jakarta Selatan Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Jakarta Selatan mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 0.0,
      "total_stock": 406.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Jakarta Selatan hari ini."
    },
    "Yogyakarta": {
      "city": "Yogyakarta",
      "headline": "Stok Kritis di Yogyakarta: Minimarket Angkasa Yogyakarta Butuh Kiriman Cepat",
      "summary": "Cabang mitra di Yogyakarta mencatat konsumsi tinggi sebesar 0 pcs minggu ini. Ketahanan stok tersisa hanya 60.0 hari, wajib segera dipasok sebelum rak toko kosong.",
      "status": "Kritis",
      "total_branches": 4,
      "active_branches": 1,
      "critical_branches": 1,
      "total_consumption": 0.0,
      "total_stock": 397.0,
      "recommended_action": "Terbitkan pesanan pasokan darurat untuk cabang kritis di Yogyakarta hari ini."
    },
    "Serpong": {
      "city": "Serpong",
      "headline": "Belum Ada Penjualan Aktif di Serpong",
      "summary": "Terdapat 2 cabang di Serpong dengan total stok 120 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 2,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 120.0,
      "recommended_action": "Hubungi PIC cabang di Serpong untuk konfirmasi pelaporan stok atau program promo toko."
    },
    "BSD": {
      "city": "BSD",
      "headline": "Belum Ada Penjualan Aktif di BSD",
      "summary": "Terdapat 1 cabang di BSD dengan total stok 90 pcs di rak toko, namun belum ada catatan penjualan fisik yang dilaporkan pada periode ini.",
      "status": "Stagnan",
      "total_branches": 1,
      "active_branches": 0,
      "critical_branches": 0,
      "total_consumption": 0,
      "total_stock": 90.0,
      "recommended_action": "Hubungi PIC cabang di BSD untuk konfirmasi pelaporan stok atau program promo toko."
    }
  }
} as const;
