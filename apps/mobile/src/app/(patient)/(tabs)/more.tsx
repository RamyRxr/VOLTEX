import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "@/api";
import { useMe, useSession } from "@/auth/SessionProvider";
import { AppText, ListRow, Notice, RowGroup, Screen } from "@/components/ui";
import { ENV } from "@/config/env";
import { clearLastResult } from "@/features/result/lastResult";
import { t } from "@/i18n";
import { callEmergency } from "@/lib/emergency";
import { cancelAllReminders } from "@/notifications/reminders";
import { colors, space } from "@/theme";

export default function More() {
  const router = useRouter();
  const me = useMe();
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const [resetDone, setResetDone] = useState(false);

  const resetDemo = async () => {
    await api.demo?.reset();
    await clearLastResult();
    await queryClient.invalidateQueries();
    setResetDone(true);
  };

  return (
    <Screen inTabs>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t("more.title")}
        </AppText>
        <AppText color={colors.textMuted}>
          {me.fullName} · {me.email}
        </AppText>
      </View>

      <RowGroup>
        <ListRow icon="document-text" label={t("more.profile")} onPress={() => router.push("/profile-edit")} />
        <ListRow icon="shield-checkmark" label={t("more.risk")} onPress={() => router.push("/risk")} />
        <ListRow icon="medkit" label={t("more.doctor")} onPress={() => router.push("/doctor")} />
        <ListRow icon="alarm" label={t("more.reminders")} onPress={() => router.push("/reminders")} />
        <ListRow
          icon="help-circle"
          label={t("more.assistant")}
          hint={t("more.assistantHint")}
          onPress={() => router.push("/assistant")}
        />
      </RowGroup>

      <RowGroup>
        <ListRow icon="call" label={t("more.emergency")} color={colors.danger} onPress={callEmergency} chevron={false} />
      </RowGroup>

      <RowGroup>
        {api.demo ? (
          <ListRow icon="refresh" label={t("more.resetDemo")} onPress={() => void resetDemo()} chevron={false} />
        ) : null}
        <ListRow
          icon="log-out"
          label={t("common.logout")}
          chevron={false}
          onPress={() => {
            void cancelAllReminders();
            void signOut();
          }}
        />
      </RowGroup>

      {resetDone ? <Notice tone="ok">{t("more.resetDone")}</Notice> : null}

      <View style={styles.about}>
        <AppText variant="caption" color={colors.textMuted}>
          {t("more.about")}
        </AppText>
        <AppText variant="small" color={colors.textSubtle}>
          {t("app.disclaimer")}
        </AppText>
        {ENV.useMock ? (
          <AppText variant="small" color={colors.textSubtle}>
            {t("demo.data")}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  about: { gap: space.xs, paddingHorizontal: space.xs },
});
