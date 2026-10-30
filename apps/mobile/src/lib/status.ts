/** Maps API states to icon + colour + word (CLAUDE.md rule 12). Display only, no rules here. */
import type { AlertLevel, Level, RiskCategory, SessionStatus } from "@/api/types";
import { t } from "@/i18n";
import { tones, type IconName, type Tone } from "@/theme";

export interface Status extends Tone {
  readonly word: string;
}

const LEVEL_TONE: Record<Level, Tone> = {
  EMERGENCY: tones.danger,
  SEVERE: tones.danger,
  HIGH: tones.high,
  WATCH: tones.watch,
  SILENT: tones.silent,
  OK: tones.ok,
};

export function levelStatus(level: Level, word?: string): Status {
  return { ...LEVEL_TONE[level], word: word ?? t(`level.${level}`) };
}

export function doctorLevelStatus(level: AlertLevel): Status {
  return { ...LEVEL_TONE[level], word: t(`doctor.level.${level}`) };
}

const SESSION_TONE: Record<SessionStatus, Tone> = {
  NORMAL: tones.ok,
  HYPERTENSIVE: tones.high,
  SEVERE_PENDING: { ...tones.danger, icon: "hourglass" },
  SEVERE_CONFIRMED: tones.danger,
  SEVERE_NOT_CONFIRMED: { ...tones.silent, icon: "help-circle" },
  SEVERE_EXPIRED: { ...tones.silent, icon: "help-circle" },
};

export function sessionStatus(status: SessionStatus): Status {
  return { ...SESSION_TONE[status], word: t(`session.${status}`) };
}

const RISK_ICON: Record<RiskCategory, IconName> = {
  LOW: "shield-checkmark",
  MODERATE: "eye",
  HIGH: "alert-circle",
};

export function riskStatus(category: RiskCategory): Status {
  const tone = category === "LOW" ? tones.ok : category === "MODERATE" ? tones.watch : tones.high;
  return { ...tone, icon: RISK_ICON[category], word: t(`risk.${category}`) };
}

const ALERT_ORDER: readonly AlertLevel[] = ["EMERGENCY", "SEVERE", "HIGH", "WATCH", "SILENT"];

export function alertRank(level: AlertLevel): number {
  return ALERT_ORDER.indexOf(level);
}

export function isUrgentAlert(level: AlertLevel): boolean {
  return level === "EMERGENCY" || level === "SEVERE";
}
