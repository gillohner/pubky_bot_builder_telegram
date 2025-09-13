// src/core/dispatcher.test.ts
import { dispatch } from "./dispatcher.ts";

Deno.test("dispatch handles command event without error", async () => {
  await dispatch({
    kind: "command",
    command: "start",
    ctx: { chatId: "1", userId: "2" },
  });
});

Deno.test("dispatch handles callback event without error", async () => {
  await dispatch({
    kind: "callback",
    data: "foo",
    ctx: { chatId: "1", userId: "2" },
  });
});

Deno.test("dispatch handles message event without error", async () => {
  await dispatch({
    kind: "message",
    message: { text: "hello" },
    ctx: { chatId: "1", userId: "2" },
  });
});
