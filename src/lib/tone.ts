import type { Tone } from "@/lib/domain/levels";
import type { Level } from "@/lib/domain/types";
import type { TriageGroup } from "@/lib/services/views";

/** The only place a status colour is chosen. Status is never colour alone. */
export const LEVEL_COLOR: Readonly<Record<Level, string>> = {
  RED_EMERGENCY: "var(--crimson)",
  RED_CRISIS: "var(--crimson)",
  ORANGE: "var(--amber)",
  YELLOW: "var(--ochre)",
  GREY_SILENT: "var(--slate)",
  GREEN: "var(--emerald)",
};

export const TONE_COLOR: Readonly<Record<Tone, string>> = {
  red: "var(--crimson)",
  orange: "var(--amber)",
  yellow: "var(--ochre)",
  grey: "var(--slate)",
  green: "var(--emerald)",
};

export const GROUP_COLOR: Readonly<Record<TriageGroup, string>> = {
  EMERGENCY: "var(--crimson)",
  CRISIS: "var(--crimson)",
  ORANGE: "var(--amber)",
  YELLOW: "var(--ochre)",
  UNCONFIRMED: "var(--royal-3)",
  SILENT: "var(--slate)",
  GREEN: "var(--emerald)",
};

/** Inline style setting the --c custom property used by .mark, .row, .seal… */
export const toneVar = (color: string) => ({ "--c": color }) as React.CSSProperties;
