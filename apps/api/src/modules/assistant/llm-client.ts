type LlmRequest = { systemPrompt: string; userMessage: string };

const failedUntil = new Map<string, number>();
const cooldownMs = 30_000;

function configuredEndpoints(): string[] {
  return [process.env.LLM_BASE_URL, process.env.LLM_TUNNEL_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value, index, all) => all.indexOf(value) === index && /^https?:\/\//i.test(value));
}

export async function generateLlmReply({ systemPrompt, userMessage }: LlmRequest): Promise<string | null> {
  if (process.env.LLM_ENABLED !== "true" || !process.env.LLM_API_KEY) return null;
  const timeout = Math.min(8_000, Math.max(1, Number(process.env.LLM_TIMEOUT_MS) || 8_000));
  const deadline = Date.now() + timeout;
  const endpoints = configuredEndpoints();

  for (const [index, endpoint] of endpoints.entries()) {
    if ((failedUntil.get(endpoint) ?? 0) > Date.now()) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const attemptTimeout = index === 0 && endpoints.length > 1 ? Math.min(2_500, remaining) : remaining;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = (async () => {
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL || "opn",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
            temperature: 0.2,
            max_tokens: 600,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
        const payload: unknown = await response.json();
        const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("LLM response kosong");
        return content.trim();
      })();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("LLM timeout")); }, attemptTimeout);
      });
      const content = await Promise.race([request, timeoutPromise]);
      failedUntil.delete(endpoint);
      return content;
    } catch (error) {
      failedUntil.set(endpoint, Date.now() + cooldownMs);
      console.warn("[ASSISTANT] 9Router tidak tersedia pada endpoint yang dikonfigurasi", error instanceof Error ? error.name : "Error");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}
