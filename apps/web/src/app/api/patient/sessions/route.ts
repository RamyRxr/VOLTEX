import { rangeQuerySchema, sessionInputSchema } from "shared";
import { requirePatient } from "@/server/auth";
import { isDemoMode, json, readBody, readQuery, route } from "@/server/http";
import { recordSession } from "@/server/patient";
import { listSessions } from "@/server/reads";

export const dynamic = "force-dynamic";

/** New blood pressure session → { session, evaluation, risk }. */
export async function POST(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    const input = await readBody(req, sessionInputSchema);
    return json(await recordSession(patientId, input, new Date(), isDemoMode()), 201);
  });
}

/** Own sessions, ?from=&to= (ISO). */
export async function GET(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    return json(await listSessions(patientId, readQuery(req, rangeQuerySchema)));
  });
}
