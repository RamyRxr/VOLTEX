import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

export const CHANNELS = { alerts: "alerts", reminders: "reminders" } as const;
export const supported = Platform.OS === "ios" || Platform.OS === "android";

/** Shows notifications even while the app is open. Call once at startup. */
export function configureNotifications(): void {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync(CHANNELS.alerts, {
      name: "Alertes",
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
    });
    void Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
      name: "Rappels",
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export type PermissionState = "granted" | "denied" | "undetermined";

export async function getPermission(): Promise<PermissionState> {
  if (!supported) return "denied";
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/** Asks only when not decided yet; returns true when notifications may be shown. */
export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.status === "granted";
}

/** Fires a notification right away (doctor alerts, tests). */
export async function notifyNow(title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  if (!supported) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: Platform.OS === "android" ? { channelId: CHANNELS.alerts } : null,
  });
}
