import { Text, type TextProps } from "react-native";
import { colors, type as typeScale } from "@/theme";

type Variant = keyof typeof typeScale;

interface Props extends TextProps {
  readonly variant?: Variant;
  readonly color?: string;
  readonly align?: "left" | "center" | "right";
}

export function AppText({ variant = "body", color = colors.text, align, style, ...rest }: Props) {
  return <Text style={[typeScale[variant], { color, textAlign: align }, style]} maxFontSizeMultiplier={1.6} {...rest} />;
}
