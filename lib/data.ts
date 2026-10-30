import {
  DANGER_SYMPTOMS,
  evaluatePatient,
  type EvalResult,
  type Session,
  type Symptom,
} from "./alerts/rules";
import { SYMPTOM_FR } from "./tone";
import { daysAgo, minutesAgo } from "./format";

/* ------------------------------------------------------------------ */
/* Seed shape                                                          */
/* ------------------------------------------------------------------ */

type Seed = {
  /** Days before "now". Ignored when `minutes` is set. */
  at: number;
  sys: number;
  dia: number;
  pulse: number;
  pill?: boolean | null;
  symptoms?: Symptom[];
  status?: "PENDING" | "CONFIRMED";
  channel?: "WEB" | "SMS";
};

const mkSessions = (now: Date, prefix: string, seeds: Seed[]): Session[] => {
  /* Exact whole-day offsets from `now`. This keeps the 14-day trend window,
     the silence counter and the 7-day average independent of the clock time
     at which the demo runs. */
  return seeds.map((s, i) => ({
    id: `${prefix}-s${i + 1}`,
    startedAt:
      s.at < 0
        ? minutesAgo(now, -s.at)
        : new Date(now.getTime() - s.at * 86_400_000),
    avgSys: s.sys,
    avgDia: s.dia,
    avgPulse: s.pulse,
    channel: s.channel ?? (i % 4 === 3 ? "SMS" : "WEB"),
    status: s.status ?? "CONFIRMED",
    pillTaken: s.pill === undefined ? null : s.pill,
    symptoms: s.symptoms ?? [],
    confirmedAt: null,
    supersededBySessionId: null,
  }));
};

/* ------------------------------------------------------------------ */
/* Patient definitions                                                 */
/* ------------------------------------------------------------------ */

type PatientSeed = {
  id: string;
  name: string;
  age: number;
  sex: "F" | "M";
  phone: string;
  treatment: string;
  target?: { sys: number; dia: number };
  expected: number;
  highRisk: boolean;
  lastOffice: { sys: number; dia: number; at: number } | null;
  emergencyContact: string;
  notes: string;
  seeds: Seed[];
};

const STABLE_NAMES = [
  "Nadia Benali",
  "Samir Ouali",
  "Leila Hamdi",
  "Rachid Bouzid",
  "Souad Khelifi",
  "Hocine Mansouri",
  "Farida Zerrouki",
  "Mourad Belkacem",
  "Djamila Saidi",
  "Abderrahmane Ait Ali",
  "Salima Boudiaf",
  "Kamel Haddad",
  "Belkacem Meziane",
  "Nassima Ouali",
  "Tarek Benali",
  "Warda Khelifi",
  "Lounis Hamdi",
  "Malika Bouzid",
  "Reda Mansouri",
  "Soumia Zerrouki",
  "Brahim Saidi",
  "Yasmina Ait Ali",
  "Yamina Belkacem",
];

