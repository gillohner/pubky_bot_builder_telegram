// src/core/util/bundle.ts
// Concatenate the SDK runtime and a service source into one inline module (data URL) for
// maximum sandbox isolation (no filesystem reads inside sandbox execution). The snapshot
// builder will use this instead of simple fileToDataUrl for service entries.
import { log } from "@core/util/logger.ts";

interface CacheEntry {
	url: string;
	code: string;
	mtimeSdk: number;
	mtimeSvc: number;
}
const cache = new Map<string, CacheEntry>();

async function readFile(path: string): Promise<{ code: string; mtime: number }> {
	const info = await Deno.stat(path);
	if (!info.isFile) throw new Error(`Not a file: ${path}`);
	const code = await Deno.readTextFile(path);
	return { code, mtime: info.mtime?.getTime() ?? Date.now() };
}

export async function bundleService(
	sdkPath: string,
	servicePath: string,
): Promise<{ dataUrl: string; code: string }> {
	try {
		const cacheKey = `${sdkPath}::${servicePath}`;
		const [sdk, svc] = await Promise.all([readFile(sdkPath), readFile(servicePath)]);
		const prev = cache.get(cacheKey);
		if (prev && prev.mtimeSdk === sdk.mtime && prev.mtimeSvc === svc.mtime) {
			return { dataUrl: prev.url, code: prev.code };
		}
		// Strip import of SDK from service (it will be inlined). Simple regex heuristic.
		// Support legacy path sdk/runtime.ts, new pbb_sdk/mod.ts, alias '@/pbb_sdk/mod.ts', and relative ../../pbb_sdk/mod.ts
		const sdkImportRegex =
			/import\s+(?:type\s+)?\{[^}]+}\s+from\s+\"(?:[^\"]+sdk\/runtime\.ts|(?:\.\.?\/)+pbb_sdk\/(?:mod|runtime)\.ts|@\/pbb_sdk\/(?:mod|runtime)\.ts)\";?/g;
		const svcCode = svc.code.replace(sdkImportRegex, "");
		const concatenated =
			`${sdk.code}\n\n// ---- Inlined Service Source: ${servicePath} ----\n${svcCode}`;
		const enc = new TextEncoder().encode(concatenated);
		let binary = "";
		for (const b of enc) binary += String.fromCharCode(b);
		const url = `data:application/typescript;base64,${btoa(binary)}`;
		cache.set(cacheKey, { url, code: concatenated, mtimeSdk: sdk.mtime, mtimeSvc: svc.mtime });
		return { dataUrl: url, code: concatenated };
	} catch (err) {
		log.error("bundleService.error", { error: (err as Error).message, servicePath });
		throw err;
	}
}

export function clearBundleCache() {
	cache.clear();
}

// Helper to produce hash (caller can provide sha256 impl) outside to avoid coupling.
export async function bundleAndHash(
	sdkPath: string,
	servicePath: string,
	hashFn: (code: string) => Promise<string>,
): Promise<{ bundleHash: string; dataUrl: string; code: string }> {
	const { code, dataUrl } = await bundleService(sdkPath, servicePath);
	const bundleHash = await hashFn(code);
	return { bundleHash, dataUrl, code };
}
