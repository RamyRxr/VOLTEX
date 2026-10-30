import type { Api } from "./contract";
import { ApiError, type DateRange } from "./types";
import { ENV } from "@/config/env";
import { getAccessToken } from "@/auth/tokenStore";

const TIMEOUT_MS = 15_000;

function query(range?: DateRange): string {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = getAccessToken();
  try {
    const res = await fetch(`${ENV.apiUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status} on ${path}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, "network");
  } finally {
    clearTimeout(timer);
  }
}

const notWired = (what: string) => () => Promise.reject(new ApiError(501, `${what} is not wired to Supabase yet`));

/**
 * Next.js API client (spec §8). Auth and chat go through Supabase in production;
 * those parts are wired when the Supabase project exists (see README "Next steps").
 */
export const httpApi: Api = {
  auth: {
    signIn: notWired("auth.signIn"),
    signUp: notWired("auth.signUp"),
    signOut: () => Promise.resolve(),
  },

  getMe: () => request("GET", "/api/me"),
  saveProfile: (input) => request("POST", "/api/patient/profile", input),
  getRisk: () => request("GET", "/api/patient/risk"),

  submitLinkCode: (code) => request("POST", "/api/patient/link", { code }),
  getLink: () => request("GET", "/api/patient/link"),

  addSession: (input) => request("POST", "/api/patient/sessions", input),
  addQuestionnaire: (answers) => request("POST", "/api/patient/questionnaires", { answers }),
  listSessions: (range) => request("GET", `/api/patient/sessions${query(range)}`),
  listQuestionnaires: (range) => request("GET", `/api/patient/questionnaires${query(range)}`),

  askAssistant: (question) => request("POST", "/api/patient/assistant", { question }),

  listDoctorAlerts: (status) => request("GET", `/api/doctor/alerts?status=${status}`),
  updateDoctorAlert: (id, action) => request("PATCH", `/api/doctor/alerts/${encodeURIComponent(id)}`, { action }),
  registerPushToken: (token) => request("POST", "/api/doctor/push-token", { token }),

  chat: {
    list: notWired("chat.list"),
    send: notWired("chat.send"),
    subscribe: () => () => undefined,
  },
};
