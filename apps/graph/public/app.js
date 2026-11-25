const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = localHost
  ? `http://${window.location.hostname}:3001/v1`
  : "https://api.daisuki.my.id/v1";
const GITHUB_WORKFLOW =
  "https://github.com/HudzaifahArrantisi/Dicoding-Project/actions/workflows/analysis-pipeline.yml";
const REFRESH_MS = 5000;
const el = (id) => document.getElementById(id);
let latestRuns = [];
let selectedRun = null;
let timer;
let selectedStage = "click";
let manualNodeSelection = false;
let flowZoom = 1;

const STAGE_INFO = {
  click: { lane: "Data Science", kicker: "PEMICU · ADMIN", title: "Perbarui analisis", summary: "Snapshot Senin sampai waktu klik", detail: "Admin meminta laporan baru. Sistem membatasi snapshot dari awal minggu berjalan sampai waktu permintaan." },
  api: { lane: "Data Science", kicker: "CLOUDFLARE WORKER", title: "Terima request API", summary: "POST /analysis/runs", detail: "API memvalidasi sesi, role, serta periode sebelum membuat run analisis." },
  neon: { lane: "Data Science", kicker: "NEON POSTGRES", title: "Simpan run", summary: "ID, periode, status", detail: "Run disimpan dengan ID, tanggal awal dan akhir, status, serta pemilik permintaan." },
  "actions-draft": { lane: "Data Science", kicker: "GITHUB ACTIONS", title: "Jalankan stage draft", summary: "Runner mengambil run terpilih", detail: "Workflow mengambil run berdasarkan ID dan menjalankan agregasi Data Science untuk periode tersebut." },
  analytics: { lane: "Data Science", kicker: "PYTHON · DATA SCIENCE", title: "Agregasi mingguan", summary: "Empat kategori analisis", detail: "Python merangkum konsumsi produk, konsumsi mitra, aktivitas wilayah, dan pelaporan stok." },
  artifacts: { lane: "Data Science", kicker: "NEON POSTGRES", title: "Simpan hasil analisis", summary: "Ringkasan, tabel, kategori", detail: "Laporan empat kategori dan file pendukung disimpan sebagai artefak milik run." },
  "training-click": { lane: "AI Engineer", kicker: "PEMICU · ADMIN", title: "Mulai training model", summary: "Gunakan run Data Science terpilih", detail: "Admin memilih sumber training pada AI Insights. Hasil aktif lama tetap dipakai sampai proses baru berhasil diterbitkan." },
  "training-setup": { lane: "AI Engineer", kicker: "PYTHON · PERSIAPAN", title: "Siapkan data dan model", summary: "Artefak run + model sebelumnya", detail: "Runner memuat hasil Data Science dan model aktif sebelumnya sebagai bahan proses training." },
  risk: { lane: "AI Engineer", kicker: "JOB 1 · NAIVE BAYES", title: "Analisis risiko stok", summary: "Prediksi risiko kekurangan stok", detail: "Job menghitung risiko stockout per pasangan mitra dan produk." },
  evaluation: { lane: "AI Engineer", kicker: "JOB 2 · EVALUASI", title: "Evaluasi historis", summary: "Ukur performa prediksi", detail: "Job mengevaluasi prediksi terhadap kejadian historis yang tersedia." },
  allocation: { lane: "AI Engineer", kicker: "JOB 3 · ALOKASI", title: "Pratinjau alokasi", summary: "Prioritas pasokan", detail: "Job menyusun rekomendasi alokasi berdasarkan kebutuhan dan stok." },
  "facts-rag": { lane: "AI Engineer", kicker: "JOB 4 · FAKTA & RAG", title: "Bangun fakta dashboard", summary: "Fakta untuk AI Insights dan RAG", detail: "Job menyiapkan fakta mingguan yang dipakai dashboard dan konteks retrieval chatbot." },
  "model-training": { lane: "AI Engineer", kicker: "JOB 5 · TRAINING", title: "Latih daisuki.pkl", summary: "Model dari sumber run terpilih", detail: "Job memperbarui model menggunakan laporan Data Science atau referensi mentah yang dipilih." },
  chart: { lane: "AI Engineer", kicker: "JOB 6 · GRAFIK", title: "Susun grafik model", summary: "Ringkasan prediksi konsumsi", detail: "Job menyiapkan data grafik evaluasi dan ringkasan model untuk ditampilkan." },
  validation: { lane: "AI Engineer", kicker: "JOB 7 · VALIDASI", title: "Validasi keluaran", summary: "Periksa hasil pipeline", detail: "Job memastikan keluaran model dan artefak siap disimpan." },
  persist: { lane: "AI Engineer", kicker: "NEON POSTGRES", title: "Simpan artefak AI", summary: "Model dan hasil run", detail: "Artefak model, evaluasi, fakta, dan hasil AI disimpan ke database untuk run ini." },
  export: { lane: "AI Engineer", kicker: "EKSPOR MODEL", title: "Ekspor PKL ke JSON", summary: "Format inferensi Cloudflare Worker", detail: "Classifier diekspor dari daisuki.pkl ke format JSON yang dapat dibaca API Worker." },
  kv: { lane: "AI Engineer", kicker: "CLOUDFLARE KV", title: "Publikasikan model", summary: "Binding DAISUKI_MODEL", detail: "File JSON model dipublikasikan ke Workers KV untuk dibaca API Worker." },
  published: { lane: "AI Engineer", kicker: "HASIL AKTIF", title: "Terbitkan AI Insights", summary: "Run terbaru menjadi hasil aktif", detail: "Run ditandai terbit. AI Insights dan ringkasan menggunakan hasil terbaru." },
};
const DATA_STAGES = ["click", "api", "neon", "actions-draft", "analytics", "artifacts"];
const AI_STAGES = ["training-click", "training-setup", "risk", "evaluation", "allocation", "facts-rag", "model-training", "chart", "validation", "persist", "export", "kv", "published"];

