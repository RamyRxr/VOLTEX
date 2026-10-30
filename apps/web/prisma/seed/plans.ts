/**
 * Demo patients (spec §12). Fictional only. Each one gets readings and answers;
 * her level comes from the rules, never from this file.
 */

export interface Reading {
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number;
  readonly hoursAgo: number;
}

export interface Answer {
  readonly yes: readonly string[];
  readonly hoursAgo: number;
}

export interface Flags {
  readonly firstPregnancy?: boolean;
  readonly multiplePregnancy?: boolean;
  readonly chronicHypertension?: boolean;
  readonly previousPreeclampsia?: boolean;
  readonly preexistingDiabetes?: boolean;
  readonly gestationalDiabetes?: boolean;
  readonly kidneyDisease?: boolean;
  readonly autoimmuneDisease?: boolean;
  readonly familyPreeclampsia?: boolean;
  readonly familyHypertension?: boolean;
  readonly ivfPregnancy?: boolean;
}

export interface PatientPlan {
  readonly key: string;
  readonly fullName: string;
  readonly age: number;
  /** Pregnancy week today (from a last-menstrual-period date). */
  readonly weeks: number;
  readonly flags: Flags;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly treatments?: string;
  readonly followUpDays: number;
  readonly readings: readonly Reading[];
  readonly answers: readonly Answer[];
  readonly link: "ACCEPTED" | "PENDING";
  readonly aiSummary?: string;
  readonly note?: string;
}

/** Twice a day (every 12 h) for `days` days, the newest `lastHoursAgo` hours ago; small deterministic variation. */
export function twiceDaily(
  days: number,
  lastHoursAgo: number,
  value: (i: number, count: number) => { sys: number; dia: number },
): Reading[] {
  const count = days * 2;
  return Array.from({ length: count }, (_, i) => {
    const { sys, dia } = value(i, count);
    return { sys, dia, pulse: 78 + ((i * 5) % 9), hoursAgo: lastHoursAgo + i * 12 };
  });
}

const jitter = (i: number, spread: number): number => ((i * 7) % (2 * spread + 1)) - spread;
const stable = (sys: number, dia: number) => (i: number) => ({ sys: sys + jitter(i, 3), dia: dia + jitter(i + 1, 2) });

/** All-"no" questionnaire every day for `days` days. */
const dailyNo = (days: number, lastHoursAgo: number): Answer[] =>
  Array.from({ length: days }, (_, i) => ({ yes: [], hoursAgo: lastHoursAgo + i * 24 }));

const OK_NAMES: readonly [string, number, number, Flags][] = [
  ["Imane Haddad", 26, 24, {}],
  ["Selma Cherif", 31, 30, { firstPregnancy: true }],
  ["Rania Boudiaf", 28, 19, {}],
  ["Hanane Mansouri", 34, 27, {}],
  ["Asma Belkacem", 23, 16, { firstPregnancy: true }],
  ["Chaima Ziani", 30, 36, {}],
  ["Wafa Kaci", 29, 21, {}],
  ["Samira Toumi", 37, 32, {}],
  ["Nadia Ferhat", 25, 14, { firstPregnancy: true }],
  ["Djamila Rahmani", 32, 28, {}],
];

const OK_SUMMARY =
  "Mesures régulières, deux fois par jour, toutes sous 140/90. Aucun symptôme déclaré dans les questionnaires récents. Aucune alerte ouverte.";

