/** Domain types. Names and values mirror the Prisma enums in CLAUDE.md §7. */

export type Channel = "WEB" | "SMS";
export type PillStatus = "TAKEN" | "MISSED" | "NOT_REPORTED";
export type SessionStatus =
  | "NORMAL"
  | "PENDING"
  | "CONFIRMED"
  | "NOT_CONFIRMED"
  | "EXPIRED"
  | "DANGER";
export type SymptomType =
  | "HEADACHE"
  | "DIZZINESS"
  | "NOSEBLEED"
  | "CHEST_PAIN"
  | "VISION"
  | "CONFUSION"
  | "WEAKNESS"
  | "SPEECH";
export type AlertLevel = "RED_EMERGENCY" | "RED_CRISIS" | "ORANGE" | "YELLOW" | "GREY_SILENT";
export type Level = AlertLevel | "GREEN";
export type AlertEvidence =
  | "DANGER_SYMPTOM"
  | "CONFIRMED_SESSION"
  | "TWO_OF_THREE"
  | "SEVEN_DAY_AVG"
  | "TREND"
  | "MISSED_PILL"
  | "SILENCE";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "CLOSED";

export interface BP {
  readonly sys: number;
  readonly dia: number;
}

export interface ReadingValue {
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number | null;
}

/** The slice of a ReadingSession row the rules need. */
export interface DomainSession {
  readonly id: string;
  readonly startedAt: Date;
  readonly channel: Channel;
  readonly avgSys: number;
  readonly avgDia: number;
  readonly avgPulse: number | null;
  readonly pillStatus: PillStatus;
  readonly status: SessionStatus;
  readonly confirmedBySessionId: string | null;
  readonly symptoms: readonly SymptomType[];
}

/** The slice of a Patient row the rules need. */
export interface PatientProfile {
  readonly targetSys: number | null;
  readonly targetDia: number | null;
  readonly expectedReadingsPerWeek: number;
  readonly lastOfficeSys: number | null;
  readonly lastOfficeDia: number | null;
  /** consentAt: start of follow-up, used for silence before the first reading. */
  readonly enrolledAt: Date;
}

export const bpOf = (s: Pick<DomainSession, "avgSys" | "avgDia">): BP => ({
  sys: s.avgSys,
  dia: s.avgDia,
});
