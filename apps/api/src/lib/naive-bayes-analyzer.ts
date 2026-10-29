/**
 * Engine Analisis Naive Bayes Multi-Faktor Real-Time (TypeScript)
 * Daisuki B2B Inventory & Order Management System
 * Lokasi: apps/api/src/lib/naive-bayes-analyzer.ts
 */

export interface RawStockAnalysisRow {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  province_name: string;
  regency_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  current_qty: number;
  daily_velocity: number;
  prev_velocity: number;
  critical_events: number;
  zero_stock_events: number;
  has_active_order: number;
}

export interface NaiveBayesItemResult {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  province_name: string;
  regency_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  current_qty: number;
  daily_velocity: number;
  days_of_cover: number;
  sales_surge_ratio: number;
  stockout_probability: number; // 0.0 - 100.0%
  risk_level: "TINGGI" | "SEDANG" | "RENDAH";
  dominant_factor: string;
  suggested_restock_units: number;
}

export interface NaiveBayesRegionalHotspot {
  province_name: string;
  regency_name: string;
  total_partners: number;
  critical_partners_count: number;
  warning_partners_count: number;
  average_stockout_probability: number;
  peak_stockout_probability: number;
  zone: "ZONA_MERAH" | "ZONA_KUNING" | "ZONA_HIJAU";
  primary_risk_driver: string;
  recommended_action: string;
  partners: Array<{
    partner_id: string;
    partner_name: string;
    max_stockout_probability: number;
    average_stockout_probability: number;
    zone: "ZONA_MERAH" | "ZONA_KUNING" | "ZONA_HIJAU";
    urgent_items: Array<{
      product_name: string;
      stockout_probability: number;
    }>;
  }>;
}

export interface NaiveBayesAnalysisResult {
  model_version: string;
  algorithm: string;
  features_evaluated: string[];
  summary: {
    total_items_analyzed: number;
    high_risk_items_count: number;
    surge_detected_count: number;
    red_zone_regions_count: number;
    yellow_zone_regions_count: number;
    green_zone_regions_count: number;
  };
  high_risk_items: NaiveBayesItemResult[];
  regional_hotspots: NaiveBayesRegionalHotspot[];
}

const LEAD_TIME_DAYS = 6;
const FEATURE_NAMES = [
  "days_of_cover",
  "daily_velocity",
  "sales_surge_ratio",
  "lead_time_stress",
  "critical_events",
  "zero_events",
];

function gaussianPdf(x: number, mean: number, variance: number): number {
  const denom = Math.sqrt(2 * Math.PI * variance);
  const exponent = Math.exp(-Math.pow(x - mean, 2) / (2 * variance));
  return (1.0 / denom) * exponent;
}

