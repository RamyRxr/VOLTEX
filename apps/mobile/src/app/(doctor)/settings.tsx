import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMe, useSession, useSessionUser } from "@/auth/SessionProvider";
import { AppText, ListRow, Notice, RowGroup, Screen, ToggleRow } from "@/components/ui";
import { t } from "@/i18n";
import { clearDoctorSeen, setDoctorPrefs, useDoctorPrefs } from "@/notifications/doctorAlerts";
import { ensurePermission, getPermission, notifyNow, type PermissionState } from "@/notifications/setup";
import { colors, space } from "@/theme";

const PERMISSION_LABEL = {
  granted: "settings.permissionGranted",
  denied: "settings.permissionDenied",
  undetermined: "settings.permissionUnknown",
} as const;

export default function DoctorSettings() {
  const me = useMe();
  const user = useSessionUser();
  const { signOut } = useSession();
  const prefs = useDoctorPrefs();
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
        </RowGroup>
        <Notice icon="information-circle">{t("settings.background")}</Notice>
      </View>

      <View style={styles.section}>
        <AppText variant="caption" color={colors.textMuted}>
          {t("settings.account")}
        </AppText>
        <RowGroup>
          <ListRow icon="person-circle" label={me.fullName} hint={user.email} chevron={false} onPress={() => undefined} />
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
