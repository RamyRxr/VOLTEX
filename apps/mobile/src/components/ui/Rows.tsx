import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { colors, radius, space, TOUCH, type IconName } from "@/theme";
import { AppText } from "./AppText";

interface ListRowProps {
  readonly icon: IconName;
  readonly label: string;
  readonly hint?: string;
  readonly onPress: () => void;
  readonly color?: string;
  readonly chevron?: boolean;
}

export function ListRow({ icon, label, hint, onPress, color = colors.text, chevron = true }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={color === colors.text ? colors.accent : color} />
      </View>
      <View style={styles.texts}>
        <AppText variant="bodyStrong" color={color}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="small" color={colors.textMuted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} /> : null}
    </Pressable>
  );
}

interface ToggleRowProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled?: boolean;
}

export function ToggleRow({ label, hint, value, onChange, disabled }: ToggleRowProps) {
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.texts}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="small" color={colors.textMuted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.borderStrong }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

/** Groups rows inside one rounded surface with hairline separators. */
export function RowGroup({ children }: { readonly children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 12,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: 2 },
});
