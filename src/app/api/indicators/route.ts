import { requireDoctor } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok } from "@/lib/http";
import { INDICATOR_PERIODS, getIndicators } from "@/lib/services/indicators";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8 indicators over ?weeks=4|8|12 (default 8), ending now. */
export async function GET(req: Request) {
  return handle(async () => {
    const viewer = await requireDoctor();
    const param = Number(new URL(req.url).searchParams.get("weeks"));
    const weeks = INDICATOR_PERIODS.find((w) => w === param) ?? 8;
    return ok(await getIndicators(await serviceContext(), viewer, weeks));
  });
}
