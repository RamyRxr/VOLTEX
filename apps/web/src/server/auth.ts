import type { Role } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./http";
import { supabaseAuth } from "./supabase";

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

/**
 * `Authorization: Bearer <supabase access token>`, verified server-side (spec §5).
 * getClaims checks the signature against the project's cached public keys (no network
 * call per request); with a legacy symmetric key it asks the Auth server itself.
 */
export async function authenticate(req: Request): Promise<AuthUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new ApiError("UNAUTHORIZED", "Connexion requise");
  const { data, error } = await supabaseAuth().auth.getClaims(token);
  const userId = data?.claims.sub;
  if (error || !userId) throw new ApiError("UNAUTHORIZED", "Session expirée, reconnectez-vous");
  const email = data.claims.email;
  return { userId, email: typeof email === "string" ? email : null };
}

/**
 * Role and ids change only when a profile is created, so a found profile is kept a
 * short while: every polled request otherwise pays one more database round trip.
 */
const VIEWER_TTL_MS = 30_000;
const viewers = new Map<string, { readonly viewer: Viewer; readonly until: number }>();

async function loadViewer(userId: string): Promise<Viewer | null> {
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { id: true, role: true, fullName: true, patient: { select: { id: true } }, doctor: { select: { id: true } } },
  });
  if (!profile) return null;
  return {
    profileId: profile.id,
    role: profile.role,
    fullName: profile.fullName,
    patientId: profile.patient?.id ?? null,
    doctorId: profile.doctor?.id ?? null,
  };
}

/** Drop the cached viewer after a profile write, so the next request sees the change. */
export function forgetViewer(userId: string): void {
  viewers.delete(userId);
}

/** The signed-in user with their Profile row (role, patient / doctor ids). */
export async function requireViewer(req: Request): Promise<Viewer> {
  const { userId } = await authenticate(req);
  const now = Date.now();
  const cached = viewers.get(userId);
  if (cached && cached.until > now) return cached.viewer;
  const viewer = await loadViewer(userId);
  if (!viewer) throw new ApiError("NO_PROFILE", "Profil à compléter");
  viewers.set(userId, { viewer, until: now + VIEWER_TTL_MS });
  return viewer;
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
