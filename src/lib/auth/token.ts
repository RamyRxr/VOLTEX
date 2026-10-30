import { SignJWT, jwtVerify } from "jose";

/** Edge-safe (used by middleware): no Node APIs, no next/headers. */
export const SESSION_COOKIE = "tc_session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

export interface SessionClaims {
  readonly userId: string;
  readonly role: "PATIENT" | "DOCTOR";
  readonly name: string;
  readonly lang: "FR" | "AR";
  readonly doctorId?: string;
  readonly patientId?: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters (see .env.example)`);
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Null for a missing, expired, forged or malformed token. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const { userId, role, name, lang, doctorId, patientId } = payload;
    if (!isString(userId) || !isString(name)) return null;
    if (role === "DOCTOR" && isString(doctorId)) return { userId, role, name, lang: lang === "AR" ? "AR" : "FR", doctorId };
    if (role === "PATIENT" && isString(patientId)) return { userId, role, name, lang: lang === "AR" ? "AR" : "FR", patientId };
    return null;
  } catch {
    return null;
  }
}
