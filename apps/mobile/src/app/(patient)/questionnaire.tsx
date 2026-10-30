import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAddQuestionnaire } from "@/api/queries";
import type { Evaluation } from "@/api/types";
import { AppText, Button, Notice, Screen, ScreenHeader, YesNo } from "@/components/ui";
import { recordResult } from "@/features/result/record";
import { t } from "@/i18n";
import { ALL_ITEMS, hasDangerAnswer, isDangerItem, type QuestionnaireItem } from "@/lib/questionnaireItems";
import { colors, radius, space } from "@/theme";

/** Shown by the phone itself if a danger sign was ticked but the API is unreachable. */
const OFFLINE_EMERGENCY: Evaluation = {
  level: "EMERGENCY",
  patientWord: t("level.EMERGENCY"),
  icon: "EMERGENCY",
  color: "EMERGENCY",
  message: t("consent.emergency.body"),
  action: "CALL_EMERGENCY",
};

export default function QuestionnaireScreen() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<QuestionnaireItem, boolean>>>({});
  const [failed, setFailed] = useState(false);
  const add = useAddQuestionnaire();

  const answered = ALL_ITEMS.filter((item) => answers[item] !== undefined).length;
  const complete = answered === ALL_ITEMS.length;

  const submit = async () => {
    setFailed(false);
    const payload = Object.fromEntries(ALL_ITEMS.map((item) => [item, answers[item] === true]));
    try {
      const { evaluation } = await add.mutateAsync(payload);
      await recordResult(evaluation, "QUESTIONNAIRE", null);
      router.replace("/result");
    } catch {
      // Never leave a patient with a danger sign on an error message.
      if (hasDangerAnswer(payload)) {
        await recordResult(OFFLINE_EMERGENCY, "QUESTIONNAIRE", null, { offline: true });
        router.replace("/result");
        return;
      }
      setFailed(true);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t("q.title")} />}
      footer={
        <>
          {failed ? <Notice tone="danger">{t("common.offline")}</Notice> : null}
          <AppText variant="small" color={colors.textMuted} align="center">
            {complete ? t("q.progress", { n: answered, total: ALL_ITEMS.length }) : t("q.answerAll")}
          </AppText>
          <Button size="lg" label={t("q.submit")} disabled={!complete} loading={add.isPending} onPress={() => void submit()} />
        </>
      }
    >
      <AppText variant="heading">{t("q.subtitle")}</AppText>
      {ALL_ITEMS.map((item) => (
        <View key={item} style={[styles.item, answers[item] === true && isDangerItem(item) && styles.itemDanger]}>
          <YesNo
            question={t(`q.item.${item}`)}
            value={answers[item]}
            dangerOnYes={isDangerItem(item)}
            hint={isDangerItem(item) ? t("q.dangerHint") : undefined}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [item]: value }))}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  itemDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
});
