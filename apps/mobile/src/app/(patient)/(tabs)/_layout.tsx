import { Tabs } from "expo-router/js-tabs";
import { tabIcon as icon } from "@/components/tabIcon";
import { t } from "@/i18n";
import { colors } from "@/theme";

export default function PatientTabs() {
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
      <Tabs.Screen name="home" options={{ title: t("tabs.home"), tabBarIcon: icon("home") }} />
      <Tabs.Screen name="history" options={{ title: t("tabs.history"), tabBarIcon: icon("stats-chart") }} />
      <Tabs.Screen name="chat" options={{ title: t("tabs.chat"), tabBarIcon: icon("chatbubbles") }} />
      <Tabs.Screen name="more" options={{ title: t("tabs.more"), tabBarIcon: icon("person-circle") }} />
    </Tabs>
  );
}
