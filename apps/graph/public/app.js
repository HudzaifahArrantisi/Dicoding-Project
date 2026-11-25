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
let flowZoom = 0.85;
let dragState = null;
let suppressNodeClick = false;

const THEME_KEY = "daisuki-graph-theme";
const layout = document.querySelector(".layout");
const themeButton = el("theme");
const themeMeta = document.querySelector('meta[name="theme-color"]');

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
  if (themeMeta) themeMeta.setAttribute("content", isLight ? "#f2f4f7" : "#141a26");
}

function initTheme() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }
  applyTheme(stored);

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

function setSidebarCollapsed(collapsed) {
  layout.classList.toggle("is-output-hidden", collapsed);
  el("toggle-sidebar").setAttribute("aria-expanded", String(!collapsed));
  el("sidebar-toggle-label").textContent = collapsed ? "Buka output" : "Tutup output";
}


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
  const viewport = el("flow-viewport");
  const addNodes = (stages, y, startX = 180, direction = 1) => stages.map((key, index) => {
    const info = STAGE_INFO[key];
    const x = startX + index * 125 * direction;
    return `<button class="flow-node${index === 0 ? " trigger-node" : ""}" type="button" data-stage="${key}" data-x="${x}" data-y="${y}" data-origin-x="${x}" data-origin-y="${y}" style="left:${x}px;top:${y}px" aria-pressed="false" aria-label="${info.title}. ${info.summary}. Seret untuk memindahkan."><span class="node-kicker">${info.kicker}</span><strong>${info.title}</strong><small>${info.summary}</small><span class="node-state">Menunggu</span><span class="node-port input-port" aria-hidden="true"></span><span class="node-port output-port" aria-hidden="true"></span></button>`;
  }).join("");
  const aiTopRow = AI_STAGES.slice(0, 6);
  const aiBottomRow = AI_STAGES.slice(6);
  canvas.innerHTML = `<svg class="flow-wires" id="flow-wires" aria-hidden="true"></svg><div class="lane-label" style="left:24px;top:94px"><span>01</span><strong>Data Science</strong><small>Log &amp; Data</small></div><div class="lane-label" style="left:24px;top:334px"><span>02</span><strong>AI Engineer</strong><small>AI Insights</small></div>${addNodes(DATA_STAGES, 94)}${addNodes(aiTopRow, 334)}${addNodes(aiBottomRow, 534, 180, 1)}<div class="flow-canvas-note" style="left:24px;top:250px">Hasil Data Science jadi sumber training AI</div>`;
  // The second AI row runs right-to-left to keep one continuous, readable path.
  aiBottomRow.forEach((key, index) => {
    const x = 180 + (aiBottomRow.length - 1 - index) * 125;
    const node = canvas.querySelector(`[data-stage="${key}"]`);
    node.dataset.x = String(x);
    node.dataset.originX = String(x);
    node.style.left = `${x}px`;
  });
  canvas.querySelectorAll(".flow-node").forEach((node) => {
    node.addEventListener("click", () => {
      if (suppressNodeClick) { suppressNodeClick = false; return; }
      manualNodeSelection = true;
      selectedStage = node.dataset.stage;
      updateInspector(selectedRun);
    });
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragState = { node, pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: Number(node.dataset.x), top: Number(node.dataset.y), moved: false };
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.node !== node || dragState.pointerId !== event.pointerId) return;
      const dx = (event.clientX - dragState.x) / flowZoom;
      const dy = (event.clientY - dragState.y) / flowZoom;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
      if (!dragState.moved) return;
      const maxX = canvas.clientWidth - node.offsetWidth;
      const maxY = canvas.clientHeight - node.offsetHeight;
      const left = Math.max(0, Math.min(maxX, dragState.left + dx));
      const top = Math.max(0, Math.min(maxY, dragState.top + dy));
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
  let pan = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".flow-node") || event.button !== 0) return;
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
    canvas.querySelectorAll(".flow-node").forEach((node) => {
      node.dataset.x = node.dataset.originX;
      node.dataset.y = node.dataset.originY;
      node.style.left = `${node.dataset.originX}px`;
      node.style.top = `${node.dataset.originY}px`;
    });
    drawWires();
    viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  });
  drawWires();
}

