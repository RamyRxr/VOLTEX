import { Stack } from "expo-router";
import { colors } from "@/theme";

export const unstable_settings = { anchor: "(tabs)" };

export default function PatientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      {/* Serious results cannot be swiped away by accident. */}
      <Stack.Screen name="result" options={{ gestureEnabled: false, animation: "fade" }} />
    </Stack>
  );
}
