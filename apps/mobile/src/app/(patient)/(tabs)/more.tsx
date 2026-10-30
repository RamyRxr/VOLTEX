import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useMe, useSession, useSessionUser } from "@/auth/SessionProvider";
import { AppText, ListRow, RowGroup, Screen } from "@/components/ui";
import { t } from "@/i18n";
import { callEmergency } from "@/lib/emergency";
import { cancelAllReminders } from "@/notifications/reminders";
import { colors, space } from "@/theme";

export default function More() {
  const router = useRouter();
  const me = useMe();
  const user = useSessionUser();
  const { signOut } = useSession();

  return (
    <Screen inTabs>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t("more.title")}
        </AppText>
        <AppText color={colors.textMuted}>
          {me.fullName} · {user.email}
        </AppText>
      </View>

      <RowGroup>
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

      <View style={styles.about}>
        <AppText variant="caption" color={colors.textMuted}>
          {t("more.about")}
        </AppText>
        <AppText variant="small" color={colors.textSubtle}>
          {t("app.disclaimer")}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  about: { gap: space.xs, paddingHorizontal: space.xs },
});