/** Deterministic LCG — same registry on every render, on every machine. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stablePatients(): PatientSeed[] {
  const rnd = lcg(42);
  const out: PatientSeed[] = [];

  STABLE_NAMES.forEach((name, i) => {
    const age = 45 + Math.floor(rnd() * 34); // 45..78
    const sex: "F" | "M" = i % 2 === 0 ? "F" : "M";
    const expected = 2 + Math.floor(rnd() * 3); // 2..4
    const count = 7 + Math.floor(rnd() * 6); // 7..12

    const baseSys = 122 + Math.floor(rnd() * 7); // 122..128
    const baseDia = 76 + Math.floor(rnd() * 6); // 76..81

    const offsets = new Set<number>();
    offsets.add(1 + (i % 2));
    for (let k = 0; k < count; k++) {
      const o = Math.round(21 - (k * 21) / count - rnd() * 1.1);
      offsets.add(Math.max(1, Math.min(21, o)));
    }
    const days = [...offsets].sort((a, b) => b - a);

    const seeds: Seed[] = days.map((at, k) => {
      const missPill = k === 3 && days.length > 8;
      const jitterSys = Math.round((rnd() - 0.5) * 4);
      const jitterDia = Math.round((rnd() - 0.5) * 4);
      return {
        at,
        sys: baseSys + jitterSys - (missPill ? 2 : 0),
        dia: baseDia + jitterDia,
        pulse: 68 + Math.floor(rnd() * 15),
        pill: missPill ? false : true,
        channel: rnd() > 0.72 ? "SMS" : "WEB",
      };
    });

    out.push({
      id: `p-${String(i + 10).padStart(2, "0")}`,
      name,
      age,
      sex,
      phone: `+21355500${String(i + 10).padStart(4, "0")}`,
      treatment: i % 3 === 0 ? "Amlodipine 5 mg" : i % 3 === 1 ? "Perindopril 5 mg" : "Valsartan 80 mg",
      expected,
      highRisk: age >= 65,
      lastOffice: {
        sys: baseSys + 2 + Math.floor(rnd() * 4),
        dia: baseDia + 2 + Math.floor(rnd() * 4),
        at: 20 + Math.floor(rnd() * 40),
      },
      emergencyContact: `+2136610${String(i + 100).padStart(4, "0")}`,
      notes: "Suivi de routine. Aucun événement signalé entre les consultations.",
      seeds,
    });
  });

  return out;
}

const STORY: PatientSeed[] = [
  {
    id: "p-01",
    name: "Fatima Boudiaf",
    age: 58,
    sex: "F",
    phone: "+213555000002",
    treatment: "Amlodipine 5 mg",
    expected: 7,
    highRisk: false,
    lastOffice: { sys: 152, dia: 96, at: 24 },
    emergencyContact: "+213661000021",
    notes:
      "Traitée depuis 2019. Observance irrégulière signalée en consultation. Vit seule, deux enfants à l'étranger.",
    seeds: [
      { at: 21, sys: 139, dia: 88, pulse: 78, pill: true },
      { at: 18, sys: 137, dia: 86, pulse: 76, pill: true },
      { at: 15, sys: 140, dia: 89, pulse: 80, pill: true },
      { at: 12, sys: 136, dia: 85, pulse: 77, pill: true },
      { at: 11, sys: 138, dia: 87, pulse: 79, pill: true },
      { at: 9, sys: 137, dia: 86, pulse: 78, pill: true },
      { at: 8, sys: 143, dia: 92, pulse: 81, pill: false },
      { at: 6, sys: 145, dia: 93, pulse: 82, pill: false },
      { at: 5, sys: 148, dia: 95, pulse: 84, pill: false },
      { at: 3, sys: 158, dia: 98, pulse: 86, pill: false },
      { at: 2, sys: 162, dia: 101, pulse: 88, pill: false },
      { at: 1, sys: 166, dia: 98, pulse: 87, pill: false },
    ],
  },
  {
    id: "p-02",
    name: "Mohamed Cherif",
    age: 71,
    sex: "M",
    phone: "+213555000003",
    treatment: "Perindopril 5 mg",
    expected: 7,
    highRisk: true,
    lastOffice: { sys: 140, dia: 86, at: 31 },
    emergencyContact: "+213661000031",
    notes:
      "Diabète de type 2 associé. Cible tensionnelle stricte. Mesure à domicile tous les matins.",
    seeds: [
      { at: 14, sys: 121, dia: 78, pulse: 74 },
      { at: 13, sys: 122, dia: 79, pulse: 73 },
      { at: 12, sys: 122, dia: 79, pulse: 75 },
      { at: 11, sys: 123, dia: 80, pulse: 74 },
      { at: 10, sys: 123, dia: 80, pulse: 76 },
      { at: 9, sys: 124, dia: 81, pulse: 75 },
      { at: 8, sys: 124, dia: 81, pulse: 74 },
      { at: 7, sys: 125, dia: 81, pulse: 73 },
      { at: 6, sys: 125, dia: 82, pulse: 75 },
      { at: 5, sys: 126, dia: 82, pulse: 76 },
      { at: 4, sys: 126, dia: 83, pulse: 75 },
      { at: 3, sys: 127, dia: 83, pulse: 74 },
      { at: 2, sys: 127, dia: 84, pulse: 76 },
      { at: 1, sys: 128, dia: 84, pulse: 75 },
    ].map((s) => ({ ...s, pill: true })),
  },
  {
    id: "p-03",
    name: "Karim Haddad",
    age: 49,
    sex: "M",
    phone: "+213555000004",
    treatment: "Amlodipine 5 mg",
    expected: 3,
    highRisk: false,
    lastOffice: { sys: 148, dia: 92, at: 10 },
    emergencyContact: "+213661000041",
    notes:
      "Tension élevée au cabinet, toujours normale à domicile. Pas d'antécédent familial. Sport 3 fois par semaine.",
    seeds: [
      { at: 6, sys: 130, dia: 82, pulse: 72, pill: true },
      { at: 5, sys: 133, dia: 84, pulse: 74, pill: true },
      { at: 3, sys: 129, dia: 81, pulse: 71, pill: true },
      { at: 2, sys: 132, dia: 83, pulse: 73, pill: true },
    ],
  },
  {
    id: "p-04",
    name: "Zohra Meziane",
    age: 64,
    sex: "F",
    phone: "+213555000005",
    treatment: "Valsartan 80 mg",
    expected: 2,
    highRisk: true,
    lastOffice: { sys: 138, dia: 86, at: 38 },
    emergencyContact: "+213661000051",
    notes:
      "Veuve, vit avec sa fille. Mesure au cabinet puis n'a plus rien envoyé. Téléphone à clavier, pas de smartphone.",
    seeds: [
      { at: 18, sys: 139, dia: 86, pulse: 78, pill: true },
      { at: 15, sys: 136, dia: 85, pulse: 77, pill: true },
      { at: 12, sys: 140, dia: 87, pulse: 79, pill: true },
      { at: 9, sys: 138, dia: 86, pulse: 78, pill: true },
    ],
  },
  {
    id: "p-05",
    name: "Ahmed Saidi",
    age: 62,
    sex: "M",
    phone: "+213555000006",
    treatment: "Perindopril 10 mg",
    expected: 7,
    highRisk: false,
    lastOffice: { sys: 142, dia: 90, at: 16 },
    emergencyContact: "+213661000061",
    notes:
      "Contrôlé depuis six mois. Mesure à domicile chaque matin avant le café, appareil validé.",
    seeds: [
      { at: 10, sys: 132, dia: 84, pulse: 76, pill: true },
      { at: 8, sys: 130, dia: 83, pulse: 75, pill: true },
      { at: 6, sys: 134, dia: 85, pulse: 77, pill: true },
      { at: 4, sys: 131, dia: 84, pulse: 76, pill: true },
      { at: 2, sys: 133, dia: 85, pulse: 77, pill: true },
      { at: 1, sys: 131, dia: 83, pulse: 76, pill: true },
    ],
  },
  {
    id: "p-06",
    name: "Houria Cherif",
    age: 67,
    sex: "F",
    phone: "+213555000007",
    treatment: "Amlodipine 10 mg + Hydrochlorothiazide",
    expected: 4,
    highRisk: true,
    lastOffice: { sys: 158, dia: 94, at: 12 },
    emergencyContact: "+213661000071",
    notes:
      "Antécédent d'AVC en 2021. Mesure ce matin avant de partir chez sa sœur.",
    seeds: [
      { at: 4, sys: 146, dia: 91, pulse: 82, pill: true },
      { at: 2, sys: 149, dia: 93, pulse: 83, pill: true },
      {
        at: 0,
        sys: 152,
        dia: 95,
        pulse: 88,
        pill: true,
        symptoms: ["CHEST_PAIN"],
        channel: "SMS",
      },
    ],
  },
  {
    id: "p-07",
    name: "Yacine Boukhalfa",
    age: 55,
    sex: "M",
    phone: "+213555000008",
    treatment: "Valsartan 160 mg",
    expected: 3,
    highRisk: false,
    lastOffice: { sys: 144, dia: 90, at: 21 },
    emergencyContact: "+213661000081",
    notes: "Travaille en déplacement. Envoie ses mesures le soir par SMS.",
    seeds: [
      { at: 9, sys: 133, dia: 85, pulse: 77, pill: true },
      { at: 6, sys: 135, dia: 86, pulse: 78, pill: true },
      { at: 4, sys: 132, dia: 84, pulse: 76, pill: true },
      { at: 2, sys: 134, dia: 85, pulse: 77, pill: true },
      {
        at: -45,
        sys: 178,
        dia: 112,
        pulse: 96,
        pill: null,
        status: "PENDING",
        channel: "SMS",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* French rendering of engine output                                   */
