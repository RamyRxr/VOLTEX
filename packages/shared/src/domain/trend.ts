import { CONFIG } from "./config";
import { validNewestFirst } from "./sessions";
import { DAY, type SessionRecord } from "./types";

export interface TrendResult {
  /** Systolic slope in mmHg per week (unrounded). */
  readonly perWeek: number;
  readonly points: number;
  /** Slope ≥ CONFIG.trend.minSlopeSysPerWeek. */
  readonly rising: boolean;
}

/** Ordinary least squares slope of y over x. */
export function slope(points: readonly { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const sxy = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return sxx === 0 ? 0 : sxy / sxx;
}

/** Linear regression of systolic on valid sessions over the last 14 days (≥ 5 sessions). */
export function computeTrend(sessions: readonly SessionRecord[], now: Date): TrendResult | null {
  const from = now.getTime() - CONFIG.trend.windowDays * DAY;
  const window = validNewestFirst(sessions, now).filter((s) => s.takenAt.getTime() > from);
  if (window.length < CONFIG.trend.minSessions) return null;
  const perWeek = slope(window.map((s) => ({ x: (s.takenAt.getTime() - now.getTime()) / DAY, y: s.sys }))) * 7;
  return { perWeek, points: window.length, rising: perWeek >= CONFIG.trend.minSlopeSysPerWeek };
}
