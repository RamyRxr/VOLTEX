import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/auth/SessionProvider";

/** Refetch when the app comes back to the foreground (React Native has no window focus). */
function useAppFocus() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => sub.remove();
  }, []);
}

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  useAppFocus();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
