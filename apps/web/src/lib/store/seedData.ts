/**
 * Demo content (spec §12): story patients, stable patients, approved
 * advice texts. Only raw measurements live here; every level, alert and
 * reason is produced by replaying them through the real ingestion service.
 */
import type { AdviceSituation } from "@/lib/domain/advice";
import type { Channel, PillStatus, SymptomType } from "@/lib/domain/types";
import type { Sex } from "./types";

export interface SeedEvent {
  /** Days before seeding time. */
  readonly d: number;
  /** Extra hours before that, to vary the time of day. */
  readonly h: number;
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number;
  readonly channel?: Channel;
  readonly pill?: PillStatus;
  readonly symptoms?: readonly SymptomType[];
  /** A confirming session 10 minutes later with these values. */
  readonly confirm?: { readonly sys: number; readonly dia: number };
  /** Minutes the doctor took to acknowledge the red alert this event raises. */
  readonly ackAfterMinutes?: number;
}

export interface SeedPatient {
  readonly key: string;
  readonly name: string;
  readonly age: number;
  readonly sex: Sex;
  readonly phone: string;
  readonly treatment: readonly string[];
  readonly expected: number;
  readonly office: { readonly sys: number; readonly dia: number } | null;
  readonly emergency: string | null;
  readonly notes: string | null;
  readonly events: readonly SeedEvent[];
}

export const DEMO_DOCTOR = {
  name: "Dr Amine Benali",
  phone: "0550000000",
  inviteCode: "DEMO01",
  backupContactPhone: "0550000099",
  digestTime: "08:00",
} as const;

export const ADVICE_FR: Readonly<Record<AdviceSituation, string>> = {
  DANGER: "Appelez le 14 maintenant. Restez assis et ne restez pas seul.",
  HIGH_UNCONFIRMED: "Restez assis, au calme, sans parler. Après le repos, refaites deux mesures.",
  LOW_UNCONFIRMED: "Asseyez-vous ou allongez-vous au calme. Après le repos, refaites deux mesures.",
  CRISIS_CONFIRMED:
    "Votre tension est très élevée. Votre médecin a été prévenu : restez joignable et contactez-le aujourd'hui. Si une douleur dans la poitrine, un trouble de la vue ou de la parole apparaît, appelez le 14.",
  HIGH_CONFIRMED:
    "Votre tension est élevée. Votre médecin a été informé. Continuez votre traitement comme il a été prescrit et mesurez à nouveau demain.",
  HIGH_SINGLE:
    "Votre tension est élevée. Reposez-vous, prenez votre traitement comme il a été prescrit et mesurez à nouveau demain. Votre médecin suit vos mesures.",
  LOW_CONFIRMED: "Votre tension est basse. Levez-vous lentement. Votre médecin a été informé.",
  LOW_SINGLE: "Votre tension est basse. Levez-vous lentement. Si des vertiges apparaissent, asseyez-vous et parlez-en à votre médecin.",
  ABOVE_TARGET:
    "Votre tension est un peu au-dessus de votre objectif. Continuez votre traitement, limitez le sel et mesurez régulièrement.",
  MISSED_PILL:
    "Pensez à prendre votre traitement chaque jour, comme il a été prescrit. En cas de doute, demandez à votre médecin.",
  SILENT: "Vous n'avez pas mesuré depuis quelques jours. Une mesure aujourd'hui aide votre médecin à suivre votre tension.",
  GREEN: "Bon, continuez ainsi.",
};

const ev = (d: number, h: number, sys: number, dia: number, pulse: number, extra: Partial<SeedEvent> = {}): SeedEvent => ({
  d,
  h,
  sys,
  dia,
  pulse,
  ...extra,
});

/** Mohamed: systolic rising ~2 mmHg/week over 3 weeks, always under target. */
const RISING_JITTER = [0, 1, -1] as const;
const mohamedEvents: SeedEvent[] = Array.from({ length: 21 }, (_, i) => {
  const d = 21 - i;
  return ev(d, 1, Math.round(121 + 0.29 * i) + RISING_JITTER[d % 3], Math.min(82, Math.round(78 + 0.2 * i)), 74 + (i % 3), {
    pill: "TAKEN",
  });
});

