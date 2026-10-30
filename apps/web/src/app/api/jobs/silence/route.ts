import { bearerOr, secretMatches, strongSecret } from "@/server/secrets";
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
    // Same answer whether the secret is missing, weak or wrong: no config hint to callers.
    if (!expected) console.error("jobs/silence: CRON_SECRET missing or shorter than 32 characters");
    if (!expected || !secretMatches(bearerOr(req, "x-cron-secret"), expected)) throw new ApiError("UNAUTHORIZED", "Non autorisé");
    return json(await runSilenceJob(new Date()));
  });
}

export const GET = run;
export const POST = run;
