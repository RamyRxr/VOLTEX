/** Fictional demo data (CLAUDE.md §12), rebuilt relative to `now` so it always looks fresh. */
import type { BpSession, ChatMessage, DoctorAlert, PatientProfile, Questionnaire, Risk, Role } from "../types";
import { ALL_ITEMS } from "@/lib/questionnaireItems";
import { toIsoDate } from "@/lib/pregnancy";
import { estimateRisk } from "./engine";

export interface MockUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly role: Role;
  readonly fullName: string;
  readonly phone: string | null;
}

export interface MockLink {
  readonly id: string;
  readonly status: "PENDING" | "ACCEPTED" | "REFUSED";
  readonly doctorUserId: string;
  readonly createdAt: string;
}

export interface MockDb {
  readonly version: 1;
  readonly users: MockUser[];
  readonly patients: Record<string, PatientProfile>;
  readonly sessions: Record<string, BpSession[]>;
  readonly questionnaires: Record<string, Questionnaire[]>;
  readonly risks: Record<string, Risk[]>;
  readonly links: Record<string, MockLink>;
  readonly messages: Record<string, ChatMessage[]>;
  readonly alerts: DoctorAlert[];
  readonly linkAttempts: Record<string, string[]>;
}

export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_PATIENT_EMAIL = "amina@demo.dz";
export const DEMO_DOCTOR_EMAIL = "docteur@demo.dz";
/** The invite code the demo doctor "gave" during the consultation. */
export const DEMO_INVITE_CODE = "K7M4PQ";

const DOCTOR_ID = "user-doctor-benali";
const AMINA_ID = "user-patient-amina";
const LINK_ID = "link-amina-benali";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Small deterministic generator so the demo looks the same on every reset. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function aminaSessions(now: Date): BpSession[] {
  const rand = seeded(42);
  const out: BpSession[] = [];
  for (let day = 13; day >= 0; day -= 1) {
    for (const hour of [8, 20]) {
      const at = new Date(now.getTime() - day * DAY);
      at.setHours(hour, Math.floor(rand() * 40), 0, 0);
      if (at.getTime() > now.getTime()) continue;
      out.push({
        id: `s-amina-${day}-${hour}`,
        sys: 110 + Math.round(rand() * 14),
        dia: 70 + Math.round(rand() * 10),
        pulse: 76 + Math.round(rand() * 12),
        takenAt: at.toISOString(),
        source: "MANUAL",
        status: "NORMAL",
      });
    }
  }
  return out;
}

function aminaQuestionnaires(now: Date): Questionnaire[] {
  const noToAll = Object.fromEntries(ALL_ITEMS.map((item) => [item, false]));
  const out: Questionnaire[] = [];
  for (let day = 13; day >= 1; day -= 1) {
    const at = new Date(now.getTime() - day * DAY);
    at.setHours(19, 10, 0, 0);
    const answers = day === 6 ? { ...noToAll, UNUSUAL_FATIGUE: true } : noToAll;
    out.push({ id: `q-amina-${day}`, answers, answeredAt: at.toISOString() });
  }
  return out;
}

function demoAlerts(now: Date): DoctorAlert[] {
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();
  const alert = (
    id: string,
    patientName: string,
    pregnancyWeek: number,
    level: DoctorAlert["level"],
    evidence: string,
    reason: string,
    hours: number,
  ): DoctorAlert => ({
    id,
    patientId: `patient-${id}`,
    patientName,
    pregnancyWeek,
    level,
    evidence,
    reason,
    status: "OPEN",
    createdAt: ago(hours),
    ackAt: null,
  });
  return [
    alert("nour", "Nour B.", 35, "SEVERE", "UNCONFIRMED_SEVERE", "Mesure sévère non confirmée : 165/112, pas de nouvelle mesure", 2),
    alert("meriem", "Meriem K.", 22, "HIGH", "TWO_OF_THREE", "2 des 3 dernières mesures ≥ 140/90 (dernière 146/94)", 5),
    alert("lina", "Lina S.", 33, "WATCH", "TREND", "Systolique en hausse sur 14 jours (+4 mmHg/semaine)", 20),
    alert("yasmine", "Yasmine A.", 29, "SILENT", "SILENCE", "Aucune mesure depuis 3 jours (2 attendues par jour)", 30),
  ];
}

export function buildSeed(now: Date): MockDb {
  const due = new Date(now.getTime() + (40 - 31) * 7 * DAY - 2 * DAY); // Amina: 31 weeks today
  const amina: PatientProfile = {
    id: "patient-amina",
    birthDate: toIsoDate(new Date(now.getFullYear() - 29, 2, 14)),
    dueDate: toIsoDate(due),
    lmpDate: null,
    firstPregnancy: true,
    multiplePregnancy: false,
    chronicHypertension: false,
    previousPreeclampsia: false,
    preexistingDiabetes: false,
    gestationalDiabetes: false,
    kidneyDisease: false,
    autoimmuneDisease: false,
    familyPreeclampsia: false,
    familyHypertension: true,
    ivfPregnancy: false,
    heightCm: 165,
    weightKg: 68,
    treatments: null,
    phone: "0550 00 00 00",
    consentAt: new Date(now.getTime() - 20 * DAY).toISOString(),
    expectedSessionsPerDay: 2,
  };
  const sessions = aminaSessions(now);
  const questionnaires = aminaQuestionnaires(now);
  const initial = estimateRisk(amina, [], [], "PROFILE", new Date(now.getTime() - 20 * DAY));

  const messages: ChatMessage[] = [
    {
      id: "m1",
      linkId: LINK_ID,
      senderId: DOCTOR_ID,
      body: "Bonjour Amina, j'ai bien reçu vos mesures. Continuez matin et soir, au calme et assise.",
      createdAt: new Date(now.getTime() - 3 * DAY).toISOString(),
    },
    {
      id: "m2",
      linkId: LINK_ID,
      senderId: AMINA_ID,
      body: "Merci docteur, c'est noté.",
      createdAt: new Date(now.getTime() - 3 * DAY + 20 * 60_000).toISOString(),
    },
  ];

  return {
    version: 1,
    users: [
      { id: AMINA_ID, email: DEMO_PATIENT_EMAIL, password: DEMO_PASSWORD, role: "PATIENT", fullName: "Amina Belkacem", phone: amina.phone },
      { id: DOCTOR_ID, email: DEMO_DOCTOR_EMAIL, password: DEMO_PASSWORD, role: "DOCTOR", fullName: "Dr Samia Benali", phone: null },
    ],
    patients: { [AMINA_ID]: amina },
    sessions: { [AMINA_ID]: sessions },
    questionnaires: { [AMINA_ID]: questionnaires },
    risks: { [AMINA_ID]: [initial] },
    links: { [AMINA_ID]: { id: LINK_ID, status: "ACCEPTED", doctorUserId: DOCTOR_ID, createdAt: new Date(now.getTime() - 19 * DAY).toISOString() } },
    messages: { [LINK_ID]: messages },
    alerts: demoAlerts(now),
    linkAttempts: {},
  };
}

export const DEMO_DOCTOR_ID = DOCTOR_ID;