/* ------------------------------------------------------------------ */

const confirmedSorted = (sessions: Session[]) =>
  sessions
    .filter((s) => s.status === "CONFIRMED" && !s.supersededBySessionId)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

const meanOf = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/** 3.6 -> "3,6" — French decimal comma. */
const frNum = (n: number) => String(n).replace(".", ",");

/** Presentation-layer translation of `EvalResult.ruleId`. Numbers come from data, never typed. */
function reasonFr(result: EvalResult, sessions: Session[], expected: number): string {
  const stats = confirmedSorted(sessions);
  const last3 = stats.slice(-3);
  const latest = [...sessions]
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .at(-1);

  switch (result.ruleId) {
    case "EMERGENCY_SYMPTOM": {
      const labels = (latest?.symptoms ?? [])
        .filter((s) => DANGER_SYMPTOMS.includes(s))
        .map((s) => SYMPTOM_FR[s]);
      return `Signe d'alerte signalé (${labels.join(", ") || "signe d'alerte"}) à ${
        latest?.avgSys
      }/${latest?.avgDia}. Appel immédiat.`;
    }
    case "PENDING_UNCONFIRMED":
      return `Mesure ${latest?.avgSys}/${latest?.avgDia} non confirmée — le patient n'a pas remesuré.`;
    case "PENDING_AWAITING":
      return `Mesure ${latest?.avgSys}/${latest?.avgDia} en attente de confirmation.`;
    case "CRISIS_CONFIRMED":
      return `Mesure confirmée au niveau crise (≥ 180/120).`;
    case "ORANGE_REPEATED_HIGH": {
      const hits = last3
        .filter((s) => s.avgSys >= 160 || s.avgDia >= 100)
        .map((s) => `${s.avgSys}/${s.avgDia}`);
      return `${hits.length} des 3 dernières mesures au-dessus de 160/100 (${hits.join(", ")}).`;
    }
    case "ORANGE_REPEATED_LOW":
      return "Deux mesures basses avec vertiges sur les trois dernières.";
    case "SILENT":
      return `Aucune mesure depuis ${result.stats.silentDays} jours, attendu ${expected} par semaine.`;
    case "YELLOW_AVG":
      return `Moyenne à ${result.stats.avg7?.sys}/${result.stats.avg7?.dia}, au-dessus de la cible.`;
    case "YELLOW_TREND": {
      const m = /about (\d+) days/.exec(result.evidence);
      return `Tension systolique en hausse de ${frNum(
        result.stats.trendPerWeek ?? 0,
      )} mmHg/semaine ; cible dépassée dans ~${m?.[1] ?? "?"} jours.`;
    }
    case "YELLOW_PATTERN":
      return "Mesures plus hautes les jours d'oubli du traitement.";
    case "GREEN_INSUFFICIENT":
      return "Pas encore assez de mesures pour conclure.";
    default:
      return `Dans la cible (${result.stats.avg7?.sys}/${result.stats.avg7?.dia}).`;
  }
}

