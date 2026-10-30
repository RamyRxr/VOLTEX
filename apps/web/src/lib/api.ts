"use client";

import { apiErrorSchema } from "shared";
import type { z } from "zod";
import { accessToken } from "./supabase";

/** Error from the API, with the French message to show. */
export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiCallError";
  }
}

const FALLBACK = "Une erreur est survenue. Réessayez.";

/**
 * Calls a spec §8 route with the doctor's access token and validates the
 * response with the shared Zod schema.
 */
export async function api<S extends z.ZodType>(
  path: string,
  schema: S,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal } = {},
): Promise<z.infer<S>> {
  const token = await accessToken();
  if (!token) throw new ApiCallError(401, "UNAUTHORIZED", "Session expirée, reconnectez-vous.");
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    cache: "no-store",
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = apiErrorSchema.safeParse(payload);
    throw new ApiCallError(res.status, error.success ? error.data.error : "HTTP", error.success ? error.data.message : FALLBACK);
  }
  return schema.parse(payload);
}

export const errorMessage = (error: unknown): string => (error instanceof ApiCallError ? error.message : FALLBACK);
