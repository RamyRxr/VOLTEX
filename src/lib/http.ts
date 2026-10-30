import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError, type ServiceErrorCode } from "@/lib/services/context";

/** One envelope for every API response. */
export type ApiResponse<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string } };

const STATUS: Record<ServiceErrorCode, number> = {
  INVALID: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(status: number, code: string, message: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Map service and validation errors to HTTP; never leak internals or patient data. */
export async function handle<T>(work: () => Promise<NextResponse<ApiResponse<T>>>): Promise<NextResponse<ApiResponse<T>>> {
  try {
    return await work();
  } catch (error: unknown) {
    if (error instanceof ServiceError) return fail(STATUS[error.code], error.code, error.message);
    if (error instanceof z.ZodError) return fail(400, "INVALID", error.issues.map((i) => i.path.join(".") || i.message).join(", "));
    if (error instanceof SyntaxError) return fail(400, "INVALID", "Malformed JSON");
    console.error("Unhandled API error:", error instanceof Error ? error.name : "unknown");
    return fail(500, "INTERNAL", "Internal error");
  }
}

const MAX_BODY_BYTES = 64 * 1024;
export const MIN_SECRET_LENGTH = 32;

/**
 * CSRF, layer 1: browsers send Sec-Fetch-Site; only same-origin (or a typed
 * URL) may mutate. Callers without the header (curl, old browsers) fall
 * through to layer 2 (exact JSON content type) and the SameSite=Lax cookie.
 */
export function assertSameOrigin(req: Request): void {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new ServiceError("FORBIDDEN", "Cross-site request");
}

/**
 * CSRF, layer 2: the media type must be exactly application/json, which a
 * cross-site page cannot send without a CORS preflight we never approve.
 */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  assertSameOrigin(req);
  const essence = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (essence !== "application/json") throw new ServiceError("INVALID", "Expected application/json");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new ServiceError("INVALID", "Body too large");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ServiceError("INVALID", "Body too large");
  return schema.parse(JSON.parse(text));
}

/** An env secret, only if long enough to resist guessing; otherwise null (route answers 503). */
export function strongSecret(name: "CRON_SECRET" | "SMS_GATEWAY_TOKEN"): string | null {
  const value = process.env[name];
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

export function tooManyRequests(): NextResponse<ApiResponse<never>> {
  return fail(429, "RATE_LIMITED", "Too many requests");
}

/** Constant-time comparison for shared secrets. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** "Bearer xyz" or a dedicated header. */
export function bearerOr(req: Request, header: string): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return req.headers.get(header);
}
