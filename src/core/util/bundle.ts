// src/core/util/bundle.ts
// Concatenate the SDK and a service source into one inline module (data URL) for
// maximum sandbox isolation (no filesystem reads inside sandbox execution).
// Handles @sdk imports by resolving them through deno.json import map and inlining dependencies.
// Also handles npm: imports for allowed packages.
import { log } from "@core/util/logger.ts";
import { isNpmPackageAllowed } from "@core/util/npm_allowlist.ts";

interface CacheEntry {
	url: string;
	code: string;
	sdkSig: string; // signature of sdk files (mtime aggregate)
	mtimeSvc: number; // service file mtime
	hasNpm?: boolean; // whether service uses npm packages
	tempFilePath?: string; // path to temp file for npm services
}
const cache = new Map<string, CacheEntry>();

// Temp file directory for npm service bundles
let npmBundleDir: string | null = null;
async function getNpmBundleDir(): Promise<string> {
	if (!npmBundleDir) {
		npmBundleDir = await Deno.makeTempDir({ prefix: "service_npm_bundles_" });
	}
	return npmBundleDir;
}

// Simple hash for cache keys
async function simpleHash(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

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
	if (importPath.startsWith("@eventky/")) {
		// Map @eventky/ -> ./packages/eventky-specs/
		return importPath.replace("@eventky/", "./packages/eventky-specs/");
	}
	if (importPath.startsWith("./") || importPath.startsWith("../")) {
		// Relative import - resolve relative to the importing file's directory
		const baseDir = basePath.substring(0, basePath.lastIndexOf("/"));
		let resolved = resolveRelativePath(baseDir, importPath);
		if (!resolved.endsWith(".ts")) resolved += ".ts";
		return resolved;
	}
	if (importPath.startsWith("/")) {
		// Absolute path - return as is (already resolved)
		let resolved = importPath;
		if (!resolved.endsWith(".ts")) resolved += ".ts";
		return resolved;
	}
	if (importPath.startsWith("npm:")) {
		// npm import - preserve as is, will be stripped later if not inlined
		return null;
	}
	return null; // External import - not handled by bundler
}

// Resolve a relative path (including ../) against a base directory
function resolveRelativePath(baseDir: string, relativePath: string): string {
	const isAbsolute = baseDir.startsWith("/");
	const parts = baseDir.split("/").filter(Boolean);
	const relParts = relativePath.split("/");
	for (const seg of relParts) {
		if (seg === "..") {
			parts.pop();
		} else if (seg !== "." && seg !== "") {
			parts.push(seg);
		}
	}
	const result = parts.join("/");
	// Absolute paths (from already-resolved entries) must keep their leading /
	if (isAbsolute) return "/" + result;
	// Preserve leading ./ for project-relative paths
	return result.startsWith("packages/") || result.startsWith("src/") ? "./" + result : result;
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

			// Prevent directory escape beyond project root
			if (!absolutePath.startsWith(`${projectRoot}/`)) {
				log.warn("bundleService.security.escape", { entryPath, importPath, absolutePath });
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

// Detect npm imports in code and validate against allowlist
function detectNpmImports(
	code: string,
): { hasNpm: boolean; packages: string[]; disallowed: string[] } {
	const npmImportRegex =
		/import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+["'](npm:[^"']+)["'];?/g;
	const packages: string[] = [];
	const disallowed: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = npmImportRegex.exec(code))) {
		const npmSpec = match[1];
		packages.push(npmSpec);
		if (!isNpmPackageAllowed(npmSpec)) {
			disallowed.push(npmSpec);
		}
	}

	return {
		hasNpm: packages.length > 0,
		packages,
		disallowed,
	};
}

