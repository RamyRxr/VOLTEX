import { CONFIG } from "./config";
import { computeAdherence, computeMissedPill, type MissedPillResult } from "./missedPill";
import { byTimeAsc, episodes, sessionsWithinDays, validSessions } from "./session";
import { computeSilence, type SilenceResult } from "./silence";
import { dangerSymptomsIn, isAbove, isBelowLow, patientTarget } from "./thresholds";
import { computeTrend, type TrendResult } from "./trend";
import { compareOfficeHome, type OfficeComparison } from "./whiteCoat";
import type { AlertLevel, BP, DomainSession, Level, PatientProfile, SymptomType } from "./types";
import { bpOf } from "./types";

/** One matching rule, with the numbers that prove it. */
export type Finding =
  | { kind: "DANGER"; level: "RED_EMERGENCY"; sessionId: string; bp: BP; symptoms: SymptomType[] }
  | { kind: "CRISIS"; level: "RED_CRISIS"; sessionId: string; bp: BP }
  | { kind: "HIGH_REPEATED"; level: "ORANGE"; hits: BP[] }
  | { kind: "LOW_REPEATED"; level: "ORANGE"; hits: BP[] }
  | { kind: "AVERAGE"; level: "YELLOW"; avg: BP; target: BP }
  | { kind: "TREND"; level: "YELLOW"; perWeek: number; daysToTarget: number | null }
  | { kind: "MISSED_PILL"; level: "YELLOW"; deltaSys: number }
  | { kind: "SILENCE"; level: "GREY_SILENT"; days: number; thresholdDays: number; neverMeasured: boolean };

/** Unconfirmed or expired session ≥ crisis: shown to the doctor, never red, never to the patient. */
export interface PendingCrisisItem {
  readonly sessionId: string;
  readonly bp: BP;
  readonly startedAt: Date;
  /** Still inside the confirmation window. */
  readonly awaiting: boolean;
}

export interface Assessment {
  readonly level: Level;
  /** The rule that set the level; null when GREEN. */
  readonly primary: Finding | null;
  /** Every matching rule, most severe first. */
  readonly findings: readonly Finding[];
  readonly silence: SilenceResult;
  readonly pendingCrisis: PendingCrisisItem | null;
  readonly office: OfficeComparison | null;
  readonly missedPill: MissedPillResult | null;
  readonly trend: TrendResult | null;
  readonly avg7: BP | null;
  readonly target: BP;
  readonly adherence: number | null;
  readonly lastSession: DomainSession | null;
}

export interface AssessInput {
  readonly patient: PatientProfile;
  readonly sessions: readonly DomainSession[];
  readonly now: Date;
  readonly windowMs: number;
  /** Sessions whose red alert the doctor closed: that red rule no longer applies. */
  readonly closedRedSessionIds?: ReadonlySet<string>;
}

export const SEVERITY: Record<Level, number> = {
  RED_EMERGENCY: 0,
  RED_CRISIS: 1,
  ORANGE: 2,
  YELLOW: 3,
  GREY_SILENT: 4,
  GREEN: 5,
};

export const isRed = (l: Level): l is "RED_EMERGENCY" | "RED_CRISIS" =>
  l === "RED_EMERGENCY" || l === "RED_CRISIS";

export function moreSevere(a: Level, b: Level): Level {
  return SEVERITY[a] <= SEVERITY[b] ? a : b;
}

/** An unresolved red alert keeps the patient red until the doctor closes it. */
export function mergeAlertLevel(level: Level, unresolvedAlertLevels: readonly AlertLevel[]): Level {
  return unresolvedAlertLevels.filter(isRed).reduce<Level>(moreSevere, level);
}

const DAY = 86_400_000;

function homeAverage(valid: readonly DomainSession[], now: Date) {
  const recent = sessionsWithinDays(valid, now, CONFIG.averageWindowDays);
  if (recent.length === 0) return null;
  const sys = recent.reduce((a, s) => a + s.avgSys, 0) / recent.length;
  const dia = recent.reduce((a, s) => a + s.avgDia, 0) / recent.length;
  return { rawSys: sys, bp: { sys: Math.round(sys), dia: Math.round(dia) } };
}

function dangerFinding(sorted: readonly DomainSession[], closed: ReadonlySet<string>): Finding | null {
  const last = sorted.at(-1);
  if (!last || last.status !== "DANGER" || closed.has(last.id)) return null;
  return { kind: "DANGER", level: "RED_EMERGENCY", sessionId: last.id, bp: bpOf(last), symptoms: dangerSymptomsIn(last.symptoms) };
}

function crisisFinding(eps: readonly DomainSession[], closed: ReadonlySet<string>): Finding | null {
  const last = eps.at(-1);
  if (!last || last.status !== "CONFIRMED" || last.confirmedBySessionId == null) return null;
  if (!isAbove(bpOf(last), CONFIG.crisis) || closed.has(last.id)) return null;
  return { kind: "CRISIS", level: "RED_CRISIS", sessionId: last.id, bp: bpOf(last) };
}

