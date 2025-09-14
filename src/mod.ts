// src/mod.ts
// Public barrel for external consumption (future): re-export selected APIs.
export * from "@/core/dispatch/mod.ts";
export * from "@/core/snapshot/mod.ts";
export * from "@/core/sandbox/mod.ts";
export * from "@/core/service_types.ts";
export * from "@core/util/utils.ts";
export * from "@core/util/logger.ts";
export * from "@/core/config.ts";
// Middleware exports (optional)
export { buildMiddleware } from "@middleware/router.ts";
