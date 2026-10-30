import type { AuthError, User } from "@supabase/supabase-js";
import { ApiError, networkError } from "@/api/errors";
import { t } from "@/i18n";
import { supabase } from "./supabase";

export interface SignUpInput {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
}

/** Supabase errors → French messages the screens can show as is. */
function toApiError(error: AuthError): ApiError {
  switch (error.code) {
    case "invalid_credentials":
      return new ApiError(401, error.code, t("login.error"));
    case "email_not_confirmed":
      return new ApiError(403, error.code, t("login.notConfirmed"));
    case "user_already_exists":
    case "email_exists":
      return new ApiError(409, error.code, t("register.exists"));
    case "weak_password":
      return new ApiError(422, error.code, t("validation.password"));
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return new ApiError(429, error.code, t("auth.rateLimited"));
  }
  return error.status ? new ApiError(error.status, error.code ?? "AUTH", t("common.error")) : networkError();
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password }).catch(() => {
    throw networkError();
  });
  if (error) throw toApiError(error);
  return data.user;
}

/** Creates the account. `user` is null while Supabase waits for the e-mail to be confirmed. */
export async function signUp({ fullName, email, password }: SignUpInput): Promise<{ user: User | null }> {
  const { data, error } = await supabase.auth
    .signUp({ email, password, options: { data: { full_name: fullName } } })
    .catch(() => {
      throw networkError();
    });
  if (error) throw toApiError(error);
  // With e-mail confirmation on, an address already in use comes back without identities instead of an error.
  if (data.user && data.user.identities?.length === 0) throw new ApiError(409, "email_exists", t("register.exists"));
  return { user: data.session ? data.session.user : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}

/** The name typed at sign-up, used to prefill the profile form. */
export function signUpName(user: User | null): string {
  const name: unknown = user?.user_metadata?.full_name;
  return typeof name === "string" ? name : "";
}
