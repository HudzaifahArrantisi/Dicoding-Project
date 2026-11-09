import { Elysia, t } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { assistantChatEvents } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { answerMitraQuestion, type MitraTour } from "./knowledge";
import { composeMitraReply, resolveMitraIntent, type AssistantIntent } from "./compose";
import { loadMitraContext } from "./context";
import { classifyMitraMessage, predictMitraStocks, type ModelResult } from "./model";
import { generateLlmReply } from "./llm-client";
import { buildMitraRagPrompt, isGroundedLlmReply } from "./rag-prompt";

const emptyModel: ModelResult = { available: false, predictions: [] };

function isMitra(user: Awaited<ReturnType<typeof getAuthUser>>): user is NonNullable<typeof user> & { role: "mitra"; partnerId: string } {
  return Boolean(user?.role === "mitra" && user.partnerId);
}

export const assistantModule = new Elysia({ prefix: "/assistant" }).get(
  "/mitra/history",
  async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    const rows = await db.select({
      id: assistantChatEvents.id,
      message: assistantChatEvents.message,
      reply: assistantChatEvents.reply,
      intent: assistantChatEvents.intent,
      model_results: assistantChatEvents.model_results,
      feedback: assistantChatEvents.feedback,
      created_at: assistantChatEvents.created_at,
    }).from(assistantChatEvents)
      .where(and(eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)))
      .orderBy(desc(assistantChatEvents.created_at)).limit(30);
    const tours = new Set<MitraTour>(["restock", "stock_report", "delivery", "logs", "profile"]);
    return { data: rows.reverse().map((row) => ({
      id: row.id,
      message: row.message,
      reply: row.reply,
      intent: tours.has(row.intent as MitraTour) ? row.intent : null,
      source: (row.model_results as { response_source?: string } | null)?.response_source === "llm" ? "llm" : "fallback",
      feedback: row.feedback,
      created_at: row.created_at,
    })) };
  },
).post(
  "/mitra/chat",
  async ({ body, headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    if (!body.message.trim()) {
      set.status = 422;
      return { error: "Pesan tidak boleh kosong" };
    }
    const message = body.message.trim();
    const [previous] = await db.select({ intent: assistantChatEvents.intent }).from(assistantChatEvents)
      .where(and(eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)))
      .orderBy(desc(assistantChatEvents.created_at)).limit(1);
    const previousIntent = previous?.intent as AssistantIntent | null ?? null;
    const classified = await classifyMitraMessage(message);
    const intent = resolveMitraIntent(message, previousIntent, classified);
    const context = intent ? await loadMitraContext(user.partnerId) : null;
    const model = context && (intent === "restock" || intent === "stock_report")
      ? await predictMitraStocks(context.stocks)
      : emptyModel;
    const fallback = context
      ? composeMitraReply(message, context, model, previousIntent, classified)
      : answerMitraQuestion(message);
    let llmReply: string | null = null;
    let grounded = false;
    if (context && intent) {
      try {
        llmReply = await generateLlmReply({ systemPrompt: buildMitraRagPrompt(context, model, previousIntent), userMessage: message });
        grounded = Boolean(llmReply && isGroundedLlmReply(llmReply, context, model));
      } catch (error) {
        console.warn("[ASSISTANT] Jawaban 9Router tidak dapat digunakan", error instanceof Error ? error.name : "Error");
      }
    }
    const response = grounded && llmReply ? { ...fallback, reply: llmReply } : fallback;
    const source = grounded ? "llm" : "fallback";
    const ranked = [...model.predictions].sort((a, b) => {
      const weight = { urgent_restock: 0, regular_order: 1, normal: 2 };
      return weight[a.label] - weight[b.label];
    });
    const [saved] = await db.insert(assistantChatEvents).values({
      partner_id: user.partnerId,
      user_id: user.userId,
      message,
      reply: response.reply,
      intent,
      model_label: ranked[0]?.label ?? null,
      model_confidence: ranked[0] ? String(ranked[0].confidence) : null,
      model_results: { intent: classified, stocks: model.predictions, response_source: source },
    }).returning({ id: assistantChatEvents.id });
    return { ...response, interactionId: saved.id, modelAvailable: model.available, source };
  },
  { body: t.Object({ message: t.String({ minLength: 1, maxLength: 500 }) }) },
).patch(
  "/mitra/chat/:id/feedback",
  async ({ headers, params, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    const [updated] = await db.update(assistantChatEvents).set({ feedback: body.rating })
      .where(and(eq(assistantChatEvents.id, params.id), eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)))
      .returning({ id: assistantChatEvents.id });
    if (!updated) { set.status = 404; return { error: "Percakapan tidak ditemukan" }; }
    return { status: "ok" };
  },
  { params: t.Object({ id: t.String({ format: "uuid" }) }), body: t.Object({ rating: t.Union([t.Literal(1), t.Literal(-1)]) }) },
).delete(
  "/mitra/history",
  async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    await db.delete(assistantChatEvents)
      .where(and(eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)));
    return { status: "ok" };
  },
);
