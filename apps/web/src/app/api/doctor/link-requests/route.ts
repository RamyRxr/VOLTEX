import { requireDoctor } from "@/server/auth";
import { json, route } from "@/server/http";
import { pendingRequests } from "@/server/linking";

export const dynamic = "force-dynamic";

/** Pending link requests for this doctor. */
export async function GET(req: Request) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    return json(await pendingRequests(doctorId));
  });
}
