import { describe, expect, it } from "bun:test";
import { exactStockLogReply, historicalComparisonReply, historicalTopReply,
  parseExactLogRequest, requestedHistoricalDays } from "./historical-consumption";
import { searchWorkerAnalysisRetrieval, type WorkerRetrieval } from "./worker-classifier";
import { selectArchivedDocuments } from "./archived-analysis";

describe("historical consumption", () => {
  it("membaca tanggal Indonesia dan mempertahankan tahun eksplisit", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(requestedHistoricalDays("konsumsi 20 november", now)).toEqual(["2026-11-20"]);
    expect(requestedHistoricalDays("bandingkan 1 oktober 2025 dan 20 november 2026", now))
      .toEqual(["2025-10-01", "2026-11-20"]);
    expect(requestedHistoricalDays("Bandingkan stok Kafe Langit Tangerang pada 18 dan 20 November 2026", now))
      .toEqual(["2026-11-18", "2026-11-20"]);
  });

  it("menjawab mitra teratas dari fakta harian, bukan ringkasan mingguan", () => {
    const reply = historicalTopReply("mitra mana yang paling tinggi konsumsi di tanggal 20 november?", [{
      day: "2026-11-20", total_units: 1012, log_count: 300,
      partners: [{ name: "Cabang A", units: 20, log_count: 1 }, { name: "Cabang B", units: 17, log_count: 3 }],
    }]);
    expect(reply).toContain("Cabang A");
    expect(reply).toContain("20 pcs");
    expect(reply).not.toContain("Cabang B");
  });

  it("membandingkan konsumsi dua tanggal dari log", () => {
    const reply = historicalComparisonReply("bandingkan konsumsi 20 november dan 21 november", [
      { day: "2026-11-20", total_units: 100, log_count: 10, partners: [{ name: "A", units: 100, log_count: 10 }] },
      { day: "2026-11-21", total_units: 75, log_count: 8, partners: [{ name: "A", units: 75, log_count: 8 }] },
    ]);
    expect(reply).toContain("turun **25 pcs**");
  });

  it("membandingkan mitra yang disebut dan tidak menganggap tanggal tanpa log sebagai nol", () => {
    const first = { day: "2026-11-18", total_units: 100, log_count: 10,
      partners: [{ name: "Kafe Langit Tangerang", units: 15, log_count: 3 }, { name: "Kafe Lain", units: 85, log_count: 7 }] };
    const second = { day: "2026-11-20", total_units: 120, log_count: 12,
      partners: [{ name: "Kafe Langit Tangerang", units: 22, log_count: 4 }, { name: "Kafe Lain", units: 98, log_count: 8 }] };
    const question = "Bandingkan stok yang keluar di Kafe Langit Tangerang pada 18 dan 20 November 2026. Tanggal mana yang lebih tinggi, dan berapa selisihnya?";
    expect(historicalComparisonReply(question, [first, second])).toContain("2026-11-20 lebih tinggi **7 pcs**");
    expect(historicalComparisonReply(question, [first, { ...second, partners: [] }]))
      .toContain("Pada 2026-11-20 tidak ada log penurunan stok");
  });

  it("membaca shard tanggal dari KV dengan batas akses mitra", () => {
    const index: WorkerRetrieval = { documents: [
      { partner_id: "a", day: "2026-11-20", consumed_units: 12, source: "partner_daily_consumption" },
      { partner_id: "b", day: "2026-11-20", consumed_units: 20, source: "partner_daily_consumption" },
    ], vocabulary: { " mi": 0, " ko": 1 }, idf: [1, 1], vectors: [[[0, 1]], [[0, 1]]] };
    expect(searchWorkerAnalysisRetrieval(index, undefined, "mitra paling tinggi 20 november 2026", true)[0].partner_id).toBe("b");
    expect(searchWorkerAnalysisRetrieval(index, "a", "konsumsi 20 november 2026").map((row) => row.partner_id)).toEqual(["a"]);
    expect(searchWorkerAnalysisRetrieval(index, "a", "konsumsi 21 november 2026")).toEqual([]);
  });

  it("membaca nama mitra, tanggal singkat, dan menit WIB tanpa mengira-ngira stok", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const request = parseExactLogRequest("berapa stok barang yang keluar pada mitra Kafe Langit Tangerang pada tanggal 18 nov jam 12.32 WIB", now);
    expect(request).toEqual({ partnerName: "Kafe Langit Tangerang", day: "2026-11-18", hour: 12, minute: 32 });
    expect(exactStockLogReply({ ...request!, partnerFound: true, logs: [] })).toContain("Tidak ada log penurunan stok");
    expect(exactStockLogReply({ ...request!, partnerFound: true, logs: [
      { product_name: "Basreng Daun Jeruk", qty_before: 25, qty_after: 19, source: "manual_update", time_wib: "12:32:15" },
    ] })).toContain("**6 pcs**");
  });

  it("mengenali jam bulat pagi/siang/malam, rentang jam, serta typo kata tanggal", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const morning = parseExactLogRequest(
      "jika saya ingin tau berpa jumlah log - nya pada mitra Minimarket Akasia Balikpapan pada tagggal 17 november itu pada jam 9 pagi itu berapa",
      now,
    );
    expect(morning).toEqual({
      partnerName: "Minimarket Akasia Balikpapan",
      day: "2026-11-17",
      hour: 9,
      minute: 0,
      wholeHour: true,
    });
    const typoMorning = parseExactLogRequest(
      "jika saya ingin tau jumal log - mines pada mitra minimarket akasia balikpapa pada tanggah 17 november it pada jam 9 berapa",
      now,
    );
    expect(typoMorning?.day).toBe("2026-11-17");
    expect(typoMorning?.hour).toBe(9);
    expect(typoMorning?.wholeHour).toBe(true);
    const range = parseExactLogRequest(
      "berapa jumlah log stok pada mitra Minimarket Akasia Balikpapan inin dari jam 12siang ke jam 3 sore pada tanggal 17 november??",
      now,
    );
    expect(range).toEqual({
      partnerName: "Minimarket Akasia Balikpapan",
      day: "2026-11-17",
      hour: 12,
      minute: 0,
      wholeHour: true,
      endHour: 15,
    });
  });

  it("membaca arsip Neon per periode tanpa membocorkan mitra lain", () => {
    const artifacts = [
      { file_name: "weekly_analytics_summary.json", payload: { partner_daily_log_breakdown: [
        { day: "2026-11-20", partner_id: "a", partner_name: "A", consumed_units: 7, log_count: 1 },
        { day: "2026-11-20", partner_id: "b", partner_name: "B", consumed_units: 50, log_count: 4 },
      ] } },
      { file_name: "category_partners.json", payload: { items: [
        { partner_id: "a", partner_name: "A", weekly_units: 70, log_count: 8 },
        { partner_id: "b", partner_name: "B", weekly_units: 500, log_count: 20 },
      ] } },
    ];
    const own = selectArchivedDocuments(artifacts, "2026-11-20", "2026-11-16 sampai 2026-11-22", "a");
    expect(own.every((doc) => doc.partner_id === "a")).toBe(true);
    expect(own.map((doc) => doc.excerpt).join(" ")).not.toContain("B");
    const admin = selectArchivedDocuments(artifacts, "2026-11-20", "2026-11-16 sampai 2026-11-22");
    expect(admin[0].excerpt).toContain("50 pcs");
  });
});
