// /packages/demo_services/security_probe/service.ts
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CommandEvent } from "@sdk/mod.ts";
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
			// Combined security + env probe: gather structured report plus legacy env_probe style string
			const report: Record<string, unknown> = {};
			const diagnostics: string[] = [];
			// Environment access check (both structured and legacy list)
			try {
				const maybeDeno = (globalThis as {
					Deno?: { env?: { get?: (k: string) => string | undefined } };
				}).Deno;
				if (maybeDeno?.env?.get) {
					const token = maybeDeno.env.get("BOT_TOKEN");
					report.env = token ? "present_with_value" : "present";
					diagnostics.push("ENV_BOT_TOKEN=" + (token || "MISSING"));
				} else {
					report.env = "no_api";
					diagnostics.push("env_denied");
				}
			} catch (err) {
				report.env = `error:${(err as Error).name}`;
				diagnostics.push("env_denied");
			}
			// Filesystem probe
			try {
				await Deno.readTextFile("README.md");
				report.fs_readme = "read_ok";
				diagnostics.push("read_ok");
			} catch (err) {
				report.fs_readme = `denied:${(err as Error).name}`;
				diagnostics.push("read_denied");
			}
			try {
				await Deno.readTextFile("./bot.sqlite");
				report.fs_sqlite = "read_ok";
			} catch (err) {
				report.fs_sqlite = `denied:${(err as Error).name}`;
			}
			// Dynamic import probe (remote import should fail under --no-remote)
			try {
				// deno-lint-ignore no-unused-vars
				const mod = await import("https://deno.land/x/sqlite@v3.9.1/mod.ts");
				report.import = "ok"; // Unexpected if security flags in place
			} catch (err) {
				report.import = `denied:${(err as Error).name}`;
			}
			// Backward compatibility: include top-level shorthand keys expected by existing sandbox tests.
			return reply(
				JSON.stringify({
					...report, // env, fs_*, import
					report,
					legacy: "env probe: " + diagnostics.join(","),
				}),
				{ deleteTrigger: true },
			);
		},
		message: () => none(),
		callback: () => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
