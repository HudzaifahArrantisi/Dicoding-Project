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
  documents?: Array<{ source: string; version: string; excerpt: string; score: number }>;
  analysis_documents?: Array<{ partner_id: string; source: string; period: string; excerpt: string; score: number }>;
  retrieval_ready?: boolean;
  risk_available?: boolean;
}

type WorkerReply = ModelResult & { id: string; error?: string };
type Pending = { resolve: (result: ModelResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

const retrainingDir = resolve(import.meta.dir, "../../../../../ai/retraining");
const scriptPath = resolve(retrainingDir, "inference_worker.py");
let currentWorker: { send: (records: ModelRecord[], message?: string, partnerId?: string) => Promise<ModelResult>; stop: () => void; isDead: boolean } | null = null;
let lastWorkerFailureTime = 0;
const FAILURE_COOLDOWN_MS = 30_000;
const COLD_WORKER_TIMEOUT_MS = 30_000;
const READY_WORKER_TIMEOUT_MS = 8_000;

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
    send(records: ModelRecord[], message?: string, partnerId?: string): Promise<ModelResult> {
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
          processHandle.stdin.write(JSON.stringify({ id, records, message, partner_id: partnerId }) + "\n");
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
              else request.resolve({ available: result.available, predictions: result.predictions, intent: result.intent, identity: result.identity, documents: result.documents, analysis_documents: result.analysis_documents, retrieval_ready: result.retrieval_ready, risk_available: result.risk_available });
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

function getOrStartWorker() {
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

export function warmMitraModelWorker(): void {
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
  warmMitraModelWorker();
}
