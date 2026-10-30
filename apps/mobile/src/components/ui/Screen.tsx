import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { ENV } from "@/config/env";
import { t } from "@/i18n";
import { colors, space } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  readonly children: ReactNode;
  readonly header?: ReactNode;
  /** Sticky bottom area, for the main action of the screen. */
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
  /** Screens inside a tab bar don't need the bottom inset. */
  readonly inTabs?: boolean;
  readonly background?: string;
}

export function Screen({ children, header, footer, scroll = true, inTabs = false, background = colors.bg }: Props) {
  const edges: Edge[] = inTabs ? ["top", "left", "right"] : ["top", "left", "right", "bottom"];
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      {ENV.demoMode ? <DemoBanner /> : null}
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.static]}>{children}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { backgroundColor: background }, background !== colors.bg && styles.footerPlain]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DemoBanner() {
  return (
    <View style={styles.demo} accessibilityRole="text">
      <AppText variant="caption" color={colors.watch} align="center">
        {t("demo.banner")}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  static: { padding: space.lg, gap: space.lg },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerPlain: { borderTopWidth: 0 },
  demo: { backgroundColor: colors.watchSoft, paddingVertical: 3 },
});
