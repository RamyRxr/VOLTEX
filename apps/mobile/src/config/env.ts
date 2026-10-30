/** Runtime switches read from EXPO_PUBLIC_* variables (see .env.example). */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const ENV = {
  apiUrl,
  /** Built-in demo backend: on when asked, or when no API URL is configured yet. */
  useMock: process.env.EXPO_PUBLIC_USE_MOCK === "true" || apiUrl === "",
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === "true",
  pushEnabled: process.env.EXPO_PUBLIC_PUSH_ENABLED === "true",
} as const;
