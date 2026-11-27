export interface WorkerClassifier {
  classes: string[];
  class_log_prior: number[];
  feature_log_prob: number[][];
  vocabulary: Record<string, number>;
}

export interface WorkerClassifierBundle {
  format_version: 1;
  metadata: Record<string, unknown>;
  intent: WorkerClassifier;
  risk: WorkerClassifier | null;
  retrieval: WorkerRetrieval | null;
  raw_retrieval: WorkerRetrieval | null;
  analysis_retrieval: WorkerRetrieval | null;
  history_days?: Record<string, string>;
}

export interface WorkerRetrieval {
  documents: Array<Record<string, unknown>>;
  vocabulary: Record<string, number>;
  idf: number[];
  vectors: Array<Array<[number, number]>>;
  max_excerpts?: number;
}

export function predictWorkerClassifier(model: WorkerClassifier, text: string): { label: string; confidence: number } {
  const tokens = (text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) ?? []);
  const counts = new Map<number, number>();
  for (let i = 0; i < tokens.length; i++) {
    const unigram = model.vocabulary[tokens[i]];
    if (unigram !== undefined) counts.set(unigram, (counts.get(unigram) ?? 0) + 1);
    if (i + 1 < tokens.length) {
      const bigram = model.vocabulary[`${tokens[i]} ${tokens[i + 1]}`];
      if (bigram !== undefined) counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
  }
  const scores = model.class_log_prior.map((prior, classIndex) => {
    let score = prior;
    const probabilities = model.feature_log_prob[classIndex];
    for (const [featureIndex, count] of counts) score += count * probabilities[featureIndex];
    return score;
  });
  const bestIndex = scores.indexOf(Math.max(...scores));
  const maxScore = scores[bestIndex];
  const denominator = scores.reduce((sum, score) => sum + Math.exp(score - maxScore), 0);
  return {
    label: model.classes[bestIndex],
    confidence: Math.round(10_000 / denominator) / 10_000,
  };
}

function scoreWorkerRetrieval(index: WorkerRetrieval | null, query: string): Array<{ position: number; score: number }> {
  if (!index?.documents.length) return [];
  const terms = new Map<number, number>();
  for (const word of query.toLowerCase().split(/\s+/u).filter(Boolean)) {
    const padded = [" ", ...Array.from(word), " "];
    for (let n = 3; n <= 5; n++) {
      if (n > padded.length) break;
      for (let offset = 0; offset + n <= padded.length; offset++) {
        const feature = index.vocabulary[padded.slice(offset, offset + n).join("")];
        if (feature !== undefined) terms.set(feature, (terms.get(feature) ?? 0) + 1);
      }
    }
  }
  const weighted = new Map<number, number>();
  let squaredNorm = 0;
  for (const [feature, count] of terms) {
    const weight = count * index.idf[feature];
    weighted.set(feature, weight);
    squaredNorm += weight * weight;
  }
  if (!squaredNorm) return [];
  const norm = Math.sqrt(squaredNorm);
  const scored = index.vectors.map((row, position) => {
    let score = 0;
    for (const [feature, value] of row) score += value * (weighted.get(feature) ?? 0);
    return { position, score: score / norm };
  });
  return scored;
}

function result(index: WorkerRetrieval, position: number, score: number): Record<string, unknown> {
  return { ...index.documents[position], score: Math.round(score * 10_000) / 10_000 };
}

export function searchWorkerRetrieval(index: WorkerRetrieval | null, query: string): Array<Record<string, unknown>> {
  if (!index) return [];
  const normalized = query.replace(/[^\p{L}\p{N}_\s]+/gu, " ").trim();
  if (!normalized) return [];
  return scoreWorkerRetrieval(index, normalized).filter(({ score }) => score >= 0.08)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, index.max_excerpts ?? 3)
    .map(({ position, score }) => result(index, position, score));
}

export function searchWorkerRawRetrieval(index: WorkerRetrieval | null, query: string): Array<Record<string, unknown>> {
  if (!index) return [];
  const stop = new Set(["siapa", "itu", "tentang", "dokumen", "file", "pdf", "dari"]);
  const queryTerms = new Set((query.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) ?? []).filter((term) => !stop.has(term)));
  const matches = scoreWorkerRetrieval(index, query).map(({ position, score }) => {
    const source = String(index.documents[position].source ?? "").split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    const sourceTerms = new Set((source.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) ?? [])
      .filter((term) => !new Set(["pdf", "doc", "docs", "cv"]).has(term)));
    const titleMatch = [...queryTerms].some((term) => sourceTerms.has(term));
    return { position, score: score + (titleMatch ? 0.5 : 0), threshold: titleMatch ? 0.08 : 0.15 };
  });
  return matches.filter((item) => item.score >= item.threshold)
    .sort((a, b) => b.score - a.score || b.position - a.position).slice(0, 4)
    .map(({ position, score }) => result(index, position, score));
}

export function analysisQueryDay(query: string): string | null {
  const isoDate = query.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const monthNames = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
  const writtenDate = query.toLowerCase().match(/\b(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|september|sep|oktober|okt|november|nov|desember|des)(?:\s+(\d{4}))?\b/);
  return isoDate ?? (writtenDate ? `${writtenDate[3] ?? new Date().getFullYear()}-${String(monthNames.findIndex((month) => month.startsWith(writtenDate[2])) + 1).padStart(2, "0")}-${writtenDate[1].padStart(2, "0")}` : null);
}

