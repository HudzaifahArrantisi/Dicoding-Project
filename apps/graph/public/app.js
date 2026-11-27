const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const WEB_ORIGIN = localHost
  ? `http://${window.location.hostname}:3000`
  : "https://daisuki.my.id";
const API = localHost
  ? `http://${window.location.hostname}:3001/v1`
  : "https://api.daisuki.my.id/v1";
const GITHUB_WORKFLOW =
  "https://github.com/HudzaifahArrantisi/Dicoding-Project/actions/workflows/analysis-pipeline.yml";
const ACTIVE_STATUSES = ["creating", "processing", "approved"];
const REFRESH_ACTIVE_MS = 2000;
const REFRESH_IDLE_MS = 8000;
const REFRESH_TIMEOUT_MS = 9000;

/* 4-band planar grid constants (synced to CSS custom properties --canvas-w / --canvas-h) */
const CANVAS_WIDTH = 1656;
const CANVAS_HEIGHT = 790;
const START_X = 216;
const NODE_STEP = 196;
const BRANCH_OFFSET_X = 56;
const BAND_HEIGHT = 146;
const BAND_Y = [20, 220, 420, 620];
const NODE_Y = BAND_Y.map((y) => y + 16);

const DESKTOP_MQ = window.matchMedia("(min-width: 1080px)");
const MOBILE_MQ = window.matchMedia("(max-width: 640px)");
const COARSE_POINTER_MQ = window.matchMedia("(pointer: coarse)");

const el = (id) => document.getElementById(id);
let latestRuns = [];
let selectedRun = null;
let manualRunId = null;
let latestActiveRunId = null;
const VERSION_KEY = "daisuki-graph-version";
let currentVersion = (() => {
  const requested = new URLSearchParams(window.location.search).get("flow");
  if (requested === "local" || requested === "production") return requested;
  try {
    const saved = window.localStorage.getItem(VERSION_KEY);
    if (saved === "local" || saved === "production") return saved;
  } catch {
    // Local storage can be unavailable in private mode; fall back to host detection.
  }
  return localHost ? "local" : "production";
})();
let pollTimer = null;
let refreshInFlight = false;
let activeAbort = null;
let lastUpdatedAt = 0;
let authBlocked = false;
let selectedStage = "click";
let manualNodeSelection = false;
let flowZoom = 0.85;
let manualZoom = false;
let dragState = null;
let suppressNodeClick = false;
let desktopSidebarPreferredHidden = false;

const THEME_KEY = "daisuki-graph-theme";
const layout = document.querySelector(".layout");
const themeButton = el("theme");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const drawerBackdrop = el("drawer-backdrop");

function prefersLight() {
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;

  const isLight = document.documentElement.dataset.theme === "light" ||
    (!document.documentElement.dataset.theme && prefersLight());

  themeButton.setAttribute("aria-pressed", String(isLight));
  themeButton.setAttribute("aria-label", isLight ? "Ganti ke tema gelap" : "Ganti ke tema terang");
  if (themeMeta) themeMeta.setAttribute("content", isLight ? "#f2f4f7" : "#0b101c");
}

function initTheme() {
  const requested = new URLSearchParams(window.location.search).get("theme");
  let stored = null;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }
  applyTheme(requested === "light" || requested === "dark" ? requested : stored);

  themeButton.addEventListener("click", () => {
    const next = themeButton.getAttribute("aria-pressed") === "true" ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* penyimpanan diblokir, tema tetap berlaku untuk sesi ini */
    }
    applyTheme(next);
  });
}

function isDrawerMode() {
  return !DESKTOP_MQ.matches && !MOBILE_MQ.matches;
}

function setSidebarCollapsed(collapsed, { rememberDesktop = false } = {}) {
  if (rememberDesktop && DESKTOP_MQ.matches) {
    desktopSidebarPreferredHidden = collapsed;
  }
  layout.classList.toggle("is-output-hidden", collapsed);
  const toggleBtn = el("toggle-sidebar");
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  el("sidebar-toggle-label").textContent = collapsed ? "Buka output" : "Tutup output";
  if (drawerBackdrop) {
    drawerBackdrop.classList.toggle("hidden", collapsed || !isDrawerMode());
  }
}

function setMobileView(view) {
  const next = view === "runs" ? "runs" : "flow";
  layout.dataset.mobileView = next;
  el("tab-flow").setAttribute("aria-selected", String(next === "flow"));
  el("tab-runs").setAttribute("aria-selected", String(next === "runs"));
  if (MOBILE_MQ.matches && window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  if (next === "flow") {
    requestAnimationFrame(() => {
      if (!manualZoom) fitFlowToViewport();
      drawWires();
    });
  }
}

function syncResponsiveMode() {
  if (MOBILE_MQ.matches) {
    if (drawerBackdrop) drawerBackdrop.classList.add("hidden");
  } else if (DESKTOP_MQ.matches) {
    setSidebarCollapsed(desktopSidebarPreferredHidden);
  } else {
    setSidebarCollapsed(true);
  }
  const hint = el("canvas-hint");
  if (hint) {
    hint.textContent = COARSE_POINTER_MQ.matches
      ? "Ketuk tahap untuk detail, geser kanvas untuk menjelajah."
      : "Seret node untuk mengatur posisi, geser kanvas untuk berpindah.";
  }
  if (!manualZoom) {
    requestAnimationFrame(() => fitFlowToViewport());
  }
}

function syncVersionTabs() {
  document.querySelectorAll(".version-tab").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.version === currentVersion));
  });
}

function switchVersion(next) {
  if (!VERSIONS[next] || next === currentVersion) return;
  currentVersion = next;
  try {
    window.localStorage.setItem(VERSION_KEY, next);
  } catch {
    // Ignore storage failures; the choice only lasts for this page view.
  }
  selectedStage = "click";
  manualNodeSelection = false;
  syncVersionTabs();
  renderWorkflow();
  paintFlow(selectedRun, latestActiveRunId);
  requestAnimationFrame(() => {
    if (!manualZoom) fitFlowToViewport();
    drawWires();
  });
}

function applyZoom() {
  const viewport = el("flow-viewport");
  viewport.style.setProperty("--canvas-w", `${CANVAS_WIDTH}px`);
  viewport.style.setProperty("--canvas-h", `${CANVAS_HEIGHT}px`);
  viewport.style.setProperty("--flow-zoom", String(flowZoom));
  el("zoom-label").textContent = `${Math.round(flowZoom * 100)}%`;
}

