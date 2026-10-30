import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { t } from "@/i18n";
import { colors, radius, space, TOUCH } from "@/theme";
import { AppText } from "./AppText";

interface SegmentedProps<T extends string> {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel?: string;
  readonly danger?: T;
}

/** Large side-by-side choices; the selected one is filled and ticked. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, danger }: SegmentedProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        const fill = selected ? (option.value === danger ? colors.danger : colors.accent) : colors.surface;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: fill, borderColor: selected ? fill : colors.borderStrong },
              pressed && !selected && styles.pressed,
            ]}
          >
            {selected ? <Ionicons name="checkmark" size={20} color={colors.onAccent} /> : null}
            <AppText variant="bodyStrong" color={selected ? colors.onAccent : colors.text} align="center">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface YesNoProps {
  readonly question: string;
  readonly value: boolean | null | undefined;
  readonly onChange: (value: boolean) => void;
  readonly error?: string;
  /** Highlights "Oui" in red (danger symptoms). */
  readonly dangerOnYes?: boolean;
  readonly hint?: string;
}

export function YesNo({ question, value, onChange, error, dangerOnYes, hint }: YesNoProps) {
  const current = value === true ? "yes" : value === false ? "no" : null;
  return (
    <View style={styles.question}>
      <AppText variant="bodyStrong">{question}</AppText>
      <Segmented
        accessibilityLabel={question}
        options={[
          { value: "yes", label: t("common.yes") },
          { value: "no", label: t("common.no") },
        ]}
        value={current}
        danger={dangerOnYes ? "yes" : undefined}
        onChange={(v) => onChange(v === "yes")}
      />
      {hint && value === true ? (
        <AppText variant="small" color={colors.danger}>
          {hint}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Ionicons name="checkmark" size={20} color={colors.onAccent} /> : null}
      </View>
      <AppText style={styles.checkLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  option: {
    flex: 1,
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  question: { gap: space.sm },
  checkRow: { flexDirection: "row", gap: space.md, alignItems: "center", minHeight: TOUCH },
  box: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { flex: 1 },
});
