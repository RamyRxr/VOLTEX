import type { RiskProfile } from "../risk";
import type { QuestionnaireRecord, SessionRecord, SessionStatus } from "../types";

export const NOW = new Date("2026-10-30T12:00:00Z");
export const minutesAgo = (m: number): Date => new Date(NOW.getTime() - m * 60_000);
export const hoursAgo = (h: number): Date => minutesAgo(h * 60);
export const daysAgo = (d: number): Date => hoursAgo(d * 24);

let seq = 0;
export function session(sys: number, dia: number, takenAt: Date, status?: SessionStatus): SessionRecord {
  seq += 1;
  const auto: SessionStatus = sys >= 160 || dia >= 110 ? "SEVERE_PENDING" : sys >= 140 || dia >= 90 ? "HYPERTENSIVE" : "NORMAL";
  return { id: `s${seq}`, sys, dia, takenAt, status: status ?? auto };
}

export function questionnaire(yes: readonly string[], answeredAt: Date): QuestionnaireRecord {
  seq += 1;
  return { id: `q${seq}`, answers: Object.fromEntries(yes.map((i) => [i, true])), answeredAt };
}

/** Healthy 29-year-old, no risk factor. */
export const BASE_PROFILE: RiskProfile = {
  birthDate: new Date("1997-03-10T00:00:00Z"),
  firstPregnancy: false,
  multiplePregnancy: false,
  chronicHypertension: false,
  previousPreeclampsia: false,
  preexistingDiabetes: false,
  kidneyDisease: false,
  autoimmuneDisease: false,
  familyPreeclampsia: false,
  ivfPregnancy: false,
  heightCm: 165,
  weightKg: 62,
};

/** Twice a day, normal values, over the last `days` days. */
export const stableSessions = (days: number): SessionRecord[] =>
  Array.from({ length: days * 2 }, (_, i) => session(118 + (i % 3), 76, hoursAgo(2 + i * 12)));
