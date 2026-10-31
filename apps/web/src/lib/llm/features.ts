import { db } from "@/server/db";
import { complete } from "./client";
import { patientFacts } from "./facts";
import {
  ASSISTANT_SYSTEM,
  DRAFT_SYSTEM,
  SUMMARY_SYSTEM,
  factsToText,
  fallbackDraft,
  fallbackSummary,
  safeAnswer,
  safeDraft,
} from "./texts";

/** The three AI texts of spec §9; each one falls back to a static text. */

export type TextSource = "AI" | "FALLBACK";

export interface SummaryResult {
  readonly text: string;
  readonly generatedAt: string | null;
  readonly fromCache: boolean;
  readonly source?: TextSource;
}

/**
 * Doctor summary. Without `refresh`, the stored summary is returned (demo
 * patients have pre-generated ones: the demo needs no live call). An AI summary
 * is stored in Patient.aiSummary; a fallback one is only returned.
 */
export async function doctorSummary(patientId: string, refresh: boolean, now: Date): Promise<SummaryResult> {
  if (!refresh) {
    const stored = await db.patient.findUnique({ where: { id: patientId }, select: { aiSummary: true } });
    if (stored?.aiSummary) return { text: stored.aiSummary, generatedAt: null, fromCache: true };
  }
  const facts = await patientFacts(patientId, now);
  const ai = await complete({ system: SUMMARY_SYSTEM, user: factsToText(facts), maxTokens: 350 });
  if (!ai) return { text: fallbackSummary(facts), generatedAt: now.toISOString(), fromCache: false, source: "FALLBACK" };
  await db.patient.update({ where: { id: patientId }, data: { aiSummary: ai } });
  return { text: ai, generatedAt: now.toISOString(), fromCache: false, source: "AI" };
}

/** Message suggestion for the doctor to edit and send himself (never sent automatically). */
export async function draftAdvice(patientId: string, now: Date): Promise<{ text: string; source: TextSource }> {
  const facts = await patientFacts(patientId, now);
  const ai = await complete({ system: DRAFT_SYSTEM, user: factsToText(facts), maxTokens: 220 });
  return ai ? { text: safeDraft(facts, ai), source: "AI" } : { text: fallbackDraft(facts), source: "FALLBACK" };
}

/** General information only; the safety sentence is guaranteed for symptoms. */
export async function assistantAnswer(question: string): Promise<{ answer: string }> {
  const ai = await complete({ system: ASSISTANT_SYSTEM, user: question, maxTokens: 300 });
  return { answer: safeAnswer(question, ai) };
}
