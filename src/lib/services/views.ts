/**
 * JSON-safe shapes returned by the API and passed from server pages to client
 * components. Dates are ISO strings. The patient view never carries doctor
 * notes, alert reasons or internal levels.
 */
import type { PatientStatus } from "@/lib/domain/levels";
import type {
  AlertEvidence,
  AlertLevel,
  AlertStatus,
  BP,
  Channel,
  Level,
  PillStatus,
  SessionStatus,
  SymptomType,
} from "@/lib/domain/types";
import type { AlertRow, Language, MessageRow, SessionWithDetails, Sex } from "@/lib/store/types";

export interface SessionDto {
  readonly id: string;
  readonly startedAt: string;
  readonly channel: Channel;
  readonly avgSys: number;
  readonly avgDia: number;
  readonly avgPulse: number | null;
  readonly pillStatus: PillStatus;
  readonly status: SessionStatus;
  readonly confirmedBySessionId: string | null;
  readonly symptoms: readonly SymptomType[];
  readonly readings: readonly { sys: number; dia: number; pulse: number | null; takenAt: string }[];
}

export interface AlertDto {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly sessionId: string | null;
  readonly level: AlertLevel;
  readonly evidence: AlertEvidence;
  readonly reason: string;
  readonly status: AlertStatus;
  readonly createdAt: string;
  readonly ackAt: string | null;
}

export interface MessageDto {
  readonly id: string;
  readonly from: "DOCTOR" | "PATIENT";
  readonly body: string;
  readonly createdAt: string;
}

export type TriageGroup = "EMERGENCY" | "CRISIS" | "ORANGE" | "YELLOW" | "UNCONFIRMED" | "SILENT" | "GREEN";

export interface TriageRowDto {
  readonly patientId: string;
  readonly name: string;
  readonly age: number;
  readonly sex: Sex;
  readonly level: Level;
  readonly group: TriageGroup;
  readonly reason: string;
  readonly silent: { readonly days: number; readonly text: string } | null;
  readonly unconfirmed: { readonly bp: BP; readonly awaiting: boolean } | null;
  readonly last: { readonly sys: number; readonly dia: number; readonly at: string; readonly status: SessionStatus; readonly channel: Channel } | null;
  readonly avg7: BP | null;
  readonly trend: { readonly direction: "up" | "down" | "flat"; readonly perWeek: number } | null;
  readonly adherence: number | null;
  readonly spark: readonly number[];
  readonly alert: { readonly id: string; readonly level: AlertLevel; readonly status: AlertStatus; readonly createdAt: string } | null;
}

export interface TriageDto {
  readonly rows: readonly TriageRowDto[];
  readonly counts: Readonly<Record<TriageGroup, number>>;
  readonly receivedToday: number;
  readonly openRedAlerts: readonly AlertDto[];
  /** Daily digest time of the doctor ("08:00"). */
  readonly digestTime: string;
  readonly generatedAt: string;
}

export interface InfoLineDto {
  readonly id: "missedPill" | "office" | "trend" | "adherence" | "silence";
  readonly text: string;
  /** Lines that explain a flag are highlighted; context lines are not. */
  readonly emphasis: boolean;
}

export interface UnconfirmedDto {
  readonly id: string;
  readonly startedAt: string;
  readonly bp: BP;
  readonly status: SessionStatus;
  readonly text: string;
}

export interface DoctorPatientView {
  readonly patient: {
    readonly id: string;
    readonly name: string;
    readonly age: number;
    readonly sex: Sex;
    readonly phone: string;
    readonly language: Language;
    readonly treatmentNames: readonly string[];
    readonly target: BP;
    readonly targetSys: number | null;
    readonly targetDia: number | null;
    readonly expectedReadingsPerWeek: number;
    readonly lastOfficeSys: number | null;
    readonly lastOfficeDia: number | null;
    readonly emergencyContactPhone: string | null;
    readonly doctorNotes: string | null;
    readonly consentAt: string;
  };
  readonly level: Level;
  readonly reason: string;
  readonly followUp: boolean;
  readonly info: readonly InfoLineDto[];
  readonly unconfirmed: readonly UnconfirmedDto[];
  readonly avg7: BP | null;
  readonly sessions: readonly SessionDto[];
  readonly alerts: readonly AlertDto[];
  readonly messages: readonly MessageDto[];
  readonly generatedAt: string;
}

export interface PatientSelfView {
  readonly patientId: string;
  readonly firstName: string;
  readonly status: PatientStatus;
  readonly advice: string;
  readonly target: BP;
  readonly expectedReadingsPerWeek: number;
  readonly weekCount: number;
  readonly last: SessionDto | null;
  readonly sessions: readonly SessionDto[];
  readonly doctor: { readonly name: string; readonly phone: string };
  readonly messages: readonly MessageDto[];
  readonly generatedAt: string;
}

export function sessionDto(s: SessionWithDetails): SessionDto {
  return {
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    channel: s.channel,
    avgSys: s.avgSys,
    avgDia: s.avgDia,
    avgPulse: s.avgPulse,
    pillStatus: s.pillStatus,
    status: s.status,
    confirmedBySessionId: s.confirmedBySessionId,
    symptoms: s.symptoms,
    readings: s.readings.map((r) => ({ sys: r.sys, dia: r.dia, pulse: r.pulse, takenAt: r.takenAt.toISOString() })),
  };
}

export function alertDto(a: AlertRow, patientName: string): AlertDto {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName,
    sessionId: a.sessionId,
    level: a.level,
    evidence: a.evidence,
    reason: a.reason,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    ackAt: a.ackAt?.toISOString() ?? null,
  };
}

export function messageDto(m: MessageRow, patientUserId: string): MessageDto {
  return {
    id: m.id,
    from: m.fromUserId === patientUserId ? "PATIENT" : "DOCTOR",
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}
