import { z } from "zod";

/**
 * Server-only LLM client (spec §9). Any OpenAI-compatible Chat Completions API
 * (OpenAI, Mistral, Groq, Gemini's compatible endpoint, a local server…), chosen
 * with LLM_BASE_URL, LLM_API_KEY and LLM_MODEL. No SDK: plain fetch.
 *
 * Never throws: on missing configuration, timeout or any error it returns null,
 * and every caller has a static fallback. The demo never depends on a live call.
 */

export const LLM_TIMEOUT_MS = 10_000;

export interface Completion {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
}

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

interface LlmConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

function config(): LlmConfig | null {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
}

export const isLlmConfigured = (): boolean => config() != null;

/** The model's answer, trimmed, or null (then the caller uses its fallback). */
export async function complete({ system, user, maxTokens }: Completion): Promise<string | null> {
  const cfg = config();
  if (!cfg) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`LLM call failed: HTTP ${res.status}`);
      return null;
    }
    const parsed = responseSchema.safeParse(await res.json());
    const text = parsed.success ? parsed.data.choices[0]?.message.content.trim() : "";
    return text ? text : null;
  } catch (error: unknown) {
    // Error name only: prompts carry clinical facts and are never logged.
    console.error("LLM call failed:", error instanceof Error ? error.name : "unknown");
    return null;
  } finally {
    clearTimeout(timer);
  }
}
