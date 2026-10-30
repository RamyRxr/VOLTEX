import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useSession } from "@/auth/SessionProvider";
import { AppProviders } from "@/components/AppProviders";
import { hydrateLastResult } from "@/features/result/lastResult";
import { hydrateDoctorPrefs } from "@/notifications/doctorAlerts";
import { configureNotifications } from "@/notifications/setup";
import { useNotificationRouting } from "@/notifications/useNotificationRouting";
import { colors } from "@/theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = { anchor: "index" };

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();
void hydrateLastResult();
void hydrateDoctorPrefs();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, primary: colors.accent, text: colors.text },
};

/** Each space is reachable only by the right user (Stack.Protected, SDK 58). */
function RootNavigator() {
  const { status, me } = useSession();
  const needsProfile = status === "needsProfile";
  const hasProfile = status === "signedIn" && me?.role === "PATIENT";
  const isDoctor = status === "signedIn" && me?.role === "DOCTOR";

  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  useNotificationRouting(status === "signedIn");

  // Keep the splash until the session is known, so guards never redirect a deep link too early.
  if (status === "loading") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile}>
        <Stack.Screen name="(patient)" />
      </Stack.Protected>
      <Stack.Protected guard={isDoctor}>
        <Stack.Screen name="(doctor)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <RootNavigator />
      </ThemeProvider>
    </AppProviders>
  );
}
