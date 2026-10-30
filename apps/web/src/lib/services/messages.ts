import type { PatientRow } from "@/lib/store/types";
import { ServiceError, patientForViewer, type Ctx, type Viewer } from "./context";
import { messageDto, type MessageDto } from "./views";

export const MAX_MESSAGE_LENGTH = 1000;

async function doctorUserId(ctx: Ctx, patient: PatientRow): Promise<string> {
  const doctor = await ctx.repo.getDoctor(patient.doctorId);
  if (!doctor) throw new ServiceError("NOT_FOUND", "Doctor not found");
  return doctor.userId;
}

/** The doctor ↔ patient thread, oldest first. */
export async function listThread(ctx: Ctx, patient: PatientRow): Promise<MessageDto[]> {
  const rows = await ctx.repo.listMessagesBetween(patient.userId, await doctorUserId(ctx, patient));
  return rows.map((m) => messageDto(m, patient.userId));
}

/** Doctor → own patient, or patient → own doctor. Nobody else. */
export async function sendMessage(ctx: Ctx, viewer: Viewer, patientId: string, body: string): Promise<MessageDto> {
  const text = body.trim();
  if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) throw new ServiceError("INVALID", "Message length");
  const patient = await patientForViewer(ctx, viewer, patientId);
  const doctorUser = await doctorUserId(ctx, patient);
  const [fromUserId, toUserId] = viewer.role === "DOCTOR" ? [doctorUser, patient.userId] : [patient.userId, doctorUser];
  const row = await ctx.repo.createMessage({ fromUserId, toUserId, body: text, createdAt: ctx.now });
  return messageDto(row, patient.userId);
}

export async function getThread(ctx: Ctx, viewer: Viewer, patientId: string): Promise<MessageDto[]> {
  return listThread(ctx, await patientForViewer(ctx, viewer, patientId));
}
