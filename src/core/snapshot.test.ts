// src/core/snapshot.test.ts
import { buildSnapshot } from "./snapshot.ts";

Deno.test("buildSnapshot returns an object", async () => {
  const snap = await buildSnapshot("123");
  if (typeof snap !== "object" || snap === null) {
    throw new Error("Snapshot should be a non-null object");
  }
});
