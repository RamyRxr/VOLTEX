import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import { api } from "@/api";
import { Bubble } from "@/components/Bubble";
import { Composer } from "@/components/Composer";
import { AppText, Button, Notice, Screen, ScreenHeader } from "@/components/ui";
import { t, type TKey } from "@/i18n";
import { colors, radius, space } from "@/theme";

interface Turn {
  readonly id: number;
  readonly question: string;
  readonly answer: string | null;
  readonly failed?: boolean;
}

/** Answers that send the patient to emergency care also offer the questionnaire. */
const pointsToEmergency = (answer: string) => /appelez le 14/i.test(answer);

const SUGGESTIONS: readonly TKey[] = ["assistant.suggest1", "assistant.suggest2", "assistant.suggest3", "assistant.suggest4"];

/** General information only, never a diagnosis (CLAUDE.md §9.3). Answers come from the server. */
export default function Assistant() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const scroll = useRef<ScrollViewInstance>(null);
  const ask = useMutation({ mutationFn: (question: string) => api.askAssistant(question) });

  const send = async (question: string) => {
    const id = Date.now();
    setTurns((prev) => [...prev, { id, question, answer: null }]);
    try {
      const { answer } = await ask.mutateAsync(question);
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, answer } : turn)));
    } catch {
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, answer: t("assistant.error"), failed: true } : turn)));
    }
  };

  return (
    <Screen
      scroll={false}
      header={<ScreenHeader title={t("assistant.title")} />}
      footer={<Composer placeholder={t("assistant.placeholder")} busy={ask.isPending} onSend={send} />}
    >
      <Notice tone="high" icon="information-circle">
        {t("assistant.banner")}
      </Notice>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 ? (
          <View style={styles.empty}>
            <AppText color={colors.textMuted}>{t("assistant.intro")}</AppText>
            {SUGGESTIONS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(key)}
                onPress={() => void send(t(key))}
                style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              >
                <AppText color={colors.accent} variant="bodyStrong">
                  {t(key)}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          turns.map((turn) => (
            <View key={turn.id}>
              <Bubble mine body={turn.question} />
              {turn.answer === null ? (
                <Bubble mine={false} body={t("assistant.thinking")} />
              ) : (
                <>
                  <Bubble mine={false} body={turn.answer} />
                  {!turn.failed && pointsToEmergency(turn.answer) ? (
                    <Button variant="secondary" icon="happy" label={t("assistant.openQuestionnaire")} onPress={() => router.push("/questionnaire")} />
                  ) : null}
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thread: { paddingVertical: space.sm, gap: space.xs },
  empty: { gap: space.md },
  suggestion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.surfaceMuted },
});