export function computeDeepNaiveBayes(rows: RawStockAnalysisRow[]): NaiveBayesAnalysisResult {
  if (!rows || rows.length === 0) {
    return {
      model_version: "v2.0-deep-naive-bayes",
      algorithm: "MultiFactorGaussianAndCategoricalNaiveBayes",
      features_evaluated: FEATURE_NAMES,
      summary: {
        total_items_analyzed: 0,
        high_risk_items_count: 0,
        surge_detected_count: 0,
        red_zone_regions_count: 0,
        yellow_zone_regions_count: 0,
        green_zone_regions_count: 0,
      },
      high_risk_items: [],
      regional_hotspots: [],
    };
  }

  // 1. Ekstraksi Fitur & Penentuan Ground-Truth Awal
  type ClassLabel = "RISIKO_TINGGI" | "RISIKO_SEDANG" | "RISIKO_RENDAH";
  const classes: ClassLabel[] = ["RISIKO_TINGGI", "RISIKO_SEDANG", "RISIKO_RENDAH"];

  const dataset: Array<{
    row: RawStockAnalysisRow;
    features: number[];
    ptype: string;
    label: ClassLabel;
    days_of_cover: number;
    sales_surge: number;
    lead_stress: number;
    velocity: number;
  }> = [];

  for (const r of rows) {
    const curQty = Math.max(0, r.current_qty);
    const velocity = Math.max(0.05, r.daily_velocity || 0.05);
    const prevVelocity = Math.max(0.05, r.prev_velocity || 0.05);
    const critEvents = Number(r.critical_events || 0);
    const zeroEvents = Number(r.zero_stock_events || 0);
    const hasOrder = Number(r.has_active_order || 0);

    const daysOfCover = Math.round((curQty / velocity) * 10) / 10;
    const salesSurge = Math.round((velocity / prevVelocity) * 100) / 100;
    const leadStress = Math.round((LEAD_TIME_DAYS / Math.max(daysOfCover, 0.5)) * 100) / 100;

    let label: ClassLabel = "RISIKO_RENDAH";
    if ((daysOfCover < 2.0 || curQty <= 5) && hasOrder === 0) {
      label = "RISIKO_TINGGI";
    } else if (daysOfCover < 4.0 || critEvents >= 2 || salesSurge > 1.35) {
      label = "RISIKO_SEDANG";
    }

    const features = [
      daysOfCover,
      velocity,
      salesSurge,
      leadStress,
      critEvents,
      zeroEvents,
    ];

    dataset.push({
      row: r,
      features,
      ptype: r.partner_type,
      label,
      days_of_cover: daysOfCover,
      sales_surge: salesSurge,
      lead_stress: leadStress,
      velocity,
    });
  }

  // 2. Training Parameter Model Gaussian & Categorical Naive Bayes
  const byClass = new Map<ClassLabel, number[][]>();
  const typeCounts = new Map<ClassLabel, Map<string, number>>();
  const classCounts = new Map<ClassLabel, number>();
  const allTypes = new Set<string>();

  for (const c of classes) {
    byClass.set(c, []);
    typeCounts.set(c, new Map());
    classCounts.set(c, 0);
  }

  for (const item of dataset) {
    byClass.get(item.label)!.push(item.features);
    allTypes.add(item.ptype);
    const tc = typeCounts.get(item.label)!;
    tc.set(item.ptype, (tc.get(item.ptype) ?? 0) + 1);
    classCounts.set(item.label, classCounts.get(item.label)! + 1);
  }

  const numFeatures = FEATURE_NAMES.length;
  const stats = new Map<ClassLabel, Array<{ mean: number; variance: number }>>();
  const classPriors = new Map<ClassLabel, number>();
  const totalSamples = dataset.length;

  for (const c of classes) {
    const samples = byClass.get(c)!;
    classPriors.set(c, (samples.length + 1) / (totalSamples + classes.length));
    const featureStats: Array<{ mean: number; variance: number }> = [];

    for (let j = 0; j < numFeatures; j++) {
      const vals = samples.length > 0 ? samples.map((s) => s[j]) : [0];
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = Math.max(
        vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, vals.length - 1),
        0.0001,
      );
      featureStats.push({ mean, variance });
    }
    stats.set(c, featureStats);
  }

  // 3. Inferensi & Penilaian Probabilitas Posterior
  const itemResults: NaiveBayesItemResult[] = [];
  const partnerAgg = new Map<
    string,
    {
      partner_id: string;
      partner_name: string;
      partner_type: string;
      province_name: string;
      regency_name: string;
      items: NaiveBayesItemResult[];
      max_prob: number;
      sum_prob: number;
    }
  >();

  for (const item of dataset) {
    const r = item.row;
    const logPosteriors: Record<ClassLabel, number> = {
      RISIKO_TINGGI: 0,
      RISIKO_SEDANG: 0,
      RISIKO_RENDAH: 0,
    };

    for (const c of classes) {
      let logProb = Math.log(Math.max(classPriors.get(c)!, 1e-6));

      // Laplace categorical smoothing
      const count = typeCounts.get(c)!.get(item.ptype) ?? 0;
      const totalInClass = classCounts.get(c)!;
      const typeProb = (count + 1) / (totalInClass + allTypes.size + 1);
      logProb += Math.log(typeProb);

      // Gaussian pdf per feature
      const cStats = stats.get(c)!;
      for (let j = 0; j < numFeatures; j++) {
        const { mean, variance } = cStats[j];
        const pdf = Math.max(gaussianPdf(item.features[j], mean, variance), 1e-9);
        logProb += Math.log(pdf);
      }
      logPosteriors[c] = logProb;
    }

    // Softmax normalisasi
    const maxLog = Math.max(...Object.values(logPosteriors));
    const expProbs: Record<string, number> = {};
    let sumExp = 0;
    for (const c of classes) {
      const expVal = Math.exp(logPosteriors[c] - maxLog);
      expProbs[c] = expVal;
      sumExp += expVal;
    }

    const stockoutProb = Math.round(((expProbs.RISIKO_TINGGI || 0) / sumExp) * 1000) / 10;

    // Identifikasi Dominant Driver
    const doc = item.days_of_cover;
    const surge = item.sales_surge;
    const leadStress = item.lead_stress;
    const critFreq = item.features[4];

    let driver = "Keseimbangan stok dan pola konsumsi normal";
    if (doc < 2.0) {
      driver = `Sisa stok kritis (hanya bertahan ~${doc} hari)`;
    } else if (surge > 1.3) {
      driver = `Lonjakan konsumsi tajam (+${Math.round((surge - 1.0) * 100)}% dibanding tren biasa)`;
    } else if (leadStress > 1.2) {
      driver = `Risiko lead time pengiriman (${LEAD_TIME_DAYS} hari) melebihi cakupan stok`;
    } else if (critFreq >= 3) {
      driver = `Frekuensi stok kritis tinggi (${critFreq}x dalam 30 hari)`;
    }

    const neededQty = Math.ceil(item.velocity * (LEAD_TIME_DAYS + 3));
    const suggestedRestock = Math.max(0, neededQty - r.current_qty);

    const resultItem: NaiveBayesItemResult = {
      partner_id: r.partner_id,
      partner_name: r.partner_name,
      partner_type: r.partner_type,
      province_name: r.province_name,
      regency_name: r.regency_name,
      product_id: r.product_id,
      product_name: r.product_name,
      product_sku: r.product_sku,
      current_qty: r.current_qty,
      daily_velocity: Math.round(item.velocity * 10) / 10,
      days_of_cover: item.days_of_cover,
      sales_surge_ratio: item.sales_surge,
      stockout_probability: stockoutProb,
      risk_level: stockoutProb >= 65.0 ? "TINGGI" : stockoutProb >= 30.0 ? "SEDANG" : "RENDAH",
      dominant_factor: driver,
      suggested_restock_units: suggestedRestock,
    };
    itemResults.push(resultItem);

    let pEntry = partnerAgg.get(r.partner_id);
    if (!pEntry) {
      pEntry = {
        partner_id: r.partner_id,
        partner_name: r.partner_name,
        partner_type: r.partner_type,
        province_name: r.province_name,
        regency_name: r.regency_name,
        items: [],
        max_prob: 0,
        sum_prob: 0,
      };
      partnerAgg.set(r.partner_id, pEntry);
    }
    pEntry.items.push(resultItem);
    pEntry.max_prob = Math.max(pEntry.max_prob, stockoutProb);
    pEntry.sum_prob += stockoutProb;
  }

  // 4. Agregasi Tingkat Kabupaten/Kota (Regional Hotspots)
  const regencyAgg = new Map<
    string,
    {
      province_name: string;
      regency_name: string;
      total_partners: number;
      critical_partners_count: number;
      warning_partners_count: number;
      stockout_probabilities: number[];
      partners_list: NaiveBayesRegionalHotspot["partners"];
      driverCounts: Map<string, number>;
    }
  >();

  for (const [, pdata] of partnerAgg) {
    const key = `${pdata.province_name}\u0000${pdata.regency_name}`;
    let regEntry = regencyAgg.get(key);
    if (!regEntry) {
      regEntry = {
        province_name: pdata.province_name,
        regency_name: pdata.regency_name,
        total_partners: 0,
        critical_partners_count: 0,
        warning_partners_count: 0,
        stockout_probabilities: [],
        partners_list: [],
        driverCounts: new Map(),
      };
      regencyAgg.set(key, regEntry);
    }

    regEntry.total_partners += 1;
    const avgPartnerProb = Math.round((pdata.sum_prob / pdata.items.length) * 10) / 10;
    regEntry.stockout_probabilities.push(avgPartnerProb);

    const isCritical = pdata.max_prob >= 65.0;
    const isWarning = pdata.max_prob >= 30.0 && pdata.max_prob < 65.0;

    if (isCritical) {
      regEntry.critical_partners_count += 1;
    } else if (isWarning) {
      regEntry.warning_partners_count += 1;
    }

    for (const itm of pdata.items) {
      if (itm.stockout_probability >= 50.0) {
        regEntry.driverCounts.set(
          itm.dominant_factor,
          (regEntry.driverCounts.get(itm.dominant_factor) ?? 0) + 1,
        );
      }
    }

    regEntry.partners_list.push({
      partner_id: pdata.partner_id,
      partner_name: pdata.partner_name,
      max_stockout_probability: pdata.max_prob,
      average_stockout_probability: avgPartnerProb,
      zone: isCritical ? "ZONA_MERAH" : isWarning ? "ZONA_KUNING" : "ZONA_HIJAU",
      urgent_items: pdata.items
        .filter((i) => i.stockout_probability >= 50.0)
        .sort((a, b) => b.stockout_probability - a.stockout_probability)
        .slice(0, 3)
        .map((i) => ({ product_name: i.product_name, stockout_probability: i.stockout_probability })),
    });
  }

  const regionalHotspots: NaiveBayesRegionalHotspot[] = [];
  for (const [, regData] of regencyAgg) {
    const probs = regData.stockout_probabilities;
    const avgProb =
      probs.length > 0 ? Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 10) / 10 : 0;
    const peakProb = probs.length > 0 ? Math.max(...probs) : 0;

    let zone: "ZONA_MERAH" | "ZONA_KUNING" | "ZONA_HIJAU" = "ZONA_HIJAU";
    let actionPlan = "Pasokan wilayah stabil, pertahankan alokasi restok reguler.";

    if (regData.critical_partners_count >= 1 || avgProb >= 50.0) {
      zone = "ZONA_MERAH";
      actionPlan =
        "Prioritaskan suplai pengiriman darurat ke cabang berisiko tinggi dan amankan buffer stok.";
    } else if (regData.warning_partners_count >= 1 || avgProb >= 25.0) {
      zone = "ZONA_KUNING";
      actionPlan = "Tinjau pengajuan restok cabang dan pantau lonjakan penjualan mingguan.";
    }

    let primaryDriver = "Pola konsumsi stabil";
    let highestDriverCount = 0;
    for (const [drv, cnt] of regData.driverCounts) {
      if (cnt > highestDriverCount) {
        highestDriverCount = cnt;
        primaryDriver = drv;
      }
    }

    regionalHotspots.push({
      province_name: regData.province_name,
      regency_name: regData.regency_name,
      total_partners: regData.total_partners,
      critical_partners_count: regData.critical_partners_count,
      warning_partners_count: regData.warning_partners_count,
      average_stockout_probability: avgProb,
      peak_stockout_probability: peakProb,
      zone,
      primary_risk_driver: primaryDriver,
      recommended_action: actionPlan,
      partners: regData.partners_list.sort(
        (a, b) => b.max_stockout_probability - a.max_stockout_probability,
      ),
    });
  }

  regionalHotspots.sort(
    (a, b) =>
      b.critical_partners_count - a.critical_partners_count ||
      b.peak_stockout_probability - a.peak_stockout_probability ||
      b.average_stockout_probability - a.average_stockout_probability,
  );

  itemResults.sort((a, b) => b.stockout_probability - a.stockout_probability);

  const highRiskItems = itemResults.filter((i) => i.stockout_probability >= 50.0);
  const surgeItems = itemResults.filter((i) => i.sales_surge_ratio >= 1.25);

  return {
    model_version: "v2.0-deep-naive-bayes",
    algorithm: "MultiFactorGaussianAndCategoricalNaiveBayes",
    features_evaluated: FEATURE_NAMES,
    summary: {
      total_items_analyzed: itemResults.length,
      high_risk_items_count: highRiskItems.length,
      surge_detected_count: surgeItems.length,
      red_zone_regions_count: regionalHotspots.filter((r) => r.zone === "ZONA_MERAH").length,
      yellow_zone_regions_count: regionalHotspots.filter((r) => r.zone === "ZONA_KUNING").length,
      green_zone_regions_count: regionalHotspots.filter((r) => r.zone === "ZONA_HIJAU").length,
    },
    high_risk_items: highRiskItems.slice(0, 30),
    regional_hotspots: regionalHotspots,
  };
}
