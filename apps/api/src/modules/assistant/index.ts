import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { assistantChatEvents, assistantConversationMemory } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { answerMitraQuestion, type MitraTour } from "./knowledge";
import { composeMitraReply, resolveMitraIntent, type AssistantIntent } from "./compose";
import { loadMitraContext } from "./context";
import { understandMitraMessage, predictMitraStocks, type ModelResult } from "./model";
import { withinModelBudget } from "./model-budget";
import { composeKnowledgeReply, filterRagDocuments, knowledgeIntent, loadCompanyKnowledge } from "./company-knowledge";
import { isAssistantIdentityQuestion } from "./identity";
import { generateLlmReply, getLastLlmStatus } from "./llm-client";
import { rewriteMitraQuery } from "./query-rewrite";
import { buildMitraRagPrompt, isGroundedLlmReply } from "./rag-prompt";
import { isCrossTenantQuestion, OUT_OF_SCOPE_REPLY, shouldRefuseMitraMessage, TENANT_SCOPE_REPLY } from "./guardrails";
import { addSessionTurn, buildConversationContext, clearUserSessions, endSession, getSession, rateSessionTurn, sessionKey, summarizeSession } from "./session-memory";

const emptyModel: ModelResult = { available: false, predictions: [] };
const compactions = new Map<string, Promise<void>>();

function weeklyAnalysisReply(model: ModelResult, context: Awaited<ReturnType<typeof loadMitraContext>>): string {
  const documents = model.analysis_documents ?? [];
  const overview = documents.find((item) => item.source === "category_partners.json");
  const period = overview?.period ?? documents[0]?.period;
  const raw = overview?.excerpt.match(/\{.*\}$/)?.[0];
  let facts: Record<string, unknown> = {};
  try { facts = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch {}
  const historical = period
    ? `**Analisis mingguan dari daisuki.pkl (${period})**\n- Konsumsi: ${facts.weekly_units ?? "belum tersedia"} pcs\n- Laporan stok: ${facts.log_count ?? "belum tersedia"} kali\n- Pengajuan restock: ${facts.restock_requests ?? "belum tersedia"} kali\n- Kejadian stok habis: ${facts.stockout_events ?? "belum tersedia"} kali`
    : "**Analisis mingguan dari daisuki.pkl**\nBelum tersedia untuk cabang Anda. Jalankan training dari run analisis yang valid.";
  const currentStock = context.stocks.reduce((sum, item) => sum + item.current_qty, 0);
  const currentConsumption = context.stocks.reduce((sum, item) => sum + item.sold_7d, 0);
  return `${historical}\n\n**Kondisi terkini dari database**\n- Sisa stok cabang: ${currentStock} pcs\n- Konsumsi 7 hari terakhir: ${currentConsumption} pcs\n\nAngka model adalah snapshot periode analisis; angka database diperbarui dari catatan operasional.`;
}

function queueCompaction(key: string, partnerId: string, userId: string, sessionId: string, turns: ReturnType<typeof getSession>): void {
  if (!turns.length) return;
  const previous = compactions.get(key) ?? Promise.resolve();
  const work = previous.then(async () => {
    await db.transaction(async (tx) => {
      const [stored] = await tx.select({ summary: assistantConversationMemory.summary }).from(assistantConversationMemory)
        .where(and(eq(assistantConversationMemory.partner_id, partnerId), eq(assistantConversationMemory.user_id, userId), eq(assistantConversationMemory.session_id, sessionId))).limit(1);
      const summary = await summarizeSession(turns, stored?.summary ?? "");
      await tx.insert(assistantConversationMemory).values({ partner_id: partnerId, user_id: userId, session_id: sessionId, summary })
        .onConflictDoUpdate({ target: [assistantConversationMemory.partner_id, assistantConversationMemory.user_id, assistantConversationMemory.session_id], set: { summary, updated_at: new Date() } });
      await tx.update(assistantChatEvents).set({ model_results: sql`jsonb_set(${assistantChatEvents.model_results}, '{session_active}', 'false'::jsonb)` })
        .where(and(eq(assistantChatEvents.partner_id, partnerId), eq(assistantChatEvents.user_id, userId), inArray(assistantChatEvents.id, turns.map((turn) => turn.id)), sql`${assistantChatEvents.model_results}->>'session_id' = ${sessionId}`));
    });
  }).catch((error) => {
    endSession(key);
    console.warn("[ASSISTANT] Pemadatan memori gagal", error instanceof Error ? error.message : "Error");
  });
  compactions.set(key, work);
  void work.finally(() => { if (compactions.get(key) === work) compactions.delete(key); });
}

function isMitra(user: Awaited<ReturnType<typeof getAuthUser>>): user is NonNullable<typeof user> & { role: "mitra"; partnerId: string } {
  return Boolean(user?.role === "mitra" && user.partnerId);
}

async function activeTurns(partnerId: string, userId: string, sessionId: string, waitForCompaction = true) {
  const key = sessionKey(partnerId, userId, sessionId);
  if (waitForCompaction) await compactions.get(key);
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
      sql`${assistantChatEvents.model_results}->>'session_id' = ${sessionId}`,
    ))
    .orderBy(desc(assistantChatEvents.created_at)).limit(8);
  for (const row of rows.reverse()) {
    const metadata = row.model_results as { session_active?: boolean; response_source?: string } | null;
    if (metadata?.session_active !== true) continue;
    const evicted = addSessionTurn(key, {
      id: row.id, message: row.message, reply: row.reply, intent: row.intent,
      source: metadata.response_source === "llm" ? "llm" : "fallback",
      feedback: row.feedback === 1 || row.feedback === -1 ? row.feedback : null,
      created_at: row.created_at,
    });
    if (evicted.length) queueCompaction(key, partnerId, userId, sessionId, evicted);
  }
  if (waitForCompaction) await compactions.get(key);
  return getSession(key);
}

