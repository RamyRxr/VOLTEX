import { CONFIG } from "../config";
import { isDangerSymptom } from "../thresholds";
import type { PillStatus, SymptomType } from "../types";

/**
 * Grammar (CLAUDE.md §4.3), case-insensitive, any separator tolerated:
 *   TA <sys> <dia> [<pulse>] [codes...]
 * "TA: 145/92 78", "TA145 92" and "CP." are read like "TA 145 92 78" and "CP".
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
  | {
      readonly ok: false;
      readonly reason: "NOT_A_READING" | "MISSING_VALUES" | "OUT_OF_RANGE";
      /** A danger code was present: the reply must still say "Appelez le 14". */
      readonly hasDanger: boolean;
    };

const isInt = (t: string) => /^\d{1,3}$/.test(t);
const inRange = (n: number, r: { min: number; max: number }) => n >= r.min && n <= r.max;

function pillFrom(codes: readonly string[]): PillStatus {
  const missed = codes.includes("MP");
  const taken = codes.includes("PP");
  if (missed === taken) return "NOT_REPORTED"; // neither, or contradictory
  return missed ? "MISSED" : "TAKEN";
}

function tokenize(body: string): string[] {
  const tokens = body.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const glued = /^TA(\d{1,3})$/.exec(tokens[0] ?? "");
  return glued ? ["TA", glued[1], ...tokens.slice(1)] : tokens;
}

export function parseSms(body: string): SmsParseResult {
  const tokens = tokenize(body);
  const hasDanger = tokens.some((t) => t in SYMPTOM_CODES && isDangerSymptom(SYMPTOM_CODES[t]));
  const fail = (reason: "NOT_A_READING" | "MISSING_VALUES" | "OUT_OF_RANGE"): SmsParseResult => ({ ok: false, reason, hasDanger });
  if (tokens[0] !== "TA") return fail("NOT_A_READING");

  const [sysT, diaT, ...rest] = tokens.slice(1);
  if (!sysT || !diaT || !isInt(sysT) || !isInt(diaT)) return fail("MISSING_VALUES");

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
  if (!valid) return fail("OUT_OF_RANGE");

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
