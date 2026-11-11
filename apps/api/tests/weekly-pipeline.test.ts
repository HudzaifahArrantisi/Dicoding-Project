import { expect, test } from "bun:test";
import { aiRunDir, dataScienceRunDir, workspaceRoot } from "../src/lib/analysis-artifacts";
import { resolve } from "node:path";

test("direktori run dibatasi ke UUID di workspace privat", () => {
  const id = "64703d85-1d8f-4a85-a75b-87f552beeb29";
  expect(dataScienceRunDir(id).startsWith(workspaceRoot)).toBe(true);
  expect(aiRunDir(id)).toBe(resolve(workspaceRoot, "ai/data/private/runs", id));
  expect(() => aiRunDir("..\\..\\web")).toThrow("ID run tidak valid");
});
