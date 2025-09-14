// src/core/util/data_url.ts
// Helper to read a local TypeScript file and convert to a sandboxable data URL.
// Caches encoded content by file path + mtime to avoid repeated base64 work.
import { log } from "./logger.ts";

interface CacheEntry {
  url: string;
  mtime: number;
}
const cache = new Map<string, CacheEntry>();

export async function fileToDataUrl(path: string): Promise<string> {
  try {
    const info = await Deno.stat(path);
    if (!info.isFile) throw new Error("not a file");
    const prev = cache.get(path);
    if (prev && prev.mtime === info.mtime?.getTime()) return prev.url;
    const code = await Deno.readTextFile(path);
    // Ensure Unicode safe base64 (btoa expects Latin1)
    const bin = new TextEncoder().encode(code);
    let binary = "";
    for (const b of bin) binary += String.fromCharCode(b);
    const url = `data:application/typescript;base64,${btoa(binary)}`;
    cache.set(path, { url, mtime: info.mtime?.getTime() ?? Date.now() });
    return url;
  } catch (err) {
    log.error("fileToDataUrl.error", { path, error: (err as Error).message });
    throw err;
  }
}

export function clearDataUrlCache() {
  cache.clear();
}