const PARTNER_QUERY_STOPWORDS = new Set([
  "mitra", "cabang", "toko", "pada", "tanggal", "tagggal", "tanggah", "tgl", "jam", "pukul",
  "pagi", "siang", "sore", "malam", "malem", "berapa", "berpa", "jumlah", "jumal", "jmalh",
  "log", "logs", "stok", "stock", "minus", "mines", "keluar", "terjual", "konsumsi",
  "dari", "sampai", "ke", "dan", "itu", "ini", "yang", "saya", "ingin", "tau", "tahu",
  "november", "nov", "oktober", "okt", "desember", "des", "wib",
]);

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = temp;
    }
  }
  const maxLen = Math.max(a.length, b.length);
  return (maxLen - prev[b.length]) / maxLen;
}

export function partnerNameSimilarity(query: string, partnerName: string): number {
  if (!partnerName) return 0;
  const qLower = query.toLowerCase();
  const pLower = partnerName.toLowerCase();
  if (qLower.includes(pLower)) return 1;
  const pTokens = (pLower.match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  if (!pTokens.length) return 0;
  const qTokens = (qLower.match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((tok) => !PARTNER_QUERY_STOPWORDS.has(tok));
  if (!qTokens.length) return 0;
  let sum = 0;
  let matched = 0;
  for (const pTok of pTokens) {
    let best = 0;
    for (const qTok of qTokens) {
      const ratio = levenshteinRatio(pTok, qTok);
      if (ratio > best) best = ratio;
    }
    if (best >= 0.7) matched++;
    sum += best;
  }
  if (matched < Math.max(2, pTokens.length)) return 0;
  return sum / pTokens.length;
}

export function searchWorkerAnalysisRetrieval(index: WorkerRetrieval | null, partnerId: string | undefined, query: string, adminAccess = false): Array<Record<string, unknown>> {
  if (!index || (!partnerId && !adminAccess)) return [];
  const own = scoreWorkerRetrieval(index, query).filter(({ position }) => adminAccess || index.documents[position].partner_id === partnerId)
    .sort((a, b) => b.score - a.score || a.position - b.position);
  const day = analysisQueryDay(query);
  if (day) {
    let dated = own.filter(({ position }) => index.documents[position].day === day);
    if (dated.length) {
      const withSim = dated.map((item) => ({
        ...item,
        sim: partnerNameSimilarity(query, String(index.documents[item.position].partner_name ?? "")),
      })).sort((a, b) => b.sim - a.sim);
      if (withSim[0].sim >= 0.72) {
        dated = withSim.filter((item) => item.sim >= 0.72);
      }
      const highest = /tinggi|terbanyak|terbesar|paling|top/i.test(query);
      dated.sort((a, b) => highest
        ? Number(index.documents[b.position].consumed_units ?? 0) - Number(index.documents[a.position].consumed_units ?? 0)
        : b.score - a.score);
      return dated.slice(0, 6).map(({ position, score }) => result(index, position, score));
    }
    return [];
  }
  if (adminAccess) {
    const withSim = own.map((item) => ({
      ...item,
      sim: partnerNameSimilarity(query, String(index.documents[item.position].partner_name ?? "")),
    })).sort((a, b) => b.sim - a.sim || b.score - a.score);
    if (withSim.length && withSim[0].sim >= 0.75) {
      return withSim.filter((item) => item.sim >= 0.75).slice(0, 6)
        .map(({ position, score }) => result(index, position, score));
    }
  }
  const overview = adminAccess ? undefined : own.find(({ position }) => index.documents[position].source === "category_partners.json");
  const lower = query.toLowerCase();
  let selected = own.filter(({ score }) => score >= 0.03).slice(0, 6);
  if (!selected.length && ["minggu", "rangkum", "ringkas", "analisis", "kegiatan"].some((word) => lower.includes(word))) selected = own.slice(0, 6);
  if (overview && ["minggu", "rangkum", "ringkas", "rekap", "analisis"].some((word) => lower.includes(word))) {
    selected = [overview, ...selected.filter(({ position }) => position !== overview.position)].slice(0, 6);
  }
  return selected.map(({ position, score }) => result(index, position, score));
}

export function stockRiskText(row: {
  partner_name: string; partner_type: string; product_name: string; current_qty: number;
  par_level: number; central_stock: number; sold_7d: number; sold_prev_7d: number;
  sold_30d: number; report_count: number; critical_count: number; requested_30d: number;
  approved_30d: number; has_active_order: boolean;
}): string {
  const qty = Math.max(0, Math.trunc(row.current_qty));
  const buffer = Math.max(1, Math.trunc(row.par_level));
  const sold7d = Math.max(0, Math.trunc(row.sold_7d));
  const daily = sold7d / 7;
  const cover = daily > 0 ? qty / daily : qty > 0 ? 99 : 0;
  const critical = Math.max(0, Math.trunc(row.critical_count));
  return `Mitra ${row.partner_name} tipe ${row.partner_type} produk ${row.product_name}. ` +
    `Sisa stok ${qty} pcs, buffer minimal ${buffer} pcs, stok pusat ${Math.trunc(row.central_stock)} pcs. ` +
    `Log konsumsi 7 hari ${sold7d} pcs, 7 hari sebelumnya ${Math.trunc(row.sold_prev_7d)} pcs, ` +
    `30 hari ${Math.trunc(row.sold_30d)} pcs dari ${Math.trunc(row.report_count)} laporan. ` +
    `Cakupan stok ${cover.toFixed(1)} hari, kejadian kritis ${critical} kali. ` +
    `Pesanan 30 hari ${Math.trunc(row.requested_30d)} pcs, disetujui ${Math.trunc(row.approved_30d)} pcs, ` +
    `pesanan aktif ${row.has_active_order ? "ada" : "tidak ada"}.`;
}
