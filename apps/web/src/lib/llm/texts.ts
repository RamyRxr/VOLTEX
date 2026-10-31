import type { PatientFacts } from "./facts";

/**
 * Prompts, static fallbacks and safety checks of the AI texts (spec §9).
 * Pure functions: easy to test, no network. Text is French (spec rule 11).
 */

const LEVEL_WORDS: Readonly<Record<string, string>> = {
  EMERGENCY: "urgence (signe de danger déclaré)",
  SEVERE: "sévère (tension ≥ 160/110 confirmée)",
  HIGH: "élevé",
  WATCH: "à surveiller",
  SILENT: "sans nouvelles (pas de mesure récente)",
  OK: "stable",
};
const RISK_WORDS: Readonly<Record<string, string>> = { LOW: "faible", MODERATE: "modéré", HIGH: "élevé" };
const STATUS_WORDS: Readonly<Record<string, string>> = {
  NORMAL: "normale",
  HYPERTENSIVE: "hypertensive",
  SEVERE_PENDING: "sévère, en attente de contrôle",
  SEVERE_CONFIRMED: "sévère confirmée",
  SEVERE_NOT_CONFIRMED: "sévère non confirmée au contrôle",
  SEVERE_EXPIRED: "sévère non confirmée",
};

const decimal = (n: number): string => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const ago = (hours: number): string => (hours < 1 ? "il y a moins d'une heure" : hours < 48 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`);
const week = (f: PatientFacts): string =>
  f.pregnancyWeek ? `${f.pregnancyWeek.weeks} SA${f.pregnancyWeek.days ? ` + ${f.pregnancyWeek.days} j` : ""}` : "terme inconnu";

/** The facts as a plain French list: the only input the model receives. */
export function factsToText(f: PatientFacts): string {
  const lines = [
    `Terme : ${week(f)}.`,
    `Niveau calculé par les règles : ${LEVEL_WORDS[f.level] ?? f.level}.`,
    f.findings.length ? `Motifs : ${f.findings.join(" ; ")}.` : "Motifs : aucune règle déclenchée.",
    f.unconfirmedSevere
      ? `Mesure sévère non confirmée : ${f.unconfirmedSevere.sys}/${f.unconfirmedSevere.dia} ${ago(f.unconfirmedSevere.hoursAgo)}.`
      : null,
    f.lastReadings.length
      ? `Dernières mesures : ${f.lastReadings.map((r) => `${r.sys}/${r.dia} ${ago(r.hoursAgo)} (${STATUS_WORDS[r.status] ?? r.status})`).join(", ")}.`
      : "Aucune mesure enregistrée.",
    f.average7Days ? `Moyenne sur 7 jours : ${f.average7Days.sys}/${f.average7Days.dia} (${f.average7Days.count} mesures).` : null,
    f.trendSysPerWeek != null ? `Tendance de la systolique sur 14 jours : ${f.trendSysPerWeek >= 0 ? "+" : ""}${decimal(f.trendSysPerWeek)} mmHg/semaine.` : null,
    `Symptômes déclarés ces 7 derniers jours : ${f.symptoms7Days.length ? f.symptoms7Days.join(", ") : "aucun"}.`,
    `Risque estimé par les règles : ${RISK_WORDS[f.riskCategory] ?? f.riskCategory}${f.riskFactors.length ? ` (${f.riskFactors.join(", ")})` : ""}.`,
    `Mesures attendues : ${f.expectedPerDay} par jour.`,
  ];
  return lines.filter((l): l is string => l != null).join("\n");
}

// ---------- 1. Doctor summary (spec §9.1) ----------

export const SUMMARY_SYSTEM = [
  "Tu aides un médecin qui suit des femmes enceintes pour une hypertension.",
  "Rédige UN seul paragraphe en français, de 3 à 5 phrases, qui résume les faits fournis.",
  "Chaque phrase doit être vérifiable dans les faits : n'invente aucun chiffre, aucune date, aucun symptôme.",
  "Ne pose aucun diagnostic, ne propose aucun traitement ni aucune conduite à tenir : le médecin décide.",
  "Pas de titre, pas de liste, pas de nom de patiente.",
].join(" ");

/** Deterministic paragraph from the same facts, when the model is unavailable. */
export function fallbackSummary(f: PatientFacts): string {
  const last = f.lastReadings[0];
  const parts = [
    `Grossesse à ${week(f)}, niveau ${LEVEL_WORDS[f.level] ?? f.level}${f.findings.length ? ` : ${f.findings.join(" ; ")}` : ""}.`,
    f.unconfirmedSevere ? `Une mesure sévère de ${f.unconfirmedSevere.sys}/${f.unconfirmedSevere.dia} n'a pas été recontrôlée.` : null,
    last ? `Dernière mesure ${last.sys}/${last.dia} ${ago(last.hoursAgo)}.` : "Aucune mesure enregistrée.",
    f.average7Days ? `Moyenne sur 7 jours ${f.average7Days.sys}/${f.average7Days.dia} (${f.average7Days.count} mesures).` : null,
    // The trend sentence is skipped when the trend is already one of the reasons.
    f.trendSysPerWeek != null && Math.abs(f.trendSysPerWeek) >= 1 && !f.findings.some((r) => r.startsWith("Systolique en hausse"))
      ? `Systolique ${f.trendSysPerWeek > 0 ? "en hausse" : "en baisse"} de ${decimal(Math.abs(f.trendSysPerWeek))} mmHg par semaine.`
      : null,
    f.symptoms7Days.length ? `Symptômes déclarés cette semaine : ${f.symptoms7Days.join(", ")}.` : "Aucun symptôme déclaré cette semaine.",
    `Risque ${RISK_WORDS[f.riskCategory] ?? f.riskCategory}${f.riskFactors.length ? ` (${f.riskFactors.join(", ")})` : ""}.`,
  ];
  return parts.filter((p): p is string => p != null).join(" ");
}

