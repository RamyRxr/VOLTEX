import { useRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { t } from "@/i18n";
import { colors, radius, space, TOUCH } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  readonly label: string;
  /** Initial "YYYY-MM-DD" (or ""); the field then owns its digits and reports "" while incomplete. */
  readonly value: string;
  readonly onChange: (iso: string) => void;
  readonly error?: string;
}

function split(iso: string) {
  const [y = "", m = "", d = ""] = iso.split("-");
  return { d, m, y };
}

/** Day / month / year as three numeric boxes: no calendar widget to fight with. */
export function DateField({ label, value, onChange, error }: Props) {
  const [parts, setParts] = useState(() => split(value));
  const month = useRef<TextInputInstance>(null);
  const year = useRef<TextInputInstance>(null);

  const update = (next: { d: string; m: string; y: string }) => {
    setParts(next);
    const complete = next.d.length > 0 && next.m.length > 0 && next.y.length === 4;
    onChange(complete ? `${next.y}-${next.m.padStart(2, "0")}-${next.d.padStart(2, "0")}` : "");
  };

  const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

  return (
    <View style={styles.wrap}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View style={styles.row} accessibilityLabel={label}>
        <TextInput
          accessibilityLabel={`${label} — ${t("date.day")}`}
          placeholder={t("date.day")}
          keyboardType="number-pad"
          maxLength={2}
          value={parts.d}
          onChangeText={(s) => {
            const d = digits(s, 2);
            update({ ...parts, d });
            if (d.length === 2) month.current?.focus();
          }}
          style={[styles.box, error ? styles.invalid : null]}
          placeholderTextColor={colors.textSubtle}
          maxFontSizeMultiplier={1.4}
        />
        <AppText variant="title" color={colors.textSubtle}>
          /
        </AppText>
        <TextInput
          ref={month}
          accessibilityLabel={`${label} — ${t("date.month")}`}
          placeholder={t("date.month")}
          keyboardType="number-pad"
          maxLength={2}
          value={parts.m}
          onChangeText={(s) => {
            const m = digits(s, 2);
            update({ ...parts, m });
            if (m.length === 2) year.current?.focus();
          }}
          style={[styles.box, error ? styles.invalid : null]}
          placeholderTextColor={colors.textSubtle}
          maxFontSizeMultiplier={1.4}
        />
        <AppText variant="title" color={colors.textSubtle}>
          /
        </AppText>
        <TextInput
          ref={year}
          accessibilityLabel={`${label} — ${t("date.year")}`}
          placeholder={t("date.year")}
          keyboardType="number-pad"
          maxLength={4}
          value={parts.y}
          onChangeText={(s) => update({ ...parts, y: digits(s, 4) })}
          style={[styles.box, styles.year, error ? styles.invalid : null]}
          placeholderTextColor={colors.textSubtle}
          maxFontSizeMultiplier={1.4}
        />
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  box: {
    width: 64,
    minHeight: TOUCH + 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 20,
    color: colors.text,
  },
  year: { width: 92 },
  invalid: { borderColor: colors.danger },
});
