// src/core/utils.ts
// Pure utility helpers (no side effects) for normalization, validation and
// deterministic callback data construction / parsing.

// Normalize a user-entered command string: strip leading '/', trim whitespace,
// lower-case. Returns empty string if nothing remains.
export function normalizeCommand(raw: string): string {
  return raw.replace(/^\//, "").trim().toLowerCase();
}

// Decide if text looks like a bot command (leading '/'); does not validate
// against a known command list.
export function isBotCommand(text: string): boolean {
  return /^\//.test(text.trim());
}

// Build a compact callback data string with a fixed prefix for routing. This
// keeps us deterministic and avoids accidental collisions with other data used
// by Telegram clients. Format: <prefix>:<version>:<payloadBase64>
// The payload is JSON-stringified then base64url encoded (no padding).
export function buildCallbackData(
  prefix: string,
  version: number,
  payload: unknown
): string {
  const json = JSON.stringify(payload);
  const b64 = base64UrlEncode(json);
  return `${prefix}:${version}:${b64}`;
}

// Parse callback data produced by buildCallbackData. Returns null if parsing
// fails or the prefix/version mismatch (caller can decide on fallback).
export function parseCallbackData<T = unknown>(
  data: string,
  expectedPrefix: string,
  expectedVersion: number
): T | null {
  const parts = data.split(":");
  if (parts.length !== 3) return null;
  const [pfx, verStr, b64] = parts;
  if (pfx !== expectedPrefix) return null;
  const ver = Number(verStr);
  if (!Number.isInteger(ver) || ver !== expectedVersion) return null;
  try {
    const json = base64UrlDecode(b64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// Internal: base64url encode / decode (RFC 4648 §5) using std btoa/atob.
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(str: string): string {
  // restore padding
  const pad = str.length % 4 === 2 ? "==" : str.length % 4 === 3 ? "=" : "";
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}
