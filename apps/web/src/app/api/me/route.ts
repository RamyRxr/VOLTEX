import { requireViewer } from "@/server/auth";
import { json, route } from "@/server/http";
import { me } from "@/server/reads";

export const dynamic = "force-dynamic";

/** Profile + role (+ patient / doctor data). 404 NO_PROFILE until the patient fills her profile. */
export async function GET(req: Request) {
  return route(async () => json(await me(await requireViewer(req), new Date())));
}
