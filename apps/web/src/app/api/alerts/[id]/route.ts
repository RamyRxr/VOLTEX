import { requireDoctor } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok, readJson } from "@/lib/http";
import { updateAlertStatus } from "@/lib/services/alerts";
import { alertPatchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** Acknowledge or close an alert of one of the doctor's patients. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const viewer = await requireDoctor();
    const { status } = await readJson(req, alertPatchSchema);
    return ok(await updateAlertStatus(await serviceContext(), viewer, id, status));
  });
}
