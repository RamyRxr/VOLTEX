import { requireDoctor } from "@/lib/auth/server";
import { isDemoMode, serviceContext } from "@/lib/demo";
import { fail, handle, ok, readJson, tooManyRequests } from "@/lib/http";
import { LIMITS, allow } from "@/lib/rateLimit";
import { handleSimulatedSms } from "@/lib/services/sms";
import { inboundSmsSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** /dev/sms-simulator backend: the webhook's handler, for the doctor's own patients only. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!isDemoMode()) return fail(404, "NOT_FOUND", "Not found");
    const viewer = await requireDoctor();
    if (!allow(`simulator:${viewer.userId}`, LIMITS.simulator.max, LIMITS.simulator.windowMs)) return tooManyRequests();
    const sms = await readJson(req, inboundSmsSchema);
    const outcome = await handleSimulatedSms(await serviceContext(), viewer, sms);
    return ok({ reply: outcome.reply, kind: outcome.kind, stored: outcome.sessionId != null });
  });
}
