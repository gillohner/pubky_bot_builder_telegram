// src/core/snapshot/snapshot.ts
// Moved from src/core/snapshot.ts (initial refactor; mock services kept inline for now)
import { log } from "@core/util/logger.ts";
import { bundleAndHash } from "@core/util/bundle.ts";
import {
	deleteBundle,
	getChatConfig,
	getServiceBundle,
	listAllBundleHashes,
	listReferencedBundleHashes,
	loadSnapshotByConfigHash,
	saveServiceBundle,
	saveSnapshotByConfigHash,
	sha256Hex,
} from "@core/config/store.ts";
import { fetchPubkyConfig } from "@core/pubky/pubky.ts";
import { CONFIG } from "../config.ts";
import type { CommandRoute, ListenerRoute, RouteMeta, RoutingSnapshot } from "@schema/routing.ts";
// Minimal path helpers (avoid adding external std dependency in snapshot path resolution)
function fromFileUrl(u: URL): string {
	if (u.protocol !== "file:") throw new TypeError("Must be file URL");
	return decodeURIComponent(u.pathname);
}
function dirname(p: string): string {
	const idx = p.lastIndexOf("/");
	return idx <= 0 ? "/" : p.slice(0, idx);
}
function join(...parts: string[]): string {
	return parts
		.filter((p) => p.length > 0)
		.join("/")
		.replace(/\/+/g, "/");
}

const SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_TTL_MS = 10_000;
interface CacheEntry {
	snapshot: RoutingSnapshot;
	expires: number;
}
const snapshotCache = new Map<string, CacheEntry>();