function fitFlowToViewport() {
  const viewport = el("flow-viewport");
  if (!viewport || viewport.clientWidth === 0) return;
  const availW = Math.max(280, viewport.clientWidth - 40);
  const availH = Math.max(220, viewport.clientHeight - 40);
  let target;
  if (MOBILE_MQ.matches) {
    // Readable card size on phones with smooth horizontal scrolling across bands.
    target = Math.min(0.76, Math.max(0.62, availH / CANVAS_HEIGHT));
  } else {
    target = Math.min(availW / CANVAS_WIDTH, availH / CANVAS_HEIGHT);
    target = Math.max(0.55, Math.min(1.0, target));
  }
  flowZoom = Math.round(target * 20) / 20;
  applyZoom();
  // Second pass: shave 5% steps until the frame really fits (guards late layout and scrollbars).
  const frame = viewport.querySelector(".canvas-frame");
  let guard = 0;
  while (frame && frame.getBoundingClientRect().width > viewport.clientWidth - 4 && flowZoom > 0.5 && guard < 8) {
    flowZoom = Math.round((flowZoom - 0.05) * 20) / 20;
    applyZoom();
    guard += 1;
  }
}

const STAGE_INFO = {
  click: { lane: "Data Science", kicker: "PEMICU · ADMIN", title: "Perbarui analisis", summary: "Snapshot Senin sampai waktu klik", detail: "Admin meminta laporan baru. Sistem membatasi snapshot dari awal minggu berjalan sampai waktu permintaan." },
  api: { lane: "Data Science", kicker: "API BACKEND", title: "Terima request API", summary: "POST /analysis/runs", detail: "API memvalidasi sesi, role, serta periode sebelum membuat run analisis." },
  neon: { lane: "Data Science", kicker: "NEON POSTGRES", title: "Simpan run", summary: "ID, periode, status", detail: "Run disimpan dengan ID, tanggal awal dan akhir, status, serta pemilik permintaan." },
  "actions-draft": { lane: "Data Science", kicker: "GITHUB ACTIONS", title: "Jalankan stage draft", summary: "Runner mengambil run terpilih", detail: "Workflow mengambil run berdasarkan ID dan menjalankan agregasi Data Science untuk periode tersebut." },
  "py-draft": { lane: "Data Science", kicker: "BUN · PYTHON LOKAL", title: "Agregasi lokal", summary: "API spawn skrip Python", detail: "API lokal (Bun) menjalankan skrip agregasi Data Science langsung di mesin ini, tanpa GitHub Actions dan tanpa antrean runner." },
  analytics: { lane: "Data Science", kicker: "PYTHON · DATA SCIENCE", title: "Agregasi mingguan", summary: "Empat kategori analisis", detail: "Python merangkum konsumsi produk, konsumsi mitra, aktivitas wilayah, dan pelaporan stok." },
  artifacts: { lane: "Data Science", kicker: "NEON POSTGRES", title: "Simpan laporan", summary: "Laporan dan empat kategori", detail: "Laporan empat kategori, tabel, dan file pendukung disimpan ke Neon sebagai artefak milik run." },
  "active-result": { lane: "Data Science", kicker: "HASIL AKTIF", title: "Grafik final tetap lama", summary: "Hasil aktif sebelumnya dipakai", detail: "Selama run baru masih draft atau sedang ditinjau, grafik final dan ringkasan di web tetap memakai hasil run yang sudah terbit sebelumnya." },
  draft: { lane: "Data Science", kicker: "STATUS · DRAFT", title: "Run berstatus draft", summary: "Artefak disimpan per ID run", detail: "Setelah agregasi selesai, run berubah dari creating menjadi draft. Artefak tersimpan per ID run dan menunggu ditinjau Admin." },
  review: { lane: "Data Science", kicker: "TINJAUAN · ADMIN", title: "Tinjau di AI Insights", summary: "Admin membuka run yang sama", detail: "Admin membuka AI Insights, meninjau laporan empat kategori milik run tersebut, lalu memilih sumber training sebelum memulai proses." },
  "training-click": { lane: "AI Engineer", kicker: "PEMICU · ADMIN", title: "Mulai training model", summary: "Gunakan run Data Science terpilih", detail: "Admin menekan mulai analisis dan training pada AI Insights. Hasil aktif lama tetap dipakai sampai proses baru berhasil diterbitkan." },
  "actions-train": { lane: "AI Engineer", kicker: "GITHUB ACTIONS", title: "Jalankan job AI", summary: "Tujuh job dan training model", detail: "Workflow training mengambil artefak run yang dipilih dari Neon lalu menjalankan tujuh job AI berurutan hingga model terbentuk." },
  "local-jobs": { lane: "AI Engineer", kicker: "BUN · PYTHON LOKAL", title: "Tujuh job lokal", summary: "Training di mesin ini", detail: "API lokal menjalankan tujuh job Python berurutan di mesin yang sama, lalu menyimpan artefak run ke Neon." },
  "training-setup": { lane: "AI Engineer", kicker: "PYTHON · PERSIAPAN", title: "Siapkan data & model", summary: "Artefak run + model sebelumnya", detail: "Runner memuat hasil Data Science dan model aktif sebelumnya sebagai bahan proses training." },
  risk: { lane: "AI Engineer", kicker: "JOB 1 · NAIVE BAYES", title: "Analisis risiko stok", summary: "Prediksi risiko kekurangan stok", detail: "Job menghitung risiko stockout per pasangan mitra dan produk." },
  evaluation: { lane: "AI Engineer", kicker: "JOB 2 · EVALUASI", title: "Evaluasi historis", summary: "Ukur performa prediksi", detail: "Job mengevaluasi prediksi terhadap kejadian historis yang tersedia." },
  allocation: { lane: "AI Engineer", kicker: "JOB 3 · ALOKASI", title: "Pratinjau alokasi", summary: "Prioritas pasokan", detail: "Job menyusun rekomendasi alokasi berdasarkan kebutuhan dan stok." },
  "facts-rag": { lane: "AI Engineer", kicker: "JOB 4 · FAKTA & RAG", title: "Bangun fakta dashboard", summary: "Fakta AI Insights dan RAG", detail: "Job menyiapkan fakta mingguan yang dipakai dashboard dan konteks retrieval chatbot." },
  "model-training": { lane: "AI Engineer", kicker: "JOB 5 · TRAINING", title: "Latih daisuki.pkl", summary: "Model dari sumber run terpilih", detail: "Job memperbarui model menggunakan laporan Data Science atau referensi mentah yang dipilih." },
  fallback: { lane: "AI Engineer", kicker: "JALUR GAGAL", title: "Hasil lama tetap dipakai", summary: "Training gagal aman", detail: "Jika training gagal, run ditandai failed dan model serta hasil aktif sebelumnya tetap dipakai sampai ada training ulang." },
  chart: { lane: "AI Engineer", kicker: "JOB 6 · GRAFIK", title: "Susun grafik model", summary: "Ringkasan prediksi konsumsi", detail: "Job menyiapkan data grafik evaluasi dan ringkasan model untuk ditampilkan." },
  validation: { lane: "AI Engineer", kicker: "JOB 7 · VALIDASI", title: "Validasi keluaran", summary: "Periksa hasil pipeline", detail: "Job memastikan keluaran model dan artefak siap disimpan." },
  persist: { lane: "AI Engineer", kicker: "NEON POSTGRES", title: "Simpan artefak AI", summary: "Model dan hasil run", detail: "Artefak model, evaluasi, fakta, dan hasil AI disimpan ke database untuk run ini." },
  "pkl-local": { lane: "AI Engineer", kicker: "FILE · DAISUKI.PKL", title: "daisuki.pkl aktif", summary: "Dibaca API lokal", detail: "Model ditulis sebagai daisuki.pkl di folder artefak run. API lokal membacanya langsung, tanpa ekspor JSON dan tanpa Cloudflare KV." },
  export: { lane: "AI Engineer", kicker: "EKSPOR MODEL", title: "Ekspor PKL ke JSON", summary: "Format inferensi Worker", detail: "Classifier diekspor dari daisuki.pkl ke format JSON yang dapat dibaca API Worker." },
  kv: { lane: "AI Engineer", kicker: "CLOUDFLARE KV", title: "Publikasikan model", summary: "Binding DAISUKI_MODEL", detail: "File JSON model dipublikasikan ke Workers KV untuk dibaca API Worker." },
  published: { lane: "AI Engineer", kicker: "HASIL AKTIF", title: "Terbitkan AI Insights", summary: "Run terbaru menjadi aktif", detail: "Run ditandai terbit dan aktif. Rekomendasi serta hasil analisis run ini menggantikan hasil aktif sebelumnya." },
  reload: { lane: "AI Engineer", kicker: "API LOKAL", title: "Muat ulang model", summary: "Worker memuat .pkl baru", detail: "API lokal memuat ulang worker model sehingga chatbot dan AI Insights memakai daisuki.pkl versi terbaru." },
  refresh: { lane: "AI Engineer", kicker: "WEB · MUAT ULANG", title: "Muat ulang grafik", summary: "Grafik dan ringkasan terbaru", detail: "Web memuat ulang grafik dan ringkasan dari run terbaru setelah run tersebut terbit, sehingga tampilan Admin memakai hasil yang sama." },
};

