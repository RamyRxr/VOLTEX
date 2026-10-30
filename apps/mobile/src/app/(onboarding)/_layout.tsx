import { Stack } from "expo-router";
import { colors } from "@/theme";

export const unstable_settings = { anchor: "consent" };

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
