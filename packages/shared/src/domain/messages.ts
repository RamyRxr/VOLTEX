import { CONFIG } from "./config";
import type { EvaluationResult } from "./evaluate";
import type { Level, SessionStatus } from "./types";

/**
 * What the patient's result screen shows (spec §4.1.7, §8 `evaluation`).
 * Approved message list — wording TO VALIDATE with a doctor or midwife.
 * A low level never tells the patient not to seek help.
 */
export interface PatientEvaluation {
  readonly level: Level;
  readonly patientWord: string;
  /** Icon name; apps map it to their icon set. Status is never colour alone. */
  readonly icon: string;
  /** Semantic colour token: danger | warning | watch | neutral | ok. */
  readonly color: string;
  readonly message: string;
  readonly action?: "CALL_EMERGENCY" | "REMEASURE";
  readonly remeasureInSeconds?: number;
}

const SEEK_HELP = "En cas de symptôme inquiétant, allez aux urgences de la maternité ou appelez le 14.";
export const EMERGENCY_MESSAGE = "Allez aux urgences de la maternité ou appelez le 14 maintenant.";

const BY_LEVEL: Readonly<Record<Level, Omit<PatientEvaluation, "level">>> = {
  EMERGENCY: { patientWord: "Urgent", icon: "alert-octagon", color: "danger", message: EMERGENCY_MESSAGE, action: "CALL_EMERGENCY" },
  SEVERE: { patientWord: "Urgent", icon: "alert-octagon", color: "danger", message: EMERGENCY_MESSAGE, action: "CALL_EMERGENCY" },
  HIGH: {
    patientWord: "Attention",
    icon: "alert-triangle",
    color: "warning",
    message: `Votre tension est élevée sur plusieurs mesures. Votre médecin est prévenu. ${SEEK_HELP}`,
  },
  WATCH: {
    patientWord: "À surveiller",
    icon: "eye",
    color: "watch",
    message: `Quelques signes sont à surveiller. Continuez vos mesures et le questionnaire. ${SEEK_HELP}`,
  },
  SILENT: {
    patientWord: "À suivre",
    icon: "clock",
    color: "neutral",
    message: `Pensez à mesurer votre tension régulièrement. ${SEEK_HELP}`,
  },
  OK: {
    patientWord: "Bon",
    icon: "check-circle",
    color: "ok",
    message: `Vos dernières mesures sont dans les valeurs attendues. Continuez votre suivi. ${SEEK_HELP}`,
  },
};

/** Seconds before the confirmation re-measure (shortened in demo mode, spec §13). */
export const remeasureSeconds = (demoMode: boolean): number =>
  demoMode ? CONFIG.demoMode.confirmSevereAfterSeconds : CONFIG.confirmSevereAfterMinutes * 60;

function remeasureMessage(seconds: number): string {
  const delay = seconds >= 60 ? `${Math.round(seconds / 60)} minutes` : `${seconds} secondes`;
  return `Reposez-vous et mesurez à nouveau dans ${delay}. ${SEEK_HELP}`;
}

/**
 * Result screen for the patient. EMERGENCY / SEVERE win; otherwise a new
 * severe reading waiting for confirmation asks for a re-measure.
 */
export function patientEvaluation(
  result: Pick<EvaluationResult, "level">,
  options: { readonly newSessionStatus?: SessionStatus; readonly demoMode: boolean },
): PatientEvaluation {
  const urgent = result.level === "EMERGENCY" || result.level === "SEVERE";
  if (!urgent && options.newSessionStatus === "SEVERE_PENDING") {
    const seconds = remeasureSeconds(options.demoMode);
    return {
      level: result.level,
      patientWord: "Attention",
      icon: "timer",
      color: "warning",
      message: remeasureMessage(seconds),
      action: "REMEASURE",
      remeasureInSeconds: seconds,
    };
  }
  return { level: result.level, ...BY_LEVEL[result.level] };
}
