import {
  alertsListSchema,
  inviteSchema,
  invitesSchema,
  linkOutputSchema,
  linkRequestsSchema,
  linkStateSchema,
  meSchema,
  patientFileSchema,
  profileOutputSchema,
  questionnaireOutputSchema,
  questionnaireSchema,
  riskSchema,
  sessionOutputSchema,
  sessionSchema,
  triageSchema,
  type AlertAction,
  type Answers,
  type LinkDecision,
  type ProfileInput,
  type RangeQuery,
  type SessionInput,
} from "shared";
import { z } from "zod";
import { accessToken } from "@/auth/supabase";
import { ENV } from "@/config/env";
import { t } from "@/i18n";
import { ApiError, errorFromResponse, networkError } from "./errors";

const TIMEOUT_MS = 15_000;

function query(range?: RangeQuery): string {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** One API call with the Supabase token; the answer is checked against its shared Zod schema. */
async function request<S extends z.ZodType>(schema: S, method: string, path: string, body?: unknown): Promise<z.output<S>> {
  const token = await accessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let data: unknown;
  try {
    res = await fetch(`${ENV.apiUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await errorFromResponse(res);
    data = await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw networkError();
  } finally {
    clearTimeout(timer);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(res.status, "BAD_RESPONSE", t("common.error"));
  return parsed.data;
}

const id = (value: string) => encodeURIComponent(value);
const ignored = z.unknown();

/** Next.js API routes (spec §8). Chat is not here: it goes straight to Supabase (`features/chat`). */
export const api = {
  getMe: () => request(meSchema, "GET", "/api/me"),
  saveProfile: (input: ProfileInput) => request(profileOutputSchema, "POST", "/api/patient/profile", input),
  getRisk: () => request(riskSchema, "GET", "/api/patient/risk"),

  submitLinkCode: (code: string) => request(linkOutputSchema, "POST", "/api/patient/link", { code }),
  getLink: () => request(linkStateSchema, "GET", "/api/patient/link"),

  addSession: (input: SessionInput) => request(sessionOutputSchema, "POST", "/api/patient/sessions", input),
  addQuestionnaire: (answers: Answers) =>
    request(questionnaireOutputSchema, "POST", "/api/patient/questionnaires", { answers }),
  listSessions: (range?: RangeQuery) => request(z.array(sessionSchema), "GET", `/api/patient/sessions${query(range)}`),
  listQuestionnaires: (range?: RangeQuery) =>
    request(z.array(questionnaireSchema), "GET", `/api/patient/questionnaires${query(range)}`),

  doctor: {
    listPatients: () => request(triageSchema, "GET", "/api/doctor/patients"),
    getPatient: (patientId: string) => request(patientFileSchema, "GET", `/api/doctor/patients/${id(patientId)}`),
    listAlerts: (status: "OPEN" | "ACKNOWLEDGED") => request(alertsListSchema, "GET", `/api/doctor/alerts?status=${status}`),
    updateAlert: (alertId: string, action: AlertAction["action"]) =>
      request(ignored, "PATCH", `/api/doctor/alerts/${id(alertId)}`, { action }),
    createInvite: () => request(inviteSchema, "POST", "/api/doctor/invites"),
    listInvites: () => request(invitesSchema, "GET", "/api/doctor/invites"),
    listLinkRequests: () => request(linkRequestsSchema, "GET", "/api/doctor/link-requests"),
    decideLinkRequest: (requestId: string, action: LinkDecision["action"]) =>
      request(ignored, "PATCH", `/api/doctor/link-requests/${id(requestId)}`, { action }),
  },
};