export const PLANS: readonly PatientPlan[] = [
  {
    key: "amina",
    fullName: "Amina Bensalem",
    age: 29,
    weeks: 31,
    flags: { firstPregnancy: true },
    heightCm: 165,
    weightKg: 68,
    followUpDays: 30,
    readings: twiceDaily(14, 3, stable(118, 76)),
    answers: dailyNo(7, 4),
    link: "ACCEPTED",
    aiSummary:
      "Première grossesse, 31 SA. Mesures stables depuis 14 jours, autour de 118/76, toutes sous 140/90. Questionnaires quotidiens sans symptôme. Risque modéré lié à la première grossesse.",
  },
  {
    key: "sarah",
    fullName: "Sarah Meziane",
    age: 36,
    weeks: 26,
    flags: { previousPreeclampsia: true, chronicHypertension: true, familyHypertension: true },
    heightCm: 162,
    weightKg: 71,
    treatments: "Labétalol 200 mg deux fois par jour",
    followUpDays: 30,
    readings: twiceDaily(14, 4, stable(131, 84)),
    answers: dailyNo(7, 5),
    link: "ACCEPTED",
    aiSummary:
      "Risque élevé : antécédent de pré-éclampsie et hypertension chronique. Sous labétalol, mesures autour de 131/84 sur 14 jours, sous 140/90. Aucun symptôme déclaré.",
    note: "Traitement par labétalol poursuivi. Contrôle en consultation à 28 SA.",
  },
  {
    key: "lina",
    fullName: "Lina Hamidi",
    age: 24,
    weeks: 33,
    flags: {},
    heightCm: 168,
    weightKg: 64,
    followUpDays: 30,
    // Systolic rises from ~112 to ~136 over 14 days, staying under 140/90.
    readings: twiceDaily(14, 2, (i, n) => ({ sys: Math.round(136 - (24 * i) / (n - 1)) + jitter(i, 1), dia: Math.round(84 - (12 * i) / (n - 1)) })),
    answers: dailyNo(7, 3),
    link: "ACCEPTED",
    aiSummary:
      "Systolique en hausse régulière sur 14 jours, d'environ 112 à 136 mmHg, sans dépasser 140/90. Aucun symptôme déclaré. Risque relevé de faible à modéré à cause de cette tendance.",
  },
  {
    key: "meriem",
    fullName: "Meriem Saadi",
    age: 31,
    weeks: 22,
    flags: { multiplePregnancy: true },
    heightCm: 160,
    weightKg: 66,
    followUpDays: 30,
    readings: [
      { sys: 146, dia: 94, pulse: 88, hoursAgo: 2 },
      { sys: 132, dia: 86, pulse: 84, hoursAgo: 14 },
      { sys: 144, dia: 92, pulse: 86, hoursAgo: 26 },
      ...twiceDaily(13, 38, stable(128, 82)),
    ],
    answers: dailyNo(7, 3),
    link: "ACCEPTED",
    aiSummary:
      "Grossesse gémellaire, 22 SA. Deux des trois dernières mesures sont au-dessus de 140/90 (146/94 et 144/92). Les mesures précédentes étaient autour de 128/82. Aucun symptôme déclaré.",
  },
  {
    key: "yasmine",
    fullName: "Yasmine Larbi",
    age: 27,
    weeks: 29,
    flags: {},
    heightCm: 170,
    weightKg: 70,
    followUpDays: 30,
    readings: twiceDaily(14, 72, stable(117, 75)),
    answers: dailyNo(4, 76),
    link: "ACCEPTED",
    aiSummary:
      "Aucune mesure depuis 3 jours alors que deux mesures par jour sont attendues. Les mesures précédentes étaient stables, autour de 117/75.",
  },
  {
    key: "nour",
    fullName: "Nour Brahimi",
    age: 33,
    weeks: 35,
    flags: {},
    heightCm: 164,
    weightKg: 69,
    followUpDays: 30,
    readings: [{ sys: 165, dia: 112, pulse: 92, hoursAgo: 3 }, ...twiceDaily(14, 5, stable(121, 78))],
    answers: dailyNo(7, 6),
    link: "ACCEPTED",
    aiSummary:
      "Une mesure sévère à 165/112 il y a 3 heures, jamais recontrôlée : non confirmée. Les autres mesures sont autour de 121/78. Aucun symptôme déclaré.",
  },
  ...OK_NAMES.map(
    ([fullName, age, weeks, flags], i): PatientPlan => ({
      key: `ok${i + 1}`,
      fullName,
      age,
      weeks,
      flags,
      heightCm: 158 + (i % 5) * 3,
      weightKg: 58 + (i % 4) * 4,
      followUpDays: 30,
      readings: twiceDaily(10, 1 + (i % 9), stable(114 + (i % 4) * 3, 72 + (i % 3) * 2)),
      answers: dailyNo(5, 2 + (i % 6)),
      link: "ACCEPTED",
      aiSummary: OK_SUMMARY,
    }),
  ),
  {
    key: "khadija",
    fullName: "Khadija Amrani",
    age: 25,
    weeks: 18,
    flags: { firstPregnancy: true },
    heightCm: 163,
    weightKg: 59,
    followUpDays: 1,
    readings: [],
    answers: [],
    link: "PENDING",
  },
];
