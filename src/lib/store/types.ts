/**
 * Row types mirroring the Prisma schema of CLAUDE.md §7 field for field,
 * so the in-memory store can be swapped for Prisma without touching services.
 */
import type {
  AlertEvidence,
  AlertLevel,
  AlertStatus,
  Channel,
  PillStatus,
  SessionStatus,
  SymptomType,
} from "@/lib/domain/types";
import type { Lang } from "@/lib/i18n";

export type Role = "PATIENT" | "DOCTOR";
export type Sex = "F" | "M";
export type Language = Lang;

export interface UserRow {
  readonly id: string;
  readonly role: Role;
  readonly phone: string;
  readonly name: string;
  readonly language: Language;
  readonly createdAt: Date;
}

export interface DoctorRow {
  readonly id: string;
  readonly userId: string;
  readonly inviteCode: string;
  readonly backupContactPhone: string | null;
  readonly digestTime: string;
}

export interface PatientRow {
  readonly id: string;
  readonly userId: string;
  readonly doctorId: string;
  readonly age: number;
  readonly sex: Sex;
  readonly treatmentNames: readonly string[];
  readonly targetSys: number | null;
  readonly targetDia: number | null;
  readonly expectedReadingsPerWeek: number;
  readonly emergencyContactPhone: string | null;
  readonly lastOfficeSys: number | null;
  readonly lastOfficeDia: number | null;
  readonly doctorNotes: string | null;
  readonly consentAt: Date;
  readonly summary: string | null;
}

export interface SessionRow {
  readonly id: string;
  readonly patientId: string;
  readonly channel: Channel;
  readonly startedAt: Date;
  readonly avgSys: number;
  readonly avgDia: number;
  readonly avgPulse: number | null;
  readonly pillStatus: PillStatus;
  readonly status: SessionStatus;
  readonly confirmedBySessionId: string | null;
  readonly rawSms: string | null;
}

export interface ReadingRow {
  readonly id: string;
  readonly sessionId: string;
  readonly readingIndex: number;
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number | null;
  readonly takenAt: Date;
}

export interface SymptomRow {
  readonly id: string;
  readonly sessionId: string;
  readonly type: SymptomType;
}

export interface AlertRow {
  readonly id: string;
  readonly patientId: string;
  readonly sessionId: string | null;
  readonly level: AlertLevel;
  readonly evidence: AlertEvidence;
  readonly reason: string;
  readonly status: AlertStatus;
  readonly createdAt: Date;
  readonly ackAt: Date | null;
}

export interface MessageRow {
  readonly id: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly body: string;
  readonly createdAt: Date;
}

export interface AdviceRow {
  readonly id: string;
  readonly situation: string;
  readonly language: Language;
  readonly text: string;
  readonly darijaExample: string | null;
  readonly reviewedBy: string | null;
}

/** A session with its readings and symptoms (Prisma `include`). */
export interface SessionWithDetails extends SessionRow {
  readonly readings: readonly ReadingRow[];
  readonly symptoms: readonly SymptomType[];
}

type New<T extends { id: string }> = Omit<T, "id">;

export type NewUser = New<UserRow>;
export type NewDoctor = New<DoctorRow>;
export type NewPatient = New<PatientRow>;
export type NewAlert = New<AlertRow>;
export type NewMessage = New<MessageRow>;
export type NewAdvice = New<AdviceRow>;
export interface NewSession {
  readonly session: New<SessionRow>;
  readonly readings: readonly Omit<ReadingRow, "id" | "sessionId">[];
  readonly symptoms: readonly SymptomType[];
}

export type PatientPatch = Partial<
  Pick<
    PatientRow,
    "targetSys" | "targetDia" | "expectedReadingsPerWeek" | "lastOfficeSys" | "lastOfficeDia" | "doctorNotes"
  >
>;
export type SessionPatch = Partial<Pick<SessionRow, "status" | "confirmedBySessionId">>;
export type AlertPatch = Partial<Pick<AlertRow, "status" | "ackAt" | "reason" | "sessionId">>;

/** Data access used by every service. Implemented in memory today, by Prisma tomorrow. */
export interface Repo {
  findUserByPhone(phone: string): Promise<UserRow | null>;
  getUser(id: string): Promise<UserRow | null>;
  createUser(data: NewUser): Promise<UserRow>;

  getDoctor(id: string): Promise<DoctorRow | null>;
  getDoctorByUserId(userId: string): Promise<DoctorRow | null>;
  findDoctorByInviteCode(code: string): Promise<DoctorRow | null>;
  createDoctor(data: NewDoctor): Promise<DoctorRow>;

  getPatient(id: string): Promise<PatientRow | null>;
  getPatientByUserId(userId: string): Promise<PatientRow | null>;
  listPatients(doctorId?: string): Promise<PatientRow[]>;
  createPatient(data: NewPatient): Promise<PatientRow>;
  updatePatient(id: string, patch: PatientPatch): Promise<PatientRow>;

  listSessions(patientId: string): Promise<SessionWithDetails[]>;
  createSession(data: NewSession): Promise<SessionWithDetails>;
  updateSession(id: string, patch: SessionPatch): Promise<void>;

  listAlerts(patientIds: readonly string[]): Promise<AlertRow[]>;
  getAlert(id: string): Promise<AlertRow | null>;
  createAlert(data: NewAlert): Promise<AlertRow>;
  updateAlert(id: string, patch: AlertPatch): Promise<AlertRow>;

  createMessage(data: NewMessage): Promise<MessageRow>;
  listMessagesBetween(userA: string, userB: string): Promise<MessageRow[]>;

  findAdvice(situation: string, language: Language): Promise<AdviceRow | null>;
  createAdvice(data: NewAdvice): Promise<AdviceRow>;
}
