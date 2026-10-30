import { homeOf, startSession } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok, readJson, tooManyRequests } from "@/lib/http";
import { LIMITS, allow, clientAddress } from "@/lib/rateLimit";
import { login } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export type LoginResponse =
  | { readonly needsRegistration: true; readonly phone: string }
  | { readonly needsRegistration: false; readonly redirect: string };

/** Phone + fixed demo code. Unknown phone → the client shows the registration form. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!allow(`auth:${clientAddress(req)}`, LIMITS.auth.max, LIMITS.auth.windowMs)) return tooManyRequests();
    const { phone, code } = await readJson(req, loginSchema);
    const result = await login(await serviceContext(), phone, code);
    if (result.kind === "register") return ok<LoginResponse>({ needsRegistration: true, phone: result.phone });
    await startSession(result.identity);
    return ok<LoginResponse>({ needsRegistration: false, redirect: homeOf(result.identity.role) });
  });
}
