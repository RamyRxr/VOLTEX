import type { Level } from "./types";

export interface TriageItem {
  readonly level: Level;
  readonly hasUnconfirmedSevere: boolean;
  /** Latest session / questionnaire / alert time, for "most recent first". */
  readonly lastActivityAt: Date | null;
}

/**
 * Spec §6.5: EMERGENCY → SEVERE → unconfirmed severe reading → HIGH → WATCH →
 * SILENT → OK.
 */
export function triageGroup(item: TriageItem): number {
  switch (item.level) {
    case "EMERGENCY":
      return 0;
    case "SEVERE":
      return 1;
    default:
      if (item.hasUnconfirmedSevere) return 2;
  }
  const rest: Readonly<Record<Exclude<Level, "EMERGENCY" | "SEVERE">, number>> = { HIGH: 3, WATCH: 4, SILENT: 5, OK: 6 };
  return rest[item.level];
}

/** New sorted array; most recent activity first inside a group. */
export function triageSort<T extends TriageItem>(items: readonly T[]): T[] {
  const time = (i: TriageItem): number => i.lastActivityAt?.getTime() ?? 0;
  return [...items].sort((a, b) => triageGroup(a) - triageGroup(b) || time(b) - time(a));
}
