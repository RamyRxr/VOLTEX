/**
 * Built-in demo backend: same contract as the Next.js API, data kept on the phone.
 * Lets the whole app be used before the database exists. Never used when EXPO_PUBLIC_API_URL is set.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Api } from "../contract";
import { ApiError, type BpSession, type ChatMessage, type DoctorAlert, type Evaluation, type Me, type Risk } from "../types";
import { ENV } from "@/config/env";
import { getCurrentSession } from "@/auth/tokenStore";
import { isCompleteInviteCode, normalizeInviteCode } from "@/lib/inviteCode";
import { pregnancyWeek } from "@/lib/pregnancy";
import { cannedAnswer } from "./assistant";
import { estimateRisk, evaluateQuestionnaire, evaluateSession } from "./engine";
import { buildSeed, DEMO_DOCTOR_ID, DEMO_INVITE_CODE, type MockDb, type MockUser } from "./seed";

const KEY = "tensiocare.mockdb.v1";
const AUTO_ACCEPT_MS = 8_000;
const LINK_ATTEMPTS = { max: 5, windowMs: 10 * 60_000 };

let db: MockDb | null = null;
const chatListeners = new Map<string, Set<(m: ChatMessage) => void>>();

const wait = (ms = 250 + Math.random() * 250) => new Promise((resolve) => setTimeout(resolve, ms));
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function load(): Promise<MockDb> {
  if (db) return db;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    db = raw ? (JSON.parse(raw) as MockDb) : buildSeed(new Date());
  } catch {
    db = buildSeed(new Date());
  }
  return db;
}

async function commit(next: MockDb): Promise<void> {
  db = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

async function me(): Promise<{ data: MockDb; user: MockUser }> {
  const data = await load();
  const session = getCurrentSession();
  const user = data.users.find((u) => u.id === session?.userId);
  if (!user) throw new ApiError(401, "unauthorized");
  return { data, user };
}

function sessionFor(user: MockUser) {
  return { accessToken: `mock-${user.id}`, userId: user.id, role: user.role };
}

/** Opens or refreshes one alert per patient + level + evidence (CLAUDE.md §6.4 de-duplication). */
function withAlert(data: MockDb, user: MockUser, evaluation: Evaluation, evidence: string, reason: string, now: Date): DoctorAlert[] {
  const link = data.links[user.id];
  if (evaluation.level === "OK" || link?.status !== "ACCEPTED") return data.alerts;
  const patient = data.patients[user.id];
  const week = patient ? pregnancyWeek(patient, now) : null;
  const level = evaluation.level;
  const existing = data.alerts.find(
    (a) => a.patientId === user.id && a.level === level && a.evidence === evidence && a.status === "OPEN",
  );
  const alert: DoctorAlert = {
    id: existing?.id ?? uid("alert"),
    patientId: user.id,
    patientName: shortName(user.fullName),
    pregnancyWeek: week,
    level,
    evidence,
    reason,
    status: "OPEN",
    createdAt: now.toISOString(),
    ackAt: null,
  };
  return [alert, ...data.alerts.filter((a) => a.id !== alert.id)];
}

function shortName(fullName: string): string {
  const [first, last] = fullName.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : (first ?? fullName);
}

function latestRisk(data: MockDb, userId: string): Risk | null {
  const list = data.risks[userId] ?? [];
  return list[list.length - 1] ?? null;
}

