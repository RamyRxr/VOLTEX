import { bearerOr, secretMatches, strongSecret } from "@/lib/http";
import { ApiError, json, route } from "@/server/http";
import { runSilenceJob } from "@/server/jobs";

export const dynamic = "force-dynamic";

/**
 * Cron: silence detection + expiry of pending severe readings.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; `x-cron-secret` works for manual runs.
 */
async function run(req: Request) {
  return route(async () => {
    const expected = strongSecret("CRON_SECRET");
    if (!expected) throw new ApiError("NOT_CONFIGURED", "CRON_SECRET absent ou trop court (32 caractères minimum)");
    if (!secretMatches(bearerOr(req, "x-cron-secret"), expected)) throw new ApiError("UNAUTHORIZED", "Secret invalide");
    return json(await runSilenceJob(new Date()));
  });
}

export const GET = run;
export const POST = run;