type Note = { id: string; title: string; body: string };

function notesFr(result: EvalResult, patient: PatientSeed, sessions: Session[]): Note[] {
  const stats = confirmedSorted(sessions);
  const avg = result.stats.avg7;
  const office = patient.lastOffice;

  return result.insights.map((ins) => {
    const title =
      ins.id === "WHITE_COAT"
        ? "Effet blouse blanche"
        : ins.id === "MASKED"
          ? "Hypertension masquée"
          : ins.id === "MISSED_PILL"
            ? "Traitement oublié"
            : ins.id === "TREND"
              ? "Tendance"
              : "Observance";

    let body = ins.body;

    if (ins.id === "WHITE_COAT" && avg && office) {
      body = `Domicile ${avg.sys}/${avg.dia} contre cabinet ${office.sys}/${office.dia} : effet blouse blanche probable.`;
    } else if (ins.id === "MASKED" && avg && office) {
      body = `Domicile ${avg.sys}/${avg.dia} contre cabinet ${office.sys}/${office.dia} : hypertension masquée possible.`;
    } else if (ins.id === "TREND") {
      const t = result.stats.trendPerWeek ?? 0;
      body =
        t > 0
          ? `Systolique en hausse de ${frNum(t)} mmHg/semaine sur 14 jours.`
          : `Systolique stable sur 14 jours (${frNum(t)} mmHg/semaine).`;
    } else if (ins.id === "ADHERENCE") {
      body = `${Math.round((result.stats.adherence ?? 0) * 100)} % des mesures signalées « traitement pris ».`;
    } else if (ins.id === "MISSED_PILL") {
      const pills = stats.filter((s) => s.pillTaken === true || s.pillTaken === false);
      const missed = pills.filter((s) => s.pillTaken === false);
      const taken = pills.filter((s) => s.pillTaken === true);
      if (missed.length && taken.length) {
        const diff = meanOf(missed.map((s) => s.avgSys)) - meanOf(taken.map((s) => s.avgSys));
        body = `Mesures ${diff} mmHg plus hautes les jours d'oubli (${meanOf(
          missed.map((s) => s.avgSys),
        )}/${meanOf(missed.map((s) => s.avgDia))} contre ${meanOf(
          taken.map((s) => s.avgSys),
        )}/${meanOf(taken.map((s) => s.avgDia))}, ${pills.length} mesures).`;
      }
    }

    return { id: ins.id, title, body };
  });
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export type PatientRecord = {
  id: string;
  name: string;
  age: number;
  sex: "F" | "M";
  phone: string;
  treatment: string;
  target: { sys: number; dia: number };
  expected: number;
  highRisk: boolean;
  lastOffice: { sys: number; dia: number; at: Date } | null;
  emergencyContact: string;
  notes: string;
  sessions: Session[];
  result: EvalResult;
  reason: string;
  insights: Note[];
  adherence: number | null;
  lastSession: Session | null;
  latestAny: Session | null;
};

export type RegistryRow = {
  id: string;
  name: string;
  age: number;
  sex: "F" | "M";
  level: EvalResult["level"];
  rank: number;
  reason: string;
  lastSys: number | null;
  lastDia: number | null;
  lastAt: string | null;
  pending: { sys: number; dia: number } | null;
  avgSys: number | null;
  avgDia: number | null;
  adherence: number | null;
  spark: number[];
  trendPerWeek: number | null;
  highRisk: boolean;
  notes: number;
};

const build = (seed: PatientSeed, now: Date): PatientRecord => {
  const sessions = mkSessions(now, seed.id, seed.seeds);
  const target = seed.target ?? { sys: 135, dia: 85 };
  const result = evaluatePatient({
    patient: {
      targetSys: target.sys,
      targetDia: target.dia,
      expectedReadingsPerWeek: seed.expected,
      highRisk: seed.highRisk,
      lastOfficeSys: seed.lastOffice?.sys ?? null,
      lastOfficeDia: seed.lastOffice?.dia ?? null,
    },
    sessions,
    now,
  });

  const confirmed = confirmedSorted(sessions);
  const last = confirmed.length ? confirmed[confirmed.length - 1] : null;
  const pills = confirmed.filter((s) => s.pillTaken === true || s.pillTaken === false);

  return {
    ...seed,
    target,
    lastOffice: seed.lastOffice
      ? { ...seed.lastOffice, at: daysAgo(now, seed.lastOffice.at, 10, 30) }
      : null,
    sessions,
    result,
    reason: reasonFr(result, sessions, seed.expected),
    insights: notesFr(result, seed, sessions),
    adherence: pills.length ? pills.filter((s) => s.pillTaken === true).length / pills.length : null,
    lastSession: last,
    latestAny: sessions.length
      ? [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()).at(-1)!
      : null,
  };
};

export function buildRegistry(now: Date): PatientRecord[] {
  return [...STORY, ...stablePatients()]
    .map((p) => build(p, now))
    .sort((a, b) => {
      if (a.result.rank !== b.result.rank) return a.result.rank - b.result.rank;
      const at = a.result.stats.lastSessionAt?.getTime() ?? 0;
      const bt = b.result.stats.lastSessionAt?.getTime() ?? 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name, "fr");
    });
}

