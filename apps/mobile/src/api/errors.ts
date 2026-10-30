import { apiErrorSchema } from "shared";
import { t } from "@/i18n";

/**
 * A failed call. `status` 0 means the server could not be reached; `code` is the API's
 * error code (e.g. NO_PROFILE, RATE_LIMITED); `message` is French and safe to show.
 */
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

export const networkError = () => new ApiError(0, "NETWORK", t("common.offline"));

/** Reads the `{ error, message }` body every API route sends on failure. */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
  return body.success
    ? new ApiError(res.status, body.data.error, body.data.message)
    : new ApiError(res.status, "HTTP", t("common.error"));
}

export const isApiError = (err: unknown, code: string): boolean => err instanceof ApiError && err.code === code;

/** French text to show for any failure. */
export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : t("common.error");
}
