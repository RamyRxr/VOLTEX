import * as Notifications from "expo-notifications";
import { t } from "@/i18n";
import { CHANNELS, ensurePermission, supported } from "./setup";

/** Reminds the patient when the re-measure countdown of a severe reading ends. */
export async function scheduleRemeasure(seconds: number): Promise<string | null> {
  if (!supported || seconds <= 0) return null;
  try {
    if (!(await ensurePermission())) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: t("result.notification.title"),
        body: t("result.notification.body"),
        data: { url: "/measure/bp" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNELS.alerts,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRemeasure(id: string | null): Promise<void> {
  if (!supported || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}
