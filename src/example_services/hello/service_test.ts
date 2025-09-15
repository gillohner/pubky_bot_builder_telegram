import hello from "./service.ts";
import { HELLO_DEFAULT_GREETING } from "./constants.ts";
import { CommandEvent, ServiceResponse } from "@sdk/runtime.ts";

function mkEv(cfg?: Record<string, unknown>): CommandEvent {
	return { type: "command", chatId: "c", userId: "u", serviceConfig: cfg } as CommandEvent;
}

Deno.test("hello default greeting", () => {
	const res = hello.handlers.command(mkEv()) as ServiceResponse;
	if (res.kind !== "reply" || res.text !== HELLO_DEFAULT_GREETING) {
		throw new Error("Unexpected greeting reply");
	}
});

Deno.test("hello custom greeting", () => {
	const res = hello.handlers.command(mkEv({ greeting: "Hi" })) as ServiceResponse;
	if (res.kind !== "reply" || res.text !== "Hi") throw new Error("Custom greeting not used");
});
