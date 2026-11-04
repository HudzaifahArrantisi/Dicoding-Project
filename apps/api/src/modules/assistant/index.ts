import { Elysia, t } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { assistantChatEvents } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { answerMitraQuestion, type MitraTour } from "./knowledge";
import { composeMitraReply, resolveMitraIntent, type AssistantIntent } from "./compose";
import { loadMitraContext } from "./context";
import { classifyMitraMessage, predictMitraStocks, type ModelResult } from "./model";

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
      feedback: assistantChatEvents.feedback,
      created_at: assistantChatEvents.created_at,
    }).from(assistantChatEvents)
      .where(and(eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)))
      .orderBy(desc(assistantChatEvents.created_at)).limit(30);
    const tours = new Set<MitraTour>(["restock", "stock_report", "delivery", "logs", "profile"]);
    return { data: rows.reverse().map((row) => ({ ...row, intent: tours.has(row.intent as MitraTour) ? row.intent : null })) };
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
    const response = context
      ? composeMitraReply(message, context, model, previousIntent, classified)
      : answerMitraQuestion(message);
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
      model_results: { intent: classified, stocks: model.predictions },
    }).returning({ id: assistantChatEvents.id });
    return { ...response, interactionId: saved.id, modelAvailable: model.available };
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
);
