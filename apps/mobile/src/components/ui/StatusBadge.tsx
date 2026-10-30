import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import type { Status } from "@/lib/status";
import { radius, space } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  readonly status: Status;
  readonly size?: "sm" | "md" | "lg";
}

/** Icon + colour + word, never colour alone. */
export function StatusBadge({ status, size = "md" }: Props) {
  const iconSize = size === "lg" ? 22 : size === "md" ? 18 : 15;
  return (
    <View
      accessible
      accessibilityLabel={status.word}
      style={[styles.badge, size === "lg" && styles.lg, size === "sm" && styles.sm, { backgroundColor: status.bg }]}
    >
      <Ionicons name={status.icon} size={iconSize} color={status.fg} />
      <AppText variant={size === "lg" ? "heading" : size === "md" ? "bodyStrong" : "caption"} color={status.fg} style={styles.text}>
        {status.word}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: space.xs + 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  lg: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  sm: { paddingHorizontal: space.sm, paddingVertical: 3, gap: space.xs },
  text: { flexShrink: 1 },
});
