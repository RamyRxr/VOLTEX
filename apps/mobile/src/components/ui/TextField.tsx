import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";
import { colors, radius, space, TOUCH } from "@/theme";
import { AppText } from "./AppText";

interface Props extends Omit<TextInputProps, "style"> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}

export const TextField = forwardRef<TextInputInstance, Props>(function TextField({ label, hint, error, multiline, ...input }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        maxFontSizeMultiplier={1.6}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        {...input}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          error ? styles.invalid : null,
        ]}
      />
      {error ? (
        <AppText variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  input: {
    minHeight: TOUCH + 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    fontSize: 18,
    color: colors.text,
  },
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: "top" },
  focused: { borderColor: colors.accent },
  invalid: { borderColor: colors.danger },
});
