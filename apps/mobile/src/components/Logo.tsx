import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme";

/** A heart with a calm pulse line. */
export function Logo({ size = 88 }: { readonly size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="SafeMaman">
      <Circle cx={48} cy={48} r={48} fill={colors.accentSoft} />
      <Path
        d="M48 72 C30 60 22 50 22 40 C22 31 29 25 37 25 C42 25 46 28 48 32 C50 28 54 25 59 25 C67 25 74 31 74 40 C74 50 66 60 48 72 Z"
        fill={colors.accent}
      />
      <Path
        d="M27 46 H39 L43 38 L49 54 L53 44 H69"
        stroke={colors.onAccent}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
