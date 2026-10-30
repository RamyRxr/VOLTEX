import { linkInputSchema } from "shared";
import { requirePatient } from "@/server/auth";
import { json, readBody, route } from "@/server/http";
import { linkState, submitCode } from "@/server/linking";

export const dynamic = "force-dynamic";

/** Submit a doctor's invite code → { status: 'PENDING' }. */
export async function POST(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    const { code } = await readBody(req, linkInputSchema);
    return json(await submitCode(patientId, code, new Date()), 201);
  });
}

/** Current link status + doctor name. */
export async function GET(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    return json(await linkState(patientId));
  });
}
