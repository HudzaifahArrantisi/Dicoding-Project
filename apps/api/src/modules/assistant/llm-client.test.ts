import { afterEach, expect, test } from "bun:test";
import { generateLlmReply } from "./llm-client";

const originalFetch = globalThis.fetch;
const original = Object.fromEntries(
  ["LLM_ENABLED", "LLM_API_KEY", "LLM_BASE_URL", "LLM_TUNNEL_URL", "LLM_MODEL", "LLM_TIMEOUT_MS"]
    .map((key) => [key, process.env[key]]),
);

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("9Router mencoba local lalu tunnel dan mengirim pesan terpisah", async () => {
  process.env.LLM_ENABLED = "true";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "http://local-test/v1";
  process.env.LLM_TUNNEL_URL = "https://tunnel-test/v1";
  process.env.LLM_MODEL = "opn";
  const urls: string[] = [];
  globalThis.fetch = (async (input, init) => {
    urls.push(String(input));
    if (urls.length === 1) throw new Error("local offline");
    const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ role: string; content: string }>; stream: boolean };
    expect(body.model).toBe("opn");
    expect(body.stream).toBe(true);
    expect((init?.headers as Record<string, string>).Accept).toContain("text/event-stream");
    expect(body.messages).toEqual([{ role: "system", content: "fakta" }, { role: "user", content: "pesan" }]);
    return new Response('data: {"choices":[{"delta":{"content":"Jawaban "}}]}\n\ndata: {"choices":[{"delta":{"content":"dari tunnel"}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } });
  }) as typeof fetch;
  expect(await generateLlmReply({ systemPrompt: "fakta", userMessage: "pesan" })).toBe("Jawaban dari tunnel");
  expect(urls).toEqual(["http://local-test/v1/chat/completions", "https://tunnel-test/v1/chat/completions"]);
});

test("9Router gagal tanpa melempar error ke pemanggil", async () => {
  process.env.LLM_ENABLED = "true";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "http://local-fail/v1";
  process.env.LLM_TUNNEL_URL = "https://tunnel-fail/v1";
  globalThis.fetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  expect(await generateLlmReply({ systemPrompt: "fakta", userMessage: "pesan" })).toBeNull();
});

test("9Router yang menggantung dibatalkan pada batas waktu", async () => {
  process.env.LLM_ENABLED = "true";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "http://local-timeout/v1";
  process.env.LLM_TUNNEL_URL = "";
  process.env.LLM_TIMEOUT_MS = "20";
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  })) as unknown as typeof fetch;
  expect(await generateLlmReply({ systemPrompt: "fakta", userMessage: "pesan" })).toBeNull();
});

test("timeout model tidak mengulang permintaan pada tunnel yang sama", async () => {
  process.env.LLM_ENABLED = "true";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "http://local-model-timeout/v1";
  process.env.LLM_TUNNEL_URL = "https://same-model-tunnel/v1";
  process.env.LLM_TIMEOUT_MS = "20";
  const urls: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }) as typeof fetch;
  expect(await generateLlmReply({ systemPrompt: "fakta", userMessage: "pesan" })).toBeNull();
  expect(urls).toEqual(["http://local-model-timeout/v1/chat/completions"]);
});
