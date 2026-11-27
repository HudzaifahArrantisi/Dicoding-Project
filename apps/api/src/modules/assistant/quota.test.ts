import { describe, expect, it } from "bun:test";
import {
  acquireInFlightChatLock,
  BURST_COOLDOWN_MS,
  checkQuotaGate,
  computeQuotaFromTimestamps,
  QUOTA_WINDOW_MS,
  releaseInFlightChatLock,
  resolveQuotaLimit,
} from "./quota";

describe("assistant per-user 5-hour quota & rate limit", () => {
  it("resolves default 5-hour limits per role", () => {
    expect(resolveQuotaLimit("admin")).toBe(50);
    expect(resolveQuotaLimit("mitra")).toBe(25);
  });

  it("computes remaining quota and 5-hour reset timestamp accurately", () => {
    const now = Date.UTC(2026, 10, 28, 5, 0, 0);
    const oldest = now - 2 * 60 * 60 * 1000; // 2 hours ago
    const second = now - 1 * 60 * 60 * 1000; // 1 hour ago
    const expired = now - QUOTA_WINDOW_MS - 10_000; // older than 5 hours

    const quota = computeQuotaFromTimestamps({
      timestampsMs: [expired, oldest, second],
      limit: 25,
      nowMs: now,
    });

    expect(quota.used).toBe(2);
    expect(quota.remaining).toBe(23);
    expect(quota.window_hours).toBe(5);
    expect(quota.reset_at).toBe(new Date(oldest + QUOTA_WINDOW_MS).toISOString());
    expect(quota.burst_cooldown_seconds).toBe(0);
    expect(checkQuotaGate(quota).allowed).toBe(true);
  });

  it("blocks when 5-hour quota is exhausted and reports cooldown duration", () => {
    const now = Date.UTC(2026, 10, 28, 5, 0, 0);
    const timestamps = Array.from({ length: 25 }, (_, index) => now - (25 - index) * 60_000);
    const quota = computeQuotaFromTimestamps({
      timestampsMs: timestamps,
      limit: 25,
      nowMs: now,
    });

    expect(quota.used).toBe(25);
    expect(quota.remaining).toBe(0);
    expect(quota.retry_after_seconds).toBeGreaterThan(4 * 3600);

    const gate = checkQuotaGate(quota);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("quota_exceeded");
    expect(gate.message).toContain("25 pesan per 5 jam");
  });

  it("enforces short burst cooldown between consecutive messages", () => {
    const now = Date.UTC(2026, 10, 28, 5, 0, 0);
    const quota = computeQuotaFromTimestamps({
      timestampsMs: [now - 1_200],
      limit: 50,
      nowMs: now,
    });

    expect(quota.burst_cooldown_seconds).toBe(Math.ceil((BURST_COOLDOWN_MS - 1_200) / 1000));
    const gate = checkQuotaGate(quota);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("burst_cooldown");
  });

  it("guards against concurrent in-flight requests for the same user", () => {
    const userId = "00000000-0000-4000-8000-000000000099";
    releaseInFlightChatLock(userId);
    expect(acquireInFlightChatLock(userId, 1000)).toBe(true);
    expect(acquireInFlightChatLock(userId, 2000)).toBe(false);
    releaseInFlightChatLock(userId);
    expect(acquireInFlightChatLock(userId, 3000)).toBe(true);
    releaseInFlightChatLock(userId);
  });
});
