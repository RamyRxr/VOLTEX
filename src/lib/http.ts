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

/**
 * Cookie-authenticated mutations accept JSON only: a cross-site form cannot
 * send application/json without a CORS preflight, which closes CSRF.
 */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new ServiceError("INVALID", "Expected application/json");
  return schema.parse(await req.json());
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
