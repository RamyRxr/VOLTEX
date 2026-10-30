/**
 * TensioCare mobile — calm, high-contrast, large type.
 * One accent colour (indigo) for actions; status colours are reserved for health states
 * and always come with an icon and a word (spec rule 12).
 */
import type { ComponentProps } from "react";
import type Ionicons from "@expo/vector-icons/Ionicons";

export const colors = {
  bg: "#F6F5F2",
  surface: "#FFFFFF",
  surfaceMuted: "#EFEEEA",
  border: "#E2E0DA",
  borderStrong: "#C9C6BE",

  text: "#1A1C22",
  textMuted: "#565B68",
  textSubtle: "#7A7F8C",
  onAccent: "#FFFFFF",

  accent: "#3346C5",
  accentPressed: "#2737A3",
  accentSoft: "#E8EBFA",

  ok: "#1E7347",
  okSoft: "#E3F2E9",
  watch: "#7D5F00",
  watchSoft: "#FDF3CF",
  high: "#B0500C",
  highSoft: "#FCE9DA",
  danger: "#B3261E",
  dangerPressed: "#8F1E18",
  dangerSoft: "#FBE7E5",
  silent: "#575C69",
  silentSoft: "#ECEDF0",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  small: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
} as const;

/** Minimum touch target (spec §14). */
export const TOUCH = 48;

export type IconName = ComponentProps<typeof Ionicons>["name"];

export interface Tone {
  readonly fg: string;
  readonly bg: string;
  readonly icon: IconName;
}

export type ToneName = "ok" | "watch" | "high" | "danger" | "silent" | "accent";

export const tones: Record<ToneName, Tone> = {
  ok: { fg: colors.ok, bg: colors.okSoft, icon: "checkmark-circle" },
  watch: { fg: colors.watch, bg: colors.watchSoft, icon: "eye" },
  high: { fg: colors.high, bg: colors.highSoft, icon: "alert-circle" },
  danger: { fg: colors.danger, bg: colors.dangerSoft, icon: "warning" },
  silent: { fg: colors.silent, bg: colors.silentSoft, icon: "time" },
  accent: { fg: colors.accent, bg: colors.accentSoft, icon: "information-circle" },
};
