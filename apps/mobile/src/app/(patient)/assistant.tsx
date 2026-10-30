import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { AppText, Button, Card, Notice, Screen, ScreenHeader } from "@/components/ui";
import { t } from "@/i18n";
import { callEmergency } from "@/lib/emergency";
import { colors, space } from "@/theme";

/**
 * Info assistant (spec §9.3): POST /api/patient/assistant arrives with step F.
 * Until then, a placeholder that still points to the questionnaire and the emergency number.
 */
export default function Assistant() {
  const router = useRouter();
  return (
    <Screen header={<ScreenHeader title={t("assistant.title")} />}>
      <Card style={styles.card}>
        <Ionicons name="construct" size={40} color={colors.accent} />
        <AppText variant="heading" align="center">
          {t("assistant.soonTitle")}
        </AppText>
        <AppText align="center" color={colors.textMuted}>
          {t("assistant.soonBody")}
        </AppText>
      </Card>
      <Notice tone="danger" icon="call" action={<Button variant="danger" icon="call" label={t("common.call14")} onPress={callEmergency} />}>
        {t("assistant.soonEmergency")}
      </Notice>
      <Button variant="secondary" icon="list" label={t("assistant.openQuestionnaire")} onPress={() => router.push("/questionnaire")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
});
