import { handle, ok } from "@/lib/http";
import { getRepo } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Deploy check: the store is reachable and seeded. No patient data. */
export async function GET() {
  return handle(async () => {
    const repo = await getRepo();
    return ok({ ok: true, patients: (await repo.listPatients()).length });
  });
}