/*
  4-band planar Left -> Right layout (0 wire crossings in both Lokal and Produksi):
    Band 1 (y=20):  01..06 Data Science + side branch active-result
    Band 2 (y=220): 07..12 Draft, Review, Trigger & Job 1
    Band 3 (y=420): 13..16 Jobs 2..5 + side branch fallback
    Band 4 (y=620): 17..22 (Lokal) / 17..23 (Produksi) Validation & Publication
*/
const VERSIONS = {
  local: {
    name: "Lokal",
    lanes: [
      { no: "FASE 01", title: "Log & Data", sub: "Bun + Python lokal, agregasi draft", y: BAND_Y[0] },
      { no: "FASE 02", title: "Tinjauan & Pemicu", sub: "Review Admin lalu mulai 7 job lokal", y: BAND_Y[1] },
      { no: "FASE 03", title: "Training Model AI", sub: "Evaluasi, alokasi, RAG, latih .pkl", y: BAND_Y[2] },
      { no: "FASE 04", title: "Publikasi Lokal", sub: "Simpan artefak & muat ulang worker", y: BAND_Y[3] },
    ],
    nodes: [
      { key: "click", row: 0, col: 0, step: "01" },
      { key: "api", row: 0, col: 1, step: "02" },
      { key: "neon", row: 0, col: 2, step: "03" },
      { key: "py-draft", row: 0, col: 3, step: "04" },
      { key: "analytics", row: 0, col: 4, step: "05" },
      { key: "artifacts", row: 0, col: 5, step: "06" },
      { key: "active-result", row: 0, col: 6, branch: true, badge: "AMAN" },

      { key: "draft", row: 1, col: 0, step: "07" },
      { key: "review", row: 1, col: 1, step: "08" },
      { key: "training-click", row: 1, col: 2, step: "09" },
      { key: "local-jobs", row: 1, col: 3, step: "10" },
      { key: "training-setup", row: 1, col: 4, step: "11" },
      { key: "risk", row: 1, col: 5, step: "12" },

      { key: "evaluation", row: 2, col: 0, step: "13" },
      { key: "allocation", row: 2, col: 1, step: "14" },
      { key: "facts-rag", row: 2, col: 2, step: "15" },
      { key: "model-training", row: 2, col: 3, step: "16" },
      { key: "fallback", row: 2, col: 4, branch: true, badge: "GAGAL" },

      { key: "chart", row: 3, col: 0, step: "17" },
      { key: "validation", row: 3, col: 1, step: "18" },
      { key: "persist", row: 3, col: 2, step: "19" },
      { key: "pkl-local", row: 3, col: 3, step: "20" },
      { key: "published", row: 3, col: 4, step: "21" },
      { key: "reload", row: 3, col: 5, step: "22" },
    ],
    edges: [
      ["click", "api"],
      ["api", "neon"],
      ["neon", "py-draft"],
      ["py-draft", "analytics"],
      ["analytics", "artifacts"],
      ["artifacts", "active-result", { kind: "branch", label: "Saat draft" }],
      ["artifacts", "draft"],
      ["draft", "review"],
      ["review", "training-click", { kind: "trigger" }],
      ["training-click", "local-jobs"],
      ["local-jobs", "training-setup"],
      ["training-setup", "risk"],
      ["risk", "evaluation"],
      ["evaluation", "allocation"],
      ["allocation", "facts-rag"],
      ["facts-rag", "model-training"],
      ["model-training", "fallback", { kind: "fail", label: "Jika gagal" }],
      ["model-training", "chart"],
      ["chart", "validation"],
      ["validation", "persist"],
      ["persist", "pkl-local"],
      ["pkl-local", "published"],
      ["published", "reload"],
    ],
    dataStages: ["click", "api", "neon", "py-draft", "analytics", "artifacts", "draft"],
    aiStages: ["training-click", "local-jobs", "training-setup", "risk", "evaluation", "allocation", "facts-rag", "model-training", "chart", "validation", "persist", "pkl-local", "published", "reload"],
    draftRunner: "py-draft",
    trainRunner: "local-jobs",
  },
  production: {
    name: "Produksi",
    lanes: [
      { no: "FASE 01", title: "Log & Data", sub: "Worker API + GitHub Actions draft", y: BAND_Y[0] },
      { no: "FASE 02", title: "Tinjauan & Pemicu", sub: "Review Admin lalu jalankan Actions AI", y: BAND_Y[1] },
      { no: "FASE 03", title: "Training Model AI", sub: "Evaluasi, alokasi, RAG, latih .pkl", y: BAND_Y[2] },
      { no: "FASE 04", title: "Publikasi KV & Web", sub: "Ekspor JSON, Cloudflare KV, terbitkan", y: BAND_Y[3] },
    ],
    nodes: [
      { key: "click", row: 0, col: 0, step: "01" },
      { key: "api", row: 0, col: 1, step: "02" },
      { key: "neon", row: 0, col: 2, step: "03" },
      { key: "actions-draft", row: 0, col: 3, step: "04" },
      { key: "analytics", row: 0, col: 4, step: "05" },
      { key: "artifacts", row: 0, col: 5, step: "06" },
      { key: "active-result", row: 0, col: 6, branch: true, badge: "AMAN" },

      { key: "draft", row: 1, col: 0, step: "07" },
      { key: "review", row: 1, col: 1, step: "08" },
      { key: "training-click", row: 1, col: 2, step: "09" },
      { key: "actions-train", row: 1, col: 3, step: "10" },
      { key: "training-setup", row: 1, col: 4, step: "11" },
      { key: "risk", row: 1, col: 5, step: "12" },

      { key: "evaluation", row: 2, col: 0, step: "13" },
      { key: "allocation", row: 2, col: 1, step: "14" },
      { key: "facts-rag", row: 2, col: 2, step: "15" },
      { key: "model-training", row: 2, col: 3, step: "16" },
      { key: "fallback", row: 2, col: 4, branch: true, badge: "GAGAL" },

      { key: "chart", row: 3, col: 0, step: "17" },
      { key: "validation", row: 3, col: 1, step: "18" },
      { key: "persist", row: 3, col: 2, step: "19" },
      { key: "export", row: 3, col: 3, step: "20" },
      { key: "kv", row: 3, col: 4, step: "21" },
      { key: "published", row: 3, col: 5, step: "22" },
      { key: "refresh", row: 3, col: 6, step: "23" },
    ],
    edges: [
      ["click", "api"],
      ["api", "neon"],
      ["neon", "actions-draft"],
      ["actions-draft", "analytics"],
      ["analytics", "artifacts"],
      ["artifacts", "active-result", { kind: "branch", label: "Saat draft" }],
      ["artifacts", "draft"],
      ["draft", "review"],
      ["review", "training-click", { kind: "trigger" }],
      ["training-click", "actions-train"],
      ["actions-train", "training-setup"],
      ["training-setup", "risk"],
      ["risk", "evaluation"],
      ["evaluation", "allocation"],
      ["allocation", "facts-rag"],
      ["facts-rag", "model-training"],
      ["model-training", "fallback", { kind: "fail", label: "Jika gagal" }],
      ["model-training", "chart"],
      ["chart", "validation"],
      ["validation", "persist"],
      ["persist", "export"],
      ["export", "kv"],
      ["kv", "published"],
      ["published", "refresh"],
    ],
    dataStages: ["click", "api", "neon", "actions-draft", "analytics", "artifacts", "draft"],
    aiStages: ["training-click", "actions-train", "training-setup", "risk", "evaluation", "allocation", "facts-rag", "model-training", "chart", "validation", "persist", "export", "kv", "published", "refresh"],
    draftRunner: "actions-draft",
    trainRunner: "actions-train",
  },
};

