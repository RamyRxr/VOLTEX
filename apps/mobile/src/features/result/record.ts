import type { Evaluation } from "@/api/types";
import { cancelRemeasure, scheduleRemeasure } from "@/notifications/remeasure";
import { getLastResult, setLastResult, type LastResult } from "./lastResult";

/**
 * Stores what the API answered and, for a severe reading, arms the re-measure
 * countdown and its notification. Any older countdown is cancelled.
 */
export async function recordResult(
  evaluation: Evaluation,
  source: LastResult["source"],
  bp: LastResult["bp"],
  options: { offline?: boolean } = {},
): Promise<void> {
  const now = new Date();
  await cancelRemeasure(getLastResult()?.notificationId ?? null);
  const seconds = evaluation.action === "REMEASURE" ? (evaluation.remeasureInSeconds ?? 0) : 0;
  const notificationId = seconds > 0 ? await scheduleRemeasure(seconds) : null;
  await setLastResult({
    evaluation,
    source,
    bp,
    receivedAt: now.toISOString(),
    remeasureAt: seconds > 0 ? new Date(now.getTime() + seconds * 1000).toISOString() : null,
    notificationId,
    offline: options.offline ?? false,
  });
}
