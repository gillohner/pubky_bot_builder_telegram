// src/core/util/bundle.ts
// Concatenate the SDK and a service source into one inline module (data URL) for
// maximum sandbox isolation (no filesystem reads inside sandbox execution).
// Handles @sdk imports by resolving them through deno.json import map and inlining dependencies.
import { log } from "@core/util/logger.ts";

interface CacheEntry {
	url: string;
	code: string;
	sdkSig: string; // signature of sdk files (mtime aggregate)
	mtimeSvc: number; // service file mtime
}
const cache = new Map<string, CacheEntry>();

// SDK signature cache (avoid walking directory each bundle call)
let cachedSdkSig = "";
let cachedSdkSigAt = 0;
const SDK_SIG_TTL_MS = 1000; // recompute at most once per second

async function computeSdkSig(root: string): Promise<string> {
	const now = Date.now();
	if (cachedSdkSig && now - cachedSdkSigAt < SDK_SIG_TTL_MS) return cachedSdkSig;
	const sdkDir = `${root}/packages/sdk`;
	const mtimes: string[] = [];
	try {
		for await (const entry of Deno.readDir(sdkDir)) {
			if (entry.isFile && entry.name.endsWith(".ts")) {
				const stat = await Deno.stat(`${sdkDir}/${entry.name}`);
				mtimes.push(`${entry.name}:${stat.mtime?.getTime() ?? 0}`);
			} else if (entry.isDirectory && entry.name === "responses") {
				for await (const sub of Deno.readDir(`${sdkDir}/responses`)) {
					if (sub.isFile && sub.name.endsWith(".ts")) {
						const s2 = await Deno.stat(`${sdkDir}/responses/${sub.name}`);
						mtimes.push(`responses/${sub.name}:${s2.mtime?.getTime() ?? 0}`);
					}
				}
			}
		}
	} catch (err) {
		log.warn("bundleService.sdkSig.error", { error: (err as Error).message });
	}
	mtimes.sort();
	cachedSdkSig = mtimes.join("|");
	cachedSdkSigAt = now;
	return cachedSdkSig;
}

async function readFile(path: string): Promise<{ code: string; mtime: number }> {
	const info = await Deno.stat(path);
	if (!info.isFile) throw new Error(`Not a file: ${path}`);
	const code = await Deno.readTextFile(path);
	return { code, mtime: info.mtime?.getTime() ?? Date.now() };
}

// Resolve @sdk import to actual file path using deno.json import map
function resolveImportPath(importPath: string, basePath: string): string | null {
	if (importPath.startsWith("@sdk/")) {
		// Map using current import map (@sdk/ -> ./packages/sdk/)
		// NOTE: We intentionally mirror deno.json rather than parsing it at runtime for speed.
		// If the import map changes, adjust this mapping & add a test.
		return importPath.replace("@sdk/", "./packages/sdk/");
	}
	if (importPath.startsWith("./")) {
		// Relative import - resolve relative to the importing file's directory
		const baseDir = basePath.substring(0, basePath.lastIndexOf("/"));
		let resolved = `${baseDir}/${importPath.substring(2)}`;
		if (!resolved.endsWith(".ts")) resolved += ".ts";
		return resolved;
	}
	return null; // External import - not handled by bundler
}

