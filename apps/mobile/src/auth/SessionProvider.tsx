import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, type AuthSession, type Me } from "@/api";
import type { SignUpInput } from "@/api/contract";
import { clearLastResult } from "@/features/result/lastResult";
import { loadSession, saveSession } from "./tokenStore";

interface SessionValue {
  /** "loading" until the stored session and the profile are known. */
  readonly status: "loading" | "signedOut" | "signedIn" | "error";
  readonly session: AuthSession | null;
  readonly me: Me | null;
  readonly signIn: (email: string, password: string) => Promise<Me>;
  readonly signUp: (input: SignUpInput) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly retry: () => void;
  /** Set after the first profile save so the patient lands on her initial risk screen. */
  readonly welcomePending: boolean;
  readonly setWelcomePending: (value: boolean) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export const ME_KEY = ["me"] as const;

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [booted, setBooted] = useState(false);
  const [welcomePending, setWelcomePending] = useState(false);

  useEffect(() => {
    loadSession()
      .then(setSession)
      .finally(() => setBooted(true));
  }, []);

  const meQuery = useQuery({
    queryKey: [...ME_KEY, session?.userId],
    queryFn: () => api.getMe(),
    enabled: session !== null,
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  const signOut = useCallback(async () => {
    await api.auth.signOut().catch(() => undefined);
    await saveSession(null);
    await clearLastResult();
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  // An expired or revoked token sends the user back to the welcome screen.
  const unauthorized = meQuery.error instanceof ApiError && meQuery.error.status === 401;
  useEffect(() => {
    if (unauthorized) void saveSession(null);
  }, [unauthorized]);

  const start = useCallback(
    async (next: AuthSession) => {
      await saveSession(next);
      const me = await queryClient.fetchQuery({ queryKey: [...ME_KEY, next.userId], queryFn: () => api.getMe() });
      setSession(next);
      return me;
    },
    [queryClient],
  );

  const value = useMemo<SessionValue>(() => {
    const me = meQuery.data ?? null;
    const status: SessionValue["status"] = !booted
      ? "loading"
      : session === null || unauthorized
        ? "signedOut"
        : me
          ? "signedIn"
          : meQuery.isError
            ? "error"
            : "loading";
    return {
      status,
      session,
      me,
      signIn: async (email, password) => start(await api.auth.signIn(email, password)),
      signUp: async (input) => {
        await start(await api.auth.signUp(input));
      },
      signOut,
      retry: () => void meQuery.refetch(),
      welcomePending,
      setWelcomePending,
    };
  }, [booted, session, unauthorized, meQuery, start, signOut, welcomePending]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** The signed-in user; only call below the signed-in guards. */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("useMe called while signed out");
  return me;
}
