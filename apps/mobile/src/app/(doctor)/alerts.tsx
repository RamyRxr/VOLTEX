import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDoctorAlerts, useUpdateAlert } from "@/api/queries";
import type { DoctorAlert } from "@/api/types";
import { useMe } from "@/auth/SessionProvider";
import { AppText, Button, Card, EmptyState, ErrorState, Loading, Notice, Segmented, StatusBadge } from "@/components/ui";
import { ENV } from "@/config/env";
import { t } from "@/i18n";
import { formatAgo } from "@/lib/format";
import { alertRank, doctorLevelStatus } from "@/lib/status";
import { useNow } from "@/lib/useNow";
import { ensurePermission, getPermission, type PermissionState } from "@/notifications/setup";
import { colors, radius, space } from "@/theme";

type Tab = "OPEN" | "ACKNOWLEDGED";

const byUrgency = (a: DoctorAlert, b: DoctorAlert) =>
  alertRank(a.level) - alertRank(b.level) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

/** Open alerts, most urgent first (spec §6.5 order). */
export default function DoctorAlerts() {
  const me = useMe();
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab>("OPEN");
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const open = useDoctorAlerts("OPEN");
  const seen = useDoctorAlerts("ACKNOWLEDGED");
  const query = tab === "OPEN" ? open : seen;
  const alerts = [...(query.data ?? [])].sort(byUrgency);
  const openCount = open.data?.length ?? 0;

  useFocusEffect(
    useCallback(() => {
      void getPermission().then(setPermission);
    }, []),
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {ENV.demoMode ? (
        <View style={styles.demo}>
          <AppText variant="caption" color={colors.watch} align="center">
            {t("demo.banner")}
          </AppText>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
      >
        <View style={styles.head}>
          <AppText variant="title" accessibilityRole="header">
            {t("doctor.hello", { name: me.fullName })}
          </AppText>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, open.isError && styles.liveDotOff]} />
            <AppText variant="small" color={colors.textMuted}>
              {openCount === 0 ? t("doctor.openNone") : openCount === 1 ? t("doctor.openOne") : t("doctor.openCount", { n: openCount })}
              {" · "}
              {t("doctor.live")}
            </AppText>
          </View>
        </View>

        {permission && permission !== "granted" ? (
          <Card tint={colors.accentSoft}>
            <View style={styles.permRow}>
              <Ionicons name="notifications" size={26} color={colors.accent} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{t("doctor.enableTitle")}</AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {t("doctor.enableBody")}
                </AppText>
              </View>
            </View>
            <Button
              label={t("doctor.enableCta")}
              onPress={() => void ensurePermission().then(() => getPermission().then(setPermission))}
            />
          </Card>
        ) : null}

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "OPEN", label: `${t("doctor.tabOpen")}${openCount ? ` (${openCount})` : ""}` },
            { value: "ACKNOWLEDGED", label: t("doctor.tabSeen") },
          ]}
        />

        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : alerts.length === 0 ? (
          <EmptyState icon={tab === "OPEN" ? "checkmark-done" : "time"} message={tab === "OPEN" ? t("doctor.emptyOpen") : t("doctor.emptySeen")} />
        ) : (
          alerts.map((alert) => <AlertCard key={alert.id} alert={alert} now={now} />)
        )}

        <Notice icon="information-circle">{t("doctor.dashboardHint")}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertCard({ alert, now }: { readonly alert: DoctorAlert; readonly now: Date }) {
  const update = useUpdateAlert();
  const status = doctorLevelStatus(alert.level);
  return (
    <View style={styles.alert} accessible={false}>
      <View style={[styles.stripe, { backgroundColor: status.fg }]} />
      <View style={styles.alertBody}>
        <View style={styles.alertHead}>
          <StatusBadge status={status} size="sm" />
          <AppText variant="caption" color={colors.textSubtle}>
            {formatAgo(alert.createdAt, now)}
          </AppText>
        </View>
        <AppText variant="heading">
          {alert.patientName}
          {alert.pregnancyWeek !== null ? (
            <AppText variant="body" color={colors.textMuted}>
              {` · ${t("common.weekShort", { n: alert.pregnancyWeek })}`}
            </AppText>
          ) : null}
        </AppText>
        <AppText color={colors.textMuted}>{alert.reason}</AppText>
        {alert.status === "OPEN" ? (
          <Button
            variant="secondary"
            icon="checkmark"
            label={t("doctor.ack")}
            loading={update.isPending}
            onPress={() => update.mutate({ id: alert.id, action: "ACK" })}
          />
        ) : alert.ackAt ? (
          <AppText variant="caption" color={colors.textSubtle}>
            {t("doctor.acked", { when: formatAgo(alert.ackAt, now) })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  demo: { backgroundColor: colors.watchSoft, paddingVertical: 3 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  head: { gap: space.xs },
  liveRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok },
  liveDotOff: { backgroundColor: colors.silent },
  permRow: { flexDirection: "row", gap: space.md, alignItems: "center" },
  flex: { flex: 1 },
  alert: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  stripe: { width: 6 },
  alertBody: { flex: 1, padding: space.lg, gap: space.sm },
  alertHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
});