export const STORY_PATIENTS: readonly SeedPatient[] = [
  {
    key: "fatima",
    name: "Fatima Boudiaf",
    age: 58,
    sex: "F",
    phone: "0555000002",
    treatment: ["Amlodipine 5 mg"],
    expected: 7,
    office: { sys: 152, dia: 96 },
    emergency: "0661000021",
    notes: "Traitée depuis 2019. Observance irrégulière signalée en consultation. Vit seule, deux enfants à l'étranger.",
    events: [
      ev(21, 1, 128, 80, 76, { pill: "TAKEN" }),
      ev(19, 2, 130, 82, 77, { pill: "TAKEN" }),
      ev(17, 1, 127, 79, 75, { pill: "TAKEN" }),
      ev(15, 1, 129, 81, 78, { pill: "TAKEN" }),
      ev(13, 2, 131, 82, 77, { pill: "TAKEN" }),
      ev(12, 1, 133, 84, 79, { pill: "MISSED" }),
      ev(11, 1, 128, 80, 76, { pill: "TAKEN" }),
      ev(10, 2, 138, 86, 80, { pill: "MISSED", confirm: { sys: 137, dia: 86 } }),
      ev(9, 1, 130, 81, 77, { pill: "TAKEN" }),
      ev(8, 1, 142, 88, 81, { pill: "MISSED", confirm: { sys: 141, dia: 88 } }),
      ev(6, 2, 131, 82, 78, { pill: "TAKEN" }),
      ev(5, 1, 129, 81, 77, { pill: "TAKEN" }),
      ev(3, 1, 162, 101, 86, { pill: "MISSED", confirm: { sys: 161, dia: 100 } }),
      ev(2, 2, 150, 94, 84, { pill: "MISSED", confirm: { sys: 149, dia: 93 } }),
      ev(1, 1, 166, 102, 88, { pill: "MISSED", confirm: { sys: 165, dia: 101 } }),
    ],
  },
  {
    key: "mohamed",
    name: "Mohamed Cherif",
    age: 71,
    sex: "M",
    phone: "0555000003",
    treatment: ["Périndopril 5 mg"],
    expected: 7,
    office: { sys: 132, dia: 82 },
    emergency: "0661000031",
    notes: "Diabète de type 2 associé. Cible tensionnelle stricte. Mesure à domicile tous les matins.",
    events: mohamedEvents,
  },
  {
    key: "karim",
    name: "Karim Haddad",
    age: 49,
    sex: "M",
    phone: "0555000004",
    treatment: ["Amlodipine 5 mg"],
    expected: 3,
    office: { sys: 148, dia: 92 },
    emergency: "0661000041",
    notes: "Tension élevée au cabinet, toujours normale à domicile. Pas d'antécédent familial. Sport trois fois par semaine.",
    events: [
      ev(13, 2, 130, 82, 72, { pill: "TAKEN" }),
      ev(11, 1, 132, 83, 74, { pill: "TAKEN" }),
      ev(9, 2, 131, 82, 71, { pill: "TAKEN", channel: "SMS" }),
      ev(6, 1, 130, 82, 72, { pill: "TAKEN" }),
      ev(5, 2, 133, 84, 74, { pill: "TAKEN" }),
      ev(3, 1, 129, 81, 71, { pill: "TAKEN", channel: "SMS" }),
      ev(2, 2, 132, 83, 73, { pill: "TAKEN" }),
    ],
  },
  {
    key: "zohra",
    name: "Zohra Meziane",
    age: 64,
    sex: "F",
    phone: "0555000005",
    treatment: ["Valsartan 80 mg"],
    expected: 2,
    office: { sys: 136, dia: 84 },
    emergency: "0661000051",
    notes: "Vit avec sa fille. Téléphone à clavier, pas de smartphone : mesures par SMS.",
    events: [
      ev(26, 2, 129, 81, 78, { channel: "SMS", pill: "TAKEN" }),
      ev(23, 1, 131, 82, 77, { channel: "SMS", pill: "NOT_REPORTED" }),
      ev(19, 2, 128, 80, 79, { channel: "SMS", pill: "TAKEN" }),
      ev(16, 1, 130, 81, 78, { channel: "SMS", pill: "NOT_REPORTED" }),
      ev(12, 2, 129, 80, 77, { channel: "SMS", pill: "TAKEN" }),
      ev(9, 1, 131, 82, 78, { channel: "SMS", pill: "TAKEN" }),
    ],
  },
  {
    key: "ahmed",
    name: "Ahmed Saidi",
    age: 62,
    sex: "M",
    phone: "0555000006",
    treatment: ["Périndopril 10 mg"],
    expected: 7,
    office: { sys: 138, dia: 86 },
    emergency: "0661000061",
    notes: "Contrôlé depuis six mois. Mesure chaque matin avant le café, appareil vérifié au cabinet.",
    events: [
      ev(10, 1, 132, 84, 76, { pill: "TAKEN" }),
      ev(8, 2, 130, 83, 75, { pill: "TAKEN" }),
      ev(6, 1, 134, 84, 77, { pill: "TAKEN" }),
      ev(4, 1, 131, 84, 76, { pill: "TAKEN" }),
      ev(2, 2, 133, 84, 77, { pill: "TAKEN" }),
      ev(1, 1, 131, 83, 76, { pill: "TAKEN" }),
    ],
  },
  {
    key: "nadia",
    name: "Nadia Bensalem",
    age: 67,
    sex: "F",
    phone: "0555000007",
    treatment: ["Amlodipine 10 mg", "Hydrochlorothiazide 12,5 mg"],
    expected: 2,
    office: { sys: 134, dia: 84 },
    emergency: "0661000071",
    notes: "Antécédent d'AVC en 2021. Vit avec son mari, qui l'aide pour les mesures.",
    events: [
      ev(16, 2, 128, 80, 80, { pill: "TAKEN" }),
      ev(13, 1, 130, 81, 79, { pill: "TAKEN" }),
      ev(10, 2, 127, 80, 81, { pill: "TAKEN" }),
      ev(6, 1, 129, 81, 80, { pill: "TAKEN" }),
      ev(4, 2, 128, 80, 79, { pill: "TAKEN" }),
      ev(2, 3, 195, 125, 96, { pill: "TAKEN" }),
    ],
  },
];