// Enhanced inliner that handles both @sdk imports and local relative imports
// Creates a complete dependency graph and inlines everything needed for sandbox execution
async function inlineAllImports(
	entryPath: string,
	visited: Set<string>,
	projectRoot: string,
): Promise<string> {
	if (visited.has(entryPath)) return ""; // already inlined
	visited.add(entryPath);

	const { code } = await readFile(entryPath);

	// Find all import and export statements that reference other files
	const importRegex =
		/(?:import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+["']([^"']+)["'];?|export\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["'];?)/g;

	let match: RegExpExecArray | null;
	const chunks: string[] = [];
	let lastIndex = 0;

	while ((match = importRegex.exec(code))) {
		const [fullStatement] = match;
		const importPath = match[1] || match[2]; // import path is in either group 1 or 2

		// Push code before this import/export
		chunks.push(code.slice(lastIndex, match.index));
		lastIndex = match.index + fullStatement.length;

		// Try to resolve and inline the import/export
		const resolvedPath = resolveImportPath(importPath, entryPath);

		if (resolvedPath) {
			// Make path absolute
			const absolutePath = resolvedPath.startsWith("./")
				? `${projectRoot}/${resolvedPath.substring(2)}`
				: resolvedPath;

			// Skip .d.ts files
			if (absolutePath.endsWith(".d.ts")) {
				continue;
			}

			// Prevent directory escape for security
			if (importPath.includes("../")) {
				log.warn("bundleService.security.escape", { entryPath, importPath });
				chunks.push(fullStatement); // Preserve original
				continue;
			}

			try {
				const inlined = await inlineAllImports(absolutePath, visited, projectRoot);
				if (inlined.trim()) {
					chunks.push(
						`// ---- Inlined ${absolutePath} ----\n${inlined}\n// ---- End Inlined ${absolutePath} ----\n`,
					);
				}
				// Note: We don't preserve the import/export statement since we've inlined the content
			} catch (e) {
				log.warn("bundleService.inline.miss", {
					entryPath,
					missing: absolutePath,
					error: (e as Error).message,
				});
				// Preserve original import/export if read failed (will likely error in sandbox, but we log)
				chunks.push(fullStatement);
			}
		} else {
			// External import (grammy, etc.) - preserve as-is for now
			// These will need to be available in the sandbox environment
			chunks.push(fullStatement);
		}
	}

	// Add remaining code after last import/export
	chunks.push(code.slice(lastIndex));

	return chunks.join("");
}

export async function bundleService(
	servicePath: string,
): Promise<{ dataUrl: string; code: string }> {
	try {
		const projectRoot = Deno.cwd();
		const svcMeta = await readFile(servicePath);
		const sdkSig = await computeSdkSig(projectRoot);
		const cacheKey = `${servicePath}::${sdkSig}`;
		const prev = cache.get(cacheKey);
		if (prev && prev.mtimeSvc === svcMeta.mtime && prev.sdkSig === sdkSig) {
			return { dataUrl: prev.url, code: prev.code };
		}

		// Start from the service file; inlining will pull in SDK via @sdk/ imports.
		const visited = new Set<string>();
		let inlinedService = await inlineAllImports(servicePath, visited, projectRoot);
		// If service forgot to import SDK, inject it explicitly.
		if (!inlinedService.includes("@sdk/mod.ts")) {
			inlinedService = `import \"@sdk/mod.ts\";\n${inlinedService}`;
		}

		// After inlining, strip ANY remaining import statements (they cannot
		// resolve from a data: URL and would cause "invalid URL: relative URL with a cannot-be-a-base base")
		// This is a safety net in case some imports weren't properly inlined.
		const importStripRegex =
			/^(?:\s*import\s+(?:type\s+)?(?:[^'";]+from\s+)?["'][^"']*["'];?\s*)$/gm;
		const sanitized = inlinedService.replace(importStripRegex, "");

		// Collapse multiple blank lines introduced by removals for neatness.
		const finalCode = sanitized.replace(/\n{3,}/g, "\n\n");

		// Encode as data URL
		const enc = new TextEncoder().encode(finalCode);
		let binary = "";
		for (const b of enc) binary += String.fromCharCode(b);
		const url = `data:application/typescript;base64,${btoa(binary)}`;

		cache.set(cacheKey, { url, code: finalCode, sdkSig, mtimeSvc: svcMeta.mtime });
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
	servicePath: string,
	hashFn: (code: string) => Promise<string>,
): Promise<{ bundleHash: string; dataUrl: string; code: string }> {
	const { code, dataUrl } = await bundleService(servicePath);
	const bundleHash = await hashFn(code);
	return { bundleHash, dataUrl, code };
}
