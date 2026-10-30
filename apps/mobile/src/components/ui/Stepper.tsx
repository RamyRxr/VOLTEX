import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { t } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  readonly label: string;
  readonly hint?: string;
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  readonly compact?: boolean;
  readonly disabled?: boolean;
  readonly pad?: number;
}

const HOLD_DELAY_MS = 380;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Big − / + stepper. Press and hold repeats, faster the longer it is held.
 * The number itself can be tapped and typed.
 */
export function Stepper({ label, hint, unit, value, min, max, step = 1, onChange, compact, disabled, pad = 0 }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const valueRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeats = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => () => stop(), []);

  const bump = (direction: 1 | -1) => {
    const next = clamp(valueRef.current + direction * step, min, max);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const repeat = (direction: 1 | -1) => {
    repeats.current += 1;
    bump(direction);
    const interval = repeats.current > 12 ? 45 : repeats.current > 5 ? 90 : 150;
    timer.current = setTimeout(() => repeat(direction), interval);
  };

  const start = (direction: 1 | -1) => {
    repeats.current = 0;
    timer.current = setTimeout(() => repeat(direction), HOLD_DELAY_MS);
  };

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed)) onChange(clamp(parsed, min, max));
    setDraft(null);
  };

  const size = compact ? 52 : 68;
  const display = pad ? String(value).padStart(pad, "0") : String(value);

  return (
    <View style={[styles.card, compact && styles.compact, disabled && styles.disabled]} pointerEvents={disabled ? "none" : "auto"}>
      {!compact ? (
        <View style={styles.labels}>
          <AppText variant="heading">{label}</AppText>
          {hint ? (
            <AppText variant="small" color={colors.textMuted}>
              {hint}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("bp.decrease", { label })}
          onPress={() => bump(-1)}
          onLongPress={() => undefined}
          delayLongPress={HOLD_DELAY_MS}
          onPressIn={() => start(-1)}
          onPressOut={stop}
          style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.btnPressed]}
        >
          <Ionicons name="remove" size={compact ? 26 : 34} color={colors.accent} />
        </Pressable>
        <View style={styles.valueBox}>
          <TextInput
            accessibilityLabel={`${label}, ${value} ${unit}`}
            accessibilityHint={hint}
            value={draft ?? display}
            onFocus={() => setDraft(String(value))}
            onChangeText={(s) => setDraft(s.replace(/\D/g, "").slice(0, 3))}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            maxFontSizeMultiplier={1.2}
            style={[styles.value, compact && styles.valueCompact]}
          />
          <AppText variant="caption" color={colors.textMuted} align="center">
            {unit}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("bp.increase", { label })}
          onPress={() => bump(1)}
          onLongPress={() => undefined}
          delayLongPress={HOLD_DELAY_MS}
          onPressIn={() => start(1)}
          onPressOut={stop}
          style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.btnPressed]}
        >
          <Ionicons name="add" size={compact ? 26 : 34} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  compact: { padding: space.sm, borderWidth: 0, backgroundColor: "transparent" },
  disabled: { opacity: 0.4 },
  labels: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btn: { backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  btnPressed: { backgroundColor: "#D3D9F6" },
  valueBox: { flex: 1, alignItems: "center" },
  value: { fontSize: 52, fontWeight: "700", color: colors.text, textAlign: "center", minWidth: 120, paddingVertical: 0, fontVariant: ["tabular-nums"] },
  valueCompact: { fontSize: 34, minWidth: 70 },
});
