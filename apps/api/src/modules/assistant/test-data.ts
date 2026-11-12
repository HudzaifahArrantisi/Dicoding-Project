import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dataRoot = resolve(import.meta.dir, "../../../../../ai/data/mega_data_word/tests");

export function loadAssistantFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataRoot, name), "utf8")) as T;
}
