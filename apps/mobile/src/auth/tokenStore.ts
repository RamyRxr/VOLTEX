import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "@/api/types";

/**
 * The signed-in session, kept in memory for the API client and persisted so the app
 * reopens signed in. With Supabase this becomes the Supabase session.
 */
const KEY = "tensiocare.session.v1";
let current: AuthSession | null = null;

export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

export function getCurrentSession(): AuthSession | null {
  return current;
}

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    current = null;
  }
  return current;
}

export async function saveSession(session: AuthSession | null): Promise<void> {
  current = session;
  if (session) await AsyncStorage.setItem(KEY, JSON.stringify(session));
  else await AsyncStorage.removeItem(KEY);
}
