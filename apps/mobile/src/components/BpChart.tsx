import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";
import { CONFIG } from "shared";
import type { SessionDto as BpSession } from "shared";
import { colors } from "@/theme";

interface Props {
  readonly sessions: readonly BpSession[];
  readonly days: number;
  readonly now: Date;
  readonly accessibilityLabel: string;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 34, bottom: 22, left: 8 };
const DAY = 24 * 60 * 60 * 1000;
const DIA_COLOR = "#8C98E3";
const FONT = Platform.select({ web: "system-ui, -apple-system, sans-serif", default: undefined });

/** Systolic and diastolic over time, with the 140/90 and 160/110 lines from CONFIG. */
export function BpChart({ sessions, days, now, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const { hypertension, severe } = CONFIG.bp;

  const values = sessions.flatMap((s) => [s.sys, s.dia]);
  const yMin = Math.floor(Math.min(60, ...values) / 10) * 10;
  const yMax = Math.ceil(Math.max(severe.sys + 10, ...values) / 10) * 10;
  const xMin = now.getTime() - days * DAY;
  const xMax = now.getTime();

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (iso: string) => PAD.left + ((new Date(iso).getTime() - xMin) / (xMax - xMin)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const limits = [
    { value: severe.sys, color: colors.danger },
    { value: hypertension.sys, color: colors.high },
    { value: severe.dia, color: colors.danger },
    { value: hypertension.dia, color: colors.high },
  ];

  const dotColor = (s: BpSession) =>
    s.status.startsWith("SEVERE") ? colors.danger : s.status === "HYPERTENSIVE" ? colors.high : colors.accent;
  const unconfirmed = (s: BpSession) => s.status === "SEVERE_PENDING" || s.status === "SEVERE_NOT_CONFIRMED" || s.status === "SEVERE_EXPIRED";

  const ticks = [0, Math.round(days / 2), days].map((d) => new Date(xMax - d * DAY));

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {limits.map((l) => (
            <G key={l.value}>
              <Line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(l.value)}
                y2={y(l.value)}
                stroke={l.color}
                strokeWidth={1.2}
                strokeDasharray="5 5"
                opacity={0.8}
              />
              <SvgText x={width - 2} y={y(l.value) + 4} fontSize={11} fontFamily={FONT} fill={l.color} textAnchor="end" fontWeight="600">
                {l.value}
              </SvgText>
            </G>
          ))}
          {ticks.map((d, i) => (
            <SvgText
              key={i}
              x={i === 0 ? PAD.left + plotW : i === 2 ? PAD.left : PAD.left + plotW / 2}
              y={HEIGHT - 4}
              fontSize={11}
              fontFamily={FONT}
              fill={colors.textSubtle}
              textAnchor={i === 0 ? "end" : i === 2 ? "start" : "middle"}
            >
              {d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </SvgText>
          ))}
          <Polyline
            points={sessions.map((s) => `${x(s.takenAt)},${y(s.dia)}`).join(" ")}
            fill="none"
            stroke={DIA_COLOR}
            strokeWidth={2}
          />
          <Polyline
            points={sessions.map((s) => `${x(s.takenAt)},${y(s.sys)}`).join(" ")}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2.5}
          />
          {sessions.map((s) => (
            <G key={s.id}>
              <Circle cx={x(s.takenAt)} cy={y(s.dia)} r={3} fill={DIA_COLOR} />
              <Circle
                cx={x(s.takenAt)}
                cy={y(s.sys)}
                r={unconfirmed(s) ? 5 : 3.5}
                fill={unconfirmed(s) ? colors.surface : dotColor(s)}
                stroke={dotColor(s)}
                strokeWidth={unconfirmed(s) ? 2 : 0}
              />
            </G>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

export const CHART_COLORS = { sys: colors.accent, dia: DIA_COLOR };

const styles = StyleSheet.create({
  wrap: { height: HEIGHT, width: "100%" },
});
