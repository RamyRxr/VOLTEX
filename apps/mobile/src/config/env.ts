/** Runtime settings read from EXPO_PUBLIC_* variables (see .env.example). */
const withoutTrailingSlash = (url: string | undefined) => (url ?? "").replace(/\/+$/, "");

export const ENV = {
  /** The Next.js API on the developer's machine or Vercel (spec §8). */
  apiUrl: withoutTrailingSlash(process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: withoutTrailingSlash(process.env.EXPO_PUBLIC_SUPABASE_URL),
  /** Public anon key only: the service-role key never reaches the phone (spec §5). */
  supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ?? "",
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === "true",
} as const;