function renderWorkflow() {
  const version = VERSIONS[currentVersion];
  const canvas = el("flow-canvas");

  const bandsHtml = version.lanes
    .map(
      (lane) =>
        `<div class="lane-band" style="top:${lane.y}px"><div class="lane-label"><span class="lane-num">${lane.no}</span><strong>${lane.title}</strong><small>${lane.sub}</small></div></div>`,
    )
    .join("");

  const nodesHtml = version.nodes
    .map((item) => {
      const info = STAGE_INFO[item.key];
      const x = START_X + item.col * NODE_STEP + (item.branch ? BRANCH_OFFSET_X : 0);
      const y = NODE_Y[item.row];
      const badgeText = item.step ?? item.badge ?? "";
      return `<button class="flow-node${item.branch ? " branch-node" : ""}" type="button" data-stage="${item.key}" data-x="${x}" data-y="${y}" data-origin-x="${x}" data-origin-y="${y}" style="left:${x}px;top:${y}px" aria-pressed="false" aria-label="${badgeText ? `Tahap ${badgeText}. ` : ""}${info.title}. ${info.summary}."><div class="node-top"><span class="node-kicker">${info.kicker}</span>${badgeText ? `<span class="node-step">${badgeText}</span>` : ""}</div><strong>${info.title}</strong><small>${info.summary}</small><div class="node-foot"><span class="node-state">Menunggu</span></div></button>`;
    })
    .join("");

  canvas.innerHTML =
    bandsHtml +
    `<svg class="flow-wires" id="flow-wires" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" aria-hidden="true"></svg>` +
    nodesHtml;

  canvas.querySelectorAll(".flow-node").forEach((node) => {
    node.addEventListener("click", () => {
      if (suppressNodeClick) { suppressNodeClick = false; return; }
      manualNodeSelection = true;
      selectedStage = node.dataset.stage;
      updateInspector(selectedRun);
    });
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      dragState = { node, pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: Number(node.dataset.x), top: Number(node.dataset.y), moved: false };
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.node !== node || dragState.pointerId !== event.pointerId) return;
      const dx = (event.clientX - dragState.x) / flowZoom;
      const dy = (event.clientY - dragState.y) / flowZoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
      if (!dragState.moved) return;
      const maxX = CANVAS_WIDTH - node.offsetWidth - 16;
      const maxY = CANVAS_HEIGHT - node.offsetHeight - 16;
      const left = Math.max(16, Math.min(maxX, dragState.left + dx));
      const top = Math.max(16, Math.min(maxY, dragState.top + dy));
      node.dataset.x = left;
      node.dataset.y = top;
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
      drawWires();
    });
    const finishDrag = (event) => {
      if (!dragState || dragState.node !== node || dragState.pointerId !== event.pointerId) return;
      suppressNodeClick = dragState.moved;
      dragState = null;
      if (suppressNodeClick) window.setTimeout(() => { suppressNodeClick = false; }, 0);
    };
    node.addEventListener("pointerup", finishDrag);
    node.addEventListener("pointercancel", finishDrag);
  });

  applyZoom();
  bindCanvasControls();
  drawWires();
}

