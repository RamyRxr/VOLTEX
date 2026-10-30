import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { t } from "@/i18n";
import { channelId, CHANNELS, ensurePermission, supported } from "./setup";

/** Local reminders (CLAUDE.md §4.1.10): BP morning and evening, questionnaire daily. */
export type ReminderKind = "bpMorning" | "bpEvening" | "questionnaire";

export interface Reminder {
  readonly enabled: boolean;
  readonly hour: number;
  readonly minute: number;
}

export type ReminderSettings = Readonly<Record<ReminderKind, Reminder>>;

export const DEFAULT_REMINDERS: ReminderSettings = {
  bpMorning: { enabled: true, hour: 8, minute: 0 },
  bpEvening: { enabled: true, hour: 20, minute: 0 },
  questionnaire: { enabled: true, hour: 19, minute: 0 },
};

const KEY = "tensiocare.reminders.v1";
const IDS_KEY = "tensiocare.reminders.ids.v1";

export async function loadReminders(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...(JSON.parse(raw) as Partial<ReminderSettings>) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

function content(kind: ReminderKind): Notifications.NotificationContentInput {
  return kind === "questionnaire"
    ? { title: t("reminders.notif.qTitle"), body: t("reminders.notif.qBody"), data: { url: "/questionnaire" } }
    : { title: t("reminders.notif.bpTitle"), body: t("reminders.notif.bpBody"), data: { url: "/measure" } };
}

async function cancelPrevious(): Promise<void> {
  const raw = await AsyncStorage.getItem(IDS_KEY);
  const ids = raw ? (JSON.parse(raw) as string[]) : [];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

/**
 * Saves the settings and re-schedules the daily notifications.
 * Returns false when the phone refuses notifications (settings are still saved).
 */
export async function applyReminders(settings: ReminderSettings): Promise<boolean> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  if (!supported) return false;
  await cancelPrevious();
  const wanted = (Object.keys(settings) as ReminderKind[]).filter((kind) => settings[kind].enabled);
  if (wanted.length === 0) {
    await AsyncStorage.setItem(IDS_KEY, "[]");
    return true;
  }
  if (!(await ensurePermission())) return false;
  const channel = await channelId(CHANNELS.reminders);
  const ids = await Promise.all(
    wanted.map((kind) =>
      Notifications.scheduleNotificationAsync({
        content: content(kind),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: settings[kind].hour,
          minute: settings[kind].minute,
          channelId: channel,
        },
      }),
    ),
  );
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  return true;
}

export async function cancelAllReminders(): Promise<void> {
  if (!supported) return;
  await cancelPrevious().catch(() => undefined);
  await AsyncStorage.setItem(IDS_KEY, "[]");
}
