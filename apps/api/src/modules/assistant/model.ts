import { resolve } from "node:path";
import type { ModelRecord } from "./context";

export interface ModelPrediction {
  product_id: string;
  label: "urgent_restock" | "regular_order" | "normal";
  confidence: number;
}

export interface ModelResult {
  available: boolean;
  predictions: ModelPrediction[];
}

type WorkerReply = ModelResult & { id: string; error?: string };
type Pending = { resolve: (result: ModelResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

const scriptPath = resolve(import.meta.dir, "../../../../../ai/retraining/inference_worker.py");
let currentWorker: { send: (records: ModelRecord[]) => Promise<ModelResult>; stop: () => void } | null = null;

function createWorker() {
  const python = process.env.DAISUKI_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  const processHandle = Bun.spawn([python, scriptPath], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  const pending = new Map<string, Pending>();
  const decoder = new TextDecoder();
  let buffer = "";

  const client = {
    stop() { processHandle.kill(); },
    send(records: ModelRecord[]): Promise<ModelResult> {
      const id = crypto.randomUUID();
      return new Promise((resolveResult, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Prediksi model melewati batas waktu"));
          processHandle.kill();
        }, 30_000);
        pending.set(id, { resolve: resolveResult, reject, timer });
        try {
          processHandle.stdin.write(JSON.stringify({ id, records }) + "\n");
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
              if (result.error) request.reject(new Error(result.error));
              else request.resolve({ available: result.available, predictions: result.predictions });
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
      if (message) console.error("[ASSISTANT MODEL]", message.slice(0, 500));
    }
  })().catch(() => undefined);

  void processHandle.exited.then(() => {
    if (currentWorker === client) currentWorker = null;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Worker model berhenti"));
    }
    pending.clear();
  });

  return client;
}

export async function predictMitraStocks(records: ModelRecord[]): Promise<ModelResult> {
  if (!records.length) return { available: false, predictions: [] };
  try {
    currentWorker ??= createWorker();
    return await currentWorker.send(records);
  } catch (error) {
    console.error("[ASSISTANT] Prediksi stok belum tersedia", error);
    return { available: false, predictions: [] };
  }
}

export function stopMitraModelWorker(): void {
  currentWorker?.stop();
  currentWorker = null;
}
