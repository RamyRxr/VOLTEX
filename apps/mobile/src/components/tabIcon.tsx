import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";
import type { IconName } from "@/theme";

/** Tab bar icon renderer for an Ionicons glyph. */
export function tabIcon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={typeof color === "string" ? color : undefined} size={size} />;
  }
  return TabIcon;
}
