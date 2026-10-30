/**
 * Fixed-window rate limiter, in process (like the demo store). With several
 * server instances, back it with Redis/Upstash instead; callers do not change.
 */
interface Window {
  readonly count: number;
  readonly resetAt: number;
}

const MAX_TRACKED_KEYS = 10_000;
const windows = new Map<string, Window>();

function pruneExpired(now: number): void {
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}

/** True while `key` has made at most `max` calls in the current window. */
export function allow(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  const current = windows.get(key);
  if (!current && windows.size >= MAX_TRACKED_KEYS) pruneExpired(now);
  const next: Window =
    !current || current.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { count: current.count + 1, resetAt: current.resetAt };
  windows.set(key, next);
  return next.count <= max;
}

/** Best-effort client address (first hop of X-Forwarded-For on Vercel). */
export function clientAddress(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
}

const MINUTE = 60_000;

/** Limits per caller. Generous for real use and rehearsals, tight against scripted floods. */
export const LIMITS = {
  auth: { max: 20, windowMs: MINUTE },
  register: { max: 5, windowMs: 10 * MINUTE },
  session: { max: 12, windowMs: MINUTE },
  message: { max: 20, windowMs: MINUTE },
  simulator: { max: 30, windowMs: MINUTE },
} as const;
