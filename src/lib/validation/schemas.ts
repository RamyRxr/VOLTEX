import { z } from "zod";
import { CONFIG } from "@/lib/domain/config";
import { ALL_SYMPTOMS } from "@/lib/domain/thresholds";
import type { SymptomType } from "@/lib/domain/types";

/** Shared by API routes and forms (spec §15). */

const int = (range: { readonly min: number; readonly max: number }) => z.number().int().min(range.min).max(range.max);

export const phoneSchema = z.string().trim().min(6).max(24);
export const codeSchema = z.string().trim().min(1).max(12);

export const loginSchema = z.object({ phone: phoneSchema, code: codeSchema });

export const registerSchema = z.object({
  phone: phoneSchema,
  code: codeSchema,
  consent: z.literal(true),
  inviteCode: z.string().trim().min(3).max(16),
  name: z.string().trim().min(2).max(80),
  age: z.number().int().min(18).max(120),
  sex: z.enum(["F", "M"]),
  treatmentNames: z.array(z.string().trim().min(1).max(60)).max(10),
  emergencyContactPhone: phoneSchema.nullable(),
  language: z.enum(["FR", "AR"]),
});

const readingSchema = z
  .object({
    sys: int(CONFIG.plausible.sys),
    dia: int(CONFIG.plausible.dia),
    pulse: int(CONFIG.plausible.pulse).nullable(),
    takenAt: z.iso.datetime().optional(),
  })
  .refine((r) => r.dia < r.sys, { message: "dia must be lower than sys" });

export const sessionSchema = z.object({
  readings: z.array(readingSchema).min(1).max(2),
  pillStatus: z.enum(["TAKEN", "MISSED", "NOT_REPORTED"]),
  symptoms: z
    .array(z.enum([...ALL_SYMPTOMS] as [SymptomType, ...SymptomType[]]))
    .max(ALL_SYMPTOMS.length)
    .transform((s) => [...new Set(s)]),
});

/** Gateway payloads differ between apps: accept the common field names. */
export const inboundSmsSchema = z
  .object({
    from: z.string().optional(),
    phone: z.string().optional(),
    sender: z.string().optional(),
    number: z.string().optional(),
    body: z.string().optional(),
    message: z.string().optional(),
    text: z.string().optional(),
  })
  .transform((p) => ({ from: p.from ?? p.phone ?? p.sender ?? p.number ?? "", body: p.body ?? p.message ?? p.text ?? "" }))
  .refine((p) => p.from.length > 0 && p.from.length <= 24 && p.body.length <= 480, { message: "from/body" });

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const patientPatchSchema = z
  .object({
    targetSys: nullableInt(100, 180),
    targetDia: nullableInt(60, 110),
    expectedReadingsPerWeek: z.number().int().min(1).max(14),
    lastOfficeSys: nullableInt(CONFIG.plausible.sys.min, CONFIG.plausible.sys.max),
    lastOfficeDia: nullableInt(CONFIG.plausible.dia.min, CONFIG.plausible.dia.max),
    doctorNotes: z.string().max(2000).nullable(),
  })
  .partial()
  .refine(
    (p) => p.targetSys === undefined || p.targetDia === undefined || (p.targetSys === null) === (p.targetDia === null),
    { message: "target needs both values or none" },
  );

export const alertPatchSchema = z.object({ status: z.enum(["ACKNOWLEDGED", "CLOSED"]) });

export const messageSchema = z.object({
  patientId: z.string().min(1).max(64),
  body: z.string().trim().min(1).max(1000),
});
