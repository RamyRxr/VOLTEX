/** Daily questionnaire items (spec §6.3). Lists TO VALIDATE with a doctor or midwife. */

/** Any "yes" = emergency. */
export const DANGER_ITEMS = [
  "SEVERE_HEADACHE",
  "VISION_PROBLEMS",
  "UPPER_ABDOMINAL_PAIN",
  "SUDDEN_SWELLING_FACE_HANDS",
  "BREATHING_DIFFICULTY",
  "REDUCED_FETAL_MOVEMENT",
] as const;

/** Any "yes" = watch. */
export const WATCH_ITEMS = ["MILD_HEADACHE", "SWELLING_LEGS", "NAUSEA_VOMITING", "UNUSUAL_FATIGUE"] as const;

export const QUESTIONNAIRE_ITEMS = [...DANGER_ITEMS, ...WATCH_ITEMS] as const;

export type DangerItem = (typeof DANGER_ITEMS)[number];
export type WatchItem = (typeof WATCH_ITEMS)[number];
export type QuestionnaireItem = (typeof QUESTIONNAIRE_ITEMS)[number];

/** Short French labels, used in alert reasons and the doctor's file. */
export const ITEM_LABELS: Readonly<Record<QuestionnaireItem, string>> = {
  SEVERE_HEADACHE: "maux de tête intenses",
  VISION_PROBLEMS: "troubles de la vue",
  UPPER_ABDOMINAL_PAIN: "douleur en haut du ventre",
  SUDDEN_SWELLING_FACE_HANDS: "gonflement soudain du visage ou des mains",
  BREATHING_DIFFICULTY: "difficulté à respirer",
  REDUCED_FETAL_MOVEMENT: "bébé qui bouge moins",
  MILD_HEADACHE: "maux de tête légers",
  SWELLING_LEGS: "jambes gonflées",
  NAUSEA_VOMITING: "nausées ou vomissements",
  UNUSUAL_FATIGUE: "fatigue inhabituelle",
};

/** Items of `list` answered yes, in list order. */
export function answeredYes<T extends string>(
  answers: Readonly<Record<string, boolean>>,
  list: readonly T[],
): T[] {
  return list.filter((item) => answers[item] === true);
}

export const labelsOf = (items: readonly QuestionnaireItem[]): string =>
  items.map((i) => ITEM_LABELS[i]).join(", ");
