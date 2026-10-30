import { alertActionSchema } from "shared";
import { requireDoctor } from "@/server/auth";
import { actOnAlert } from "@/server/doctor";
import { json, readBody, readId, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** { action: 'ACK' | 'CLOSE' } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const id = readId((await params).id);
    const { action } = await readBody(req, alertActionSchema);
    return json(await actOnAlert(doctorId, id, action, new Date()));
  });
}
