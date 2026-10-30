import { requireDoctor } from "@/server/auth";
import { triage } from "@/server/doctor";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Triage list, sorted per spec §6.5. Polled every 3 s by the dashboard. */
export async function GET(req: Request) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    return json(await triage(doctorId, new Date()));
  });
}
