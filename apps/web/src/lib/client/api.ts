import type { ApiResponse } from "@/lib/http";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  if (!body) throw new ApiError(res.status, "NETWORK", res.statusText || "Network error");
  if (!body.success) throw new ApiError(res.status, body.error.code, body.error.message);
  return body.data;
}

export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  return unwrap<T>(await fetch(url, { cache: "no-store", signal, headers: { Accept: "application/json" } }));
}

/** JSON only: the API refuses other content types on mutations (CSRF). */
export async function apiSend<T>(url: string, method: "POST" | "PATCH", body: unknown = {}): Promise<T> {
  return unwrap<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
