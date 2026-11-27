import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "../../db/client";
import { assistantChatEvents } from "../../db/schema";

export const QUOTA_WINDOW_HOURS = 5;
export const QUOTA_WINDOW_MS = QUOTA_WINDOW_HOURS * 60 * 60 * 1000;
export const BURST_COOLDOWN_MS = 3_000;
export const IN_FLIGHT_MAX_AGE_MS = 45_000;

export type AssistantRole = "admin" | "mitra";

export interface AssistantQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  window_hours: number;
  reset_at: string | null;
  retry_after_seconds: number;
  burst_cooldown_seconds: number;
  in_flight: boolean;
}

export interface QuotaComputationInput {
  timestampsMs: number[];
  limit: number;
  nowMs?: number;
  inFlightStartedAtMs?: number | null;
}

const inFlightRequests = new Map<string, number>();

export function resolveQuotaLimit(role: AssistantRole): number {
  const raw = role === "admin"
    ? process.env.ASSISTANT_ADMIN_QUOTA_5H
    : process.env.ASSISTANT_MITRA_QUOTA_5H;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return role === "admin" ? 50 : 25;
}

export function computeQuotaFromTimestamps({
  timestampsMs,
  limit,
  nowMs = Date.now(),
  inFlightStartedAtMs = null,
}: QuotaComputationInput): AssistantQuotaStatus {
  const windowStartMs = nowMs - QUOTA_WINDOW_MS;
  const activeTimestamps = timestampsMs
    .filter((ts) => Number.isFinite(ts) && ts >= windowStartMs)
    .sort((a, b) => a - b);

  const used = activeTimestamps.length;
  const remaining = Math.max(0, limit - used);
  const oldestMs = activeTimestamps[0] ?? null;
  const newestMs = activeTimestamps[activeTimestamps.length - 1] ?? null;

  // Cooldown 5 jam dihitung dari pesan tertua yang masih berada di jendela 5 jam.
  const resetAtMs = oldestMs !== null ? oldestMs + QUOTA_WINDOW_MS : null;
  const windowRetrySeconds = resetAtMs !== null
    ? Math.max(0, Math.ceil((resetAtMs - nowMs) / 1000))
    : 0;

  const burstRemainingMs = newestMs !== null
    ? Math.max(0, newestMs + BURST_COOLDOWN_MS - nowMs)
    : 0;
  const burstCooldownSeconds = Math.ceil(burstRemainingMs / 1000);

  const inFlight = Boolean(
    inFlightStartedAtMs !== null &&
      nowMs - inFlightStartedAtMs < IN_FLIGHT_MAX_AGE_MS,
  );

  const retryAfterSeconds = remaining === 0
    ? Math.max(1, windowRetrySeconds)
    : burstCooldownSeconds > 0
      ? burstCooldownSeconds
      : inFlight
        ? 3
        : 0;

  return {
    used,
    limit,
    remaining,
    window_hours: QUOTA_WINDOW_HOURS,
    reset_at: resetAtMs !== null ? new Date(resetAtMs).toISOString() : null,
    retry_after_seconds: retryAfterSeconds,
    burst_cooldown_seconds: burstCooldownSeconds,
    in_flight: inFlight,
  };
}

export function acquireInFlightChatLock(userId: string, nowMs = Date.now()): boolean {
  const existing = inFlightRequests.get(userId);
  if (existing !== undefined && nowMs - existing < IN_FLIGHT_MAX_AGE_MS) {
    return false;
  }
  inFlightRequests.set(userId, nowMs);
  return true;
}

export function releaseInFlightChatLock(userId: string): void {
  inFlightRequests.delete(userId);
}

export function getInFlightStartedAt(userId: string, nowMs = Date.now()): number | null {
  const existing = inFlightRequests.get(userId);
  if (existing === undefined) return null;
  if (nowMs - existing >= IN_FLIGHT_MAX_AGE_MS) {
    inFlightRequests.delete(userId);
    return null;
  }
  return existing;
}

export async function getUserChatQuota(
  userId: string,
  role: AssistantRole,
  nowMs = Date.now(),
): Promise<AssistantQuotaStatus> {
  const limit = resolveQuotaLimit(role);
  const windowStart = new Date(nowMs - QUOTA_WINDOW_MS);
  const rows = await db
    .select({ created_at: assistantChatEvents.created_at })
    .from(assistantChatEvents)
    .where(
      and(
        eq(assistantChatEvents.user_id, userId),
        gte(assistantChatEvents.created_at, windowStart),
      ),
    )
    .orderBy(asc(assistantChatEvents.created_at));

  const timestampsMs = rows.map((row) => new Date(row.created_at).getTime());
  return computeQuotaFromTimestamps({
    timestampsMs,
    limit,
    nowMs,
    inFlightStartedAtMs: getInFlightStartedAt(userId, nowMs),
  });
}

export function formatCooldownDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }
  if (minutes > 0) {
    return `${minutes} menit ${seconds} detik`;
  }
  return `${seconds} detik`;
}

export function checkQuotaGate(quota: AssistantQuotaStatus): {
  allowed: boolean;
  reason?: "quota_exceeded" | "burst_cooldown" | "in_flight";
  message?: string;
} {
  if (quota.remaining <= 0) {
    const waitLabel = formatCooldownDuration(quota.retry_after_seconds);
    return {
      allowed: false,
      reason: "quota_exceeded",
      message: `Batas kuota chat akun Anda (${quota.limit} pesan per ${quota.window_hours} jam) sudah penuh. Kuota akan pulih dalam ${waitLabel}.`,
    };
  }
  if (quota.in_flight) {
    return {
      allowed: false,
      reason: "in_flight",
      message: "Masih ada pertanyaan yang sedang diproses pada akun ini. Tunggu jawaban selesai sebelum mengirim pesan baru.",
    };
  }
  if (quota.burst_cooldown_seconds > 0) {
    return {
      allowed: false,
      reason: "burst_cooldown",
      message: `Pengiriman terlalu cepat. Tunggu ${quota.burst_cooldown_seconds} detik sebelum mengirim pesan berikutnya.`,
    };
  }
  return { allowed: true };
}
