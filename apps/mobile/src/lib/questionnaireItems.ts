/**
 * Daily questionnaire items (CLAUDE.md §6.3) — lists TO VALIDATE with a doctor or midwife.
 * Move to `packages/shared` (DANGER_ITEMS / WATCH_ITEMS) once Ramy adds them there.
 */
export const DANGER_ITEMS = [
  "SEVERE_HEADACHE",
  "VISION_PROBLEMS",
  "UPPER_ABDOMINAL_PAIN",
  "SUDDEN_SWELLING_FACE_HANDS",
  "BREATHING_DIFFICULTY",
  "REDUCED_FETAL_MOVEMENT",
] as const;

export const WATCH_ITEMS = ["MILD_HEADACHE", "SWELLING_LEGS", "NAUSEA_VOMITING", "UNUSUAL_FATIGUE"] as const;

export type DangerItem = (typeof DANGER_ITEMS)[number];
export type WatchItem = (typeof WATCH_ITEMS)[number];
export type QuestionnaireItem = DangerItem | WatchItem;

export const ALL_ITEMS: readonly QuestionnaireItem[] = [...DANGER_ITEMS, ...WATCH_ITEMS];

export function isDangerItem(code: string): code is DangerItem {
  return (DANGER_ITEMS as readonly string[]).includes(code);
}

/** True when any danger item is answered yes — used only as an offline safety net on the phone. */
export function hasDangerAnswer(answers: Readonly<Record<string, boolean>>): boolean {
  return DANGER_ITEMS.some((item) => answers[item] === true);
}

export function yesItems(answers: Readonly<Record<string, boolean>>): QuestionnaireItem[] {
  return ALL_ITEMS.filter((item) => answers[item] === true);
}
