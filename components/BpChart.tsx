import { shortDate } from "@/lib/format";

export type ChartPoint = {
  at: Date;
  sys: number;
  dia: number;
  pill?: boolean | null;
};

const W = 760;
const H = 252;
const PAD = { t: 14, r: 16, b: 28, l: 36 };
const Y_MIN = 55;
const Y_MAX = 195;

export function BpChart({
  points,
  target,
  now,
  windowDays = 21,
}: {
  points: ChartPoint[];
  target: { sys: number; dia: number };
  now: Date;
  windowDays?: number;
}) {
  const t1 = now.getTime();
  const t0 = t1 - windowDays * 86_400_000;

  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) =>
    PAD.t + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);

  const visible = points
    .filter((p) => p.at.getTime() >= t0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const line = (key: "sys" | "dia") =>
    visible
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.at.getTime()).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");

  const grid = [60, 90, 120, 150, 180];
  const missed = visible.filter((p) => p.pill === false);

  const ticks: number[] = [];
  for (let d = windowDays; d >= 0; d -= 7) ticks.push(t1 - d * 86_400_000);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Tension sur ${windowDays} jours — systolique et diastolique`}
      style={{ display: "block", height: "auto" }}
    >
      {/* target band */}
      <rect
        x={PAD.l}
        y={y(target.sys)}
        width={W - PAD.l - PAD.r}
        height={y(85) - y(target.sys)}
        fill="var(--gold)"
        opacity="0.1"
      />
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={y(target.sys)}
        y2={y(target.sys)}
        stroke="var(--gold-2)"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.85"
      />
      <text
        x={W - PAD.r - 2}
        y={y(target.sys) - 5}
        textAnchor="end"
        fontSize="8.5"
        letterSpacing="0.12em"
        fill="var(--gold)"
        style={{ textTransform: "uppercase", fontFamily: "var(--font-ui)" }}
      >
        CIBLE {target.sys}/{target.dia}
      </text>

      {/* grid */}
      {grid.map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--line)"
            strokeWidth="1"
            opacity={v === 120 ? 0.9 : 0.55}
          />
          <text
            x={PAD.l - 8}
            y={y(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill="var(--ink-3)"
            fontFamily="var(--font-ui)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {v}
          </text>
        </g>
      ))}

      {/* missed-pill markers */}
      {missed.map((p) => (
        <g key={`m-${p.at.getTime()}`}>
          <line
            x1={x(p.at.getTime())}
            x2={x(p.at.getTime())}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--crimson)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.3"
          />
          <path
            d={`M${x(p.at.getTime()) - 2.5} ${H - PAD.b + 3}h5`}
            stroke="var(--crimson)"
            strokeWidth="2"
            opacity="0.75"
          />
        </g>
      ))}

      {/* diastolic behind, systolic in front */}
      <path
        d={line("dia")}
        fill="none"
        stroke="var(--royal-3)"
        strokeWidth="1.4"
        strokeOpacity="0.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={line("sys")}
        fill="none"
        stroke="var(--royal)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {visible.map((p) => (
        <g key={p.at.getTime()}>
          <circle cx={x(p.at.getTime())} cy={y(p.sys)} r="2.4" fill="var(--royal)" />
          <circle cx={x(p.at.getTime())} cy={y(p.dia)} r="2" fill="var(--paper)" stroke="var(--royal-3)" strokeWidth="1.2" strokeOpacity="0.7" />
        </g>
      ))}

      {/* last value */}
      {visible.length > 0 && (
        <g>
          <circle
            cx={x(visible[visible.length - 1].at.getTime())}
            cy={y(visible[visible.length - 1].sys)}
            r="4"
            fill="none"
            stroke="var(--royal)"
            strokeWidth="1.2"
            opacity="0.45"
          />
        </g>
      )}

      {/* x axis */}
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={H - PAD.b}
        y2={H - PAD.b}
        stroke="var(--line-strong)"
        strokeWidth="1"
      />
      {ticks.map((t) => (
        <text
          key={t}
          x={x(t)}
          y={H - PAD.b + 15}
          textAnchor={t === t1 ? "end" : "middle"}
          fontSize="9"
          fill="var(--ink-3)"
          fontFamily="var(--font-ui)"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {shortDate(new Date(t))}
        </text>
      ))}
    </svg>
  );
}
