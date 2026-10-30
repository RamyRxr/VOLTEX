import { ar } from "./ar";
import { fr, type MessageKey } from "./fr";

export type { MessageKey };
export type Lang = "FR" | "AR";
export type Params = Readonly<Record<string, string | number>>;

/** Translate a key, interpolating {placeholders}. Missing Arabic keys fall back to French. */
export function t(key: MessageKey, params?: Params, lang: Lang = "FR"): string {
  const template = (lang === "AR" ? ar[key] : undefined) ?? fr[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export const dirOf = (lang: Lang): "ltr" | "rtl" => (lang === "AR" ? "rtl" : "ltr");
export const htmlLang = (lang: Lang): string => (lang === "AR" ? "ar" : "fr");

/** French decimal comma: 2.1 → "2,1", 7 → "7". */
export function decimal(n: number, digits = 1): string {
  const factor = 10 ** digits;
  const rounded = Math.round(n * factor) / factor;
  return String(rounded).replace(".", ",");
}

/** Fixed decimals with a French comma: 2 → "2,0". */
export function fixed(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

/** Explicit sign: +2,1 / −1,5 / 0. `exact` keeps trailing zeros (+2,0). */
export function signed(n: number, digits = 1, exact = false): string {
  const text = exact ? fixed(Math.abs(n), digits) : decimal(Math.abs(n), digits);
  if (Number(text.replace(",", ".")) === 0) return exact ? fixed(0, digits) : "0";
  return `${n > 0 ? "+" : "−"}${text}`;
}

export const bpText = (bp: { readonly sys: number; readonly dia: number }): string => `${bp.sys}/${bp.dia}`;
