import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { AlertListItem as DoctorAlert } from "shared";
import { useDoctorAlerts } from "@/api/queries";
import { t } from "@/i18n";
import { doctorLevelStatus, isUrgentAlert } from "@/lib/status";
import { notifyNow } from "./setup";

/** Doctor-side notification preferences, kept on the phone. */
export interface DoctorNotifyPrefs {
  readonly enabled: boolean;
  readonly urgentOnly: boolean;
}

const PREFS_KEY = "tensiocare.doctorPrefs.v1";
const SEEN_KEY = "tensiocare.doctorSeen.v1";
const DEFAULT_PREFS: DoctorNotifyPrefs = { enabled: true, urgentOnly: false };

let prefs: DoctorNotifyPrefs = DEFAULT_PREFS;
const listeners = new Set<() => void>();

export async function hydrateDoctorPrefs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    prefs = raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DoctorNotifyPrefs>) } : DEFAULT_PREFS;
  } catch {
    prefs = DEFAULT_PREFS;
  }
  listeners.forEach((l) => l());
}

export async function setDoctorPrefs(next: DoctorNotifyPrefs): Promise<void> {
  prefs = next;
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
}

export function useDoctorPrefs(): DoctorNotifyPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
    () => prefs,
  );
}

/** One key per alert version, so a refreshed (de-duplicated) alert notifies again. */
const alertKey = (a: DoctorAlert) => `${a.id}@${a.createdAt}`;

export function shouldNotify(alert: DoctorAlert, p: DoctorNotifyPrefs): boolean {
  return p.enabled && (!p.urgentOnly || isUrgentAlert(alert.level));
}

/**
 * Watches the open alerts (polled) and raises a local notification for each new one.
 * Works in Expo Go while the app is open or recently in the background; server push
 * (push.ts) takes over once the API sends it.
 */
export function useDoctorAlertNotifier(): void {
  const { data } = useDoctorAlerts("OPEN");
  const current = useDoctorPrefs();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    void (async () => {
      let changed = false;
      if (!seen.current) {
        const stored = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
        // First launch: what is already open is shown in the list, not notified.
        seen.current = new Set(stored ? (JSON.parse(stored) as string[]) : data.map(alertKey));
        changed = stored === null;
      }
      const known = seen.current;
      const fresh = data.filter((a) => !known.has(alertKey(a)));
      fresh.forEach((a) => known.add(alertKey(a)));
      if (changed || fresh.length > 0) {
        await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...known].slice(-300))).catch(() => undefined);
      }
      for (const alert of fresh) {
        if (!shouldNotify(alert, current)) continue;
        const level = doctorLevelStatus(alert.level).word;
        await notifyNow(t("doctor.notif.title", { level, name: alert.patientName }), alert.reason, { url: "/alerts" }).catch(
          () => undefined,
        );
      }
    })();
  }, [data, current]);
}

export async function clearDoctorSeen(): Promise<void> {
  await AsyncStorage.removeItem(SEEN_KEY).catch(() => undefined);
}
