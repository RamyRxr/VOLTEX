import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me } from "shared";
import { api, ApiError, isApiError } from "@/api";
import { clearLastResult } from "@/features/result/lastResult";
import * as auth from "./authApi";
import { supabase } from "./supabase";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  /** Name typed at sign-up, until the profile is saved. */
  readonly signUpName: string;
}

interface SessionValue {
  /**
   * "loading" until the Supabase session and GET /api/me are known.
   * "needsProfile": signed in, but the patient has not filled her profile yet (404 NO_PROFILE).
   */
  readonly status: "loading" | "signedOut" | "needsProfile" | "signedIn" | "error";
  readonly user: SessionUser | null;
  readonly me: Me | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  /** Resolves with `confirmEmail: true` when Supabase waits for the e-mail link before opening a session. */
  readonly signUp: (input: auth.SignUpInput) => Promise<{ confirmEmail: boolean }>;
  readonly signOut: () => Promise<void>;
  readonly retry: () => void;
  /** Set after the first profile save so the patient lands on her initial risk screen. */
  readonly welcomePending: boolean;
  readonly setWelcomePending: (value: boolean) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export const ME_KEY = ["me"] as const;

const toSessionUser = (user: User | null): SessionUser | null =>
  user ? { id: user.id, email: user.email ?? "", signUpName: auth.signUpName(user) } : null;

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booted, setBooted] = useState(false);
  const [welcomePending, setWelcomePending] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setUser(toSessionUser(data.session?.user ?? null)))
      .catch(() => setUser(null))
      .finally(() => setBooted(true));
    // Token refreshes keep the same user; only a sign-out or a new account changes it.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = toSessionUser(session?.user ?? null);
      setUser((prev) => (prev?.id === next?.id ? prev : next));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const meQuery = useQuery({
    queryKey: [...ME_KEY, user?.id],
    queryFn: async () => {
      try {
        return await api.getMe();
      } catch (err) {
        // An expired or revoked session: drop it, and onAuthStateChange sends the user back to the welcome screen.
        if (isApiError(err, "UNAUTHORIZED")) await auth.signOut();
        throw err;
      }
    },
    enabled: user !== null,
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
  });

  const signOut = useCallback(async () => {
    await auth.signOut();
    await clearLastResult();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const unauthorized = isApiError(meQuery.error, "UNAUTHORIZED");

  const value = useMemo<SessionValue>(() => {
    const me = meQuery.data ?? null;
    const noProfile = isApiError(meQuery.error, "NO_PROFILE") || (me?.role === "PATIENT" && !me.patient?.hasProfile);
    const status: SessionValue["status"] = !booted
      ? "loading"
      : user === null || unauthorized
        ? "signedOut"
        : noProfile
          ? "needsProfile"
          : me
            ? "signedIn"
            : meQuery.isError
              ? "error"
              : "loading";
    return {
      status,
      user,
      me,
      signIn: async (email, password) => {
        setUser(toSessionUser(await auth.signIn(email, password)));
      },
      signUp: async (input) => {
        const { user: created } = await auth.signUp(input);
        if (created) setUser(toSessionUser(created));
        return { confirmEmail: created === null };
      },
      signOut,
      retry: () => void meQuery.refetch(),
      welcomePending,
      setWelcomePending,
    };
  }, [booted, user, unauthorized, meQuery, signOut, welcomePending]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** The signed-in user's profile; only call below the signed-in guards. */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("useMe called while signed out");
  return me;
}

/** The Supabase user; only call below the signed-in guards. */
export function useSessionUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error("useSessionUser called while signed out");
  return user;
}