export const assistantModule = new Elysia({ prefix: "/assistant" }).get(
  "/mitra/history",
  async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (!isMitra(user)) { set.status = 403; return { error: "Akses hanya untuk mitra" }; }
    const rows = await activeTurns(user.partnerId, user.userId, headers["x-session-id"] ?? user.userId, false);
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
    const sessionId = body.session_id;
    const key = sessionKey(user.partnerId, user.userId, sessionId);
    const turns = await activeTurns(user.partnerId, user.userId, sessionId);
    const previousIntent = turns[turns.length - 1]?.intent as AssistantIntent | null ?? null;
    const scopeRefused = shouldRefuseMitraMessage(message, previousIntent);
    const relaxedChat = process.env.ASSISTANT_RELAXED_CHAT === "true";
    const memoryPromise = db.select({ summary: assistantConversationMemory.summary }).from(assistantConversationMemory)
      .where(and(eq(assistantConversationMemory.partner_id, user.partnerId), eq(assistantConversationMemory.user_id, user.userId), eq(assistantConversationMemory.session_id, sessionId))).limit(1);
    const [memory] = await memoryPromise;
    const standaloneQuery = scopeRefused || relaxedChat ? message : await rewriteMitraQuery(message, turns, memory?.summary ?? "");
    const knowledgeTopic = scopeRefused ? null : knowledgeIntent(standaloneQuery, previousIntent);
    const identityQuestion = !scopeRefused && isAssistantIdentityQuestion(standaloneQuery);
    const contextPromise = loadMitraContext(user.partnerId);
    const knowledgePromise = scopeRefused ? Promise.resolve(null) : loadCompanyKnowledge(standaloneQuery, knowledgeTopic);
    const understanding = scopeRefused ? emptyModel : await understandMitraMessage(standaloneQuery, user.partnerId);
    const classified = understanding.intent ?? null;
    const resolvedIntent = scopeRefused ? null : identityQuestion ? "identity" : knowledgeTopic ?? resolveMitraIntent(standaloneQuery, previousIntent, classified);
    const crossTenant = isCrossTenantQuestion(message) || isCrossTenantQuestion(standaloneQuery) || resolvedIntent === "top_partners";
    const refused = scopeRefused || crossTenant;
    const intent = refused ? null : resolvedIntent;
    const [context, knowledge] = await Promise.all([contextPromise, knowledgePromise]);
    if (knowledge && understanding.documents?.length) {
      const binaryDocuments = understanding.documents.filter((doc) => filterRagDocuments([{ name: doc.source, content: doc.excerpt }]).length > 0);
      knowledge.documents = [...binaryDocuments, ...knowledge.documents]
        .filter((doc, index, all) => all.findIndex((other) => other.source === doc.source && other.excerpt === doc.excerpt) === index).slice(0, 3);
    }
    const risk = intent === "restock" || intent === "stock_report"
      ? await withinModelBudget(predictMitraStocks(context.stocks), 800, emptyModel)
      : emptyModel;
    const model = { ...understanding, predictions: risk.predictions };
    const wantsWeeklySummary = /\b(?:merangkum|rangkuman|rangkum|ringkasan|ringkas|rekap|analisis)\b/i.test(standaloneQuery) && /\b(?:seminggu|sepekan|mingguan|minggu|7\s*hari)\b/i.test(standaloneQuery);
    const hasLocalTopic = Boolean(wantsWeeklySummary || (knowledgeTopic && knowledge) || intent);
    const ruleRefusalReply = crossTenant
      ? TENANT_SCOPE_REPLY
      : "Maaf, permintaan tersebut tidak dapat diproses karena melanggar aturan keamanan sistem Daisuki AI (akses instruksi internal atau konfigurasi sistem tidak diizinkan).";
    const fallback = refused
      ? { ...answerMitraQuestion(message), reply: ruleRefusalReply }
      : wantsWeeklySummary
        ? { ...answerMitraQuestion(message), reply: weeklyAnalysisReply(understanding, context) }
      : knowledgeTopic && knowledge
        ? { ...answerMitraQuestion(message), reply: composeKnowledgeReply(knowledge, knowledgeTopic, message) }
        : intent
        ? composeMitraReply(standaloneQuery, context, model, previousIntent, classified)
        : { ...answerMitraQuestion(message), reply: /\b(?:hi|hai|halo|selamat\s+(?:pagi|siang|sore|malam)|apa\s*kabar|apaokabar|tes|test|ping)\b/i.test(message)
          ? `Halo${context.partner?.name ? `, ${context.partner.name}` : ""}! Kabar saya baik dan siap membantu. Ada yang ingin kamu tanyakan atau bahas hari ini?`
          : "Maaf, server sedang gangguan. Silakan coba lagi beberapa saat." };
    let llmReply: string | null = null;
    let grounded = false;
    if (!refused) {
      const needsOperationalFacts = Boolean(
        hasLocalTopic ||
        identityQuestion ||
        turns.length > 0 ||
        /\b(?:stok|stock|restock|restok|barang|produk|pesan|order|po-|gudang|cabang|toko|basreng|seblak|makaroni|keripik|resi|kirim|daisuki|laporan|buffer|konsumsi|laku|terjual|mitra|profil|alamat|pic)\b/i.test(standaloneQuery),
      );
      const systemPrompt = needsOperationalFacts
        ? buildMitraRagPrompt(context, model, previousIntent, {
            summary: memory?.summary ?? "",
            recent: buildConversationContext(turns),
          }, knowledge ?? undefined)
        : `Anda adalah Daisuki AI Assistant, asisten AI cerdas untuk mitra Daisuki (${context.partner?.name ?? "Mitra"}). Jawab pertanyaan pengguna dengan bahasa Indonesia yang alami, ramah, dan informatif layaknya chatbot AI biasa tanpa memblokir topik umum.${
            knowledge?.documents?.length
              ? `\n\nREFERENSI_DOKUMEN:\n${JSON.stringify(knowledge.documents.slice(0, 2).map((d) => ({ source: d.source, excerpt: d.excerpt.slice(0, 700) })))}`
              : ""
          }`;
      try {
        llmReply = await generateLlmReply({
          systemPrompt,
          userMessage: needsOperationalFacts ? `Pesan asli: ${message}\nMaksud mandiri: ${standaloneQuery}` : message,
        });
        grounded = Boolean(
          llmReply &&
          isGroundedLlmReply(llmReply, context, model, knowledge ?? undefined, { summary: memory?.summary ?? "", recent: buildConversationContext(turns) }, message) &&
          (!identityQuestion || relaxedChat || /\bDaisuki\b/i.test(llmReply)),
        );
      } catch (error) {
        console.warn("[ASSISTANT] Jawaban 9Router tidak dapat digunakan", error instanceof Error ? error.message : "Error");
      }
    }
    const llmStatus = getLastLlmStatus();
    const timeoutReply = hasLocalTopic
      ? `Maaf, server sedang gangguan (koneksi AI lokal sedang timeout). Berikut data langsung dari sistem cabang Anda:\n\n${fallback.reply}`
      : "Maaf, server sedang gangguan (koneksi ke server AI sedang timeout). Silakan coba lagi beberapa saat.";
    const response = refused
      ? fallback
      : grounded && llmReply
        ? { ...fallback, reply: llmReply }
        : llmStatus === "timeout" || llmStatus === "error"
          ? { ...fallback, reply: timeoutReply }
          : fallback;
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
      model_results: { intent: classified, stocks: model.predictions, response_source: source, session_active: true, session_id: sessionId,
        model_available: understanding.available, binary_retrieval: understanding.retrieval_ready ?? false,
        knowledge_sources: knowledge?.documents.map((doc) => ({ source: doc.source, version: doc.version })) ?? [] },
    }).returning({ id: assistantChatEvents.id });
    const evicted = addSessionTurn(key, { id: saved.id, message, reply: response.reply, intent, source, feedback: null, created_at: new Date() });
    queueCompaction(key, user.partnerId, user.userId, sessionId, evicted);
    const payload = { ...response, interactionId: saved.id, session_id: sessionId, modelAvailable: model.available, source };
    if (headers.accept?.includes("text/event-stream")) {
      return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }
    return payload;
  },
  { body: t.Object({ message: t.String({ minLength: 1, maxLength: 500 }), session_id: t.String({ format: "uuid" }) }) },
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
    rateSessionTurn(sessionKey(user.partnerId, user.userId, headers["x-session-id"] ?? user.userId), params.id, body.rating);
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
    const key = sessionKey(user.partnerId, user.userId, sessionId);
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
        sql`${assistantChatEvents.model_results}->>'session_id' = ${sessionId}`,
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
    for (const key of [...compactions.keys()]) if (key.startsWith(`${user.partnerId}:${user.userId}:`)) await compactions.get(key);
    await db.delete(assistantChatEvents)
      .where(and(eq(assistantChatEvents.partner_id, user.partnerId), eq(assistantChatEvents.user_id, user.userId)));
    await db.delete(assistantConversationMemory)
      .where(and(eq(assistantConversationMemory.partner_id, user.partnerId), eq(assistantConversationMemory.user_id, user.userId)));
    clearUserSessions(user.partnerId, user.userId);
    return { status: "ok" };
  },
);
