import { endSession } from "@/lib/auth/server";
import { assertSameOrigin, handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await endSession();
    return ok({ redirect: "/login" });
  });
}
