import { sql } from "../../db/client";
import { requestedHistoricalDays } from "./historical-consumption";
import type { ModelResult } from "./model";

type AnalysisDocument = NonNullable<ModelResult["analysis_documents"]>[number];
type ArchivedArtifact = { file_name: string; payload: Record<string, unknown> | null };

function items(payload: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return Array.isArray(payload?.items) ? payload.items.filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

export function selectArchivedDocuments(
  artifacts: ArchivedArtifact[], day: string, period: string, partnerId?: string,
): AnalysisDocument[] {
  const byName = new Map(artifacts.map((artifact) => [artifact.file_name, artifact.payload]));
  const documents: AnalysisDocument[] = [];
  const daily = byName.get("weekly_analytics_summary.json")?.partner_daily_log_breakdown;
  if (Array.isArray(daily)) {
    const matching = daily.filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object" && row.day === day && typeof row.partner_id === "string"
        && (partnerId === undefined || row.partner_id === partnerId) && typeof row.consumed_units === "number"));
    matching.sort((a, b) => Number(b.consumed_units) - Number(a.consumed_units));
    for (const row of matching.slice(0, partnerId ? 1 : 5)) {
      documents.push({ partner_id: String(row.partner_id), source: "neon:partner_daily_consumption",
        period, excerpt: `Konsumsi mitra ${row.partner_name} pada ${day}: ${row.consumed_units} pcs dari ${row.log_count} log.`, score: 1 });
    }
  }
  if (partnerId) {
    for (const name of ["category_partners.json", "category_reporting.json"]) {
      const row = items(byName.get(name) ?? null).find((item) => item.partner_id === partnerId);
      if (row) documents.push({ partner_id: partnerId, source: `neon:${name}`, period,
        excerpt: `Analisis mingguan cabang sendiri ${period}: ${JSON.stringify({ partner_name: row.partner_name,
          weekly_units: row.weekly_units, log_count: row.log_count, active_days: row.active_days,
          reporting_status: row.reporting_status })}`, score: 1 });
    }
    return documents.slice(0, 3);
  }
  const products = items(byName.get("category_products.json") ?? null).slice(0, 4).map((row) => ({
    product_name: row.product_name, weekly_units: row.weekly_units, share_pct: row.share_pct,
  }));
  if (products.length) documents.push({ partner_id: "", source: "neon:category_products.json", period,
    excerpt: `Analisis produk periode ${period}: ${JSON.stringify(products)}`, score: 1 });
  const partners = items(byName.get("category_partners.json") ?? null).slice(0, 5).map((row) => ({
    partner_name: row.partner_name, weekly_units: row.weekly_units, log_count: row.log_count,
  }));
  if (partners.length) documents.push({ partner_id: "", source: "neon:category_partners.json", period,
    excerpt: `Peringkat mingguan mitra periode ${period}: ${JSON.stringify(partners)}`, score: 1 });
  const ai = byName.get("weekly_operational_facts.json");
  if (ai) documents.push({ partner_id: "", source: "neon:weekly_operational_facts.json", period,
    excerpt: `Hasil AI Engineer periode ${period}: ${JSON.stringify({ network_sales: ai.network_sales,
      top_selling_products: ai.top_selling_products, regional_hotspots: Array.isArray(ai.regional_hotspots)
        ? ai.regional_hotspots.slice(0, 3) : [] }).slice(0, 1400)}`, score: 1 });
  return documents.slice(0, 8);
}

export async function loadPublishedAnalysisArchive(message: string, partnerId?: string): Promise<AnalysisDocument[]> {
  const days = requestedHistoricalDays(message);
  if (!days.length) return [];
  const documents: AnalysisDocument[] = [];
  for (const day of days) {
    const [run] = await sql<{ id: string; start_date: string; end_date: string }[]>`
      SELECT id::text, start_date::text, end_date::text FROM analysis_runs
      WHERE status = 'published' AND start_date <= ${day}::date AND end_date >= ${day}::date
      ORDER BY published_at DESC LIMIT 1
    `;
    if (!run) continue;
    const artifacts = await sql<ArchivedArtifact[]>`
      SELECT file_name, payload FROM analysis_run_artifacts WHERE run_id = ${run.id}::uuid
        AND file_name IN ('weekly_analytics_summary.json', 'category_products.json',
          'category_partners.json', 'category_reporting.json', 'weekly_operational_facts.json')
    `;
    documents.push(...selectArchivedDocuments([...artifacts], day, `${run.start_date} sampai ${run.end_date}`, partnerId));
  }
  return [...new Map(documents.map((doc) => [`${doc.source}:${doc.period}:${doc.excerpt}`, doc])).values()].slice(0, 8);
}

export async function loadPartnerDailyFacts(message: string, partnerId: string): Promise<AnalysisDocument[]> {
  const days = requestedHistoricalDays(message);
  const documents: AnalysisDocument[] = [];
  for (const day of days) {
    const start = new Date(`${day}T00:00:00+07:00`);
    const startIso = start.toISOString();
    const endIso = new Date(start.getTime() + 86_400_000).toISOString();
    const rows = await sql<{ product_name: string; units: number; log_count: number }[]>`
      SELECT pr.name AS product_name, SUM(sl.qty_before - sl.qty_after)::int AS units,
        COUNT(*)::int AS log_count
      FROM stock_logs sl JOIN products pr ON pr.id = sl.product_id
      WHERE sl.partner_id = ${partnerId}::uuid AND sl.source = 'manual_update'
        AND sl.qty_before > sl.qty_after AND sl.created_at >= ${startIso}::timestamptz
        AND sl.created_at < ${endIso}::timestamptz
        AND pr.name IN ('Seblak Jadul Instan', 'Basreng Daun Jeruk', 'Makaroni Daun Jeruk', 'Keripik Pisang Rasa Coklat')
      GROUP BY pr.name ORDER BY units DESC
    `;
    const products = [...rows];
    if (products.length) documents.push({ partner_id: partnerId, source: "neon:stock_logs",
      period: day, excerpt: `Konsumsi stok cabang sendiri pada ${day} WIB: ${JSON.stringify({
        total_units: products.reduce((sum, row) => sum + row.units, 0), products,
      })}`, score: 1 });
  }
  return documents;
}
