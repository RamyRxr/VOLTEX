import type {
  Answers,
  AuthSession,
  BpSession,
  ChatMessage,
  DateRange,
  DoctorAlert,
  Evaluation,
  LinkInfo,
  Me,
  PatientProfileInput,
  Questionnaire,
  Risk,
  SessionInput,
} from "./types";

export interface SignUpInput {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
}

/**
 * Everything the screens can ask of the backend. Two implementations:
 * `http.ts` (Next.js API, CLAUDE.md §8) and `mock/` (built-in demo data, no server).
 */
export interface Api {
  readonly auth: {
    signIn(email: string, password: string): Promise<AuthSession>;
    signUp(input: SignUpInput): Promise<AuthSession>;
    signOut(): Promise<void>;
  };

  getMe(): Promise<Me>;
  saveProfile(input: PatientProfileInput): Promise<{ risk: Risk }>;
  getRisk(): Promise<Risk | null>;

  submitLinkCode(code: string): Promise<{ status: "PENDING" }>;
  getLink(): Promise<LinkInfo>;

  addSession(input: SessionInput): Promise<{ session: BpSession; evaluation: Evaluation; risk: Risk }>;
  addQuestionnaire(answers: Answers): Promise<{ evaluation: Evaluation; risk: Risk }>;
  listSessions(range?: DateRange): Promise<BpSession[]>;
  listQuestionnaires(range?: DateRange): Promise<Questionnaire[]>;

  askAssistant(question: string): Promise<{ answer: string }>;

  listDoctorAlerts(status: "OPEN" | "ACKNOWLEDGED"): Promise<DoctorAlert[]>;
  updateDoctorAlert(id: string, action: "ACK" | "CLOSE"): Promise<void>;
  /** Proposed route (not in CLAUDE.md §8 yet): POST /api/doctor/push-token { token }. */
  registerPushToken(token: string): Promise<void>;

  /** Chat goes straight to Supabase Realtime in production (CLAUDE.md §8), not the REST API. */
  readonly chat: {
    list(linkId: string): Promise<ChatMessage[]>;
    send(linkId: string, body: string): Promise<ChatMessage>;
    subscribe(linkId: string, onMessage: (message: ChatMessage) => void): () => void;
  };

  /** Demo-only helpers; undefined on the real API. */
  readonly demo?: {
    reset(): Promise<void>;
    simulateAlert(): Promise<void>;
  };
}
