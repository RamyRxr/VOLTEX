import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { t } from "@/i18n";
import { colors, radius, space, TOUCH } from "@/theme";

interface Props {
  readonly placeholder: string;
  readonly onSend: (text: string) => Promise<void>;
  readonly busy?: boolean;
}

/** Text box + send button for the chat and the assistant. */
export function Composer({ placeholder, onSend, busy }: Props) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !busy;

  const send = async () => {
    if (!canSend) return;
    const value = text.trim();
    setText("");
    try {
      await onSend(value);
    } catch {
      setText(value);
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        style={styles.input}
        maxFontSizeMultiplier={1.5}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.send")}
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={() => void send()}
        style={({ pressed }) => [styles.send, !canSend && styles.sendOff, pressed && styles.sendPressed]}
      >
        {busy ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="send" size={20} color={colors.onAccent} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    minHeight: TOUCH,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    fontSize: 17,
    color: colors.text,
  },
  send: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { opacity: 0.4 },
  sendPressed: { backgroundColor: colors.accentPressed },
});
