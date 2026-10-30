/**
 * Every medical number lives here (spec rule 9).
 * Initial values, to be validated with a partner doctor.
 */
export const CONFIG = {
  defaultTarget: { sys: 135, dia: 85 }, // home target when the patient has none
  crisis: { sys: 180, dia: 120 }, // confirmed → RED_CRISIS
  high: { sys: 160, dia: 100 }, // 2 of last 3 → ORANGE
  low: { sys: 90, dia: 60 }, // with dizziness, 2 of last 3 → ORANGE
  readingGapSeconds: 60, // between the 2 readings of a session
  restBeforeConfirmSeconds: 300, // before the confirmation session
  confirmationWindowMinutes: 120, // a second session within this window confirms
  demoModeSeconds: { readingGap: 5, rest: 5, confirmationWindow: 300 }, // DEMO_MODE=true
  trend: { windowDays: 14, minSessions: 5, minSlopePerWeek: 1.5 },
  missedPill: { minSessionsEachGroup: 3, minDeltaSys: 10 },
  whiteCoat: { minDeltaSys: 10, minDeltaDia: 5, officeHypertension: { sys: 140, dia: 90 } },
  silence: { multiplier: 2, highRiskMaxDays: 3 },
  escalation: { ackTimeoutMinutes: 30 },
  dashboardPollMs: 1000,
  patientPollMs: 3000,

  /** Window for the home average used by levels, white-coat and control rate. */
  averageWindowDays: 7,
  /** Adherence % shown to the doctor covers this many recent days. */
  adherenceWindowDays: 30,
  /** Values outside these ranges are rejected as typing errors, on web and SMS. */
  plausible: {
    sys: { min: 60, max: 260 },
    dia: { min: 30, max: 160 },
    pulse: { min: 30, max: 220 },
  },
  /** Stepper start values on the add-reading screen. */
  stepperDefaults: { sys: 130, dia: 80, pulse: 75 },
} as const;
