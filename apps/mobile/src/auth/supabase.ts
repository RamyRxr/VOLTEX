import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { ENV } from "@/config/env";

/** Supabase: login on the phone, and the chat (spec §5). The session is kept on the device. */
export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh the token only while the app is in the foreground (Expo + Supabase guide).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

/** Access token of the current session, refreshed by Supabase when it has expired. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
