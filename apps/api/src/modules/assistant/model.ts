import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelRecord } from "./context";
import { activeArtifact, workspaceRoot } from "../../lib/analysis-artifacts";

export interface ModelPrediction {
  product_id: string;
  label: "urgent_restock" | "regular_order" | "normal";
  confidence: number;
}

export interface ModelIdentity {
  name?: string;
  artifact?: string;
  role?: string;
  algorithm?: string;
  specialization?: string;
  supported_products?: string[];
  identity_bio?: string;
}

export interface ModelResult {
  available: boolean;
  predictions: ModelPrediction[];
  intent?: { label: string; confidence: number } | null;
  identity?: ModelIdentity | null;
  documents?: Array<{ source: string; version: string; excerpt: string; score: number; visibility?: string; kind?: string; aliases?: string[] }>;
  raw_documents?: Array<{ source: string; excerpt: string; score: number }>;
  analysis_documents?: Array<{ partner_id: string; source: string; period: string; excerpt: string; score: number }>;
  retrieval_ready?: boolean;
  raw_retrieval_ready?: boolean;
  risk_available?: boolean;
}

type WorkerReply = ModelResult & { id: string; error?: string };
type Pending = { resolve: (result: ModelResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
type Worker = { send: (records: ModelRecord[], message?: string, partnerId?: string, adminAccess?: boolean) => Promise<ModelResult>; stop: () => void; isDead: boolean };

const BRIDGE_URL = (process.env.RAG_BRIDGE_URL ?? "").trim().replace(/\/+$/, "");
const BRIDGE_TOKEN = process.env.RAG_BRIDGE_TOKEN?.trim() ?? "";
const BRIDGE_TIMEOUT_MS = Number(process.env.RAG_BRIDGE_TIMEOUT_MS) || 8_000;
const BRIDGE_HEALTH_TIMEOUT_MS = Number(process.env.RAG_BRIDGE_HEALTH_TIMEOUT_MS) || 20_000;
const hasPythonRuntime = typeof Bun !== "undefined" && typeof Bun.spawn === "function";

let currentWorker: Worker | null = null;
let lastWorkerFailureTime = 0;
let bridgeWarningLogged = false;
const FAILURE_COOLDOWN_MS = 30_000;
const COLD_WORKER_TIMEOUT_MS = 30_000;
const READY_WORKER_TIMEOUT_MS = 8_000;

function bridgeHeaders(): Record<string, string> {
  return BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {};
}

type BridgeHealth = { available?: boolean; retrieval_ready?: boolean; risk_available?: boolean };

/** Cek kesiapan bridge. Batas waktunya longgar karena Space gratis perlu bangun dari tidur. */
async function pingBridgeHealth(): Promise<BridgeHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${BRIDGE_URL}/health`, { headers: bridgeHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as BridgeHealth;
  } catch (error) {
    console.warn("[ASSISTANT] Bridge RAG belum siap:", error instanceof Error ? error.message : "Error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Worker yang memanggil HF Space lewat HTTP. Tidak menyentuh Python, filestem, atau daisuki.pkl. */
function createRemoteWorker(): Worker {
  const client: Worker = {
    isDead: false,
    stop() {
      client.isDead = true;
      if (currentWorker === client) currentWorker = null;
    },
    async send(records: ModelRecord[], message?: string, partnerId?: string, adminAccess = false): Promise<ModelResult> {
      if (client.isDead) throw new Error("Worker model tidak aktif");
      const predicting = records.length > 0;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${BRIDGE_URL}${predicting ? "/predict" : "/understand"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...bridgeHeaders() },
          body: JSON.stringify(
            predicting ? { records } : { message, partner_id: partnerId, admin_access: adminAccess },
          ),
          signal: controller.signal,
        });
      } catch (error) {
        throw new Error(
          error instanceof Error && error.name === "AbortError"
            ? "Bridge RAG melewati batas waktu"
            : "Bridge RAG tidak dapat dihubungi",
        );
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`Bridge RAG menolak permintaan (HTTP ${response.status})`);
      const result = (await response.json()) as Partial<ModelResult>;
      return {
        available: result.available ?? false,
        predictions: result.predictions ?? [],
        intent: result.intent ?? null,
        identity: result.identity ?? null,
        documents: result.documents,
        raw_documents: result.raw_documents,
        analysis_documents: result.analysis_documents,
        retrieval_ready: result.retrieval_ready,
        raw_retrieval_ready: result.raw_retrieval_ready,
        risk_available: result.risk_available,
      };
    },
  };
  return client;
}

function resolvePythonBinary(): string {
  if (process.env.DAISUKI_PYTHON_BIN) return process.env.DAISUKI_PYTHON_BIN;
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  const venvWin = resolve(import.meta.dir, "../../../../../ai/.venv/Scripts/python.exe");
  if (existsSync(venvWin)) return venvWin;
  const venvUnix = resolve(import.meta.dir, "../../../../../ai/.venv/bin/python");
  if (existsSync(venvUnix)) return venvUnix;
  return process.platform === "win32" ? "python" : "python3";
}

function createWorker() {
  const retrainingDir = resolve(import.meta.dir, "../../../../../ai/retraining");
  const scriptPath = resolve(retrainingDir, "inference_worker.py");
  const python = resolvePythonBinary();
  const modelPath = process.env.DAISUKI_MODEL_PATH?.trim()
    ? resolve(workspaceRoot, process.env.DAISUKI_MODEL_PATH.trim())
    : activeArtifact("model");
  console.log(`[ASSISTANT MODEL] Artefak: ${modelPath}`);
  const processHandle = Bun.spawn([python, "-u", scriptPath], {
    cwd: retrainingDir,
    env: { ...process.env, PYTHONUNBUFFERED: "1", DAISUKI_MODEL_PATH: modelPath },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const pending = new Map<string, Pending>();
  const decoder = new TextDecoder();
  let buffer = "";
  let workerReady = false;
  let intentionalStop = false;

  const client = {
    isDead: false,
    stop() {
      client.isDead = true;
      intentionalStop = true;
      if (currentWorker === client) currentWorker = null;
      try { processHandle.kill(); } catch {}
    },
    send(records: ModelRecord[], message?: string, partnerId?: string, adminAccess = false): Promise<ModelResult> {
      if (client.isDead || processHandle.exitCode !== null) {
        if (currentWorker === client) currentWorker = null;
        return Promise.reject(new Error("Worker model tidak aktif"));
      }

      const id = crypto.randomUUID();
      return new Promise((resolveResult, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Prediksi model melewati batas waktu"));
          if (currentWorker === client) currentWorker = null;
          try { processHandle.kill(); } catch {}
        }, workerReady ? READY_WORKER_TIMEOUT_MS : COLD_WORKER_TIMEOUT_MS);
        pending.set(id, { resolve: resolveResult, reject, timer });
        try {
          processHandle.stdin.write(JSON.stringify({ id, records, message, partner_id: partnerId, admin_access: adminAccess }) + "\n");
          processHandle.stdin.flush();
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error instanceof Error ? error : new Error("Worker model tidak dapat menerima data"));
        }
      });
    },
  };

  void (async () => {
    for await (const chunk of processHandle.stdout) {
      buffer += decoder.decode(chunk, { stream: true });
      let end = buffer.indexOf("\n");
      while (end !== -1) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (line) {
          try {
            const result = JSON.parse(line) as WorkerReply;
            const request = pending.get(result.id);
            if (request) {
              pending.delete(result.id);
              clearTimeout(request.timer);
              workerReady = true;
              if (result.error) request.reject(new Error(result.error));
              else request.resolve({ available: result.available, predictions: result.predictions, intent: result.intent, identity: result.identity, documents: result.documents, raw_documents: result.raw_documents, analysis_documents: result.analysis_documents, retrieval_ready: result.retrieval_ready, raw_retrieval_ready: result.raw_retrieval_ready, risk_available: result.risk_available });
            }
          } catch (error) {
            console.error("[ASSISTANT] Respons worker model tidak valid", error);
          }
        }
        end = buffer.indexOf("\n");
      }
    }
  })().catch((error) => console.error("[ASSISTANT] Output worker model terputus", error));

  void (async () => {
    const errorDecoder = new TextDecoder();
    for await (const chunk of processHandle.stderr) {
      const message = errorDecoder.decode(chunk).trim();
      if (message) console.error("[ASSISTANT MODEL STDERR]", message.slice(0, 500));
    }
  })().catch(() => undefined);

  void processHandle.exited.then((code) => {
    client.isDead = true;
    if (code !== 0 && !intentionalStop) {
      lastWorkerFailureTime = Date.now();
      console.warn(`[ASSISTANT] Worker model Python berhenti (exit code: ${code}). Cooldown diaktifkan selama 30 detik.`);
    }
    if (currentWorker === client) currentWorker = null;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(`Worker model berhenti (exit code: ${code})`));
    }
    pending.clear();
  });

  return client;
}

function getOrStartWorker(): Worker | null {
  if (BRIDGE_URL) {
    if (!currentWorker || currentWorker.isDead) currentWorker = createRemoteWorker();
    return currentWorker;
  }
  if (!hasPythonRuntime) {
    if (!bridgeWarningLogged) {
      bridgeWarningLogged = true;
      console.warn("[ASSISTANT] Tanpa Bun.spawn dan tanpa RAG_BRIDGE_URL: fitur model dimatikan. Isi RAG_BRIDGE_URL ke HF Space.");
    }
    return null;
  }
  if (currentWorker && !currentWorker.isDead) return currentWorker;
  if (Date.now() - lastWorkerFailureTime < FAILURE_COOLDOWN_MS) {
    return null; // Sedang masa cooldown, jangan spawn ulang agar tidak stall
  }
  try {
    currentWorker = createWorker();
    return currentWorker;
  } catch (error) {
    lastWorkerFailureTime = Date.now();
    throw error;
  }
}

export async function predictMitraStocks(records: ModelRecord[]): Promise<ModelResult> {
  if (!records.length) return { available: false, predictions: [] };
  try {
    const worker = getOrStartWorker();
    if (!worker) return { available: false, predictions: [] };
    return await worker.send(records);
  } catch (error) {
    console.warn("[ASSISTANT] Prediksi stok belum tersedia:", error instanceof Error ? error.message : "Error");
    return { available: false, predictions: [] };
  }
}

export async function classifyMitraMessage(message: string): Promise<ModelResult["intent"]> {
  return (await understandMitraMessage(message)).intent ?? null;
}

export async function understandMitraMessage(message: string, partnerId?: string): Promise<ModelResult> {
  try {
    const worker = getOrStartWorker();
    if (!worker) return { available: false, predictions: [] };
    return await worker.send([], message, partnerId);
  } catch (error) {
    console.warn("[ASSISTANT] Klasifikasi pesan belum tersedia:", error instanceof Error ? error.message : "Error");
    return { available: false, predictions: [] };
  }
}

export async function understandAdminMessage(message: string): Promise<ModelResult> {
  try {
    const worker = getOrStartWorker();
    if (!worker) return { available: false, predictions: [] };
    return await worker.send([], message, undefined, true);
  } catch (error) {
    console.warn("[ASSISTANT] Pencarian referensi admin belum tersedia:", error instanceof Error ? error.message : "Error");
    return { available: false, predictions: [] };
  }
}

export function warmMitraModelWorker(): void {
  if (BRIDGE_URL) {
    console.log(`[ASSISTANT MODEL] Mode Hugging Face: ${BRIDGE_URL}`);
    void pingBridgeHealth()
      .then((health) => {
        if (!health) return;
        console.log(`[ASSISTANT MODEL] ${health.available ? "Siap" : "Tidak siap"}: intent ${health.available ? "aktif" : "tidak tersedia"}, retrieval biner ${health.retrieval_ready ? "aktif" : "belum dilatih"}`);
      });
    return;
  }
  if (!hasPythonRuntime) {
    console.warn("[ASSISTANT] Bun.spawn tidak tersedia di runtime ini. Isi RAG_BRIDGE_URL agar asisten memakai model dari Hugging Face.");
    return;
  }
  try {
    const worker = getOrStartWorker();
    if (!worker) return;
    console.log("[ASSISTANT MODEL] Memuat daisuki.pkl ke worker Python...");
    void worker.send([], "halo").then((result) => {
      console.log(`[ASSISTANT MODEL] ${result.available ? "Siap" : "Tidak siap"}: intent ${result.intent ? "aktif" : "tidak tersedia"}, retrieval biner ${result.retrieval_ready ? "aktif" : "belum dilatih"}`);
    }).catch((error) => {
      console.warn("[ASSISTANT] Pemanasan model belum berhasil:", error instanceof Error ? error.message : "Error");
    });
  } catch (error) {
    console.warn("[ASSISTANT] Worker model belum dapat dimulai:", error instanceof Error ? error.message : "Error");
  }
}

export function stopMitraModelWorker(): void {
  currentWorker?.stop();
  currentWorker = null;
}

export function reloadMitraModelWorker(): void {
  stopMitraModelWorker();
  lastWorkerFailureTime = 0;
  if (BRIDGE_URL) {
    // Space memuat ulang daisuki.pkl terbaru dari Model repo sebelum melayani lagi.
    void fetch(`${BRIDGE_URL}/reload`, { method: "POST", headers: bridgeHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log("[ASSISTANT MODEL] Bridge RAG memuat ulang model terbaru");
      })
      .catch((error) => console.warn("[ASSISTANT] Reload bridge RAG gagal:", error instanceof Error ? error.message : "Error"));
    return;
  }
  warmMitraModelWorker();
}
