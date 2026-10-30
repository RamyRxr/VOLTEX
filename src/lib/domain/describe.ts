import { CONFIG } from "./config";
import type { Assessment, Finding, PendingCrisisItem } from "./levels";
import type { MissedPillResult } from "./missedPill";
import type { TrendResult } from "./trend";
import type { OfficeComparison } from "./whiteCoat";
import type { BP, SymptomType } from "./types";
import { bpText, decimal, signed, t, type Lang } from "../i18n";

/** Every reason is generated from computed numbers, never typed (CLAUDE.md §6.7). */

export const symptomLabel = (s: SymptomType, lang: Lang = "FR") => t(`symptom.${s}` as const, undefined, lang);

const list = (bps: readonly BP[]) => bps.map(bpText).join(", ");

/** "7" for whole numbers, "4,7" otherwise. */
const days = (n: number) => decimal(n, 1);

export function describeFinding(f: Finding, lang: Lang = "FR"): string {
  switch (f.kind) {
    case "DANGER":
      return t(
        "finding.DANGER",
        { symptoms: f.symptoms.map((s) => symptomLabel(s, lang).toLocaleLowerCase("fr")).join(", "), bp: bpText(f.bp) },
        lang,
      );
    case "CRISIS":
      return t("finding.CRISIS", { bp: bpText(f.bp) }, lang);
    case "HIGH_REPEATED":
      return t("finding.HIGH_REPEATED", { n: f.hits.length, threshold: bpText(CONFIG.high), list: list(f.hits) }, lang);
    case "LOW_REPEATED":
      return t("finding.LOW_REPEATED", { n: f.hits.length, threshold: bpText(CONFIG.low), list: list(f.hits) }, lang);
    case "AVERAGE":
      return t("finding.AVERAGE", { avg: bpText(f.avg), target: bpText(f.target) }, lang);
    case "TREND":
      return f.daysToTarget == null
        ? t("finding.TREND_ABOVE", { slope: signed(f.perWeek) }, lang)
        : t("finding.TREND", { slope: signed(f.perWeek), days: f.daysToTarget }, lang);
    case "MISSED_PILL":
      return t("finding.MISSED_PILL", { delta: signed(f.deltaSys, 0) }, lang);
    case "SILENCE":
      return t(
        f.neverMeasured ? "finding.SILENCE_NEVER" : "finding.SILENCE",
        { days: f.days, threshold: days(f.thresholdDays) },
        lang,
      );
  }
}

export function describePendingCrisis(item: PendingCrisisItem, lang: Lang = "FR"): string {
  return t(item.awaiting ? "pending.awaiting" : "pending.unconfirmed", { bp: bpText(item.bp) }, lang);
}

export function describeGreen(a: Pick<Assessment, "avg7" | "target">, lang: Lang = "FR"): string {
  return a.avg7
    ? t("finding.GREEN", { avg: bpText(a.avg7), target: bpText(a.target) }, lang)
    : t("finding.GREEN_NO_DATA", undefined, lang);
}

/** The one-line reason shown in the triage list. */
export function describeReason(a: Assessment, lang: Lang = "FR"): string {
  const primaryIsSilenceOrNone = !a.primary || a.primary.kind === "SILENCE";
  if (a.pendingCrisis && primaryIsSilenceOrNone) return describePendingCrisis(a.pendingCrisis, lang);
  return a.primary ? describeFinding(a.primary, lang) : describeGreen(a, lang);
}

export function describeOffice(o: OfficeComparison, lang: Lang = "FR"): string {
  return t(o.kind === "WHITE_COAT" ? "info.whiteCoat" : "info.masked", { home: bpText(o.home), office: bpText(o.office) }, lang);
}

export function describeMissedPill(m: MissedPillResult, lang: Lang = "FR"): string {
  if (!m.flagged) return t("info.missedPillNone", { delta: signed(m.deltaSys, 0) }, lang);
  return t(
    "info.missedPill",
    {
      delta: signed(m.deltaSys, 0),
      missed: bpText(m.missed),
      taken: bpText(m.taken),
      missedCount: m.missedCount,
      takenCount: m.takenCount,
    },
    lang,
  );
}

export function describeTrend(tr: TrendResult, lang: Lang = "FR"): string {
  const key = tr.direction === "up" ? "info.trendUp" : tr.direction === "down" ? "info.trendDown" : "info.trendFlat";
  const slope = tr.direction === "flat" ? signed(tr.perWeek) : decimal(Math.abs(tr.perWeek));
  return t(key, { slope }, lang);
}

export function describeAdherence(adherence: number, lang: Lang = "FR"): string {
  return t("info.adherence", { pct: Math.round(adherence * 100) }, lang);
}
