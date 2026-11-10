import { expect, test } from "bun:test";
import { withinModelBudget } from "./model-budget";

test("hasil model yang siap digunakan sebelum batas waktu", async () => {
  expect(await withinModelBudget(Promise.resolve("greeting"), 50, null)).toBe("greeting");
});

test("chat melanjutkan proses saat worker model masih memuat", async () => {
  const started = performance.now();
  const result = await withinModelBudget(new Promise<string>(() => undefined), 20, "fallback");
  expect(result).toBe("fallback");
  expect(performance.now() - started).toBeLessThan(200);
});