export function getPatient(registry: PatientRecord[], id: string) {
  return registry.find((p) => p.id === id) ?? null;
}

export function toRow(p: PatientRecord): RegistryRow {
  const spark = confirmedSorted(p.sessions)
    .slice(-10)
    .map((s) => s.avgSys);

  return {
    id: p.id,
    name: p.name,
    age: p.age,
    sex: p.sex,
    level: p.result.level,
    rank: p.result.rank,
    reason: p.reason,
    lastSys: p.lastSession?.avgSys ?? null,
    lastDia: p.lastSession?.avgDia ?? null,
    lastAt: p.lastSession?.startedAt.toISOString() ?? null,
    pending:
      p.latestAny && p.latestAny.status === "PENDING"
        ? { sys: p.latestAny.avgSys, dia: p.latestAny.avgDia }
        : null,
    avgSys: p.result.stats.avg7?.sys ?? null,
    avgDia: p.result.stats.avg7?.dia ?? null,
    adherence: p.adherence,
    spark,
    trendPerWeek: p.result.stats.trendPerWeek,
    highRisk: p.highRisk,
    notes: p.insights.length,
  };
}

export function countByLevel(registry: PatientRecord[]) {
  const counts = {
    EMERGENCY: 0,
    CRISIS: 0,
    PENDING: 0,
    ORANGE: 0,
    YELLOW: 0,
    SILENT: 0,
    GREEN: 0,
  };
  for (const p of registry) counts[p.result.level]++;
  return counts;
}

