// example_services/security_probe/service.ts
import { defineService, none, reply, runService } from "../../pbb_sdk/mod.ts";
import type { CommandEvent } from "../../pbb_sdk/mod.ts";

const service = defineService({
	id: "mock_secprobe",
	version: "1.0.0",
	kind: "single_command",
	command: "secprobe",
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
