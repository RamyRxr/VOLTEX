import { CONFIG } from "@/lib/domain/config";
import type { BP } from "@/lib/domain/types";
import { t } from "@/lib/i18n";

export interface MiniPoint {
  readonly at: string;
  readonly sys: number;
  readonly dia: number;
}

const W = 330;
const H = 104;
const PAD = 6;

/** Patient home: last 7 days, target zone shaded. */
export function MiniChart({ points, target }: { points: readonly MiniPoint[]; target: BP }) {
  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden>
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--line-strong)" strokeDasharray="3 4" />
      </svg>
    );
  }

  const sorted = [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const values = [...sorted.flatMap((p) => [p.sys, p.dia]), target.sys, CONFIG.low.dia];
  const lo = Math.min(...values) - 6;
  const hi = Math.max(...values) + 6;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (sorted.length - 1);
  const y = (v: number) => PAD + (H - PAD * 2) * (1 - (v - lo) / (hi - lo));
  const path = (key: "sys" | "dia") => sorted.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const band = (top: number, bottom: number) => (
    <rect x={PAD} y={y(top)} width={W - PAD * 2} height={Math.max(0, y(bottom) - y(top))} fill="var(--gold-2)" opacity="0.14" />
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("phome.week")} style={{ display: "block" }}>
      {band(target.sys, CONFIG.low.sys)}
      {band(target.dia, CONFIG.low.dia)}
      <line x1={PAD} x2={W - PAD} y1={y(target.sys)} y2={y(target.sys)} stroke="var(--gold-2)" strokeDasharray="3 4" />
      <path d={path("dia")} fill="none" stroke="var(--royal-3)" strokeWidth="1.5" opacity="0.5" />
      <path d={path("sys")} fill="none" stroke="var(--royal)" strokeWidth="2" />
      {sorted.map((p, i) => (
        <circle key={`${p.at}-${i}`} cx={x(i)} cy={y(p.sys)} r="2.2" fill="var(--royal)" />
      ))}
    </svg>
  );
}