let canvasBound = false;

function bindCanvasControls() {
  if (canvasBound) return;
  canvasBound = true;
  const viewport = el("flow-viewport");
  let pan = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || event.target.closest(".flow-node") || event.button !== 0) return;
    pan = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.classList.add("is-panning");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!pan || event.pointerId !== pan.pointerId) return;
    viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    viewport.scrollTop = pan.top - (event.clientY - pan.y);
  });
  const finishPan = (event) => {
    if (!pan || event.pointerId !== pan.pointerId) return;
    pan = null;
    viewport.classList.remove("is-panning");
  };
  viewport.addEventListener("pointerup", finishPan);
  viewport.addEventListener("pointercancel", finishPan);
  viewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    manualZoom = true;
    const delta = event.deltaY < 0 ? 0.05 : -0.05;
    flowZoom = Math.max(0.5, Math.min(1.25, Math.round((flowZoom + delta) * 20) / 20));
    applyZoom();
  }, { passive: false });
  viewport.addEventListener("keydown", (event) => {
    const step = 80;
    const moves = {
      ArrowLeft: { left: -step, top: 0 },
      ArrowRight: { left: step, top: 0 },
      ArrowUp: { left: 0, top: -step },
      ArrowDown: { left: 0, top: step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    viewport.scrollBy(move);
  });
  el("reset-layout").addEventListener("click", () => {
    el("flow-canvas").querySelectorAll(".flow-node").forEach((node) => {
      node.dataset.x = node.dataset.originX;
      node.dataset.y = node.dataset.originY;
      node.style.left = `${node.dataset.originX}px`;
      node.style.top = `${node.dataset.originY}px`;
    });
    drawWires();
    viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  });
}

function drawWires() {
  const svg = el("flow-wires");
  if (!svg) return;
  const wires = [];
  const anchors = [];
  const labels = [];

  const resolveEdgeState = (from, to, kind) => {
    if (kind === "fail") {
      if (to.classList.contains("ready") || to.classList.contains("failed")) return "failed";
      return "";
    }
    if (kind === "branch") {
      if (to.classList.contains("done")) return "done";
      if (to.classList.contains("ready") || to.classList.contains("active")) return "active";
      return "";
    }
    if (from.classList.contains("done") && to.classList.contains("done")) return "done";
    if (from.classList.contains("done") && (to.classList.contains("active") || to.classList.contains("ready"))) return "active";
    if (to.classList.contains("failed")) return "failed";
    return "";
  };

  const version = VERSIONS[currentVersion];
  for (const [fromKey, toKey, meta = {}] of version.edges) {
    const from = document.querySelector(`[data-stage="${fromKey}"]`);
    const to = document.querySelector(`[data-stage="${toKey}"]`);
    if (!from || !to) continue;

    const fx = Number(from.dataset.x);
    const fy = Number(from.dataset.y);
    const fw = from.offsetWidth || 164;
    const fh = from.offsetHeight || 114;
    const tx = Number(to.dataset.x);
    const ty = Number(to.dataset.y);
    const tw = to.offsetWidth || 164;
    const th = to.offsetHeight || 114;

    const kind = meta.kind ?? "main";
    const state = resolveEdgeState(from, to, kind);
    const dashed = kind !== "main" ? "bridge-wire" : "";
    const markerId = `wire-arrow-${state || "idle"}`;
    const marker = `marker-end="url(#${markerId})"`;

    let d = "";
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;

    if (Math.abs(ty - fy) < 48) {
      // Same band: clean horizontal wire with optional gentle orthogonal step if dragged vertically.
      const forward = tx >= fx;
      const x1 = forward ? fx + fw : fx;
      const x2 = forward ? tx : tx + tw;
      const y1 = fy + fh / 2;
      const y2 = ty + th / 2;
      sx = x1;
      sy = y1;
      lx = (x1 + x2) / 2;
      ly = (y1 + y2) / 2 - 14;
      if (Math.abs(y2 - y1) <= 2) {
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
      } else {
        const mx = (x1 + x2) / 2;
        const dx = forward ? 1 : -1;
        const dy = y2 > y1 ? 1 : -1;
        const r = Math.min(10, Math.abs(mx - x1), Math.abs(y2 - y1) / 2);
        d = `M ${x1} ${y1} L ${mx - dx * r} ${y1} Q ${mx} ${y1} ${mx} ${y1 + dy * r} L ${mx} ${y2 - dy * r} Q ${mx} ${y2} ${mx + dx * r} ${y2} L ${x2} ${y2}`;
      }
    } else if (ty > fy) {
      // Band wrap downwards: orthogonal rounded corridor wire between bands (never touches cards).
      const x1 = fx + fw / 2;
      const y1 = fy + fh;
      const x2 = tx + tw / 2;
      const y2 = ty;
      const midY = Math.round((y1 + y2) / 2);
      sx = x1;
      sy = y1;
      lx = (x1 + x2) / 2;
      ly = midY - 12;
      if (Math.abs(x2 - x1) < 4) {
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
      } else {
        const dir = x2 > x1 ? 1 : -1;
        const r = Math.min(12, Math.abs(x2 - x1) / 2, Math.max(4, Math.abs(midY - y1) - 2), Math.max(4, Math.abs(y2 - midY) - 2));
        d = `M ${x1} ${y1} L ${x1} ${midY - r} Q ${x1} ${midY} ${x1 + dir * r} ${midY} L ${x2 - dir * r} ${midY} Q ${x2} ${midY} ${x2} ${midY + r} L ${x2} ${y2}`;
      }
    } else {
      // Dragged above source: orthogonal rounded corridor upwards.
      const x1 = fx + fw / 2;
      const y1 = fy;
      const x2 = tx + tw / 2;
      const y2 = ty + th;
      const midY = Math.round((y1 + y2) / 2);
      const dir = x2 >= x1 ? 1 : -1;
      const r = Math.min(12, Math.abs(x2 - x1) / 2, Math.max(4, Math.abs(y1 - midY) - 2));
      sx = x1;
      sy = y1;
      lx = (x1 + x2) / 2;
      ly = midY - 12;
      d = `M ${x1} ${y1} L ${x1} ${midY + r} Q ${x1} ${midY} ${x1 + dir * r} ${midY} L ${x2 - dir * r} ${midY} Q ${x2} ${midY} ${x2} ${midY - r} L ${x2} ${y2}`;
    }

    wires.push(`<path class="wire ${state} ${dashed}" data-from="${fromKey}" data-to="${toKey}" d="${d}" ${marker}/>`);
    anchors.push(`<circle class="wire-anchor ${state}" cx="${sx}" cy="${sy}" r="3.5"/>`);

    if (meta.label) {
      const w = Math.max(48, meta.label.length * 6.2 + 12);
      labels.push(
        `<g><rect class="wire-label-bg ${state}" x="${lx - w / 2}" y="${ly - 9}" width="${w}" height="18" rx="5"/><text class="wire-label-text ${state}" x="${lx}" y="${ly}">${escapeHtml(meta.label)}</text></g>`,
      );
    }
  }

  const markerDef = (id, color) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" fill="${color}"/></marker>`;
  svg.innerHTML =
    `<defs>${markerDef("wire-arrow-idle", "var(--wire)")}${markerDef("wire-arrow-done", "var(--wire-done)")}${markerDef("wire-arrow-active", "var(--wire-active)")}${markerDef("wire-arrow-failed", "var(--wire-failed)")}</defs>${wires.join("")}${anchors.join("")}${labels.join("")}`;
}

const stepStage = (label = "") => {
  const name = String(label ?? "").toLowerCase();
  if (name.includes("agregasi")) return "analytics";
  if (name.includes("simpan laporan") || name.includes("artefak analisis")) return "artifacts";
  if (name.includes("persiapan")) return "training-setup";
  if (name.includes("risiko naive bayes")) return "risk";
  if (name.includes("evaluasi historis")) return "evaluation";
  if (name.includes("pratinjau alokasi")) return "allocation";
  if (name.includes("fakta")) return "facts-rag";
  if (name.includes("training") && name.includes("daisuki")) return "model-training";
  if (name.includes("grafik konsumsi")) return "chart";
  if (name.includes("validasi hasil")) return "validation";
  if (name.includes("simpan artefak model")) return "persist";
  if (name.includes("ekspor")) return "export";
  if (name.includes("publikasi model")) return "kv";
  if (name.includes("terbitkan hasil")) return "published";
  if (name) return "training-setup";
  return null;
};

function setNode(name, state, custom) {
  const node = document.querySelector(`[data-stage="${name}"]`);
  if (!node) return;
  node.classList.remove("done", "active", "failed", "ready");
  if (state) node.classList.add(state);
  const labels = { done: "Selesai", active: "Berjalan", ready: "Siap", failed: "Gagal" };
  node.querySelector(".node-state").textContent = custom ?? labels[state] ?? "Menunggu";
}

function updateInspector(run) {
  const info = STAGE_INFO[selectedStage];
  if (!info) return;
  const node = document.querySelector(`[data-stage="${selectedStage}"]`);
  const state = ["done", "active", "ready", "failed"].find((name) => node?.classList.contains(name)) ?? "idle";
  const stateLabels = { done: "Selesai", active: "Sedang berjalan", ready: "Siap dimulai", failed: "Gagal", idle: "Menunggu" };
  el("inspector-kicker").textContent = info.kicker;
  el("inspector-title").textContent = info.title;
  el("inspector-description").textContent = info.detail;
  const statusBadge = el("inspector-status");
  statusBadge.textContent = stateLabels[state];
  statusBadge.dataset.state = state;
  el("inspector-indicator").className = `inspector-indicator ${state}`;
  el("inspector-run").textContent = run ? `${run.start_date} s/d ${run.end_date} · ${run.id.slice(0, 8)}` : "Belum ada run";
  document.querySelectorAll(".flow-node").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.stage === selectedStage)));
}

