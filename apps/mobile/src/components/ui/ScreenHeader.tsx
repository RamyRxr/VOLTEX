import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { t } from "@/i18n";
import { colors, space, TOUCH } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  readonly title?: string;
  readonly back?: boolean;
  readonly onBack?: () => void;
  readonly right?: ReactNode;
}

export function ScreenHeader({ title, back = true, onBack, right }: Props) {
  const router = useRouter();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")));
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={goBack}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <AppText variant="heading" align="center" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title ?? ""}
      </AppText>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, minHeight: 56 },
  side: { minWidth: TOUCH, flexDirection: "row" },
  right: { justifyContent: "flex-end" },
  title: { flex: 1 },
  back: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center", borderRadius: TOUCH / 2 },
  pressed: { backgroundColor: colors.surfaceMuted },
});
