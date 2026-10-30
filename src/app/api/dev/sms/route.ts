import { requireViewer } from "@/lib/auth/server";
import { isDemoMode, serviceContext } from "@/lib/demo";
import { fail, handle, ok, readJson } from "@/lib/http";
import { handleInboundSms } from "@/lib/services/sms";
import { inboundSmsSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** /dev/sms-simulator backend: the exact same handler as the real webhook. */
export async function POST(req: Request) {
  return handle(async () => {
    if (!isDemoMode()) return fail(404, "NOT_FOUND", "Not found");
    await requireViewer("DOCTOR");
    const sms = await readJson(req, inboundSmsSchema);
    const outcome = await handleInboundSms(await serviceContext(), sms);
    return ok({ reply: outcome.reply, kind: outcome.kind, stored: outcome.sessionId != null });
  });
}
