import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLink, useQuestionnaires, useRisk, useSessions } from "@/api/queries";
import { useMe, useSession } from "@/auth/SessionProvider";
import { AppText, Button, Card, EmergencyPill, Notice, Screen, StatusBadge } from "@/components/ui";
import { useLastResult } from "@/features/result/lastResult";
import { t } from "@/i18n";
import { firstName, formatAgo, formatCountdown, isToday } from "@/lib/format";
import { pregnancyWeek } from "@/lib/pregnancy";
import { levelStatus, riskStatus, sessionStatus } from "@/lib/status";
import { useNow, useSecondsLeft } from "@/lib/useNow";
import { colors, radius, space, TOUCH, type IconName } from "@/theme";

export default function Home() {
  const router = useRouter();
  const me = useMe();
  const { welcomePending, setWelcomePending } = useSession();
  const now = useNow();
  const sessions = useSessions(7);
  const questionnaires = useQuestionnaires(1);
  const risk = useRisk();
  const link = useLink();
  const last = useLastResult();
  const secondsLeft = useSecondsLeft(last?.remeasureAt ?? null);

  // Right after the first profile save, show the initial risk once.
  useEffect(() => {
    if (!welcomePending) return;
    setWelcomePending(false);
    router.push({ pathname: "/risk", params: { welcome: "1" } });
  }, [welcomePending, setWelcomePending, router]);

  const patient = me.patient;
  const week = patient ? pregnancyWeek(patient, now) : null;
  const lastSession = sessions.data?.[sessions.data.length - 1] ?? null;
  const questionnaireDone = (questionnaires.data ?? []).some((q) => isToday(q.answeredAt, now));
  const recentResult = last && isToday(last.receivedAt, now) ? last : null;
  const remeasurePending = last?.evaluation.action === "REMEASURE" && secondsLeft !== null;

  return (
    <Screen inTabs>
      <View style={styles.top}>
        <View style={styles.greeting}>
          <AppText variant="title" accessibilityRole="header">
            {t("home.hello", { name: firstName(me.fullName) })}
          </AppText>
          {week !== null ? (
            <AppText color={colors.textMuted}>{t("common.week", { n: week })}</AppText>
          ) : null}
        </View>
        <EmergencyPill />
      </View>

      {remeasurePending ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(secondsLeft === 0 ? "/measure/bp" : "/result")}
          style={[styles.remeasure, secondsLeft === 0 && styles.remeasureReady]}
        >
          <Ionicons name={secondsLeft === 0 ? "alarm" : "hourglass"} size={22} color={colors.onAccent} />
          <AppText variant="bodyStrong" color={colors.onAccent} style={styles.flex}>
            {secondsLeft === 0 ? t("home.remeasureNow") : t("home.remeasureBanner", { time: formatCountdown(secondsLeft) })}
          </AppText>
          <Ionicons name="chevron-forward" size={20} color={colors.onAccent} />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <ActionTile
          icon="pulse"
          title={t("home.measure")}
          hint={t("home.measureHint")}
          primary
          onPress={() => router.push("/measure")}
        />
        <ActionTile
          icon={questionnaireDone ? "checkmark-circle" : "happy"}
          title={t("home.questionnaire")}
          hint={questionnaireDone ? t("home.questionnaireDone") : t("home.questionnaireHint")}
          onPress={() => router.push("/questionnaire")}
        />
      </View>

      <Card>
        <AppText variant="caption" color={colors.textMuted}>
          {t("home.statusTitle")}
        </AppText>
        {recentResult ? (
          <>
            <StatusBadge status={levelStatus(recentResult.evaluation.level, recentResult.evaluation.patientWord)} size="lg" />
            <AppText>{recentResult.evaluation.message}</AppText>
            <AppText variant="small" color={colors.textSubtle}>
              {formatAgo(recentResult.receivedAt, now)}
            </AppText>
          </>
        ) : (
          <AppText color={colors.textMuted}>{t("home.noResult")}</AppText>
        )}
      </Card>

      <Card onPress={() => router.push("/history")} accessibilityLabel={t("home.lastReading")}>
        <View style={styles.cardHead}>
          <AppText variant="caption" color={colors.textMuted}>
            {t("home.lastReading")}
          </AppText>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
        {lastSession ? (
          <View style={styles.reading}>
            <View>
              <AppText style={styles.bigNumber}>
                {lastSession.sys}/{lastSession.dia}
              </AppText>
              <AppText variant="small" color={colors.textMuted}>
                {t("common.mmhg")}
                {lastSession.pulse ? ` · ${t("home.pulse", { n: lastSession.pulse })}` : ""} · {formatAgo(lastSession.takenAt, now)}
              </AppText>
            </View>
            <StatusBadge status={sessionStatus(lastSession.status)} size="sm" />
          </View>
        ) : (
          <AppText color={colors.textMuted}>{sessions.isLoading ? t("common.loading") : t("home.noReading")}</AppText>
        )}
      </Card>

      {risk.data ? (
        <Card onPress={() => router.push("/risk")} accessibilityLabel={t("home.riskTitle")}>
          <View style={styles.cardHead}>
            <AppText variant="caption" color={colors.textMuted}>
              {t("home.riskTitle")}
            </AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </View>
          <StatusBadge status={riskStatus(risk.data.category)} />
          <AppText variant="small" color={colors.accent} style={styles.link}>
            {t("home.riskSee")}
          </AppText>
        </Card>
      ) : null}

      <Card>
        <AppText variant="caption" color={colors.textMuted}>
          {t("home.doctorTitle")}
        </AppText>
        {link.data?.status === "ACCEPTED" ? (
          <View style={styles.reading}>
            <View style={styles.doctorRow}>
              <Ionicons name="medkit" size={20} color={colors.accent} />
              <AppText variant="bodyStrong">{t("home.doctorLinked", { name: link.data.doctorName ?? "" })}</AppText>
            </View>
            <Button variant="secondary" icon="chatbubbles" label={t("home.doctorWrite")} onPress={() => router.push("/chat")} />
          </View>
        ) : link.data?.status === "PENDING" ? (
          <Notice icon="hourglass">{t("home.doctorPending")}</Notice>
        ) : (
          <>
            <AppText color={colors.textMuted}>{t("home.doctorNone")}</AppText>
            <Button variant="secondary" icon="key" label={t("home.doctorAdd")} onPress={() => router.push("/doctor")} />
          </>
        )}
      </Card>

      <AppText variant="small" color={colors.textSubtle} align="center">
        {t("app.disclaimer")}
      </AppText>
    </Screen>
  );
}