// ---------- 2. Draft advice (spec §9.2) ----------

export const DRAFT_SYSTEM = [
  "Tu proposes au médecin un court message (2 à 4 phrases) qu'il modifiera puis enverra lui-même à sa patiente enceinte.",
  "Français simple, vouvoiement, ton bienveillant, commence par « Bonjour, ».",
  "N'invente rien au-delà des faits fournis. Aucun diagnostic, aucun médicament, aucune dose, aucun changement de traitement.",
  "Si le niveau est urgence ou sévère, le message dit d'aller aux urgences de la maternité ou d'appeler le 14 maintenant.",
  "Sinon, termine en rappelant : en cas de symptôme inquiétant, aller aux urgences de la maternité ou appeler le 14.",
].join(" ");

const URGENT_SENTENCE = "allez aux urgences de la maternité ou appelez le 14";

const DRAFT_FALLBACK: Readonly<Record<string, string>> = {
  EMERGENCY: `Bonjour, vos dernières informations demandent un avis médical rapide : ${URGENT_SENTENCE} maintenant.`,
  SEVERE: `Bonjour, votre tension est très élevée sur deux mesures : ${URGENT_SENTENCE} maintenant.`,
  HIGH: `Bonjour, j'ai vu que votre tension est élevée sur plusieurs mesures. Continuez à la mesurer matin et soir et remplissez le questionnaire chaque jour, je vous recontacte rapidement. En cas de symptôme inquiétant, ${URGENT_SENTENCE}.`,
  WATCH: `Bonjour, j'ai regardé vos dernières mesures : quelques éléments sont à surveiller. Continuez vos mesures et le questionnaire chaque jour. En cas de symptôme inquiétant, ${URGENT_SENTENCE}.`,
  SILENT: `Bonjour, je n'ai pas reçu de mesure de tension depuis un moment. Pouvez-vous mesurer votre tension aujourd'hui et remplir le questionnaire ? En cas de symptôme inquiétant, ${URGENT_SENTENCE}.`,
  OK: `Bonjour, vos dernières mesures sont rassurantes. Continuez votre suivi comme prévu. En cas de symptôme inquiétant, ${URGENT_SENTENCE}.`,
};

