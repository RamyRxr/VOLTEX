import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { complete, LLM_TIMEOUT_MS } from "../client";
import type { PatientFacts } from "../facts";
import { ASSISTANT_FALLBACK, factsToText, fallbackDraft, fallbackSummary, mentionsSymptom, SAFETY_SENTENCE, safeAnswer, safeDraft } from "../texts";

const facts = (over: Partial<PatientFacts> = {}): PatientFacts => ({
  pregnancyWeek: { weeks: 31, days: 2 },
  level: "HIGH",
  findings: ["2 des 3 dernières mesures ≥ 140/90 (146/94, 144/92)"],
  unconfirmedSevere: null,
  lastReadings: [{ sys: 146, dia: 94, hoursAgo: 2, status: "HYPERTENSIVE" }],
  average7Days: { sys: 134, dia: 86, count: 12 },
  trendSysPerWeek: 2.5,
  symptoms7Days: [],
  riskCategory: "HIGH",
  riskFactors: ["Grossesse multiple"],
  expectedPerDay: 2,
  ...over,
});

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe("LLM client", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_BASE_URL", "https://llm.test/v1/");
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", "test-model");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("calls the OpenAI-compatible endpoint and returns the text", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("  Bonjour.  "));
    expect(await complete({ system: "s", user: "u", maxTokens: 10 })).toBe("Bonjour.");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer test-key" });
  });

  it("returns null without configuration (no call)", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await complete({ system: "s", user: "u", maxTokens: 10 })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on HTTP error or unexpected body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 500 }));
    expect(await complete({ system: "s", user: "u", maxTokens: 10 })).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ nope: true })));
    expect(await complete({ system: "s", user: "u", maxTokens: 10 })).toBeNull();
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = complete({ system: "s", user: "u", maxTokens: 10 });
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS + 1);
    expect(await pending).toBeNull();
  });
});

describe("doctor texts", () => {
  it("the model only receives computed facts", () => {
    const text = factsToText(facts());
    expect(text).toContain("Terme : 31 SA + 2 j.");
    expect(text).toContain("146/94 il y a 2 h (hypertensive)");
    expect(text).toContain("Symptômes déclarés ces 7 derniers jours : aucun.");
  });

  it("the fallback summary is built from the facts", () => {
    const text = fallbackSummary(facts({ unconfirmedSevere: { sys: 165, dia: 112, hoursAgo: 3 } }));
    expect(text).toContain("Grossesse à 31 SA + 2 j, niveau élevé");
    expect(text).toContain("Une mesure sévère de 165/112 n'a pas été recontrôlée.");
    expect(text).toContain("Systolique en hausse de 2,5 mmHg par semaine.");
  });

  it("an urgent patient's draft always says to go now", () => {
    const urgent = facts({ level: "SEVERE" });
    expect(fallbackDraft(urgent)).toContain("allez aux urgences de la maternité ou appelez le 14 maintenant");
    expect(safeDraft(urgent, "Bonjour, reposez-vous.")).toBe(fallbackDraft(urgent));
    expect(safeDraft(facts(), "Bonjour, continuez vos mesures.")).toBe("Bonjour, continuez vos mesures.");
  });
});

describe("patient assistant safety (spec §9.3)", () => {
  it.each(["J'ai très mal à la tête", "je vois des éclairs", "Mes mains sont gonflées", "Ma tension est à 150/95", "le bébé bouge moins"])(
    "detects a symptom: %s",
    (q) => expect(mentionsSymptom(q)).toBe(true),
  );

  it.each(["Comment mesurer ma tension ?", "Normalement je mesure le matin", "C'est quoi la pré-éclampsie ?"])("general question: %s", (q) =>
    expect(mentionsSymptom(q)).toBe(false),
  );

  it("adds the safety sentence and the questionnaire pointer when the model forgets them", () => {
    const answer = safeAnswer("J'ai mal à la tête", "Le repos peut aider.");
    expect(answer.startsWith(SAFETY_SENTENCE)).toBe(true);
    expect(answer).toContain("questionnaire");
  });

  it("the fallback keeps the safety sentence for symptoms, and is plain otherwise", () => {
    expect(safeAnswer("Je vois flou", null)).toContain(SAFETY_SENTENCE);
    expect(safeAnswer("Comment marche l'application ?", null)).toBe(ASSISTANT_FALLBACK);
  });
});
