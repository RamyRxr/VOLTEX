import { CONFIG } from "@/lib/domain/config";
import type { Ctx } from "@/lib/services/context";
import { getRepo } from "@/lib/store";

/** DEMO_MODE=true shortens timers only; it never hides or fakes a rule (CLAUDE.md §6.8). */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export interface Timings {
  readonly readingGapSeconds: number;
  readonly restSeconds: number;
}

export function timings(demoMode: boolean): Timings {
  return demoMode
    ? { readingGapSeconds: CONFIG.demoModeSeconds.readingGap, restSeconds: CONFIG.demoModeSeconds.rest }
    : { readingGapSeconds: CONFIG.readingGapSeconds, restSeconds: CONFIG.restBeforeConfirmSeconds };
}

/** Gateway number shown in the patient's "Envoyer par SMS" button. */
export function smsGatewayNumber(): string | null {
  return process.env.SMS_GATEWAY_NUMBER?.trim() || null;
}

export async function serviceContext(): Promise<Ctx> {
  return { repo: await getRepo(), now: new Date(), demoMode: isDemoMode() };
}
