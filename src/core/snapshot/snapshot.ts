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
import type { CommandRoute, ListenerRoute, RoutingSnapshot } from "@schema/routing.ts";

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
	// 1. In-memory cache (unless force)
	if (!opts?.force) {
		const cached = snapshotCache.get(chatId);
		if (cached && cached.expires > now) return cached.snapshot;
	}

	// Determine config hash (after reading chat config or default template id)
	let configId = CONFIG.defaultTemplateId;
	const existingConfig = getChatConfig(chatId);
	if (existingConfig) configId = existingConfig.config_id;
	// For now config hash is hash of configId only (later: full resolved template JSON)
	const configHash = await sha256Hex(configId);

	// 2. Persistent snapshot keyed by config hash (unless force)
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
	for (const svc of template.services) {
		const bundle = built[idx++];
		commandRoutes[svc.command] = {
			serviceId: `mock_${svc.command}`,
			kind: svc.kind === "command_flow" ? "command_flow" : "single_command",
			bundleHash: bundle.bundleHash,
			config: svc.config,
		};
	}
	const listenerRoutes: ListenerRoute[] = [];
	for (const l of template.listeners) {
		const bundle = built[idx++];
		listenerRoutes.push({
			serviceId: `mock_${l.command}`,
			kind: "listener",
			bundleHash: bundle.bundleHash,
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
	// 5. Memory cache
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
