import { requireDoctor } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok } from "@/lib/http";
import { getTriage } from "@/lib/services/triage";

export const dynamic = "force-dynamic";

/**
 * Prototype triage (cookie session, in-memory demo data), kept so the old
 * dashboard runs until it moves to /api/doctor/patients (step E). Delete then.
 */
export async function GET() {
  return handle(async () => {
    const viewer = await requireDoctor();
    return ok(await getTriage(await serviceContext(), viewer.doctorId));
  });
}
