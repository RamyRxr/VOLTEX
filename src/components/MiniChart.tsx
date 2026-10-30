export type MiniPoint = { at: Date; sys: number; dia: number };

export function MiniChart({
  points,
  target,
}: {
  points: MiniPoint[];
  target: { sys: number; dia: number };
}) {
  const W = 330;
  const H = 96;
  const pad = 6;

  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden>
        <line
          x1={pad}
          x2={W - pad}
          y1={H / 2}
          y2={H / 2}
          stroke="var(--line-strong)"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const values = sorted.flatMap((p) => [p.sys, p.dia]);
  const lo = Math.min(...values) - 6;
  const hi = Math.max(...values) + 6;
  const span = hi - lo || 1;

  const x = (i: number) => pad + (i * (W - pad * 2)) / (sorted.length - 1);
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - lo) / span);

  const path = (key: "sys" | "dia") =>
    sorted
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Évolution récente de la tension"
      style={{ display: "block" }}
    >
      <rect
        x={pad}
        y={y(target.sys)}
        width={W - pad * 2}
        height={Math.max(0, y(target.dia) - y(target.sys))}
        fill="var(--gold-2)"
        opacity="0.12"
      />
      <line
        x1={pad}
        x2={W - pad}
        y1={y(target.sys)}
        y2={y(target.sys)}
        stroke="var(--gold-2)"
        strokeDasharray="3 4"
        opacity="0.8"
      />
      <path d={path("dia")} fill="none" stroke="var(--royal-3)" strokeWidth="1.5" opacity="0.45" />
      <path d={path("sys")} fill="none" stroke="var(--royal)" strokeWidth="2" />
      {sorted.map((p, i) => (
        <circle key={p.at.getTime()} cx={x(i)} cy={y(p.sys)} r="2" fill="var(--royal)" />
      ))}
    </svg>
  );
}