function renderWorkflow() {
  const canvas = el("flow-canvas");
  const renderLane = (number, title, subtitle, stages, extraClass = "") => {
    const nodes = stages.map((key, index) => {
      const info = STAGE_INFO[key];
      const ports = `${index ? '<span class="node-port input-port" aria-hidden="true"></span>' : ""}${index < stages.length - 1 ? '<span class="node-port output-port" aria-hidden="true"></span>' : ""}`;
      const node = `<button class="flow-node${index === 0 ? " trigger-node" : ""}" type="button" data-stage="${key}" aria-pressed="false"><span class="node-kicker">${info.kicker}</span><strong>${info.title}</strong><small>${info.summary}</small><span class="node-state">Menunggu</span>${ports}</button>`;
      return index < stages.length - 1 ? `${node}<span class="connector" aria-hidden="true"></span>` : node;
    }).join("");
    return `<section class="flow-lane ${extraClass}" aria-label="${title} workflow"><div class="lane-label"><span>${number}</span><strong>${title}</strong><small>${subtitle}</small></div><div class="lane-nodes">${nodes}</div></section>`;
  };
  canvas.innerHTML = `${renderLane("01", "Data Science", "Log & Data", DATA_STAGES)}<div class="flow-bridge"><span class="bridge-route" aria-hidden="true"></span><strong>Run analisis yang sama diteruskan sebagai sumber AI Engineer</strong></div>${renderLane("02", "AI Engineer", "AI Insights", AI_STAGES, "ai-lane")}`;
  canvas.querySelectorAll(".flow-node").forEach((node) => {
    node.addEventListener("click", () => {
      manualNodeSelection = true;
      selectedStage = node.dataset.stage;
      updateInspector(selectedRun);
    });
  });
}

const stepStage = (label = "") => {
  const name = String(label ?? "").toLowerCase();
  if (name.includes("agregasi")) return "analytics";
  if (name.includes("simpan laporan") || name.includes("artefak analisis")) return "artifacts";
  if (name.includes("persiapan")) return "training-setup";
  if (name.includes("risiko naive bayes")) return "risk";
  if (name.includes("evaluasi historis")) return "evaluation";
  if (name.includes("pratinjau alokasi")) return "allocation";
  if (name.includes("fakta dashboard")) return "facts-rag";
  if (name.includes("training daisuki")) return "model-training";
  if (name.includes("grafik konsumsi")) return "chart";
  if (name.includes("validasi hasil")) return "validation";
  if (name.includes("simpan artefak model")) return "persist";
  if (name.includes("ekspor")) return "export";
  if (name.includes("publikasi model")) return "kv";
  if (name.includes("terbitkan hasil")) return "published";
  if (name) return "training-setup";
  return null;
};

function setNode(name, state) {
  const node = document.querySelector(`[data-stage="${name}"]`);
  if (!node) return;
  node.classList.remove("done", "active", "failed", "ready");
  if (state) node.classList.add(state);
  const labels = { done: "Selesai", active: "Berjalan", ready: "Siap", failed: "Gagal" };
  node.querySelector(".node-state").textContent = labels[state] ?? "Menunggu";
}

