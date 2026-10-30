/**
 * Every medical number lives here (CLAUDE.md §2 rule 6, §6.1).
 * Initial values from common obstetric guidelines — TO VALIDATE with a doctor or midwife.
 */
export const CONFIG = {
  bp: {
    hypertension: { sys: 140, dia: 90 }, // ≥ either → hypertensive range
    severe: { sys: 160, dia: 110 }, // ≥ either → severe range
  },
  confirmSevereAfterMinutes: 15, // re-measure delay for a severe reading
  confirmationWindowMinutes: 60, // second session within this window confirms
  demoMode: { confirmSevereAfterSeconds: 10 },
  trend: { windowDays: 14, minSessions: 5, minSlopeSysPerWeek: 2 },
  silence: { multiplier: 2 }, // silent if no session for 2× expected interval
  expectedSessionsPerDay: 2, // default, editable per patient by the doctor
  risk: {
    ageHigh: 40, // moderate factor
    bmiHigh: 35, // moderate factor
  },
  dashboardPollMs: 3000,
} as const;
