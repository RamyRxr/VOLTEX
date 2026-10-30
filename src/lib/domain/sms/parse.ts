import { CONFIG } from "../config";
import type { PillStatus, SymptomType } from "../types";

/**
 * Grammar (spec §4.3), case-insensitive, extra spaces tolerated:
 *   TA <sys> <dia> [<pulse>] [codes...]
 * "145/92" is accepted as well as "145 92".
 */
const SYMPTOM_CODES: Record<string, SymptomType> = {
  CP: "CHEST_PAIN",
  VU: "VISION",
  CF: "CONFUSION",
  FB: "WEAKNESS",
  PA: "SPEECH",
  MT: "HEADACHE",
  VE: "DIZZINESS",
  SN: "NOSEBLEED",
};

export interface ParsedSms {
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number | null;
  readonly pillStatus: PillStatus;
  readonly symptoms: SymptomType[];
  /** Tokens we did not understand. Ignored so a typo never drops a danger code. */
  readonly ignored: string[];
}

export type SmsParseResult =
  | { readonly ok: true; readonly value: ParsedSms }
  | { readonly ok: false; readonly reason: "NOT_A_READING" | "MISSING_VALUES" | "OUT_OF_RANGE" };

const isInt = (t: string) => /^\d{1,3}$/.test(t);
const inRange = (n: number, r: { min: number; max: number }) => n >= r.min && n <= r.max;

function pillFrom(codes: readonly string[]): PillStatus {
  const missed = codes.includes("MP");
  const taken = codes.includes("PP");
  if (missed === taken) return "NOT_REPORTED"; // neither, or contradictory
  return missed ? "MISSED" : "TAKEN";
}

export function parseSms(body: string): SmsParseResult {
  const tokens = body.trim().toUpperCase().split(/[\s/,;]+/).filter(Boolean);
  if (tokens[0] !== "TA") return { ok: false, reason: "NOT_A_READING" };

  const [sysT, diaT, ...rest] = tokens.slice(1);
  if (!sysT || !diaT || !isInt(sysT) || !isInt(diaT)) return { ok: false, reason: "MISSING_VALUES" };

  const pulseT = rest[0] && isInt(rest[0]) ? rest[0] : null;
  const codes = pulseT ? rest.slice(1) : rest;
  const sys = Number(sysT);
  const dia = Number(diaT);
  const pulse = pulseT ? Number(pulseT) : null;

  const { plausible } = CONFIG;
  const valid =
    inRange(sys, plausible.sys) &&
    inRange(dia, plausible.dia) &&
    dia < sys &&
    (pulse == null || inRange(pulse, plausible.pulse));
  if (!valid) return { ok: false, reason: "OUT_OF_RANGE" };

  const symptoms = [...new Set(codes.filter((c) => c in SYMPTOM_CODES).map((c) => SYMPTOM_CODES[c]))];
  const ignored = codes.filter((c) => !(c in SYMPTOM_CODES) && c !== "MP" && c !== "PP");

  return { ok: true, value: { sys, dia, pulse, pillStatus: pillFrom(codes), symptoms, ignored } };
}

/** Body for the patient page "Envoyer par SMS" button: TA 145 92 78 MP CP */
export function formatSmsBody(args: {
  sys: number;
  dia: number;
  pulse: number | null;
  pillStatus: PillStatus;
  symptoms: readonly SymptomType[];
}): string {
  const codeOf = Object.fromEntries(Object.entries(SYMPTOM_CODES).map(([k, v]) => [v, k]));
  const pill = args.pillStatus === "MISSED" ? ["MP"] : args.pillStatus === "TAKEN" ? ["PP"] : [];
  return ["TA", args.sys, args.dia, args.pulse ?? "", ...pill, ...args.symptoms.map((s) => codeOf[s])]
    .filter((x) => x !== "")
    .join(" ");
}
