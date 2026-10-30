import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Button, Card, Checkbox, Screen, ScreenHeader } from "@/components/ui";
import { recordConsent } from "@/features/onboarding/consent";
import { t, type TKey } from "@/i18n";
import { colors, space, type IconName } from "@/theme";

const SECTIONS: readonly { icon: IconName; title: TKey; body: TKey; danger?: boolean }[] = [
  { icon: "document-text", title: "consent.collect.title", body: "consent.collect.body" },
  { icon: "lock-closed", title: "consent.who.title", body: "consent.who.body" },
  { icon: "medkit", title: "consent.not.title", body: "consent.not.body" },
  { icon: "call", title: "consent.emergency.title", body: "consent.emergency.body", danger: true },
  { icon: "hand-left", title: "consent.rights.title", body: "consent.rights.body" },
];

export default function Consent() {
  const router = useRouter();
  const { signOut } = useSession();
  const [accepted, setAccepted] = useState(false);

  return (
    <Screen
      header={<ScreenHeader back={false} right={<Button variant="ghost" label={t("common.logout")} onPress={() => void signOut()} />} />}
      footer={
        <>
          <Checkbox label={t("consent.checkbox")} checked={accepted} onChange={setAccepted} />
          <Button
            size="lg"
            label={t("consent.submit")}
            disabled={!accepted}
            onPress={() => {
              recordConsent();
              router.push("/profile");
            }}
          />
        </>
      }
    >
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t("consent.title")}
        </AppText>
        <AppText color={colors.textMuted}>{t("consent.intro")}</AppText>
      </View>
      {SECTIONS.map((s) => (
        <Card key={s.title} tint={s.danger ? colors.dangerSoft : undefined}>
          <View style={styles.row}>
            <Ionicons name={s.icon} size={22} color={s.danger ? colors.danger : colors.accent} />
            <View style={styles.texts}>
              <AppText variant="bodyStrong" color={s.danger ? colors.danger : colors.text}>
                {t(s.title)}
              </AppText>
              <AppText color={s.danger ? colors.danger : colors.textMuted}>{t(s.body)}</AppText>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  row: { flexDirection: "row", gap: space.md },
  texts: { flex: 1, gap: 2 },
});