// Bundle service using esbuild-wasm for services with npm dependencies
// This creates a single-file bundle with all dependencies inlined
async function bundleWithEsbuild(
	servicePath: string,
	projectRoot: string,
): Promise<string> {
	// Create a temporary entry file that imports the service
	const tempDir = await Deno.makeTempDir({ prefix: "service_bundle_" });

	try {
		// Resolve service path to absolute if relative
		const absoluteServicePath = servicePath.startsWith("./") || servicePath.startsWith("../")
			? `${projectRoot}/${servicePath.replace(/^\.\//, "")}`
			: servicePath;

		// Read the original service
		const originalCode = await Deno.readTextFile(absoluteServicePath);

		// Get the absolute directory of the service
		const serviceDir = absoluteServicePath.substring(0, absoluteServicePath.lastIndexOf("/"));

		// Resolve all @sdk/ and @eventky/ imports to absolute paths
		let processedCode = originalCode
			.replace(/"@sdk\//g, `"${projectRoot}/packages/sdk/`)
			.replace(/'@sdk\//g, `'${projectRoot}/packages/sdk/`)
			.replace(/"@eventky\//g, `"${projectRoot}/packages/eventky-specs/`)
			.replace(/'@eventky\//g, `'${projectRoot}/packages/eventky-specs/`);

		// Also resolve relative imports from the service directory to absolute paths
		processedCode = processedCode
			.replace(/from\s+"\.\/([^"]+)"/g, `from "${serviceDir}/$1"`)
			.replace(/from\s+'\.\/([^']+)'/g, `from '${serviceDir}/$1'`);

		const tempEntry = `${tempDir}/entry.ts`;
		await Deno.writeTextFile(tempEntry, processedCode);

		// Create deno.json for the temp directory with npm specifiers
		const denoConfig = {
			imports: {
				"@sdk/": `${projectRoot}/packages/sdk/`,
				"@eventky/": `${projectRoot}/packages/eventky-specs/`,
			},
		};
		await Deno.writeTextFile(`${tempDir}/deno.json`, JSON.stringify(denoConfig));

		// Use deno emit API or fall back to manual approach
		// For now, we'll use the deno vendor + concatenation approach

		// Step 1: Vendor the dependencies (minimal env to avoid ARG_MAX limit)
		const vendorCmd = new Deno.Command("deno", {
			args: ["cache", "--quiet", tempEntry],
			stdout: "piped",
			stderr: "piped",
			cwd: tempDir,
			env: {
				HOME: Deno.env.get("HOME") || "",
				PATH: Deno.env.get("PATH") || "",
				...(Deno.env.get("DENO_DIR") ? { DENO_DIR: Deno.env.get("DENO_DIR")! } : {}),
				...(Deno.env.get("XDG_CACHE_HOME")
					? { XDG_CACHE_HOME: Deno.env.get("XDG_CACHE_HOME")! }
					: {}),
			},
		});

		try {
			const vendorOutput = await vendorCmd.output();
			if (!vendorOutput.success) {
				const stderr = new TextDecoder().decode(vendorOutput.stderr);
				log.error("bundleService.cache.failed", { servicePath, stderr });
				// Continue anyway - cache might already exist, but sandbox will likely fail
			}
		} catch (e) {
			log.error("bundleService.cache.spawn", { servicePath, error: (e as Error).message });
			// Continue - inlining may still work without cache
		}

		// Step 2: Read the processed code and inline SDK manually
		const visited = new Set<string>();
		const inlined = await inlineAllImports(tempEntry, visited, projectRoot);

		return inlined;
	} finally {
		// Cleanup temp files
		try {
			await Deno.remove(tempDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

export interface BundleResult {
	/** Entry point for sandbox execution (data URL or file path) */
	entry: string;
	/** The bundled code */
	code: string;
	/** Whether this bundle uses npm packages (affects sandbox permissions) */
	hasNpm: boolean;
}

export async function bundleService(
	servicePath: string,
): Promise<BundleResult> {
	try {
		const projectRoot = Deno.cwd();
		const svcMeta = await readFile(servicePath);
		const sdkSig = await computeSdkSig(projectRoot);
		const cacheKey = `${servicePath}::${sdkSig}`;
		const prev = cache.get(cacheKey);
		if (prev && prev.mtimeSvc === svcMeta.mtime && prev.sdkSig === sdkSig) {
			return {
				entry: prev.url,
				code: prev.code,
				hasNpm: prev.hasNpm || false,
			};
		}

		// Check for npm imports in the service file
		const { hasNpm, disallowed } = detectNpmImports(svcMeta.code);

		if (disallowed.length > 0) {
			throw new Error(
				`Service uses disallowed npm packages: ${disallowed.join(", ")}. ` +
					`Only packages in the allowlist can be used.`,
			);
		}

		let finalCode: string;

		if (hasNpm) {
			// Use esbuild approach for services with npm dependencies
			log.info("bundleService.npm", { servicePath, strategy: "esbuild" });
			finalCode = await bundleWithEsbuild(servicePath, projectRoot);

			// For npm services, write to a temp file instead of data URL
			// because npm: imports don't work in data URLs
			const bundleDir = await getNpmBundleDir();
			const hash = await simpleHash(servicePath + sdkSig);
			const tempFilePath = `${bundleDir}/service_${hash}.ts`;
			await Deno.writeTextFile(tempFilePath, finalCode);

			cache.set(cacheKey, {
				url: tempFilePath,
				code: finalCode,
				sdkSig,
				mtimeSvc: svcMeta.mtime,
				hasNpm: true,
				tempFilePath,
			});
			return { entry: tempFilePath, code: finalCode, hasNpm: true };
		} else {
			// Use manual inlining for services without npm (faster)
			const visited = new Set<string>();
			let inlinedService = await inlineAllImports(servicePath, visited, projectRoot);

			// If service forgot to import SDK, inject it explicitly.
			if (!inlinedService.includes("@sdk/mod.ts")) {
				inlinedService = `import \"@sdk/mod.ts\";\n${inlinedService}`;
			}

			// After inlining, strip ANY remaining import statements (they cannot
			// resolve from a temp file and would cause module resolution errors)
			// This is a safety net in case some imports weren't properly inlined.
			const importStripRegex =
				/^(?:\s*import\s+(?:type\s+)?(?:[^'";]+from\s+)?["'][^"']*["'];?\s*)$/gm;
			const sanitized = inlinedService.replace(importStripRegex, "");

			// Collapse multiple blank lines introduced by removals for neatness.
			finalCode = sanitized.replace(/\n{3,}/g, "\n\n");

			// Write to temp file instead of data URL to avoid OS ARG_MAX limit
			const bundleDir = await getNpmBundleDir();
			const hash = await simpleHash(servicePath + sdkSig);
			const tempFilePath = `${bundleDir}/service_${hash}.ts`;
			await Deno.writeTextFile(tempFilePath, finalCode);

			cache.set(cacheKey, {
				url: tempFilePath,
				code: finalCode,
				sdkSig,
				mtimeSvc: svcMeta.mtime,
				hasNpm: false,
				tempFilePath,
			});
			return { entry: tempFilePath, code: finalCode, hasNpm: false };
		}
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
): Promise<{ bundleHash: string; entry: string; code: string; hasNpm: boolean }> {
	const { code, entry, hasNpm } = await bundleService(servicePath);
	const bundleHash = await hashFn(code);
	return { bundleHash, entry, code, hasNpm };
}

// Legacy compatibility - returns dataUrl field for backwards compatibility
export async function bundleServiceLegacy(
	servicePath: string,
): Promise<{ dataUrl: string; code: string }> {
	const result = await bundleService(servicePath);
	return { dataUrl: result.entry, code: result.code };
}