/** Stable patients: names, sex, and an optional story in their past. */
export interface StableSpec {
  readonly name: string;
  readonly sex: Sex;
  /** Above target 8 to 5 weeks ago, controlled since: the control-rate story. */
  readonly improving?: boolean;
  /** A past red event, acknowledged by the doctor after `ackAfterMinutes`. */
  readonly redEvent?: SeedEvent;
}

export const STABLE_SPECS: readonly StableSpec[] = [
  { name: "Houria Cherif", sex: "F" },
  { name: "Samir Ouali", sex: "M" },
  { name: "Leila Hamdi", sex: "F", improving: true },
  {
    name: "Rachid Bouzid",
    sex: "M",
    redEvent: ev(35, 2, 148, 92, 94, { symptoms: ["CHEST_PAIN"], pill: "TAKEN", ackAfterMinutes: 4 }),
  },
  { name: "Souad Khelifi", sex: "F" },
  {
    name: "Hocine Mansouri",
    sex: "M",
    redEvent: ev(28, 1, 184, 112, 92, { pill: "MISSED", confirm: { sys: 182, dia: 111 }, ackAfterMinutes: 7 }),
  },
  {
    name: "Farida Zerrouki",
    sex: "F",
    redEvent: ev(21, 2, 186, 114, 95, { pill: "TAKEN", confirm: { sys: 183, dia: 112 }, ackAfterMinutes: 5 }),
  },
  { name: "Mourad Belkacem", sex: "M", improving: true },
  { name: "Djamila Saidi", sex: "F" },
  {
    name: "Abderrahmane Ait Ali",
    sex: "M",
    redEvent: ev(42, 1, 150, 94, 90, { symptoms: ["VISION"], pill: "TAKEN", ackAfterMinutes: 12 }),
  },
  { name: "Salima Boudiaf", sex: "F" },
  { name: "Kamel Haddad", sex: "M" },
  { name: "Nassima Ouali", sex: "F", improving: true },
  { name: "Belkacem Meziane", sex: "M" },
  { name: "Warda Khelifi", sex: "F" },
  { name: "Tarek Benali", sex: "M" },
  { name: "Malika Bouzid", sex: "F" },
  { name: "Lounis Hamdi", sex: "M" },
  { name: "Soumia Zerrouki", sex: "F" },
  { name: "Reda Mansouri", sex: "M", improving: true },
  { name: "Yasmina Ait Ali", sex: "F" },
  { name: "Brahim Saidi", sex: "M" },
  { name: "Yamina Belkacem", sex: "F" },
  { name: "Samia Larbi", sex: "F" },
];

export const TREATMENTS: readonly string[] = ["Amlodipine 5 mg", "Périndopril 5 mg", "Valsartan 80 mg", "Ramipril 5 mg"];

/** Seeded doctor ↔ patient conversations (content, not UI strings). */
export const SEED_MESSAGES: readonly { patientKey: string; fromDoctor: boolean; d: number; h: number; body: string }[] = [
  {
    patientKey: "fatima",
    fromDoctor: false,
    d: 3,
    h: 3,
    body: "Bonjour docteur, j'ai oublié mon médicament plusieurs jours, je n'avais plus de boîte.",
  },
  {
    patientKey: "fatima",
    fromDoctor: true,
    d: 3,
    h: 1,
    body: "Bonjour Madame, reprenez votre traitement dès aujourd'hui et mesurez chaque matin. Nous en parlerons jeudi au cabinet.",
  },
  {
    patientKey: "karim",
    fromDoctor: true,
    d: 9,
    h: 4,
    body: "Vos mesures à domicile sont bonnes. On garde le traitement actuel, on en reparle au prochain rendez-vous.",
  },
];
