import { linkDecisionSchema } from "shared";
import { requireDoctor } from "@/server/auth";
import { json, readBody, readId, route } from "@/server/http";
import { decideRequest } from "@/server/linking";

export const dynamic = "force-dynamic";

/** { action: 'ACCEPT' | 'REFUSE' } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const id = readId((await params).id);
    const { action } = await readBody(req, linkDecisionSchema);
    return json(await decideRequest(doctorId, id, action, new Date()));
  });
}