interface TileProps {
  readonly icon: IconName;
  readonly title: string;
  readonly hint: string;
  readonly primary?: boolean;
  readonly onPress: () => void;
}

function ActionTile({ icon, title, hint, primary, onPress }: TileProps) {
  const fg = primary ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        primary ? styles.tilePrimary : styles.tileSecondary,
        pressed && (primary ? styles.tilePrimaryPressed : styles.tilePressed),
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: primary ? "rgba(255,255,255,0.18)" : colors.accentSoft }]}>
        <Ionicons name={icon} size={28} color={primary ? colors.onAccent : colors.accent} />
      </View>
      <AppText variant="heading" color={fg}>
        {title}
      </AppText>
      <AppText variant="small" color={primary ? "rgba(255,255,255,0.85)" : colors.textMuted}>
        {hint}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  greeting: { flex: 1, gap: 2 },
  flex: { flex: 1 },
  remeasure: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.high,
    borderRadius: radius.lg,
    padding: space.lg,
    minHeight: TOUCH + 8,
  },
  remeasureReady: { backgroundColor: colors.danger },
  actions: { flexDirection: "row", gap: space.md },
  tile: { flex: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm, minHeight: 156 },
  tilePrimary: { backgroundColor: colors.accent },
  tilePrimaryPressed: { backgroundColor: colors.accentPressed },
  tileSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tilePressed: { backgroundColor: colors.surfaceMuted },
  tileIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, flexWrap: "wrap" },
  bigNumber: { fontSize: 34, lineHeight: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
  link: { fontWeight: "600" },
  doctorRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
});
