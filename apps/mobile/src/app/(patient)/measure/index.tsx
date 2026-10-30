import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, Screen, ScreenHeader } from "@/components/ui";
import { t, type TKey } from "@/i18n";
import { colors, space, type IconName } from "@/theme";

const STEPS: readonly [IconName, TKey][] = [
  ["time", "guide.rest"],
  ["body", "guide.sit"],
  ["hand-left", "guide.arm"],
  ["volume-mute", "guide.talk"],
];

/** Short guidance before measuring (CLAUDE.md §4.1.5). */
export default function MeasureGuide() {
  const router = useRouter();
  return (
    <Screen
      header={<ScreenHeader title={t("guide.title")} />}
      footer={<Button size="lg" icon="checkmark" label={t("guide.ready")} onPress={() => router.replace("/measure/bp")} />}
    >
      <AppText color={colors.textMuted}>{t("guide.subtitle")}</AppText>
      <Card>
        {STEPS.map(([icon, key], index) => (
          <View key={key} style={[styles.step, index < STEPS.length - 1 && styles.divider]}>
            <View style={styles.badge}>
              <Ionicons name={icon} size={24} color={colors.accent} />
            </View>
            <AppText style={styles.text}>{t(key)}</AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
});
