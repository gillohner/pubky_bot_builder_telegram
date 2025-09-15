// example_services/security_probe/service.ts
import { defineService, none, reply, runService } from "../../sdk/mod.ts";
import type { CommandEvent } from "../../sdk/mod.ts";
import {
	SECURITY_PROBE_COMMAND,
	SECURITY_PROBE_SERVICE_ID,
	SECURITY_PROBE_VERSION,
} from "./constants.ts";

const service = defineService({
	id: SECURITY_PROBE_SERVICE_ID,
	version: SECURITY_PROBE_VERSION,
	kind: "single_command",
	command: SECURITY_PROBE_COMMAND,
	description: "Security probe for env, fs, dynamic import",
	handlers: {
		command: async (_ev: CommandEvent) => {
			const report: Record<string, unknown> = {};
			try { // Env
				// deno-lint-ignore no-explicit-any
				const anyDeno: any = globalThis.Deno;
				report.env = anyDeno?.env?.get ? anyDeno.env.get("BOT_TOKEN") ?? "present" : "no_api";
			} catch (err) {
				report.env = `error:${(err as Error).name}`;
			}
			try { // FS
				await Deno.readTextFile("./bot.sqlite");
				report.fs = "read_ok";
			} catch (err) {
				report.fs = `denied:${(err as Error).name}`;
			}
			try { // Dynamic import blocked by --no-remote
				// deno-lint-ignore no-unused-vars
				const mod = await import("https://deno.land/x/sqlite@v3.9.1/mod.ts");
				report.import = "ok"; // Should not happen
			} catch (err) {
				report.import = `denied:${(err as Error).name}`;
			}
			return reply(JSON.stringify(report), { deleteTrigger: true });
		},
		message: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
