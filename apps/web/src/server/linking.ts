import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { generateInviteCode, inviteExpiresAt, type Invite, type LinkRequestDto, type LinkState } from "shared";
import { allow } from "./rateLimit";
import { db } from "./db";
import { ApiError } from "./http";
import { iso } from "./mappers";
import { withPatientLock } from "./pipeline";

/** Doctor ↔ patient linking (spec §3). */

/** In-process limiter: per server instance (see the PR note on a shared store). */
const CODE_ATTEMPTS = { max: 5, windowMs: 10 * 60_000 };
const MAX_CODE_COLLISIONS = 5;
const MAX_ACTIVE_INVITES = 5;
/** Same message for a wrong, expired or used code: never reveal which. */
const BAD_CODE = "Code invalide ou expiré";

export async function createInvite(doctorId: string, now: Date): Promise<Invite> {
  const active = await db.inviteCode.count({ where: { doctorId, usedAt: null, expiresAt: { gt: now } } });
  if (active >= MAX_ACTIVE_INVITES) throw new ApiError("CONFLICT", `${MAX_ACTIVE_INVITES} codes actifs au maximum`);
  for (let attempt = 0; attempt < MAX_CODE_COLLISIONS; attempt += 1) {
    try {
      const invite = await db.inviteCode.create({
        data: { doctorId, code: generateInviteCode((n) => randomInt(n)), expiresAt: inviteExpiresAt(now) },
      });
      return { code: invite.code, expiresAt: iso(invite.expiresAt) };
    } catch (error: unknown) {
      const collision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!collision) throw error;
    }
  }
  throw new ApiError("CONFLICT", "Réessayez dans un instant");
}

export async function activeInvites(doctorId: string, now: Date): Promise<Invite[]> {
  const invites = await db.inviteCode.findMany({
    where: { doctorId, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  return invites.map((i) => ({ code: i.code, expiresAt: iso(i.expiresAt) }));
}

/** POST /api/patient/link — consumes the code atomically, creates a PENDING request. */
export async function submitCode(patientId: string, code: string, now: Date): Promise<{ status: "PENDING" }> {
  if (!allow(`link:${patientId}`, CODE_ATTEMPTS.max, CODE_ATTEMPTS.windowMs, now.getTime())) {
    throw new ApiError("RATE_LIMITED", "Trop d'essais, réessayez dans quelques minutes");
  }
  // Under the patient lock: two codes sent at once cannot create two requests,
  // and the code is consumed only if the request is created.
  return withPatientLock(patientId, async (tx) => {
    const current = await tx.linkRequest.findFirst({
      where: { patientId, status: { in: ["PENDING", "ACCEPTED"] } },
      select: { status: true },
    });
    if (current?.status === "ACCEPTED") throw new ApiError("CONFLICT", "Vous êtes déjà suivie par un médecin");
    if (current?.status === "PENDING") throw new ApiError("CONFLICT", "Une demande est déjà en attente");

    const invite = await tx.inviteCode.findUnique({ where: { code }, select: { id: true, doctorId: true } });
    if (!invite) throw new ApiError("INVALID", BAD_CODE);
    const consumed = await tx.inviteCode.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count === 0) throw new ApiError("INVALID", BAD_CODE);

    await tx.linkRequest.create({ data: { patientId, doctorId: invite.doctorId, status: "PENDING", createdAt: now } });
    return { status: "PENDING" as const };
  });
}

export async function linkState(patientId: string): Promise<LinkState> {
  const link = await db.linkRequest.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, doctor: { select: { profile: { select: { fullName: true } } } } },
  });
  if (!link) return { status: null, doctorName: null, linkId: null };
  return {
    status: link.status,
    doctorName: link.doctor.profile.fullName,
    linkId: link.status === "ACCEPTED" ? link.id : null,
  };
}

/** Name and date only: no health data before the doctor accepts (spec §3). */
export async function pendingRequests(doctorId: string): Promise<LinkRequestDto[]> {
  const requests = await db.linkRequest.findMany({
    where: { doctorId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, patient: { select: { profile: { select: { fullName: true } } } } },
  });
  return requests.map((r) => ({ id: r.id, patientName: r.patient.profile.fullName, createdAt: iso(r.createdAt) }));
}

/** PATCH /api/doctor/link-requests/:id — a patient has at most one accepted doctor. */
export async function decideRequest(
  doctorId: string,
  requestId: string,
  action: "ACCEPT" | "REFUSE",
  now: Date,
): Promise<{ status: "ACCEPTED" | "REFUSED" }> {
  const request = await db.linkRequest.findFirst({ where: { id: requestId, doctorId }, select: { patientId: true } });
  if (!request) throw new ApiError("NOT_FOUND", "Demande introuvable");
  const status = action === "ACCEPT" ? "ACCEPTED" : "REFUSED";

  // Under the patient lock, and only from PENDING: two concurrent decisions cannot both apply.
  return withPatientLock(request.patientId, async (tx) => {
    if (action === "ACCEPT") {
      const other = await tx.linkRequest.findFirst({ where: { patientId: request.patientId, status: "ACCEPTED" } });
      if (other) throw new ApiError("CONFLICT", "Cette patiente est déjà suivie");
    }
    const decided = await tx.linkRequest.updateMany({
      where: { id: requestId, doctorId, status: "PENDING" },
      data: { status, decidedAt: now },
    });
    if (decided.count !== 1) throw new ApiError("CONFLICT", "Demande déjà traitée");
    return { status };
  });
}
