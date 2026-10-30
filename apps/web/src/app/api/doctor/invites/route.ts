import { requireDoctor } from "@/server/auth";
import { json, limitWrites, route } from "@/server/http";
import { activeInvites, createInvite } from "@/server/linking";

export const dynamic = "force-dynamic";

/** New invite code → { code, expiresAt } (24 h, single use). */
export async function POST(req: Request) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    limitWrites("invite", doctorId);
    return json(await createInvite(doctorId, new Date()), 201);
  });
}

/** Active (unused, unexpired) codes. */
export async function GET(req: Request) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    return json(await activeInvites(doctorId, new Date()));
  });
}
