import { createHash, timingSafeEqual } from "node:crypto";

// Constant-time comparison that is also length-independent: hashing both inputs
// to a fixed-size digest avoids leaking the secret's length and prevents the
// early-exit timing signal of `===` on the scanner ingest token.
export function secretsMatch(received: string, expected: string): boolean {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}
