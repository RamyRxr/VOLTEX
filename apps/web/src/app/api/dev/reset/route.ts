import { requireViewer } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/demo";
import { assertSameOrigin, fail, handle, ok } from "@/lib/http";
import { resetDemoData } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Rehearsals: rebuild the seeded demo relative to now (demo mode, doctor only). */
export async function POST(req: Request) {
  return handle(async () => {
    if (!isDemoMode()) return fail(404, "NOT_FOUND", "Not found");
    assertSameOrigin(req);
    await requireViewer("DOCTOR");
    await resetDemoData();
    return ok({ reset: true });
  });
}
