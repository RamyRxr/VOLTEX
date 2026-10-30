import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useRisk } from "@/api/queries";
import type { RiskDto } from "shared";
import { AppText, Button, Card, ErrorState, Loading, Notice, Screen, ScreenHeader, StatusBadge } from "@/components/ui";
import { t } from "@/i18n";
import { formatAgo } from "@/lib/format";
import { riskStatus } from "@/lib/status";
import { colors, space } from "@/theme";

/** Risk category with the factors behind it — never a bare category (spec §6.6). */
export default function RiskScreen() {
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const isWelcome = welcome === "1";
  const risk = useRisk();

  const footer = isWelcome ? (
    <>
      <Button size="lg" icon="key" label={t("risk.welcomeCta")} onPress={() => router.replace({ pathname: "/doctor", params: { welcome: "1" } })} />
      <Button variant="ghost" label={t("common.later")} onPress={() => router.replace("/home")} />
    </>
  ) : undefined;

  return (
    <Screen
      header={<ScreenHeader title={isWelcome ? t("risk.welcomeTitle") : t("risk.title")} back={!isWelcome} />}
      footer={footer}
    >
      {risk.isLoading ? (
        <Loading />
      ) : !risk.data ? (
        <ErrorState onRetry={() => void risk.refetch()} />
      ) : (
        <>
          <Card style={styles.summary}>
            <AppText variant="small" color={colors.textMuted} align="center">
              {t("risk.label")}
            </AppText>
            <View style={styles.badge}>
              <StatusBadge status={riskStatus(risk.data.category)} size="lg" />
            </View>
            <AppText variant="bodyStrong" align="center">
              {t("risk.disclaimer")}
            </AppText>
            {risk.data.createdAt ? (
              <AppText variant="caption" color={colors.textSubtle} align="center">
                {t("risk.updated", { when: formatAgo(risk.data.createdAt, new Date()) })}
              </AppText>
            ) : null}
          </Card>

          {risk.data.category === "LOW" ? <Notice tone="ok">{t("risk.lowNote")}</Notice> : null}

          <AppText variant="heading">{t("risk.factorsTitle")}</AppText>
          {risk.data.factors.length === 0 ? (
            <Card>
              <AppText color={colors.textMuted}>{t("risk.noFactors")}</AppText>
            </Card>
          ) : (
            <>
              <FactorGroup title={t("risk.factorsHigh")} factors={risk.data.factors.filter((f) => f.weight === "HIGH")} strong />
              <FactorGroup title={t("risk.factorsModerate")} factors={risk.data.factors.filter((f) => f.weight === "MODERATE")} />
            </>
          )}

          <Card tint={colors.accentSoft}>
            <AppText variant="bodyStrong" color={colors.accent}>
              {t("risk.howTitle")}
            </AppText>
            <AppText>{t("risk.howBody")}</AppText>
          </Card>
        </>
      )}
    </Screen>
  );
}

function FactorGroup({ title, factors, strong }: { readonly title: string; readonly factors: readonly RiskDto["factors"][number][]; readonly strong?: boolean }) {
  if (factors.length === 0) return null;
  const color = strong ? colors.high : colors.watch;
  return (
    <Card>
      <AppText variant="caption" color={colors.textMuted}>
        {title}
      </AppText>
      {factors.map((f) => (
        <View key={f.code} style={styles.factor}>
          <Ionicons name={strong ? "alert-circle" : "ellipse"} size={strong ? 20 : 10} color={color} style={styles.factorIcon} />
          <AppText style={styles.flex}>{f.label}</AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
  badge: { alignItems: "center" },
  factor: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  factorIcon: { width: 20, textAlign: "center" },
  flex: { flex: 1 },
});
