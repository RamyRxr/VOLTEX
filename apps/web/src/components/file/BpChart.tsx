"use client";

import { CONFIG, type SessionDto } from "shared";
import { formatBp, formatDateTime, formatDayMonth } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import styles from "./file.module.css";

const W = 720;
const H = 260;
const PAD = { left: 40, right: 64, top: 14, bottom: 28 };
const DAY = 86_400_000;
const X_TICKS = 6;
const UNCONFIRMED = new Set(["SEVERE_PENDING", "SEVERE_NOT_CONFIRMED", "SEVERE_EXPIRED"]);

interface Scale {
  readonly x: (t: number) => number;
  readonly y: (v: number) => number;
}

function scaleFor(from: number, to: number, yMin: number, yMax: number): Scale {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return {
    x: (t) => PAD.left + ((t - from) / (to - from)) * innerW,
    y: (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH,
  };
}

const linePath = (points: readonly [number, number][]): string =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function Threshold({ s, value, label, tone }: { s: Scale; value: number; label: string; tone: "warning" | "danger" }) {
  const y = s.y(value);
  return (
    <g className={styles[`threshold-${tone}`]}>
      <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} strokeDasharray="5 4" />
      <text x={W - PAD.right + 6} y={y + 4}>
        {label}
      </text>
    </g>
  );
}

/**
 * Systolic and diastolic over the chosen range, with the 140/90 and 160/110
 * lines. Unconfirmed severe readings are hollow and kept off the lines (spec §6.2).
 */
export function BpChart({ sessions, days, now }: { sessions: readonly SessionDto[]; days: number; now: Date }) {
  const to = now.getTime();
  const from = to - days * DAY;
  const inRange = sessions
    .filter((s) => new Date(s.takenAt).getTime() >= from)
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  if (inRange.length === 0) return <p className="empty">{fr.file.noReadings}</p>;

  const { hypertension, severe } = CONFIG.bp;
  const yMax = Math.max(severe.sys + 20, ...inRange.map((s) => s.sys + 10));
  const yMin = Math.min(50, ...inRange.map((s) => s.dia - 10));
  const s = scaleFor(from, to, yMin, yMax);
  const valid = inRange.filter((x) => !UNCONFIRMED.has(x.status));
  const unconfirmed = inRange.filter((x) => UNCONFIRMED.has(x.status));
  const t = (x: SessionDto) => new Date(x.takenAt).getTime();
  const ticks = Array.from({ length: X_TICKS }, (_, i) => from + ((to - from) * i) / (X_TICKS - 1));
  const gridValues = [60, 80, 100, 120, 140, 160, 180].filter((v) => v > yMin && v < yMax);
  const latest = inRange[inRange.length - 1];

  return (
    <figure className={styles.chart}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${fr.file.chart} : ${inRange.length} mesures${latest ? `, dernière ${formatBp(latest)}` : ""}`}
      >
        <g className={styles.grid}>
          {gridValues.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={s.y(v)} y2={s.y(v)} />
              <text x={PAD.left - 8} y={s.y(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {ticks.map((tick) => (
            <text key={tick} x={s.x(tick)} y={H - 8} textAnchor="middle">
              {formatDayMonth(new Date(tick))}
            </text>
          ))}
        </g>

        <Threshold s={s} value={severe.sys} label={`${severe.sys}`} tone="danger" />
        <Threshold s={s} value={hypertension.sys} label={`${hypertension.sys}`} tone="warning" />
        <Threshold s={s} value={severe.dia} label={`${severe.dia}`} tone="danger" />
        <Threshold s={s} value={hypertension.dia} label={`${hypertension.dia}`} tone="warning" />

        <path className={styles.lineDia} d={linePath(valid.map((x) => [s.x(t(x)), s.y(x.dia)]))} />
        <path className={styles.lineSys} d={linePath(valid.map((x) => [s.x(t(x)), s.y(x.sys)]))} />

        {valid.map((x) => (
          <g key={x.id}>
            <circle className={styles.dotDia} cx={s.x(t(x))} cy={s.y(x.dia)} r={2.6} />
            <circle className={styles.dotSys} cx={s.x(t(x))} cy={s.y(x.sys)} r={3.2}>
              <title>{`${formatDateTime(x.takenAt)} — ${formatBp(x)}`}</title>
            </circle>
          </g>
        ))}
        {unconfirmed.map((x) => (
          <g key={x.id} className={styles.dotUnconfirmed}>
            <circle cx={s.x(t(x))} cy={s.y(x.sys)} r={6} />
            <circle cx={s.x(t(x))} cy={s.y(x.dia)} r={4} />
            <title>{`${formatDateTime(x.takenAt)} — ${formatBp(x)} (${fr.session[x.status]})`}</title>
          </g>
        ))}
      </svg>
      <figcaption className={styles.legend}>
        <span>
          <i className={styles.keySys} aria-hidden /> {fr.file.chartLegend.sys}
        </span>
        <span>
          <i className={styles.keyDia} aria-hidden /> {fr.file.chartLegend.dia}
        </span>
        <span>
          <i className={styles.keyWarning} aria-hidden /> {fr.file.chartLegend.hyper}
        </span>
        <span>
          <i className={styles.keyDanger} aria-hidden /> {fr.file.chartLegend.severe}
        </span>
        <span>
          <i className={styles.keyUnconfirmed} aria-hidden /> {fr.file.chartLegend.unconfirmed}
        </span>
      </figcaption>
    </figure>
  );
}
