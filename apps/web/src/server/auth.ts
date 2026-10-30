import type { Role } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./http";
import { supabaseAdmin } from "./supabase";

export interface AuthUser {
  readonly userId: string;
  readonly email: string | null;
}

export interface Viewer {
  readonly profileId: string;
  readonly role: Role;
  readonly fullName: string;
  readonly patientId: string | null;
  readonly doctorId: string | null;
}

/** `Authorization: Bearer <supabase access token>`, verified server-side (spec §5). */
export async function authenticate(req: Request): Promise<AuthUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new ApiError("UNAUTHORIZED", "Connexion requise");
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw new ApiError("UNAUTHORIZED", "Session expirée, reconnectez-vous");
  return { userId: data.user.id, email: data.user.email ?? null };
}

/** The signed-in user with their Profile row (role, patient / doctor ids). */
export async function requireViewer(req: Request): Promise<Viewer> {
  const { userId } = await authenticate(req);
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { id: true, role: true, fullName: true, patient: { select: { id: true } }, doctor: { select: { id: true } } },
  });
  if (!profile) throw new ApiError("NO_PROFILE", "Profil à compléter");
  return {
    profileId: profile.id,
    role: profile.role,
    fullName: profile.fullName,
    patientId: profile.patient?.id ?? null,
    doctorId: profile.doctor?.id ?? null,
  };
}

export async function requirePatient(req: Request): Promise<Viewer & { readonly patientId: string }> {
  const viewer = await requireViewer(req);
  if (viewer.role !== "PATIENT") throw new ApiError("FORBIDDEN", "Réservé aux patientes");
  if (!viewer.patientId) throw new ApiError("NO_PROFILE", "Profil à compléter");
  return { ...viewer, patientId: viewer.patientId };
}

export async function requireDoctor(req: Request): Promise<Viewer & { readonly doctorId: string }> {
  const viewer = await requireViewer(req);
  if (viewer.role !== "DOCTOR" || !viewer.doctorId) throw new ApiError("FORBIDDEN", "Réservé aux médecins");
  return { ...viewer, doctorId: viewer.doctorId };
}

/** A doctor sees a patient only through an ACCEPTED link (spec §3). Returns the link id. */
export async function requireLinkedPatient(doctorId: string, patientId: string): Promise<string> {
  const link = await db.linkRequest.findFirst({
    where: { doctorId, patientId, status: "ACCEPTED" },
    select: { id: true },
  });
  if (!link) throw new ApiError("NOT_FOUND", "Patiente introuvable");
  return link.id;
}
