import { CONFIG } from "./config";
import { sessionsWithinDays } from "./session";
import type { BP, DomainSession } from "./types";

const DAY = 86_400_000;

export interface TrendResult {
  /** Systolic slope in mmHg per week (unrounded). */
  readonly perWeek: number;
  readonly points: number;
  readonly direction: "up" | "down" | "flat";
  /** Slope ≥ CONFIG.trend.minSlopePerWeek: the YELLOW trend rule fires. */
  readonly rising: boolean;
  /** Days until the 7-day average reaches the target at this slope; null if already there. */
  readonly daysToTarget: number | null;
}

/** Ordinary least squares slope of y over x. */
export function slope(points: readonly { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
  }
  return sxx === 0 ? 0 : sxy / sxx;
}

/**
 * Linear regression of systolic over the last 14 days of valid sessions,
 * projected forward to the patient's target.
 */
export function computeTrend(
  valid: readonly DomainSession[],
  now: Date,
  target: BP,
  avg7Sys: number | null,
): TrendResult | null {
  const window = sessionsWithinDays(valid, now, CONFIG.trend.windowDays);
  if (window.length < CONFIG.trend.minSessions) return null;

  const pts = window.map((s) => ({ x: (s.startedAt.getTime() - now.getTime()) / DAY, y: s.avgSys }));
  const perDay = slope(pts);
  const perWeek = perDay * 7;
  const min = CONFIG.trend.minSlopePerWeek;
  const rising = perWeek >= min;

  let daysToTarget: number | null = null;
  if (rising && avg7Sys != null && avg7Sys < target.sys) {
    daysToTarget = Math.max(1, Math.round((target.sys - avg7Sys) / perDay));
  }

  return {
    perWeek,
    points: window.length,
    direction: rising ? "up" : perWeek <= -min ? "down" : "flat",
    rising,
    daysToTarget,
  };
}
