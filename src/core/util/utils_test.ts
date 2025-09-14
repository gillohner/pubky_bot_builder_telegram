// src/core/util/utils_test.ts
import {
  normalizeCommand,
  isBotCommand,
  buildCallbackData,
  parseCallbackData,
} from "./utils.ts";

Deno.test("normalizeCommand strips leading slash and lowercases", () => {
  const out = normalizeCommand("/HeLLo");
  if (out !== "hello") throw new Error(`Expected 'hello', got '${out}'`);
});

Deno.test("isBotCommand detects leading slash", () => {
  if (!isBotCommand("/start")) throw new Error("/start should be a command");
  if (isBotCommand("start")) throw new Error("start shouldn't be a command");
});

Deno.test("callback data roundtrip", () => {
  const data = buildCallbackData("demo", 1, { a: 1, b: "two" });
  const parsed = parseCallbackData<{ a: number; b: string }>(data, "demo", 1);
  if (!parsed || parsed.a !== 1 || parsed.b !== "two")
    throw new Error("Roundtrip failed");
});

Deno.test("callback data rejects wrong prefix", () => {
  const data = buildCallbackData("demo", 1, { ok: true });
  const parsed = parseCallbackData(data, "other", 1);
  if (parsed !== null) throw new Error("Expected null for wrong prefix");
});
