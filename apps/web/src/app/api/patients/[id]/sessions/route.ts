import { requireViewer } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok } from "@/lib/http";
import { listPatientSessions } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

const MAX_DAYS = 365;

/** History: ?days=30 (default 90). Doctor (own patient) or the patient themself. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const raw = Number(new URL(req.url).searchParams.get("days") ?? "90");
    const days = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), MAX_DAYS) : 90;
    return ok(await listPatientSessions(await serviceContext(), await requireViewer(), id, days));
  });
}
