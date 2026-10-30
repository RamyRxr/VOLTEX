import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space, TOUCH, type IconName } from "@/theme";
import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse" | "onDanger";

interface Props {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: Variant;
  readonly icon?: IconName;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly size?: "md" | "lg";
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityHint?: string;
}

const PALETTE: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent },
  secondary: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.accent, border: colors.borderStrong },
  ghost: { bg: "transparent", pressed: colors.surfaceMuted, fg: colors.accent },
  danger: { bg: colors.danger, pressed: colors.dangerPressed, fg: colors.onAccent },
  inverse: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger },
  onDanger: { bg: "rgba(255,255,255,0.14)", pressed: "rgba(255,255,255,0.28)", fg: colors.onAccent },
};

export function Button({ label, onPress, variant = "primary", icon, loading, disabled, size = "md", style, accessibilityHint }: Props) {
  const p = PALETTE[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "lg" && styles.lg,
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border ?? "transparent" },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === "lg" ? 24 : 20} color={p.fg} /> : null}
          <AppText variant="bodyStrong" color={p.fg} align="center" style={size === "lg" ? styles.lgText : undefined}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH + 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: { minHeight: 64, borderRadius: radius.lg },
  lgText: { fontSize: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
  inactive: { opacity: 0.45 },
});
