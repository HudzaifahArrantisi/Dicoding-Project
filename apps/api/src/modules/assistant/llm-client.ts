type LlmRequest = { systemPrompt: string; userMessage: string };
export type LlmCallStatus = "ok" | "timeout" | "error" | "disabled";

let lastLlmStatus: LlmCallStatus = "disabled";

export function getLastLlmStatus(): LlmCallStatus {
  return lastLlmStatus;
}

function readReply(raw: string): string | null {
  if (raw.trimStart().startsWith("{")) {
    const payload = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }>;
    };
    const msg = payload.choices?.[0]?.message;
    const content = typeof msg?.content === "string" && msg.content.trim()
      ? msg.content.trim()
      : typeof msg?.reasoning_content === "string"
        ? msg.reasoning_content.trim()
        : "";
    return content || null;
  }
  let content = "";
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    try {
      const chunk = JSON.parse(line.slice(6)) as {
        choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>;
      };
      const part = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
      if (typeof part === "string") content += part;
    } catch {
      // Abaikan baris komentar SSE atau chunk parsial non-JSON
    }
  }
  return content.trim() || null;
}

function configuredEndpoints(): string[] {
  return [process.env.LLM_BASE_URL, process.env.LLM_TUNNEL_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value, index, all) => all.indexOf(value) === index && /^https?:\/\//i.test(value));
}

export async function generateLlmReply({ systemPrompt, userMessage }: LlmRequest): Promise<string | null> {
  if (process.env.LLM_ENABLED !== "true" || !process.env.LLM_API_KEY) {
    lastLlmStatus = "disabled";
    return null;
  }
  const timeout = Math.min(120_000, Math.max(1, Number(process.env.LLM_TIMEOUT_MS) || 35_000));
  const deadline = Date.now() + timeout;
  const endpoints = configuredEndpoints();
  if (!endpoints.length) {
    lastLlmStatus = "disabled";
    return null;
  }

  for (const [index, endpoint] of endpoints.entries()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      lastLlmStatus = "timeout";
      break;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = (async () => {
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL || "opn",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
            temperature: 0.2,
            max_tokens: 2048,
            stream: true,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
        const content = readReply(await response.text());
        if (!content) throw new Error("LLM response kosong");
        return content;
      })();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("LLM timeout")); }, remaining);
      });
      const content = await Promise.race([request, timeoutPromise]);
      lastLlmStatus = "ok";
      return content;
    } catch (error) {
      console.warn(`[ASSISTANT] 9Router ${index === 0 ? "lokal" : "tunnel"} gagal:`, error instanceof Error ? error.message : "Error");
      if (error instanceof Error && error.message === "LLM timeout") {
        lastLlmStatus = "timeout";
        return null;
      }
      lastLlmStatus = "error";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}
