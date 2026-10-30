import { endSession } from "@/lib/auth/server";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    await endSession();
    return ok({ redirect: "/login" });
  });
}
