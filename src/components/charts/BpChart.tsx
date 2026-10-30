import { CONFIG } from "@/lib/domain/config";
import { isValidForStats } from "@/lib/domain/session";
import type { BP } from "@/lib/domain/types";
import { shortDate } from "@/lib/format";
import { bpText, t } from "@/lib/i18n";
import type { SessionDto } from "@/lib/services/views";

const W = 760;
const H = 260;
const PAD = { t: 16, r: 16, b: 30, l: 36 };
const DAY = 86_400_000;

interface BpChartProps {
  readonly sessions: readonly SessionDto[];
  readonly target: BP;
  /** ISO time the data was computed: the chart's right edge. */
  readonly now: string;
  readonly windowDays?: number;
}

/**
 * Systolic and diastolic over time, target zones shaded, with missed pills,
 * symptoms and unconfirmed sessions marked on the timeline (CLAUDE.md §4.2).
 */
export function BpChart({ sessions, target, now, windowDays = 21 }: BpChartProps) {
  const t1 = Date.parse(now);
  const t0 = t1 - windowDays * DAY;
  const inWindow = sessions.filter((s) => Date.parse(s.startedAt) >= t0 && Date.parse(s.startedAt) <= t1);
  const valid = inWindow.filter(isValidForStats);
  const unconfirmed = inWindow.filter((s) => !isValidForStats(s));

  const maxSys = Math.max(target.sys, ...inWindow.map((s) => s.avgSys));
  const minDia = Math.min(CONFIG.low.dia, ...inWindow.map((s) => s.avgDia));
  const yMax = Math.ceil((maxSys + 10) / 10) * 10;
  const yMin = Math.floor((minDia - 10) / 10) * 10;

  const x = (iso: string | number) => {
    const ms = typeof iso === "number" ? iso : Date.parse(iso);
    return PAD.l + ((ms - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  };
  const y = (v: number) => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const line = (key: "avgSys" | "avgDia") =>
    valid.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.startedAt).toFixed(1)} ${y(s[key]).toFixed(1)}`).join(" ");

  const grid: number[] = [];
  for (let v = Math.ceil(yMin / 30) * 30; v <= yMax; v += 30) grid.push(v);
  const ticks = Array.from({ length: Math.floor(windowDays / 7) + 1 }, (_, i) => t1 - (windowDays - i * 7) * DAY);
  const band = (top: number, bottom: number, key: string) => (
    <rect key={key} x={PAD.l} y={y(top)} width={W - PAD.l - PAD.r} height={Math.max(0, y(bottom) - y(top))} fill="var(--gold-2)" opacity="0.13" />
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("chart.label", { days: windowDays })} className="bp-chart">
      {band(target.sys, CONFIG.low.sys, "sys")}
      {band(target.dia, CONFIG.low.dia, "dia")}
      {[target.sys, target.dia].map((v) => (
        <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--gold-2)" strokeDasharray="4 4" opacity="0.9" />
      ))}
      <text x={W - PAD.r - 2} y={y(target.sys) - 5} textAnchor="end" className="bp-chart__label" fill="var(--gold)">
        {t("chart.target", { bp: bpText(target) })}
      </text>

      {grid.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--line)" opacity="0.6" />
          <text x={PAD.l - 8} y={y(v) + 3} textAnchor="end" className="bp-chart__tick">
            {v}
          </text>
        </g>
      ))}

      {valid
        .filter((s) => s.pillStatus === "MISSED")
        .map((s) => (
          <g key={`pill-${s.id}`}>
            <line x1={x(s.startedAt)} x2={x(s.startedAt)} y1={PAD.t} y2={H - PAD.b} stroke="var(--crimson)" strokeDasharray="2 4" opacity="0.28" />
            <path d={`M${x(s.startedAt) - 3} ${H - PAD.b + 4}h6`} stroke="var(--crimson)" strokeWidth="2" opacity="0.8" />
          </g>
        ))}

      <path d={line("avgDia")} fill="none" stroke="var(--royal-3)" strokeWidth="1.4" strokeOpacity="0.55" strokeLinejoin="round" />
      <path d={line("avgSys")} fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinejoin="round" />

      {valid.map((s) => (
        <g key={s.id}>
          <circle cx={x(s.startedAt)} cy={y(s.avgSys)} r={s.status === "DANGER" ? 4 : 2.4} fill={s.status === "DANGER" ? "var(--crimson)" : "var(--royal)"} />
          <circle cx={x(s.startedAt)} cy={y(s.avgDia)} r="2" fill="var(--paper)" stroke="var(--royal-3)" strokeWidth="1.2" />
          {s.symptoms.length > 0 && (
            <path d={`M${x(s.startedAt)} ${PAD.t - 2}l3 3-3 3-3-3Z`} fill={s.status === "DANGER" ? "var(--crimson)" : "var(--ochre)"} />
          )}
        </g>
      ))}

      {unconfirmed.map((s) => (
        <g key={`u-${s.id}`}>
          <circle cx={x(s.startedAt)} cy={y(s.avgSys)} r="3.6" fill="var(--paper)" stroke="var(--crimson)" strokeWidth="1.3" strokeDasharray="2 1.5" />
          <circle cx={x(s.startedAt)} cy={y(s.avgDia)} r="3" fill="var(--paper)" stroke="var(--crimson)" strokeWidth="1.1" strokeDasharray="2 1.5" />
        </g>
      ))}

      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--line-strong)" />
      {ticks.map((tick, i) => (
        <text key={tick} x={x(tick)} y={H - PAD.b + 17} textAnchor={i === ticks.length - 1 ? "end" : "middle"} className="bp-chart__tick">
          {shortDate(new Date(tick))}
        </text>
      ))}
    </svg>
  );
}

export function ChartLegend() {
  return (
    <div className="legend">
      <span className="legend__key">
        <i className="legend__swatch" aria-hidden /> {t("legend.sys")}
      </span>
      <span className="legend__key">
        <i className="legend__swatch legend__swatch--dia" aria-hidden /> {t("legend.dia")}
      </span>
      <span className="legend__key">
        <i className="legend__swatch legend__swatch--band" aria-hidden /> {t("legend.band")}
      </span>
      <span className="legend__key">
        <i className="legend__swatch legend__swatch--missed" aria-hidden /> {t("legend.missed")}
      </span>
      <span className="legend__key">
        <i className="legend__swatch legend__swatch--symptom" aria-hidden /> {t("legend.symptom")}
      </span>
      <span className="legend__key">
        <i className="legend__swatch legend__swatch--unconfirmed" aria-hidden /> {t("legend.unconfirmed")}
      </span>
    </div>
  );
}
