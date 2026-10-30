import type { Level } from "./alerts/rules";

/** What the doctor reads. Short, clinical, never a diagnosis. */
export const LEVEL_WORD: Record<Level, string> = {
  EMERGENCY: "Urgence",
  CRISIS: "Crise",
  PENDING: "En attente",
  ORANGE: "Élevée",
  YELLOW: "Dérive",
  SILENT: "Silencieux",
  GREEN: "Stable",
};

/** Compact label for dense rows. */
export const LEVEL_SHORT: Record<Level, string> = {
  EMERGENCY: "Urgence",
  CRISIS: "Crise",
  PENDING: "Attente",
  ORANGE: "Élevée",
  YELLOW: "Dérive",
  SILENT: "Silence",
  GREEN: "Stable",
};

export const LEVEL_COLOR: Record<Level, string> = {
  EMERGENCY: "var(--crimson)",
  CRISIS: "var(--crimson)",
  PENDING: "var(--royal-3)",
  ORANGE: "var(--amber)",
  YELLOW: "var(--ochre)",
  SILENT: "var(--slate)",
  GREEN: "var(--emerald)",
};

export const LEVEL_ORDER: Level[] = [
  "EMERGENCY",
  "CRISIS",
  "PENDING",
  "ORANGE",
  "YELLOW",
  "SILENT",
  "GREEN",
];

export const SYMPTOM_FR: Record<string, string> = {
  HEADACHE: "maux de tête",
  DIZZINESS: "vertiges",
  NOSEBLEED: "saignement de nez",
  CHEST_PAIN: "douleur thoracique",
  VISION: "troubles visuels",
  CONFUSION: "confusion",
  WEAKNESS: "faiblesse d'un côté",
  SPEECH: "difficulté à parler",
};

export const SYMPTOM_LIST = [
  { id: "HEADACHE", label: "Maux de tête", danger: false },
  { id: "DIZZINESS", label: "Vertiges", danger: false },
  { id: "NOSEBLEED", label: "Saignement de nez", danger: false },
  { id: "CHEST_PAIN", label: "Douleur thoracique", danger: true },
  { id: "VISION", label: "Troubles visuels", danger: true },
  { id: "CONFUSION", label: "Confusion", danger: true },
  { id: "WEAKNESS", label: "Faiblesse d'un côté", danger: true },
  { id: "SPEECH", label: "Difficulté à parler", danger: true },
] as const;
