/**
 * Extra demo doctors and their patients (fictional), so the dashboard can be
 * tried with several doctors. Each patient follows a scenario; her level still
 * comes from the rules.
 */
import { twiceDaily, type Answer, type Flags, type PatientPlan, type Reading } from "./plans";

export interface DoctorPlan {
  readonly email: string;
  readonly fullName: string;
}

export const DEMO_DOCTOR: DoctorPlan = { email: "docteur@demo.dz", fullName: "Dr Karima Benali" };

export const EXTRA_DOCTORS: readonly DoctorPlan[] = [
  { email: "dr.haddad@demo.dz", fullName: "Dr Yacine Haddad" },
  { email: "dr.mebarki@demo.dz", fullName: "Dr Souad Mebarki" },
  { email: "dr.kherbache@demo.dz", fullName: "Dr Amel Kherbache" },
  { email: "dr.boukhalfa@demo.dz", fullName: "Dr Mourad Boukhalfa" },
  { email: "dr.taleb@demo.dz", fullName: "Dr Leila Taleb" },
  { email: "dr.guerroudj@demo.dz", fullName: "Dr Nassim Guerroudj" },
  { email: "dr.belaid@demo.dz", fullName: "Dr Fatiha Belaïd" },
  { email: "dr.ouali@demo.dz", fullName: "Dr Rachid Ouali" },
];

const PATIENTS_PER_DOCTOR = 5;

const FIRST = [
  "Aya", "Bouchra", "Dounia", "Feriel", "Ghania", "Hiba", "Ikram", "Jihane", "Kenza", "Loubna",
  "Malak", "Nesrine", "Ouarda", "Sabrina", "Rym", "Sihem", "Tinhinane", "Warda", "Yousra", "Zineb",
];
const LAST = [
  "Aouadi", "Bensaid", "Chabane", "Dahmani", "Feddal", "Guendouz", "Hamdi", "Ikhlef", "Kaddour", "Lounis",
  "Madani", "Nouri", "Ouchene", "Rezki", "Slimani", "Tabet", "Yahiaoui", "Zerrouki", "Boualem", "Mokrani",
];

type Scenario = "HIGH" | "TREND" | "SILENT" | "WATCH_ITEM" | "UNCONFIRMED" | "OK";
const SCENARIOS: readonly Scenario[] = ["OK", "HIGH", "TREND", "OK", "SILENT", "WATCH_ITEM", "OK", "UNCONFIRMED"];

const SUMMARIES: Readonly<Record<Scenario, string>> = {
  OK: "Mesures régulières, deux fois par jour, toutes sous 140/90. Aucun symptôme déclaré dans les questionnaires récents.",
  HIGH: "Deux des trois dernières mesures sont au-dessus de 140/90. Les mesures précédentes étaient sous ce seuil. Aucun symptôme déclaré.",
  TREND: "Systolique en hausse régulière sur 14 jours, sans dépasser 140/90. Aucun symptôme déclaré.",
  SILENT: "Aucune mesure depuis plus de 2 jours alors que deux mesures par jour sont attendues. Les mesures précédentes étaient stables.",
  WATCH_ITEM: "Mesures stables sous 140/90. Jambes gonflées déclarées dans le questionnaire d'hier.",
  UNCONFIRMED: "Une mesure sévère il y a quelques heures, jamais recontrôlée : non confirmée. Les autres mesures sont sous 140/90.",
};

const jitter = (i: number, spread: number): number => ((i * 7) % (2 * spread + 1)) - spread;
const stable = (sys: number, dia: number) => (i: number) => ({ sys: sys + jitter(i, 3), dia: dia + jitter(i + 1, 2) });
const dailyNo = (days: number, lastHoursAgo: number): Answer[] =>
  Array.from({ length: days }, (_, i) => ({ yes: [], hoursAgo: lastHoursAgo + i * 24 }));

function readingsFor(scenario: Scenario, n: number): Reading[] {
  const base = 112 + (n % 5) * 3;
  switch (scenario) {
    case "HIGH":
      return [
        { sys: 145 + (n % 4), dia: 93, pulse: 88, hoursAgo: 2 },
        { sys: 130, dia: 84, pulse: 84, hoursAgo: 14 },
        { sys: 143, dia: 91, pulse: 86, hoursAgo: 26 },
        ...twiceDaily(10, 38, stable(126, 80)),
      ];
    case "TREND":
      return twiceDaily(14, 3, (i, count) => ({ sys: Math.round(135 - (22 * i) / (count - 1)), dia: Math.round(84 - (10 * i) / (count - 1)) }));
    case "SILENT":
      return twiceDaily(10, 60 + (n % 3) * 12, stable(base, 74));
    case "UNCONFIRMED":
      return [{ sys: 162 + (n % 5), dia: 111, pulse: 94, hoursAgo: 2 + (n % 3) }, ...twiceDaily(10, 6, stable(base, 76))];
    default:
      return twiceDaily(10, 1 + (n % 10), stable(base, 72 + (n % 3) * 2));
  }
}

function answersFor(scenario: Scenario, readings: readonly Reading[]): Answer[] {
  const last = Math.min(...readings.map((r) => r.hoursAgo)) + 1;
  if (scenario === "WATCH_ITEM") return [{ yes: ["SWELLING_LEGS"], hoursAgo: 20 }, ...dailyNo(4, 44)];
  return dailyNo(scenario === "SILENT" ? 3 : 5, last);
}

/** Varied profiles, so the risk card shows different factors. */
function flagsFor(n: number): Flags {
  return {
    firstPregnancy: n % 3 === 0,
    previousPreeclampsia: n % 9 === 4,
    chronicHypertension: n % 11 === 7,
    multiplePregnancy: n % 13 === 5,
    preexistingDiabetes: n % 17 === 8,
    familyPreeclampsia: n % 6 === 2,
    familyHypertension: n % 4 === 1,
    ivfPregnancy: n % 10 === 6,
    gestationalDiabetes: n % 8 === 3,
  };
}

function patientPlan(doctor: DoctorPlan, d: number, p: number): PatientPlan {
  const n = d * PATIENTS_PER_DOCTOR + p;
  const scenario = SCENARIOS[n % SCENARIOS.length] ?? "OK";
  const readings = readingsFor(scenario, n);
  const pending = p === PATIENTS_PER_DOCTOR - 1 && d % 2 === 1;
  return {
    key: `patiente${String(n + 1).padStart(2, "0")}`,
    fullName: `${FIRST[n % FIRST.length]} ${LAST[(n * 7 + d) % LAST.length]}`,
    age: 21 + ((n * 5) % 20),
    weeks: 12 + ((n * 3) % 27),
    flags: flagsFor(n),
    heightCm: 155 + (n % 6) * 3,
    weightKg: 56 + (n % 7) * 5,
    followUpDays: pending ? 1 : 25,
    readings: pending ? [] : readings,
    answers: pending ? [] : answersFor(scenario, readings),
    link: pending ? "PENDING" : "ACCEPTED",
    doctorEmail: doctor.email,
    ...(pending ? {} : { aiSummary: SUMMARIES[scenario] }),
  };
}

/** 8 doctors × 5 patients = 40 patients; doctors 2, 4, 6, 8 also have one pending request among them. */
export const EXTRA_PLANS: readonly PatientPlan[] = EXTRA_DOCTORS.flatMap((doctor, d) =>
  Array.from({ length: PATIENTS_PER_DOCTOR }, (_, p) => patientPlan(doctor, d, p)),
);
