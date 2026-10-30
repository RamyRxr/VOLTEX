import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet } from "react-native";
import { t } from "@/i18n";
import { callEmergency } from "@/lib/emergency";
import { colors, radius, space, TOUCH } from "@/theme";
import { AppText } from "./AppText";

/** Always-visible shortcut to call 14 (SAMU). */
export function EmergencyPill() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.call14")}
      onPress={callEmergency}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Ionicons name="call" size={16} color={colors.danger} />
      <AppText variant="caption" color={colors.danger} style={styles.label}>
        {t("common.emergency14")}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: TOUCH - 8,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  pressed: { opacity: 0.7 },
  label: { fontWeight: "700" },
});
