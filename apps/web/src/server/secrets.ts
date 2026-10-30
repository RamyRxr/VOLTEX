/** Shared-secret helpers for machine callers (the cron job). */

export const MIN_SECRET_LENGTH = 32;

/** An env secret, only if long enough to resist guessing; otherwise null. */
export function strongSecret(name: "CRON_SECRET"): string | null {
  const value = process.env[name];
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

/** Constant-time comparison for shared secrets. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** "Bearer xyz" or a dedicated header. */
export function bearerOr(req: Request, header: string): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return req.headers.get(header);
}
