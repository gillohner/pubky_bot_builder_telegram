// src/core/dispatch/dispatcher_test.ts
import { dispatch } from "./dispatcher.ts";

Deno.test("dispatch handles command event without error", async () => {
  const res = await dispatch({
    kind: "command",
    command: "start",
    ctx: { chatId: "1", userId: "2" },
  });
  if (res.response !== null)
    throw new Error("Expected null response for unknown command");
});

Deno.test("dispatch handles callback event without error", async () => {
  const res = await dispatch({
    kind: "callback",
    data: "foo",
    ctx: { chatId: "1", userId: "2" },
  });
  if (res.response !== null)
    throw new Error("Expected null for callback no-op");
});

Deno.test("dispatch handles message event without error", async () => {
  const res = await dispatch({
    kind: "message",
    message: { text: "hello" },
    ctx: { chatId: "1", userId: "2" },
  });
  if (res.response && res.response.kind !== "reply")
    throw new Error("Listener should only emit reply or none");
});

Deno.test("dispatch executes mock hello command in sandbox", async () => {
  const res = await dispatch({
    kind: "command",
    command: "hello",
    ctx: { chatId: "1", userId: "2" },
  });
  if (!res.response || res.response.kind !== "reply")
    throw new Error("Expected reply response kind");
  if (res.response.kind === "reply" && !res.response.text.includes("Hello"))
    throw new Error("Reply text did not contain expected greeting");
});

Deno.test("dispatch denies env & fs access for env probe", async () => {
  const res = await dispatch({
    kind: "command",
    command: "env",
    ctx: { chatId: "1", userId: "2" },
  });
  if (!res.response || res.response.kind !== "reply")
    throw new Error("Expected reply response for env probe");
  const text = res.response.text;
  if (!text.includes("env_denied") || !text.includes("read_denied"))
    throw new Error(
      "Expected env_denied and read_denied diagnostics, got: " + text
    );
});
