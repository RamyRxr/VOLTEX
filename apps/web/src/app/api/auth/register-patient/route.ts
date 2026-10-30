import { startSession } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok, readJson, tooManyRequests } from "@/lib/http";
import { LIMITS, allow, clientAddress } from "@/lib/rateLimit";
import { registerPatient } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** First sign-in: consent (stored as consentAt), invite code, profile. Throttled per address. */
export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientAddress(req);
    if (!allow(`auth:${ip}`, LIMITS.auth.max, LIMITS.auth.windowMs)) return tooManyRequests();
    if (!allow(`register:${ip}`, LIMITS.register.max, LIMITS.register.windowMs)) return tooManyRequests();
    const input = await readJson(req, registerSchema);
    const identity = await registerPatient(await serviceContext(), input);
    await startSession(identity);
    return ok({ redirect: "/p" }, 201);
  });
}
