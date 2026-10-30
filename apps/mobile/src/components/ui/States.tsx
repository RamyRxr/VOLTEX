import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { t } from "@/i18n";
import { colors, space, type IconName } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

export function Loading() {
  return (
    <View style={styles.center} accessibilityLabel={t("common.loading")}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function ErrorState({ onRetry, message }: { readonly onRetry?: () => void; readonly message?: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline" size={36} color={colors.textMuted} />
      <AppText align="center" color={colors.textMuted}>
        {message ?? t("common.error")}
      </AppText>
      {onRetry ? <Button variant="secondary" label={t("common.retry")} icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ icon, message }: { readonly icon: IconName; readonly message: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={36} color={colors.textSubtle} />
      <AppText align="center" color={colors.textMuted}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
});
