import { handle, ok } from "@/lib/http";
import { getRepo } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Deploy check: the store is reachable and seeded. Reveals nothing about patients. */
export async function GET() {
  return handle(async () => {
    await getRepo();
    return ok({ ok: true });
  });
}
