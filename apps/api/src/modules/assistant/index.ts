import { Elysia, t } from "elysia";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { assistantChatEvents, assistantConversationMemory } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { answerMitraQuestion, type MitraTour } from "./knowledge";
import { composeMitraReply, resolveMitraIntent, type AssistantIntent } from "./compose";
import { loadMitraContext } from "./context";
import { classifyMitraMessage, predictMitraStocks, type ModelResult } from "./model";
import { withinModelBudget } from "./model-budget";
import { composeKnowledgeReply, knowledgeIntent, loadCompanyKnowledge } from "./company-knowledge";
import { isAssistantIdentityQuestion } from "./identity";
import { generateLlmReply } from "./llm-client";
import { buildMitraRagPrompt, isGroundedLlmReply } from "./rag-prompt";
import { isCrossTenantQuestion, OUT_OF_SCOPE_REPLY, shouldRefuseMitraMessage, TENANT_SCOPE_REPLY } from "./guardrails";
import { addSessionTurn, buildConversationContext, endSession, getSession, rateSessionTurn, sessionKey, summarizeSession } from "./session-memory";

const emptyModel: ModelResult = { available: false, predictions: [] };

function isMitra(user: Awaited<ReturnType<typeof getAuthUser>>): user is NonNullable<typeof user> & { role: "mitra"; partnerId: string } {
  return Boolean(user?.role === "mitra" && user.partnerId);
}

async function activeTurns(partnerId: string, userId: string, sessionId: string) {
  const key = sessionKey(partnerId, sessionId);
  const cached = getSession(key);
  if (cached.length) return cached;
  const rows = await db.select({
    id: assistantChatEvents.id,
    message: assistantChatEvents.message,
    reply: assistantChatEvents.reply,
    intent: assistantChatEvents.intent,
    model_results: assistantChatEvents.model_results,
    feedback: assistantChatEvents.feedback,
    created_at: assistantChatEvents.created_at,
  }).from(assistantChatEvents)
    .where(and(
      eq(assistantChatEvents.partner_id, partnerId),
      eq(assistantChatEvents.user_id, userId),
      sql`(${assistantChatEvents.model_results}->>'session_id' = ${sessionId} OR ${assistantChatEvents.model_results}->>'session_id' IS NULL)`,
    ))
    .orderBy(desc(assistantChatEvents.created_at)).limit(15);
  for (const row of rows.reverse()) {
    const metadata = row.model_results as { session_active?: boolean; response_source?: string } | null;
    if (metadata?.session_active !== true) continue;
    addSessionTurn(key, {
      id: row.id, message: row.message, reply: row.reply, intent: row.intent,
      source: metadata.response_source === "llm" ? "llm" : "fallback",
      feedback: row.feedback === 1 || row.feedback === -1 ? row.feedback : null,
      created_at: row.created_at,
    });
  }
  return getSession(key);
}

