import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "@/api";
import { ENV } from "@/config/env";
import { ensurePermission, supported } from "./setup";

/** Expo Go cannot receive server push on Android since SDK 53 — a development build is needed. */
export const pushAvailable = supported && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/**
 * Registers this phone for server push (doctor alerts while the app is closed).
 * Off until the API exposes the proposed POST /api/doctor/push-token (EXPO_PUBLIC_PUSH_ENABLED).
 */
export async function registerDoctorPush(): Promise<string | null> {
  if (!ENV.pushEnabled || !pushAvailable) return null;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;
  try {
    if (!(await ensurePermission())) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerPushToken(token);
    return token;
  } catch {
    return null;
  }
}
