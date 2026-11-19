/**
 * Menyiapkan berkas untuk diunggah ke Hugging Face.
 *
 * ai/ tetap menjadi satu-satunya sumber kebenaran. Skrip ini hanya menyalin
 * berkas ke folder staging, sehingga tidak ada salinan Python yang bisa
 * menyimpang dari aslinya.
 *
 *   bun deploy/prepare.mjs space   siapkan HF Space (inferensi)
 *   bun deploy/prepare.mjs train   siapkan konteks HF Jobs (training)
 *   bun deploy/prepare.mjs all     keduanya
 */

import { cp, mkdir, rm, stat, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const stage = resolve(import.meta.dir, ".staging");

/**
 * Membaca DAISUKI_MODEL_PATH dari environment atau apps/api/.env.
 * `bun deploy/prepare.mjs` dijalankan dari root, sedangkan berkas env aplikasi
 * ada di apps/api/.env, jadi keduanya diperiksa.
 */
function configuredModelPath() {
  if (process.env.DAISUKI_MODEL_PATH?.trim()) return process.env.DAISUKI_MODEL_PATH.trim();
  const apiEnv = join(root, "apps/api/.env");
  if (!existsSync(apiEnv)) return "";
  const line = readFileSync(apiEnv, "utf8")
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith("DAISUKI_MODEL_PATH="));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

/**
 * Urutan pemilihan model HARUS sama dengan `activeArtifact("model")` di
 * apps/api/src/lib/analysis-artifacts.ts: env, lalu run aktif, lalu fallback.
 * Bila urutannya berbeda, Space bisa melayani model yang lebih tua daripada
 * kontainer API.
 */
function resolveModelPath() {
  const configured = configuredModelPath();
  if (configured) {
    const path = isAbsolute(configured) ? configured : resolve(root, configured);
    if (existsSync(path)) return path;
    console.warn(`  DAISUKI_MODEL_PATH menunjuk berkas yang tidak ada: ${path}`);
  }

  const activeRunFile = join(root, "ai/data/private/active_run.json");
  if (existsSync(activeRunFile)) {
    try {
      const { run_id: runId } = JSON.parse(readFileSync(activeRunFile, "utf8"));
      if (/^[0-9a-f-]{36}$/i.test(runId ?? "")) {
        const runModel = join(root, "ai/data/private/runs", runId, "daisuki.pkl");
        if (existsSync(runModel)) return runModel;
        console.warn(`  Run aktif ${runId} belum punya daisuki.pkl, memakai fallback.`);
      }
    } catch {
      console.warn("  active_run.json tidak terbaca, memakai fallback.");
    }
  }

  const legacy = join(root, "ai/data/mainbrain/models/daisuki.pkl");
  return existsSync(legacy) ? legacy : "";
}

const SPACE_FILES = ["filter.py", "source.py", "knowledge_index.py", "analysis_index.py", "doc_loader.py", "inference_worker.py"];

const TRAIN_JOBS = [
  "run_context.py",
  "regional_stockout_naive_bayes.py",
  "evaluate_stockout.py",
  "smart_allocation.py",
  "weekly_facts_aggregator.py",
  "validate_stage.py",
];

const TRAIN_RETRAINING = [
  "train.py",
  "chart_data.py",
  "filter.py",
  "source.py",
  "knowledge_index.py",
  "analysis_index.py",
  "doc_loader.py",
  "csv_handoff.py",
  "inference_worker.py",
];

async function copyFile(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to);
}

async function copyEach(base, names, target) {
  const copied = [];
  const missing = [];
  for (const name of names) {
    const source = join(base, name);
    if (!existsSync(source)) {
      missing.push(name);
      continue;
    }
    await copyFile(source, join(target, name));
    copied.push(name);
  }
  return { copied, missing };
}

async function prepareSpace() {
  const target = join(stage, "space");
  await rm(target, { recursive: true, force: true });

  // Berkas yang ditulis tangan untuk Space.
  for (const name of ["app.py", "Dockerfile", "requirements.txt", "README.md"]) {
    await copyFile(join(import.meta.dir, "hf-space", name), join(target, name));
  }

  // Modul Python dari ai/retraining, disalin apa adanya.
  const modules = await copyEach(join(root, "ai/retraining"), SPACE_FILES, join(target, "retraining"));

  // Model. Urutannya HARUS sama dengan apps/api/src/lib/analysis-artifacts.ts,
  // kalau tidak Space dan kontainer bisa melayani model yang berbeda.
  const modelSource = resolveModelPath();
  if (!modelSource) {
    throw new Error(
      "daisuki.pkl tidak ditemukan. Diperiksa: DAISUKI_MODEL_PATH, ai/data/private/runs/<run aktif>/, " +
        "ai/data/mainbrain/models/. Latih model dulu atau letakkan di salah satu lokasi itu.",
    );
  }
  await copyFile(modelSource, join(target, "data/mainbrain/models/daisuki.pkl"));
  const size = (await stat(modelSource)).size;

  return { target, modules, modelSource, size, inventory: await inspectModel(modelSource) };
}

/**
 * Membaca jumlah dokumen per indeks di dalam model.
 *
 * Model memuat indeks privat yang tidak boleh keluar dari Space private:
 * analisis per mitra dan cuplikan PDF mentah. Jumlah ini dicetak setiap kali
 * rakit supaya model yang bocor selalu disadari, bukan ditemukan belakangan.
 */
