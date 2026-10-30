import { answeredYes, DANGER_ITEMS, QUESTIONNAIRE_ITEMS, type QuestionnaireItem } from "shared";

/** Display helpers over the questionnaire lists from "shared" (spec §6.3, lists TO VALIDATE). */
export type { QuestionnaireItem };

export const ALL_ITEMS: readonly QuestionnaireItem[] = QUESTIONNAIRE_ITEMS;

export function isDangerItem(code: string): boolean {
  return (DANGER_ITEMS as readonly string[]).includes(code);
}

type AnswerMap = Readonly<Partial<Record<string, boolean>>>;
const yesOnly = (answers: AnswerMap): Record<string, boolean> =>
  Object.fromEntries(Object.entries(answers).filter((e): e is [string, boolean] => e[1] === true));

/** True when any danger item is answered yes — used only as an offline safety net on the phone. */
export function hasDangerAnswer(answers: AnswerMap): boolean {
  return answeredYes(yesOnly(answers), DANGER_ITEMS).length > 0;
}

export function yesItems(answers: AnswerMap): QuestionnaireItem[] {
  return answeredYes(yesOnly(answers), QUESTIONNAIRE_ITEMS);
}