export const mockApi: Api = {
  auth: {
    async signIn(email, password) {
      await wait();
      const data = await load();
      const user = data.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || user.password !== password) throw new ApiError(401, "invalid credentials");
      return sessionFor(user);
    },
    async signUp({ fullName, email, password }) {
      await wait();
      const data = await load();
      if (data.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) throw new ApiError(409, "exists");
      const user: MockUser = { id: uid("user"), email: email.trim(), password, role: "PATIENT", fullName: fullName.trim(), phone: null };
      await commit({ ...data, users: [...data.users, user] });
      return sessionFor(user);
    },
    async signOut() {
      await wait(100);
    },
  },

  async getMe() {
    await wait(150);
    const { data, user } = await me();
    const patient = data.patients[user.id] ?? null;
    const result: Me = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: patient?.phone ?? user.phone,
      patient,
      doctor: user.role === "DOCTOR" ? { id: user.id } : null,
    };
    return result;
  },

  async saveProfile(input) {
    await wait();
    const { data, user } = await me();
    const now = new Date();
    const previous = data.patients[user.id];
    const profile = { ...input, id: previous?.id ?? uid("patient"), expectedSessionsPerDay: previous?.expectedSessionsPerDay ?? 2 };
    const risk = estimateRisk(profile, data.sessions[user.id] ?? [], data.questionnaires[user.id] ?? [], "PROFILE", now);
    await commit({
      ...data,
      patients: { ...data.patients, [user.id]: profile },
      risks: { ...data.risks, [user.id]: [...(data.risks[user.id] ?? []), risk] },
    });
    return { risk };
  },

  async getRisk() {
    await wait(150);
    const { data, user } = await me();
    return latestRisk(data, user.id);
  },

  async submitLinkCode(raw) {
    await wait();
    const { data, user } = await me();
    const now = Date.now();
    const attempts = (data.linkAttempts[user.id] ?? []).filter((t) => now - new Date(t).getTime() < LINK_ATTEMPTS.windowMs);
    if (attempts.length >= LINK_ATTEMPTS.max) throw new ApiError(429, "too many attempts");
    const code = normalizeInviteCode(raw);
    const nextAttempts = { ...data.linkAttempts, [user.id]: [...attempts, new Date(now).toISOString()] };
    if (!isCompleteInviteCode(code) || code !== DEMO_INVITE_CODE) {
      await commit({ ...data, linkAttempts: nextAttempts });
      throw new ApiError(400, "invalid code");
    }
    await commit({
      ...data,
      linkAttempts: nextAttempts,
      links: {
        ...data.links,
        [user.id]: { id: uid("link"), status: "PENDING", doctorUserId: DEMO_DOCTOR_ID, createdAt: new Date(now).toISOString() },
      },
    });
    return { status: "PENDING" as const };
  },

  async getLink() {
    await wait(150);
    const { data, user } = await me();
    let link = data.links[user.id];
    if (!link) return { status: "NONE", linkId: null, doctorName: null };
    // Demo: the doctor "accepts" from the dashboard a few seconds after the request.
    if (link.status === "PENDING" && Date.now() - new Date(link.createdAt).getTime() > AUTO_ACCEPT_MS) {
      link = { ...link, status: "ACCEPTED" };
      await commit({ ...data, links: { ...data.links, [user.id]: link } });
    }
    const doctor = data.users.find((u) => u.id === link.doctorUserId);
    return { status: link.status, linkId: link.id, doctorName: doctor?.fullName ?? null };
  },

  async addSession(input) {
    await wait();
    const { data, user } = await me();
    const now = input.takenAt ? new Date(input.takenAt) : new Date();
    const previous = data.sessions[user.id] ?? [];
    const questionnaires = data.questionnaires[user.id] ?? [];
    const outcome = evaluateSession(previous, questionnaires, input, now, ENV.demoMode);
    const session: BpSession = {
      id: uid("session"),
      sys: input.sys,
      dia: input.dia,
      pulse: input.pulse ?? null,
      takenAt: now.toISOString(),
      source: input.source ?? "MANUAL",
      status: outcome.status,
    };
    const resolved = outcome.resolved;
    const sessions = [
      ...previous.map((s) => (resolved && s.id === resolved.id ? { ...s, status: resolved.status } : s)),
      session,
    ];
    const profile = data.patients[user.id];
    const risk = profile ? estimateRisk(profile, sessions, questionnaires, "SESSION", now) : latestRisk(data, user.id);
    if (!risk) throw new ApiError(409, "profile missing");

    const bp = `${input.sys}/${input.dia}`;
    const alertInput: [Evaluation, string, string] =
      outcome.status === "SEVERE_PENDING"
        ? [{ ...outcome.evaluation, level: "SEVERE" }, "UNCONFIRMED_SEVERE", `Mesure sévère non confirmée : ${bp}`]
        : outcome.evaluation.level === "SEVERE"
          ? [outcome.evaluation, "CONFIRMED_SEVERE", `Mesure sévère confirmée : ${bp}`]
          : outcome.evaluation.level === "HIGH"
            ? [outcome.evaluation, "TWO_OF_THREE", `2 des 3 dernières mesures ≥ 140/90 (dernière ${bp})`]
            : [outcome.evaluation, "TREND", "Tension à surveiller"];

    // A resolved severe reading is no longer "non confirmée" for the doctor.
    const alerts = withAlert(data, user, ...alertInput, now).map((a): DoctorAlert =>
      resolved && a.patientId === user.id && a.evidence === "UNCONFIRMED_SEVERE" && a.status === "OPEN"
        ? { ...a, status: "CLOSED" }
        : a,
    );
    await commit({
      ...data,
      sessions: { ...data.sessions, [user.id]: sessions },
      risks: { ...data.risks, [user.id]: [...(data.risks[user.id] ?? []), risk] },
      alerts,
    });
    return { session, evaluation: outcome.evaluation, risk };
  },

  async addQuestionnaire(answers) {
    await wait();
    const { data, user } = await me();
    const now = new Date();
    const sessions = data.sessions[user.id] ?? [];
    const previous = data.questionnaires[user.id] ?? [];
    const evaluation = evaluateQuestionnaire(sessions, previous, answers, now);
    const questionnaires = [...previous, { id: uid("q"), answers, answeredAt: now.toISOString() }];
    const profile = data.patients[user.id];
    const risk = profile ? estimateRisk(profile, sessions, questionnaires, "QUESTIONNAIRE", now) : latestRisk(data, user.id);
    if (!risk) throw new ApiError(409, "profile missing");
    const reason = evaluation.level === "EMERGENCY" ? "Symptôme de danger signalé dans le questionnaire" : "Symptômes à surveiller signalés";
    await commit({
      ...data,
      questionnaires: { ...data.questionnaires, [user.id]: questionnaires },
      risks: { ...data.risks, [user.id]: [...(data.risks[user.id] ?? []), risk] },
      alerts: withAlert(data, user, evaluation, evaluation.level === "EMERGENCY" ? "DANGER_ITEM" : "WATCH_ITEM", reason, now),
    });
    return { evaluation, risk };
  },

  async listSessions(range) {
    await wait(150);
    const { data, user } = await me();
    const from = range?.from ? new Date(range.from).getTime() : -Infinity;
    return (data.sessions[user.id] ?? []).filter((s) => new Date(s.takenAt).getTime() >= from);
  },

  async listQuestionnaires(range) {
    await wait(150);
    const { data, user } = await me();
    const from = range?.from ? new Date(range.from).getTime() : -Infinity;
    return (data.questionnaires[user.id] ?? []).filter((q) => new Date(q.answeredAt).getTime() >= from);
  },

  async askAssistant(question) {
    await wait(700);
    return { answer: cannedAnswer(question) };
  },

  async listDoctorAlerts(status) {
    await wait(150);
    const { data, user } = await me();
    if (user.role !== "DOCTOR") throw new ApiError(403, "forbidden");
    return data.alerts.filter((a) => a.status === status);
  },

  async updateDoctorAlert(id, action) {
    await wait();
    const { data } = await me();
    const now = new Date().toISOString();
    const alerts = data.alerts.map((a): DoctorAlert =>
      a.id === id ? { ...a, status: action === "ACK" ? "ACKNOWLEDGED" : "CLOSED", ackAt: a.ackAt ?? now } : a,
    );
    await commit({ ...data, alerts });
  },

  async registerPushToken() {
    await wait(100);
  },

  chat: {
    async list(linkId) {
      await wait(150);
      const data = await load();
      return data.messages[linkId] ?? [];
    },
    async send(linkId, body) {
      await wait(200);
      const { data, user } = await me();
      const message: ChatMessage = { id: uid("msg"), linkId, senderId: user.id, body: body.trim(), createdAt: new Date().toISOString() };
      await commit({ ...data, messages: { ...data.messages, [linkId]: [...(data.messages[linkId] ?? []), message] } });
      chatListeners.get(linkId)?.forEach((listener) => listener(message));
      return message;
    },
    subscribe(linkId, onMessage) {
      const set = chatListeners.get(linkId) ?? new Set();
      set.add(onMessage);
      chatListeners.set(linkId, set);
      return () => set.delete(onMessage);
    },
  },

  demo: {
    async reset() {
      await commit(buildSeed(new Date()));
    },
    async simulateAlert() {
      const data = await load();
      const alert: DoctorAlert = {
        id: uid("alert"),
        patientId: "patient-demo-sim",
        patientName: "Amina B.",
        pregnancyWeek: 31,
        level: "EMERGENCY",
        evidence: "DANGER_ITEM",
        reason: "Symptôme de danger signalé : troubles de la vue",
        status: "OPEN",
        createdAt: new Date().toISOString(),
        ackAt: null,
      };
      await commit({ ...data, alerts: [alert, ...data.alerts] });
    },
  },
};
