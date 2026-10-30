import type { AdviceSituation } from "@/lib/domain/advice";
import type { Language } from "@/lib/store/types";
import type { Ctx } from "./context";

/** Approved advice texts, selected by the rules engine (CLAUDE.md §9). */
export async function adviceText(ctx: Ctx, situation: AdviceSituation, language: Language): Promise<string> {
  const item = await ctx.repo.findAdvice(situation, language);
  if (!item) throw new Error(`Missing advice text for ${situation}`);
  return item.text;
}