function drawWires() {
  const svg = el("flow-wires");
  if (!svg) return;
  const paths = [];
  const connect = (keys, className = "") => keys.slice(0, -1).forEach((key, index) => {
    const from = document.querySelector(`[data-stage="${key}"]`);
    const to = document.querySelector(`[data-stage="${keys[index + 1]}"]`);
    if (!from || !to) return;
    const fx = Number(from.dataset.x);
    const fy = Number(from.dataset.y);
    const tx = Number(to.dataset.x);
    const ty = Number(to.dataset.y);
    // Baris kedua AI berjalan kanan ke kiri, jadi sisi keluar/masuk port mengikuti arah alur.
    const forward = tx >= fx;
    const x1 = forward ? fx + from.offsetWidth : fx;
    const x2 = forward ? tx : tx + to.offsetWidth;
    const y1 = fy + from.offsetHeight / 2;
    const y2 = ty + to.offsetHeight / 2;
    const bend = Math.max(28, Math.abs(x2 - x1) * 0.45) * (forward ? 1 : -1);
    const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    const state = from.classList.contains("done") && to.classList.contains("done") ? "done" : from.classList.contains("done") && (to.classList.contains("active") || to.classList.contains("ready")) ? "active" : "";
    const arrow = state || "idle";
    paths.push(`<path class="wire ${state} ${className}" d="${d}" marker-end="url(#wire-arrow-${arrow})"/>`);
  });
  connect(DATA_STAGES);
  connect(AI_STAGES);
  const lastData = document.querySelector(`[data-stage="artifacts"]`);
  const firstAi = document.querySelector(`[data-stage="training-click"]`);
  if (lastData && firstAi) {
    const x1 = Number(lastData.dataset.x) + lastData.offsetWidth / 2;
    const y1 = Number(lastData.dataset.y) + lastData.offsetHeight;
    const x2 = Number(firstAi.dataset.x) + firstAi.offsetWidth / 2;
    const y2 = Number(firstAi.dataset.y);
    paths.push(`<path class="wire bridge-wire" d="M ${x1} ${y1} C ${x1} ${y1 + 90}, ${x2} ${y2 - 90}, ${x2} ${y2}" marker-end="url(#wire-arrow-idle)"/>`);
  }
  const marker = (id, color) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`;
  svg.innerHTML =
    `<defs>${marker("wire-arrow-idle", "var(--wire)")}${marker("wire-arrow-done", "var(--wire-done)")}${marker("wire-arrow-active", "var(--wire-active)")}</defs>${paths.join("")}`;
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

  if (!manualNodeSelection) {
    const next = document.querySelector(".flow-node.active, .flow-node.ready, .flow-node.failed");
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
  el("run-count").textContent = String(runs.length);
  el("toolbar-run-count").textContent = String(runs.length);
  if (!runs.length) {
    el("runs-list").innerHTML =
      '<div class="empty-state">Belum ada run pada filter ini.</div>';
    return;
  }
  el("runs-list").innerHTML = runs.slice(0, 10)
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
      return `<details class="run-card"><summary class="run-header"><i class="run-state ${state}" aria-hidden="true"></i><div class="run-title"><strong>${escapeHtml(range)}</strong><span>${escapeHtml(run.id.slice(0, 8))} · ${escapeHtml(formatDate(run.created_at))}</span></div><span class="run-badge ${state}">${escapeHtml(statusLabel(run.status))}</span></summary><div class="run-details"><div class="run-progress" aria-label="Tahapan proses">${steps.map((step) => `<span class="step ${stepClass(step.status)}"><i aria-hidden="true"></i><span class="step-label">${escapeHtml(step.label)}</span></span>`).join("")}</div><div class="run-foot"><span>${run.current_step ? `Sedang: ${escapeHtml(run.current_step)}` : run.status === "failed" ? "Runner gagal. Buka log workflow untuk detail." : `Periode snapshot: ${escapeHtml(range)}`}</span><a href="${GITHUB_WORKFLOW}" target="_blank" rel="noreferrer">Buka GitHub Actions</a></div></div></details>`;
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
  const front = fetch("https://daisuki.my.id/", {
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

async function refresh() {
  if (document.hidden) return;
  setLive("Memperbarui", "warn");
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
      setLive(response.status === 401 ? "Perlu login" : "Akses ditolak", "warn");
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
      setLive(
        data.viewer_role ? `Live · ${data.viewer_role}` : "Live",
        "ok",
      );
      el("updated-at").textContent = formatDate(data.server_time);
    }
  } catch (error) {
    setLive("Koneksi terputus", "warn");
    el("error-notice").textContent =
      error instanceof Error ? error.message : "Gagal menghubungi API";
    el("error-notice").classList.remove("hidden");
    if (!latestRuns.length)
      el("runs-list").innerHTML =
        '<div class="empty-state">Status run belum dapat diambil. Coba segarkan lagi.</div>';
  }
}

initTheme();
el("run-filter").addEventListener("change", renderRuns);
renderWorkflow();
updateInspector(null);
if (window.matchMedia("(max-width: 860px)").matches) setSidebarCollapsed(true);
const applyZoom = () => {
  el("flow-viewport").style.setProperty("--flow-zoom", String(flowZoom));
  el("zoom-label").textContent = `${Math.round(flowZoom * 100)}%`;
};
applyZoom();
el("zoom-out").addEventListener("click", () => {
  flowZoom = Math.max(0.5, Math.round((flowZoom - 0.1) * 10) / 10);
  applyZoom();
});
el("zoom-in").addEventListener("click", () => {
  flowZoom = Math.min(1.2, Math.round((flowZoom + 0.1) * 10) / 10);
  applyZoom();
});
el("fit-flow").addEventListener("click", () => {
  el("flow-viewport").scrollTo({ left: 0, top: 0, behavior: "smooth" });
});
el("toggle-sidebar").addEventListener("click", () => {
  setSidebarCollapsed(!layout.classList.contains("is-output-hidden"));
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