function updateInspector(run) {
  const info = STAGE_INFO[selectedStage];
  if (!info) return;
  const node = document.querySelector(`[data-stage="${selectedStage}"]`);
  const state = ["done", "active", "ready", "failed"].find((name) => node?.classList.contains(name));
  const stateLabels = { done: "Selesai", active: "Sedang berjalan", ready: "Siap dimulai", failed: "Gagal", idle: "Menunggu" };
  el("inspector-kicker").textContent = info.kicker;
  el("inspector-title").textContent = info.title;
  el("inspector-description").textContent = info.detail;
  el("inspector-status").textContent = stateLabels[state ?? "idle"];
  el("inspector-indicator").className = `inspector-indicator ${state ?? "idle"}`;
  el("inspector-run").textContent = run ? `${run.start_date}–${run.end_date} · ${run.id.slice(0, 8)}` : "Belum ada run";
  document.querySelectorAll(".flow-node").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.stage === selectedStage)));
}

function paintFlow(run) {
  selectedRun = run;
  document.querySelectorAll(".flow-node").forEach((node) => {
    node.classList.remove("done", "active", "failed", "ready");
    node.querySelector(".node-state").textContent = "Menunggu";
  });
  document.querySelectorAll(".connector").forEach((line) => line.classList.remove("done", "active"));
  if (!run) {
    el("workflow-run-label").textContent = "Belum ada run analisis";
    updateInspector(null);
    return;
  }

  const status = run.status;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const stage = stepStage(run.current_step);
  const isTrain = ["processing", "published"].includes(status) || steps.some((item) => AI_STAGES.includes(stepStage(item.label)));
  el("workflow-run-label").textContent = `Run ${run.id.slice(0, 8)} · ${run.start_date}–${run.end_date} · ${statusLabel(status)}`;

  for (const key of ["click", "api", "neon"]) setNode(key, "done");
  if (status === "creating") {
    if (run.current_step && stage) {
      const stageIndex = DATA_STAGES.indexOf(stage);
      DATA_STAGES.slice(0, Math.max(stageIndex, 0)).forEach((key) => setNode(key, "done"));
      setNode("actions-draft", "done");
      setNode(stage, "active");
    } else setNode("actions-draft", "active");
  } else if (["draft", "approved"].includes(status)) {
    for (const key of DATA_STAGES) setNode(key, "done");
    setNode("training-click", "ready");
  } else if (status === "rejected") {
    for (const key of DATA_STAGES) setNode(key, "done");
  } else if (["processing", "published", "failed"].includes(status)) {
    const failedDataStage = status === "failed" && !isTrain;
    if (!failedDataStage) {
      for (const key of DATA_STAGES) setNode(key, "done");
      setNode("training-click", "done");
    } else setNode("actions-draft", "done");
    if (status === "published") for (const key of AI_STAGES) setNode(key, "done");

    for (const item of steps) {
      const mapped = stepStage(item.label);
      if (mapped && STAGE_INFO[mapped]) {
        setNode(mapped, item.status === "failed" ? "failed" : item.status === "running" ? "active" : "done");
      }
    }
    if (stage && STAGE_INFO[stage]) setNode(stage, status === "failed" ? "failed" : "active");
    if (status === "processing" && !stage) setNode("training-setup", "active");
    if (status === "failed" && !steps.some((item) => item.status === "failed")) setNode(isTrain ? "training-setup" : "analytics", "failed");
  }

  for (const path of [DATA_STAGES, AI_STAGES]) {
    path.slice(0, -1).forEach((key, index) => {
      const node = document.querySelector(`[data-stage="${key}"]`);
      const line = node?.nextElementSibling;
      const next = document.querySelector(`[data-stage="${path[index + 1]}"]`);
      if (!line?.classList.contains("connector") || !next) return;
      if (node.classList.contains("done") && next.classList.contains("done")) line.classList.add("done");
      else if (node.classList.contains("done") && (next.classList.contains("active") || next.classList.contains("ready"))) line.classList.add("active");
    });
  }

  if (!manualNodeSelection) {
    const next = document.querySelector(".flow-node.active, .flow-node.ready, .flow-node.failed");
    selectedStage = next?.dataset.stage ?? "click";
  }
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
  if (!value) return "—";
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
      { label: "Menunggu runner analisis GitHub Actions", status: "running" },
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
      { label: "Pipeline selesai dan model aktif di KV", status: "succeeded" },
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
  if (!runs.length) {
    el("runs-list").innerHTML =
      '<div class="empty-state">Belum ada run pada filter ini.</div>';
    return;
  }
  el("runs-list").innerHTML = runs
    .map((run) => {
      const steps = runSteps(run);
      const range = `${run.start_date} → ${run.end_date}`;
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
      return `<article class="run-card"><header class="run-header"><i class="run-state ${state}" aria-hidden="true"></i><div class="run-title"><strong>${escapeHtml(range)}</strong><span>${escapeHtml(run.id)}</span></div><span class="run-badge ${state}">${escapeHtml(statusLabel(run.status))}</span><span class="run-meta">${escapeHtml(formatDate(run.created_at))}</span></header><div class="run-details"><div class="run-progress" aria-label="Tahapan proses">${steps.map((step) => `<span class="step ${stepClass(step.status)}"><i aria-hidden="true"></i><span class="step-label">${escapeHtml(step.label)}</span></span>`).join("")}</div><div class="run-foot"><span>${run.current_step ? `Sedang: ${escapeHtml(run.current_step)}` : run.status === "failed" ? "Runner mencatat kegagalan. Lihat log workflow untuk detail." : `Periode snapshot: ${escapeHtml(range)}`}</span><a href="${GITHUB_WORKFLOW}" target="_blank" rel="noreferrer">Buka GitHub Actions ↗</a></div></div></article>`;
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
  const setStatus = (id, label, state) => {
    el(id).textContent = label;
    el(id).className = `service-status ${state}`;
  };
  const front = fetch("https://daisuki.my.id/", {
    method: "HEAD",
    mode: "no-cors",
    cache: "no-store",
  })
    .then(() => setStatus("web-status", "Terjangkau", "online"))
    .catch(() => setStatus("web-status", "Tidak terjangkau", "offline"));
  const api = fetch(`${API}/health`, {
    credentials: "include",
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(() => setStatus("api-status", "Aktif", "online"))
    .catch(() => setStatus("api-status", "Gangguan", "offline"));
  await Promise.all([front, api]);
}

async function refresh() {
  if (document.hidden) return;
  el("live-label").textContent = "Memperbarui…";
  try {
    const response = await fetch(`${API}/analysis/graph/status`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      el("auth-notice").classList.remove("hidden");
      el("error-notice").classList.add("hidden");
      latestRuns = [];
      paintFlow(null);
      renderRuns();
      el("live-label").textContent =
        response.status === 401 ? "Perlu login" : "Akses ditolak";
    } else if (!response.ok)
      throw new Error(`API mengembalikan HTTP ${response.status}`);
    else {
      const data = await response.json();
      el("auth-notice").classList.add("hidden");
      el("error-notice").classList.add("hidden");
      latestRuns = data.runs ?? [];
      const selected =
        latestRuns.find((run) =>
          ["creating", "processing", "approved"].includes(run.status),
        ) ?? latestRuns[0];
      paintFlow(selected);
      renderRuns();
      el("live-label").textContent = data.viewer_role
        ? `Live · ${data.viewer_role}`
        : "Live";
      el("updated-at").textContent = formatDate(data.server_time);
    }
  } catch (error) {
    el("live-label").textContent = "Koneksi terputus";
    el("error-notice").textContent =
      error instanceof Error ? error.message : "Gagal menghubungi API";
    el("error-notice").classList.remove("hidden");
    if (!latestRuns.length)
      el("runs-list").innerHTML =
        '<div class="empty-state">Status run belum dapat diambil. Coba segarkan lagi.</div>';
  }
}

el("run-filter").addEventListener("change", renderRuns);
renderWorkflow();
updateInspector(null);
const applyZoom = () => {
  el("flow-canvas").style.setProperty("--flow-zoom", String(flowZoom));
  el("zoom-label").textContent = `${Math.round(flowZoom * 100)}%`;
};
el("zoom-out").addEventListener("click", () => {
  flowZoom = Math.max(0.7, Math.round((flowZoom - 0.1) * 10) / 10);
  applyZoom();
});
el("zoom-in").addEventListener("click", () => {
  flowZoom = Math.min(1.2, Math.round((flowZoom + 0.1) * 10) / 10);
  applyZoom();
});
el("fit-flow").addEventListener("click", () => {
  el("flow-viewport").scrollTo({ left: 0, top: 0, behavior: "smooth" });
});
el("refresh").addEventListener("click", () => {
  void checkServices();
  void refresh();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void checkServices();
    void refresh();
  }
});
void checkServices();
void refresh();
timer = setInterval(() => {
  void refresh();
}, REFRESH_MS);
setInterval(() => {
  if (!document.hidden) void checkServices();
}, 30000);
