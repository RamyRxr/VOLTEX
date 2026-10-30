import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, space, tones, type IconName, type ToneName } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  readonly tone?: ToneName;
  readonly icon?: IconName;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

/** Inline message box: info, warning or danger. */
export function Notice({ tone = "accent", icon, children, action }: Props) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]} accessibilityRole="text">
      <View style={styles.row}>
        <Ionicons name={icon ?? t.icon} size={20} color={t.fg} style={styles.icon} />
        <AppText variant="small" color={t.fg} style={styles.text}>
          {children}
        </AppText>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, padding: space.md, gap: space.md },
  row: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  icon: { marginTop: 1 },
  text: { flex: 1, fontWeight: "500" },
});
