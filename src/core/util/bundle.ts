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

// Very small, purpose-built inliner for same-directory relative imports (./*.ts) so
// service code can freely factor out constants/helpers without breaking the sandbox
// data URL execution (which cannot resolve further filesystem reads).
// Limitations / Assumptions:
// - Only inlines first-level & recursive same-directory relative imports that stay within
//   the service folder (prevent directory escape via ../ guards).
// - Skips .d.ts files.
// - Avoids duplicate inclusion via visited set.
// - Leaves side-effect imports (no bindings) intact but still inlines their code.
async function inlineLocalImports(
	entryPath: string,
	visited: Set<string>,
): Promise<string> {
	if (visited.has(entryPath)) return ""; // already inlined
	visited.add(entryPath);
	const { code } = await readFile(entryPath);
	// Remove SDK import lines (they will be provided separately)
	const sdkImportRegex = /import\s+(?:type\s+)?\{[^}]+}\s+from\s+\"(?:[^\"]+sdk\/runtime\.ts)\";?/g;
	const cleaned = code.replace(sdkImportRegex, "");
	// Find relative same-dir imports: import ... from "./foo.ts" or "./foo" (ts)
	const importRegex = /import\s+[^;]+from\s+\"(\.\/[^\"']+)\";?/g;
	let match: RegExpExecArray | null;
	const chunks: string[] = [];
	let lastIndex = 0;
	while ((match = importRegex.exec(cleaned))) {
		const [full, rel] = match;
		// push code before import
		chunks.push(cleaned.slice(lastIndex, match.index));
		lastIndex = match.index + full.length;
		// Resolve path (restrict to same directory)
		if (rel.startsWith("./") && !rel.includes("../")) {
			let candidate = `${entryPath.substring(0, entryPath.lastIndexOf("/"))}/${rel.substring(2)}`;
			if (!candidate.endsWith(".ts")) candidate += ".ts";
			if (candidate.endsWith(".d.ts")) {
				// drop declaration import
				continue;
			}
			try {
				const inlined = await inlineLocalImports(candidate, visited);
				chunks.push(
					`// ---- Inlined ${candidate} ----\n${inlined}\n// ---- End Inlined ${candidate} ----\n`,
				);
			} catch (e) {
				log.warn("bundleService.inline.miss", {
					entryPath,
					missing: candidate,
					error: (e as Error).message,
				});
				// Preserve original import if read failed (will likely error in sandbox, but we log)
				chunks.push(full);
			}
		} else {
			// Non same-dir relative import preserved
			chunks.push(full);
		}
	}
	chunks.push(cleaned.slice(lastIndex));
	return chunks.join("");
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
		const visited = new Set<string>();
		const inlinedService = await inlineLocalImports(servicePath, visited);
		const concatenated =
			`${sdk.code}\n\n// ---- Inlined Service Graph Root: ${servicePath} ----\n${inlinedService}`;
		// After inlining, strip ANY remaining relative import statements (they cannot
		// resolve from a data: URL and would cause "invalid URL: relative URL with a cannot-be-a-base base")
		// This is a safety net in case sdkImportRegex missed patterns (multi-line, type-only, etc.).
		// Capture forms:
		// 1. import { X } from "./foo.ts";
		// 2. import type { X } from "./foo";
		// 3. import "./side-effect"; (side-effect only)
		const residualRelativeImportRegex =
			/^(?:\s*import\s+(?:type\s+)?(?:[^'";]+from\s+)?["']\.[^"']+["'];?\s*)$/gm;
		const sanitized = concatenated.replace(residualRelativeImportRegex, "");
		// Collapse multiple blank lines introduced by removals for neatness.
		const finalCode = sanitized.replace(/\n{3,}/g, "\n\n");
		// IMPORTANT: encode sanitized finalCode (previously used unsanitized concatenated)
		const enc = new TextEncoder().encode(finalCode);
		let binary = "";
		for (const b of enc) binary += String.fromCharCode(b);
		const url = `data:application/typescript;base64,${btoa(binary)}`;
		cache.set(cacheKey, { url, code: finalCode, mtimeSdk: sdk.mtime, mtimeSvc: svc.mtime });
		return { dataUrl: url, code: finalCode };
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
