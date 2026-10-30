import { requireViewer } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok, readJson, tooManyRequests } from "@/lib/http";
import { LIMITS, allow } from "@/lib/rateLimit";
import { ServiceError } from "@/lib/services/context";
import { getThread, sendMessage } from "@/lib/services/messages";
import { messageSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Thread between a patient and their doctor: ?patientId=… */
export async function GET(req: Request) {
  return handle(async () => {
    const viewer = await requireViewer();
    const patientId = new URL(req.url).searchParams.get("patientId");
    if (!patientId) throw new ServiceError("INVALID", "patientId is required");
    return ok(await getThread(await serviceContext(), viewer, patientId));
  });
}

/** Doctor → own patient, or patient → own doctor. */
export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await requireViewer();
    if (!allow(`message:${viewer.userId}`, LIMITS.message.max, LIMITS.message.windowMs)) return tooManyRequests();
    const { patientId, body } = await readJson(req, messageSchema);
    return ok(await sendMessage(await serviceContext(), viewer, patientId, body), 201);
  });
}