export const fallbackDraft = (f: PatientFacts): string => DRAFT_FALLBACK[f.level] ?? DRAFT_FALLBACK.OK ?? "";

/** An urgent patient must always be told to go now, whatever the model wrote. */
export function safeDraft(f: PatientFacts, text: string): string {
  const urgent = f.level === "EMERGENCY" || f.level === "SEVERE";
  return urgent && !normalize(text).includes(normalize(URGENT_SENTENCE)) ? fallbackDraft(f) : text;
}

// ---------- 3. Patient assistant (spec §9.3) ----------

export const SAFETY_SENTENCE = "Si vous avez ce symptôme, allez aux urgences de la maternité ou appelez le 14.";
const QUESTIONNAIRE_POINTER = "Signalez-le aussi dans le questionnaire du jour de l'application.";

export const ASSISTANT_SYSTEM = [
  "Tu es l'assistant d'information de SafeMaman, une application de suivi de la tension pendant la grossesse.",
  "Tu donnes uniquement des informations générales sur l'hypertension de la grossesse et sur le fonctionnement de l'application.",
  "Tu refuses tout diagnostic, toute interprétation personnelle d'une mesure, tout conseil de traitement, de médicament ou de dose : tu renvoies vers le médecin.",
  `Si la question évoque un symptôme ou une tension élevée, tu réponds : « ${SAFETY_SENTENCE} » et tu rappelles de le signaler dans le questionnaire du jour.`,
  "Réponds en français simple, en 4 phrases au maximum, avec le vouvoiement.",
].join(" ");

export const ASSISTANT_FALLBACK =
  "Je ne peux pas répondre pour le moment. Pour toute question sur votre santé ou votre traitement, contactez votre médecin, par exemple avec la messagerie de l'application.";

/** Lower-case, accents removed: "Œdème", "VISION" → "oedeme", "vision". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe");
}

/** Whole words or stems, on normalized text ("normalement" must not match "mal"). */
const SYMPTOM_PATTERNS: readonly RegExp[] = [
  /\bmal\b/, /\bmaux\b/, /douleur/, /\btete\b/, /migraine/, /\bvue\b/, /vision/, /\bflou/, /eclair/, /\bmouches?\b/,
  /gonfl/, /oedeme/, /respir/, /essouffl/, /saign/, /\bpertes?\b/, /contraction/, /\bbouge/, /mouvement/, /fievre/,
  /vomi/, /nausee/, /fatigu/, /vertige/, /malaise/, /symptome/,
];
/** A reading of 140 or more ("150/95", "tension à 160"). */
const HIGH_READING = /\b(1[4-9]\d|2\d\d)\b/;

/** True when the question mentions a symptom or a high reading (spec §9.3). */
export function mentionsSymptom(question: string): boolean {
  const q = normalize(question);
  return SYMPTOM_PATTERNS.some((p) => p.test(q)) || HIGH_READING.test(q);
}

/** The safety sentence and the questionnaire pointer are guaranteed by code, not left to the model. */
export function safeAnswer(question: string, answer: string | null): string {
  const base = answer ?? ASSISTANT_FALLBACK;
  if (!mentionsSymptom(question)) return base;
  const hasSafety = normalize(base).includes(normalize("allez aux urgences de la maternite ou appelez le 14"));
  return [hasSafety ? base : `${SAFETY_SENTENCE} ${base}`, normalize(base).includes("questionnaire") ? null : QUESTIONNAIRE_POINTER]
    .filter((p): p is string => p != null)
    .join(" ");
}