export const assistantModule = new Elysia({ prefix: "/assistant" }).get(
  "/mitra/history",
  async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    const rows = await activeTurns(user.partnerId, user.userId, headers["x-session-id"] ?? user.userId);
    const tours = new Set<MitraTour>(["restock", "stock_report", "delivery", "logs", "profile"]);
    return { data: rows.reverse().map((row) => ({
      id: row.id,
      message: row.message,
      reply: row.reply,
      intent: tours.has(row.intent as MitraTour) ? row.intent : null,
      source: row.source,
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
    const sessionId = body.session_id ?? headers["x-session-id"] ?? crypto.randomUUID();
    const key = sessionKey(user.partnerId, sessionId);
    const turns = await activeTurns(user.partnerId, user.userId, sessionId);
    const previousIntent = turns[turns.length - 1]?.intent as AssistantIntent | null ?? null;
    const scopeRefused = shouldRefuseMitraMessage(message, previousIntent);
    const knowledgeTopic = scopeRefused ? null : knowledgeIntent(message, previousIntent);
    const identityQuestion = !scopeRefused && isAssistantIdentityQuestion(message);
    const contextPromise = loadMitraContext(user.partnerId);
    const memoryPromise = db.select({ summary: assistantConversationMemory.summary }).from(assistantConversationMemory)
      .where(and(eq(assistantConversationMemory.partner_id, user.partnerId), eq(assistantConversationMemory.user_id, user.userId), eq(assistantConversationMemory.session_id, sessionId))).limit(1);
    const knowledgePromise = knowledgeTopic ? loadCompanyKnowledge(message, knowledgeTopic) : Promise.resolve(null);
    const classified = scopeRefused || knowledgeTopic || identityQuestion ? null : await withinModelBudget(classifyMitraMessage(message), 500, null);
    const resolvedIntent = scopeRefused ? null : identityQuestion ? "identity" : knowledgeTopic ?? resolveMitraIntent(message, previousIntent, classified);
    const crossTenant = isCrossTenantQuestion(message) || resolvedIntent === "top_partners";
    const refused = scopeRefused || crossTenant;
    const intent = refused ? null : resolvedIntent;
    const [context, [memory], knowledge] = await Promise.all([contextPromise, memoryPromise, knowledgePromise]);
    const model = intent === "restock" || intent === "stock_report"
      ? await withinModelBudget(predictMitraStocks(context.stocks), 800, emptyModel)
      : emptyModel;
    const fallback = refused
      ? { ...answerMitraQuestion(message), reply: crossTenant ? TENANT_SCOPE_REPLY : OUT_OF_SCOPE_REPLY }
      : knowledgeTopic && knowledge
        ? { ...answerMitraQuestion(message), reply: composeKnowledgeReply(knowledge, knowledgeTopic, message) }
        : intent
        ? composeMitraReply(message, context, model, previousIntent, classified)
        : answerMitraQuestion(message);
    let llmReply: string | null = null;
    let grounded = false;
    if (!refused) {
      try {
        llmReply = await generateLlmReply({
          systemPrompt: buildMitraRagPrompt(context, model, previousIntent, {
            summary: memory?.summary ?? "",
            recent: buildConversationContext(turns),
          }, knowledge ?? undefined),
          userMessage: message,
        });
        grounded = Boolean(llmReply && isGroundedLlmReply(llmReply, context, model, knowledge ?? undefined, { summary: memory?.summary ?? "", recent: buildConversationContext(turns) })
          && (!identityQuestion || /\bDaisuki AI(?: Assistant)?\b/i.test(llmReply)));
      } catch (error) {
        console.warn("[ASSISTANT] Jawaban 9Router tidak dapat digunakan", error instanceof Error ? error.message : "Error");
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
      model_results: { intent: classified, stocks: model.predictions, response_source: source, session_active: true, session_id: sessionId },
    }).returning({ id: assistantChatEvents.id });
    addSessionTurn(key, { id: saved.id, message, reply: response.reply, intent, source, feedback: null, created_at: new Date() });
    const payload = { ...response, interactionId: saved.id, session_id: sessionId, modelAvailable: model.available, source };
    if (headers.accept?.includes("text/event-stream")) {
      return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }
    return payload;
  },
  { body: t.Object({ message: t.String({ minLength: 1, maxLength: 500 }), session_id: t.Optional(t.String({ format: "uuid" })) }) },
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
    rateSessionTurn(sessionKey(user.partnerId, headers["x-session-id"] ?? user.userId), params.id, body.rating);
    return { status: "ok" };
  },
  { params: t.Object({ id: t.String({ format: "uuid" }) }), body: t.Object({ rating: t.Union([t.Literal(1), t.Literal(-1)]) }) },
).post(
  "/mitra/end",
  async ({ headers, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    const sessionId = body.session_id ?? headers["x-session-id"] ?? user.userId;
    const key = sessionKey(user.partnerId, sessionId);
    const turns = await activeTurns(user.partnerId, user.userId, sessionId);
    if (!turns.length) return { status: "ok", remembered: false };
    const [previous] = await db.select({ summary: assistantConversationMemory.summary }).from(assistantConversationMemory)
      .where(and(eq(assistantConversationMemory.partner_id, user.partnerId), eq(assistantConversationMemory.user_id, user.userId), eq(assistantConversationMemory.session_id, sessionId))).limit(1);
    const summary = await summarizeSession(turns, previous?.summary ?? "");
    await db.transaction(async (tx) => {
      if (summary) {
        await tx.insert(assistantConversationMemory).values({
          partner_id: user.partnerId, user_id: user.userId, session_id: sessionId, summary,
        }).onConflictDoUpdate({
          target: [assistantConversationMemory.partner_id, assistantConversationMemory.user_id, assistantConversationMemory.session_id],
          set: { summary, updated_at: new Date() },
        });
      }
      await tx.delete(assistantChatEvents).where(and(
        eq(assistantChatEvents.partner_id, user.partnerId),
        eq(assistantChatEvents.user_id, user.userId),
        sql`${assistantChatEvents.model_results}->>'session_active' = 'true'`,
      ));
    });
    endSession(key);
    return { status: "ok", remembered: Boolean(summary), session_id: sessionId };
  },
  { body: t.Object({ session_id: t.Optional(t.String({ format: "uuid" })) }) },
).delete(
  "/mitra/history",
  async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    await db.delete(assistantChatEvents)
      .where(and(eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)));
    await db.delete(assistantConversationMemory)
      .where(and(eq(assistantConversationMemory.partner_id, user.partnerId), eq(assistantConversationMemory.user_id, user.userId)));
    endSession(sessionKey(user.partnerId, user.userId));
    return { status: "ok" };
  },
);
