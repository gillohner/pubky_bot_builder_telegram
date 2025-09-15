import keyboard from "./service.ts";
import { CallbackEvent, CommandEvent, ServiceResponse } from "@sdk/runtime.ts";

const baseCtx = { chatId: "c", userId: "u" };

Deno.test("keyboard command returns reply with markup", () => {
	const ev = { type: "command", ...baseCtx } as CommandEvent;
	const res = keyboard.handlers.command(ev) as ServiceResponse;
	if (res.kind !== "reply") throw new Error("Expected reply");
	const markup = res.options?.reply_markup as Record<string, unknown> | undefined;
	if (!markup) throw new Error("Missing keyboard markup");
});

Deno.test("keyboard callback edits selection", () => {
	const ev = { type: "callback", data: "svc:mock_keyboard|btn:one", ...baseCtx } as CallbackEvent;
	const res = keyboard.handlers.callback(ev) as ServiceResponse;
	if (res.kind !== "edit") throw new Error("Expected edit");
});
