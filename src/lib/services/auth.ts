import { normalizePhone } from "@/lib/domain/phone";
import type { Language, Sex, UserRow } from "@/lib/store/types";
import { ServiceError, type Ctx } from "./context";

/** Fixed demo code: real OTP is roadmap (spec §4.1). */
export const DEMO_LOGIN_CODE = "1234";

export interface Identity {
  readonly userId: string;
  readonly role: "PATIENT" | "DOCTOR";
  readonly name: string;
  readonly language: Language;
  readonly doctorId?: string;
  readonly patientId?: string;
}

async function identityOf(ctx: Ctx, user: UserRow): Promise<Identity> {
  const base = { userId: user.id, role: user.role, name: user.name, language: user.language };
  if (user.role === "DOCTOR") {
    const doctor = await ctx.repo.getDoctorByUserId(user.id);
    if (!doctor) throw new ServiceError("NOT_FOUND", "Doctor profile missing");
    return { ...base, doctorId: doctor.id };
  }
  const patient = await ctx.repo.getPatientByUserId(user.id);
  if (!patient) throw new ServiceError("NOT_FOUND", "Patient profile missing");
  return { ...base, patientId: patient.id };
}

export type LoginResult = { readonly kind: "ok"; readonly identity: Identity } | { readonly kind: "register"; readonly phone: string };

export async function login(ctx: Ctx, rawPhone: string, code: string): Promise<LoginResult> {
  if (code !== DEMO_LOGIN_CODE) throw new ServiceError("UNAUTHORIZED", "Wrong code");
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new ServiceError("INVALID", "Invalid phone");
  const user = await ctx.repo.findUserByPhone(phone);
  return user ? { kind: "ok", identity: await identityOf(ctx, user) } : { kind: "register", phone };
}

export interface Registration {
  readonly phone: string;
  readonly code: string;
  readonly consent: true;
  readonly inviteCode: string;
  readonly name: string;
  readonly age: number;
  readonly sex: Sex;
  readonly treatmentNames: readonly string[];
  readonly emergencyContactPhone: string | null;
  readonly language: Language;
}

/** First sign-in of a patient: consent is stored with its date (consentAt). */
export async function registerPatient(ctx: Ctx, input: Registration): Promise<Identity> {
  if (input.code !== DEMO_LOGIN_CODE) throw new ServiceError("UNAUTHORIZED", "Wrong code");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ServiceError("INVALID", "Invalid phone");
  if (await ctx.repo.findUserByPhone(phone)) throw new ServiceError("INVALID", "Phone already registered");
  const doctor = await ctx.repo.findDoctorByInviteCode(input.inviteCode.trim().toUpperCase());
  if (!doctor) throw new ServiceError("NOT_FOUND", "Unknown invite code");

  const emergency = input.emergencyContactPhone ? normalizePhone(input.emergencyContactPhone) : null;
  const user = await ctx.repo.createUser({ role: "PATIENT", phone, name: input.name.trim(), language: input.language, createdAt: ctx.now });
  await ctx.repo.createPatient({
    userId: user.id,
    doctorId: doctor.id,
    age: input.age,
    sex: input.sex,
    treatmentNames: input.treatmentNames,
    targetSys: null,
    targetDia: null,
    expectedReadingsPerWeek: 2,
    emergencyContactPhone: emergency,
    lastOfficeSys: null,
    lastOfficeDia: null,
    doctorNotes: null,
    consentAt: ctx.now,
    summary: null,
  });
  return identityOf(ctx, user);
}
