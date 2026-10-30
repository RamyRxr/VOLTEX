import { requireDoctor } from "@/lib/auth/server";
import type { AlertStatus } from "@/lib/domain/types";
import { serviceContext } from "@/lib/demo";
import { handle, ok } from "@/lib/http";
import { listDoctorAlerts } from "@/lib/services/alerts";

export const dynamic = "force-dynamic";

const STATUSES: readonly AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "CLOSED"];

/** Alert inbox: ?status=OPEN | ACKNOWLEDGED | CLOSED (all when absent). */
export async function GET(req: Request) {
  return handle(async () => {
    const viewer = await requireDoctor();
    const param = new URL(req.url).searchParams.get("status");
    const status = STATUSES.find((s) => s === param) ?? null;
    return ok(await listDoctorAlerts(await serviceContext(), viewer, status));
  });
}
