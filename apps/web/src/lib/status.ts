import type { Level, RiskCategory } from "shared";
import { fr } from "./i18n/fr";

/** How a level is shown: always icon + colour + word (spec rule 12). */
export type Tone = "danger" | "warning" | "watch" | "neutral" | "ok";
export type StatusIcon = "octagon" | "triangle" | "eye" | "clock" | "check" | "pulse";

export interface LevelDisplay {
  readonly word: string;
  readonly tone: Tone;
  readonly icon: StatusIcon;
}

const LEVELS: Readonly<Record<Level, LevelDisplay>> = {
  EMERGENCY: { word: fr.level.EMERGENCY, tone: "danger", icon: "octagon" },
  SEVERE: { word: fr.level.SEVERE, tone: "danger", icon: "octagon" },
  HIGH: { word: fr.level.HIGH, tone: "warning", icon: "triangle" },
  WATCH: { word: fr.level.WATCH, tone: "watch", icon: "eye" },
  SILENT: { word: fr.level.SILENT, tone: "neutral", icon: "clock" },
  OK: { word: fr.level.OK, tone: "ok", icon: "check" },
};

const UNCONFIRMED: LevelDisplay = { word: fr.level.unconfirmed, tone: "danger", icon: "pulse" };

/**
 * Display for a patient row: an unconfirmed severe reading outranks HIGH and
 * below (triage group 3, spec §6.5), so it is shown instead of those levels.
 */
export function levelDisplay(level: Level, hasUnconfirmedSevere = false): LevelDisplay {
  const urgent = level === "EMERGENCY" || level === "SEVERE";
  return hasUnconfirmedSevere && !urgent ? UNCONFIRMED : LEVELS[level];
}

/** Rows that must catch the eye in the triage list. */
export const isUrgent = (level: Level, hasUnconfirmedSevere = false): boolean =>
  level === "EMERGENCY" || level === "SEVERE" || hasUnconfirmedSevere;

const RISK_TONES: Readonly<Record<RiskCategory, Tone>> = { LOW: "ok", MODERATE: "watch", HIGH: "warning" };

export const riskTone = (category: RiskCategory): Tone => RISK_TONES[category];
