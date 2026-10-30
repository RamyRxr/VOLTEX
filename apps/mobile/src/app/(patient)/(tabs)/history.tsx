import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuestionnaires, useSessions } from "@/api/queries";
import type { BpSession, Questionnaire } from "@/api/types";
import { BpChart, CHART_COLORS } from "@/components/BpChart";
import { AppText, Card, EmptyState, ErrorState, Loading, Screen, Segmented, StatusBadge } from "@/components/ui";
import { t } from "@/i18n";
import { formatDay, formatTime } from "@/lib/format";
import { isDangerItem, yesItems } from "@/lib/questionnaireItems";
import { sessionStatus } from "@/lib/status";
import { useNow } from "@/lib/useNow";
import { colors, radius, space, tones } from "@/theme";

type Tab = "bp" | "symptoms";
type Range = "7" | "14" | "30";

const VALID = new Set(["NORMAL", "HYPERTENSIVE", "SEVERE_CONFIRMED"]);

function groupByDay<T>(items: readonly T[], at: (item: T) => string, now: Date): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of [...items].reverse()) {
    const day = formatDay(at(item), now);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()];
}

export default function History() {
  const [tab, setTab] = useState<Tab>("bp");
  const [range, setRange] = useState<Range>("14");
  const days = Number(range);

  return (
    <Screen inTabs>
      <AppText variant="title" accessibilityRole="header">
        {t("history.title")}
      </AppText>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "bp", label: t("history.tabBp") },
          { value: "symptoms", label: t("history.tabSymptoms") },
        ]}
      />
      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: "7", label: t("history.range7") },
          { value: "14", label: t("history.range14") },
          { value: "30", label: t("history.range30") },
        ]}
      />
      {tab === "bp" ? <BpHistory days={days} rangeLabel={t(`history.range${range}`)} /> : <SymptomHistory days={days} />}
    </Screen>
  );
}

function BpHistory({ days, rangeLabel }: { readonly days: number; readonly rangeLabel: string }) {
  const now = useNow(60_000);
  const query = useSessions(days);
  const sessions = useMemo(() => query.data ?? [], [query.data]);
  const valid = sessions.filter((s) => VALID.has(s.status));
  const avg = (pick: (s: BpSession) => number) =>
    valid.length ? Math.round(valid.reduce((sum, s) => sum + pick(s), 0) / valid.length) : null;
  const avgSys = avg((s) => s.sys);
  const avgDia = avg((s) => s.dia);

  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (sessions.length === 0) return <EmptyState icon="pulse" message={t("history.empty")} />;

  return (
    <>
      <Card>
        <BpChart sessions={sessions} days={days} now={now} accessibilityLabel={t("history.chartLabel", { range: rangeLabel })} />
        <View style={styles.legend}>
          <Legend color={CHART_COLORS.sys} label={t("history.legendSys")} />
          <Legend color={CHART_COLORS.dia} label={t("history.legendDia")} />
          <Legend color={colors.high} label={t("history.legendLimits")} dashed />
        </View>
        <View style={styles.stats}>
          {avgSys !== null && avgDia !== null ? (
            <AppText variant="bodyStrong">{t("history.average", { sys: avgSys, dia: avgDia })}</AppText>
          ) : null}
          <AppText color={colors.textMuted}>{t("history.count", { n: sessions.length })}</AppText>
        </View>
      </Card>
      {groupByDay(sessions, (s) => s.takenAt, now).map(([day, items]) => (
        <View key={day} style={styles.day}>
          <AppText variant="caption" color={colors.textMuted}>
            {day}
          </AppText>
          <View style={styles.group}>
            {items.map((s, i) => (
              <View key={s.id} style={[styles.row, i < items.length - 1 && styles.divider]}>
                <AppText variant="small" color={colors.textMuted} style={styles.time}>
                  {formatTime(s.takenAt)}
                </AppText>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" style={styles.numbers}>
                    {s.sys}/{s.dia}
                  </AppText>
                  {s.pulse ? (
                    <AppText variant="caption" color={colors.textSubtle}>
                      {t("home.pulse", { n: s.pulse })}
                    </AppText>
                  ) : null}
                </View>
                <StatusBadge status={sessionStatus(s.status)} size="sm" />
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function SymptomHistory({ days }: { readonly days: number }) {
  const now = useNow(60_000);
  const query = useQuestionnaires(days);
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const list: readonly Questionnaire[] = query.data ?? [];
  if (list.length === 0) return <EmptyState icon="happy" message={t("history.emptySymptoms")} />;

  return (
    <View style={styles.group}>
      {[...list].reverse().map((q, i, all) => {
        const yes = yesItems(q.answers);
        return (
          <View key={q.id} style={[styles.symptomRow, i < all.length - 1 && styles.divider]}>
            <AppText variant="caption" color={colors.textMuted}>
              {formatDay(q.answeredAt, now)} · {formatTime(q.answeredAt)}
            </AppText>
            {yes.length === 0 ? (
              <StatusBadge status={{ ...tones.ok, word: t("history.noSymptoms") }} size="sm" />
            ) : (
              <View style={styles.chips}>
                {yes.map((item) => (
                  <StatusBadge
                    key={item}
                    size="sm"
                    status={{ ...(isDangerItem(item) ? tones.danger : tones.watch), word: t(`q.item.${item}`) }}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Legend({ color, label, dashed }: { readonly color: string; readonly label: string; readonly dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: dashed ? "transparent" : color, borderColor: color }, dashed && styles.dashed]} />
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  swatch: { width: 16, height: 4, borderRadius: 2, borderWidth: 1 },
  dashed: { borderStyle: "dashed", height: 0, borderTopWidth: 2, borderWidth: 0 },
  stats: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: space.sm },
  day: { gap: space.xs },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  time: { width: 46, fontVariant: ["tabular-nums"] },
  flex: { flex: 1 },
  numbers: { fontSize: 19, fontVariant: ["tabular-nums"] },
  symptomRow: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
