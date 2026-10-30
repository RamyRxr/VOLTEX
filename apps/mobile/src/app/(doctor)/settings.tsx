import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "@/api";
import { useMe, useSession } from "@/auth/SessionProvider";
import { AppText, ListRow, Notice, RowGroup, Screen, ToggleRow } from "@/components/ui";
import { t } from "@/i18n";
import { clearDoctorSeen, setDoctorPrefs, useDoctorPrefs } from "@/notifications/doctorAlerts";
import { pushAvailable } from "@/notifications/push";
import { ensurePermission, getPermission, notifyNow, type PermissionState } from "@/notifications/setup";
import { ENV } from "@/config/env";
import { colors, space } from "@/theme";

const PERMISSION_LABEL = {
  granted: "settings.permissionGranted",
  denied: "settings.permissionDenied",
  undetermined: "settings.permissionUnknown",
} as const;

export default function DoctorSettings() {
  const me = useMe();
  const { signOut } = useSession();
  const prefs = useDoctorPrefs();
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<PermissionState>("undetermined");

  useFocusEffect(
    useCallback(() => {
      void getPermission().then(setPermission);
    }, []),
  );

  const enable = async (enabled: boolean) => {
    if (enabled) {
      await ensurePermission();
      setPermission(await getPermission());
    }
    await setDoctorPrefs({ ...prefs, enabled });
  };

  const sendTest = async () => {
    if (await ensurePermission()) {
      await notifyNow(t("settings.testTitle"), t("settings.testBody"), { url: "/alerts" }).catch(() => undefined);
    }
    setPermission(await getPermission());
  };

  const simulate = async () => {
    await api.demo?.simulateAlert();
    await queryClient.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <Screen inTabs>
      <AppText variant="title" accessibilityRole="header">
        {t("settings.title")}
      </AppText>

      <View style={styles.section}>
        <AppText variant="caption" color={colors.textMuted}>
          {t("settings.notifications")}
        </AppText>
        <RowGroup>
          <ToggleRow label={t("settings.notifyOn")} hint={t("settings.notifyOnHint")} value={prefs.enabled} onChange={(v) => void enable(v)} />
          <ToggleRow
            label={t("settings.urgentOnly")}
            hint={t("settings.urgentOnlyHint")}
            value={prefs.urgentOnly}
            disabled={!prefs.enabled}
            onChange={(urgentOnly) => void setDoctorPrefs({ ...prefs, urgentOnly })}
          />
          <ListRow
            icon="notifications"
            label={t("settings.permission")}
            hint={t(PERMISSION_LABEL[permission])}
            chevron={false}
            onPress={() => void enable(true)}
          />
          <ListRow icon="send" label={t("settings.test")} chevron={false} onPress={() => void sendTest()} />
          {api.demo ? <ListRow icon="warning" label={t("settings.simulate")} chevron={false} onPress={() => void simulate()} /> : null}
        </RowGroup>
        <Notice icon="information-circle">{pushAvailable && ENV.pushEnabled ? t("settings.pushReady") : t("settings.background")}</Notice>
      </View>

      <View style={styles.section}>
        <AppText variant="caption" color={colors.textMuted}>
          {t("settings.account")}
        </AppText>
        <RowGroup>
          <ListRow icon="person-circle" label={me.fullName} hint={me.email} chevron={false} onPress={() => undefined} />
          <ListRow
            icon="log-out"
            label={t("common.logout")}
            chevron={false}
            onPress={() => {
              void clearDoctorSeen();
              void signOut();
            }}
          />
        </RowGroup>
      </View>

      <AppText variant="small" color={colors.textSubtle} align="center">
        {t("app.disclaimer")}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
});
