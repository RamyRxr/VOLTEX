import { Tabs } from "expo-router/js-tabs";
import { useDoctorAlerts } from "@/api/queries";
import { tabIcon } from "@/components/tabIcon";
import { t } from "@/i18n";
import { useDoctorAlertNotifier } from "@/notifications/doctorAlerts";
import { colors } from "@/theme";

export const unstable_settings = { anchor: "alerts" };

/**
 * The doctor's light mobile space: alerts + local notifications while the app runs
 * (server push is on the roadmap, spec §11).
 * The full patient file stays on the web dashboard.
 */
export default function DoctorLayout() {
  useDoctorAlertNotifier();
  const open = useDoctorAlerts("OPEN");
  const count = open.data?.length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 64 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="alerts"
        options={{
          title: t("tabs.alerts"),
          tabBarIcon: tabIcon("notifications"),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger },
        }}
      />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: tabIcon("settings") }} />
    </Tabs>
  );
}