function paintFlow(run, activeRunId = latestActiveRunId) {
  const version = VERSIONS[currentVersion];
  selectedRun = run;
  document.querySelectorAll(".flow-node").forEach((node) => {
    node.classList.remove("done", "active", "failed", "ready");
    node.querySelector(".node-state").textContent = "Menunggu";
  });
  if (!run) {
    el("workflow-run-label").textContent = "Belum ada run analisis";
    updateInspector(null);
    return;
  }

  const status = run.status;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const stage = stepStage(run.current_step);
  const isTrain = ["processing", "published"].includes(status) || steps.some((item) => version.aiStages.includes(stepStage(item.label)));
  const isActiveRun = Boolean(activeRunId) && run.id === activeRunId;
  el("workflow-run-label").textContent = `Run ${run.id.slice(0, 8)} · ${run.start_date} s/d ${run.end_date} · ${statusLabel(status)}`;

  for (const key of ["click", "api", "neon"]) setNode(key, "done");
  if (activeRunId && !isActiveRun) setNode("active-result", "ready", "Hasil aktif");

  if (status === "creating") {
    if (run.current_step && stage) {
      const stageIndex = version.dataStages.indexOf(stage);
      version.dataStages.slice(0, Math.max(stageIndex, 0)).forEach((key) => setNode(key, "done"));
      setNode(version.draftRunner, "done");
      setNode(stage, "active");
    } else setNode(version.draftRunner, "active");
  } else if (["draft", "approved"].includes(status)) {
    for (const key of version.dataStages) setNode(key, "done");
    setNode("review", status === "approved" ? "done" : "ready");
    setNode("training-click", "ready");
  } else if (status === "rejected") {
    for (const key of version.dataStages) setNode(key, "done");
  } else if (["processing", "published", "failed"].includes(status)) {
    const failedDataStage = status === "failed" && !isTrain;
    if (!failedDataStage) {
      for (const key of version.dataStages) setNode(key, "done");
      setNode("review", "done");
      setNode("training-click", "done");
      setNode(version.trainRunner, status === "failed" ? "failed" : status === "published" || stage ? "done" : "active");
    } else setNode(version.draftRunner, "done");
    if (status === "published") for (const key of version.aiStages) setNode(key, "done");

    for (const item of steps) {
      const mapped = stepStage(item.label);
      if (mapped && STAGE_INFO[mapped]) {
        setNode(mapped, item.status === "failed" ? "failed" : item.status === "running" ? "active" : "done");
      }
    }
    if (stage && STAGE_INFO[stage]) setNode(stage, status === "failed" ? "failed" : "active");
    if (status === "processing" && !stage) setNode("training-setup", "active");
    if (status === "failed") {
      if (!steps.some((item) => item.status === "failed")) setNode(isTrain ? "training-setup" : "analytics", "failed");
      if (isTrain) setNode("fallback", "ready", "Hasil lama dipakai");
    }
  }
  if (isActiveRun && status === "published") setNode("active-result", "done", "Aktif");

  if (!manualNodeSelection) {
    const next =
      document.querySelector(".flow-node.failed") ??
      document.querySelector(".flow-node.active") ??
      document.querySelector(".flow-node.ready");
    selectedStage = next?.dataset.stage ?? "click";
  }
  drawWires();
  updateInspector(run);
}