function repeatedFinding(eps: readonly DomainSession[]): Finding | null {
  const last3 = eps.slice(-3);
  const high = last3.filter((s) => isAbove(bpOf(s), CONFIG.high));
  if (high.length >= 2) return { kind: "HIGH_REPEATED", level: "ORANGE", hits: high.map(bpOf) };
  const low = last3.filter((s) => isBelowLow(bpOf(s)) && s.symptoms.includes("DIZZINESS"));
  if (low.length >= 2) return { kind: "LOW_REPEATED", level: "ORANGE", hits: low.map(bpOf) };
  return null;
}

function pendingCrisisItem(
  sorted: readonly DomainSession[],
  now: Date,
  windowMs: number,
): PendingCrisisItem | null {
  const lastValidAt = validSessions(sorted).at(-1)?.startedAt.getTime() ?? -Infinity;
  const candidate = [...sorted]
    .reverse()
    .find((s) => (s.status === "PENDING" || s.status === "EXPIRED") && isAbove(bpOf(s), CONFIG.crisis));
  if (!candidate || candidate.startedAt.getTime() < lastValidAt) return null;
  const awaiting =
    candidate.status === "PENDING" && now.getTime() - candidate.startedAt.getTime() <= windowMs;
  return { sessionId: candidate.id, bp: bpOf(candidate), startedAt: candidate.startedAt, awaiting };
}

/** CLAUDE.md §6.4–6.5: the patient's level from their sessions. Pure. */
export function assessPatient(input: AssessInput): Assessment {
  const { patient, now, windowMs } = input;
  const closed = input.closedRedSessionIds ?? new Set<string>();
  const sorted = [...input.sessions].filter((s) => s.startedAt <= now).sort(byTimeAsc);
  const valid = validSessions(sorted);
  const eps = episodes(sorted);
  const target = patientTarget(patient);

  const home = homeAverage(valid, now);
  const trend = computeTrend(valid, now, target, home?.rawSys ?? null);
  const missedPill = computeMissedPill(eps);

  const findings: Finding[] = [];
  const push = (f: Finding | null) => {
    if (f) findings.push(f);
  };
  push(dangerFinding(sorted, closed));
  push(crisisFinding(eps, closed));
  push(repeatedFinding(eps));
  if (home && isAbove(home.bp, target)) push({ kind: "AVERAGE", level: "YELLOW", avg: home.bp, target });
  if (trend?.rising) push({ kind: "TREND", level: "YELLOW", perWeek: trend.perWeek, daysToTarget: trend.daysToTarget });
  if (missedPill?.flagged) push({ kind: "MISSED_PILL", level: "YELLOW", deltaSys: missedPill.deltaSys });

  const highRisk = (findings[0] && SEVERITY[findings[0].level] <= SEVERITY.ORANGE) || Boolean(trend?.rising);
  const silence = computeSilence(sorted, patient, now, highRisk);
  if (silence.silent) {
    push({
      kind: "SILENCE",
      level: "GREY_SILENT",
      days: silence.days,
      thresholdDays: silence.thresholdDays,
      neverMeasured: silence.neverMeasured,
    });
  }

  const primary = findings[0] ?? null;
  return {
    level: primary?.level ?? "GREEN",
    primary,
    findings,
    silence,
    pendingCrisis: pendingCrisisItem(sorted, now, windowMs),
    office: compareOfficeHome(home?.bp ?? null, patient, target),
    missedPill,
    trend,
    avg7: home?.bp ?? null,
    target,
    adherence: computeAdherence(eps, now),
    lastSession: sorted.at(-1) ?? null,
  };
}

/** Days since a date, whole days. */
export const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / DAY);

/** CLAUDE.md §6.4 status mapping: doctor level → what the patient sees. */
export type PatientWord = "URGENT" | "ATTENTION" | "FOLLOW_UP" | "GOOD";
export type StatusIcon = "alert-octagon" | "alert-triangle" | "clock" | "check-circle";
export type Tone = "red" | "orange" | "yellow" | "grey" | "green";

export interface PatientStatus {
  readonly word: PatientWord;
  readonly icon: StatusIcon;
  readonly tone: Tone;
}

export function toPatientStatus(level: Level): PatientStatus {
  switch (level) {
    case "RED_EMERGENCY":
    case "RED_CRISIS":
      return { word: "URGENT", icon: "alert-octagon", tone: "red" };
    case "ORANGE":
      return { word: "ATTENTION", icon: "alert-triangle", tone: "orange" };
    case "YELLOW":
      return { word: "ATTENTION", icon: "alert-triangle", tone: "yellow" };
    case "GREY_SILENT":
      return { word: "FOLLOW_UP", icon: "clock", tone: "grey" };
    default:
      return { word: "GOOD", icon: "check-circle", tone: "green" };
  }
}
