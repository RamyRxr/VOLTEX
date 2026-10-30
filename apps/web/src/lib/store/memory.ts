import type {
  AdviceRow,
  AlertRow,
  DoctorRow,
  MessageRow,
  PatientRow,
  ReadingRow,
  Repo,
  SessionRow,
  SessionWithDetails,
  SymptomRow,
  UserRow,
} from "./types";

/**
 * In-memory implementation of Repo, for the demo until the Neon database is
 * wired. Tables are replaced, never mutated in place. State lives in one
 * process: run `next start` on one machine (see README).
 */
export interface Db {
  users: readonly UserRow[];
  doctors: readonly DoctorRow[];
  patients: readonly PatientRow[];
  sessions: readonly SessionRow[];
  readings: readonly ReadingRow[];
  symptoms: readonly SymptomRow[];
  alerts: readonly AlertRow[];
  messages: readonly MessageRow[];
  advice: readonly AdviceRow[];
  seq: number;
}

export function emptyDb(): Db {
  return {
    users: [],
    doctors: [],
    patients: [],
    sessions: [],
    readings: [],
    symptoms: [],
    alerts: [],
    messages: [],
    advice: [],
    seq: 0,
  };
}

const replaceById = <T extends { id: string }>(rows: readonly T[], id: string, patch: NoInfer<Partial<T>>): T[] => {
  if (!rows.some((r) => r.id === id)) throw new Error(`Row not found: ${id}`);
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
};

/** Group rows by sessionId, rebuilt only when the table array is replaced. */
function indexBySession<T extends { sessionId: string }>() {
  let source: readonly T[] | null = null;
  let map = new Map<string, T[]>();
  return (rows: readonly T[], sessionId: string): readonly T[] => {
    if (rows !== source) {
      map = new Map();
      for (const r of rows) map.set(r.sessionId, [...(map.get(r.sessionId) ?? []), r]);
      source = rows;
    }
    return map.get(sessionId) ?? [];
  };
}

export function createMemoryRepo(db: Db): Repo {
  const nextId = (prefix: string) => {
    db.seq += 1;
    return `${prefix}_${db.seq.toString(36).padStart(5, "0")}`;
  };

  const readingsOf = indexBySession<ReadingRow>();
  const symptomsOf = indexBySession<SymptomRow>();
  const withDetails = (s: SessionRow): SessionWithDetails => ({
    ...s,
    readings: [...readingsOf(db.readings, s.id)].sort((a, b) => a.readingIndex - b.readingIndex),
    symptoms: symptomsOf(db.symptoms, s.id).map((x) => x.type),
  });

  return {
    async findUserByPhone(phone) {
      return db.users.find((u) => u.phone === phone) ?? null;
    },
    async getUser(id) {
      return db.users.find((u) => u.id === id) ?? null;
    },
    async createUser(data) {
      if (db.users.some((u) => u.phone === data.phone)) throw new Error("Phone already registered");
      const row = { ...data, id: nextId("usr") };
      db.users = [...db.users, row];
      return row;
    },

    async getDoctor(id) {
      return db.doctors.find((d) => d.id === id) ?? null;
    },
    async getDoctorByUserId(userId) {
      return db.doctors.find((d) => d.userId === userId) ?? null;
    },
    async findDoctorByInviteCode(code) {
      return db.doctors.find((d) => d.inviteCode === code) ?? null;
    },
    async createDoctor(data) {
      const row = { ...data, id: nextId("doc") };
      db.doctors = [...db.doctors, row];
      return row;
    },

    async getPatient(id) {
      return db.patients.find((p) => p.id === id) ?? null;
    },
    async getPatientByUserId(userId) {
      return db.patients.find((p) => p.userId === userId) ?? null;
    },
    async listPatients(doctorId) {
      return db.patients.filter((p) => doctorId == null || p.doctorId === doctorId);
    },
    async createPatient(data) {
      const row = { ...data, id: nextId("pat") };
      db.patients = [...db.patients, row];
      return row;
    },
    async updatePatient(id, patch) {
      db.patients = replaceById(db.patients, id, patch);
      return db.patients.find((p) => p.id === id) as PatientRow;
    },

    async listSessions(patientId) {
      return db.sessions
        .filter((s) => s.patientId === patientId)
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .map(withDetails);
    },
    async createSession({ session, readings, symptoms }) {
      const row: SessionRow = { ...session, id: nextId("ses") };
      db.sessions = [...db.sessions, row];
      db.readings = [...db.readings, ...readings.map((r) => ({ ...r, id: nextId("rdg"), sessionId: row.id }))];
      db.symptoms = [...db.symptoms, ...symptoms.map((type) => ({ id: nextId("sym"), sessionId: row.id, type }))];
      return withDetails(row);
    },
    async updateSession(id, patch) {
      db.sessions = replaceById(db.sessions, id, patch);
    },

    async listAlerts(patientIds) {
      const ids = new Set(patientIds);
      return db.alerts.filter((a) => ids.has(a.patientId));
    },
    async getAlert(id) {
      return db.alerts.find((a) => a.id === id) ?? null;
    },
    async createAlert(data) {
      const row = { ...data, id: nextId("alr") };
      db.alerts = [...db.alerts, row];
      return row;
    },
    async updateAlert(id, patch) {
      db.alerts = replaceById(db.alerts, id, patch);
      return db.alerts.find((a) => a.id === id) as AlertRow;
    },

    async createMessage(data) {
      const row = { ...data, id: nextId("msg") };
      db.messages = [...db.messages, row];
      return row;
    },
    async listMessagesBetween(userA, userB) {
      return db.messages
        .filter(
          (m) =>
            (m.fromUserId === userA && m.toUserId === userB) || (m.fromUserId === userB && m.toUserId === userA),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    async findAdvice(situation, language) {
      return (
        db.advice.find((a) => a.situation === situation && a.language === language) ??
        db.advice.find((a) => a.situation === situation && a.language === "FR") ??
        null
      );
    },
    async createAdvice(data) {
      const row = { ...data, id: nextId("adv") };
      db.advice = [...db.advice, row];
      return row;
    },
  };
}
