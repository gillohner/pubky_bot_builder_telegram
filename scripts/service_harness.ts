// scripts/service_harness.ts
// Interactive harness to develop & debug a single service in isolation.
// Usage:
//   deno run -A scripts/service_harness.ts ./packages/core_services/simple-response/service.ts
// Then type commands:
//   /hello            -> simulates command event (leading slash optional)
//   cb:<data>         -> simulates callback payload (post-dispatch payload, e.g. 'audio')
//   msg:some text     -> simulates plain message while flow active
//   state             -> prints current in-memory state
//   exit              -> quits
// Notes:
// - This bypasses sandboxing; it directly invokes the handlers.
// - It maintains local in-memory state versioning similar to dispatcher semantics.
// - UI responses are pretty-printed.

import { resolve } from "https://deno.land/std@0.224.0/path/resolve.ts";
import type { DefinedService } from "@sdk/service.ts";
import type { ServiceResponse } from "@sdk/responses/types.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/events.ts";

interface HarnessStateEntry {
	value: Record<string, unknown>;
	version: number;
}

const args = Deno.args;
if (args.length < 1) {
	console.error("Provide path to service file");
	Deno.exit(1);
}

const servicePath = resolve(Deno.cwd(), args[0]);
const mod = await import("file://" + servicePath + `?cacheBust=${crypto.randomUUID()}`);
const svc: DefinedService = mod.default;
if (!svc || !svc.handlers) {
	console.error("Module did not export a default service definition");
	Deno.exit(1);
}

console.log(`Loaded service: ${svc.id} (command: /${svc.command}, kind: ${svc.kind})`);

let stored: HarnessStateEntry | undefined;

function applyStateDirective(resp: ServiceResponse | null) {
	if (resp && resp.state) {
		if (resp.state.op === "clear") {
			stored = undefined;
			console.log("State cleared");
		} else if (resp.state.op === "replace") {
			stored = { value: resp.state.value ?? {}, version: (stored?.version ?? 0) + 1 };
			console.log("State replaced -> version", stored.version);
		} else if (resp.state.op === "merge") {
			stored = {
				value: { ...(stored?.value ?? {}), ...(resp.state.value ?? {}) },
				version: (stored?.version ?? 0) + 1,
			};
			console.log("State merged -> version", stored.version);
		}
	}
}

function pretty(resp: ServiceResponse | null): string {
	if (!resp) return "null response";
	switch (resp.kind) {
		case "ui":
			if (resp.uiType === "keyboard") {
				const kb = resp.ui as { buttons: unknown };
				return JSON.stringify(
					{ kind: resp.kind, uiType: resp.uiType, text: resp.text, buttons: kb.buttons },
					null,
					2,
				);
			}
			return JSON.stringify({ kind: resp.kind, uiType: resp.uiType, text: resp.text }, null, 2);
		default:
			return JSON.stringify(resp, null, 2);
	}
}

async function handleCommand(token: string) {
	const ev: CommandEvent = {
		type: "command",
		chatId: "debug-chat",
		userId: "debug-user",
		serviceConfig: {},
		state: stored?.value,
		stateVersion: stored?.version,
	} as CommandEvent;
	// token currently unused because service handlers derive command from definition; kept for future extension
	void token;
	const resp = await svc.handlers.command(ev);
	console.log(pretty(resp));
	applyStateDirective(resp);
}
async function handleCallback(data: string) {
	const ev: CallbackEvent = {
		type: "callback",
		data,
		chatId: "debug-chat",
		userId: "debug-user",
		serviceConfig: {},
		state: stored?.value,
		stateVersion: stored?.version,
	} as CallbackEvent;
	const resp = await svc.handlers.callback(ev);
	console.log(pretty(resp));
	applyStateDirective(resp);
}
async function handleMessage(message: string) {
	const ev: MessageEvent = {
		type: "message",
		message,
		chatId: "debug-chat",
		userId: "debug-user",
		serviceConfig: {},
		state: stored?.value,
		stateVersion: stored?.version,
	} as MessageEvent;
	const resp = await svc.handlers.message(ev);
	console.log(pretty(resp));
	applyStateDirective(resp);
}

console.log(
	"\nInteractive harness ready. Type /<command>, cb:<data>, msg:<text>, state, reload, or exit.",
);

const decoder = new TextDecoder();
while (true) {
	await Deno.stdout.write(new TextEncoder().encode("> "));
	const buf = new Uint8Array(4096);
	const n = await Deno.stdin.read(buf);
	if (!n) break;
	const line = decoder.decode(buf.subarray(0, n)).trim();
	if (!line) continue;
	if (line === "exit" || line === "quit") break;
	if (line === "state") {
		console.log(stored ? JSON.stringify(stored, null, 2) : "No state");
		continue;
	}
	if (line.startsWith("/")) {
		await handleCommand(line.slice(1));
		continue;
	}
	if (line.startsWith("cb:")) {
		await handleCallback(line.slice(3));
		continue;
	}
	if (line.startsWith("msg:")) {
		await handleMessage(line.slice(4));
		continue;
	}
	if (line === "reload") {
		const fresh = await import("file://" + servicePath + `?cacheBust=${crypto.randomUUID()}`);
		Object.assign(svc, fresh.default); // shallow update
		console.log("Service module reloaded");
		continue;
	}
	// Fallback: treat as command without leading slash
	await handleCommand(line);
}

console.log("Exiting harness.");