export async function buildSnapshot(
	chatId: string,
	opts?: { force?: boolean },
): Promise<RoutingSnapshot> {
	const now = Date.now();
	// Determine current config id first (needed for cache key validation)
	let configId = CONFIG.defaultTemplateId; // TODO: Allow different default configs for DMs vs groups in env.
	const existingConfig = getChatConfig(chatId);
	if (existingConfig) configId = existingConfig.config_id;
	// For now config hash is hash of configId only (later: hash full template JSON)
	const configHash = await sha256Hex(configId);

	// 1. In-memory cache (unless force) - also verify cached snapshot matches current configHash
	if (!opts?.force) {
		const cached = snapshotCache.get(chatId);
		if (cached && cached.expires > now && cached.snapshot.configHash === configHash) {
			return cached.snapshot;
		}
	}

	// 2. Persistent snapshot keyed by current config hash (unless force)
	if (!opts?.force) {
		const persisted = loadSnapshotByConfigHash(configHash);
		if (persisted) {
			try {
				const snap = JSON.parse(persisted.snapshot_json) as RoutingSnapshot;
				if (
					snap.version === SNAPSHOT_SCHEMA_VERSION && typeof snap.builtAt === "number" &&
					snap.configHash === configHash
				) {
					// Optional: verify integrity if present
					if (snap.integrity) {
						const calc = await sha256Hex(
							JSON.stringify({ ...snap, integrity: undefined }),
						);
						if (calc !== snap.integrity) {
							log.warn("snapshot.integrity.mismatch", { chatId, configHash });
						} else {
							snapshotCache.set(chatId, { snapshot: snap, expires: now + SNAPSHOT_TTL_MS });
							return snap;
						}
					} else {
						snapshotCache.set(chatId, { snapshot: snap, expires: now + SNAPSHOT_TTL_MS });
						return snap;
					}
				}
			} catch (err) {
				log.warn("snapshot.persisted.parse_error", { error: (err as Error).message });
			}
		}
	}

	// 3. Build from config template (or fallback default template)
	let template;
	try {
		template = fetchPubkyConfig(configId);
	} catch (_err) {
		// fallback to default
		template = fetchPubkyConfig("default");
	}

	const serviceFiles = [...template.services, ...template.listeners].map((s) => s.entry);
	// Build or reuse bundles (content-addressed). Store each if new.
	const built = await Promise.all(serviceFiles.map((p) =>
		bundleAndHash(
			p,
			async (code) => await sha256Hex(code),
		)
	));
	// Persist bundles if not present.
	for (const b of built) {
		const existing = getServiceBundle(b.bundleHash);
		if (!existing) {
			saveServiceBundle({
				bundle_hash: b.bundleHash,
				data_url: b.dataUrl,
				code: b.code,
				created_at: Date.now(),
			});
		}
	}
	const commandRoutes: Record<string, CommandRoute> = {};
	let idx = 0;

	// Discover datasets for a service path: looks for sibling folder "datasets" containing *.json
	async function loadDatasets(entry: string): Promise<Record<string, unknown> | undefined> {
		try {
			// Resolve filesystem path for entry (it may be a relative path within repo)
			const url = new URL(entry, import.meta.url);
			const fsPath = fromFileUrl(url);
			const baseDir = dirname(fsPath);
			const datasetDir = join(baseDir, "datasets");
			const entries: Deno.DirEntry[] = [];
			try {
				for await (const de of Deno.readDir(datasetDir)) entries.push(de);
			} catch (_e) {
				return undefined; // no datasets dir
			}
			const out: Record<string, unknown> = {};
			for (const de of entries) {
				if (!de.isFile || !de.name.endsWith(".json")) continue;
				const name = de.name.slice(0, -5); // strip .json
				try {
					const txt = await Deno.readTextFile(join(datasetDir, de.name));
					out[name] = JSON.parse(txt);
				} catch (err) {
					log.warn("dataset.load.error", { entry, file: de.name, error: (err as Error).message });
				}
			}
			return Object.keys(out).length ? out : undefined;
		} catch (_err) {
			return undefined;
		}
	}
	// Helper to dynamically import a service module and extract manifest
	async function loadMeta(entry: string, command: string): Promise<RouteMeta> {
		try {
			// Use cache bust to avoid stale during dev snapshot rebuilds
			const mod = await import(`${entry}?metaBust=${crypto.randomUUID()}`);
			const svc = mod.default as {
				manifest?: { id: string; command: string; description?: string };
			};
			if (svc?.manifest?.id) {
				const PLACEHOLDER = "__runtime__";
				return {
					id: svc.manifest.id === PLACEHOLDER ? `mock_${command}` : svc.manifest.id,
					command: svc.manifest.command === PLACEHOLDER
						? command
						: (svc.manifest.command || command),
					description: svc.manifest.description === PLACEHOLDER
						? undefined
						: svc.manifest.description,
				};
			}
		} catch (_err) {
			// Fallback below
		}
		return { id: `mock_${command}`, command };
	}

	for (const svc of template.services) {
		const bundle = built[idx++];
		const meta = await loadMeta(svc.entry, svc.command);
		// Local file-based datasets (developer convenience)
		const datasetsLocal = await loadDatasets(svc.entry) || {};
		// Pubky referenced datasets from service config (mapping name -> pubky:// URL)
		const configDatasetsRaw = (svc.config?.datasets as Record<string, unknown> | undefined) || {};
		for (const [k, v] of Object.entries(configDatasetsRaw)) {
			if (typeof v === "string" && v.startsWith("pubky://")) {
				// Normalize: remove trailing .json if present
				const norm = v.replace(/\.json$/i, "");
				// Store placeholder; resolution layer (future) will fetch & cache. For now mark unresolved.
				datasetsLocal[k] = { __pubkyRef: norm };
			}
		}
		const datasets = Object.keys(datasetsLocal).length ? datasetsLocal : undefined;
		commandRoutes[svc.command] = {
			serviceId: meta.id,
			kind: svc.kind === "command_flow" ? "command_flow" : "single_command",
			bundleHash: bundle.bundleHash,
			config: svc.config,
			meta,
			datasets,
			// datasets placeholder (future resolution): service-level datasets can be attached here
		};
	}
	const listenerRoutes: ListenerRoute[] = [];
	for (const l of template.listeners) {
		const bundle = built[idx++];
		const meta = await loadMeta(l.entry, l.command);
		listenerRoutes.push({
			serviceId: meta.id,
			kind: "listener",
			bundleHash: bundle.bundleHash,
			meta,
		});
	}

	const baseSnapshot: RoutingSnapshot = {
		commands: commandRoutes,
		listeners: listenerRoutes,
		builtAt: now,
		version: SNAPSHOT_SCHEMA_VERSION,
		sdkSchemaVersion: 1,
		sourceSig: await sha256Hex(built.map((b) => b.bundleHash).sort().join("|")),
		configHash,
	};
	const integrity = await sha256Hex(
		JSON.stringify({ ...baseSnapshot, integrity: undefined }),
	);
	const snapshot: RoutingSnapshot = { ...baseSnapshot, integrity };
	// 4. Persist by config hash
	saveSnapshotByConfigHash(configHash, snapshot);
	// 5. Memory cache (replace any prior snapshot for chatId)
	snapshotCache.set(chatId, { snapshot, expires: now + SNAPSHOT_TTL_MS });
	log.debug("snapshot.build", {
		chatId,
		commands: Object.keys(snapshot.commands).length,
		listeners: snapshot.listeners.length,
		configId,
	});
	return snapshot; // final return
}

// (Flow & survey examples now external in example_services folder)

// Garbage collect orphan service bundles not referenced by any snapshot.
export function gcOrphanBundles(): { deleted: string[]; kept: string[] } {
	const referenced = listReferencedBundleHashes();
	const all = listAllBundleHashes();
	const deleted: string[] = [];
	const kept: string[] = [];
	for (const h of all) {
		if (!referenced.has(h)) {
			deleteBundle(h);
			deleted.push(h);
		} else kept.push(h);
	}
	return { deleted, kept };
}
