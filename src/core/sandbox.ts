// src/core/sandbox.ts
// Minimal sandbox host that executes a service module (ESM) in a separate Deno
// process with a JSON payload over stdin -> stdout. This is a pared-down
// version aligned with the broader spec; capabilities & security flags can be
// expanded later.

export interface SandboxCaps {
	net?: string[]; // allowed network hosts
	read?: string[]; // allowed read paths (avoid if possible)
	write?: string[]; // allowed write paths (avoid if possible)
	env?: string[]; // allowed env vars
	timeoutMs?: number; // execution timeout
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
	async run<T = unknown>(entry: string, payload: ExecutePayload, caps: SandboxCaps = {}): Promise<SandboxResult<T>> {
		const args: string[] = [
			"run",
			"--quiet",
			"--deny-all", // start from zero permissions
		];

		if (caps.net?.length) args.push(`--allow-net=${caps.net.join(",")}`);
		if (caps.read?.length) args.push(`--allow-read=${caps.read.join(",")}`);
		if (caps.write?.length) args.push(`--allow-write=${caps.write.join(",")}`);
		if (caps.env?.length) args.push(`--allow-env=${caps.env.join(",")}`);

		args.push(entry);

		const cmd = new Deno.Command("deno", {
			args,
			stdin: "piped",
			stdout: "piped",
			stderr: "piped",
		});
		const child = cmd.spawn();

		// Write payload (single line JSON)
		const writer = child.stdin.getWriter();
		await writer.write(new TextEncoder().encode(JSON.stringify(payload) + "\n"));
		await writer.close();

		const timeoutMs = caps.timeoutMs ?? 3000;
		let output;
		try {
			output = await Promise.race([
				child.output(),
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
			]);
		} catch (err) {
			try { child.kill(); } catch { /* ignore */ }
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