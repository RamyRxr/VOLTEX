import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Logo } from "@/components/Logo";
import { AppText, Button, Screen } from "@/components/ui";
import { t } from "@/i18n";
import { colors, space, type IconName } from "@/theme";

const POINTS: readonly [IconName, "welcome.point1" | "welcome.point2" | "welcome.point3"][] = [
  ["pulse", "welcome.point1"],
  ["chatbubble-ellipses", "welcome.point2"],
  ["notifications", "welcome.point3"],
];

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen
      footer={
        <>
          <Button size="lg" label={t("welcome.patientCta")} onPress={() => router.push("/register")} />
          <Button variant="secondary" label={t("welcome.login")} onPress={() => router.push("/login")} />
          <Button
            variant="ghost"
            icon="medkit"
            label={t("welcome.doctor")}
            onPress={() => router.push({ pathname: "/login", params: { as: "doctor" } })}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <Logo variant="full" size={210} />
        <AppText variant="display" align="center" accessibilityRole="header">
          {t("welcome.title")}
        </AppText>
        <AppText align="center" color={colors.textMuted}>
          {t("welcome.body")}
        </AppText>
      </View>
      <View style={styles.points}>
        {POINTS.map(([icon, key]) => (
          <View key={key} style={styles.point}>
            <View style={styles.pointIcon}>
              <Ionicons name={icon} size={20} color={colors.accent} />
            </View>
            <AppText style={styles.pointText}>{t(key)}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: space.md, paddingTop: space.xl },
  points: { gap: space.md, paddingHorizontal: space.sm },
  point: { flexDirection: "row", alignItems: "center", gap: space.md },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: { flex: 1 },
});
