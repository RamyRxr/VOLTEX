import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ServiceError, type Viewer } from "@/lib/services/context";
import type { Identity } from "@/lib/services/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession, type SessionClaims } from "./token";

export async function currentSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export function viewerOf(claims: SessionClaims): Viewer {
  return claims.role === "DOCTOR"
    ? { role: "DOCTOR", userId: claims.userId, doctorId: claims.doctorId as string }
    : { role: "PATIENT", userId: claims.userId, patientId: claims.patientId as string };
}

/** For API routes: 401 without a session, 403 with the wrong role. */
export async function requireViewer(role?: Viewer["role"]): Promise<Viewer> {
  const claims = await currentSession();
  if (!claims) throw new ServiceError("UNAUTHORIZED", "Sign in required");
  if (role && claims.role !== role) throw new ServiceError("FORBIDDEN", "Wrong role");
  return viewerOf(claims);
}

export type DoctorViewer = Extract<Viewer, { role: "DOCTOR" }>;
export type PatientViewer = Extract<Viewer, { role: "PATIENT" }>;

export async function requireDoctor(): Promise<DoctorViewer> {
  const viewer = await requireViewer("DOCTOR");
  if (viewer.role !== "DOCTOR") throw new ServiceError("FORBIDDEN", "Doctors only");
  return viewer;
}

export async function requirePatient(): Promise<PatientViewer> {
  const viewer = await requireViewer("PATIENT");
  if (viewer.role !== "PATIENT") throw new ServiceError("FORBIDDEN", "Patients only");
  return viewer;
}

/** For pages: the middleware already checked; this re-checks and redirects. */
export async function pageSession(role: Viewer["role"], next: string): Promise<{ claims: SessionClaims; viewer: Viewer }> {
  const claims = await currentSession();
  if (!claims || claims.role !== role) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { claims, viewer: viewerOf(claims) };
}

export async function doctorPage(next: string): Promise<{ claims: SessionClaims; viewer: DoctorViewer }> {
  const { claims, viewer } = await pageSession("DOCTOR", next);
  if (viewer.role !== "DOCTOR") redirect(`/login?next=${encodeURIComponent(next)}`);
  return { claims, viewer };
}

export async function patientPage(next: string): Promise<{ claims: SessionClaims; viewer: PatientViewer }> {
  const { claims, viewer } = await pageSession("PATIENT", next);
  if (viewer.role !== "PATIENT") redirect(`/login?next=${encodeURIComponent(next)}`);
  return { claims, viewer };
}

export async function startSession(identity: Identity): Promise<void> {
  const token = await signSession({
    userId: identity.userId,
    role: identity.role,
    name: identity.name,
    lang: identity.language,
    doctorId: identity.doctorId,
    patientId: identity.patientId,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Where a signed-in user lands. */
export const homeOf = (role: Viewer["role"]) => (role === "DOCTOR" ? "/d" : "/p");
