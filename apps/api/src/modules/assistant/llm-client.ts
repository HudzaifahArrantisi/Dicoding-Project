type LlmRequest = { systemPrompt: string; userMessage: string };

function readReply(raw: string): string | null {
  if (raw.trimStart().startsWith("{")) {
    const payload = JSON.parse(raw) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() || null : null;
  }
  let content = "";
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    const chunk = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: unknown } }> };
    const part = chunk.choices?.[0]?.delta?.content;
    if (typeof part === "string") content += part;
  }
  return content.trim() || null;
}

const failedUntil = new Map<string, number>();
const cooldownMs = 5_000;

function configuredEndpoints(): string[] {
  return [process.env.LLM_BASE_URL, process.env.LLM_TUNNEL_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value, index, all) => all.indexOf(value) === index && /^https?:\/\//i.test(value));
}

export async function generateLlmReply({ systemPrompt, userMessage }: LlmRequest): Promise<string | null> {
  if (process.env.LLM_ENABLED !== "true" || !process.env.LLM_API_KEY) return null;
  const timeout = Math.min(120_000, Math.max(1, Number(process.env.LLM_TIMEOUT_MS) || 25_000));
  const deadline = Date.now() + timeout;
  const endpoints = configuredEndpoints();

  for (const [index, endpoint] of endpoints.entries()) {
    if ((failedUntil.get(endpoint) ?? 0) > Date.now()) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const attemptTimeout = index === 0 && endpoints.length > 1 ? Math.min(remaining - 1_000, Math.max(20_000, remaining * 0.8)) : remaining;
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
            max_tokens: 600,
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
        timer = setTimeout(() => { controller.abort(); reject(new Error("LLM timeout")); }, attemptTimeout);
      });
      const content = await Promise.race([request, timeoutPromise]);
      failedUntil.delete(endpoint);
      return content;
    } catch (error) {
      failedUntil.set(endpoint, Date.now() + cooldownMs);
      console.warn(`[ASSISTANT] 9Router ${index === 0 ? "lokal" : "tunnel"} gagal:`, error instanceof Error ? error.message : "Error");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}
