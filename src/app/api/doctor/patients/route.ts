import { requireDoctor } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok } from "@/lib/http";
import { getTriage } from "@/lib/services/triage";

export const dynamic = "force-dynamic";

/** Triage list, sorted by risk (spec §6.6). Polled every second by the dashboard. */
export async function GET() {
  return handle(async () => {
    const viewer = await requireDoctor();
    return ok(await getTriage(await serviceContext(), viewer.doctorId));
  });
}
