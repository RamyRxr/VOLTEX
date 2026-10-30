/**
 * API contract as seen by the mobile app — mirrors CLAUDE.md §7 (data model) and §8 (API).
 * `packages/shared/src/schemas` is still empty; when Ramy publishes the Zod schemas there,
 * replace these hand-written types with the inferred ones (`z.infer<...>`).
 * Dates travel as ISO strings.
 */

export type Role = "PATIENT" | "DOCTOR";
export type Level = "EMERGENCY" | "SEVERE" | "HIGH" | "WATCH" | "SILENT" | "OK";
export type AlertLevel = Exclude<Level, "OK">;
export type RiskCategory = "LOW" | "MODERATE" | "HIGH";
export type LinkStatus = "PENDING" | "ACCEPTED" | "REFUSED";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "CLOSED";
export type MeasureSource = "MANUAL" | "DEVICE";
export type SessionStatus =
  | "NORMAL"
  | "HYPERTENSIVE"
  | "SEVERE_PENDING"
  | "SEVERE_CONFIRMED"
  | "SEVERE_NOT_CONFIRMED"
  | "SEVERE_EXPIRED";

export interface AuthSession {
  readonly accessToken: string;
  readonly userId: string;
  readonly role: Role;
}

/** Body of POST /api/patient/profile. Exactly one of dueDate / lmpDate is set. */
export interface PatientProfileInput {
  readonly birthDate: string;
  readonly dueDate: string | null;
  readonly lmpDate: string | null;
  readonly firstPregnancy: boolean;
  readonly multiplePregnancy: boolean;
  readonly chronicHypertension: boolean;
  readonly previousPreeclampsia: boolean;
  readonly preexistingDiabetes: boolean;
  readonly gestationalDiabetes: boolean;
  readonly kidneyDisease: boolean;
  readonly autoimmuneDisease: boolean;
  readonly familyPreeclampsia: boolean;
  readonly familyHypertension: boolean;
  readonly ivfPregnancy: boolean;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly treatments: string | null;
  readonly phone: string | null;
  readonly consentAt: string;
}

export interface PatientProfile extends PatientProfileInput {
  readonly id: string;
  readonly expectedSessionsPerDay: number;
}

/** GET /api/me */
export interface Me {
  readonly id: string;
  readonly role: Role;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly patient: PatientProfile | null;
  readonly doctor: { readonly id: string } | null;
}

export interface RiskFactor {
  readonly code: string;
  readonly label: string;
  readonly weight: "HIGH" | "MODERATE";
}

export interface Risk {
  readonly category: RiskCategory;
  readonly factors: readonly RiskFactor[];
  readonly reasons: readonly string[];
  readonly trigger: "PROFILE" | "SESSION" | "QUESTIONNAIRE";
  readonly createdAt: string;
}

/** `evaluation` shape returned with every new session or questionnaire (CLAUDE.md §8). */
export interface Evaluation {
  readonly level: Level;
  readonly patientWord: string;
  readonly icon: string;
  readonly color: string;
  readonly message: string;
  readonly action?: "CALL_EMERGENCY" | "REMEASURE";
  readonly remeasureInSeconds?: number;
}

export interface BpSession {
  readonly id: string;
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number | null;
  readonly takenAt: string;
  readonly source: MeasureSource;
  readonly status: SessionStatus;
}

export interface SessionInput {
  readonly sys: number;
  readonly dia: number;
  readonly pulse?: number;
  readonly takenAt?: string;
  readonly source?: MeasureSource;
}

export type Answers = Readonly<Record<string, boolean>>;

export interface Questionnaire {
  readonly id: string;
  readonly answers: Answers;
  readonly answeredAt: string;
}

/** GET /api/patient/link */
export interface LinkInfo {
  readonly status: LinkStatus | "NONE";
  readonly linkId: string | null;
  readonly doctorName: string | null;
}

/**
 * GET /api/doctor/alerts?status=… — the doctor's light mobile view.
 * Assumes the API embeds the patient's display name and pregnancy week (to confirm with Ramy).
 */
export interface DoctorAlert {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly pregnancyWeek: number | null;
  readonly level: AlertLevel;
  readonly evidence: string;
  readonly reason: string;
  readonly status: AlertStatus;
  readonly createdAt: string;
  readonly ackAt: string | null;
}

export interface ChatMessage {
  readonly id: string;
  readonly linkId: string;
  readonly senderId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface DateRange {
  readonly from?: string;
  readonly to?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
