import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useQuestionnaires } from "@/api/queries";
import { AppText, Button, Card, Notice, Screen, StatusBadge } from "@/components/ui";
import { useLastResult, type LastResult } from "@/features/result/lastResult";
import { t } from "@/i18n";
import { callEmergency } from "@/lib/emergency";
import { formatCountdown, isToday } from "@/lib/format";
import { levelStatus } from "@/lib/status";
import { useSecondsLeft } from "@/lib/useNow";
import { colors, radius, space } from "@/theme";

/** What to do now, as answered by the API (CLAUDE.md §4.1.7). */
export default function Result() {
  const result = useLastResult();
  if (!result) return <Redirect href="/home" />;
  if (result.evaluation.action === "CALL_EMERGENCY") return <EmergencyResult result={result} />;
  if (result.evaluation.action === "REMEASURE") return <RemeasureResult result={result} />;
  return <StandardResult result={result} />;
}

function EmergencyResult({ result }: { readonly result: LastResult }) {
  const router = useRouter();
  return (
    <Screen
      background={colors.danger}
      footer={
        <>
          <Button size="lg" variant="inverse" icon="call" label={t("common.call14")} onPress={callEmergency} />
          <Button variant="onDanger" label={t("result.understood")} onPress={() => router.replace("/home")} />
        </>
      }
    >
      <View style={styles.emergency} accessibilityLiveRegion="assertive">
        <View style={styles.emergencyIcon}>
          <Ionicons name="warning" size={64} color={colors.danger} />
        </View>
        <AppText variant="display" color={colors.onAccent} align="center" accessibilityRole="header">
          {result.evaluation.patientWord || t("result.emergencyTitle")}
        </AppText>
        <AppText variant="title" color={colors.onAccent} align="center" style={styles.emergencyMessage}>
          {result.evaluation.message}
        </AppText>
        {result.offline ? (
          <AppText color={colors.onAccent} align="center">
            {t("result.offlineEmergency")}
          </AppText>
        ) : null}
        <AppText variant="bodyStrong" color={colors.onAccent} align="center">
          {t("result.emergencyNoWait")}
        </AppText>
      </View>
    </Screen>
  );
}

const RING = 200;
const STROKE = 12;

function RemeasureResult({ result }: { readonly result: LastResult }) {
  const router = useRouter();
  const left = useSecondsLeft(result.remeasureAt) ?? 0;
  const total = Math.max(1, result.evaluation.remeasureInSeconds ?? 1);
  const ready = left === 0;
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <Screen
      footer={
        <>
          <Button
            size="lg"
            icon="pulse"
            label={t("result.remeasureCta")}
            disabled={!ready}
            onPress={() => router.replace("/measure/bp")}
          />
          <Button variant="ghost" label={t("result.home")} onPress={() => router.replace("/home")} />
        </>
      }
    >
      <View style={styles.center}>
        <StatusBadge status={{ ...levelStatus("HIGH", t("result.remeasureTitle")), icon: "hourglass" }} size="lg" />
        {result.bp ? (
          <AppText style={styles.bp}>
            {result.bp.sys}/{result.bp.dia}
          </AppText>
        ) : null}
        <AppText variant="heading" align="center">
          {result.evaluation.message}
        </AppText>
        <View style={styles.ring} accessibilityLabel={`${t("result.remeasureIn")} ${formatCountdown(left)}`}>
          <Svg width={RING} height={RING}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={ready ? colors.ok : colors.high}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (left / total)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View style={styles.ringLabel}>
            {ready ? (
              <Ionicons name="checkmark-circle" size={48} color={colors.ok} />
            ) : (
              <>
                <AppText variant="small" color={colors.textMuted}>
                  {t("result.remeasureIn")}
                </AppText>
                <AppText style={styles.countdown}>{formatCountdown(left)}</AppText>
              </>
            )}
          </View>
        </View>
        {ready ? <AppText variant="bodyStrong">{t("result.remeasureReady")}</AppText> : null}
      </View>
      <Notice tone="danger" action={<Button variant="danger" icon="call" label={t("common.call14")} onPress={callEmergency} />}>
        {t("result.remeasureSymptoms")}
      </Notice>
    </Screen>
  );
}

function StandardResult({ result }: { readonly result: LastResult }) {
  const router = useRouter();
  const today = useQuestionnaires(1);
  const questionnaireDone = (today.data ?? []).some((q) => isToday(q.answeredAt, new Date()));
  const status = levelStatus(result.evaluation.level, result.evaluation.patientWord);
  const showQuestionnaire = result.source === "SESSION" && !questionnaireDone;

  return (
    <Screen
      footer={
        <>
          {showQuestionnaire ? (
            <Button size="lg" icon="happy" label={t("result.doQuestionnaire")} onPress={() => router.replace("/questionnaire")} />
          ) : null}
          <Button
            variant={showQuestionnaire ? "ghost" : "primary"}
            size={showQuestionnaire ? "md" : "lg"}
            label={t("result.home")}
            onPress={() => router.replace("/home")}
          />
        </>
      }
    >
      <View style={styles.center}>
        <View style={[styles.statusIcon, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={64} color={status.fg} />
        </View>
        <StatusBadge status={status} size="lg" />
        {result.bp ? (
          <AppText style={styles.bp}>
            {result.bp.sys}/{result.bp.dia}
            <AppText variant="body" color={colors.textMuted}>
              {` ${t("common.mmhg")}`}
            </AppText>
          </AppText>
        ) : null}
      </View>
      <Card>
        <AppText variant="heading">{result.evaluation.message}</AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emergency: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, paddingTop: space.xxl },
  emergencyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyMessage: { fontWeight: "700" },
  center: { alignItems: "center", gap: space.lg, paddingTop: space.xl },
  statusIcon: { width: 120, height: 120, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  bp: { fontSize: 44, lineHeight: 52, fontWeight: "700", fontVariant: ["tabular-nums"] },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringLabel: { position: "absolute", alignItems: "center" },
  countdown: { fontSize: 40, lineHeight: 46, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
