import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { colors, radius, space } from "@/theme";

interface Props {
  readonly body: string;
  readonly mine: boolean;
  readonly meta?: string;
}

export function Bubble({ body, mine, meta }: Props) {
  return (
    <View style={[styles.wrap, mine ? styles.mineWrap : styles.theirsWrap]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <AppText color={mine ? colors.onAccent : colors.text}>{body}</AppText>
      </View>
      {meta ? (
        <AppText variant="caption" color={colors.textSubtle} style={mine ? styles.metaMine : undefined}>
          {meta}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: "85%", gap: 2, marginVertical: space.xs },
  mineWrap: { alignSelf: "flex-end" },
  theirsWrap: { alignSelf: "flex-start" },
  bubble: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  metaMine: { textAlign: "right" },
});
