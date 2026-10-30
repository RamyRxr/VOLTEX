import { serviceContext } from "@/lib/demo";
import { bearerOr, fail, handle, ok, secretMatches, strongSecret } from "@/lib/http";
import { runSilenceJob } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";

/**
 * Cron: silence detection + expiry of old PENDING sessions.
 * Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`;
 * `x-cron-secret` is accepted for manual runs.
 */
async function run(req: Request) {
  return handle(async () => {
    const expected = strongSecret("CRON_SECRET");
    if (!expected) return fail(503, "NOT_CONFIGURED", "CRON_SECRET missing or shorter than 32 characters");
    if (!secretMatches(bearerOr(req, "x-cron-secret"), expected)) return fail(401, "UNAUTHORIZED", "Bad secret");
    return ok(await runSilenceJob(await serviceContext()));
  });
}

export const GET = run;
export const POST = run;
