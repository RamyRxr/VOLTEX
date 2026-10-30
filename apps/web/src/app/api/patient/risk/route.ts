import { requirePatient } from "@/server/auth";
import { json, route } from "@/server/http";
import { currentRisk } from "@/server/reads";

export const dynamic = "force-dynamic";

/** Latest risk estimate with its factors and reasons. */
export async function GET(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    return json(await currentRisk(patientId, new Date()));
  });
}
