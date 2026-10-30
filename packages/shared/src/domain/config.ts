/**
 * Every medical number lives here (spec §2 rule 6, §6.1).
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
  // How long a danger answer or a confirmed severe reading keeps the patient at
  // EMERGENCY / SEVERE, and how long an unconfirmed severe reading is flagged.
  // Not stated in the spec — TO VALIDATE.
  acuteWindowHours: 24,
  watchItemsWindowDays: 7, // watch items answered yes: WATCH level, and the risk is raised one level
  pregnancyDays: 280, // due date = last menstrual period + 280 days
  dashboardPollMs: 3000,
} as const;
