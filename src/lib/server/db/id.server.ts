import { randomBytes } from "node:crypto";

/**
 * Generate a short, prefix-tagged opaque id.
 *
 * Format: `${prefix}${16 random base36 chars}` — ≈80 bits of entropy from
 * `randomBytes(10)` (base36 encoded), enough for client-side row ids that
 * are not security-sensitive. The token generator uses a stronger path
 * (`randomBytes(12)` → 12 chars from a 32-char alphabet) in `functions.ts`.
 *
 * Prefixed ids stay human-readable in the DB and make accidental
 * cross-entity joins fail loudly in tests.
 */
export function uid(prefix = ""): string {
  // 10 random bytes → up to 20 base36 chars, slice to 16 for stable length.
  const random = randomBytes(10).toString("base64url").slice(0, 16);
  return prefix + random;
}
