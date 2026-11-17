const base = (Bun.argv[3] === "tunnel" ? process.env.LLM_TUNNEL_URL : process.env.LLM_BASE_URL)?.replace(/\/+$/, "");
const model = Bun.argv[2] || process.env.LLM_MODEL;
const key = process.env.LLM_API_KEY;
if (!base || !key) throw new Error("LLM config tidak lengkap");

const auth = { Authorization: `Bearer ${key}` };
const started = Date.now();
try {
  const response = await fetch(`${base}/models`, { headers: auth, signal: AbortSignal.timeout(8_000) });
  const body = await response.json() as { data?: Array<{ id?: string }> };
  const ids = (body.data ?? []).map((item) => item.id).filter(Boolean);
  console.log(`models_status=${response.status} count=${ids.length} configured_model=${model} model_listed=${ids.includes(model)}`);
  console.log(`model_examples=${ids.slice(0, 8).join(",")}`);
} catch (error) {
  console.log(`models_error=${error instanceof Error ? error.message : String(error)}`);
}
console.log(`models_elapsed_ms=${Date.now() - started}`);

const chatStarted = Date.now();
try {
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Balas satu kata: siap" }], max_tokens: 32, stream: true }),
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.text();
  console.log(`chat_status=${response.status} bytes=${body.length} has_choices=${body.includes("choices")}`);
  if (!response.ok) console.log(`chat_error_preview=${body.slice(0, 160)}`);
} catch (error) {
  console.log(`chat_error=${error instanceof Error ? error.message : String(error)}`);
}
console.log(`chat_elapsed_ms=${Date.now() - chatStarted}`);
