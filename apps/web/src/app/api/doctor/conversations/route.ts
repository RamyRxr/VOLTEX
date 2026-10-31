import { requireDoctor } from "@/server/auth";
import { conversations } from "@/server/conversations";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Patients who wrote, most urgent first, with the count of unanswered messages. Polled every 3 s. */
export async function GET(req: Request) {
  return route(async () => {
    const { doctorId, profileId } = await requireDoctor(req);
    return json(await conversations(doctorId, profileId, new Date()));
  });
}
