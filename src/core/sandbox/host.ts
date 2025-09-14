// src/core/sandbox/host.ts
// Moved from src/core/sandbox.ts
export interface SandboxCaps {
	net?: string[];
	timeoutMs?: number;
}
export interface ExecutePayload {
	event: unknown;
	ctx: unknown;
}
export interface SandboxResult<T = unknown> {
	ok: boolean;
	value?: T;
	error?: string;
}

export class SandboxHost {
	async run<T = unknown>(
		entry: string,
		payload: ExecutePayload,
		caps: SandboxCaps = {},
	): Promise<SandboxResult<T>> {
		const requestedTimeout = caps.timeoutMs ?? 3000;
		const timeoutMs = Math.min(Math.max(requestedTimeout, 100), 20000);
		function sanitizeList(list?: string[]): string[] | undefined {
			if (!list) return undefined;
			const filtered = list.filter((v) => v && v !== "*" && v !== "<all>");
			return filtered.length ? filtered : undefined;
		}
		const _net = sanitizeList(caps.net)?.slice(0, 5);
		const args: string[] = ["run", "--quiet"]; // no permissions granted
		args.push(entry);
		const cmd = new Deno.Command("deno", {
			args,
			stdin: "piped",
			stdout: "piped",
			stderr: "piped",
		});
		const child = cmd.spawn();
		const writer = child.stdin.getWriter();
		await writer.write(
			new TextEncoder().encode(JSON.stringify(payload) + "\n"),
		);
		await writer.close();
		let output;
		const to = setTimeout(() => {
			try {
				child.kill();
			} catch {
				/* ignore */
			}
		}, timeoutMs);
		try {
			output = await child.output();
			clearTimeout(to);
		} catch (err) {
			clearTimeout(to);
			try {
				child.kill();
			} catch {
				/* ignore */
			}
			return { ok: false, error: (err as Error).message };
		}
		const stdout = new TextDecoder().decode(output.stdout).trim();
		const stderr = new TextDecoder().decode(output.stderr).trim();
		if (output.code !== 0) {
			return { ok: false, error: `sandbox exit ${output.code}: ${stderr}` };
		}
		if (!stdout) return { ok: true, value: undefined };
		try {
			return { ok: true, value: JSON.parse(stdout) };
		} catch (err) {
			return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
		}
	}
}
export const sandboxHost = new SandboxHost();
