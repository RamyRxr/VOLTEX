import { alertsQuerySchema } from "shared";
import { requireDoctor } from "@/server/auth";
import { listAlerts } from "@/server/doctor";
import { json, readQuery, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Alerts of linked patients, ?status=OPEN|ACKNOWLEDGED|CLOSED. */
export async function GET(req: Request) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const { status } = readQuery(req, alertsQuerySchema);
    return json(await listAlerts(doctorId, status));
  });
}