async function inspectModel(modelPath) {
  const script = [
    "import json,pickle,sys",
    "with open(sys.argv[1],'rb') as f: bundle = pickle.load(f)",
    "def size(value):",
    "    if isinstance(value, dict) and 'documents' in value: return len(value['documents'])",
    "    return type(value).__name__",
    "print(json.dumps({k: size(v) for k, v in bundle.items()}))",
  ].join("\n");

  const child = Bun.spawn(["python", "-c", script, modelPath], { stdout: "pipe", stderr: "pipe" });
  const [code, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  if (code !== 0) return null;
  try {
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

async function prepareTrain() {
  const target = join(stage, "train");
  await rm(target, { recursive: true, force: true });

  for (const name of ["Dockerfile", "requirements.txt", "run-pipeline.sh"]) {
    await copyFile(join(import.meta.dir, "hf-train", name), join(target, name));
  }

  const jobs = await copyEach(join(root, "ai/jobs"), TRAIN_JOBS, join(target, "ai/jobs"));
  const retraining = await copyEach(join(root, "ai/retraining"), TRAIN_RETRAINING, join(target, "ai/retraining"));

  await copyFile(
    join(root, "data-science/src/weekly_analytics_aggregator.py"),
    join(target, "data-science/src/weekly_analytics_aggregator.py"),
  );

  // Data yang dibaca modul Python saat training.
  await cp(join(root, "ai/data/mainbrain/corporate_knowledge"), join(target, "ai/data/mainbrain/corporate_knowledge"), {
    recursive: true,
    filter: (src) => !src.endsWith("README.md"),
  });
  await mkdir(join(target, "ai/data/mainbrain/context_embeddings"), { recursive: true });
  for (const name of await readdir(join(root, "ai/data/mainbrain/context_embeddings"))) {
    if (name.endsWith(".public.md")) {
      await copyFile(
        join(root, "ai/data/mainbrain/context_embeddings", name),
        join(target, "ai/data/mainbrain/context_embeddings", name),
      );
    }
  }
  await cp(join(root, "ai/data/mega_data_word/intent"), join(target, "ai/data/mega_data_word/intent"), { recursive: true });
  await copyFile(
    join(root, "ai/data/mega_data_word/dictionary/stopwords_id.txt"),
    join(target, "ai/data/mega_data_word/dictionary/stopwords_id.txt"),
  );

  // Delapan PDF wajib: build_raw_pdf_index() gagal bila folder ini kosong dan
  // seluruh training ikut gagal.
  const pdfSource = join(root, "ai/data/raw_references/pdf");
  await mkdir(join(target, "ai/data/raw_references/pdf"), { recursive: true });
  let pdfCount = 0;
  for (const name of await readdir(pdfSource)) {
    if (name.toLowerCase().endsWith(".pdf")) {
      await copyFile(join(pdfSource, name), join(target, "ai/data/raw_references/pdf", name));
      pdfCount += 1;
    }
  }

  // Direktori runtime yang harus ada dan bisa ditulis.
  for (const dir of ["ai/data/private/runs", "ai/data/raw_references/csv", "data-science/reports/runs"]) {
    await mkdir(join(target, dir), { recursive: true });
  }

  return { target, jobs, retraining, pdfCount };
}

function report(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`Folder staging: ${result.target}`);
  if (result.modules) {
    console.log(`Modul Python   : ${result.modules.copied.length} disalin`);
    if (result.modules.missing.length) console.warn(`  Hilang: ${result.modules.missing.join(", ")}`);
    console.log(`Model sumber   : ${result.modelSource} (${(result.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  if (result.inventory) {
    const inv = result.inventory;
    console.log(`Indeks publik  : retrieval ${inv.retrieval ?? 0} dokumen`);
    const privateIndexes = [
      ["analysis_retrieval", inv.analysis_retrieval ?? 0],
      ["raw_pdf_retrieval", inv.raw_pdf_retrieval ?? 0],
    ].filter(([, count]) => count > 0);
    if (privateIndexes.length) {
      console.log("Indeks privat  : " + privateIndexes.map(([name, count]) => `${name} ${count} dokumen`).join(", "));
      console.log("  -> Space dan repo model WAJIB private, dan BRIDGE_TOKEN WAJIB diisi.");
    }
  } else {
    console.warn("  Pemeriksaan indeks dilewati (python tidak tersedia atau pickle gagal dibaca).");
  }
  if (result.jobs) {
    console.log(`Job Python     : ${result.jobs.copied.length} disalin`);
    if (result.jobs.missing.length) console.warn(`  Hilang: ${result.jobs.missing.join(", ")}`);
    console.log(`Modul training : ${result.retraining.copied.length} disalin`);
    console.log(`PDF referensi  : ${result.pdfCount} berkas`);
    if (result.pdfCount === 0) {
      console.warn("  PERINGATAN: tanpa PDF, build_raw_pdf_index() akan gagal dan seluruh training gagal.");
    }
  }
}

const target = process.argv[2] ?? "all";
try {
  if (target === "space" || target === "all") report("HF Space (inferensi)", await prepareSpace());
  if (target === "train" || target === "all") report("HF Jobs (training)", await prepareTrain());
  console.log("\nSelesai. Lanjutkan dengan perintah 'hf upload' pada panduan.");
} catch (error) {
  console.error(`\nGagal menyiapkan berkas: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
