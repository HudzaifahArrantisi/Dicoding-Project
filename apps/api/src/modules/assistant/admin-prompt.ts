import type { AdminContext } from "./admin-context";
import type { AdminIndexedExcerpt } from "./admin-knowledge";
import type { ModelResult } from "./model";

export interface BuildAdminPromptOptions {
  context: AdminContext;
  model: ModelResult;
  knowledgeExcerpts: AdminIndexedExcerpt[];
  companyData?: { company_profile?: unknown; sop_procedures?: unknown; business_rules?: unknown } | null;
  memory?: { summary: string; recent: string };
}

export function buildAdminRagPrompt(options: BuildAdminPromptOptions): string {
  const { context, model, knowledgeExcerpts, companyData, memory } = options;

  const warehouseFacts = context.warehouse.map((w) => ({
    product_name: w.name,
    sku: w.sku,
    central_stock_ready: w.central_stock,
    unit: w.unit,
  }));

  const criticalBranchesList = context.critical_branches.slice(0, 15).map((c) => ({
    partner: c.partner_name,
    type: c.partner_type,
    city: c.city,
    product: c.product_name,
    current_stock: c.current_qty,
    buffer_minimal: c.par_level,
    status: c.status,
    is_stale_24h: c.is_stale,
    sold_7d: c.sold_7d,
  }));

  const pendingOrdersList = context.pending_orders.slice(0, 10).map((o) => ({
    order_no: o.order_no,
    partner: o.partner_name,
    city: o.partner_city,
    order_date: o.created_at,
    note: o.note,
    items: o.items,
  }));

  const shipmentsList = context.active_shipments.slice(0, 10).map((s) => ({
    order_no: s.order_no,
    partner: s.partner_name,
    shipped_at: s.shipped_at,
    items: s.items,
  }));

  const recentLogsList = context.recent_logs.slice(0, 10).map((l) => ({
    partner: l.partner_name,
    product: l.product_name,
    change: `${l.qty_before} -> ${l.qty_after}`,
    source: l.source,
    time: l.created_at,
  }));

  const weeklyFacts = context.weekly_facts ? {
    period_days: context.weekly_facts.metadata?.period_days ?? 7,
    network_sales: context.weekly_facts.network_sales,
    top_selling_products: context.weekly_facts.top_selling_products,
    top_performers_partners: context.weekly_facts.top_performers_partners,
    top_log_partners: context.weekly_facts.top_log_partners,
    regional_hotspots: context.weekly_facts.regional_hotspots,
  } : null;

  return `Anda adalah Asisten AI Administrator Pusat Daisuki Inventory (Daisuki Central Admin AI).
Tugas Anda adalah mendampingi Admin Daisuki Pusat dalam memantau, menganalisis, dan mengambil keputusan logistik, restock, stok gudang pusat, evaluasi cabang mitra, serta menanggapi pertanyaan seputar data sistem, model machine learning (daisuki.pkl), maupun dokumen pengetahuan / karya ilmiah di sistem.

PEDOMAN UTAMA:
1. Peran & Kewenangan: Anda berbicara dengan Admin Pusat. Anda memiliki izin dan akses data penuh atas SELURUH jaringan kemitraan Daisuki (hotel, kafe, restoran, minimarket), stok gudang pusat, antrean pesanan, dan analisis wilayah. Anda TIDAK terikat oleh batasan tenant-isolation milik mitra.
2. Sumber Kebenaran Data Real-Time:
   - Gunakan FAKTA_DATABASE_REALTIME di bawah sebagai sumber mutlak untuk angka stok gudang pusat, kesehatan cabang, daftar cabang kritis, pesanan pending (menunggu persetujuan), kiriman aktif, dan log mutasi terbaru.
   - Jangan mengarang angka atau nomor PO yang tidak ada di fakta database.
3. Sumber Model Machine Learning & Training (daisuki.pkl):
   - daisuki.pkl adalah model lokal Multinomial Naive Bayes untuk klasifikasi intent pesan dan prediksi prioritas risiko restock toko cabang (urgent_restock, regular_order, normal).
   - Analisis spasial wilayah menggunakan Multi-Factor Naive Bayes (Zona Merah, Kuning, Hijau) dari Data Science.
4. Sumber Pengetahuan Dokumen & Output Training (.md) Mainbrain:
   - Gunakan DOKUMEN_PENGETAHUAN_MAINBRAIN jika admin menanyakan tentang karya ilmiah / jurnal penelitian NLP (Karya Ilmiah Hudzaifah Ar-Rantisi tentang Analisis Sentimen Kebijakan Prabowo & MBG dengan SGD Logistic Regression akurasi 86.27% vs ComplementNB 54.17%, dataset 481 komentar), SOP, aturan bisnis, atau profil perusahaan.
   - Sajikan data penelitian, tabel evaluasi, dan distribusi sentimen secara lengkap dan akurat dalam format tabel Markdown jika relevan.
5. Gaya Komunikasi:
   - Bahasa Indonesia profesional, jelas, ramah, analitis, dan solutif.
   - Jika admin menanyakan rekomendasi atau rangkuman, berikan poin-poin yang mudah dibaca dengan angka jelas dan terstruktur.
   - Gunakan format tabel Markdown jika menyajikan perbandingan produk atau cabang.

FAKTA_DATABASE_REALTIME:
${JSON.stringify({
  stok_gudang_pusat: warehouseFacts,
  ringkasan_kesehatan_jaringan: context.summary,
  daftar_cabang_kritis_terkini: criticalBranchesList,
  antrean_pesanan_menunggu_persetujuan: pendingOrdersList,
  pesanan_sedang_dalam_pengiriman: shipmentsList,
  log_mutasi_terbaru: recentLogsList,
  analisis_mingguan_dan_wilayah: weeklyFacts,
})}

STATUS_MODEL_MACHINE_LEARNING:
${JSON.stringify({
  model_available: model.available,
  model_identity: model.identity ?? {
    name: "Daisuki AI Assistant",
    artifact: "daisuki.pkl",
    algorithm: "Multinomial Naive Bayes",
    specialization: "Klasifikasi Intensi & Prediksi Risiko Stok 4 Produk Resmi",
  },
  model_predictions_sample: model.predictions.slice(0, 5),
})}

DOKUMEN_PENGETAHUAN_MAINBRAIN:
${JSON.stringify(knowledgeExcerpts.map((d) => ({
  source: d.source,
  title: d.title,
  excerpt: d.excerpt,
})))}

${companyData ? `PROFIL_PERUSAHAAN_DAN_SOP:\n${JSON.stringify(companyData)}` : ""}

MEMORI_PERCAKAPAN_ADMIN:
${JSON.stringify(memory ?? { summary: "", recent: "" })}
`.trim();
}