/* ------------------------------------------------------------------ */
/* Indicators (synthetic, labelled as such)                            */
/* ------------------------------------------------------------------ */

export function buildIndicators(registry: PatientRecord[], now: Date) {
  const week = 7 * 86_400_000;
  const recent = registry.flatMap((p) =>
    confirmedSorted(p.sessions).filter((s) => now.getTime() - s.startedAt.getTime() <= week),
  );
  const frequency = recent.length / Math.max(registry.length, 1);

  const avgPool = registry
    .map((p) => p.result.stats.avg7)
    .filter((a): a is { sys: number; dia: number } => Boolean(a));
  const groupAvg = {
    sys: meanOf(avgPool.map((a) => a.sys)),
    dia: meanOf(avgPool.map((a) => a.dia)),
  };

  const counts = countByLevel(registry);
  const onTarget = counts.GREEN;
  const controlRate = onTarget / registry.length;

  const regular = registry.filter((p) => {
    const n = confirmedSorted(p.sessions).filter(
      (s) => now.getTime() - s.startedAt.getTime() <= week,
    ).length;
    return n >= Math.max(1, Math.round(p.expected * 0.7));
  }).length;

  return {
    frequency,
    groupAvg,
    counts,
    controlRate,
    regularity: regular / registry.length,
    totalReadings: registry.reduce((n, p) => n + p.sessions.length, 0),
    patients: registry.length,
  };
}
