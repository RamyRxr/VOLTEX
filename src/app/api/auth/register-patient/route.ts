import { startSession } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok, readJson } from "@/lib/http";
import { registerPatient } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** First sign-in: consent (stored as consentAt), invite code, profile. */
export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, registerSchema);
    const identity = await registerPatient(await serviceContext(), input);
    await startSession(identity);
    return ok({ redirect: "/p" }, 201);
  });
}