function statusLabel(status) {
  return (
    {
      creating: "Analisis berjalan",
      draft: "Menunggu training",
      approved: "Siap diproses",
      processing: "Training berjalan",
      published: "Terbit",
      failed: "Gagal",
      rejected: "Ditolak",
    }[status] ?? status
  );
}

function stepClass(status) {
  return status === "running"
    ? "running"
    : status === "failed"
      ? "failed"
      : status === "succeeded"
        ? "succeeded"
        : "";
}

function formatDate(value) {
  if (!value) return "belum ada";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function runSteps(run) {
  const list = Array.isArray(run.steps) ? run.steps : [];
  if (list.length) return list;
  if (run.status === "creating")
    return [
      { label: "Menunggu runner analisis", status: "running" },
    ];
  if (run.status === "draft")
    return [
      { label: "Empat kategori Data Science selesai", status: "succeeded" },
      { label: "Menunggu Admin memulai training", status: "" },
    ];
  if (run.status === "approved")
    return [
      { label: "Laporan disetujui", status: "succeeded" },
      { label: "Menunggu job AI Engineer", status: "" },
    ];
  if (run.status === "published")
    return [
      { label: "Pipeline selesai dan model aktif", status: "succeeded" },
    ];
  return [{ label: "Menunggu pencatatan langkah runner", status: "" }];
}

function matchesFilter(run, filter) {
  if (filter === "active")
    return ["creating", "approved", "processing"].includes(run.status);
  if (filter === "published" || filter === "failed")
    return run.status === filter;
  return true;
}

function renderRuns() {
  const filter = el("run-filter").value;
  const runs = latestRuns.filter((run) => matchesFilter(run, filter));
  const countText = String(runs.length);
  el("run-count").textContent = countText;
  el("toolbar-run-count").textContent = countText;
  el("mobile-run-count").textContent = countText;

  const listEl = el("runs-list");
  if (!runs.length) {
    listEl.innerHTML =
      '<div class="empty-state">Belum ada run pada filter ini. Pilih "Semua status" atau jalankan analisis baru dari dashboard admin.</div>';
    return;
  }

  const openIds = new Set(
    Array.from(listEl.querySelectorAll(".run-card[open]")).map((card) => card.dataset.runId),
  );

  listEl.innerHTML = runs
    .map((run) => {
      const steps = runSteps(run);
      const range = `${run.start_date} s/d ${run.end_date}`;
      const isSelected = selectedRun?.id === run.id;
      const isOpen = openIds.has(run.id);
      const state = [
        "creating",
        "draft",
        "approved",
        "processing",
        "published",
        "failed",
        "rejected",
      ].includes(run.status)
        ? run.status
        : "unknown";
      return `<details class="run-card${isSelected ? " is-selected" : ""}" data-run-id="${escapeHtml(run.id)}"${isOpen ? " open" : ""}><summary class="run-header"><i class="run-state ${state}" aria-hidden="true"></i><div class="run-title"><strong><span class="run-date">${escapeHtml(run.start_date)}</span><span class="run-sep">s/d</span><span class="run-date">${escapeHtml(run.end_date)}</span></strong><span>${escapeHtml(run.id.slice(0, 8))} · ${escapeHtml(formatDate(run.created_at))}</span></div><span class="run-badge ${state}">${escapeHtml(statusLabel(run.status))}</span><svg class="run-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="run-details"><div class="run-progress" aria-label="Tahapan proses">${steps.map((step) => `<span class="step ${stepClass(step.status)}"><i aria-hidden="true"></i><span class="step-label">${escapeHtml(step.label)}</span></span>`).join("")}</div><div class="run-foot"><span>${run.current_step ? `Sedang: ${escapeHtml(run.current_step)}` : run.status === "failed" ? "Runner gagal. Buka log workflow untuk detail." : `Periode snapshot: ${escapeHtml(range)}`}</span><div class="run-foot-actions"><button type="button" class="ctl run-inspect-btn" data-select-run="${escapeHtml(run.id)}"${isSelected ? " disabled" : ""}>${isSelected ? "Aktif di alur" : "Tampilkan di alur"}</button><a href="${GITHUB_WORKFLOW}" target="_blank" rel="noreferrer">Log GitHub Actions</a></div></div></div></details>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

async function checkServices() {
  const setStatus = (svcId, stateId, label, tone) => {
    el(stateId).textContent = label;
    el(svcId).dataset.tone = tone;
  };
  const front = fetch(`${WEB_ORIGIN}/`, {
    method: "HEAD",
    mode: "no-cors",
    cache: "no-store",
  })
    .then(() => setStatus("svc-web", "web-status", "Terjangkau", "ok"))
    .catch(() => setStatus("svc-web", "web-status", "Terputus", "crit"));
  const api = fetch(`${API}/health`, {
    credentials: "include",
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(() => setStatus("svc-api", "api-status", "Aktif", "ok"))
    .catch(() => setStatus("svc-api", "api-status", "Gangguan", "crit"));
  await Promise.all([front, api]);
}

function setLive(label, tone) {
  const live = el("live-label");
  live.textContent = label;
  if (tone) live.dataset.tone = tone;
  else delete live.dataset.tone;
}

function hasActiveRun() {
  return latestRuns.some((run) => ACTIVE_STATUSES.includes(run.status));
}

function nextRefreshDelay() {
  return hasActiveRun() ? REFRESH_ACTIVE_MS : REFRESH_IDLE_MS;
}

function stopPolling() {
  if (!pollTimer) return;
  clearTimeout(pollTimer);
  pollTimer = null;
}

function scheduleRefresh(delay = nextRefreshDelay()) {
  stopPolling();
  if (authBlocked || document.hidden) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void refresh();
  }, delay);
}

function formatRelative(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return `${Math.floor(minutes / 60)} jam lalu`;
}

async function refresh() {
  if (document.hidden) return;
  if (refreshInFlight) {
    scheduleRefresh(REFRESH_ACTIVE_MS);
    return;
  }
  refreshInFlight = true;
  const controller = new AbortController();
  activeAbort = controller;
  const abortTimer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  const slowNotice = setTimeout(() => setLive("Memperbarui…", "warn"), 600);
  try {
    const response = await fetch(`${API}/analysis/graph/status`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403) {
      authBlocked = true;
      stopPolling();
      el("auth-notice").classList.remove("hidden");
      el("error-notice").classList.add("hidden");
      latestRuns = [];
      latestActiveRunId = null;
      manualRunId = null;
      paintFlow(null);
      renderRuns();
      setLive(response.status === 401 ? "Perlu login" : "Akses ditolak", "warn");
    } else if (!response.ok)
      throw new Error(`API mengembalikan HTTP ${response.status}`);
    else {
      const data = await response.json();
      authBlocked = false;
      el("auth-notice").classList.add("hidden");
      el("error-notice").classList.add("hidden");
      latestRuns = data.runs ?? [];
      latestActiveRunId = data.active_run_id ?? null;
      const newestActive = latestRuns.find((run) => ACTIVE_STATUSES.includes(run.status));
      if (
        manualRunId &&
        newestActive &&
        newestActive.id !== manualRunId &&
        newestActive.id === latestRuns[0]?.id
      ) {
        manualRunId = null;
      }
      const selected =
        (manualRunId && latestRuns.find((run) => run.id === manualRunId)) ||
        newestActive ||
        latestRuns[0] ||
        null;
      paintFlow(selected);
      renderRuns();
      setLive(
        data.viewer_role ? `Live · ${data.viewer_role}` : "Live",
        "ok",
      );
      lastUpdatedAt = Date.now();
      el("updated-at").textContent = formatRelative(lastUpdatedAt);
      el("updated-at").title = formatDate(data.server_time);
    }
  } catch (error) {
    authBlocked = false;
    const aborted = error instanceof DOMException && error.name === "AbortError";
    setLive(aborted ? "Memuat ulang…" : "Koneksi terputus", "warn");
    if (!aborted) {
      el("error-notice").textContent =
        error instanceof Error ? error.message : "Gagal menghubungi API";
      el("error-notice").classList.remove("hidden");
    }
    if (!latestRuns.length)
      el("runs-list").innerHTML =
        '<div class="empty-state">Status run belum dapat diambil. Periksa koneksi lalu tekan tombol segarkan.</div>';
  } finally {
    clearTimeout(abortTimer);
    clearTimeout(slowNotice);
    refreshInFlight = false;
    activeAbort = null;
    scheduleRefresh();
  }
}

if (localHost) {
  document.querySelectorAll('a[href^="https://daisuki.my.id"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (href) link.setAttribute("href", href.replace("https://daisuki.my.id", WEB_ORIGIN));
  });
}

initTheme();
el("run-filter").addEventListener("change", renderRuns);
el("runs-list").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-select-run]");
  if (!btn) return;
  const targetRun = latestRuns.find((run) => run.id === btn.dataset.selectRun);
  if (!targetRun) return;
  manualRunId = targetRun.id;
  manualNodeSelection = false;
  paintFlow(targetRun);
  renderRuns();
  if (MOBILE_MQ.matches) {
    setMobileView("flow");
  } else if (isDrawerMode()) {
    setSidebarCollapsed(true);
  }
});

document.querySelectorAll(".version-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchVersion(tab.dataset.version));
});
syncVersionTabs();
renderWorkflow();
updateInspector(null);
syncResponsiveMode();

DESKTOP_MQ.addEventListener("change", syncResponsiveMode);
MOBILE_MQ.addEventListener("change", syncResponsiveMode);
COARSE_POINTER_MQ.addEventListener("change", syncResponsiveMode);

let resizeRaf = 0;
window.addEventListener("resize", () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    if (!manualZoom) fitFlowToViewport();
    drawWires();
  });
});

el("zoom-out").addEventListener("click", () => {
  manualZoom = true;
  flowZoom = Math.max(0.5, Math.round((flowZoom - 0.1) * 10) / 10);
  applyZoom();
});
el("zoom-in").addEventListener("click", () => {
  manualZoom = true;
  flowZoom = Math.min(1.25, Math.round((flowZoom + 0.1) * 10) / 10);
  applyZoom();
});
el("fit-zoom").addEventListener("click", () => {
  manualZoom = false;
  fitFlowToViewport();
  el("flow-viewport").scrollTo({ left: 0, top: 0, behavior: "smooth" });
});
el("fit-flow").addEventListener("click", () => {
  el("flow-viewport").scrollTo({ left: 0, top: 0, behavior: "smooth" });
});
el("toggle-sidebar").addEventListener("click", () => {
  const nextCollapsed = !layout.classList.contains("is-output-hidden");
  setSidebarCollapsed(nextCollapsed, { rememberDesktop: true });
  if (!manualZoom) {
    window.setTimeout(() => fitFlowToViewport(), 180);
  }
});
el("close-drawer").addEventListener("click", () => {
  setSidebarCollapsed(true);
  el("toggle-sidebar").focus();
});
drawerBackdrop.addEventListener("click", () => {
  setSidebarCollapsed(true);
  el("toggle-sidebar").focus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isDrawerMode() && !layout.classList.contains("is-output-hidden")) {
    setSidebarCollapsed(true);
    el("toggle-sidebar").focus();
  }
});
el("tab-flow").addEventListener("click", () => setMobileView("flow"));
el("tab-runs").addEventListener("click", () => setMobileView("runs"));

el("refresh").addEventListener("click", () => {
  activeAbort?.abort();
  void checkServices();
  void refresh();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void checkServices();
    void refresh();
  } else {
    stopPolling();
  }
});
window.addEventListener("focus", () => {
  if (!document.hidden && Date.now() - lastUpdatedAt > 1500) void refresh();
});
void checkServices();
void refresh();
setInterval(() => {
  if (document.hidden || !lastUpdatedAt) return;
  el("updated-at").textContent = formatRelative(lastUpdatedAt);
}, 1000);
setInterval(() => {
  if (!document.hidden) void checkServices();
}, 30000);
