import { NextResponse } from "next/server";
import { z } from "zod";
import { allow } from "@/lib/rateLimit";

/** Plain JSON per spec §8; errors are `{ error, message }` (shared `apiErrorSchema`). */

export type ApiErrorCode =
  | "INVALID"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NO_PROFILE"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED";

const STATUS: Readonly<Record<ApiErrorCode, number>> = {
  INVALID: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NO_PROFILE: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status, headers: NO_STORE });
}

/** Map errors to HTTP; never leak internals or patient data in logs. */
export async function route(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error: unknown) {
    if (error instanceof ApiError) return errorResponse(error.code, error.message, STATUS[error.code]);
    if (error instanceof z.ZodError) {
      const fields = error.issues.map((i) => i.path.join(".") || i.message).join(", ");
      return errorResponse("INVALID", `Champs invalides : ${fields}`, 400);
    }
    if (error instanceof SyntaxError) return errorResponse("INVALID", "JSON invalide", 400);
    console.error("Unhandled API error:", error instanceof Error ? error.name : "unknown");
    return errorResponse("INTERNAL", "Erreur interne", 500);
  }
}

const MAX_BODY_BYTES = 64 * 1024;

/** JSON body validated by a shared Zod schema. */
export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const essence = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (essence !== "application/json") throw new ApiError("INVALID", "Content-Type application/json attendu");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new ApiError("INVALID", "Corps de requête trop grand");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError("INVALID", "Corps de requête trop grand");
  return schema.parse(JSON.parse(text));
}

/** Query string validated by a shared Zod schema. */
export function readQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}

/** Route param `:id` must be a UUID. */
export function readId(id: string): string {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new ApiError("NOT_FOUND", "Introuvable");
  return parsed.data;
}

export const isDemoMode = (): boolean => process.env.DEMO_MODE === "true";

/** Write limits per user and route (in-process: per server instance). */
export const WRITE_LIMITS = {
  session: { max: 30, windowMs: 60_000 },
  questionnaire: { max: 10, windowMs: 60_000 },
  profile: { max: 10, windowMs: 60_000 },
  invite: { max: 10, windowMs: 60_000 },
  note: { max: 30, windowMs: 60_000 },
} as const;

export function limitWrites(kind: keyof typeof WRITE_LIMITS, userKey: string): void {
  const { max, windowMs } = WRITE_LIMITS[kind];
  if (!allow(`${kind}:${userKey}`, max, windowMs)) throw new ApiError("RATE_LIMITED", "Trop de requêtes, réessayez dans un instant");
}
