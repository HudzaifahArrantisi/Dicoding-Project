import { expect, test } from "bun:test";
import { isTransientDatabaseError, retryTransientRead } from "../src/lib/db-retry";

test("mencoba ulang pembacaan sesi sekali setelah koneksi database terputus", async () => {
  let attempts = 0;
  const result = await retryTransientRead(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("Query gagal"), {
      cause: Object.assign(new Error("Koneksi terputus"), { code: "ECONNRESET" }),
    });
    return "valid";
  });
  expect(result).toBe("valid");
  expect(attempts).toBe(2);
});

test("tidak mencoba ulang kesalahan SQL yang bukan gangguan koneksi", async () => {
  let attempts = 0;
  const failure = Object.assign(new Error("Kolom tidak ada"), { code: "42703" });
  expect(isTransientDatabaseError(failure)).toBe(false);
  await expect(retryTransientRead(async () => {
    attempts += 1;
    throw failure;
  })).rejects.toBe(failure);
  expect(attempts).toBe(1);
});
